import {
	BufferAttribute,
	BufferGeometry,
	DefaultLoadingManager,
	Matrix3,
	Points,
	PointsMaterial,
	Vector3
} from 'three';

// https://github.com/McSimp/lzfjs
import * as compressor from 'https://esm.sh/lzfjs@1.0.1';

const _tempVec = new Vector3();

/**
*
*	Custom PCD Exporter created with assistance from Microsoft Copilot and Google Gemini
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
			includeNormals: true,
			includeIntensity: true,
			includeClassification: true,
			includeAlpha: false,
			includeColors: true,
			colorUnsigned: false

		};

		options = Object.assign( defaultOptions, options );

		scene.updateMatrixWorld( true, true );

		let pointClouds = [];
		let points_count = 0;
		const layout = [];
		let pcd;

		// Unified color packing helper
		// Handles RGB and RGBA, float and unsigned
		// with NaN‑safe masking for float32

		const floatView = new Float32Array( 1 );
		const uintView  = new Uint32Array( floatView.buffer );

		function _packColor( r, g, b, a, isUnsigned, hasAlpha ) {

			// Pack into a 32‑bit integer

			const packed = hasAlpha
				? ( ( ( a & 0xFF ) << 24 ) | ( ( r & 0xFF ) << 16 ) | ( ( g & 0xFF ) << 8 ) | ( b & 0xFF ) )
				: ( ( ( r & 0xFF ) << 16 ) | ( ( g & 0xFF ) << 8 ) | ( b & 0xFF ) );

			// Unsigned path → return raw uint32

			if ( isUnsigned ) return packed;

			// Float path → reinterpret bits as float32, but mask to avoid NaN/Inf patterns

			uintView[ 0 ] = packed & 0xFEFFFFFF;

			return floatView[ 0 ];

		}

		function _parse_objects() {

			scene.traverse( function ( obj ) {

				if ( obj.isPoints && obj.geometry ) {

					pointClouds.push( obj );
					points_count += obj.geometry.attributes.position.count;

				}

			} );

			if ( pointClouds.length > 1 ) {

				const geoms = pointClouds.map( pc => {
					const g = pc.geometry.clone();
					g.applyMatrix4( pc.matrixWorld );
					return g;
				});

				const geometry = scope._mergeGeometries( geoms );
				const material = pointClouds[ 0 ].material.clone();

				pointClouds = [ new Points( geometry, material ) ];

			}

			// Detect fields

			const hasColor = options.includeColors && pointClouds.some( pc => pc.geometry.attributes.color );
			const hasNormal = options.includeNormals && pointClouds.some( pc => pc.geometry.attributes.normal );
			const hasIntensity = options.includeIntensity && pointClouds.some( pc => pc.geometry.attributes.intensity );
			const hasClassification = options.includeClassification && pointClouds.some( pc => pc.geometry.attributes.classification );

			// Build header

			const fields = [ 'x', 'y', 'z' ];
			const size = [ 4, 4, 4 ];
			const type = [ 'F', 'F', 'F' ];
			const count = [ 1, 1, 1 ];

			layout.push({ name: 'x', type: 'F', size: 4 });
			layout.push({ name: 'y', type: 'F', size: 4 });
			layout.push({ name: 'z', type: 'F', size: 4 });

			if ( hasNormal ) {

				layout.push( { name: 'normal_x', type: 'F', size: 4 } );
				layout.push( { name: 'normal_y', type: 'F', size: 4 } );
				layout.push( { name: 'normal_z', type: 'F', size: 4 } );

				fields.push( 'normal_x', 'normal_y', 'normal_z' );
				size.push( 4, 4, 4 );
				type.push( 'F', 'F', 'F' );
				count.push( 1, 1, 1 );

			}

			if ( hasIntensity ) {

				layout.push( { name: 'intensity', type: 'F', size: 4 } );

				fields.push( 'intensity' );
				size.push( 4 );
				type.push( 'F' );
				count.push( 1 );

			}

			if ( hasClassification ) {

				layout.push( { name: 'classification', type: 'U', size: 4 } );

				fields.push( 'classification' );
				size.push( 4 );
				type.push( 'U' );
				count.push( 1 );

			}

			if ( hasColor ) {

				layout.push({
					name: options.includeAlpha ? 'rgba' : 'rgb',
					type: options.colorUnsigned ? 'U' : 'F',
					size: 4
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
				`VIEWPOINT 0 0 0 0.9999996192 0.0008726646 0 0\n` +
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
					( hasClassification ? 4 : 0 ) +
					( hasColor ? 4 : 0 );

				buffer = new ArrayBuffer( bytesPerPoint * points_count );
				view = new DataView( buffer );
				offset = 0;

			}

			for ( const pc of pointClouds ) {

				const pos = pc.geometry.attributes.position;
				const alphaAttr = pc.geometry.getAttribute( 'alpha' );
				const colorAttr = scope._normalize( pc.geometry.attributes.color );
				const normalAttr = pc.geometry.attributes.normal;
				const intensityAttr = pc.geometry.attributes.intensity;
				const classificationAttr = pc.geometry.attributes.classification;

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

							_tempVec.fromBufferAttribute( normalAttr, i );
							_tempVec.applyMatrix3( normalMatrix ).normalize();

							const nx = _tempVec.x;
							const ny = _tempVec.y;
							const nz = _tempVec.z;

							body += ` ${ nx } ${ ny } ${ nz }`;

						}

						if ( hasIntensity ) {

							const intensity = intensityAttr ? intensityAttr.getX( i ) : 1.0;

							body += ` ${ intensity }`;

						}

						if ( hasClassification ) {

							const cls = classificationAttr ? classificationAttr.getX( i ) : 0;

							body += ` ${ cls }`;

						}


						if ( hasColor ) {

							const r = colorAttr ? colorAttr.getX( i ) * 255 : 255;
							const g = colorAttr ? colorAttr.getY( i ) * 255 : 255;
							const b = colorAttr ? colorAttr.getZ( i ) * 255 : 255;

							if ( options.includeAlpha ) {

								const a = Math.min( 255, Math.max( 0, alphaAttr
									? alphaAttr.getX( i ) * 255
									: pc.material.opacity * 255));

								const rgba = _packColor(
									r, g, b, a,
									options.colorUnsigned,
									true
								);

								body += ` ${ rgba }`;

							} else {

								const rgb = _packColor(
									r, g, b,
									255,                   // ignored when hasAlpha = false
									options.colorUnsigned,
									false                  // no alpha
								);

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

							_tempVec.fromBufferAttribute( normalAttr, i );
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

							const intensity = intensityAttr ? intensityAttr.getX( i ) : 1.0;

							view.setFloat32( offset, intensity, true );
							offset += 4;

						}

						if ( hasClassification ) {

							const cls = classificationAttr ? classificationAttr.getX( i ) : 0;

							view.setUint32( offset, cls, true );
							offset += 4;

						}

						// RGB

						if ( hasColor ) {

							const r = colorAttr ? colorAttr.getX( i ) * 255 : 255;
							const g = colorAttr ? colorAttr.getY( i ) * 255 : 255;
							const b = colorAttr ? colorAttr.getZ( i ) * 255 : 255;

							if ( options.includeAlpha ) {

								const a = Math.min( 255, Math.max( 0, alphaAttr
									? alphaAttr.getX( i ) * 255
									: pc.material.opacity * 255));

								const rgba = _packColor(
									r, g, b, a,
									options.colorUnsigned,
									true
								);

								if ( options.colorUnsigned ) {

									view.setUint32( offset, rgba, true );

								} else {

									view.setFloat32( offset, rgba, true );

								}

							} else {

								const rgb = _packColor(
									r, g, b,
									255,                   // ignored when hasAlpha = false
									options.colorUnsigned,
									false                  // no alpha
								);

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

					const soaBuffer = scope._buildSoA( buffer, points_count, layout );

					// Now compress the SoA buffer

					const compressed = compressor.compress( soaBuffer ); //( new Uint8Array( soaBuffer ) );
					const compressedSize = compressed.length;
					const uncompressedSize = soaBuffer.byteLength;

					const sizeBytes = new Uint8Array( 8 );
					new DataView( sizeBytes.buffer ).setUint32( 0, compressedSize, true );
					new DataView( sizeBytes.buffer ).setUint32( 4, uncompressedSize, true );

					pcd = new Uint8Array( headerBytes.length + sizeBytes.length + compressedSize );
					pcd.set( headerBytes, 0 );
					pcd.set( sizeBytes, headerBytes.length );
					pcd.set( compressed, headerBytes.length + sizeBytes.length );

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

	_normalize( attrib ) {

		// Graceful exit for missing attributes

		if ( !attrib ) return null;

		// Defensive checks for malformed attributes

		if ( attrib.count === 0 || attrib.itemSize === 0 ) return null;

		const count = attrib.count;
		const itemCount = attrib.itemSize;

		const newAttrib = new Float32Array( count * itemCount );

		// Track min/max per component

		const min = new Array( itemCount ).fill( Infinity );
		const max = new Array( itemCount ).fill( -Infinity );

		// Pass 1: find min/max for each component

		for ( let i = 0; i < count; i++ ) {

			for ( let c = 0; c < itemCount; c++ ) {

				const v = attrib.getComponent( i, c );
				if ( v < min[ c ] ) min[ c ] = v;
				if ( v > max[ c ] ) max[ c ] = v;

			}

		}

		// Pass 2: normalize each component

		for ( let i = 0; i < count; i++ ) {

			for ( let c = 0; c < itemCount; c++ ) {

				const raw = attrib.getComponent( i, c );
				const range = ( max[ c ] - min[ c ] ) || 1.0;
				newAttrib[ i * itemCount + c ] = ( raw - min[ c ] ) / range;

			}

		}

		return new BufferAttribute( newAttrib, itemCount );

	}

	// Helper to concatenate typed arrays of the same type

	_concatTyped( arrays, ArrayType ) {

		let totalLength = 0;

		for ( const arr of arrays ) totalLength += arr.length;

		const out = new ArrayType( totalLength );
		let offset = 0;

		for ( const arr of arrays ) {

			out.set( arr, offset );
			offset += arr.length;

		}

		return out;

	}

	_mergeGeometries( geoms ) {

		// 1. Collect all attribute names across all geometries

		const attributeNames = new Set();

		for ( const g of geoms ) {

			for ( const name of Object.keys( g.attributes ) ) {

				attributeNames.add( name );

			}

		}

		// Always require position

		if ( !attributeNames.has( 'position' ) ) {

			throw new Error( 'All geometries must contain a position attribute' );

		}

		// 2. Determine itemSize for each attribute

		const attributeInfo = {};

		for ( const name of attributeNames ) {

			for ( const g of geoms ) {

				const attr = g.getAttribute( name );

				if ( attr ) {

					attributeInfo[ name ] = {

						itemSize: attr.itemSize,
						arrayType: attr.array.constructor

					};

					break;

				}

			}

		}

		// 3. Prepare arrays for merged data

		const mergedArrays = {};

		for ( const name of attributeNames ) {

			mergedArrays[ name ] = [];

		}

		// 4. Merge attributes from all geometries

		for ( const g of geoms ) {

			const pos = g.getAttribute( 'position' );
			const count = pos.count;

			for ( const name of attributeNames ) {

				const attr = g.getAttribute( name );

				if ( attr ) {

					// Attribute exists → push its array

					mergedArrays[ name ].push( attr.array );

				} else {

					// Attribute missing → fill with defaults

					const { itemSize, arrayType } = attributeInfo[ name ];
					const defaultArray = new arrayType( count * itemSize );

					// Default values:

					if ( name === 'color' ) defaultArray.fill( 1.0 );
					else if ( name === 'intensity' ) defaultArray.fill( 1.0 );
					else if ( name === 'classification' ) defaultArray.fill( 0 );
					else if ( name === 'alpha' ) defaultArray.fill( 1.0 );
					else defaultArray.fill( 0 );

					mergedArrays[ name ].push( defaultArray );

				}

			}

		}

		// 5. Build final merged geometry

		const merged = new BufferGeometry();

		for ( const name of attributeNames ) {

			const { itemSize, arrayType } = attributeInfo[ name ];
			const concatenated = this._concatTyped( mergedArrays[ name ], arrayType );
			merged.setAttribute( name, new BufferAttribute( concatenated, itemSize ) );

		}

		merged.computeBoundingBox();
		merged.computeBoundingSphere();

		return merged;

	}

	_buildSoA( aosBuffer, pointCount, layout ) {

		const stride = layout.reduce( ( sum, f ) => sum + f.size, 0 );

		const out = new Uint8Array( pointCount * stride );
		const inView = new DataView( aosBuffer );

		let outOffset = 0;
		let fieldOffsetInStride = 0;

		for ( let f = 0; f < layout.length; f++ ) {

			const size = layout[ f ].size;

			for ( let i = 0; i < pointCount; i++ ) {

				const inOffset = ( i * stride ) + fieldOffsetInStride;

				for ( let b = 0; b < size; b++ ) {

					out[ outOffset++ ] = inView.getUint8( inOffset + b );

				}

			}

			fieldOffsetInStride += size;

		}

		return out;

	}

}

export { PCDExporter };
