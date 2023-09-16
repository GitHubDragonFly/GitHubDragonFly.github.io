( function () {

	/**
 * Loads a Wavefront .mtl file specifying materials
 */

	class MTLLoader extends THREE.Loader {

		constructor( manager ) {

			super( manager );

		}
		/**
   * Loads and parses a MTL asset from a URL.
   *
   * @param {String} url - URL to the MTL file.
   * @param {Function} [onLoad] - Callback invoked with the loaded object.
   * @param {Function} [onProgress] - Callback for download progress.
   * @param {Function} [onError] - Callback for download errors.
   *
   * @see setPath setResourcePath
   *
   * @note In order for relative texture references to resolve correctly
   * you must call setResourcePath() explicitly prior to load.
   */


		load( url, onLoad, onProgress, onError ) {

			const scope = this;
			const path = this.path === '' ? THREE.LoaderUtils.extractUrlBase( url ) : this.path;
			const loader = new THREE.FileLoader( this.manager );
			loader.setPath( this.path );
			loader.setRequestHeader( this.requestHeader );
			loader.setWithCredentials( this.withCredentials );
			loader.load( url, function ( text ) {

				try {

					onLoad( scope.parse( text, path ) );

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

		setMaterialOptions( value ) {

			this.materialOptions = value;
			return this;

		}
		/**
   * Parses a MTL file.
   *
   * @param {String} text - Content of MTL file
   * @return {MaterialCreator}
   *
   * @see setPath setResourcePath
   *
   * @note In order for relative texture references to resolve correctly
   * you must call setResourcePath() explicitly prior to parse.
   */


		parse( text, path ) {

			const lines = text.split( '\n' );
			let info = {};
			const delimiter_pattern = /\s+/;
			const materialsInfo = {};

			for ( let i = 0; i < lines.length; i ++ ) {

				let line = lines[ i ];
				line = line.trim();

				if ( line.length === 0 || line.startsWith( '#' ) ) {

					// Blank line or comment ignore
					continue;

				}

				const pos = line.indexOf( ' ' );
				let key = pos >= 0 ? line.substring( 0, pos ) : line;
				key = key.toLowerCase();
				let value = pos >= 0 ? line.substring( pos + 1 ) : '';
				value = value.trim();

				if ( key === 'newmtl' ) {

					// New material
					info = {
						name: value
					};
					materialsInfo[ value ] = info;

				} else {

					if ( key === 'ka' || key === 'kd' || key === 'ks' || key === 'ke' || key === 'patc' || key === 'psc' || key === 'pshc' ) {

						const ss = value.split( delimiter_pattern, 3 );
						info[ key ] = [ parseFloat( ss[ 0 ] ), parseFloat( ss[ 1 ] ), parseFloat( ss[ 2 ] ) ];

					} else {

						info[ key ] = value;

					}

				}

			}

			const materialCreator = new MaterialCreator( this.resourcePath || path, this.materialOptions );
			materialCreator.setCrossOrigin( this.crossOrigin );
			materialCreator.setManager( this.manager );
			materialCreator.setMaterials( materialsInfo );
			return materialCreator;

		}

	}
	/**
 * Create a new MTLLoader.MaterialCreator
 * @param baseUrl - Url relative to which textures are loaded
 * @param options - Set of options on how to construct the materials
 *                  side: Which side to apply the material
 *                        THREE.FrontSide (default), THREE.BackSide, THREE.DoubleSide
 *                  wrap: What type of wrapping to apply for textures
 *                        THREE.RepeatWrapping (default), THREE.ClampToEdgeWrapping, THREE.MirroredRepeatWrapping
 *                  normalizeRGB: RGBs need to be normalized to 0-1 from 0-255
 *                                Default: false, assumed to be already normalized
 *                  ignoreZeroRGBs: Ignore values of RGBs (Ka,Kd,Ks) that are all 0's
 *                                  Default: false
 * @constructor
 */


	class MaterialCreator {

		constructor( baseUrl = '', options = {} ) {

			this.baseUrl = baseUrl;
			this.options = options;
			this.materialsInfo = {};
			this.materials = {};
			this.materialsArray = [];
			this.nameLookup = {};
			this.crossOrigin = 'anonymous';
			this.side = this.options.side !== undefined ? this.options.side : THREE.FrontSide;
			this.wrap = this.options.wrap !== undefined ? this.options.wrap : THREE.RepeatWrapping;

		}

		setCrossOrigin( value ) {

			this.crossOrigin = value;
			return this;

		}

		setManager( value ) {

			this.manager = value;

		}

		setMaterials( materialsInfo ) {

			this.materialsInfo = this.convert( materialsInfo );
			this.materials = {};
			this.materialsArray = [];
			this.nameLookup = {};

		}

		convert( materialsInfo ) {

			if ( ! this.options ) return materialsInfo;
			const converted = {};

			for ( const mn in materialsInfo ) {

				// Convert materials info into normalized form based on options
				const mat = materialsInfo[ mn ];
				const covmat = {};
				converted[ mn ] = covmat;

				for ( const prop in mat ) {

					let save = true;
					let value = mat[ prop ];
					const lprop = prop.toLowerCase();

					switch ( lprop ) {

						case 'kd':
						case 'ka':
						case 'ke':
						case 'ks':
						case 'patc':
						case 'psc':
						case 'pshc':
							// Diffuse color (color under white light) using RGB values
							if ( this.options && this.options.normalizeRGB ) {

								value = [ value[ 0 ] / 255.0, value[ 1 ] / 255.0, value[ 2 ] / 255.0 ];

							}

							if ( this.options && this.options.ignoreZeroRGBs ) {

								if ( value[ 0 ] === 0 && value[ 1 ] === 0 && value[ 2 ] === 0 ) {

									// ignore
									save = false;

								}

							}

							break;

						default:
							break;

					}

					if ( save ) {

						covmat[ lprop ] = value;

					}

				}

			}

			return converted;

		}

		preload() {

			for ( const mn in this.materialsInfo ) {

				this.create( mn );

			}

		}

		getIndex( materialName ) {

			return this.nameLookup[ materialName ];

		}

		getAsArray() {

			let index = 0;

			for ( const mn in this.materialsInfo ) {

				this.materialsArray[ index ] = this.create( mn );
				this.nameLookup[ mn ] = index;
				index ++;

			}

			return this.materialsArray;

		}

		create( materialName ) {

			if ( this.materials[ materialName ] === undefined ) {

				this.createMaterial_( materialName );

			}

			return this.materials[ materialName ];

		}

		createMaterial_( materialName ) {

			// Create material
			const scope = this;
			const mat = this.materialsInfo[ materialName ];
			const params = {
				name: materialName,
				side: this.side
			};

			function resolveURL( baseUrl, url ) {

				if ( typeof url !== 'string' || url === '' ) return ''; // Absolute URL

				if ( /^https?:\/\//i.test( url ) ) return url;
				return baseUrl + url;

			}

			function setMapForType( mapType, value ) {

				if ( params[ mapType ] ) return; // Keep the first encountered texture

				const texParams = scope.getTextureParams( value );
				const map = scope.loadTexture( resolveURL( scope.baseUrl, texParams.url ), null, materialName );
				map.repeat.copy( texParams.scale );
				map.offset.copy( texParams.offset );
				map.wrapS = scope.wrap;
				map.wrapT = scope.wrap;
				params[ mapType ] = map;

			}

			let use_phong = true;

			for ( const prop in mat ) {

				const value = mat[ prop ];
				let n;
				if ( value === '' ) continue;

				switch ( prop.toLowerCase() ) {

					// Ns is material specular exponent
					case 'kd':
						// Diffuse color (color under white light) using RGB values
						params.color = new THREE.Color().fromArray( value );
						break;

					case 'ks':
						// Specular color (color when light is reflected from shiny surface) using RGB values
						params.specular = new THREE.Color().fromArray( value );
						break;

					case 'ke':
						// Emissive using RGB values
						params.emissive = new THREE.Color().fromArray( value );
						break;
	
					case 'map_ka':
						// Ambient occlusion map
						setMapForType( 'aoMap', value );
						break;
		
					case 'map_kd':
						// Diffuse texture map
						setMapForType( 'map', value );
						break;

					case 'map_ks':
						// Specular map
						setMapForType( 'specularMap', value );
						break;

					case 'map_ke':
					case 'map_emissive':
						// Emissive map
						setMapForType( 'emissiveMap', value );
						break;

					case 'norm':
					case 'map_kn':
						setMapForType( 'normalMap', value );
						break;

					case 'bump':
					case 'map_bump':
						// Bump texture map
						setMapForType( 'bumpMap', value );
						break;

					case 'map_d':
						// Alpha map
						setMapForType( 'alphaMap', value );
						params.transparent = true;
						break;

					case 'disp':
					case 'map_disp':
						// Displacement map
						setMapForType( 'displacementMap', value );
						break;
		
					case 'pli':
						// Lightmap intensity
						params.lightMapIntensity = parseFloat( value );
						break;
		
					case 'pa':
						// Anisotropy
						params.anisotropy = parseFloat( value );
						use_phong = false;
						break;

					case 'par':
						// Anisotropy Rotation
						params.anisotropyRotation = parseFloat( value );
						use_phong = false;
						break;

					case 'pas':
						// Anisotropy Strength
						params.anisotropyStrength = parseFloat( value );
						use_phong = false;
						break;

					case 'patd':
						// Attenuation distance
						params.attenuationDistance = parseFloat( value );
						use_phong = false;
						break;
	
					case 'patc':
						// Attenuation color
						params.attenuationColor = new THREE.Color().fromArray( value );
						use_phong = false;
						break;
					
					case 'pm':
						// Metalness
						params.metalness = parseFloat( value );
						use_phong = false;
						break;

					case 'pr':
						// Roughness
						params.roughness = parseFloat( value );
						use_phong = false;
						break;

					case 'pns':
						// Normal Scale - how much the normal map affects the material
						params.normalScale = new THREE.Vector2().fromArray( value );
						use_phong = false;
						break;
	
					case 'disp_b':
						// Displacement bias
						params.displacementBias = parseFloat( value );
						break;

					case 'disp_s':
						// Displacement scale
						params.displacementScale = parseFloat( value );
						break;

					case 'pcc':
						// Clearcoat
						params.clearcoat = parseFloat( value );
						use_phong = false;
						break;

					case 'pccr':
						// Clearcoat roughness
						params.clearcoatRoughness = parseFloat( value );
						use_phong = false;
						break;

					case 'pccns':
						// Clearcoat normal scale
						params.clearcoatNormalScale = new THREE.Vector2().fromArray( value );
						use_phong = false;
						break;

					case 'pior':
						// Index-of-refraction for non-metallic materials
						params.ior = parseFloat( value );
						use_phong = false;
						break;

					case 'pir':
						// Iridescence
						params.iridescence = parseFloat( value );
						use_phong = false;
						break;

					case 'pirior':
						// Iridescence index-of-refraction
						params.iridescenceIOR = parseFloat( value );
						use_phong = false;
						break;

					case 'pirtr':
						// Iridescence thickness range
						params.iridescenceThicknessRange = new THREE.Vector2().fromArray( value );
						use_phong = false;
						break;

					case 'prfl':
						// Reflectivity
						params.reflectivity = parseFloat( value );
						break;
	
					case 'psh':
						// The intensity of the sheen layer
						params.sheen = parseFloat( value );
						use_phong = false;
						break;

					case 'pshc':
						// The sheen tint
						params.sheenColor = new THREE.Color().fromArray( value );
						use_phong = false;
						break;

					case 'pshr':
						// Roughness of the sheen layer
						params.sheenRoughness = parseFloat( value );
						use_phong = false;
						break;

					case 'psi':
						// Specular intensity
						params.specularIntensity = parseFloat( value );
						use_phong = false;
						break;

					case 'psc':
						// Specular color
						params.specularColor = new THREE.Color().fromArray( value );
						use_phong = false;
						break;

					case 'pth':
						// Thickness
						params.thickness = parseFloat( value );
						use_phong = false;
						break;

					case 'ptr':
						// Transmission
						params.transmission = parseFloat( value );
						use_phong = false;
						break;

					case 'map_pl':
						// Light map
						setMapForType( 'lightMap', value );
						break;

					case 'map_pa':
						// Anisotropy map
						setMapForType( 'anisotropyMap', value );
						use_phong = false;
						break;
	
					case 'map_pm':
						// Metalness map
						setMapForType( 'metalnessMap', value );
						use_phong = false;
						break;

					case 'map_pr':
						// Roughness map
						setMapForType( 'roughnessMap', value );
						use_phong = false;
						break;

					case 'map_pccm':
						// Clearcoat map
						setMapForType( 'clearcoatMap', value );
						use_phong = false;
						break;

					case 'map_pccnm':
						// Clearcoat normal map
						setMapForType( 'clearcoatNormalMap', value );
						use_phong = false;
						break;

					case 'map_pccrm':
						// Clearcoat roughness map
						setMapForType( 'clearcoatRoughnessMap', value );
						use_phong = false;
						break;

					case 'map_pirm':
						// Iridescence map
						setMapForType( 'iridescenceMap', value );
						use_phong = false;
						break;

					case 'map_pirthm':
						// Iridescence thickness map
						setMapForType( 'iridescenceThicknessMap', value );
						use_phong = false;
						break;
		
					case 'map_ps':
					case 'map_pshcm':
						// Sheen layer color map
						setMapForType( 'sheenColorMap', value );
						use_phong = false;
						break;

					case 'map_pshrm':
						// Sheen layer roughness map
						setMapForType( 'sheenRoughnessMap', value );
						use_phong = false;
						break;

					case 'map_psim':
						// Specular intensity map
						setMapForType( 'specularIntensityMap', value );
						use_phong = false;
						break;

					case 'map_pscm':
						// Specular color map
						setMapForType( 'specularColorMap', value );
						use_phong = false;
						break;

					case 'map_pthm':
						// Thickness map
						setMapForType( 'thicknessMap', value );
						use_phong = false;
						break;

					case 'map_ptrm':
						// Transmission map
						setMapForType( 'transmissionMap', value );
						use_phong = false;
						break;
									
					case 'ns':
						// The specular exponent (defines the focus of the specular highlight)
						// A high exponent results in a tight, concentrated highlight. Ns values normally range from 0 to 1000.
						params.shininess = parseFloat( value );
						break;

					case 'd':
						n = parseFloat( value );

						if ( n < 1 ) {

							params.opacity = n;
							params.transparent = true;

						}

						break;

					case 'tr':
						n = parseFloat( value );
						if ( this.options && this.options.invertTrProperty ) n = 1 - n;

						if ( n > 0 ) {

							params.opacity = 1 - n;
							params.transparent = true;

						}

						break;

					default:
						break;

				}

			}

			if ( use_phong === true ) {

				this.materials[ materialName ] = new THREE.MeshPhongMaterial( params );

			} else {

				if ( params.transmission && params.metalness === undefined ) {

					// if material roughness is not specified then override
					// the default value of 1.0 to allow transmission effect
					if ( params.roughness === undefined ) params.roughness = 0.0;

				}

				this.materials[ materialName ] = new THREE.MeshPhysicalMaterial( params );

			}

			return this.materials[ materialName ];

		}

		getTextureParams( value ) {

			const texParams = {
				scale: new THREE.Vector2( 1, 1 ),
				offset: new THREE.Vector2( 0, 0 )
			};
			const items = value.split( /\s+/ );
			let pos;
			pos = items.indexOf( '-bm' );

			if ( pos >= 0 ) {

				texParams.bumpScale = parseFloat( items[ pos + 1 ] );
				items.splice( pos, 2 );

			}

			pos = items.indexOf( '-s' );

			if ( pos >= 0 ) {

				texParams.scale.set( parseFloat( items[ pos + 1 ] ), parseFloat( items[ pos + 2 ] ) );
				items.splice( pos, 4 ); // we expect 3 parameters here!

			}

			pos = items.indexOf( '-o' );

			if ( pos >= 0 ) {

				texParams.offset.set( parseFloat( items[ pos + 1 ] ), parseFloat( items[ pos + 2 ] ) );
				items.splice( pos, 4 ); // we expect 3 parameters here!

			}

			texParams.url = items.join( ' ' ).trim();
			return texParams;

		}

		loadTexture( url, mapping, materialName, onLoad, onProgress, onError ) {

			const manager = this.manager !== undefined ? this.manager : THREE.DefaultLoadingManager;

			let ext = '';
			if (this.materialsInfo[ materialName ].ext) ext = this.materialsInfo[ materialName ].ext;

			let loader;

			if (ext !== '') {

				loader = manager.getHandler( ext );

			} else {

				loader = manager.getHandler( url );

			}

			if ( loader === null ) {

				loader = new THREE.TextureLoader( manager );

			}

			if ( loader.setCrossOrigin ) loader.setCrossOrigin( this.crossOrigin );
			const texture = loader.load( url, onLoad, onProgress, onError );
			if ( mapping !== undefined ) texture.mapping = mapping;
			if (ext === '.tga') { texture.generateMipmaps = true; texture.flipY = true; }
			return texture;

		}

	}

	THREE.MTLLoader = MTLLoader;

} )();
