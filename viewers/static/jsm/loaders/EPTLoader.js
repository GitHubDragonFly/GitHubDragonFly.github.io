import {
    BufferAttribute,
    BufferGeometry,
    Loader
} from 'three';

import { LASZLoader } from './LASZLoader.min.js'; // reuse existing LAS/LAZ decoder

// Created with assistance from Microsoft Copilot and Google Gemini
// Supporting loading of EPT datasets with BIN/LAS/LAZ tiles

// EPT datasets always contain:
// ept.json
// ept-hierarchy/
//	- ept-hierarchy/0-0-0-0.json
//	- ept-hierarchy/1-0-0-0.json
//	- ept-hierarchy/1-0-0-1.json
//	...
//	- ept-hierarchy/2-0-0-0.json
//	...
// ept-data/
//	ept-data/0-0-0-0.laz (or .bin)
//	ept-data/1-0-0-0.laz (or .bin)
//	...

const GIT_LFS_THRESHOLD_BYTES = 150;

class EPTLoader extends Loader {

	constructor( manager ) {

		super( manager );

		this.skipPoints = 1;
		this.lodDepthLimit = 0;
		this.localBlobs = null;

		this.lasLoader = new LASZLoader( manager );

	}

	setLocalBlobMap( blobs ) {

		this.localBlobs = blobs;
		return this;

	}

	setTileDepthLimit( depth ) {

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

		this.lasLoader.setSkipPoints( number_of_points );
		this.skipPoints = number_of_points;
		return this;

	}

	setSkipColor( flag ) {

		this.lasLoader.setSkipColor( flag );
		return this;

	}

	setSkipIntensity( flag ) {

		this.lasLoader.setSkipIntensity( flag );
		return this;

	}

	setSkipClassification( flag ) {

		this.lasLoader.setSkipClassification( flag );
		return this;

	}

	setIntensityGammaFactor( gamma ) {

		// Convert to number

		gamma = Number( gamma );

		// If invalid, fall back to default 1.0

		if ( !isFinite( gamma ) || gamma <= 0 ) { gamma = 1.0; }

		// Clamp to a reasonable range

		gamma = Math.min( Math.max( gamma, 0.1 ), 2.0);

		this.lasLoader.setIntensityGammaFactor( gamma );
		return this;

	}

	setApplyIntensityToColor( flag ) {

		this.lasLoader.setApplyIntensityToColor( flag );
		return this;

	}

	concatFloat32( arrays ) {

		// Helper to concatenate Float32Arrays

		let total = 0;

		for ( const a of arrays ) total += a.length;

		const out = new Float32Array( total );

		let offset = 0;

		for ( const a of arrays ) {

			out.set(a, offset);
			offset += a.length;

		}

		return out;

	}

	mergeGeometries( geoms ) {

		// Merge multiple BufferGeometries into one

		const positions = [];
		const colors = [];
		const intensities = [];
		const classifications = [];

		let hasColor = false;
		let hasIntensity = false;
		let hasClass = false;

		for ( const g of geoms ) {

			const pos = g.getAttribute( 'position' );

			if ( pos ) positions.push( pos.array );

			const col = g.getAttribute( 'color' );

			if ( col ) {

				hasColor = true;
				colors.push(col.array);

			}

			const inten = g.getAttribute( 'intensity' );

			if ( inten ) {

				hasIntensity = true;
				intensities.push(inten.array);

			}

			const cls = g.getAttribute( 'classification' );

			if ( cls ) {

				hasClass = true;
				classifications.push( cls.array );

			}

		}

		const merged = new BufferGeometry();
		merged.setAttribute( 'position', new BufferAttribute( this.concatFloat32( positions ), 3 ) );

		if ( hasColor ) {

			merged.setAttribute( 'color', new BufferAttribute( this.concatFloat32( colors ), 3 ) );

		}

		if ( hasIntensity ) {

			merged.setAttribute( 'intensity', new BufferAttribute( this.concatFloat32( intensities ), 1 ) );

		}

		if ( hasClass ) {

			merged.setAttribute( 'classification', new BufferAttribute( this.concatFloat32( classifications ), 1) );

		}

		merged.computeBoundingBox();
		merged.computeBoundingSphere();

		return merged;

	}

	getValue( view, offset, type, size, littleEndian = true ) {

		switch ( type ) {

			case 'int8':     return view.getInt8( offset );
			case 'uint8':    return view.getUint8( offset );

			case 'int16':    return view.getInt16( offset, littleEndian );
			case 'uint16':   return view.getUint16( offset, littleEndian );

			case 'int32':    return view.getInt32( offset, littleEndian );
			case 'uint32':   return view.getUint32( offset, littleEndian );

			case 'float':
			case 'float32':  return view.getFloat32( offset, littleEndian );

			case 'int64':    return Number( view.getBigInt64( offset, littleEndian ) );
			case 'uint64':   return Number( view.getBigUint64( offset, littleEndian ) );

			case 'double':
			case 'float64':  return view.getFloat64( offset, littleEndian );

			case 'integer':
			case 'scaledinteger':
			case 'signed':
			case 'unsigned':
				switch ( size ) {
					case 1: return (type === 'unsigned' ? view.getUint8( offset ) : view.getInt8( offset ));
					case 2: return (type === 'unsigned' ? view.getUint16( offset, littleEndian ) : view.getInt16( offset, littleEndian ));
					case 4: return (type === 'unsigned' ? view.getUint32( offset, littleEndian ) : view.getInt32( offset, littleEndian ));
					case 8: return (type === 'unsigned' ? Number( view.getBigUint64( offset, littleEndian ) ) : Number( view.getBigInt64( offset, littleEndian ) ));

					default:
						console.warn( 'Unsupported integer size:', a.size );
						return 0;

				}

			default:
				console.warn( 'Unknown attribute type:', type );
				return 0;

		}

	}

	sizeOf( a ) {

		switch ( a.type ) {

			case 'int8':
			case 'uint8':
				return 1;

			case 'int16':
			case 'uint16':
				return 2;

			case 'int32':
			case 'uint32':
			case 'float':
			case 'float32':
				return 4;

			case 'int64':
			case 'uint64':
			case 'float64':
			case 'double':
				return 8;

			case 'signed':
			case 'unsigned':
			case 'integer':
			case 'scaledinteger':
				return a.size;

			default:
				console.warn( 'Unknown EPT attribute type:', a.type );
				return 0;

		}

	}

	normalizeColor( value, attr ) {

		// If it's 8-bit storage

		if ( attr.size === 1 ) {

			return value / 255.0;

		}

		// If it's 16-bit storage

		if ( attr.size === 2 ) {

			// Heuristic: if value never exceeds 255, it's really 8-bit data

			if ( value <= 255 ) {

				return value / 255.0;

			}

			// Otherwise assume true 16-bit color

			return value / 65535.0;

		}

		// If it's something else, assume it's already normalized

		return value;

	}

	async loadBinTile( buffer, ept ) {

		try {

			const view = new DataView( buffer );

			const attrs = ept.attributes || ept.schema;
			const scale = ept.scale || [ 1, 1, 1 ];
			const offset = ept.offset || [ 0, 0, 0 ];

			// ----- 1. Build attribute descriptors and compute stride -----

			let stride = 0;
			const attrInfos = [];

			for ( const a of attrs ) {

				const size = this.sizeOf( a );
				const type = a.type.toLowerCase();
				const name = a.name.toLowerCase();

				attrInfos.push( {

					name,
					type,
					size,
					byteOffset: stride,
					raw: a, // keep original attribute for scale/offset/color info

				} );

				stride += size;

			}

			if ( stride === 0 ) return null;

			const totalPoints = ( buffer.byteLength / stride ) | 0;

			// ----- 2. Apply skipPoints (density reduction) -----

			const skipPoints = ( this.skipPoints && this.skipPoints > 1 ) ? this.skipPoints : 1;
			const keptPoints = Math.ceil( totalPoints / skipPoints );

			const positions = new Float32Array( keptPoints * 3 );
			const colors = new Float32Array( keptPoints * 3 );
			const intensity = new Float32Array( keptPoints );

			// ----- 3. Decode loop with precomputed metadata + skipping -----

			let outIndex = 0;

			for ( let i = 0; i < totalPoints; i += skipPoints ) {

				const baseOffset = i * stride;

				for ( const info of attrInfos ) {

					const a = info.raw;

					const value = this.getValue(

						view,
						baseOffset + info.byteOffset,
						info.type,
						info.size,
						true

					);

					switch ( info.name ) {

						case 'x':
							positions[ outIndex * 3 + 0 ] = value * ( a.scale || scale[ 0 ] ) + ( a.offset || offset[ 0 ] );
							break;

						case 'y':
							positions[ outIndex * 3 + 1 ] = value * ( a.scale || scale[ 1 ] ) + ( a.offset || offset[ 1 ] );
							break;

						case 'z':
							positions[ outIndex * 3 + 2 ] = value * ( a.scale || scale[ 2 ] ) + ( a.offset || offset[ 2 ] );
							break;

						case 'intensity':
							intensity[ outIndex ] = value;
							break;

						case 'red':
							colors[ outIndex * 3 + 0 ] = this.normalizeColor( value, a );
							break;

						case 'green':
							colors[ outIndex * 3 + 1 ] = this.normalizeColor( value, a );
							break;

						case 'blue':
							colors[ outIndex * 3 + 2 ] = this.normalizeColor( value, a );
							break;

						default:
							// ignore other attributes
							break;

					}

				}

				outIndex++;

			}

			// ----- 4. Build geometry -----

			const geometry = new BufferGeometry();
			geometry.setAttribute( 'position', new BufferAttribute( positions, 3 ) );
			geometry.setAttribute( 'color', new BufferAttribute( colors, 3 ) );
			geometry.setAttribute( 'intensity', new BufferAttribute( intensity, 1 ) );

			return geometry;

		} catch ( err ) {

			return null;

		}

	}

	isPDAL( ept ) {

		// Rely on schema vs attributes

		return !!ept.schema && !ept.attributes;

	}

	getTileDepth( key, ept ) {

		if ( this.isPDAL( ept ) ) {

			// PDAL / USGS span hierarchy: depth is the first part

			return parseInt( key.split( '-' )[ 0 ], 10 );

		}

		// Entwine Morton hierarchy: depth = parts - 1

		return key.split( '-' ).length - 1;

	}

	async _loadHierarchyForDepth( url ) {

		try {

			const resp = await fetch( url );
			if ( !resp.ok ) return null;
			return await resp.json();

		} catch {

			return null;

		}

	}

	async discoverHierarchy( key, eptJson, base, allKeys ) {

		// Recursive function to discover all hierarchy nodes up to lodDepthLimit

		const depth = this.getTileDepth( key, eptJson );
		if (depth > this.lodDepthLimit) return;

		const hUrl = this.localBlobs
			? this.localBlobs[ `${ key }.json` ]
			: `${ base }ept-hierarchy/${ key }.json`;

		const h = await this._loadHierarchyForDepth( hUrl );

		if ( h ) {

			Object.assign( allKeys, h );

			// Find keys in the NEWLY loaded hierarchy that
			// are 'pointers' to deeper hierarchy files
			// In EPT, if a value in the hierarchy JSON is -1
			// it usually indicates a sub-hierarchy exists

			for ( const subKey of Object.keys( h ) ) {

				const subDepth = this.getTileDepth( subKey, eptJson );

				if ( h[ subKey ] === -1 && subDepth <= this.lodDepthLimit ) {

					await this.discoverHierarchy( subKey, eptJson, base, allKeys );

				}

			}

		}

	}

	async _mapWithConcurrency( items, limit, fn ) {

		console.log('Requesting tiles with concurrency limit of ', limit);

		// Run async tasks over items with a concurrency limit

		const results = new Array( items.length );
		let index = 0;

		const worker = async () => {

			while ( true ) {

				const i = index++;
				if ( i >= items.length ) break;

				const item = items[ i ];

				try {

					results[ i ] = await fn( item );

				} catch ( err ) {

					console.warn( 'Task failed for item:', item, err );
					results[ i ] = null;

				}

			}

		};

		const workers = [];
		const workerCount = Math.min( limit, items.length );

		for ( let i = 0; i < workerCount; i++ ) {

			workers.push( worker() );

		}

		await Promise.all( workers );

		return results;

	}

	load( url, onLoad, onProgress, onError ) {

		this.parse( url )
		.then( geometry => onLoad( geometry ) )
		.catch( err => {

			if ( onError ) onError( err );
			else console.error( err );

		});

	}

	async parse( url ) {

		// 1. Load ept.json

		let eptJson, base;

		try {

			eptJson = await ( await fetch( url ) ).json();
			base = this.base || url.replace( 'ept.json', '' );

		} catch ( err ) {

			throw new Error( 'Failed to load url: ' + url + ' ' + err );

		}

		if ( eptJson.dataType === 'zstandard' ) throw new Error( 'Unsupported data type: zstandard' );

		// 2. Load hierarchy files up to the selected depth

		let allKeys = {};

		// Start recursion from the root

		await this.discoverHierarchy( '0-0-0-0', eptJson, base, allKeys );

		// 3. Extract tile keys

		const tileKeys = Object.keys( allKeys );
		console.log( 'Total Tiles:', tileKeys.length );

		const filteredKeys = tileKeys.filter( key => {

			const depth = this.getTileDepth( key, eptJson );
			return depth <= this.lodDepthLimit;

		});

		console.log( 'Selected Tiles:', filteredKeys.length );

		// 4. Load and decode each tile with concurrency limit:
		//	- Tune this number depending on your machine/network
		//	- 2–4 for older computers, 6–8 for stronger machines

		let git_lfs = false, count = 0;

		const CONCURRENCY = 4;

		const tileGeometries = await this._mapWithConcurrency(
			filteredKeys,
			CONCURRENCY,
			async (key) => {

				console.log( 'Tile ', count++ );

				let buffer;

				try {

					const extension = eptJson.dataType === 'binary' ? '.bin' : '.laz';
					const bin_laz_url = `${ base }ept-data/${ key }${ extension }`;
					const tileUrl = this.localBlobs ? this.localBlobs[ `${ key }${ extension }` ] : bin_laz_url;

					const resp = await fetch( tileUrl );
					if ( !resp.ok ) return;

					buffer = await resp.arrayBuffer();

					// Git LFS Check

					if ( buffer.byteLength <= GIT_LFS_THRESHOLD_BYTES ) {

						const text = new TextDecoder().decode( buffer );

						if ( text.includes( 'git-lfs.github.com/spec' ) ) {

							git_lfs = true;
							return;

						}

					}

					// Parse individual tile

					if ( extension === '.bin' ) {

						const geom = await this.loadBinTile( buffer, eptJson );
						if ( geom ) return geom;

					} else {

						return await this.lasLoader.parse( buffer );

					}

				} catch (err) {

					console.warn( `Tile ${ key } failed to load:`, err );

				}

				return null;

			}

		);

		// Filter out failed tiles

		const validGeometries = tileGeometries.filter( g => g );

		if ( validGeometries.length === 0 ) {

			throw new Error( 'No EPT tiles could be loaded.' + ( git_lfs ? ' Files stored in Git LFS!' : '' ) );

		}

		// 5. Merge all tile geometries

		return this.mergeGeometries( validGeometries );

	}

}

export { EPTLoader };
