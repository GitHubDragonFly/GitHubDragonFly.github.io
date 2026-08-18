import {
	DataUtils,
	FileLoader,
	Loader
} from 'three';

import { SH_BAND_COMPONENTS, SH_BAND_WORDS, createGaussianSplatGeometry, createPackedSphericalHarmonicsBand, writeColorBytes, writeCovariance } from '../utils/GaussianSplatUtils.js';

const HEADER_SIZE_BYTES = 4096;
const SECTION_HEADER_SIZE_BYTES = 1024;
const CURRENT_VERSION_MAJOR = 0;
const CURRENT_VERSION_MINOR = 1;
const MAX_SPLATS = 10000000;
const SH_DEGREE_TO_COMPONENTS = [ 0, 9, 24, 45 ];
const SH_BAND_INDEX = [
	null,
	[ 0, 3, 6, 1, 4, 7, 2, 5, 8 ],
	[ 9, 14, 19, 10, 15, 20, 11, 16, 21, 12, 17, 22, 13, 18, 23 ],
	[ 24, 31, 38, 25, 32, 39, 26, 33, 40, 27, 34, 41, 28, 35, 42, 29, 36, 43, 30, 37, 44 ]
];
const COMPRESSION_LEVELS = {
	0: {
		bytesPerCenter: 12,
		bytesPerScale: 12,
		bytesPerRotation: 16,
		bytesPerColor: 4,
		bytesPerSphericalHarmonicsComponent: 4,
		scaleOffsetBytes: 12,
		rotationOffsetBytes: 24,
		colorOffsetBytes: 40,
		scaleRange: 1
	},
	1: {
		bytesPerCenter: 6,
		bytesPerScale: 6,
		bytesPerRotation: 8,
		bytesPerColor: 4,
		bytesPerSphericalHarmonicsComponent: 2,
		scaleOffsetBytes: 6,
		rotationOffsetBytes: 12,
		colorOffsetBytes: 20,
		scaleRange: 32767
	},
	2: {
		bytesPerCenter: 6,
		bytesPerScale: 6,
		bytesPerRotation: 8,
		bytesPerColor: 4,
		bytesPerSphericalHarmonicsComponent: 1,
		scaleOffsetBytes: 6,
		rotationOffsetBytes: 12,
		colorOffsetBytes: 20,
		scaleRange: 32767
	}
};

/**
 * A loader for GaussianSplats3D `.ksplat` files.
 *
 * Custom WebGL2 version for use with gsplat/pmnrds splat loaders via custom splatTranscoder.
 *
 * ```js
 * const loader = new KSPLATLoader();
 * const data = await loader.loadAsync( './models/splat/example.ksplat' );
 * ```
 *
 * @augments Loader
 * @three_import import { SPZLoader } from 'path/to/KSPLATWebGL2Loader.js';
 */
class KSPLATLoader extends Loader {

	/**
	 * Constructs a new Gaussian splat KSPLAT loader.
	 *
	 * @param {LoadingManager} [manager] - The loading manager.
	 */
	constructor( manager ) {

		super( manager );

	}

	/**
	 * Starts loading from the given URL and passes the loaded splat data to
	 * the `onLoad()` callback.
	 *
	 * @param {string} url - The path/URL of the file to be loaded. This can also be a data URI.
	 * @param {function(BufferGeometry)} onLoad - Executed when the loading process has been finished.
	 * @param {onProgressCallback} onProgress - Executed while the loading is in progress.
	 * @param {onErrorCallback} onError - Executed when errors occur.
	 */
	load( url, onLoad, onProgress, onError ) {

		const scope = this;

		const loader = new FileLoader( this.manager );
		loader.setPath( this.path );
		loader.setResponseType( 'arraybuffer' );
		loader.setRequestHeader( this.requestHeader );
		loader.setWithCredentials( this.withCredentials );
		loader.load( url, function ( buffer ) {

			try {

				onLoad( scope.parse( buffer ) );

			} catch ( e ) {

				if ( onError ) {

					onError( e );

				} else {

					console.error( e );

				}

				scope.manager.itemError( url );

			}

		}, onProgress, onError );

	}

	/**
	 * Parses the given `.ksplat` data.
	 *
	 * @param {ArrayBuffer} buffer - The raw KSPLAT file as an array buffer.
	 * @return {BufferGeometry} The parsed splat geometry.
	 */
	parse( buffer ) {

		if ( buffer.byteLength < HEADER_SIZE_BYTES ) {

			throw new Error( 'THREE.KSPLATLoader: Invalid KSPLAT header.' );

		}

		const bytes = new Uint8Array( buffer );
		const view = new DataView( buffer );
		const header = parseHeader( view );

		if ( header.versionMajor !== CURRENT_VERSION_MAJOR || header.versionMinor < CURRENT_VERSION_MINOR ) {

			throw new Error( `THREE.KSPLATLoader: Unsupported KSPLAT version ${ header.versionMajor }.${ header.versionMinor }.` );

		}

		if ( header.compressionLevel < 0 || header.compressionLevel > 2 ) {

			throw new Error( `THREE.KSPLATLoader: Unsupported KSPLAT compression level ${ header.compressionLevel }.` );

		}

		if ( header.splatCount > MAX_SPLATS ) {

			throw new Error( `THREE.KSPLATLoader: KSPLAT file contains too many splats (${ header.splatCount }).` );

		}

		const sectionHeadersOffset = HEADER_SIZE_BYTES;
		const sectionDataOffset = HEADER_SIZE_BYTES + header.maxSectionCount * SECTION_HEADER_SIZE_BYTES;

		if ( bytes.byteLength < sectionDataOffset ) {

			throw new Error( 'THREE.KSPLATLoader: Invalid KSPLAT section headers.' );

		}

		const compression = COMPRESSION_LEVELS[ header.compressionLevel ];
		const centers = new Float32Array( header.splatCount * 3 );
		const covariances = new Float32Array( header.splatCount * 6 );
		const colors = new Uint8ClampedArray( header.splatCount * 4 );
		const sphericalHarmonics = {};
		const sphericalHarmonicsBytes = {};
		let splatOffset = 0;
		let sectionBase = sectionDataOffset;

		for ( let sectionIndex = 0; sectionIndex < header.maxSectionCount; sectionIndex ++ ) {

			const sectionHeaderOffset = sectionHeadersOffset + sectionIndex * SECTION_HEADER_SIZE_BYTES;
			const section = parseSectionHeader( view, sectionHeaderOffset, compression );
			const shComponents = SH_DEGREE_TO_COMPONENTS[ section.sphericalHarmonicsDegree ];

			if ( shComponents === undefined ) {

				throw new Error( `THREE.KSPLATLoader: Unsupported KSPLAT spherical harmonics degree ${ section.sphericalHarmonicsDegree }.` );

			}

			const bytesPerSplat = compression.bytesPerCenter + compression.bytesPerScale + compression.bytesPerRotation + compression.bytesPerColor +
				shComponents * compression.bytesPerSphericalHarmonicsComponent;
			const bucketsMetaDataSizeBytes = section.partiallyFilledBucketCount * 4;
			const bucketsStorageSizeBytes = section.bucketStorageSizeBytes * section.bucketCount + bucketsMetaDataSizeBytes;
			const splatDataStorageSizeBytes = bytesPerSplat * section.maxSplatCount;
			const storageSizeBytes = bucketsStorageSizeBytes + splatDataStorageSizeBytes;

			if ( sectionBase + storageSizeBytes > bytes.byteLength ) {

				throw new Error( 'THREE.KSPLATLoader: Invalid KSPLAT byte length.' );

			}

			if ( section.splatCount > 0 ) {

				readSection(
					view,
					bytes,
					section,
					compression,
					sectionBase,
					bucketsMetaDataSizeBytes,
					bucketsStorageSizeBytes,
					bytesPerSplat,
					splatOffset,
					centers,
					covariances,
					colors,
					sphericalHarmonics,
					sphericalHarmonicsBytes,
					header
				);

				splatOffset += section.splatCount;

			}

			sectionBase += storageSizeBytes;

		}

		if ( splatOffset !== header.splatCount ) {

			throw new Error( 'THREE.KSPLATLoader: KSPLAT splat count mismatch.' );

		}

		// WebGL2 Redirect Process

		// Allocate explicit arrays needed for standard .splat targets

		const computedScales = new Float32Array( header.splatCount * 3 );
		const computedRotations = new Float32Array( header.splatCount * 4 );

		// Decompose all section covariances back into scales and orientations

		for ( let i = 0; i < header.splatCount; i ++ ) {

			decomposeCovariance( covariances, i * 6, computedScales, computedRotations, i );

		}

		// Build Spherical Harmonics structures matching your unified signature

		const shPayload = {

			sh1: sphericalHarmonics?.sh1 || null,
			sh2: sphericalHarmonics?.sh2 || null,
			sh3: sphericalHarmonics?.sh3 || null

		};

		// Return a pure data payload directly for gsplat/pmndrs loader use

		return {
			count: header.splatCount,
			positions: centers,           // Float32Array [x, y, z...]
			scales: computedScales,       // Float32Array [sx, sy, sz...] (Linearized)
			rotations: computedRotations, // Float32Array [qx, qy, qz, qw...]
			colors: colors,               // Uint8ClampedArray [r, g, b, a...]
			sphericalHarmonics: shPayload
		};

	}

}

function decomposeCovariance( cov, offset, outScales, outQuats, splatIndex ) {

	const i6 = offset;
	const i3 = splatIndex * 3;
	const i4 = splatIndex * 4;

	// 1. Extract raw matrix variance elements

	const m00 = cov[ i6 + 0 ];
	const m01 = cov[ i6 + 1 ];
	const m02 = cov[ i6 + 2 ];
	const m11 = cov[ i6 + 3 ];
	const m12 = cov[ i6 + 4 ];
	const m22 = cov[ i6 + 5 ];

	// 2. Compute the trace-based linear scales (eigenvalue magnitudes)

	const sx = Math.sqrt( Math.max( 0, m00 ) );
	const sy = Math.sqrt( Math.max( 0, m11 ) );
	const sz = Math.sqrt( Math.max( 0, m22 ) );

	outScales[ i3 + 0 ] = sx;
	outScales[ i3 + 1 ] = sy;
	outScales[ i3 + 2 ] = sz;

	// 3. Fast structural rotation extraction
	// Formulates standard orientation via the trace of the reconstructed transform

	let tr = m00 + m11 + m22;
	let qx = 0, qy = 0, qz = 0, qw = 1;

	if ( tr > 0 ) {

		let S = Math.sqrt( tr + 1.0 ) * 2;

		qw = 0.25 * S;
		qx = ( m12 - m01 ) / S; // Approximates conjugate tracking vectors
		qy = ( m02 - m12 ) / S;
		qz = ( m01 - m02 ) / S;

	} else if ( ( m00 > m11 ) && ( m00 > m22 ) ) {

		let S = Math.sqrt( 1.0 + m00 - m11 - m22 ) * 2;

		qw = ( m12 - m01 ) / S;
		qx = 0.25 * S;
		qy = ( m01 + m12 ) / S;
		qz = ( m02 + m01 ) / S;

	} else if ( m11 > m22 ) {

		let S = Math.sqrt( 1.0 + m11 - m00 - m22 ) * 2;

		qw = ( m02 - m12 ) / S;
		qx = ( m01 + m12 ) / S;
		qy = 0.25 * S;
		qz = ( m12 + m02 ) / S;

	} else {

		let S = Math.sqrt( 1.0 + m22 - m00 - m11 ) * 2;

		qw = ( m01 - m02 ) / S;
		qx = ( m02 + m01 ) / S;
		qy = ( m12 + m02 ) / S;
		qz = 0.25 * S;

	}

	// Protect precision boundaries 

	const len = Math.sqrt( qx * qx + qy * qy + qz * qz + qw * qw );

	outQuats[ i4 + 0 ] = len > 0 ? qx / len : 0;
	outQuats[ i4 + 1 ] = len > 0 ? qy / len : 0;
	outQuats[ i4 + 2 ] = len > 0 ? qz / len : 0;
	outQuats[ i4 + 3 ] = len > 0 ? qw / len : 1;

}

function parseHeader( view ) {

	return {
		versionMajor: view.getUint8( 0 ),
		versionMinor: view.getUint8( 1 ),
		maxSectionCount: view.getUint32( 4, true ),
		sectionCount: view.getUint32( 8, true ),
		maxSplatCount: view.getUint32( 12, true ),
		splatCount: view.getUint32( 16, true ),
		compressionLevel: view.getUint16( 20, true ),
		minSphericalHarmonicsCoeff: view.getFloat32( 36, true ) || - 1.5,
		maxSphericalHarmonicsCoeff: view.getFloat32( 40, true ) || 1.5
	};

}

function parseSectionHeader( view, offset, compression ) {

	return {
		splatCount: view.getUint32( offset, true ),
		maxSplatCount: view.getUint32( offset + 4, true ),
		bucketSize: view.getUint32( offset + 8, true ),
		bucketCount: view.getUint32( offset + 12, true ),
		bucketBlockSize: view.getFloat32( offset + 16, true ),
		bucketStorageSizeBytes: view.getUint16( offset + 20, true ),
		compressionScaleRange: view.getUint32( offset + 24, true ) || compression.scaleRange,
		fullBucketCount: view.getUint32( offset + 32, true ),
		partiallyFilledBucketCount: view.getUint32( offset + 36, true ),
		sphericalHarmonicsDegree: view.getUint16( offset + 40, true )
	};

}

function readSection( view, bytes, section, compression, sectionBase, bucketsMetaDataSizeBytes, bucketsStorageSizeBytes, bytesPerSplat, splatOffset, centers, covariances, colors, sphericalHarmonics, sphericalHarmonicsBytes, header ) {

	const bucketsBase = sectionBase + bucketsMetaDataSizeBytes;
	const dataBase = sectionBase + bucketsStorageSizeBytes;
	const fullBucketSplats = section.fullBucketCount * section.bucketSize;
	const compressionScaleFactor = section.bucketBlockSize / 2 / section.compressionScaleRange;
	const sphericalHarmonicsOffset = compression.colorOffsetBytes + compression.bytesPerColor;
	let partialBucketIndex = section.fullBucketCount;
	let partialBucketBase = fullBucketSplats;

	ensureSphericalHarmonics( sphericalHarmonics, sphericalHarmonicsBytes, header.splatCount, section.sphericalHarmonicsDegree );

	for ( let i = 0; i < section.splatCount; i ++ ) {

		const bucketIndex = getBucketIndex( view, section, sectionBase, i, fullBucketSplats, partialBucketIndex, partialBucketBase );

		if ( bucketIndex.partialBucketIndex !== undefined ) {

			partialBucketIndex = bucketIndex.partialBucketIndex;
			partialBucketBase = bucketIndex.partialBucketBase;

		}

		const rowOffset = dataBase + i * bytesPerSplat;
		const outIndex = splatOffset + i;
		const i3 = outIndex * 3;

		if ( compression.bytesPerCenter === 12 ) {

			centers[ i3 ] = view.getFloat32( rowOffset, true );
			centers[ i3 + 1 ] = view.getFloat32( rowOffset + 4, true );
			centers[ i3 + 2 ] = view.getFloat32( rowOffset + 8, true );

		} else {

			const bucketBase = bucketsBase + bucketIndex.value * section.bucketStorageSizeBytes;
			centers[ i3 ] = ( view.getUint16( rowOffset, true ) - section.compressionScaleRange ) * compressionScaleFactor + view.getFloat32( bucketBase, true );
			centers[ i3 + 1 ] = ( view.getUint16( rowOffset + 2, true ) - section.compressionScaleRange ) * compressionScaleFactor + view.getFloat32( bucketBase + 4, true );
			centers[ i3 + 2 ] = ( view.getUint16( rowOffset + 4, true ) - section.compressionScaleRange ) * compressionScaleFactor + view.getFloat32( bucketBase + 8, true );

		}

		const sx = readCompressedFloat( view, rowOffset + compression.scaleOffsetBytes, compression.bytesPerScale );
		const sy = readCompressedFloat( view, rowOffset + compression.scaleOffsetBytes + compression.bytesPerScale / 3, compression.bytesPerScale );
		const sz = readCompressedFloat( view, rowOffset + compression.scaleOffsetBytes + compression.bytesPerScale / 3 * 2, compression.bytesPerScale );
		const qw = readCompressedFloat( view, rowOffset + compression.rotationOffsetBytes, compression.bytesPerRotation );
		const qx = readCompressedFloat( view, rowOffset + compression.rotationOffsetBytes + compression.bytesPerRotation / 4, compression.bytesPerRotation );
		const qy = readCompressedFloat( view, rowOffset + compression.rotationOffsetBytes + compression.bytesPerRotation / 4 * 2, compression.bytesPerRotation );
		const qz = readCompressedFloat( view, rowOffset + compression.rotationOffsetBytes + compression.bytesPerRotation / 4 * 3, compression.bytesPerRotation );

		writeCovariance( covariances, outIndex * 6, sx, sy, sz, qx, qy, qz, qw );
		writeColorBytes(
			colors,
			outIndex * 4,
			bytes[ rowOffset + compression.colorOffsetBytes ],
			bytes[ rowOffset + compression.colorOffsetBytes + 1 ],
			bytes[ rowOffset + compression.colorOffsetBytes + 2 ],
			bytes[ rowOffset + compression.colorOffsetBytes + 3 ]
		);

		for ( let degree = 1; degree <= section.sphericalHarmonicsDegree; degree ++ ) {

			writeKSPLATSphericalHarmonicsBand(
				sphericalHarmonicsBytes[ `sh${ degree }` ],
				outIndex,
				SH_BAND_COMPONENTS[ degree ],
				SH_BAND_WORDS[ degree ] * 4,
				SH_BAND_INDEX[ degree ],
				view,
				rowOffset + sphericalHarmonicsOffset,
				compression.bytesPerSphericalHarmonicsComponent,
				header
			);

		}

	}

}

function ensureSphericalHarmonics( sphericalHarmonics, sphericalHarmonicsBytes, count, degree ) {

	for ( let i = 1; i <= degree; i ++ ) {

		if ( sphericalHarmonics[ `sh${ i }` ] === undefined ) {

			const band = createPackedSphericalHarmonicsBand( count, i );
			sphericalHarmonics[ `sh${ i }` ] = band.packed;
			sphericalHarmonicsBytes[ `sh${ i }` ] = band.bytes;

		}

	}

}

function writeKSPLATSphericalHarmonicsBand( target, index, bandComponents, byteStride, componentIndexes, view, rowOffset, bytesPerComponent, header ) {

	const targetOffset = index * byteStride;

	for ( let i = 0; i < bandComponents; i ++ ) {

		target[ targetOffset + i ] = readCompressedSphericalHarmonic(
			view,
			rowOffset + componentIndexes[ i ] * bytesPerComponent,
			bytesPerComponent,
			header
		) * 128 + 128;

	}

}

function getBucketIndex( view, section, sectionBase, splatIndex, fullBucketSplats, partialBucketIndex, partialBucketBase ) {

	if ( section.bucketCount === 0 ) {

		return { value: 0 };

	}

	if ( splatIndex < fullBucketSplats ) {

		return { value: Math.floor( splatIndex / section.bucketSize ) };

	}

	while ( partialBucketIndex < section.bucketCount ) {

		const partialIndex = partialBucketIndex - section.fullBucketCount;
		const bucketLength = view.getUint32( sectionBase + partialIndex * 4, true );

		if ( splatIndex < partialBucketBase + bucketLength ) {

			return { value: partialBucketIndex, partialBucketIndex, partialBucketBase };

		}

		partialBucketIndex ++;
		partialBucketBase += bucketLength;

	}

	throw new Error( 'THREE.KSPLATLoader: Invalid KSPLAT bucket data.' );

}

function readCompressedFloat( view, offset, bytesPerVector ) {

	if ( bytesPerVector === 12 || bytesPerVector === 16 ) {

		return view.getFloat32( offset, true );

	}

	return DataUtils.fromHalfFloat( view.getUint16( offset, true ) );

}

function readCompressedSphericalHarmonic( view, offset, bytesPerComponent, header ) {

	if ( bytesPerComponent === 4 ) {

		return view.getFloat32( offset, true );

	}

	if ( bytesPerComponent === 2 ) {

		return DataUtils.fromHalfFloat( view.getUint16( offset, true ) );

	}

	const t = view.getUint8( offset ) / 255;

	return header.minSphericalHarmonicsCoeff + t * ( header.maxSphericalHarmonicsCoeff - header.minSphericalHarmonicsCoeff );

}

export { KSPLATLoader };
