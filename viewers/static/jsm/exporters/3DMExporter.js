import {
	BufferAttribute,
	DefaultLoadingManager,
	InterleavedBuffer,
	InterleavedBufferAttribute,
	MathUtils,
	Matrix4,
	Quaternion,
	Vector3
} from "three";

import { deinterleaveAttribute } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js";

import * as rhino3dm from "https://cdn.jsdelivr.net/npm/rhino3dm@8.0.1/rhino3dm.module.min.js";

/** !!! Work in progress !!!
*
*  - supports exporting meshes and points only
*  - exporting mesh textures is not supported currently
*
*  Usage:
*
*  const { Rhino3dmExporter } = await import( "../static/jsm/exporters/3DMExporter.js" );
*  const exporter = new Rhino3dmExporter( manager );
*  const arrayBuffer = exporter.parse( scene );
*
*  Optional full format: exporter.parse( scene, onDone, onError, options );
*
*  options = { vertexColorsCorrection: 32 }; // value from [ 0, 128 ] range
*
*/

class Rhino3dmExporter {

	constructor( manager ) {

		this.manager = manager || DefaultLoadingManager;

	}

	async parse( scene, onDone, onError, options = {} ) {

		const scope = this;

		const Module = await rhino3dm[ 'default' ]();

		const rhino_file = new Module.File3dm();

		// Colors in some formats, when exported, might look washed out
		// Optional vertexColorsCorrection can improve the look of vertex
		// colors with the acceptable value from range [ 0, 128 ]

		const defaultOptions = {
			vertexColorsCorrection: 64
		};

		options = Object.assign( defaultOptions, options );

		const colorCorrect = Math.max( 0, Math.min( 128, options.vertexColorsCorrection ) );

		const uuid_array_mesh_geometries = {};
		const uuid_array_point_geometries = {};
		const uuid_array_mesh_materials = {};
		const uuid_array_point_materials = {};

		// collect uuid of each geometry and material to verify parsed results

		scene.traverse( function ( object ) {

			if ( object.isMesh ) {

				if ( ! uuid_array_mesh_geometries[ object.geometry.uuid ] )
					uuid_array_mesh_geometries[ object.geometry.uuid ] = object.geometry.uuid;

				if ( Array.isArray( object.material ) ) {

					object.material.forEach( ( material ) => {

						if ( ! uuid_array_mesh_materials[ material.uuid ] )
							uuid_array_mesh_materials[ material.uuid ] = material.uuid;

					});

				} else {

					if ( ! uuid_array_mesh_materials[ object.material.uuid ] )
						uuid_array_mesh_materials[ object.material.uuid ] = object.material.uuid;

				}

			} else if ( object.isPoints ) {

				if ( ! uuid_array_point_geometries[ object.geometry.uuid ] )
					uuid_array_point_geometries[ object.geometry.uuid ] = object.geometry.uuid;

				if ( ! uuid_array_point_materials[ object.material.uuid ] )
					uuid_array_point_materials[ object.material.uuid ] = object.material.uuid;

			}

		} );

		// convert scene to JSON

		let json = JSON.stringify( scene.toJSON() );

		// parse metadata, geometries, materials, images, textures and object:

		let result = JSON.parse( json );

		/*

		result.metadata is object -> {
			generator: string,
			type: string,
			version: number
		}

		result.geometries is array of objects -> [ {
			uuid: string,
			type: string,
			data: {
				arrayBuffers: {
					uuid: Array( ? )
				}
				attributes: {
					__expressid: {
						array: Array( ? ),
						itemSize: number,
						normalized: boolean,
						type: string
					},
					color: {
						data: uuid of interleaved buffer,
						isInterleavedBufferAttribute: boolean,
						array: Array( ? ),
						itemSize: number,
						normalized: boolean,
						offset: number,
						type: string (ex. 'Float32Array')
					},
					normal: {
						array: Array( ? ),
						itemSize: number,
						normalized: boolean,
						type: string (ex. 'Float32Array')
					},
					position: {
						data: uuid of interleaved buffer,
						isInterleavedBufferAttribute: boolean,
						array: Array( ? ),
						itemSize: number,
						normalized: boolean,
						offset: number,
						type: string (ex. 'Float32Array')
					},
					tangent: {
						array: Array( ? ),
						itemSize: number,
						normalized: boolean,
						type: string (ex. 'Float32Array')
					},
					uv: {
						array: Array( ? ),
						itemSize: number,
						normalized: boolean,
						type: string (ex. 'Float32Array')
					}
				},
				boundingSphere: {
					center: Array( 3 ),
					radius: number
				},
				index: {
					type: string (ex. 'Uint16Array'),
					array: Array( ? )
				}
				interleavedBuffers: {
					uuid: {
						buffer: uuid of arrayBuffer,
						stride: number,
						type: string (ex. 'Int16Array' or 'Float32Array'),
						uuid: string
					}
				}
			} 
		} ... ]

		result.materials is array of materials -> [ { 
			uuid: string,
			type: string,
			name: string,
			other material properties
		}, ... ]

		result.images is array of base64 images -> [ {
			uuid: string,
			url: base64 string
		} ... ]

		result.textures is array of textures -> [ {
			uuid: string,
			name: string,
			image: uuid of one of the result.images,
			center: [ x, y ],
			offset: [ x, y ],
			repeat: [ x, y ],
			wrap: [ wrapS, wrapT ],
			userData: { mimeType: string },
			other texture properties
		} ... ]

		result.object is object that might have children -> {
			uuid: string,
			type: string,
			name: string,
			layers: number,
			up: [ x, y, z ],
			matrix: Array(16),
			children: [ {
				uuid: string,
				name: string,
				type: string,
				layers: number,
				up: [ x, y, z ],
				matrix: Array(16),
				userData: { name: string },
				geometry: uuid of one of the result.geometries,
				material: uuid of one of the result.materials,
			} ... ]
		}

		*/

		let rhino_attributes;
		let rhino_material;
		let rhino_object;

		let rhino_count = 0;

		function parse_objects( objects ) {

			for ( const object of objects ) {

				let geometry;

				let position = new Vector3();
				let quaternion = new Quaternion();
				let scale = new Vector3();

				let m4 = new Matrix4().fromArray( object.matrix );
				m4.decompose( position, quaternion, scale );

				if ( ( object.type === 'Mesh' && uuid_array_mesh_geometries[ object.geometry ] )
					|| ( object.type === 'Points' && uuid_array_point_geometries[ object.geometry ] ) ) {

					for ( const geo of result.geometries ) {

						if ( geo.uuid === object.geometry ) {

							geometry = scope.interleaved_buffer_attribute_check( geo );

							if ( object.type === 'Mesh' ) {

								const new_geometry = {};
								new_geometry.type = geometry.type;
								new_geometry.data = {};
								new_geometry.data.attributes = {};
								new_geometry.data.index = geometry.data.index;
								new_geometry.data.boundingSphere = geometry.data.boundingSphere;
								if ( geometry.data.attributes.uv ) new_geometry.data.attributes.uv = geometry.data.attributes.uv;
								if ( geometry.data.attributes.color ) new_geometry.data.attributes.color = geometry.data.attributes.color;
								if ( geometry.data.attributes.tangent ) new_geometry.data.attributes.tangent = geometry.data.attributes.tangent;

								new_geometry.uuid = MathUtils.generateUUID();

								const array_position = Array( geometry.data.attributes.position.array.length );

								for ( let i = 0; i < array_position.length; i += 3 ) {

									let new_position = new Vector3(
										geometry.data.attributes.position.array[ i ],
										geometry.data.attributes.position.array[ i + 1 ],
										geometry.data.attributes.position.array[ i + 2 ]
									).applyQuaternion( quaternion ).multiply( scale );

									array_position[ i ] = new_position.x + position.x;
									array_position[ i + 1 ] = new_position.y + position.y;
									array_position[ i + 2 ] = new_position.z + position.z;

								}

								new_geometry.data.attributes.position = {
									array: array_position,
									itemSize: geometry.data.attributes.position.itemSize,
									normalized: false,
									type: 'Float32Array'
								}

								if ( geometry.data.attributes.normal ) {

									const array_normal = Array( geometry.data.attributes.normal.array.length );

									for ( let i = 0; i < array_normal.length; i += 3 ) {

										let new_normal = new Vector3(
											geometry.data.attributes.normal.array[ i ],
											geometry.data.attributes.normal.array[ i + 1 ],
											geometry.data.attributes.normal.array[ i + 2 ]
										).applyQuaternion( quaternion ).multiply( scale );

										array_normal[ i ] = new_normal.x;
										array_normal[ i + 1 ] = new_normal.y;
										array_normal[ i + 2 ] = new_normal.z;

									}

									new_geometry.data.attributes.normal = {
										array: array_normal,
										itemSize: geometry.data.attributes.normal.itemSize,
										normalized: false,
										type: 'Float32Array'
									}

								}

								rhino_object = new Module.Mesh.createFromThreejsJSON( new_geometry );
								process_object( object, new_geometry );

							} else {

								rhino_object = new Module.PointCloud();
								process_object( object, geometry );

							}

						}

					}

					if ( geometry === undefined ) {

						if ( typeof onError === 'function' ) {

							onError( 'THREE.3DMExporter: No match found for parsed geometry ' + object.geometry );
							return null;

						} else {

							throw new Error( 'THREE.3DMExporter: No match found for parsed geometry ' + object.geometry );

						}

					}

				} else if ( object.type === 'Group' || object.type === 'Object3D' ) {

					if ( object.children ) {

						parse_objects( object.children );

					} else {

						// Object3D might be a camera or a light
						continue;

					}

				} else {

					console.warn( 'THREE.3DMExporter: This model includes unsupported ' + object.type + '. The exported model might be malformed.' );

				}

			}

		}

		async function process_object( object, geometry ) {

			rhino_attributes = new Module.ObjectAttributes();

			let geometry_position_array = [ 0, 0, 0 ];
			let geometry_color_array = [ 0, 0, 0 ];
			let dataAsUint8Array = [];

			if ( uuid_array_mesh_geometries[ object.geometry ] ) { // process mesh

				// Add Vertex Colors as red / green / blue Uint8 values 0 - 255

				if ( geometry.data && geometry.data.attributes && geometry.data.attributes.color ) {

					geometry_color_array = geometry.data.attributes.color.array;
					dataAsUint8Array = new Uint8Array( geometry.data.attributes.color.array.length );

					for ( let i = 0; i < dataAsUint8Array.length; i ++ ) {

						let tmp = Math.max( -1, Math.min( 1, geometry_color_array[ i ] ) );
						tmp = tmp < 0 ? ( tmp * 0x8000 ) : ( tmp * 0x7FFF );
						tmp = tmp / 256;
						dataAsUint8Array[ i ] = tmp + colorCorrect;
	
					}

					for ( let j = 0; j < dataAsUint8Array.length; j += geometry.data.attributes.color.itemSize ) {

						rhino_object.vertexColors().add( dataAsUint8Array[ j ], dataAsUint8Array[ j + 1 ], dataAsUint8Array[ j + 2 ] );

					}

				}

				for ( const material of result.materials ) {

					if ( material.uuid === object.material && uuid_array_mesh_materials[ object.material ] ) {

						rhino_material = new Module.Material();
						rhino_material.default();

						if ( material.name && material.name !== '' ) {

							rhino_material.name = material.name;

						} else {

							rhino_material.name = 'material_' + rhino_count;

						}

						/*

						// this is for some possible future use
						// the textures array does get created and stores images
						// but will not be included in the final output file due
						// to the current rhino library limitations

						rhino_material.textures = [];

						const texture_names = {};

						function add_texture( map, map_type ) {

							for ( const texture of result.textures ) {

								if ( texture.uuid === map && ! texture_names[ texture.name ] ) {

									if ( texture.name === '' ) texture.name = map_type;

									texture_names[ texture.name ] = texture.name;

									let tex = {};
									tex.name = texture.name;
									tex.type = map_type;
									tex.flipY = texture.flipY;
									tex.center = texture.center;
									tex.offset = texture.offset;
									tex.repeat = texture.repeat;
									tex.rotation = texture.rotation;
									tex.uuid = MathUtils.generateUUID();

									if ( texture.wrap !== undefined ) {

										tex.wrapU = texture.wrap[ 0 ] === 1000 ? 0 : 1;
										tex.wrapV = texture.wrap[ 1 ] === 1000 ? 0 : 1;

									}

									if ( texture.image ) {

										for ( const image of result.images ) {

											if ( image.uuid === texture.image ) {

												// image.url is a base64 string

												tex.image = image.url;

											}

										}

									}

									rhino_material.textures.push( tex );

								}

							}

						}

						if ( material.type === 'MeshStandardMaterial' || material.type === 'MeshPhysicalMaterial' ) {

							if ( material.map ) add_texture( material.map, 'PBR_BaseColor' );
							if ( material.aoMap ) add_texture( material.aoMap, 'PBR_AmbientOcclusion' );
							if ( material.alphaMap ) add_texture( material.alphaMap, 'PBR_Alpha' );
							if ( material.emissiveMap ) add_texture( material.emissiveMap, 'PBR_Emission' );
							if ( material.anisotropyMap ) add_texture( material.anisotropyMap, 'PBR_Anisotropic' );
							if ( material.clearcoatMap ) add_texture( material.clearcoatMap, 'PBR_Clearcoat' );
							if ( material.clearcoatNormalMap ) add_texture( material.clearcoatNormalMap, 'PBR_ClearcoatBump' );
							if ( material.clearcoatRoughnessMap ) add_texture( material.clearcoatRoughnessMap, 'PBR_ClearcoatRoughness' );
							if ( material.displacementMap ) add_texture( material.displacementMap, 'PBR_Displacement' );
							if ( material.metalnessMap ) add_texture( material.metalnessMap, 'PBR_Metallic' );
							if ( material.roughnessMap ) add_texture( material.roughnessMap, 'PBR_Roughness' );
							if ( material.sheenColorMap ) add_texture( material.sheenColorMap, 'PBR_Sheen' );
							if ( material.specularColorMap ) add_texture( material.specularColorMap, 'PBR_Specular' );
							if ( material.transmissionMap ) add_texture( material.transmissionMap, 'Opacity' );
							if ( material.thicknessMap ) add_texture( material.thicknessMap, 'PBR_Subsurface' );

						} else {

							if ( material.map ) add_texture( material.map, 'Diffuse' );
							if ( material.alphaMap ) add_texture( material.alphaMap, 'Transparency' );
							if ( material.bumpMap ) add_texture( material.bumpMap, 'Bump' );
							if ( material.envMap ) add_texture( material.envMap, 'Emap' );

						}

						*/

						if ( material.color ) {

							let diffuse_color = material.color.toString( 16 ).toUpperCase().padStart( 6, '0' );

							rhino_material.diffuseColor = {
								r: parseInt( diffuse_color.substring( 0, 2 ), 16 ),
								g: parseInt( diffuse_color.substring( 2, 4 ), 16 ),
								b: parseInt( diffuse_color.substring( 4 ), 16 ),
								a: 255
							};

							rhino_attributes.drawColor = rhino_material.diffuseColor;

						}

						if ( material.emissive ) {

							let emission_color = material.emissive.toString( 16 ).toUpperCase().padStart( 6, '0' );

							rhino_material.emissionColor = {
								r: parseInt( emission_color.substring( 0, 2 ), 16 ),
								g: parseInt( emission_color.substring( 2, 4 ), 16 ),
								b: parseInt( emission_color.substring( 4 ), 16 ),
								a: 255
							};

						}

						if ( material.specular ) {

							let specular_color = material.specular.toString( 16 ).toUpperCase().padStart( 6, '0' );

							rhino_material.specularColor = {
								r: parseInt( specular_color.substring( 0, 2 ), 16 ),
								g: parseInt( specular_color.substring( 2, 4 ), 16 ),
								b: parseInt( specular_color.substring( 4 ), 16 ),
								a: 255
							};

						}

						if ( material.shininess !== undefined ) rhino_material.shine = material.shininess;
						if ( material.opacity !== undefined ) rhino_material.transparency = 1.0 - material.opacity;
						if ( material.reflectivity !== undefined ) rhino_material.reflectivity = material.reflectivity;
						if ( material.flatShading !== undefined ) rhino_material.disableLighting = material.flatShading;
						if ( material.refractionFactor !== undefined ) rhino_material.indexOfRefraction = material.refractionFactor;

						if ( material.type === 'MeshStandardMaterial' || material.type === 'MeshPhysicalMaterial' ) {

							rhino_material.toPhysicallyBased();

							if ( material.metalness !== undefined ) rhino_material.physicallyBased().metallic = material.metalness;
							if ( material.roughness !== undefined ) rhino_material.physicallyBased().roughness = material.roughness;

							if ( material.sheen !== undefined && material.sheen > 0 )
								rhino_material.physicallyBased().sheen = material.sheen;

							if ( material.thickness !== undefined && material.thickness > 0 )
								rhino_material.physicallyBased().subsurface = material.thickness;

							if ( material.transmission !== undefined && material.transmission > 0 )
								rhino_material.physicallyBased().opacity = 1 - material.transmission;

							if ( material.color ) {

								let base_color = material.color.toString( 16 ).toUpperCase().padStart( 6, '0' );

								rhino_material.physicallyBased().baseColor = {
									r: parseInt( base_color.substring( 0, 2 ), 16 ),
									g: parseInt( base_color.substring( 2, 4 ), 16 ),
									b: parseInt( base_color.substring( 4 ), 16 ),
									a: 255
								};

							}

							if ( material.specularColor ) {

								let specular_color = material.specularColor.toString( 16 ).toUpperCase().padStart( 6, '0' );

								rhino_material.specularColor = {
									r: parseInt( specular_color.substring( 0, 2 ), 16 ),
									g: parseInt( specular_color.substring( 2, 4 ), 16 ),
									b: parseInt( specular_color.substring( 4 ), 16 ),
									a: 255
								};

							}

							if ( material.specularIntensity !== undefined && material.specularIntensity > 0 )
								rhino_material.physicallyBased().specular = material.specularIntensity;

							if ( material.ior !== undefined ) rhino_material.indexOfRefraction = material.ior;

							if ( material.anisotropy !== undefined && material.anisotropy > 0 ) {

								rhino_material.physicallyBased().anisotropic = material.anisotropy;

								if ( material.anisotropyRotation !== undefined && material.anisotropyRotation > 0 )
									rhino_material.physicallyBased().anisotropicRotation = material.anisotropyRotation;

							}

							if ( material.clearcoat !== undefined && material.clearcoat > 0 ) {

								rhino_material.physicallyBased().clearcoat = material.clearcoat;

								if ( material.clearcoatRoughness !== undefined && material.clearcoatRoughness > 0 )
									rhino_material.physicallyBased().clearcoatRoughness = material.clearcoatRoughness;

							}

						}

						rhino_file.materials().add( rhino_material );

						rhino_attributes.materialSource = Module.ObjectMaterialSource.MaterialFromObject;
						rhino_attributes.castShadows = material.castShadows;
						rhino_attributes.receiveShadows = material.receiveShadows;
						rhino_attributes.materialIndex = rhino_count;

						rhino_count ++;

					}

				}

			} else if ( uuid_array_point_geometries[ object.geometry ] ) { // process points

				let points_count = 0;

				// Add Vertex Colors as red / green / blue Uint8 values 0 - 255

				if ( geometry.data && geometry.data.attributes && geometry.data.attributes.color ) {

					geometry_color_array = geometry.data.attributes.color.array;
					dataAsUint8Array = new Uint8Array( geometry.data.attributes.color.array.length );

					for ( let i = 0; i < dataAsUint8Array.length; i ++ ) {

						let tmp = Math.max( -1, Math.min( 1, geometry_color_array[ i ] ) );
						tmp = tmp < 0 ? ( tmp * 0x8000 ) : ( tmp * 0x7FFF );
						tmp = tmp / 256;
						dataAsUint8Array[ i ] = tmp + colorCorrect;

					}

					geometry_position_array = geometry.data.attributes.position.array;

					for ( let j = 0; j < dataAsUint8Array.length; j += geometry.data.attributes.color.itemSize ) {

						let location = [ geometry_position_array[ j ], geometry_position_array[ j + 1 ], geometry_position_array[ j + 2 ] ];
			
						let point_color = {
							r: dataAsUint8Array[ j ],
							g: dataAsUint8Array[ j + 1 ],
							b: dataAsUint8Array[ j + 2 ],
							a: 255
						};

						let point_cloud_item = rhino_object.insertNew( points_count );

						point_cloud_item.location = location;
						point_cloud_item.color = point_color;

						points_count ++;

					}

				} else {

					for ( const material of result.materials ) {

						if ( material.uuid === object.material && uuid_array_point_materials[ object.material ] ) {

							rhino_material = new Module.Material();
							rhino_material.default();

							if ( material.name && material.name !== '' ) {

								rhino_material.name = material.name;

							} else {

								rhino_material.name = 'material_' + rhino_count;

							}

							if ( material.color ) {

								let diffuse_color = material.color.toString( 16 ).toUpperCase().padStart( 6, '0' );

								let point_color = {
									r: parseInt( diffuse_color.substring( 0, 2 ), 16 ),
									g: parseInt( diffuse_color.substring( 2, 4 ), 16 ),
									b: parseInt( diffuse_color.substring( 4 ), 16 ),
									a: 255
								};

								geometry_position_array = geometry.data.attributes.position.array;

								for ( let j = 0; j < geometry_position_array.length; j += geometry_position_array.itemSize ) {

									let location = [ geometry_position_array[ j ], geometry_position_array[ j + 1 ], geometry_position_array[ j + 2 ] ];

									let point_cloud_item = rhino_object.insertNew( points_count );

									point_cloud_item.location = location;
									point_cloud_item.color = point_color;

									points_count ++;

								}

								rhino_material.diffuseColor = point_color;

							}

							if ( material.opacity ) rhino_material.transparency = 1.0 - material.opacity;

							rhino_file.materials().add( rhino_material );

							rhino_attributes.materialSource = Module.ObjectMaterialSource.MaterialFromObject;
							rhino_attributes.materialIndex = rhino_count;

							rhino_count ++;

						}

					}

				}

			}

			rhino_file.objects().add( rhino_object, rhino_attributes );

		}

		if ( result.object.children && result.object.children.length > 0 ) {

			parse_objects( result.object.children );

		} else if ( result.object.type === 'Mesh' || result.object.type === 'Points' ) {

			parse_objects( [ result.object ] );

		} else {

			if ( typeof onError === 'function' ) {

				onError( 'THREE.3DMExporter: No qualifying objects found!' );
				return null;

			} else {

				throw new Error( 'THREE.3DMExporter: No qualifying objects found!' + result.object );

			}

		}

		if ( typeof onDone === 'function' ) {

			onDone( rhino_file.toByteArray() );

		} else {

			return rhino_file.toByteArray();

		}

	}

	deinterleave( geometry, attribute = 'color' ) {

		const attr = geometry.data.attributes[ attribute ];
		const itemSize = attr.itemSize;
		const offset = attr.offset;

		const data = geometry.data.interleavedBuffers[ geometry.data.attributes[ attribute ].data ];

		if ( data === undefined ) return [];

		const type = data.type;
		const stride = data.stride;
		const iB_buffer = data.buffer;

		if ( geometry.data.arrayBuffers && geometry.data.arrayBuffers[ iB_buffer ] ) {

			const arr = geometry.data.arrayBuffers[ iB_buffer ];
			let iB;

			switch ( type ) {

				case 'Int16Array':

					iB = new InterleavedBuffer( new Int16Array( new Int32Array( arr ).buffer ), stride );
					break;

				case 'Float32Array':

					iB = new InterleavedBuffer( new Float32Array( new Int32Array( arr ).buffer ), stride );
					break;

				default:

					break;

			}

			if ( iB === undefined ) return [];

			let iBA = new InterleavedBufferAttribute( iB, itemSize, offset );

			let attr_items = deinterleaveAttribute( iBA );

			let temp_array = [];

			for ( let i = 0, l = attr_items.array.length; i < l; i ++ ) {

				temp_array[ i ] = attr_items.array[ i ];

			}

			return new BufferAttribute( new Float32Array( temp_array ), itemSize, false );

		}

	}

	interleaved_buffer_attribute_check( geo ) {

		const attribute_array = [ 'position', 'normal', 'color', 'tangent', 'uv' ];

		for (const attribute of attribute_array) {

			if ( geo.data.attributes[ attribute ] && geo.data.attributes[ attribute ].isInterleavedBufferAttribute ) {

				if ( geo.data.attributes[ attribute ].data && geo.data.interleavedBuffers ) {

					if ( geo.data.interleavedBuffers[ geo.data.attributes[ attribute ].data ] ) {

						let geometry_attribute_array = this.deinterleave( geo, attribute ).array;

						geo.data.attributes[ attribute ] = {
							array: geometry_attribute_array,
							itemSize: geo.data.attributes[ attribute ].itemSize,
							normalized: false,
							type: 'Float32Array'
						}

					}

				}

			}

		}

		return geo;

	}

}

export { Rhino3dmExporter };
