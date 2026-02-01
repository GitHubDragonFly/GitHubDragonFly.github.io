import {
	BufferAttribute,
	BufferGeometry,
	DefaultLoadingManager,
	Matrix3,
	Points,
	Vector3
} from 'three';

// https://github.com/McSimp/lzfjs
import * as compressor from 'https://esm.sh/lzfjs@1.0.1';

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
*		const options = ( binary: false, binaryCompressed: true, separateRGB: true );
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
		this._tempVec = new Vector3(); // Unique to this instance

	}

	parse( scene, onDone, onError, options = {} ) {

		this.parseAsync( scene, onDone, onError, options );

	}

	async parseAsync( scene, onDone, onError, options = {} ) {

		const scope = this;

		const missingSourceWarnings = new Set();

		const defaultOptions = {

			binary: false,
			binaryCompressed: false,
			littleEndian: true,         // for binary modes: false = AARRGGBB, true = BBGGRRAA
			includeAlpha: false,
			includeColors: true,         // Required for either packed or separate color
			colorUnsigned: false,        // Only applies to packed rgb or rgba, requires includeColors
			separateRGB: false,          // U1 only, when true requires includeColors, disregards colorUnsigned
			includeNormals: true,
			includeIntensity: true,
			includeClassification: true,
			intensityType: 'U2',         // 'F4' or 'U4' or 'U2' or 'U1'
			classificationType: 'U1',    // 'U4' or 'U2' or 'U1'
			customFields: []
			// For example, add the following custom fields
			// where count, scale and offset are optional:
			// [
			//   { name: 'timestamp', type: 'F', size: 8, count: 1, source: 'attributeName', scale: 1, offset: 0 },
			//   { name: 'semantic_id', type: 'U', size: 2, count: 1, source: 'semantic', scale: 1, offset: 0 },
			//   { name: 'gps', type: 'F', size: 8, count: 3, source: 'gps', scale: 1, offset: 0 }
			// ]

		};

		options = Object.assign( defaultOptions, options );

		if ( ![ 'U1', 'U2', 'U4', 'F4' ].includes( options.intensityType ) ) {

			throw new Error( 'Invalid intensityType - valid values: U1, U2, U4, F4' );

		}

		if ( ![ 'U1', 'U2', 'U4' ].includes( options.classificationType ) ) {

			throw new Error( 'Invalid classificationType - valid values: U1, U2, U4' );

		}

		if ( options.customFields.length > 0 ) {

			for ( const field of options.customFields ) {

				if ( !/^[A-Za-z_][A-Za-z0-9_]*$/.test( field.name ) ) {

					throw new Error( `Invalid custom field name: ${ field.name }` );

				} else if ( ![ 'U', 'F' ].includes( field.type ) ) {

					throw new Error( 'Invalid custom field type - valid values: U, F' );

				} else if ( ![ 1, 2, 4, 8 ].includes( field.size ) ) {

					throw new Error( 'Invalid custom field size - valid values: 1, 2, 4, 8' );

				} else if ( field.count != null && field.count < 1 ) {

					throw new Error( 'Invalid custom field count - valid values: >= 1' );

				} else if ( typeof field.source !== 'string' ) {

					throw new Error( 'Invalid custom field source - requires string value' );

				} else if ( field.scale != null && field.scale <= 0 ) {

					throw new Error( 'Invalid custom field scale - valid values: >= 0' );

				}

			}

		}

		scene.updateMatrixWorld( true, true );

		let pointClouds = [];
		let points_count = 0;
		const layout = [];
		let pcd;

		function _linearToSRGB( x ) {

			return x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow( x, 1.0 / 2.4 ) - 0.055;

		}

		// Unified color packing helper
		// Handles RGB and RGBA, float and unsigned
		// with NaN‑safe masking for float32

		const floatView = new Float32Array( 1 );
		const uintView  = new Uint32Array( floatView.buffer );

		function _packColor( r, g, b, a, fieldType, isUnsigned, hasAlpha, littleEndian ) {

			let packed;

			// Pack into a 32‑bit integer

			if ( littleEndian ) {

				packed = hasAlpha
					?
						( ( b & 0xFF ) << 0 ) |
						( ( g & 0xFF ) << 8 ) |
						( ( r & 0xFF ) << 16 ) |
						( ( a & 0xFF ) << 24 )
					:
						( ( b & 0xFF ) << 0 ) |
						( ( g & 0xFF ) << 8 ) |
						( ( r & 0xFF ) << 16 );

			} else {

				packed = hasAlpha
					?
						( ( a & 0xFF ) << 24 ) |
						( ( r & 0xFF ) << 16 ) |
						( ( g & 0xFF ) << 8 ) |
						( ( b & 0xFF ) << 0 )
					:
						( ( r & 0xFF ) << 16 ) |
						( ( g & 0xFF ) << 8 ) |
						( ( b & 0xFF ) << 0 );

			}

			// Unsigned path → return raw uint32

			if ( fieldType === 'U' ) return (isUnsigned ? packed >>> 0 : packed);

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

			if ( points_count === 0 ) return;

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

			// --- 1) Detect fields ---

			const hasColor = options.includeColors && pointClouds.some( pc => pc.geometry.attributes.color );
			const hasNormal = options.includeNormals && pointClouds.some( pc => pc.geometry.attributes.normal );
			const hasIntensity = options.includeIntensity && pointClouds.some( pc => pc.geometry.attributes.intensity );
			const hasClassification = options.includeClassification && pointClouds.some( pc => pc.geometry.attributes.classification );

			const fieldNames = [];
			const fieldSizes = [];
			const fieldTypes = [];
			const fieldCounts = [];

			function addField( name, t, s, c = 1, src, comp, scl = 1, off = 0 ) {

				layout.push( { name, type: t, size: s, count: c, source: src, component: comp, scale: scl, offset: off } );

				fieldNames.push( name );
				fieldTypes.push( t );
				fieldSizes.push( s );
				fieldCounts.push( c );

			}

			// XYZ

			addField( 'x', 'F', 4, 1, 'position' );
			addField( 'y', 'F', 4, 1, 'position' );
			addField( 'z', 'F', 4, 1, 'position' );

			if ( hasNormal ) {

				addField( 'normal_x', 'F', 4, 1, 'normal' );
				addField( 'normal_y', 'F', 4, 1, 'normal' );
				addField( 'normal_z', 'F', 4, 1, 'normal' );

			}

			if ( hasIntensity ) {

				const t = options.intensityType[ 0 ]; // 'U' or 'F'
				const s = parseInt( options.intensityType.slice( 1 ) ); // 1, 2, 4

				addField( 'intensity', t, s, 1, 'intensity' );

			}

			if ( hasClassification ) {

				const s = parseInt( options.classificationType.slice( 1 ) ); // 1, 2, 4

				addField( 'classification', 'U', s, 1, 'classification' );

			}

			if ( hasColor ) {

				if ( options.separateRGB ) {

					addField( 'r', 'U', 1, 1, 'color', 0 );
					addField( 'g', 'U', 1, 1, 'color', 1 );
					addField( 'b', 'U', 1, 1, 'color', 2 );

					if ( options.includeAlpha )
						addField( 'a', 'U', 1, 1, 'alpha', 3 );

				} else {

					const t = options.colorUnsigned ? 'U' : 'F';

					const name = options.includeAlpha ? 'rgba' : 'rgb';
					addField( name, t, 4, 1, 'color' );

				}

			}

			if ( options.customFields.length > 0 ) {

				// Use the first point cloud (merged or single)

				const pc = pointClouds[ 0 ];

				for ( const cf of options.customFields ) {

					// Auto-detect count if not provided

					const attr = pc.geometry.getAttribute( cf.source );

					let detectedCount = cf.count;

					if ( detectedCount === null ) {

						if ( attr ) {

							detectedCount = attr.itemSize; // auto-detect from attribute

						} else {

							detectedCount = 1; // fallback to scalar

						}

					} else if ( attr && attr.itemSize !== cf.count) {

						console.warn( `PCD Exporter: Custom field "${ cf.name }" expects count ${ cf.count }, ` + `but attribute "${ cf.source }" has itemSize ${ attr.itemSize }.` );

					}

					addField( cf.name, cf.type, cf.size, detectedCount, cf.source, null, cf.scale ?? 1, cf.offset ?? 0, );

				}

			}

			const mode = options.binaryCompressed
				? 'binary_compressed'
				: options.binary
					? 'binary'
					: 'ascii';

			const endianness = options.littleEndian
				? 'BBGGRRAA (little-endian)'
				: 'AARRGGBB (big-endian)';

			// A tiny 0.1 degree rotation on the X axis to mark this file 
			// as "Handled" so the loader doesn't apply automatic Z-up fixes.

			const qw = 0.9999996192;
			const qx = 0.0008726646;

			let header =
				`# Created by the custom PCD Exporter\n` +
				`# COLOR_ENDIANNESS ${ endianness }\n` +
				`# .PCD v0.7 - Point Cloud Data file format\n` +
				`VERSION 0.7\n` +
				`FIELDS ${ fieldNames.join( ' ' ) }\n` +
				`SIZE ${ fieldSizes.join( ' ' ) }\n` +
				`TYPE ${ fieldTypes.join( ' ' ) }\n` +
				`COUNT ${ fieldCounts.join( ' ' ) }\n` +
				`WIDTH ${ points_count }\n` +
				`HEIGHT 1\n` +
				`VIEWPOINT 0 0 0 ${ qw.toFixed( 10 ) } ${ qx.toFixed( 10 ) } 0 0\n` +
				`POINTS ${ points_count }\n` +
				`DATA ${ mode }\n`;

			const stride = layout.reduce( ( sum, f ) => sum + f.size * f.count, 0 );

			let buffer = null;
			let view = null;
			let offset = 0;
			const lines = [];

			if ( options.binary || options.binaryCompressed ) {

				const bytesPerPoint = stride;
				buffer = new ArrayBuffer( bytesPerPoint * points_count );
				view   = new DataView( buffer );
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

				const ctx = {
					pos,
					normalAttr,
					intensityAttr,
					classificationAttr,
					colorAttr,
					alphaAttr,
					worldMatrix,
					normalMatrix,
					options,
					packColor: ( i, fieldType ) => {

						const r = colorAttr ? _linearToSRGB( colorAttr.getX( i ) ) * 255 : 255;
						const g = colorAttr ? _linearToSRGB( colorAttr.getY( i ) ) * 255 : 255;
						const b = colorAttr ? _linearToSRGB( colorAttr.getZ( i ) ) * 255 : 255;

						if ( options.includeAlpha ) {

							const a = Math.min( 255, Math.max( 0, alphaAttr
								? alphaAttr.getX( i ) * 255
								: pc.material.opacity * 255 ) );

							return _packColor( r, g, b, a, fieldType, options.colorUnsigned, true, options.littleEndian );

						} else {

							return _packColor( r, g, b, 255, fieldType, options.colorUnsigned, false, options.littleEndian );

						}

					}

				};

				for ( let i = 0; i < pos.count; i++ ) {

					if ( !options.binary && !options.binaryCompressed ) {

						let line = '';

						for ( const field of layout ) {

							const value = scope._readFieldValue( field, i, pc, ctx );

							if ( Array.isArray( value ) ) {

								for ( const v of value ) line += v + ' ';

							} else {

								line += value + ' ';

							}

						}

						lines.push( line.trim() + '\n' );

					} else {

						for ( const field of layout ) {

							const value = scope._readFieldValue( field, i, pc, ctx );
							offset = scope._writeFieldBinary( field, value, view, offset, options.littleEndian );

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

					// fieldNames = ['x','y','z','intensity','rgb'] or whatever

					const fieldCount = fieldNames.length;

					// Convert AoS float buffer into SoA

					let soaBuffer = scope._buildSoA( buffer, points_count, layout );

					// Now compress the SoA buffer

					const compressed = compressor.compress( soaBuffer );
					const compressedSize = compressed.length;
					const uncompressedSize = soaBuffer.byteLength;

					const sizeBytes = new Uint8Array( 8 );
					new DataView( sizeBytes.buffer ).setUint32( 0, compressedSize, true );
					new DataView( sizeBytes.buffer ).setUint32( 4, uncompressedSize, true );

					pcd = new Uint8Array( headerBytes.length + sizeBytes.length + compressedSize );
					pcd.set( headerBytes, 0 );
					pcd.set( sizeBytes, headerBytes.length );
					pcd.set( compressed, headerBytes.length + sizeBytes.length );

					soaBuffer = null;

				} else {

					pcd = new Uint8Array( headerBytes.length + buffer.byteLength );
					pcd.set( headerBytes, 0 );
					pcd.set( new Uint8Array( buffer ), headerBytes.length );

				}

				buffer = null;

			}

		}

		_parse_objects();

		if ( points_count === 0 ) {

			if ( typeof onError === 'function' ) {

				onError( 'THREE.PCDExporter: No qualifying objects found!' );
				return null;

			}

			throw new Error( 'THREE.PCDExporter: No qualifying objects found!' );

		} else {

			if ( typeof onDone === 'function' ) {

				onDone( pcd );

			}

			return pcd;

		}

	}

	_readFieldValue( field, i, pc, ctx ) {

		const {

			pos, normalAttr, intensityAttr, classificationAttr,
			colorAttr, alphaAttr, worldMatrix, normalMatrix,
			options, packColor

		} = ctx;

		switch ( field.name ) {

			case 'x':
			case 'y':
			case 'z': {

				this._tempVec.fromBufferAttribute( pos, i );
				this._tempVec.applyMatrix4( worldMatrix );

				if ( field.name === 'x' ) return this._tempVec.x;
				if ( field.name === 'y' ) return this._tempVec.y;
				return this._tempVec.z;

			}

			case 'normal_x':
			case 'normal_y':
			case 'normal_z': {

				if ( !normalAttr ) return 0;

				this._tempVec.fromBufferAttribute( normalAttr, i );
				this._tempVec.applyMatrix3( normalMatrix ).normalize();

				if ( field.name === 'normal_x' ) return this._tempVec.x;
				if ( field.name === 'normal_y' ) return this._tempVec.y;
				return this._tempVec.z;

			}

			case 'intensity':

				return intensityAttr ? intensityAttr.getX( i ) : 1.0;

			case 'classification':

				return classificationAttr ? classificationAttr.getX( i ) : 0;

			case 'rgb':
			case 'rgba':

				return packColor( i, field.type );

			default: {

				// Separate R/G/B/(/A) support using field.component

				if ( field.source === 'color' && field.component != null ) {

					if ( !colorAttr ) return 0;

					const base = i * 3;
					const v = colorAttr.array[ base + field.component ];

					// Convert normalized float → 0–255 integer

					return Math.round( v * 255 );

				}

				// Separate Alpha support (if user enabled it)

				if ( field.name === 'a' && field.source === 'alpha' ) {

					if ( alphaAttr ) {

						const a = alphaAttr.getX( i );
						return Math.round( a * 255 );

					}

					return 255;

				}

				// Generic attribute handling

				const attr = pc.geometry.getAttribute( field.source );

				if ( !attr ) {

					// Warn once per missing source

					if ( !missingSourceWarnings.has( field.source ) ) {

						console.warn( `PCD Exporter: Missing attribute "${ field.source }" for field "${ field.name }". ` + `Falling back to default value 0.` );

						missingSourceWarnings.add( field.source );

					}

					return field.count === 1
						? field.offset
						: Array( field.count ).fill( field.offset );

				}

				if ( attr.itemSize < field.count ) {

					console.warn( `PCD Exporter: Attribute "${ field.source }" has itemSize ${ attr.itemSize }, but field "${ field.name }" expects count ${ field.count }.`);

				}

				if ( field.count === 1 ) {

					let v = attr.getX( i );
					v = v * field.scale + field.offset;
					return v;

				}

				// Multi-component

				const values = [];

				for ( let c = 0; c < field.count; c++ ) {

					let v = attr.getComponent( i, c );
					v = v * field.scale + field.offset;
					values.push( v );

				}

				return values;

			}

		}

	}

	_writeFieldBinary( field, value, view, offset, littleEndian ) {

		if ( field.count === 1 ) {

			return this._writeOne( field, value, view, offset, littleEndian );

		}

		for ( let c = 0; c < field.count; c++ ) {

			offset = this._writeOne( field, value[ c ], view, offset, littleEndian );

		}

		return offset;

	}

	_writeOne( field, v, view, offset, littleEndian ) {

		// Only apply passed endianness to packed color fields

		const requiredEndian = ( field.source === 'color' ) ? littleEndian : true;

		switch ( field.type ) {

			case 'F':

				if ( field.size === 4 ) view.setFloat32( offset, v, requiredEndian );
				else view.setFloat64( offset, v, requiredEndian );

				break;

			case 'U':

				if ( field.size === 1 ) view.setUint8( offset, v );
				else if ( field.size === 2 ) view.setUint16( offset, v, requiredEndian );
				else view.setUint32( offset, v, requiredEndian );

				break;

			case 'I':

				if ( field.size === 1 ) view.setInt8( offset, v );
				else if ( field.size === 2 ) view.setInt16( offset, v, requiredEndian );
				else view.setInt32( offset, v, requiredEndian );

				break;

		}

		return offset + field.size;

	}

	_normalize( attrib ) {

		// Graceful exit for missing attributes

		if ( !attrib ) return null;

		// Defensive checks for malformed attributes

		if ( attrib.count === 0 || attrib.itemSize === 0 ) return null;

		// If already normalized (float32), return as-is

		if ( attrib.array instanceof Float32Array ) { return attrib; }

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
		const typePriority = [ Float64Array, Float32Array, Uint32Array, Uint16Array, Uint8Array ];

		for ( const name of attributeNames ) {

			let bestType = null;
			let itemSize = null;

			for ( const g of geoms ) {

				const attr = g.getAttribute( name );
				if ( !attr ) continue;
				const t = attr.array.constructor;

				if ( !bestType || typePriority.indexOf( t ) < typePriority.indexOf( bestType ) ) {

					bestType = t;
					itemSize = attr.itemSize;

				}

			}

			attributeInfo[ name ] = { itemSize, arrayType: bestType };

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

		const stride = layout.reduce( ( sum, f ) => sum + f.size * f.count, 0 );
		const out = new Uint8Array( pointCount * stride );
		const fullAoS = new Uint8Array( aosBuffer );

		let outOffset = 0;
		let fieldOffsetInStride = 0;

		for ( let f = 0; f < layout.length; f++ ) {

			const fieldSize = layout[ f ].size * layout[ f ].count;

			for ( let i = 0; i < pointCount; i++ ) {

				const inOffset = ( i * stride ) + fieldOffsetInStride;
				out.set( fullAoS.subarray( inOffset, inOffset + fieldSize ), outOffset );
				outOffset += fieldSize;

			}

			fieldOffsetInStride += fieldSize;

		}

		return out;

	}

}

export { PCDExporter };
