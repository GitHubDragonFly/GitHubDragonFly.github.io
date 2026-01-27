import {
	DefaultLoadingManager,
	Matrix3,
	Vector3
} from 'three';

// https://github.com/McSimp/lzfjs
import * as compressor from 'https://esm.sh/lzfjs@1.0.1';

const _tempVec = new Vector3();

/**
*
*	Custom PCD Exporter created with assistance from Microsoft Copilot 
*
*	Example Usage:
*
*		const { PCDExporter } = await import( "path-to-exporter/PCDExporter.js" );
*
*		const exporter = new PCDExporter( manager );
*
*		const options = ( binary: false, binaryCompressed: true );
*
*		exporter.parse( scene, function( object ) {
*			let blob;
*
*			if ( options.binary || options.binaryCompressed ) {
*				blob = new Blob( [ object ], { type: 'application/octet-stream' } );
*			} else {
*				blob = new Blob( [ object ], { type: 'text/plain' } );
*			}
*
*			let link = document.createElement( 'a' );
*			link.style.display = 'none';
*			document.body.appendChild( link );
*			link.href = URL.createObjectURL( blob );
*			link.download = 'Model.pcd';
*			link.click();
*			URL.revokeObjectURL( blob );
*			document.body.removeChild( link );
*		}, function() { console.log( 'Error exporting model!' ); }, options );
*
*/

class PCDExporter {

	constructor( manager ) {

		this.manager = manager || DefaultLoadingManager;

	}

	parse( scene, onDone, onError, options = {} ) {

		this.parseAsync( scene, onDone, onError, options );

	}

	async parseAsync( scene, onDone, onError, options = {} ) {

		const scope = this;

		const defaultOptions = {

			binary: false,
			binaryCompressed: false,
			includeNormals: false,
			includeIntensity: true,
			includeAlpha: false,
			includeColors: true,
			colorUnsigned: false

		};

		options = Object.assign( defaultOptions, options );

		scene.updateMatrixWorld( true, true );

		const pointClouds = [];
		let points_count = 0;
		const layout = [];
		let pcd;

		/**
		 * Pack RGB channels into:
		 * float32 (used when TYPE = F in the PCD header).
		 */
		function _packFRGB( r, g, b ) {

			const uint =
				( ( r & 0xFF ) << 16 ) |
				( ( g & 0xFF ) << 8 )  |
				( ( b & 0xFF ) << 0 );

			const floatView = new Float32Array( 1 );
			const intView = new Uint32Array( floatView.buffer );

			intView[ 0 ] = uint;

			return floatView[ 0 ];

		}

		/**
		 * Pack RGB channels into:
		 * 32‑bit little‑endian integer (used when TYPE = U in the PCD header).
		 */
		function _packURGB( r, g, b ) {

			return ( ( r & 0xFF ) << 16 ) |
				( ( g & 0xFF ) << 8 )  |
				( ( b & 0xFF ) << 0 );

		}

		/**
		 * Pack RGBA channels into:
		 * float32 (used when TYPE = F in the PCD header).
		 */
		function _packFRGBA( r, g, b, a ) {

			const uint =
				( ( a & 0xFF ) << 24 ) |
				( ( r & 0xFF ) << 16 ) |
				( ( g & 0xFF ) << 8 )  |
				( ( b & 0xFF ) << 0 );

			const floatView = new Float32Array( 1 );
			const intView = new Uint32Array( floatView.buffer );

			intView[ 0 ] = uint;

			return floatView[ 0 ];

		}

		/**
		 * Pack RGBA channels into:
		 * 32‑bit little‑endian integer (used when TYPE = U in the PCD header).
		 */
		function _packURGBA( r, g, b, a ) {

			return (( a & 0xFF ) << 24 ) |
				(( r & 0xFF ) << 16 ) |
				(( g & 0xFF ) << 8 )  |
				(( b & 0xFF ) << 0 );

		}

		function _parse_objects() {

			scene.traverse( function ( obj ) {

				if ( obj.isPoints && obj.geometry ) {

					pointClouds.push( obj );
					points_count += obj.geometry.attributes.position.count;

				}

			} );


			// Detect fields

			const hasColor = options.includeColors && pointClouds.some( pc => pc.geometry.attributes.color );
			const hasNormal = options.includeNormals && pointClouds.some( pc => pc.geometry.attributes.normal );
			const hasIntensity = options.includeIntensity && pointClouds.some( pc => pc.geometry.attributes.intensity );

			// Build header

			const fields = [ 'x', 'y', 'z' ];
			const size = [ 4, 4, 4 ];
			const type = [ 'F', 'F', 'F' ];
			const count = [ 1, 1, 1 ];

			layout.push({ name: 'x', type: 'float32' });
			layout.push({ name: 'y', type: 'float32' });
			layout.push({ name: 'z', type: 'float32' });

			if ( hasNormal ) {

				layout.push( { name: 'normal_x', type: 'float32' } );
				layout.push( { name: 'normal_y', type: 'float32' } );
				layout.push( { name: 'normal_z', type: 'float32' } );

				fields.push( 'normal_x', 'normal_y', 'normal_z' );
				size.push( 4, 4, 4 );
				type.push( 'F', 'F', 'F' );
				count.push( 1, 1, 1 );

			}

			if ( hasIntensity ) {

				layout.push( { name: 'intensity', type: 'float32' } );

				fields.push( 'intensity' );
				size.push( 4 );
				type.push( 'F' );
				count.push( 1 );

			}

			if ( hasColor ) {

				layout.push({
					name: options.includeAlpha ? 'rgba' : 'rgb',
					type: options.colorUnsigned ? 'uint32' : 'float32'
				});

				fields.push( options.includeAlpha ? 'rgba' : 'rgb' );
				size.push( 4 );
				type.push( options.colorUnsigned ? 'U' : 'F' );
				count.push( 1 );

			}

			let header =
				`# Created by the custom PCD Exporter\n` +
				`# .PCD v0.7 - Point Cloud Data file format\n` +
				`VERSION 0.7\n` +
				`FIELDS ${ fields.join( ' ' ) }\n` +
				`SIZE ${ size.join( ' ' ) }\n` +
				`TYPE ${ type.join( ' ' ) }\n` +
				`COUNT ${ count.join( ' ' ) }\n` +
				`WIDTH ${ points_count }\n` +
				`HEIGHT 1\n` +
				`VIEWPOINT 0 0 0 0.7071068 -0.7071068 0 0\n` +
				`POINTS ${ points_count }\n` +
				`DATA ${
					options.binaryCompressed
						? 'binary_compressed'
						: options.binary
							? 'binary'
							: 'ascii'
				}\n`;

			// Serialize data

			const lines = [];
			let body = '', bytesPerPoint, buffer, view, offset;

			if ( options.binary || options.binaryCompressed ) {

				// XYZ float32 + normals float32 + intensity float32 + rgb uint32
				bytesPerPoint = 3 * 4 +
					( hasNormal ? 3 * 4 : 0 ) +
					( hasIntensity ? 4 : 0 ) +
					( hasColor ? 4 : 0 );

				buffer = new ArrayBuffer( bytesPerPoint * points_count );
				view = new DataView( buffer );
				offset = 0;

			}

			for ( const pc of pointClouds ) {

				const pos = pc.geometry.attributes.position;
				const col = pc.geometry.attributes.color;
				const nor = pc.geometry.attributes.normal;

				const worldMatrix = pc.matrixWorld;
				const normalMatrix = new Matrix3().getNormalMatrix( worldMatrix );

				for ( let i = 0; i < pos.count; i++ ) {

					// --- WORLD-SPACE POSITION ---

					_tempVec.fromBufferAttribute( pos, i );
					_tempVec.applyMatrix4( worldMatrix );

					const x = _tempVec.x;
					const y = _tempVec.y;
					const z = _tempVec.z;

					if ( !options.binary && !options.binaryCompressed ) {

						body += `${ x } ${ y } ${ z }`;

						if ( hasNormal ) {

							_tempVec.fromBufferAttribute( nor, i );
							_tempVec.applyMatrix3( normalMatrix ).normalize();

							const nx = _tempVec.x;
							const ny = _tempVec.y;
							const nz = _tempVec.z;

							body += ` ${ nx } ${ ny } ${ nz }`;

						}

						if ( hasIntensity ) {

							const intensityAttr = pc.geometry.getAttribute( 'intensity' );
							const intensity = intensityAttr ? intensityAttr.getX( i ) : 1.0;

							body += ` ${ intensity }`;

						}

						if ( hasColor ) {

							const r = col ? col.getX( i ) * 255 : 255;
							const g = col ? col.getY( i ) * 255 : 255;
							const b = col ? col.getZ( i ) * 255 : 255;

							if ( options.includeAlpha ) {

								const alphaAttr = pc.geometry.getAttribute( 'alpha' );

								const a = Math.min( 255, Math.max( 0, alphaAttr
									? alphaAttr.getX( i ) * 255
									: pc.material.opacity * 255));

								const rgba = options.colorUnsigned
									? _packURGBA( r, g, b, a )
									: _packFRGBA( r, g, b, a );

								body += ` ${ rgba }`;

							} else {

								const rgb = options.colorUnsigned
									? _packURGB( r, g, b )
									: _packFRGB( r, g, b );

								body += ` ${ rgb }`;

							}

						}

						body += '\n';

						lines.push( body );
						body = '';

					} else {

						// BINARY MODE

						// XYZ

						view.setFloat32( offset, x, true );
						offset += 4;
						view.setFloat32( offset, y, true );
						offset += 4;
						view.setFloat32( offset, z, true );
						offset += 4;

						// Normals

						if ( hasNormal ) {

							_tempVec.fromBufferAttribute( nor, i );
							_tempVec.applyMatrix3( normalMatrix ).normalize();

							const nx = _tempVec.x;
							const ny = _tempVec.y;
							const nz = _tempVec.z;

							view.setFloat32( offset, nx, true );
							offset += 4;
							view.setFloat32( offset, ny, true );
							offset += 4;
							view.setFloat32( offset, nz, true );
							offset += 4;

						}

						if ( hasIntensity ) {

							const intensityAttr = pc.geometry.getAttribute( 'intensity' );
							const intensity = intensityAttr ? intensityAttr.getX( i ) : 1.0;

							view.setFloat32( offset, intensity, true );
							offset += 4;

						}

						// RGB

						if ( hasColor ) {

							const r = col ? col.getX( i ) * 255 : 255;
							const g = col ? col.getY( i ) * 255 : 255;
							const b = col ? col.getZ( i ) * 255 : 255;

							if ( options.includeAlpha ) {

								const alphaAttr = pc.geometry.getAttribute( 'alpha' );

								const a = Math.min( 255, Math.max( 0, alphaAttr
									? alphaAttr.getX( i ) * 255
									: pc.material.opacity * 255));

								const rgba = options.colorUnsigned
									? _packURGBA( r, g, b, a )
									: _packFRGBA( r, g, b, a );

								if ( options.colorUnsigned ) {

									view.setUint32( offset, rgba, true );

								} else {

									view.setFloat32( offset, rgba, true );

								}

							} else {

								const rgb = options.colorUnsigned
									? _packURGB( r, g, b )
									: _packFRGB( r, g, b );

								if ( options.colorUnsigned ) {

									view.setUint32( offset, rgb, true );

								} else {

									view.setFloat32( offset, rgb, true );

								}

							}


							offset += 4;

						}

					}

				}
			}

			if ( !options.binary && !options.binaryCompressed ) {

				pcd = header + lines.join( '' );

			} else {

				// Final output: header (string) + binary buffer

				if ( !header.endsWith( '\n' ) ) header += '\n';

				const encoder = new TextEncoder();
				const headerBytes = encoder.encode( header );


				if ( options.binaryCompressed ) {

					// fields = ['x','y','z','intensity','rgb'] or whatever

					const fieldCount = fields.length;

					// Convert AoS float buffer into SoA

					const soaBuffer = scope._buildSoA( new Float32Array( buffer ), points_count, layout );

					// Now compress the SoA buffer

					const compressed = compressor.compress(new Uint8Array(soaBuffer));
					const compressedSize = compressed.length;
					const uncompressedSize = buffer.byteLength;

					const sizeBytes = new Uint8Array(8);
					new DataView(sizeBytes.buffer).setUint32(0, compressedSize, true);
					new DataView(sizeBytes.buffer).setUint32(4, uncompressedSize, true);

					pcd = new Uint8Array( headerBytes.length + sizeBytes.length + compressedSize );
					pcd.set(headerBytes, 0);
					pcd.set(sizeBytes, headerBytes.length);
					pcd.set(compressed, headerBytes.length + sizeBytes.length);

				} else {

					pcd = new Uint8Array( headerBytes.length + buffer.byteLength );
					pcd.set( headerBytes, 0 );
					pcd.set( new Uint8Array( buffer ), headerBytes.length );

				}

			}

		}

		_parse_objects();

		if ( points_count === 0 ) {

			if ( typeof onError === 'function' ) {

				onError( 'THREE.PCDExporter: No qualifying objects found!' );
				return null;

			} else {

				throw new Error( 'THREE.PCDExporter: No qualifying objects found!' );

			}

		} else {

			if ( typeof onDone === 'function' ) {

				onDone( pcd );

			} else {

				return pcd;

			}

		}

	}

	_buildSoA( aos, pointCount, layout ) {

		// layout example:
		// [
		//   { name:'x', type:'float32' },
		//   { name:'y', type:'float32' },
		//   { name:'z', type:'float32' },
		//   { name:'intensity', type:'float32' },
		//   { name:'rgb', type:'uint32' }
		// ]

		const strideFloats = layout.reduce( ( sum, f ) => sum + ( f.type === 'float32' ? 1 : 1 ), 0 );

		const floatFields = layout.filter( f => f.type === 'float32' );
		const uintFields = layout.filter( f => f.type === 'uint32' );

		const floatBlock = new Float32Array( pointCount * floatFields.length );
		const uintBlock = new Uint32Array( pointCount * uintFields.length );

		let floatOffset = 0;
		let uintOffset = 0;

		for ( let f = 0; f < layout.length; f++ ) {

			const field = layout[ f ];

			if ( field.type === 'float32' ) {

				const base = floatOffset * pointCount;

				for ( let i = 0; i < pointCount; i++ ) {

					floatBlock[ base + i ] = aos[ i * strideFloats + f ];

				}

				floatOffset++;

			}

			if ( field.type === 'uint32' ) {

				const base = uintOffset * pointCount;

				for ( let i = 0; i < pointCount; i++ ) {

					uintBlock[ base + i ] = aos[ i * strideFloats + f ];

				}

				uintOffset++;

			}

		}

		// Combine into one Uint8Array

		const out = new Uint8Array( floatBlock.byteLength + uintBlock.byteLength );
		out.set( new Uint8Array( floatBlock.buffer ), 0 );
		out.set( new Uint8Array( uintBlock.buffer ), floatBlock.byteLength );

		return out;

	}

}

export { PCDExporter };
