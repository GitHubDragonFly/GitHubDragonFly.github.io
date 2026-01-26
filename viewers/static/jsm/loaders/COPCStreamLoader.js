import { Box3, BufferGeometry, BufferAttribute, Loader, Sphere, Vector3 } from 'three';
import { createLazPerf } from 'laz-perf';
import { Copc } from 'copc';

// Point to the official laz-perf WASM file on a CDN

const LAZ_PERF_WASM_URL = 'https://cdn.jsdelivr.net/npm/laz-perf@0.0.7/lib/laz-perf.wasm';

const LazPerf = await createLazPerf({

	locateFile: ( path ) => {

		if ( path.endsWith( '.wasm' ) ) {

			return LAZ_PERF_WASM_URL;

		}

		return path;

	}

});

// Created with assistance from Microsoft Copilot and Google Gemini
// Supporting loading of selective nodes streamed from COPC LAZ datasets

// Nodes appear to follow the EPT format and are already sorted out:
//
// {
// 	'0-0-0-0': { pointCount: xxx, pointDataLength: xxx, pointDataOffset: xxx }
// 	'1-0-0-0': { pointCount: xxx, pointDataLength: xxx, pointDataOffset: xxx }
// 	'1-0-1-0': { pointCount: xxx, pointDataLength: xxx, pointDataOffset: xxx }
// 	'1-1-1-0': { pointCount: xxx, pointDataLength: xxx, pointDataOffset: xxx }
// 	'2-0-0-0': { pointCount: xxx, pointDataLength: xxx, pointDataOffset: xxx }
// 	'2-0-1-0': { pointCount: xxx, pointDataLength: xxx, pointDataOffset: xxx }
// 	'2-0-2-0': { pointCount: xxx, pointDataLength: xxx, pointDataOffset: xxx }
// 	'2-0-3-0': { pointCount: xxx, pointDataLength: xxx, pointDataOffset: xxx }
// 	...
// }

class COPCStreamLoader extends Loader {

	constructor( manager ) {

		super( manager );

		this.spacing = 1;
		this.skipPoints = 1;
		this.skipColor = false;
		this.skipIntensity = false;
		this.skipClassification = false;
		this.applyIntensityToColor = true;
		this.intensityGammaFactor = 0.1;
		this.lodDepthLimit = 0;

	}

	// -------------------------------
	// Public API
	// -------------------------------

	setDepthLimit( depth ) {

		if ( !Number.isInteger( depth ) ) {

			depth = 0;

		} else {

			depth = Math.max( Math.min( depth, 8 ), 0 );

		}

		this.lodDepthLimit = depth;
		return this;

	}

	setSkipPoints( number_of_points ) {

		// Set how many points get processed
		// by reading one in every "number_of_points" points

		if ( !Number.isInteger( number_of_points ) ) {

			number_of_points = 1;

		} else {

			number_of_points = Math.max( Math.min( number_of_points, 100 ), 1 );

		}

		this.skipPoints = number_of_points;
		return this;

	}

	setSkipColor( flag ) {

		this.skipColor = flag;
		return this;

	}

	setSkipIntensity( flag ) {

		this.skipIntensity = flag;
		return this;

	}

	setSkipClassification( flag ) {

		this.skipClassification = flag;
		return this;

	}

	setIntensityGammaFactor( gamma ) {

		// Convert to number

		gamma = Number( gamma );

		// If invalid, fall back to default 0.1

		if ( !isFinite( gamma ) || gamma <= 0 ) { gamma = 0.1; }

		// Clamp to a reasonable range

		gamma = Math.min( Math.max( gamma, 0.1 ), 2.0);

		this.intensityGammaFactor = gamma;
		return this;

	}

	setApplyIntensityToColor( flag ) {

		this.applyIntensityToColor = flag;
		return this;

	}

	// -------------------------------
	// Utilities
	// -------------------------------

	async _mapWithConcurrency( items, limit, fn ) {

		const queue = [ ...items ];

		const workers = new Array( limit ).fill( null ).map( async () => {

			while ( queue.length ) {

				const item = queue.shift();
				await fn( item );

			}

		});

		await Promise.all( workers );

	}

	// -------------------------------
	// Node Loading
	// -------------------------------

	async _loadNodePointsToGeometry( url, copc, node, globalZRange ) {

		// Processing root will return url as a raw ArrayBuffer of DECOMPRESSED points

		const isBuffer = url instanceof ArrayBuffer || ArrayBuffer.isView( url );

		// Decompress using the library utility, passing our LazPerf instance
		// This returns a raw ArrayBuffer of DECOMPRESSED points

		const decompressedBuffer = isBuffer ? url : await Copc.loadPointDataBuffer(
			url, 
			copc.header, 
			node, 
			LazPerf
		);

		const count = node.pointCount;
		const { pointDataRecordLength, pointDataRecordFormat, scale, offset } = copc.header;

		// Create a DataView of the decompressed data

		let dv = new DataView(
			decompressedBuffer.buffer,
			decompressedBuffer.byteOffset,
			decompressedBuffer.byteLength
		);

		// Calculate how many points we will actually keep

		const skipPoints = ( this.skipPoints && this.skipPoints > 1 ) ? this.skipPoints : 1;
		const keptPoints = Math.ceil( count / skipPoints );
		if ( keptPoints < 1 ) return null;

		const positions = new Float32Array( keptPoints * 3 );
		const colors = !this.skipColor ? new Float32Array( keptPoints * 3 ) : null;
		const intensities = !this.skipIntensity ? new Float32Array( keptPoints ) : null;
		const classifications = !this.skipClassification ? new Float32Array( keptPoints ) : null;

		// Check if the file format actually includes colors

		const formatsWithColor = [ 2, 3, 5, 7, 8, 10 ];
		const hasNativeColor = formatsWithColor.includes( pointDataRecordFormat ) === true;

		let targetIdx = 0; // The sequential index for output arrays

		for ( let i = 0; i < count; i += skipPoints ) {

			// Take a tiny break every 5000 points, let the browser breath
			// and avoid "unresponsive" page popup

			if ( i % 5000 === 0 ) {

				await new Promise( resolve => setTimeout( resolve, 0 ) );

			}

			const writeIdx = targetIdx * 3, div = 65535.0;

			// Calculate the byte offset for the start of this specific point

			const pStart = i * pointDataRecordLength;

			// X, Y, Z are always the first three Int32s in LAS/COPC

			const rawX = dv.getInt32( pStart + 0, true );
			const rawY = dv.getInt32( pStart + 4, true );
			const rawZ = dv.getInt32( pStart + 8, true );

			const x = ( rawX * scale[ 0 ] ) + offset[ 0 ];
			const y = ( rawY * scale[ 1 ] ) + offset[ 1 ];
			const z = ( rawZ * scale[ 2 ] ) + offset[ 2 ];

			positions[ writeIdx + 0 ] = x;
			positions[ writeIdx + 1 ] = y;
			positions[ writeIdx + 2 ] = z;

			// --- Intensity (Conditional) ---
			// Always at byte 12

			let currentIntensity = 1.0;

			if ( !this.skipIntensity ) {

				const rawIntensity = dv.getUint16( pStart + 12, true );
				intensities[ targetIdx ] = rawIntensity / div;

			}

			// --- Classification (Conditional) ---
			// PDRF 6-10: Byte 16 | PDRF 0-5: Byte 15

			if ( !this.skipClassification ) {

				const classOffset = pointDataRecordFormat >= 6 ? 16 : 15;
				classifications[ targetIdx ] = dv.getUint8( pStart + classOffset );

			}

			// --- Color (Conditional) ---

			// The offset for colors changes based on the format (PDRF)
			// Usually, it's byte 20 for formats 2/3 and byte 30 for 6/7/8

			const colorOffset = pointDataRecordFormat >= 6 ? 30 : 20;

			if ( !this.skipColor && ( pStart + colorOffset + 6 <= decompressedBuffer.byteLength ) ) {

				if ( hasNativeColor ) {

					const mult = this.applyIntensityToColor ? intensities[ targetIdx ] : 1.0;

					colors[ writeIdx + 0 ] = ( dv.getUint16( pStart + colorOffset + 0, true ) / div ) * mult;
					colors[ writeIdx + 1 ] = ( dv.getUint16( pStart + colorOffset + 2, true ) / div ) * mult;
					colors[ writeIdx + 2 ] = ( dv.getUint16( pStart + colorOffset + 4, true ) / div ) * mult;

				}

			}

			targetIdx++; // Move to the next slot in the TypedArray

		}

		const geometry = new BufferGeometry();

		geometry.setAttribute( 'position', new BufferAttribute( positions, 3 ) );

		if ( !this.skipColor && hasNativeColor )
			geometry.setAttribute( 'color', new BufferAttribute( colors, 3 ) );

		if ( !this.skipIntensity )
			geometry.setAttribute( 'intensity', new BufferAttribute( intensities, 1 ) );

		if ( !this.skipClassification )
			geometry.setAttribute( 'classification', new BufferAttribute( classifications, 1 ) );

		const { min, max } = copc.header;

		const box = new Box3(
			new Vector3( min[ 0 ], min[ 1 ], min[ 2 ] ),
			new Vector3( max[ 0 ], max[ 1 ], max[ 2 ] )
		);

		// Set the pre-calculated bounding box and sphere

		geometry.boundingBox = box;
		geometry.boundingSphere = box.getBoundingSphere( new Sphere() );

		dv = null;

		return geometry;

	}

	load( url, onLoad, onProgress, onError ) {

		try {

			this.parse( url, onLoad, onError );

		} catch( err ) {

			if ( onError ) onError( err );
			else console.error( err );

		}

	}

	async parse( url, onNodeLoaded, onNodeError ) {

		const copc = await Copc.create( url );

		this.spacing = copc.info?.spacing;

		const { nodes, pages } = await Copc.loadHierarchyPage(
			url,
			copc.info.rootHierarchyPage
		)

		// Filter nodes out up to lodDepthLimit:

		const filteredNodes = [];

		Object.keys( nodes ).forEach( key => {

			const str = key.toString();
			const depth = parseInt( key.split( '-' )[ 0 ] );

			if ( depth <= this.lodDepthLimit ) filteredNodes.push( str );

		});

		// Hard code total number of nodes since root will be removed once loaded

		let totalSelectedNodes = filteredNodes.length;

		// 1. Get the Root Node ('0-0-0-0') to establish a robust elevation range

		const rootNode = nodes[ '0-0-0-0' ];
		let globalZRange;

		if ( rootNode ) {

			// Load just the root to sample it

			const rootBuffer = await Copc.loadPointDataBuffer( url, copc.header, rootNode, LazPerf );
			const count = rootNode.pointCount;
			const { pointDataRecordLength, scale, offset } = copc.header;
			const dv = new DataView( rootBuffer.buffer, rootBuffer.byteOffset, rootBuffer.byteLength );

			const rootZValues = [];

			for ( let i = 0; i < count; i++ ) {

				const pStart = i * pointDataRecordLength;
				const z = ( dv.getInt32( pStart + 8, true ) * scale[ 2 ] ) + offset[ 2 ];
				rootZValues.push( z );

			}

			// Apply 1st and 99th percentile logic

			rootZValues.sort( ( a, b ) => a - b );
			const p1 = rootZValues[ Math.floor( count * 0.01 ) ];
			const p99 = rootZValues[ Math.floor( count * 0.99 ) ];

			globalZRange = {
				min: p1,
				max: p99,
				range: ( p99 - p1 ) || 1.0
			};

			// IMMEDIATELY process root into geometry and emit it
			// We pass the already-loaded buffer to avoid a second fetch

			const rootGeom = await this._loadNodePointsToGeometry( rootBuffer, copc, rootNode, globalZRange );

			if ( rootGeom && onNodeLoaded ) {

				// Remove root from filteredNodes

				if ( filteredNodes.indexOf( '0-0-0-0' ) !== -1 ) {

					filteredNodes.splice( filteredNodes.indexOf( '0-0-0-0' ), 1 );

				}

				onNodeLoaded( rootGeom, totalSelectedNodes, '0-0-0-0', globalZRange, this.spacing );

			}

		} else {

			// Fallback to header if root is missing

			globalZRange = {
				min: copc.header.min[ 2 ],
				max: copc.header.max[ 2 ],
				range: ( copc.header.max[ 2 ] - copc.header.min[ 2 ] ) || 1.0
			};

		}

		const CONCURRENCY = 4;

		await this._mapWithConcurrency( filteredNodes, CONCURRENCY, async ( key ) => {

			try {

				const geom = await this._loadNodePointsToGeometry( url, copc, nodes[ key ], globalZRange );

				if ( geom && onNodeLoaded ) {

					onNodeLoaded( geom, totalSelectedNodes, key, globalZRange, this.spacing );

				}

			} catch ( err ) {

				if ( onNodeError ) onNodeError( err );
				else console.error( `Node ${ key } failed:`, err );
				totalSelectedNodes -= 1;

			}

		});

		return true;

	}

}

export { COPCStreamLoader };
