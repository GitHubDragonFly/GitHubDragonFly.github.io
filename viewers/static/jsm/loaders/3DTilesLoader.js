import { Box3, Loader, MathUtils, Matrix4, Quaternion, Sphere, Vector3, WebGLRenderer } from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.min.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.min.js';
import { OGC3DTile, getOGC3DTilesCopyrightInfo } from 'https://cdn.jsdelivr.net/npm/@jdultra/threedtiles@14.0.26/dist/threedtiles.es.min.js';

/**
 * A loader for 3D Tilesets - normally loaded via tileset.json URL link.
 *
 * Created with assistance from Microsoft Copilot and Google Gemini
 *
 * Internally using OGC3DTile loader from @jdultra/threedtiles
 *
 * ```js
 * const loader = new Three3DTilesLoader();
 *
 * const tileset_object = await loader.loadAsync( 'path_to/tileset.json' );
 * scene.add( tileset_object );
 * ```
 *
 * Add the following to your render loop:
 *  tileset_object.update( camera );
 *  tileset_object.tileLoader.update();
 *
 * Dynamically change mesh material wireframe with predefined boolean variable 'enabled':
 *  tileset_object.setWireframe( enabled );
 *
 * @augments Loader
 * @three_import import { Three3DTilesLoader } from "path_to/3DTilesLoader.js"
 */
class Three3DTilesLoader extends Loader {

	/**
	 * @param { import( 'three' ).LoadingManager } [ manager ]
	 */
	constructor( manager ) {

		super( manager );

		this._keyAPI = '';
		this._pointTargetSize = 0.01;

		this._v1 = new Vector3();
		this._corner = new Vector3();
		this._R = 6378137; // WGS84 Semi-major axis

		this._renderer = null;
		this._maxCacheSize = 100;
		this._geometricErrorMultiplier = 1.0;

		this._dracoLoader = new DRACOLoader();
		this._dracoLoader.setDecoderPath( "https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/libs/draco/" );
		this._dracoLoader.setDecoderConfig( { type: 'js' } );
		this._dracoLoader.preload();

		this._ktx2Loader = new KTX2Loader();
		this._ktx2Loader.setTranscoderPath( "https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/libs/basis/" );

	}

	/**
	 * Passes renderer instance.
	 * @param { import( 'three' ).WebGLRenderer } renderer
	 */
	setRenderer( renderer ) {

		this._renderer = renderer;
		return this;

	}

	/**
	 * Sets the API key required for some data providers.
	 * @param { string } key
	 */
	setAPIKey( key ) {

		this._keyAPI = key.toString();
		return this;

	}

	/**
	 * Sets the point size for points models.
	 * Clamped between 0.01 and 3.0.
	 * @param { float } maxPointSize
	 */
	setMaxPointSize( maxPointSize ) {

		if ( typeof maxPointSize !== 'number' || !Number.isFinite( maxPointSize ) ) {

			console.warn( `Invalid maxPointSize: ${ maxPointSize }. Using default.` );
			return this;

		}

		this._pointTargetSize = Math.max( 0.01, Math.min( 3.0, maxPointSize ) );
		return this;

	}

	/**
	 * Determines how many tiles are kept in the "ready" state.
	 * Clamped between 100 and 5000.
	 * @param { integer } maxCacheSize
	 */
	setMaxCacheSize( maxCacheSize ) {

		if ( typeof maxCacheSize !== 'number' || !Number.isFinite( maxCacheSize ) ) {

			console.warn( `Invalid maxCacheSize: ${ maxCacheSize }. Using default.` );
			return this;

		}

		this._maxCacheSize = Math.max( 100, Math.min( 5000, maxCacheSize ) );
		return this;

	}

	/**
	 * Passes geometric error multiplier for displayed object quality.
	 * Value > 1.0 reduces quality and increases performance
	 * Clamped between 0.1 and 5.0.
	 * @param { float } errorMultiplier
	 */
	setGeometricErrorMultiplier( errorMultiplier ) {

		if ( typeof errorMultiplier !== 'number' || !Number.isFinite( errorMultiplier ) ) {

			console.warn( `Invalid errorMultiplier: ${ errorMultiplier }. Using default.` );
			return this;

		}

		this._geometricErrorMultiplier = Math.max( 0.1, Math.min( 5.0, errorMultiplier ) );
		return this;

	}

	/**
	 * Converts an Oriented Bounding Box (OBB) to an Axis-Aligned Bounding Box (Box3).
	 * @param { Object } obb - The OBB object with center and e1, e2, e3 vectors.
	 * @returns { Box3 }
	 * @private
	 */
	_obbToBox3( obb, target = new Box3() ) {

		const { center, e1, e2, e3, halfSize } = obb;

		// Determine the effective half-size.
		// If halfSize exists, we use it.
		// If not, we assume scale is already in e1,e2,e3 (size 1.0)

		const hx = halfSize ? halfSize.x : 1.0;
		const hy = halfSize ? halfSize.y : 1.0;
		const hz = halfSize ? halfSize.z : 1.0;

		// Calculate the "Radius" (Projection) onto World Axes
		// We multiply the axis component by its respective half-size

		const rx = Math.abs( e1.x * hx ) + Math.abs( e2.x * hy ) + Math.abs( e3.x * hz );
		const ry = Math.abs( e1.y * hx ) + Math.abs( e2.y * hy ) + Math.abs( e3.y * hz );
		const rz = Math.abs( e1.z * hx ) + Math.abs( e2.z * hy ) + Math.abs( e3.z * hz );

		// Set the Box3 boundaries

		target.min.set( center.x - rx, center.y - ry, center.z - rz );
		target.max.set( center.x + rx, center.y + ry, center.z + rz );

		return target;

	}

	/**
	 * Creates a Box3 from a bounding sphere.
	 * @param { Object } sphere - Object containing center and radius.
	 * @returns { Box3 }
	 * @private
	 */
	_boxFromSphere( sphere ) {

		const center = new Vector3(

			sphere.center.x,
			sphere.center.y,
			sphere.center.z

		);

		const r = sphere.radius;

		return new Box3(

			new Vector3( center.x - r, center.y - r, center.z - r ),
			new Vector3( center.x + r, center.y + r, center.z + r )

		);

	}

	/**
	 * Computes a Box3 from a bounding volume (Sphere or OBB).
	 * @param { Object } bv - The bounding volume from the tileset.
	 * @param { Vector3 } scaleVec - The scale to account for.
	 * @returns { Box3 }
	 * @private
	 */
	_computeBox3FromBoundingVolume( bv, scaleVec ) {

		if ( bv.isSphere ) {

			return this._boxFromSphere( bv );

		} else if ( bv.isOBB ) {

			return this._obbToBox3( bv );

		} else if ( bv.box && Array.isArray( bv.box ) ) {

			const b = bv.box;
			// b[0..2] = center, b[3..5] = ux, b[6..8] = uy, b[9..11] = uz

			const box = new Box3();
			box.makeEmpty();

			// Instead of an array, we manually calculate the
			// 8 permutations of: center +/- ux +/- uy +/- uz

			for ( let i = 0; i < 8; i ++ ) {

				this._corner.set( b[ 0 ], b[ 1 ], b[ 2 ] ); // Start at center

				// Use bitmasking to add or subtract the half-axes

				this._corner.addScaledVector( this._v1.set( b[ 3 ], b[ 4 ], b[ 5 ] ), ( i & 1 ) ? 1 : - 1 ); // ux
				this._corner.addScaledVector( this._v1.set( b[ 6 ], b[ 7 ], b[ 8 ] ), ( i & 2 ) ? 1 : - 1 ); // uy
				this._corner.addScaledVector( this._v1.set( b[ 9 ], b[ 10 ], b[ 11 ] ), ( i & 4 ) ? 1 : - 1 ); // uz

				box.expandByPoint( this._corner );

			}


			// Normalize the resulting box by the scaleVec

			box.min.multiply( scaleVec );
			box.max.multiply( scaleVec );

			return box;

		} else if ( bv.region ) {

			const box = new Box3();
			box.makeEmpty();

			const [ west, south, east, north, minH, maxH ] = region;
			const lons = [ west, east ];
			const lats = [ south, north ];
			const alts = [ minH, maxH ];

			// We calculate ECEF for all 8 combinations of the region

			for ( let i = 0; i < 2; i++ ) { // lon

				for ( let j = 0; j < 2; j++ ) { // lat

					for ( let k = 0; k < 2; k++ ) { // alt

						const lon = lons[ i ];
						const lat = lats[ j ];
						const alt = alts[ k ];

						// Standard Geodetic to ECEF conversion

						const cosLat = Math.cos( lat );
						const x = ( this._R + alt ) * cosLat * Math.cos( lon );
						const y = ( this._R + alt ) * Math.sin( lat );
						const z = ( this._R + alt ) * cosLat * Math.sin( lon );

						box.expandByPoint( this._v1.set( x, y, z ) );

					}

				}

			}

			return box;

		}

		console.warn( 'Unsupported boundingVolume type, falling back to identity Box3.' );

		return new Box3(

			new Vector3( - 1, - 1, - 1 ),
			new Vector3( 1, 1, 1 )

		);

	}

	/**
	 * Three.js-style callback API.
	 * @param { string } url
	 * @param { ( group: Object3D ) => void } [ onLoad ]
	 * @param { ( event: ProgressEvent<EventTarget> ) => void } [ onProgress ]
	 * @param { ( error: any ) => void } [ onError ]
	 */
	load( url, onLoad, onProgress, onError ) {

		// Non-async wrapper around loadAsync

		this.loadAsync( url )
			.then( group => {

				if ( onLoad ) onLoad( group );
				return group;

			} )
			.catch( err => {

				if ( onError ) onError( err );
				else console.error( err );
				return null;

			});

	}

	/**
	 * Promise-based API.
	 * @param { string } url
	 * @returns { Object3D }
	 */
	async loadAsync( url ) {

		try {

			if ( !this._renderer ) this._renderer = new WebGLRenderer( { antialias: false } );
			this._ktx2Loader.detectSupport( this._renderer );

			const json = await fetch( url ).then( r => r.json() );
			const tilesetVersion = json.asset?.version || null;

			const ogc3DTile = await new Promise( ( resolve ) => {

				const tile = new OGC3DTile({

					url: url,
					centerModel: true,
					renderer: this._renderer,
					ktx2Loader: this._ktx2Loader,
					dracoLoader: this._dracoLoader,
					maxCacheSize: this._maxCacheSize,
					queryParams: { key: this._keyAPI },
					loadOutsideView: (this._keyAPI.length > 0),
					geometricErrorMultiplier: this._geometricErrorMultiplier,
					onLoadCallback: () => resolve( tile ) // Resolves when tileset JSON is ready

				});

			});

			ogc3DTile.displayErrors = true;

			const obv = ogc3DTile.boundingVolume;

			// 1. Extract the components from the matrix

			const matrix = new Matrix4().fromArray( ogc3DTile.matrix.elements );
			const position = new Vector3();
			const quat = new Quaternion();
			const scale = new Vector3();

			matrix.decompose( position, quat, scale );

			let correction;
			let correction_applied = false;
			const isIdentity = ( quat.x === 0 && quat.y === 0 && quat.z === 0 && quat.w === 1 );

			const obvCenter = new Vector3( obv.center.x, obv.center.y, obv.center.z );
			const zToYMatrix = ogc3DTile.tileLoader.zUpToYUpMatrix;

			const upVec = obvCenter.clone().normalize();
			const worldUp = new Vector3( 0, 1, 0 );

			const earthTiltAngle = upVec.angleTo( worldUp );

			const isECEF = obvCenter.length() > 1000000;

			if ( isECEF && MathUtils.radToDeg( earthTiltAngle ) > 0.1 ) {

				const alignQuat = new Quaternion().setFromUnitVectors( upVec, worldUp );
				ogc3DTile.quaternion.copy( alignQuat );
				correction_applied = true;

			} else if ( !isECEF && !isIdentity ) {

				correction = new Matrix4().makeRotationX( MathUtils.degToRad( -90 ) );
				ogc3DTile.quaternion.setFromRotationMatrix( correction );
				correction_applied = true;

			} else if ( isECEF ) {

				correction = new Matrix4().makeRotationX( MathUtils.degToRad( 90 ) );
				ogc3DTile.quaternion.setFromRotationMatrix( correction );
				correction_applied = true;

			}

			// --- Normalize non-uniform scale back to ( 1, 1, 1 ) ---

			let scaleVec = new Vector3(

				ogc3DTile.scale.x,
				ogc3DTile.scale.y,
				ogc3DTile.scale.z

			);

			const hasNonUnitScale =
				scaleVec.x !== 1 ||
				scaleVec.y !== 1 ||
				scaleVec.z !== 1;

			if ( hasNonUnitScale ) {

				ogc3DTile.scale.set( 1, 1, 1 );

			}

			// Convert OBV → Box3

			const box = this._computeBox3FromBoundingVolume( obv, scaleVec );

			if ( correction_applied ) {

				if ( correction ) {

					box.applyMatrix4( correction );

				} else {

					const ogcQuat = ogc3DTile.quaternion;
					const rotationMatrix = new Matrix4().makeRotationFromQuaternion( ogcQuat );
					box.applyMatrix4( rotationMatrix );

				}

			} else {

				if ( tilesetVersion === '1.0' ) box.applyMatrix4( zToYMatrix );

			}

			// Center the tileset

			const sphere = box.getBoundingSphere( new Sphere() );
			const center = sphere.center.clone();

			// Position the tileset so the model is at ( 0, 0, 0 )

			ogc3DTile.position.copy( center ).multiplyScalar( -1 );

			// Shift the bounding box so it stays aligned with the moved tile

			box.translate( center.clone().multiplyScalar( -1 ) );

			// Store it for later

			ogc3DTile.boundingBox = box;

			/**
			 * Internal state for wireframe rendering.
			 * @type { boolean }
			 * @private
			 */
			ogc3DTile._wireframeMode = false;

			/**
			 * Sets the wireframe state for all current and future LOD tiles.
			 * @param { boolean } enabled - Whether to enable wireframe rendering.
			 * @memberof OGC3DTile
			 */
			ogc3DTile.setWireframe = function( enabled ) {

				this._wireframeMode = !!enabled;
				this._syncMaterials();

			};

			/**
			 * Traverses the tileset hierarchy to synchronize mesh materials with the 
			 * current wireframe state. This is called automatically after LOD updates.
			 * @private
			 * @memberof OGC3DTile
			 */
			ogc3DTile._syncMaterials = function() {

				this.traverse( ( child ) => {

					if ( child.isMesh ) {

						const mats = Array.isArray( child.material ) ? child.material : [ child.material ];

						mats.forEach( m => {

							if ( m && m.wireframe !== this._wireframeMode ) {

								m.wireframe = this._wireframeMode;

							}

						});

					} else if ( child.isPoints && child.material ) {

						if ( child.material.size !== this._pointTargetSize ) {

							child.material.size = this._pointTargetSize;
							child.material.needsUpdate = true;

						}

					}

				});

			};

			const originalUpdate = ogc3DTile.update.bind( ogc3DTile );

			/**
			 * Overrides the standard OGC3DTile update to ensure material states 
			 * are persisted across Level of Detail (LOD) swaps.
			 * @param { import( 'three' ).Camera } camera
			 * @override
			 */
			ogc3DTile.update = function( camera ) {

				// Run the library's original LOD logic

				originalUpdate( camera );

				// Immediately force our wireframe or point size state on any newly swapped tiles

				this._syncMaterials();

			};

			/**
			 * Automatically positions and points the camera to fit the tileset.
			 * @param { import( 'three' ).PerspectiveCamera } camera 
			 * @memberof OGC3DTile
			 */
			ogc3DTile.frameCamera = function( camera ) {

				// Force the tileset to update its matrices so we get current world positions

				this.updateMatrixWorld( true );

				// Use the pre-calculated local bounding box

				const localBox = this.boundingBox;
				const size = localBox.getSize( new Vector3() );
				const center = localBox.getCenter( new Vector3() );

				const fov = MathUtils.degToRad( camera.fov );

				// Calculate distance based on the largest dimension to ensure it fits

				const maxDim = Math.max( size.x, size.y, size.z );
				const distance = ( maxDim / 2.0 ) / Math.tan( fov / 2.0 );

				// Position camera looking at the center (which is 0,0,0 now)

				camera.position.set( center.x, center.y, center.z + distance + 30 );
				camera.lookAt( center );
				camera.updateProjectionMatrix();

			};

			const originalLibraryDispose = ogc3DTile.dispose.bind( ogc3DTile );

			/**
			 * Custom dispose that cleans up Three.js resources AND the OGC library state.
			 */
			ogc3DTile.dispose = function() {

				// Remove from scene

				if ( this.parent ) {

					this.parent.remove( this );

				}

				// Deep traverse to free GPU resources

				this.traverse( ( child ) => {

					if ( child.isMesh || child.isPoints ) {

						if ( child.geometry ) {

							child.geometry.dispose();
							child.geometry = null;

						}

						if ( child.material ) {

							const materials = Array.isArray( child.material ) ? child.material : [ child.material ];

							materials.forEach( m => {

								// Dispose all textures in the material

								for ( const key in m ) {

									if ( m[ key ] && m[ key ].isTexture ) {

										m[ key ].dispose();
										m[ key ] = null;

									}

								}

								m.dispose();

							});

							child.material = null;

						}

					}

				});

				// Call the library's original cleanup (clears internal cache/workers)

				if ( typeof originalLibraryDispose === 'function' ) {

					originalLibraryDispose();

				}

				console.debug( 'OGC3DTileset and GPU resources disposed.' );

			};

			const copyright_info = getOGC3DTilesCopyrightInfo();

			if ( copyright_info.length > 0 ) {

				console.log( 'Copyright Info: ', copyright_info );

			}

			return ogc3DTile;

		} catch ( err ) {

			console.error( err );

		}

	}

}

export { Three3DTilesLoader };
