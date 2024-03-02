import {
	BufferAttribute,
	BufferGeometryLoader,
	CanvasTexture,
	ClampToEdgeWrapping,
	Color,
	DirectionalLight,
	DoubleSide,
	FileLoader,
	LinearFilter,
	Line,
	LineBasicMaterial,
	Loader,
	Matrix4,
	Mesh,
	MeshPhysicalMaterial,
	MeshStandardMaterial,
	Object3D,
	PointLight,
	Points,
	PointsMaterial,
	RectAreaLight,
	RepeatWrapping,
	SpotLight,
	Sprite,
	SpriteMaterial,
	TextureLoader,
	Vector2
} from "three";

import { EXRLoader } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/EXRLoader.js";

const _taskCache = new WeakMap();

class Rhino3dmLoader extends Loader {

	constructor( manager ) {

		super( manager );

		this.libraryPath = '';
		this.libraryPending = null;
		this.libraryBinary = null;
		this.libraryConfig = {};

		this.url = '';

		this.workerLimit = 4;
		this.workerPool = [];
		this.workerNextTaskID = 1;
		this.workerSourceURL = '';
		this.workerConfig = {};

		this.materials = [];
		this.warnings = [];

		this.materialArray = [];
		this.lastIndex = 0;

	}

	setLibraryPath( path ) {

		this.libraryPath = path;

		return this;

	}

	setWorkerLimit( workerLimit ) {

		this.workerLimit = workerLimit;

		return this;

	}

	load( url, onLoad, onProgress, onError ) {

		const loader = new FileLoader( this.manager );

		loader.setPath( this.path );
		loader.setResponseType( 'arraybuffer' );
		loader.setRequestHeader( this.requestHeader );

		this.url = url;

		loader.load( url, ( buffer ) => {

			// Check for an existing task using this buffer. A transferred buffer cannot be transferred
			// again from this thread.
			if ( _taskCache.has( buffer ) ) {

				const cachedTask = _taskCache.get( buffer );

				return cachedTask.promise.then( onLoad ).catch( onError );

			}

			this.decodeObjects( buffer, url )
				.then( result => {

					result.userData.warnings = this.warnings;
					onLoad( result );

				 } )
				.catch( e => {

					if ( onError ) {

						onError( e );

					} else {

						throw new Error( 'THREE.Rhino3dmLoader: Error decoding objects!\n' + e );

					}

				} );

		}, onProgress, onError );

	}

	debug() {

		console.log( 'Task load: ', this.workerPool.map( ( worker ) => worker._taskLoad ) );

	}

	decodeObjects( buffer, url ) {

		let worker;
		let taskID;

		const taskCost = buffer.byteLength;

		const objectPending = this._getWorker( taskCost )
			.then( ( _worker ) => {

				worker = _worker;
				taskID = this.workerNextTaskID ++;

				return new Promise( ( resolve, reject ) => {

					worker._callbacks[ taskID ] = { resolve, reject };

					worker.postMessage( { type: 'decode', id: taskID, buffer }, [ buffer ] );

					// this.debug();

				} );

			} )
			.then( ( message ) => this._createGeometry( message.data ) )
			.catch( e => {

				throw e;

			} );

		// Remove task from the task list.
		// Note: replaced '.finally()' with '.catch().then()' block - iOS 11 support (#19416)

		objectPending
			.catch( () => true )
			.then( () => {

				if ( worker && taskID ) {

					this._releaseTask( worker, taskID );

					//this.debug();

				}

			} );

		// Cache the task result.

		_taskCache.set( buffer, {

			url: url,
			promise: objectPending

		} );

		return objectPending;

	}

	parse( data, onLoad, onError ) {

		this.decodeObjects( data, '' )
			.then( result => {

				result.userData.warnings = this.warnings;
				onLoad( result );

			} )
			.catch( e => onError( e ) );

	}

	_compareMaterials( material ) {

		const mat = {};
		mat.name = material.name;
		mat.color = {};

		if ( material.color.r > 1 || material.color.g > 1 || material.color.b > 1 ) {
			mat.color.r = material.color.r / 255.0;
			mat.color.g = material.color.g / 255.0;
			mat.color.b = material.color.b / 255.0;
		} else {
			mat.color.r = material.color.r;
			mat.color.g = material.color.g;
			mat.color.b = material.color.b;
		}

		mat.type = material.type;
		mat.vertexColors = material.vertexColors;

		const json = JSON.stringify( mat );

		for ( let i = 0; i < this.materials.length; i ++ ) {

			const m = this.materials[ i ];
			const _mat = {};
			_mat.name = m.name;
			_mat.color = {};

			if ( m.color.r > 1 || m.color.g > 1 || m.color.b > 1 ) {
				_mat.color.r = m.color.r / 255.0;
				_mat.color.g = m.color.g / 255.0;
				_mat.color.b = m.color.b / 255.0;
			} else {
				_mat.color.r = m.color.r;
				_mat.color.g = m.color.g;
				_mat.color.b = m.color.b;
			}

			_mat.type = m.type;
			_mat.vertexColors = m.vertexColors;

			if ( JSON.stringify( _mat ) === json ) {

				return m;

			}

		}

		this.materials.push( material );

		return material;

	}

	_createMaterial( material, renderEnvironment, attributes, images ) {

		if ( ! material ) {

			return new MeshStandardMaterial( {
				color: new Color( 1, 1, 1 ),
				name: Loader.DEFAULT_MATERIAL_NAME,
				side: DoubleSide,
				metalness: 0.8
			} );

		}

		let diffuse_color, emissive_color, specular_color;

		if ( material.diffuseColor.r > 1 || material.diffuseColor.g > 1 || material.diffuseColor.b > 1 ) {
			diffuse_color = new Color(
				material.diffuseColor.r / 255.0,
				material.diffuseColor.g / 255.0,
				material.diffuseColor.b / 255.0 );
		} else {
			diffuse_color = new Color( material.diffuseColor.r, material.diffuseColor.g, material.diffuseColor.b );
		}

		if ( material.emissionColor.r > 1 || material.emissionColor.g > 1 || material.emissionColor.b > 1 ) {
			emissive_color = new Color(
				material.emissionColor.r / 255.0,
				material.emissionColor.g / 255.0,
				material.emissionColor.b / 255.0 );
		} else {
			emissive_color = new Color( material.emissionColor.r, material.emissionColor.g, material.emissionColor.b );
		}

		if ( material.specularColor.r > 1 || material.specularColor.g > 1 || material.specularColor.b > 1 ) {
			specular_color = new Color(
				material.specularColor.r / 255.0,
				material.specularColor.g / 255.0,
				material.specularColor.b / 255.0 );
		} else {
			specular_color = new Color( material.specularColor.r, material.specularColor.g, material.specularColor.b );
		}

		const mat = new MeshPhysicalMaterial( {

			color: diffuse_color,
			emissive: emissive_color,
			flatShading: material.disableLighting,
			ior: material.indexOfRefraction,
			name: material.name,
			reflectivity: material.reflectivity,
			opacity: 1.0 - material.transparency,
			specularColor: specular_color,
			transparent: material.transparency > 0 ? true : false

		} );

		mat.userData.id = material.id;

		if ( material.pbrSupported ) {

			const pbr = material.pbr;

			mat.anisotropy = pbr.anisotropic;
			mat.anisotropyRotation = pbr.anisotropicRotation;

			if ( pbr.baseColor.r > 1 || pbr.baseColor.g > 1 || pbr.baseColor.b > 1 ) {
				mat.color = new Color(
					pbr.baseColor.r / 255.0,
					pbr.baseColor.g / 255.0,
					pbr.baseColor.b / 255.0 );
			} else {
				mat.color = new Color( pbr.baseColor.r, pbr.baseColor.g, pbr.baseColor.b );
			}

			mat.clearcoat = pbr.clearcoat;
			mat.clearcoatRoughness = pbr.clearcoatRoughness;
			mat.metalness = pbr.metallic;
			mat.transmission = 1 - pbr.opacity;
			mat.roughness = pbr.roughness;
			mat.sheen = pbr.sheen;
			mat.specularIntensity = pbr.specular;
			mat.thickness = pbr.subsurface;

			// thickness value currently appears to need a certain correction depending on the transmission and its own value
			// this workaround just brings the look of all Khronos examples with thickness rather close to GLTF Viewer's
			// not sure why this would be required in the first place

			if ( mat.thickness && mat.thickness > 0 ) {

				if ( mat.transmission && mat.transmission > 0 ) {

					if ( mat.thickness < 1 ) {

						mat.thickness *= 140;

					} else {

						mat.thickness *= 11;

					}

				} else {

					if ( mat.thickness < 1 ) {

						mat.thickness *= 210;

					} else {

						mat.thickness *= 17;

					}

				}

			}

		}

		if ( material.pbrSupported && material.pbr.opacity === 0 && material.transparency === 1 ) {

			// some compromises

			mat.opacity = 0.2;
			mat.transmission = 1.00;

		}

		// workaround - set additional material params and textures passed via user strings

		if ( attributes.userStrings && attributes.userStrings.some( item => item[ 0 ] === 'params_' + material.id ) ) {

			for ( const item of attributes.userStrings ) {

				if ( item[ 0 ] === 'params_' + material.id ) {

					let params = JSON.parse( item[ 1 ] );

					if ( params.isArrayMember ) {

						if ( ! mat.userStrings ) mat.userStrings = {};
						mat.userStrings.isArrayMember = true;

					}

					mat.side = params.side;

					if ( params.alphaTest !== undefined ) mat.alphaTest = params.alphaTest;
					if ( params.bumpScale !== undefined ) mat.bumpScale = params.bumpScale;
					if ( params.normalMapType !== undefined ) mat.normalMapType = params.normalMapType;
					if ( params.emissiveIntensity !== undefined ) mat.emissiveIntensity = params.emissiveIntensity;

					if ( params.normalScaleX !== undefined ) mat.normalScale.x = params.normalScaleX;
					if ( params.normalScaleY !== undefined ) mat.normalScale.y = params.normalScaleY;

					if ( params.clearcoatNormalScaleX !== undefined ) mat.clearcoatNormalScale.x = params.clearcoatNormalScaleX;
					if ( params.clearcoatNormalScaleY !== undefined ) mat.clearcoatNormalScale.y = params.clearcoatNormalScaleY;

					if ( params.iridescence !== undefined ) mat.iridescence = params.iridescence;
					if ( params.iridescenceIOR !== undefined ) mat.iridescenceIOR = params.iridescenceIOR;
					if ( params.iridescenceThicknessRangeX !== undefined ) mat.iridescenceThicknessRange[ 0 ] = params.iridescenceThicknessRangeX;
					if ( params.iridescenceThicknessRangeY !== undefined ) mat.iridescenceThicknessRange[ 1 ] = params.iridescenceThicknessRangeY;

					if ( params.sheenRoughness !== undefined ) mat.sheenRoughness = params.sheenRoughness;

					if ( params.sheenColorR !== undefined && params.sheenColorG !== undefined && params.sheenColorB !== undefined ) {

						if ( params.sheenColorR > 1 || params.sheenColorG > 1 || params.sheenColorB > 1 ) {

							mat.sheenColor = new Color(
								params.sheenColorR / 255.0,
								params.sheenColorG / 255.0,
								params.sheenColorB / 255.0
							);

						} else {

							mat.sheenColor = new Color( params.sheenColorR, params.sheenColorG, params.sheenColorB );

						}

					}

					if ( params.attenuationDistance !== undefined )
						mat.attenuationDistance = params.attenuationDistance;

					if ( params.attenuationColorR !== undefined && params.attenuationColorG !== undefined && params.attenuationColorB !== undefined ) {

						if ( params.attenuationColorR > 1 || params.attenuationColorG > 1 || params.attenuationColorB > 1 ) {

							mat.attenuationColor = new Color(
								params.attenuationColorR / 255.0,
								params.attenuationColorG / 255.0,
								params.attenuationColorB / 255.0
							);

						} else {

							mat.attenuationColor = new Color(
								params.attenuationColorR,
								params.attenuationColorG,
								params.attenuationColorB
							);

						}

					}

				}

			}

		}

		const textureLoader = new TextureLoader();

		if ( attributes.userStrings && attributes.userStrings.some( item => item[ 0 ].startsWith( material.id ) ) ) {

			for ( const item1 of attributes.userStrings ) {

				let texture, img;

				if ( item1[ 0 ].startsWith( material.id ) ) {

					texture = JSON.parse( item1[ 1 ] );
					if ( images && images[ texture.uuid ] ) img = images[ texture.uuid ];

				} else {

					continue;

				}

				if ( img !== undefined ) {

					const map = textureLoader.load( img );
					map.name = texture.type;

					switch ( texture.type ) {

						case 'Bump':

							mat.bumpMap = map;

							break;

						case 'Diffuse':

							mat.map = map;

							break;

						case 'Emap':

							mat.envMap = map;

							break;

						case 'Opacity':

							mat.transmissionMap = map;

							break;

						case 'Transparency':

							mat.alphaMap = map;
							mat.transparent = true;

							break;

						case 'PBR_Alpha':

							mat.alphaMap = map;
							mat.transparent = true;

							break;

						case 'PBR_AmbientOcclusion':

							mat.aoMap = map;

							break;

						case 'PBR_Anisotropic':

							mat.anisotropyMap = map;

							break;

						case 'PBR_BaseColor':

							mat.map = map;

							break;

						case 'PBR_Clearcoat':

							mat.clearcoatMap = map;

							break;

						case 'PBR_ClearcoatBump':

							mat.clearcoatNormalMap = map;

							break;

						case 'PBR_ClearcoatRoughness':

							mat.clearcoatRoughnessMap = map;

							break;

						case 'PBR_Displacement':

							mat.displacementMap = map;

							break;

						case 'PBR_Emission':

							mat.emissiveMap = map;

							break;

						case 'PBR_Metallic':

							mat.metalnessMap = map;

							break;

						case 'PBR_Roughness':

							mat.roughnessMap = map;

							break;

						case 'PBR_Sheen':

							mat.sheenColorMap = map;

							break;

						case 'PBR_Specular':

							mat.specularColorMap = map;

							break;

						case 'PBR_Subsurface':

							mat.thicknessMap = map;

							break;

						case 'PBR_Other_Anisotropy':

							mat.anisotropyMap = map;

							break;

						case 'PBR_Other_Iridescence':

							mat.iridescenceMap = map;

							break;

						case 'PBR_Other_IridescenceThickness':

							mat.iridescenceThicknessMap = map;

							break;

						case 'PBR_Other_Normal':

							mat.normalMap = map;

							break;

						case 'PBR_Other_SheenColor':

							mat.sheenColorMap = map;

							break;

						case 'PBR_Other_SheenRoughness':

							mat.sheenRoughnessMap = map;

							break;

						case 'PBR_Other_SpecularIntensity':

							mat.specularIntensityMap = map;

							break;

						default:

							this.warnings.push( {
								message: `THREE.3DMLoader: No conversion exists for 3dm ${texture.type}.`,
								type: 'no conversion'
							} );

							break;

					}

					if ( texture.flipY !== undefined ) map.flipY = texture.flipY;
					if ( texture.mapping !== undefined ) map.mapping = texture.mapping;
					if ( texture.minFilter !== undefined ) map.minFilter = texture.minFilter;
					if ( texture.magFilter !== undefined ) map.magFilter = texture.magFilter;
					if ( texture.rotation !== undefined ) map.rotation = texture.rotation;

					if ( texture.wrapU !== undefined ) map.wrapS = texture.wrapU === 0 ? RepeatWrapping : ClampToEdgeWrapping;
					if ( texture.wrapV !== undefined ) map.wrapT = texture.wrapV === 0 ? RepeatWrapping : ClampToEdgeWrapping;

					if ( texture.offset !== undefined ) {

						map.offset = new Vector2( texture.offset.x, texture.offset.y );

					}

					if ( texture.repeat !== undefined ) {

						map.repeat = new Vector2( texture.repeat.x, texture.repeat.y );

					}

				}

			}

			// check material settings to allow for correct transmission effect

			if ( mat.transmission && mat.transmission > 0 ) {

				if ( mat.metalnessMap !== undefined && mat.metalness === undefined ) {

					mat.metalness = 0.01;

				}

				if ( mat.roughnessMap !== undefined && mat.roughness === undefined ) {

					mat.roughness = 0.01;

				}

				if ( mat.roughnessMap !== undefined && mat.roughness === 1 ) {

					mat.roughness = 0.95;

				}

				if ( mat.metalnessMap === undefined && mat.roughnessMap === undefined ) {

					if ( mat.metalness === undefined && ( mat.roughness === undefined || mat.roughness === 1.0 ) ) {

						mat.roughness = 0.01;

					}

				}

			}

		} else {

			for ( let i = 0; i < material.textures.length; i ++ ) {

				const texture = material.textures[ i ];

				if ( texture.image !== null ) {

					const map = textureLoader.load( texture.image );

					switch ( texture.type ) {

						case 'Bump':

							mat.bumpMap = map;

							break;

						case 'Diffuse':

							mat.map = map;

							break;

						case 'Emap':

							mat.envMap = map;

							break;

						case 'Opacity':

							mat.transmissionMap = map;

							break;

						case 'Transparency':

							mat.alphaMap = map;
							mat.transparent = true;

							break;

						case 'PBR_Alpha':

							mat.alphaMap = map;
							mat.transparent = true;

							break;

						case 'PBR_AmbientOcclusion':

							mat.aoMap = map;

							break;

						case 'PBR_Anisotropic':

							mat.anisotropyMap = map;

							break;

						case 'PBR_BaseColor':

							mat.map = map;

							break;

						case 'PBR_Clearcoat':

							mat.clearcoatMap = map;

							break;

						case 'PBR_ClearcoatBump':

							mat.clearcoatNormalMap = map;

							break;

						case 'PBR_ClearcoatRoughness':

							mat.clearcoatRoughnessMap = map;

							break;

						case 'PBR_Displacement':

							mat.displacementMap = map;

							break;

						case 'PBR_Emission':

							mat.emissiveMap = map;

							break;

						case 'PBR_Metallic':

							mat.metalnessMap = map;

							break;

						case 'PBR_Roughness':

							mat.roughnessMap = map;

							break;

						case 'PBR_Sheen':

							mat.sheenColorMap = map;

							break;

						case 'PBR_Specular':

							mat.specularColorMap = map;

							break;

						case 'PBR_Subsurface':

							mat.thicknessMap = map;

							break;

						default:

							this.warnings.push( {
								message: `THREE.3DMLoader: No conversion exists for 3dm ${texture.type}.`,
								type: 'no conversion'
							} );

							break;

					}

					if ( texture.flipY !== undefined ) map.flipY = texture.flipY;
					if ( texture.mapping !== undefined ) map.mapping = texture.mapping;
					if ( texture.minFilter !== undefined ) map.minFilter = texture.minFilter;
					if ( texture.magFilter !== undefined ) map.magFilter = texture.magFilter;
					if ( texture.rotation !== undefined ) map.rotation = texture.rotation;

					if ( texture.wrapU !== undefined ) map.wrapS = texture.wrapU === 0 ? RepeatWrapping : ClampToEdgeWrapping;
					if ( texture.wrapV !== undefined ) map.wrapT = texture.wrapV === 0 ? RepeatWrapping : ClampToEdgeWrapping;

					if ( texture.offset !== undefined ) {

						map.offset.set( texture.offset.x, texture.offset.y );

					}

					if ( texture.repeat !== undefined ) {

						map.repeat.set( texture.repeat.x, texture.repeat.y );

					}

				}

			}

		}

		if ( renderEnvironment ) {

			new EXRLoader().load( renderEnvironment.image, function ( texture ) {

				texture.mapping = THREE.EquirectangularReflectionMapping;
				mat.envMap = texture;

			} );

		}

		return mat;

	}

	_createGeometry( data ) {

		const object = new Object3D();
		const instanceDefinitionObjects = [];
		const instanceDefinitions = [];
		const instanceReferences = [];

		object.userData[ 'strings' ] = data.strings;
		object.userData[ 'layers' ] = data.layers;
		object.userData[ 'groups' ] = data.groups;
		object.userData[ 'settings' ] = data.settings;
		object.userData.settings[ 'renderSettings' ] = data.renderSettings;
		object.userData[ 'objectType' ] = 'File3dm';
		object.userData[ 'materials' ] = null;

		object.name = this.url;

		let objects = data.objects;

		// workaround - material params and textures passed via user strings

		const strings = data.strings;

		const images = {};

		if ( strings && strings.length > 0 ) {

			for ( const str of strings ) {

				images[ str[ 0 ] ] = str[ 1 ];

			}

		}

		const materials = data.materials;

		for ( let i = 0; i < objects.length; i ++ ) {

			const obj = objects[ i ];
			const attributes = obj.attributes;

			switch ( obj.objectType ) {

				case 'InstanceDefinition':

					instanceDefinitions.push( obj );

					break;

				case 'InstanceReference':

					instanceReferences.push( obj );

					break;

				default:

					let matId = null;

					switch ( attributes.materialSource.name ) {

						case 'ObjectMaterialSource_MaterialFromLayer':

							//check layer index

							if ( attributes.layerIndex >= 0 ) {

								matId = data.layers[ attributes.layerIndex ].renderMaterialIndex;

							}

							break;

						case 'ObjectMaterialSource_MaterialFromObject':

							if ( attributes.materialIndex >= 0 ) {

								matId = attributes.materialIndex;

							}

							break;

					}

					let material = null;

					if ( matId >= 0 ) {

						const rMaterial = materials[ matId ];
						material = this._createMaterial( rMaterial, data.renderEnvironment, attributes, images );

					}

					const _object = this._createObject( obj, material, materials, data.renderEnvironment, images );

					if ( _object === undefined ) {

						continue;

					}

					const layer = data.layers[ attributes.layerIndex ];

					_object.visible = layer ? data.layers[ attributes.layerIndex ].visible : true;

					if ( attributes.isInstanceDefinitionObject ) {

						instanceDefinitionObjects.push( _object );

					} else {

						object.add( _object );

					}

					break;

			}

		}

		for ( let i = 0; i < instanceDefinitions.length; i ++ ) {

			const iDef = instanceDefinitions[ i ];

			objects = [];

			for ( let j = 0; j < iDef.attributes.objectIds.length; j ++ ) {

				const objId = iDef.attributes.objectIds[ j ];

				for ( let p = 0; p < instanceDefinitionObjects.length; p ++ ) {

					const idoId = instanceDefinitionObjects[ p ].userData.attributes.id;

					if ( objId === idoId ) {

						objects.push( instanceDefinitionObjects[ p ] );

					}

				}

			}

			// Currently clones geometry and does not take advantage of instancing

			for ( let j = 0; j < instanceReferences.length; j ++ ) {

				const iRef = instanceReferences[ j ];

				if ( iRef.geometry.parentIdefId === iDef.attributes.id ) {

					const iRefObject = new Object3D();
					const xf = iRef.geometry.xform.array;

					const matrix = new Matrix4();
					matrix.set( ...xf );

					iRefObject.applyMatrix4( matrix );

					for ( let p = 0; p < objects.length; p ++ ) {

						iRefObject.add( objects[ p ].clone( true ) );

					}

					object.add( iRefObject );

				}

			}

		}

		object.userData[ 'materials' ] = this.materials;
		object.name = '';
		return object;

	}

	_createObject( obj, mat, materials, renderEnvironment, images ) {

		this.materialArray = [];

		const loader = new BufferGeometryLoader();

		const attributes = obj.attributes;

		let geometry, material, _color, color;
		let vertexColors = false;

		switch ( obj.objectType ) {

			case 'Point':
			case 'PointSet':

				geometry = loader.parse( obj.geometry );

				if ( geometry.attributes.hasOwnProperty( 'color' ) ) {

					material = new PointsMaterial( { vertexColors: true, sizeAttenuation: false, size: 2 } );

				} else {

					_color = attributes.plotColor;

					if ( _color.r > 1 || _color.g > 1 || _color.b > 1 ) {
						color = new Color(
							_color.r / 255.0,
							_color.g / 255.0,
							_color.b / 255.0 );
					} else {
						color = new Color( _color.r, _color.g, _color.b );
					}

					material = new PointsMaterial( { vertexColors: false, color: color, sizeAttenuation: false, size: 2 } );

				}

				material = this._compareMaterials( material );

				const points = new Points( geometry, material );
				points.userData[ 'attributes' ] = attributes;
				points.userData[ 'objectType' ] = obj.objectType;

				if ( attributes.name ) {

					points.name = attributes.name;

				}

				return points;

			case 'Mesh':
			case 'Extrusion':
			case 'SubD':
			case 'Brep':

				if ( obj.geometry === null ) return;

				geometry = loader.parse( obj.geometry );

				// With the current design, if geometry has groups then
				// the geometry_groups entry should be the first item in
				// the array and followed by all object's materials

				if ( attributes.userStrings && attributes.userStrings[ 0 ][ 0 ] === 'geometry_groups' ) {

					geometry.groups = JSON.parse( attributes.userStrings[ 0 ][ 1 ] );

				}

				if ( mat === null ) {

					mat = this._createMaterial();

				}

				if ( geometry.attributes.hasOwnProperty( 'color' ) ) {

					vertexColors = true;

				}

				if ( mat.userStrings && mat.userStrings.isArrayMember ) {

					// Redo material as an array from attributes materials

					if ( attributes.userStrings ) {

						if ( geometry.groups ) {

							for ( const group of geometry.groups ) {

								let new_material = this._createMaterial( materials[ this.lastIndex + group.materialIndex ], renderEnvironment, attributes, images );
								new_material.vertexColors = vertexColors;
								this.materialArray.push( new_material );

							}

							this.lastIndex += geometry.groups.length;

						} else {

							for ( let i = 0; i < attributes.userStrings.length; i++ ) {

								let new_material = this._createMaterial( materials[ i ], renderEnvironment, attributes, images );
								new_material.vertexColors = vertexColors;
								this.materialArray.push( new_material );

							}

						}

					}

				} else {

					mat.vertexColors = vertexColors;
					mat = this._compareMaterials( mat );

				}

				const mesh = this.materialArray.length > 0 ? new Mesh( geometry, this.materialArray ) : new Mesh( geometry, mat );

				mesh.castShadow = attributes.castsShadows;
				mesh.receiveShadow = attributes.receivesShadows;
				mesh.userData[ 'attributes' ] = attributes;
				mesh.userData[ 'objectType' ] = obj.objectType;

				if ( attributes.name ) {

					mesh.name = attributes.name;

				}

				return mesh;

			case 'Curve':

				geometry = loader.parse( obj.geometry );

				// Check if LineSegments vertex colors have been passed as a user string

				if ( attributes.userStrings && attributes.userStrings.some( item => item[ 0 ] === 'colors' ) ) {

					for ( const arr of attributes.userStrings ) {

						if ( arr[ 0 ] === 'colors' ) {

							const color_array = arr[ 1 ].split( ',' ).map( Number );

							for ( let i = 0; i < color_array.length; i += 3 ) {

								color = new Color(
									color_array[ i ] / 255.0,
									color_array[ i + 1 ] / 255.0,
									color_array[ i + 2 ] / 255.0
								);

								color_array[ i ] = color.r;
								color_array[ i + 1 ] = color.g;
								color_array[ i + 2 ] = color.b;

							}

							vertexColors = true;
							geometry.setAttribute( 'color', new BufferAttribute( new Float32Array( color_array ), 3, false ) );

						}

					}

				}

				_color = attributes.plotColor;

				if ( _color.r > 1 || _color.g > 1 || _color.b > 1 ) {
					color = new Color(
						_color.r / 255.0,
						_color.g / 255.0,
						_color.b / 255.0 );
				} else {
					color = new Color( _color.r, _color.g, _color.b );
				}

				material = new LineBasicMaterial( { color: color, vertexColors: vertexColors } );
				material = this._compareMaterials( material );

				const lines = new Line( geometry, material );
				lines.userData[ 'attributes' ] = attributes;
				lines.userData[ 'objectType' ] = obj.objectType;

				if ( attributes.name ) {

					lines.name = attributes.name;

				}

				return lines;

			case 'TextDot':

				geometry = obj.geometry;

				const ctx = document.createElement( 'canvas' ).getContext( '2d' );
				const font = `${geometry.fontHeight}px ${geometry.fontFace}`;
				ctx.font = font;
				const width = ctx.measureText( geometry.text ).width + 10;
				const height = geometry.fontHeight + 10;

				const r = window.devicePixelRatio;

				ctx.canvas.width = width * r;
				ctx.canvas.height = height * r;
				ctx.canvas.style.width = width + 'px';
				ctx.canvas.style.height = height + 'px';
				ctx.setTransform( r, 0, 0, r, 0, 0 );

				ctx.font = font;
				ctx.textBaseline = 'middle';
				ctx.textAlign = 'center';
				color = attributes.plotColor;
				ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${color.a})`;
				ctx.fillRect( 0, 0, width, height );
				ctx.fillStyle = 'white';
				ctx.fillText( geometry.text, width / 2, height / 2 );

				const texture = new CanvasTexture( ctx.canvas );
				texture.minFilter = LinearFilter;
				texture.wrapS = ClampToEdgeWrapping;
				texture.wrapT = ClampToEdgeWrapping;

				material = new SpriteMaterial( { map: texture, depthTest: false } );
				const sprite = new Sprite( material );
				sprite.position.set( geometry.point[ 0 ], geometry.point[ 1 ], geometry.point[ 2 ] );
				sprite.scale.set( width / 10, height / 10, 1.0 );

				sprite.userData[ 'attributes' ] = attributes;
				sprite.userData[ 'objectType' ] = obj.objectType;

				if ( attributes.name ) {

					sprite.name = attributes.name;

				}

				return sprite;

			case 'Light':

				geometry = obj.geometry;

				let light;

				switch ( geometry.lightStyle.name ) {

					case 'LightStyle_WorldPoint':

						light = new PointLight();
						light.castShadow = attributes.castsShadows;
						light.position.set( geometry.location[ 0 ], geometry.location[ 1 ], geometry.location[ 2 ] );
						light.shadow.normalBias = 0.1;

						break;

					case 'LightStyle_WorldSpot':

						light = new SpotLight();
						light.castShadow = attributes.castsShadows;
						light.position.set( geometry.location[ 0 ], geometry.location[ 1 ], geometry.location[ 2 ] );
						light.target.position.set( geometry.direction[ 0 ], geometry.direction[ 1 ], geometry.direction[ 2 ] );
						light.angle = geometry.spotAngleRadians;
						light.shadow.normalBias = 0.1;

						break;

					case 'LightStyle_WorldRectangular':

						light = new RectAreaLight();
						const width = Math.abs( geometry.width[ 2 ] );
						const height = Math.abs( geometry.length[ 0 ] );
						light.position.set( geometry.location[ 0 ] - ( height / 2 ), geometry.location[ 1 ], geometry.location[ 2 ] - ( width / 2 ) );
						light.height = height;
						light.width = width;
						light.lookAt( geometry.direction[ 0 ], geometry.direction[ 1 ], geometry.direction[ 2 ] );

						break;

					case 'LightStyle_WorldDirectional':

						light = new DirectionalLight();
						light.castShadow = attributes.castsShadows;
						light.position.set( geometry.location[ 0 ], geometry.location[ 1 ], geometry.location[ 2 ] );
						light.target.position.set( geometry.direction[ 0 ], geometry.direction[ 1 ], geometry.direction[ 2 ] );
						light.shadow.normalBias = 0.1;

						break;

					case 'LightStyle_WorldLinear':
						// no conversion exists, warning has already been printed to the console
						break;

					default:
						break;

				}

				if ( light ) {

					light.intensity = geometry.intensity;

					_color = geometry.diffuse;

					if ( _color.r > 1 || _color.g > 1 || _color.b > 1 ) {
						color = new Color(
							_color.r / 255.0,
							_color.g / 255.0,
							_color.b / 255.0 );
					} else {
						color = new Color( _color.r, _color.g, _color.b );
					}

					light.color = color;
					light.userData[ 'attributes' ] = attributes;
					light.userData[ 'objectType' ] = obj.objectType;

				}

				return light;

		}

	}

	_initLibrary() {

		if ( ! this.libraryPending ) {

			// Load rhino3dm wrapper.
			const jsLoader = new FileLoader( this.manager );
			jsLoader.setPath( this.libraryPath );
			const jsContent = new Promise( ( resolve, reject ) => {

				jsLoader.load( 'rhino3dm.js', resolve, undefined, reject );

			} );

			// Load rhino3dm WASM binary.
			const binaryLoader = new FileLoader( this.manager );
			binaryLoader.setPath( this.libraryPath );
			binaryLoader.setResponseType( 'arraybuffer' );
			const binaryContent = new Promise( ( resolve, reject ) => {

				binaryLoader.load( 'rhino3dm.wasm', resolve, undefined, reject );

			} );

			this.libraryPending = Promise.all( [ jsContent, binaryContent ] )
				.then( ( [ jsContent, binaryContent ] ) => {

					//this.libraryBinary = binaryContent;
					this.libraryConfig.wasmBinary = binaryContent;

					const fn = Rhino3dmWorker.toString();

					const body = [
						'/* rhino3dm.js */',
						jsContent,
						'/* worker */',
						fn.substring( fn.indexOf( '{' ) + 1, fn.lastIndexOf( '}' ) )
					].join( '\n' );

					this.workerSourceURL = URL.createObjectURL( new Blob( [ body ] ) );

				} );

		}

		return this.libraryPending;

	}

	_getWorker( taskCost ) {

		return this._initLibrary().then( () => {

			if ( this.workerPool.length < this.workerLimit ) {

				const worker = new Worker( this.workerSourceURL );

				worker._callbacks = {};
				worker._taskCosts = {};
				worker._taskLoad = 0;

				worker.postMessage( {
					type: 'init',
					libraryConfig: this.libraryConfig
				} );

				worker.onmessage = e => {

					const message = e.data;

					switch ( message.type ) {

						case 'warning':
							this.warnings.push( message.data );
							console.warn( message.data );
							break;

						case 'decode':
							worker._callbacks[ message.id ].resolve( message );
							break;

						case 'error':
							worker._callbacks[ message.id ].reject( message );
							break;

						default:
							console.error( 'THREE.Rhino3dmLoader: Unexpected message, "' + message.type + '"' );

					}

				};

				this.workerPool.push( worker );

			} else {

				this.workerPool.sort( function ( a, b ) {

					return a._taskLoad > b._taskLoad ? - 1 : 1;

				} );

			}

			const worker = this.workerPool[ this.workerPool.length - 1 ];

			worker._taskLoad += taskCost;

			return worker;

		} );

	}

	_releaseTask( worker, taskID ) {

		worker._taskLoad -= worker._taskCosts[ taskID ];
		delete worker._callbacks[ taskID ];
		delete worker._taskCosts[ taskID ];

	}

	dispose() {

		for ( let i = 0; i < this.workerPool.length; ++ i ) {

			this.workerPool[ i ].terminate();

		}

		this.workerPool.length = 0;

		return this;

	}

}

/* WEB WORKER */

function Rhino3dmWorker() {

	let libraryPending;
	let libraryConfig;
	let rhino;
	let taskID;

	onmessage = function ( e ) {

		const message = e.data;

		switch ( message.type ) {

			case 'init':

				libraryConfig = message.libraryConfig;
				const wasmBinary = libraryConfig.wasmBinary;
				let RhinoModule;
				libraryPending = new Promise( function ( resolve ) {

					/* Like Basis Loader */
					RhinoModule = { wasmBinary, onRuntimeInitialized: resolve };

					rhino3dm( RhinoModule ); // eslint-disable-line no-undef

				 } ).then( () => {

					rhino = RhinoModule;

				 } );

				break;

			case 'decode':

				taskID = message.id;
				const buffer = message.buffer;
				libraryPending.then( () => {

					try {

						const data = decodeObjects( rhino, buffer );
						self.postMessage( { type: 'decode', id: message.id, data } );

					} catch ( error ) {

						self.postMessage( { type: 'error', id: message.id, error } );

					}

				} );

				break;

		}

	};

	function decodeObjects( rhino, buffer ) {

		const arr = new Uint8Array( buffer );
		const doc = rhino.File3dm.fromByteArray( arr );

		const objects = [];
		const materials = [];
		const layers = [];
		const views = [];
		const namedViews = [];
		const groups = [];
		const strings = [];

		//Handle objects

		const objs = doc.objects();
		const cnt = objs.count;

		for ( let i = 0; i < cnt; i ++ ) {

			const _object = objs.get( i );

			const object = extractObjectData( _object, doc );

			_object.delete();

			if ( object ) {

				objects.push( object );

			}

		}

		// Handle instance definitions
		// console.log( `Instance Definitions Count: ${doc.instanceDefinitions().count()}` );

		for ( let i = 0; i < doc.instanceDefinitions().count; i ++ ) {

			const idef = doc.instanceDefinitions().get( i );
			const idefAttributes = extractProperties( idef );
			idefAttributes.objectIds = idef.getObjectIds();

			objects.push( { geometry: null, attributes: idefAttributes, objectType: 'InstanceDefinition' } );

		}

		// Handle materials

		const textureTypes = [
			// rhino.TextureType.Bitmap,
			rhino.TextureType.Diffuse,
			rhino.TextureType.Bump,
			rhino.TextureType.Transparency,
			rhino.TextureType.Opacity,
			rhino.TextureType.Emap
		];

		const pbrTextureTypes = [
			rhino.TextureType.PBR_BaseColor,
			rhino.TextureType.PBR_Subsurface,
			rhino.TextureType.PBR_SubsurfaceScattering,
			rhino.TextureType.PBR_SubsurfaceScatteringRadius,
			rhino.TextureType.PBR_Metallic,
			rhino.TextureType.PBR_Specular,
			rhino.TextureType.PBR_SpecularTint,
			rhino.TextureType.PBR_Roughness,
			rhino.TextureType.PBR_Anisotropic,
			rhino.TextureType.PBR_Anisotropic_Rotation,
			rhino.TextureType.PBR_Sheen,
			rhino.TextureType.PBR_SheenTint,
			rhino.TextureType.PBR_Clearcoat,
			rhino.TextureType.PBR_ClearcoatBump,
			rhino.TextureType.PBR_ClearcoatRoughness,
			rhino.TextureType.PBR_OpacityIor,
			rhino.TextureType.PBR_OpacityRoughness,
			rhino.TextureType.PBR_Emission,
			rhino.TextureType.PBR_AmbientOcclusion,
			rhino.TextureType.PBR_Displacement
		];

		for ( let i = 0; i < doc.materials().count; i ++ ) {

			const _material = doc.materials().get( i );

			const material = extractProperties( _material );

			const textures = [];

			textures.push( ...extractTextures( _material, textureTypes, doc ) );

			material.pbrSupported = _material.physicallyBased().supported;

			if ( material.pbrSupported ) {

				textures.push( ...extractTextures( _material, pbrTextureTypes, doc ) );
				material.pbr = extractProperties( _material.physicallyBased() );

			}

			material.textures = textures;

			materials.push( material );

			_material.delete();

		}

		// Handle layers

		for ( let i = 0; i < doc.layers().count; i ++ ) {

			const _layer = doc.layers().get( i );
			const layer = extractProperties( _layer );

			layers.push( layer );

			_layer.delete();

		}

		// Handle views

		for ( let i = 0; i < doc.views().count; i ++ ) {

			const _view = doc.views().get( i );
			const view = extractProperties( _view );

			views.push( view );

			_view.delete();

		}

		// Handle named views

		for ( let i = 0; i < doc.namedViews().count; i ++ ) {

			const _namedView = doc.namedViews().get( i );
			const namedView = extractProperties( _namedView );

			namedViews.push( namedView );

			_namedView.delete();

		}

		// Handle groups

		for ( let i = 0; i < doc.groups().count; i ++ ) {

			const _group = doc.groups().get( i );
			const group = extractProperties( _group );

			groups.push( group );

			_group.delete();

		}

		// Handle settings

		const settings = extractProperties( doc.settings() );

		//TODO: Handle other document stuff like dimstyles, instance definitions, bitmaps etc.

		// Handle dimstyles
		// console.log( `Dimstyle Count: ${doc.dimstyles().count()}` );

		// Handle bitmaps
		// console.log( `Bitmap Count: ${doc.bitmaps().count()}` );

		// Handle strings
		// console.log( `Document Strings Count: ${doc.strings().count()}` );
		// Note: doc.strings().documentUserTextCount() counts any doc.strings defined in a section
		// console.log( `Document User Text Count: ${doc.strings().documentUserTextCount()}` );

		const strings_count = doc.strings().count;

		for ( let i = 0; i < strings_count; i ++ ) {

			strings.push( doc.strings().get( i ) );

		}

		// Handle Render Environments for Material Environment

		// get the id of the active render environment skylight, which we'll use for environment texture
		const reflectionId = doc.settings().renderSettings().renderEnvironments.reflectionId;

		const rc = doc.renderContent();

		let renderEnvironment = null;

		for ( let i = 0; i < rc.count; i ++ ) {

			const content = rc.get( i );

			switch ( content.kind ) {

				case 'environment':

					const id = content.id;

					// there could be multiple render environments in a 3dm file
					if ( id !== reflectionId ) break;

					const renderTexture = content.findChild( 'texture' );
					const fileName = renderTexture.fileName;

					for ( let j = 0; j < doc.embeddedFiles().count; j ++ ) {

						const _fileName = doc.embeddedFiles().get( j ).fileName;

						if ( fileName === _fileName ) {

							const background = doc.getEmbeddedFileAsBase64( fileName );
							const backgroundImage = 'data:image/png;base64,' + background;
							renderEnvironment = { type: 'renderEnvironment', image: backgroundImage, name: fileName };

						}

					}

					break;

			}

		}

		// Handle Render Settings

		const renderSettings = {
			ambientLight: doc.settings().renderSettings().ambientLight,
			backgroundColorTop: doc.settings().renderSettings().backgroundColorTop,
			backgroundColorBottom: doc.settings().renderSettings().backgroundColorBottom,
			useHiddenLights: doc.settings().renderSettings().useHiddenLights,
			depthCue: doc.settings().renderSettings().depthCue,
			flatShade: doc.settings().renderSettings().flatShade,
			renderBackFaces: doc.settings().renderSettings().renderBackFaces,
			renderPoints: doc.settings().renderSettings().renderPoints,
			renderCurves: doc.settings().renderSettings().renderCurves,
			renderIsoParams: doc.settings().renderSettings().renderIsoParams,
			renderMeshEdges: doc.settings().renderSettings().renderMeshEdges,
			renderAnnotations: doc.settings().renderSettings().renderAnnotations,
			useViewportSize: doc.settings().renderSettings().useViewportSize,
			scaleBackgroundToFit: doc.settings().renderSettings().scaleBackgroundToFit,
			transparentBackground: doc.settings().renderSettings().transparentBackground,
			imageDpi: doc.settings().renderSettings().imageDpi,
			shadowMapLevel: doc.settings().renderSettings().shadowMapLevel,
			namedView: doc.settings().renderSettings().namedView,
			snapShot: doc.settings().renderSettings().snapShot,
			specificViewport: doc.settings().renderSettings().specificViewport,
			groundPlane: extractProperties( doc.settings().renderSettings().groundPlane ),
			safeFrame: extractProperties( doc.settings().renderSettings().safeFrame ),
			dithering: extractProperties( doc.settings().renderSettings().dithering ),
			skylight: extractProperties( doc.settings().renderSettings().skylight ),
			linearWorkflow: extractProperties( doc.settings().renderSettings().linearWorkflow ),
			renderChannels: extractProperties( doc.settings().renderSettings().renderChannels ),
			sun: extractProperties( doc.settings().renderSettings().sun ),
			renderEnvironments: extractProperties( doc.settings().renderSettings().renderEnvironments ),
			postEffects: extractProperties( doc.settings().renderSettings().postEffects ),

		};

		doc.delete();

		return { objects, materials, layers, views, namedViews, groups, strings, settings, renderSettings, renderEnvironment };

	}

	function extractTextures( m, tTypes, d ) {

		const textures = [];

		for ( let i = 0; i < tTypes.length; i ++ ) {

			const _texture = m.getTexture( tTypes[ i ] );
			if ( _texture ) {

				let textureType = tTypes[ i ].constructor.name;
				textureType = textureType.substring( 12, textureType.length );
				const texture = extractTextureData( _texture, textureType, d );
				textures.push( texture );
				_texture.delete();

			}

		}

		return textures;

	}

	function extractTextureData( t, tType, d ) {

		const texture = { type: tType };

		const image = d.getEmbeddedFileAsBase64( t.fileName );

		texture.wrapU = t.wrapU;
		texture.wrapV = t.wrapV;
		texture.wrapW = t.wrapW;
		const uvw = t.uvwTransform.toFloatArray( true );

		texture.repeat = [ uvw[ 0 ], uvw[ 5 ] ];

		if ( image ) {

			texture.image = 'data:image/png;base64,' + image;

		} else {

			self.postMessage( { type: 'warning', id: taskID, data: {
				message: `THREE.3DMLoader: Image for ${tType} texture not embedded in file.`,
				type: 'missing resource'
			}

			} );

			texture.image = null;

		}

		return texture;

	}

	function extractObjectData( object, doc ) {

		const _geometry = object.geometry();
		const _attributes = object.attributes();
		let objectType = _geometry.objectType;
		let geometry, attributes, position, data, mesh;

		// skip instance definition objects
		//if( _attributes.isInstanceDefinitionObject ) { continue; }

		// TODO: handle other geometry types
		switch ( objectType ) {

			case rhino.ObjectType.Curve:

				const pts = curveToPoints( _geometry, 100 );

				position = {};
				attributes = {};
				data = {};

				position.itemSize = 3;
				position.type = 'Float32Array';
				position.array = [];

				for ( let j = 0; j < pts.length; j ++ ) {

					position.array.push( pts[ j ][ 0 ] );
					position.array.push( pts[ j ][ 1 ] );
					position.array.push( pts[ j ][ 2 ] );

				}

				attributes.position = position;
				data.attributes = attributes;

				geometry = { data };

				break;

			case rhino.ObjectType.Point:

				const pt = _geometry.location;

				position = {};
				const color = {};
				attributes = {};
				data = {};

				position.itemSize = 3;
				position.type = 'Float32Array';
				position.array = [ pt[ 0 ], pt[ 1 ], pt[ 2 ] ];

				const _color = _attributes.drawColor( doc );

				color.itemSize = 3;
				color.type = 'Float32Array';
				color.array = [ _color.r / 255.0, _color.g / 255.0, _color.b / 255.0 ];

				attributes.position = position;
				attributes.color = color;
				data.attributes = attributes;

				geometry = { data };

				break;

			case rhino.ObjectType.PointSet:
			case rhino.ObjectType.Mesh:

				geometry = _geometry.toThreejsJSON();

				break;

			case rhino.ObjectType.Brep:

				const faces = _geometry.faces();
				mesh = new rhino.Mesh();

				for ( let faceIndex = 0; faceIndex < faces.count; faceIndex ++ ) {

					const face = faces.get( faceIndex );
					const _mesh = face.getMesh( rhino.MeshType.Any );

					if ( _mesh ) {

						mesh.append( _mesh );
						_mesh.delete();

					}

					face.delete();

				}

				if ( mesh.faces().count > 0 ) {

					mesh.compact();
					geometry = mesh.toThreejsJSON();
					faces.delete();

				}

				mesh.delete();

				break;

			case rhino.ObjectType.Extrusion:

				mesh = _geometry.getMesh( rhino.MeshType.Any );

				if ( mesh ) {

					geometry = mesh.toThreejsJSON();
					mesh.delete();

				}

				break;

			case rhino.ObjectType.TextDot:

				geometry = extractProperties( _geometry );

				break;

			case rhino.ObjectType.Light:

				geometry = extractProperties( _geometry );

				if ( geometry.lightStyle.name === 'LightStyle_WorldLinear' ) {

					self.postMessage( { type: 'warning', id: taskID, data: {
						message: `THREE.3DMLoader: No conversion exists for ${objectType.constructor.name} ${geometry.lightStyle.name}`,
						type: 'no conversion',
						guid: _attributes.id
					}

					} );

				}

				break;

			case rhino.ObjectType.InstanceReference:

				geometry = extractProperties( _geometry );
				geometry.xform = extractProperties( _geometry.xform );
				geometry.xform.array = _geometry.xform.toFloatArray( true );

				break;

			case rhino.ObjectType.SubD:

				// TODO: precalculate resulting vertices and faces and warn on excessive results
				_geometry.subdivide( 3 );
				mesh = rhino.Mesh.createFromSubDControlNet( _geometry, false );
				if ( mesh ) {

					geometry = mesh.toThreejsJSON();
					mesh.delete();

				}

				break;

				/*
				case rhino.ObjectType.Annotation:
				case rhino.ObjectType.Hatch:
				case rhino.ObjectType.ClipPlane:
				*/

			default:

				self.postMessage( { type: 'warning', id: taskID, data: {
					message: `THREE.3DMLoader: Conversion not implemented for ${objectType.constructor.name}`,
					type: 'not implemented',
					guid: _attributes.id
				}

				} );

				break;

		}

		if ( geometry ) {

			attributes = extractProperties( _attributes );
			attributes.geometry = extractProperties( _geometry );

			if ( _attributes.groupCount > 0 ) {

				attributes.groupIds = _attributes.getGroupList();

			}

			if ( _attributes.userStringCount > 0 ) {

				attributes.userStrings = _attributes.getUserStrings();

			}

			if ( _geometry.userStringCount > 0 ) {

				attributes.geometry.userStrings = _geometry.getUserStrings();

			}

			if ( _attributes.decals().count > 0 ) {

				self.postMessage( { type: 'warning', id: taskID, data: {
					message: 'THREE.3DMLoader: No conversion exists for the decals associated with this object.',
					type: 'no conversion',
					guid: _attributes.id
				}

				} );

			}

			attributes.drawColor = _attributes.drawColor( doc );

			objectType = objectType.constructor.name;
			objectType = objectType.substring( 11, objectType.length );

			return { geometry, attributes, objectType };

		} else {

			self.postMessage( { type: 'warning', id: taskID, data: {
				message: `THREE.3DMLoader: ${objectType.constructor.name} has no associated mesh geometry.`,
				type: 'missing mesh',
				guid: _attributes.id
			}

			} );

		}

	}

	function extractProperties( object ) {

		const result = {};

		for ( const property in object ) {

			const value = object[ property ];

			if ( typeof value !== 'function' ) {

				if ( typeof value === 'object' && value !== null && value.hasOwnProperty( 'constructor' ) ) {

					result[ property ] = { name: value.constructor.name, value: value.value };

				} else if ( typeof value === 'object' && value !== null ) {

					result[ property ] = extractProperties( value );

				} else {

					result[ property ] = value;

				}

			} else {

				// these are functions that could be called to extract more data.
				//console.log( `${property}: ${object[ property ].constructor.name}` );

			}

		}

		return result;

	}

	function curveToPoints( curve, pointLimit ) {

		let pointCount = pointLimit;
		let rc = [];
		const ts = [];

		if ( curve instanceof rhino.LineCurve ) {

			return [ curve.pointAtStart, curve.pointAtEnd ];

		}

		if ( curve instanceof rhino.PolylineCurve ) {

			pointCount = curve.pointCount;
			for ( let i = 0; i < pointCount; i ++ ) {

				rc.push( curve.point( i ) );

			}

			return rc;

		}

		if ( curve instanceof rhino.PolyCurve ) {

			const segmentCount = curve.segmentCount;

			for ( let i = 0; i < segmentCount; i ++ ) {

				const segment = curve.segmentCurve( i );
				const segmentArray = curveToPoints( segment, pointCount );
				rc = rc.concat( segmentArray );
				segment.delete();

			}

			return rc;

		}

		if ( curve instanceof rhino.ArcCurve ) {

			pointCount = Math.floor( curve.angleDegrees / 5 );
			pointCount = pointCount < 2 ? 2 : pointCount;
			// alternative to this hardcoded version: https://stackoverflow.com/a/18499923/2179399

		}

		if ( curve instanceof rhino.NurbsCurve && curve.degree === 1 ) {

			const pLine = curve.tryGetPolyline();

			for ( let i = 0; i < pLine.count; i ++ ) {

				rc.push( pLine.get( i ) );

			}

			pLine.delete();

			return rc;

		}

		const domain = curve.domain;
		const divisions = pointCount - 1.0;

		for ( let j = 0; j < pointCount; j ++ ) {

			const t = domain[ 0 ] + ( j / divisions ) * ( domain[ 1 ] - domain[ 0 ] );

			if ( t === domain[ 0 ] || t === domain[ 1 ] ) {

				ts.push( t );
				continue;

			}

			const tan = curve.tangentAt( t );
			const prevTan = curve.tangentAt( ts.slice( - 1 )[ 0 ] );

			// Duplicated from THREE.Vector3
			// How to pass imports to worker?

			const tS = tan[ 0 ] * tan[ 0 ] + tan[ 1 ] * tan[ 1 ] + tan[ 2 ] * tan[ 2 ];
			const ptS = prevTan[ 0 ] * prevTan[ 0 ] + prevTan[ 1 ] * prevTan[ 1 ] + prevTan[ 2 ] * prevTan[ 2 ];

			const denominator = Math.sqrt( tS * ptS );

			let angle;

			if ( denominator === 0 ) {

				angle = Math.PI / 2;

			} else {

				const theta = ( tan.x * prevTan.x + tan.y * prevTan.y + tan.z * prevTan.z ) / denominator;
				angle = Math.acos( Math.max( - 1, Math.min( 1, theta ) ) );

			}

			if ( angle < 0.1 ) continue;

			ts.push( t );

		}

		rc = ts.map( t => curve.pointAt( t ) );
		return rc;

	}

}

export { Rhino3dmLoader };
