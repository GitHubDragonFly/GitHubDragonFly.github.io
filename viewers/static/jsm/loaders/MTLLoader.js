import {
	Color,
	DefaultLoadingManager,
	FileLoader,
	FrontSide,
	Loader,
	LoaderUtils,
	MeshPhongMaterial,
	MeshPhysicalMaterial,
	RepeatWrapping,
	SRGBColorSpace,
	TextureLoader,
	Vector2
} from 'three';

/**
 * Loads a Wavefront .mtl file specifying materials
 */

class MTLLoader extends Loader {

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

		const path = ( this.path === '' ) ? LoaderUtils.extractUrlBase( url ) : this.path;

		const loader = new FileLoader( this.manager );
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

			if ( line.length === 0 || line.charAt( 0 ) === '#' ) {

				// Blank line or comment ignore
				continue;

			}

			const pos = line.indexOf( ' ' );

			let key = ( pos >= 0 ) ? line.substring( 0, pos ) : line;
			key = key.toLowerCase();

			let value = ( pos >= 0 ) ? line.substring( pos + 1 ) : '';
			value = value.trim();

			if ( key === 'newmtl' ) {

				// New material

				info = { name: value };
				materialsInfo[ value ] = info;

			} else {

				if ( key === 'ka' || key === 'kd' || key === 'ks' || key === 'ke' ) {

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
 *                        FrontSide (default), THREE.BackSide, THREE.DoubleSide
 *                  wrap: What type of wrapping to apply for textures
 *                        RepeatWrapping (default), THREE.ClampToEdgeWrapping, THREE.MirroredRepeatWrapping
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
		this.originalMaterialsInfo = {};
		this.materialsInfo = {};
		this.materials = {};
		this.materialsArray = [];
		this.nameLookup = {};

		this.crossOrigin = 'anonymous';

		this.side = ( this.options.side !== undefined ) ? this.options.side : FrontSide;
		this.wrap = ( this.options.wrap !== undefined ) ? this.options.wrap : RepeatWrapping;

	}

	setCrossOrigin( value ) {

		this.crossOrigin = value;
		return this;

	}

	setManager( value ) {

		this.manager = value;

	}

	setMaterials( materialsInfo ) {

		this.originalMaterialsInfo = materialsInfo;
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

						// Diffuse color (color under white light) using RGB values

						if ( this.options && this.options.normalizeRGB ) {

							value = [ value[ 0 ] / 255, value[ 1 ] / 255, value[ 2 ] / 255 ];

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
		const original_mat = this.originalMaterialsInfo[ materialName ];

		const params = {

			name: materialName,
			side: this.side

		};

		function resolveURL( baseUrl, url ) {

			if ( typeof url !== 'string' || url === '' )
				return '';

			// Absolute URL
			if ( /^https?:\/\//i.test( url ) ) return url;

			return baseUrl + url;

		}

		function setMapForType( mapType, value, prop ) {

			if ( params[ mapType ] ) return; // Keep the first encountered texture

			const texParams = scope.getTextureParams( original_mat[ prop ] );
			const map = scope.loadTexture( resolveURL( scope.baseUrl, value ) );

			map.repeat.copy( texParams.scale );
			map.offset.copy( texParams.offset );

			map.wrapS = texParams.wrapS; // map.wrapS = scope.wrap;
			map.wrapT = texParams.wrapT; // map.wrapT = scope.wrap;

			if ( mapType === 'map' || mapType === 'emissiveMap' ) {

				map.colorSpace = SRGBColorSpace;

			}

			params[ mapType ] = map;

		}

		let use_phong = true;
		let refraction_present = false;
		let refraction_value;
		let iridescenceThicknessRange = [ 100, 400 ];

		for ( const prop in mat ) {

			const value = mat[ prop ];
			let n;
			if ( value === '' ) continue;

			const lprop = prop.toLowerCase();

			switch ( lprop ) {

				// Ns is material specular exponent

				case 'ka':
					// Ambient occlusion map intensity
					params.aoMapIntensity = parseFloat( value[ 0 ] );
					break;

				case 'kd':
					// Diffuse color (color under white light) using RGB values
					params.color = new Color().fromArray( value );
					break;

				case 'ks':
					// Specular color (color when light is reflected from shiny surface) using RGB values
					params.specular = new Color().fromArray( value );
					break;

				case 'ke':
					// Emissive using RGB values
					params.emissive = new Color().fromArray( value );
					break;

				case 'map_ka':
					// Ambient occlusion map
					setMapForType( 'aoMap', value, lprop );
					break;

				case 'map_kd':
					// Diffuse texture map
					setMapForType( 'map', value, lprop );
					break;

				case 'map_ks':
					// Specular map
					setMapForType( 'specularMap', value, lprop );
					break;

				case 'map_ke':
				case 'map_emissive':
					// Emissive map
					setMapForType( 'emissiveMap', value, lprop );
					break;

				case 'norm':
				case 'map_kn':
					setMapForType( 'normalMap', value, lprop );
					break;

				case 'bump':
				case 'map_bump':
					// Bump texture map
					setMapForType( 'bumpMap', value, lprop );
					break;

				case 'map_d':
					// Alpha map
					setMapForType( 'alphaMap', value, lprop );
					params.transparent = true;
					break;

				case 'disp':
				case 'map_disp':
					// Displacement map
					setMapForType( 'displacementMap', value, lprop );
					break;

				case 'disp_b':
					// Displacement bias
					params.displacementBias = parseFloat( value );
					break;

				case 'disp_s':
					// Displacement scale
					params.displacementScale = parseFloat( value );
					break;

				case 'pli':
					// Lightmap intensity
					params.lightMapIntensity = parseFloat( value );
					break;

				case 'pa':
					// Anisotropy strength or factor
					params.anisotropy = parseFloat( value );
					use_phong = false;
					break;

				case 'par':
					// Anisotropy Rotation
					params.anisotropyRotation = parseFloat( value );
					use_phong = false;
					break;

				case 'pad':
					// Attenuation distance
					params.attenuationDistance = parseFloat( value );
					use_phong = false;
					break;

				case 'pac':
					// Attenuation color
					params.attenuationColor = new Color().fromArray( value.split( ' ' ).map( Number ) );
					use_phong = false;
					break;

				case 'pe':
					// Emissive Intensity (strength)
					params.emissiveIntensity = parseFloat( value );
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
					params.normalScale = new Vector2().fromArray( value.split( ' ' ).map( Number ) );
					break;

				case 'pcc':
					// Clearcoat
					params.clearcoat = parseFloat( value );
					use_phong = false;
					break;

				case 'pcr':
					// Clearcoat roughness
					params.clearcoatRoughness = parseFloat( value );
					use_phong = false;
					break;

				case 'pcn':
					// Clearcoat normal scale
					params.clearcoatNormalScale = new Vector2().fromArray( value.split( ' ' ).map( Number ) );
					use_phong = false;
					break;

				case 'ni':
					// Index-of-refraction for non-metallic materials
					refraction_present = true;
					refraction_value = parseFloat( value );
					break;

				case 'pi':
					// Iridescence
					params.iridescence = parseFloat( value );
					use_phong = false;
					break;

				case 'pii':
					// Iridescence index-of-refraction
					params.iridescenceIOR = parseFloat( value );
					use_phong = false;
					break;

				case 'pitx':
					// Iridescence thickness range x value
					iridescenceThicknessRange[ 0 ] = parseFloat( value );
					use_phong = false;
					break;

				case 'pity':
					// Iridescence thickness range y value
					iridescenceThicknessRange[ 1 ] = parseFloat( value );
					use_phong = false;
					break;

				case 'pbr_ps':
					// The intensity of the sheen layer
					params.sheen = parseFloat( value );
					use_phong = false;
					break;

				case 'ps':
					// The sheen tint (color)
					params.sheenColor = new Color().fromArray( value.split( ' ' ).map( Number ) );
					use_phong = false;
					break;

				case 'psr':
					// Roughness of the sheen layer
					params.sheenRoughness = parseFloat( value );
					use_phong = false;
					break;

				case 'psp':
					// PBR material specular color
					params.specularColor = new Color().fromArray( value.split( ' ' ).map( Number ) );
					use_phong = false;
					break;

				case 'psi':
					// PBR material specular intensity
					params.specularIntensity = parseFloat( value );
					use_phong = false;
					break;

				case 'pth':
					// PBR material thickness
					params.thickness = parseFloat( value );
					use_phong = false;
					break;

				case 'ptr':
					// PBR material transmission
					params.transmission = parseFloat( value );
					use_phong = false;
					break;

				case 's':
					// Material side
					params.side = parseInt( value );
					break;

				case 'a':
					// Material alphaTest
					params.alphaTest = parseFloat( value );
					break;

				case 'prf':
					// Reflectivity
					params.reflectivity = parseFloat( value );
					break;

				case 'pbr_pl_map':
					// Light map
					setMapForType( 'lightMap', value, lprop );
					break;

				case 'map_pa':
					// Anisotropy map
					setMapForType( 'anisotropyMap', value, lprop );
					use_phong = false;
					break;

				case 'map_pm':
					// Metalness map
					setMapForType( 'metalnessMap', value, lprop );
					use_phong = false;
					break;

				case 'map_pr':
					// Roughness map
					setMapForType( 'roughnessMap', value, lprop );
					use_phong = false;
					break;

				case 'map_px':
					// RMA map
					setMapForType( 'metalnessMap', value, lprop );
					setMapForType( 'roughnessMap', value, lprop );
					use_phong = false;
					break;

				case 'map_pcc':
					// Clearcoat map
					setMapForType( 'clearcoatMap', value, lprop );
					use_phong = false;
					break;

				case 'map_pcn':
					// Clearcoat normal map
					setMapForType( 'clearcoatNormalMap', value, lprop );
					use_phong = false;
					break;

				case 'map_pcr':
					// Clearcoat roughness map
					setMapForType( 'clearcoatRoughnessMap', value, lprop );
					use_phong = false;
					break;

				case 'map_pit':
					// Iridescence thickness map
					setMapForType( 'iridescenceThicknessMap', value, lprop );
					use_phong = false;
					break;

				case 'map_pi':
					// Iridescence map
					setMapForType( 'iridescenceMap', value, lprop );
					use_phong = false;
					break;

				case 'map_psc':
					// PBR sheen layer color map
					setMapForType( 'sheenColorMap', value, lprop );
					use_phong = false;
					break;

				case 'map_psr':
					// PBR sheen layer roughness map
					setMapForType( 'sheenRoughnessMap', value, lprop );
					use_phong = false;
					break;

				case 'map_psp':
					// PBR specular color map
					setMapForType( 'specularColorMap', value, lprop );
					use_phong = false;
					break;

				case 'map_psi':
					// PBR specular intensity map
					setMapForType( 'specularIntensityMap', value, lprop );
					use_phong = false;
					break;

				case 'map_pth':
					// PBR thickness map
					setMapForType( 'thicknessMap', value, lprop );
					use_phong = false;
					break;

				case 'map_ptr':
					// PBR transmission map
					setMapForType( 'transmissionMap', value, lprop );
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

			if ( refraction_present === true ) params.refractionRatio = refraction_value;
			this.materials[ materialName ] = new MeshPhongMaterial( params );

		} else {

			if ( refraction_present === true ) params.ior = refraction_value;
			if ( params.iridescence ) params.iridescenceThicknessRange = iridescenceThicknessRange;

			// Check params to allow correct transmission effect

			if ( params.transmission && params.transmission > 0 ) {

				if ( params.metalnessMap !== undefined && params.metalness === undefined ) {

					params.metalness = 0.01;

				}

				if ( params.roughnessMap !== undefined && params.roughness === undefined ) {

					params.roughness = 0.01;

				}

				if ( params.metalnessMap === undefined && params.roughnessMap === undefined ) {

					if ( params.metalness === undefined && ( params.roughness === undefined || params.roughness === 1.0 ) ) {

						params.roughness = 0.01;

					}

				}

			}

			this.materials[ materialName ] = new MeshPhysicalMaterial( params );

		}

		return this.materials[ materialName ];

	}

	getTextureParams( value ) {

		const texParams = {

			scale: new Vector2( 1, 1 ),
			offset: new Vector2( 0, 0 ),
			wrapS: RepeatWrapping,
			wrapT: RepeatWrapping

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
			items.splice( pos, 4 ); // we expect 4 parameters here!

		}

		pos = items.indexOf( '-o' );

		if ( pos >= 0 ) {

			texParams.offset.set( parseFloat( items[ pos + 1 ] ), parseFloat( items[ pos + 2 ] ) );
			items.splice( pos, 4 ); // we expect 4 parameters here!

		}

		pos = items.indexOf( '-w' );

		if ( pos >= 0 ) {

			texParams.wrapS = Number( items[ pos + 1 ] );
			texParams.wrapT = Number( items[ pos + 2 ] );
			items.splice( pos, 3 ); // we expect 3 parameters here!

		}

		return texParams;

	}

	loadTexture( url, mapping, onLoad, onProgress, onError ) {

		const manager = ( this.manager !== undefined ) ? this.manager : DefaultLoadingManager;
		let loader = manager.getHandler( url );

		if ( loader === null ) {

			loader = new TextureLoader( manager );

		}

		if ( loader.setCrossOrigin ) loader.setCrossOrigin( this.crossOrigin );

		const texture = loader.load( url, onLoad, onProgress, onError );

		if ( mapping !== undefined ) texture.mapping = mapping;

		return texture;

	}

}

export { MTLLoader };
