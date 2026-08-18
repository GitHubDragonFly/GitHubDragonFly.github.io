import {
	FileLoader,
	Loader
} from 'three';

import { createGaussianSplatGeometry, writeCovariance } from '../utils/GaussianSplatUtils.js';

const ROW_SIZE_BYTES = 32;

/**
 * A loader for standard fixed-width Gaussian splat `.splat` files.
 *
 * Custom WebGL2 version for use with gsplat/pmndrs splat loaders via custom splatTranscoder.
 *
 * ```js
 * const loader = new SPLATLoader();
 * const data = await loader.loadAsync( './models/splat/example.splat' );
 * ```
 *
 * @augments Loader
 * @three_import import { SPLATLoader } from 'path/to/SPLATWebGL2Loader.js';
 */
class SPLATLoader extends Loader {

	/**
	 * Constructs a new Gaussian splat loader.
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
	 * @param {function(Object)} onLoad - Executed when the loading process has been finished.
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
	 * Parses the given fixed-width `.splat` data.
	 *
	 * @param {ArrayBuffer} buffer - The raw `.splat` file as an array buffer.
	 * @return {Object} Structured data object for use with custom splatTranscoder.
	 */
	parse( buffer ) {

		if ( buffer.byteLength % ROW_SIZE_BYTES !== 0 ) {

			throw new Error( 'THREE.SPLATLoader: Invalid .splat byte length.' );

		}

		const count = buffer.byteLength / ROW_SIZE_BYTES;

		// Allocate arrays matching the data descriptor signature

		const centers = new Float32Array( count * 3 );
		const scales = new Float32Array( count * 3 );
		const rotations = new Float32Array( count * 4 );
		const colors = new Uint8ClampedArray( count * 4 );

		const view = new DataView( buffer );
		const bytes = new Uint8Array( buffer );

		for ( let i = 0; i < count; i ++ ) {

			const rowOffset = i * ROW_SIZE_BYTES;
			const i3 = i * 3;
			const i4 = i * 4;

			// 1. Unpack Positions

			centers[ i3 ]     = view.getFloat32( rowOffset, true );
			centers[ i3 + 1 ] = view.getFloat32( rowOffset + 4, true );
			centers[ i3 + 2 ] = view.getFloat32( rowOffset + 8, true );

			// 2. Unpack Scales

			scales[ i3 ]     = view.getFloat32( rowOffset + 12, true );
			scales[ i3 + 1 ] = view.getFloat32( rowOffset + 16, true );
			scales[ i3 + 2 ] = view.getFloat32( rowOffset + 20, true );

			// 3. Unpack Colors (RGBA)

			colors[ i4 ]     = bytes[ rowOffset + 24 ];
			colors[ i4 + 1 ] = bytes[ rowOffset + 25 ];
			colors[ i4 + 2 ] = bytes[ rowOffset + 26 ];
			colors[ i4 + 3 ] = bytes[ rowOffset + 27 ];

			// 4. Unpack Quaternions (Standard .splat is packed as w, x, y, z)

			const qw = ( bytes[ rowOffset + 28 ] - 128 ) / 128;
			const qx = ( bytes[ rowOffset + 29 ] - 128 ) / 128;
			const qy = ( bytes[ rowOffset + 30 ] - 128 ) / 128;
			const qz = ( bytes[ rowOffset + 31 ] - 128 ) / 128;

			// Align layout back to the standard [qx, qy, qz, qw] format transcoder expects

			rotations[ i4 ]     = qx;
			rotations[ i4 + 1 ] = qy;
			rotations[ i4 + 2 ] = qz;
			rotations[ i4 + 3 ] = qw;

		}

		// WebGL2 Redirect: Return a pure data payload directly to splatTranscoder for gsplat/pmndrs loader use

		return {
			count: count,
			positions: centers,
			scales: scales,
			rotations: rotations,
			colors: colors,
			sphericalHarmonics: {
				sh1: null, // Standard splats lack SH bands
				sh2: null,
				sh3: null
			}

		};

	}

}

export { SPLATLoader };
