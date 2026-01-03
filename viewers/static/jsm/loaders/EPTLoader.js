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
//	ept-data/0-0-0-0.laz
//	ept-data/1-0-0-0.laz
//	...

const GIT_LFS_THRESHOLD_BYTES = 150;

class EPTLoader extends Loader {

	constructor( manager ) {

		super( manager );

		this.localBlobs = null;
		this.lodDepthLimit = 0;
		this.lasLoader = new LASZLoader(manager);

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

	sizeOf( a ) {

		switch ( a.type ) {

			case 'int32': return 4;
			case 'uint32': return 4;
			case 'uint16': return 2;
			case 'uint8': return 1;
			case 'float': return 4;
			case 'signed':
			case 'unsigned':
				return a.size;

			default: return 0;

		}

	}

	async loadBinTile( buffer, ept ) {

		try {

			const view = new DataView( buffer );

			const attrs = ept.attributes || ept.schema;
			const scale = ept.scale;
			const offset = ept.offset;

			// Compute stride

			let stride = 0;

			for ( const a of attrs ) {

				stride += this.sizeOf( a );

			}

			const count = buffer.byteLength / stride;
			const positions = new Float32Array( count * 3 );
			const colors = new Float32Array( count * 3 );
			const intensity = new Float32Array( count );

			for ( let i = 0; i < count; i++ ) {

				let byteIndex = i * stride;

				for ( const a of attrs ) {

					let attrName = a.name.toLowerCase();

					switch ( attrName ) {

						case 'x':
							positions[ i * 3 + 0 ] = view.getInt32( byteIndex, true ) * ( a.scale || scale[ 0 ] ) + ( a.offset || offset[ 0 ] );
							byteIndex += 4;
							break;

						case 'y':
							positions[ i * 3 + 1 ] = view.getInt32( byteIndex, true ) * ( a.scale || scale[ 1 ] ) + ( a.offset || offset[ 1 ] );
							byteIndex += 4;
							break;

						case 'z':
							positions[ i * 3 + 2 ] = view.getInt32( byteIndex, true ) * ( a.scale || scale[ 2 ] ) + ( a.offset || offset[ 2 ] );
							byteIndex += 4;
							break;

						case 'intensity':
							intensity[ i ] = view.getUint16( byteIndex, true );
							byteIndex += 2;
							break;

						case 'red':
							colors[ i * 3 + 0 ] = view.getUint16( byteIndex, true ) / ( a.size === 2 ? 255.0 : 65535.0 );
							byteIndex += 2;
							break;

						case 'green':
							colors[ i * 3 + 1 ] = view.getUint16( byteIndex, true ) / ( a.size === 2 ? 255.0 : 65535.0 );
							byteIndex += 2;
							break;

						case 'blue':
							colors[ i * 3 + 2 ] = view.getUint16( byteIndex, true ) / ( a.size === 2 ? 255.0 : 65535.0 );
							byteIndex += 2;
							break;

						default:
							byteIndex += this.sizeOf( a );

					}

				}

			}

			const geometry = new BufferGeometry();
			geometry.setAttribute( 'position', new BufferAttribute( positions, 3 ) );
			geometry.setAttribute( 'color', new BufferAttribute( colors, 3 ) );
			geometry.setAttribute( 'intensity', new BufferAttribute( intensity, 1 ) );

			return geometry;

		} catch (err) {

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

		const hUrl = this.localBlobs ? this.localBlobs[ `${ key }.json` ] : `${ base }ept-hierarchy/${ key }.json`;
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
			async key => {

				console.log( count++ );

				// 1. Try BIN first

				if ( eptJson.dataType === 'zstandard' ) {

					return null;

				} else if ( eptJson.dataType === 'binary' ) {

					const bin = base + 'ept-data/' + key + '.bin';
					const binUrl = this.localBlobs ? this.localBlobs[ `${ key }.bin` ] : bin;

					try {

						const resp = await fetch( binUrl );
						if ( !resp.ok ) return null;

						const buffer = await resp.arrayBuffer();

						if ( buffer.byteLength <= GIT_LFS_THRESHOLD_BYTES ) {

							const text = new TextDecoder().decode( buffer );

							if ( text.includes( 'git-lfs.github.com/spec' ) ) {

								console.warn( 'The selected file is stored in Git LFS!' );
								git_lfs = true;
								return null;

							}

						}

						const geom = await this.loadBinTile( buffer, eptJson );
						if ( geom ) return geom;

					} catch ( err ) {

						console.warn( 'BIN load failed:', binUrl, err );

					}

					return null;

				} else {

					const laz = base + 'ept-data/' + key + '.laz';
					const lazUrl = this.localBlobs ? this.localBlobs[ `${ key }.laz` ] : laz;

					// 2. Try LAZ next

					try {

						const resp = await fetch( lazUrl );
						if ( !resp.ok ) return null;

						const buffer = await resp.arrayBuffer();

						if ( buffer.byteLength <= GIT_LFS_THRESHOLD_BYTES ) {

							const text = new TextDecoder().decode( buffer );

							if ( text.includes( 'git-lfs.github.com/spec' ) ) {

								console.warn( 'The selected file is stored in Git LFS!' );
								git_lfs = true;
								return null;

							}

						}

						return await this.lasLoader.parse( buffer );

					} catch ( err ) {

						console.warn( 'LAZ load failed:', lazUrl, err );

					}

				}

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
