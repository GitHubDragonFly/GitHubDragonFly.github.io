( function () {

	// As for the 'decompress' function - the app implementing this exporter should import it from TextureUtils.js

	class OBJExporter {

		parse( object, filename = 'model' ) {

			let output = '';
			let indexVertex = 0;
			let indexVertexUvs = 0;
			let indexNormals = 0;
			let mesh_count = 0;
			let line_count = 0;
			let points_count = 0;
			let materials = {};
			let material_names = [];
			let material_colors = {};
			const vertex = new THREE.Vector3();
			const color = new THREE.Color();
			const normal = new THREE.Vector3();
			const uv = new THREE.Vector2();
			const face = [];

			function parseMesh( mesh ) {

				let nbVertex = 0;
				let nbNormals = 0;
				let nbVertexUvs = 0;
				let multi_materials = {};
				const geometry = mesh.geometry;
				const normalMatrixWorld = new THREE.Matrix3();

				if ( geometry.isBufferGeometry !== true ) {

					throw new Error( 'THREE.OBJExporter: Geometry is not of type THREE.BufferGeometry.' );

				}

				// shortcuts
				const groups = geometry.groups;
				const vertex_colors = geometry.getAttribute( 'color' );
				const vertices = geometry.getAttribute( 'position' );
				const normals = geometry.getAttribute( 'normal' );
				const uvs = geometry.getAttribute( 'uv' );
				const indices = geometry.getIndex();

				// name of the mesh object
				if (mesh.name === '') {
					mesh[ 'name' ] = 'mesh_' + mesh_count;
				} else {
					mesh.name = mesh.name.replace( '#', '' );
					mesh.name = mesh.name.replace( ' ', '_' );
				}

				output += 'o ' + mesh.name + '\n';

				// name of the mesh material
				if ( mesh.material && mesh.material.name ) {

					if (mesh.material.name === '') {
						mesh.material[ 'name' ] = 'mesh_material_' + mesh_count;
					} else if ( mesh.material.name.toUpperCase().endsWith( '.PNG' ) || mesh.material.name.toUpperCase().endsWith( '.JPG' ) ) {
						mesh.material[ 'name' ] = mesh.material.name.substring( 0, mesh.material.name.lastIndexOf( '.' ) );
					}

					mesh.material.name = mesh.material.name.replace( '#', '' );
					mesh.material.name = mesh.material.name.replace( ' ', '_' );

					let temp_name = mesh.material.name;

					if (material_names.includes( temp_name ) === false || material_colors[ temp_name ] !== mesh.material.color) {
						if (material_colors[ temp_name ] !== mesh.material.color) mesh.material.name = temp_name;

						material_names.push( mesh.material.name );
						material_colors[ mesh.material.name ] = mesh.material.color;
					}

					output += 'usemtl ' + mesh.material.name + '\n';
					materials[ mesh.material.name ] = mesh.material;

				} else if ( mesh.material && Array.isArray( mesh.material ) ) {

					materials[ 'multi_' + mesh.name ] = mesh.material;

					if ( groups !== undefined ) {

						let mesh_group_material_count = 0;

						for ( let i = 0, l = groups.length; i < l; i ++ ) {

							if (mesh.material[ groups[ i ].materialIndex ].name === '') {
								mesh.material[ groups[ i ].materialIndex ][ 'name' ] = 'mesh_group_material_' + mesh_count + '_' + mesh_group_material_count;
								mesh_group_material_count += 1;
							} else if ( mesh.material[ groups[ i ].materialIndex ].name.toUpperCase().endsWith( '.PNG' ) || mesh.material[ groups[ i ].materialIndex ].name.toUpperCase().endsWith( '.JPG' ) ) {
								mesh.material[ groups[ i ].materialIndex ][ 'name' ] = mesh.material[ groups[ i ].materialIndex ].name.substring( 0, mesh.material[ groups[ i ].materialIndex ].name.lastIndexOf( '.' ) );
							}

							mesh.material[ groups[ i ].materialIndex ].name = mesh.material[ groups[ i ].materialIndex ].name.replace( '#', '' );
							mesh.material[ groups[ i ].materialIndex ].name = mesh.material[ groups[ i ].materialIndex ].name.replace( ' ', '_' );
							multi_materials[ groups[ i ].start ] = mesh.material[ groups[ i ].materialIndex ].name;

						}

					} else {

						output += 'usemtl multi_' + mesh.name + '\n';

					}

				} else if ( mesh.material && vertex_colors === undefined ) {

					output += 'usemtl material' + mesh.material.id + '\n';
					materials[ 'material' + mesh.material.id ] = mesh.material;

				}

				// vertices
				if ( vertices !== undefined ) {

					for ( let i = 0, l = vertices.count; i < l; i ++, nbVertex ++ ) {

						vertex.x = vertices.getX( i );
						vertex.y = vertices.getY( i );
						vertex.z = vertices.getZ( i );

						// transform the vertex to world space
						vertex.applyMatrix4( mesh.matrixWorld );

						// transform the vertex to export format
						if ( vertex_colors ) {

							output += 'v ' + vertex.x + ' ' + vertex.y + ' ' + vertex.z + ' ' + vertex_colors.getX( i ) + ' ' + vertex_colors.getY( i ) + ' ' + vertex_colors.getZ( i ) + '\n';

						} else {

							output += 'v ' + vertex.x + ' ' + vertex.y + ' ' + vertex.z + '\n';

						}

					}

				}

				// uvs
				if ( uvs !== undefined ) {

					for ( let i = 0, l = uvs.count; i < l; i ++, nbVertexUvs ++ ) {

						uv.x = uvs.getX( i );
						uv.y = uvs.getY( i );

						// transform the uv to export format
						output += 'vt ' + uv.x + ' ' + uv.y + '\n';

					}

				}

				// normals
				if ( normals !== undefined ) {

					normalMatrixWorld.getNormalMatrix( mesh.matrixWorld );

					for ( let i = 0, l = normals.count; i < l; i ++, nbNormals ++ ) {

						normal.x = normals.getX( i );
						normal.y = normals.getY( i );
						normal.z = normals.getZ( i );

						// transform the normal to world space
						normal.applyMatrix3( normalMatrixWorld ).normalize();

						// transform the normal to export format
						output += 'vn ' + normal.x + ' ' + normal.y + ' ' + normal.z + '\n';

					}

				}

				// faces
				if ( indices !== null ) {

					for ( let i = 0, l = indices.count; i < l; i += 3 ) {

						Object.keys( multi_materials ).forEach( ( key ) => {

							if ( parseInt( key ) === i ) {

								output += 'usemtl ' + multi_materials[ i ] + '\n';

							}

						});

						for ( let m = 0; m < 3; m ++ ) {

							const j = indices.getX( i + m ) + 1;
							face[ m ] = indexVertex + j + ( normals || uvs ? '/' + ( uvs ? indexVertexUvs + j : '' ) + ( normals ? '/' + ( indexNormals + j ) : '' ) : '' );

						}

						// transform the face to export format
						output += 'f ' + face.join( ' ' ) + '\n';

					}

				} else {

					for ( let i = 0, l = vertices.count; i < l; i += 3 ) {

						Object.keys( multi_materials ).forEach( ( key ) => {

							if ( parseInt( key ) === i ) {

								output += 'usemtl ' + multi_materials[ i ] + '\n';

							}

						});

						for ( let m = 0; m < 3; m ++ ) {

							const j = i + m + 1;
							face[ m ] = indexVertex + j + ( normals || uvs ? '/' + ( uvs ? indexVertexUvs + j : '' ) + ( normals ? '/' + ( indexNormals + j ) : '' ) : '' );

						}

						// transform the face to export format
						output += 'f ' + face.join( ' ' ) + '\n';

					}

				}

				// update index
				indexVertex += nbVertex;
				indexVertexUvs += nbVertexUvs;
				indexNormals += nbNormals;

				mesh_count += 1;

			}

			function parseLine( line ) {

				let nbVertex = 0;
				const geometry = line.geometry;
				const type = line.type;

				if ( geometry.isBufferGeometry !== true ) {

					throw new Error( 'THREE.OBJExporter: Geometry is not of type THREE.BufferGeometry.' );

				}

				// shortcuts
				const vertices = geometry.getAttribute( 'position' );
				
				// name of the line object
				output += 'o ' + line.name + '\n';

				if ( line.material ) {

					if ( line.material.name ) {

						if ( line.material.name === '' ) line.material.name = 'line_material_' + line_count;

					} else {

						line.material[ 'name' ] = 'line_material_' + line_count;

					}

					materials[ line.material.name ] = line.material;

					output += 'usemtl ' + line.material.name + '\n';

					line_count += 1;
				}

				if ( vertices !== undefined ) {

					for ( let i = 0, l = vertices.count; i < l; i ++, nbVertex ++ ) {

						vertex.x = vertices.getX( i );
						vertex.y = vertices.getY( i );
						vertex.z = vertices.getZ( i );

						// transform the vertex to world space
						vertex.applyMatrix4( line.matrixWorld );

						// transform the vertex to export format
						output += 'v ' + vertex.x + ' ' + vertex.y + ' ' + vertex.z + '\n';

					}

				}

				if ( type === 'Line' ) {

					output += 'l ';

					for ( let j = 1, l = vertices.count; j <= l; j ++ ) {

						output += indexVertex + j + ' ';

					}

					output += '\n';

				}

				if ( type === 'LineSegments' ) {

					for ( let j = 1, k = j + 1, l = vertices.count; j < l; j += 2, k = j + 1 ) {

						output += 'l ' + ( indexVertex + j ) + ' ' + ( indexVertex + k ) + '\n';

					}

				}

				// update index
				indexVertex += nbVertex;

			}

			function parsePoints( points ) {

				let nbVertex = 0;
				const geometry = points.geometry;

				if ( geometry.isBufferGeometry !== true ) {

					throw new Error( 'THREE.OBJExporter: Geometry is not of type THREE.BufferGeometry.' );

				}

				const vertices = geometry.getAttribute( 'position' );
				const colors = geometry.getAttribute( 'color' );
				output += 'o ' + points.name + '\n';

				if ( vertices !== undefined ) {

					for ( let i = 0, l = vertices.count; i < l; i ++, nbVertex ++ ) {

						vertex.fromBufferAttribute( vertices, i );
						vertex.applyMatrix4( points.matrixWorld );
						output += 'v ' + vertex.x + ' ' + vertex.y + ' ' + vertex.z;

						if ( colors !== undefined ) {

							color.fromBufferAttribute( colors, i ).convertLinearToSRGB();
							output += ' ' + color.r + ' ' + color.g + ' ' + color.b;

						}

						output += '\n';

					}

					output += 'p ';

					for ( let j = 1, l = vertices.count; j <= l; j ++ ) {

						output += indexVertex + j + ' ';

					}

					output += '\n';

				}

				// update index
				indexVertex += nbVertex;

				if ( points.material ) {

					if ( points.material.name ) {

						if ( points.material.name === '' ) points.material.name = 'points_material_' + points_count;

					} else {

						points.material[ 'name' ] = 'points_material_' + points_count;

					}

					materials[ points.material.name ] = points.material;

					output += 'usemtl ' + points.material.name + '\n';

					points_count += 1;
				}

			}

			object.traverse( function ( child ) {

				if ( child.isMesh === true ) {

					parseMesh( child );

				}

				if ( child.isLine === true ) {

					parseLine( child );

				}

				if ( child.isPoints === true ) {

					parsePoints( child );

				}

			} );

			if (Object.keys( materials ).length !== 0) {
				// mtl output (Ref: https://stackoverflow.com/questions/35070048/export-a-three-js-textured-model-to-a-obj-with-mtl-file)

				// add the provided filename as the name of the material library
				output = 'mtllib ' + filename + '.mtl' + '\n' + output;

				let mtlOutput = '# MTL file - created by a modified three.js OBJExporter' + '\n';
				let textures = [];
				let names = [];
				let map_uuids = [];
				let map_names = {};
				const ext = 'png';
				let count = 1;

				let image_extensions = [ '.PNG', '.JPG', '.JPEG', '.JFIF', '.PJP', '.PJPEG', '.BMP', '.GIF', '.SVG', '.WEBP' ];

				Object.keys( materials ).forEach( ( key ) => {

					if ( Array.isArray( materials[ key ] )) {

						materials[ key ].forEach( ( mtl ) => {

							set_mtl_params_textures( mtl );

						});

					} else {

						set_mtl_params_textures( materials[ key ] );

					}

				});

				// set MTL parameters and textures
				function set_mtl_params_textures( mat) {

					let name = ( mat.name && mat.name !== '' ) ? ( image_extensions.some( ext => mat.name.toUpperCase().endsWith( ext ) ) ? mat.name.substring( 0, mat.name.lastIndexOf( '.' ) ) : mat.name ) : 'material' + mat.id;
					name = name.replace( '#', '' );
					name = name.replace( ' ', '_' );

					if ( names.includes( name ) === false ) {

						names.push( name );

						let transparency = ( mat.opacity < 1 ) ? ( 1 - mat.opacity ) : '0.0000';

						mtlOutput += '\n' + 'newmtl ' + name + '\n';

						mtlOutput += 'Tr ' + transparency + '\n';
						mtlOutput += 'Tf 1.0000 1.0000 1.0000\n'; // this property is not used by the three.js MTL Loader
						mtlOutput += 'illum 2\n'; // this property is not used by the three.js MTL Loader
						if ( mat.aoMapIntensity ) mtlOutput += 'Ka ' + mat.aoMapIntensity + ' ' + mat.aoMapIntensity + ' ' + mat.aoMapIntensity + '\n';
						if ( mat.color ) mtlOutput += 'Kd ' + mat.color.r + ' ' + mat.color.g + ' ' + mat.color.b + '\n';
						if ( mat.emissive ) mtlOutput += 'Ke ' + mat.emissive.r + ' ' + mat.emissive.g + ' ' + mat.emissive.b + '\n';
						if ( mat.specular ) mtlOutput += 'Ks ' + mat.specular.r + ' ' + mat.specular.g + ' ' + mat.specular.b + '\n';
						if ( mat.shininess ) mtlOutput += 'Ns ' + mat.shininess + '\n';
						if ( mat.refractionRatio ) mtlOutput += 'Ni ' + mat.refractionRatio + '\n';
						if ( mat.metalness ) mtlOutput += 'Pm ' + mat.metalness + '\n';
						if ( mat.roughness ) mtlOutput += 'Pr ' + mat.roughness + '\n';
						if ( mat.displacementBias ) mtlOutput += 'disp_b ' + mat.displacementBias + '\n';
						if ( mat.displacementScale ) mtlOutput += 'disp_s ' + mat.displacementScale + '\n';
						if ( mat.lightMapIntensity ) mtlOutput += 'Pli ' + mat.lightMapIntensity + '\n';
						if ( mat.clearcoat ) mtlOutput += 'Pcc ' + mat.clearcoat + '\n';
						if ( mat.clearcoatRoughness ) mtlOutput += 'Pccr ' + mat.clearcoatRoughness + '\n';
						if ( mat.clearcoatNormalScale ) mtlOutput += 'Pccns ' + mat.clearcoatNormalScale.x + ' ' + mat.clearcoatNormalScale.y + '\n';
						if ( mat.reflectivity ) mtlOutput += 'Prfl ' + mat.reflectivity + '\n';
						if ( mat.ior ) mtlOutput += 'Pior ' + mat.ior + '\n';
						if ( mat.anisotropy ) mtlOutput += 'Pa ' + mat.anisotropy + '\n';
						if ( mat.anisotropyRotation ) mtlOutput += 'Par ' + mat.anisotropyRotation + '\n';
						if ( mat.anisotropyStrength ) mtlOutput += 'Pas ' + mat.anisotropyStrength + '\n';
						if ( mat.attenuationColor ) mtlOutput += 'Patc ' + mat.attenuationColor.r + ' ' + mat.attenuationColor.g + ' ' + mat.attenuationColor.b + '\n';
						if ( mat.attenuationDistance ) mtlOutput += 'Patd ' + mat.attenuationDistance + '\n';
						if ( mat.iridescence ) mtlOutput += 'Pir ' + mat.iridescence + '\n';
						if ( mat.iridescenceIOR ) mtlOutput += 'Pirior ' + mat.iridescenceIOR + '\n';
						if ( mat.iridescenceThicknessRange ) mtlOutput += 'Pirtr ' + mat.iridescenceThicknessRange[ 0 ] + ' ' + mat.iridescenceThicknessRange[ 1 ] + '\n';
						if ( mat.sheen ) mtlOutput += 'Psh ' + mat.sheen + '\n';
						if ( mat.sheenColor ) mtlOutput += 'Pshc ' + mat.sheenColor.r + ' ' + mat.sheenColor.g + ' ' + mat.sheenColor.b + '\n';
						if ( mat.sheenRoughness ) mtlOutput += 'Pshr ' + mat.sheenRoughness + '\n';
						if ( mat.specularIntensity ) mtlOutput += 'Psi ' + mat.specularIntensity + '\n';
						if ( mat.specularColor ) mtlOutput += 'Psc ' + mat.specularColor.r + ' ' + mat.specularColor.g + ' ' + mat.specularColor.b + '\n';
						if ( mat.thickness ) mtlOutput += 'Pth ' + mat.thickness + '\n';
						if ( mat.transmission ) mtlOutput += 'Ptr ' + mat.transmission + '\n';

						if ( mat.map && mat.map.type === 1009 && mat.map.image ) {

							let map_to_process = mat.map;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.map, 1024 );

							}

							if ( mat.map.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data ) {

								if ( map_uuids.includes( mat.map.uuid ) === false ) {

									map_uuids.push( mat.map.uuid );
									map_names[ mat.map.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Kd ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Kd ' + map_names[ mat.map.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.specularMap && mat.specularMap.type === 1009 && mat.specularMap.image ) {

							let map_to_process = mat.specularMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.specularMap, 1024 );

							}

							if ( mat.specularMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data ) {

								if ( map_uuids.includes( mat.specularMap.uuid ) === false ) {

									name = 'specularMap' + count;

									map_uuids.push( mat.specularMap.uuid );
									map_names[ mat.specularMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Ks ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Ks ' + map_names[ mat.specularMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.emissiveMap && mat.emissiveMap.type === 1009 && mat.emissiveMap.image ) {

							let map_to_process = mat.emissiveMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.emissiveMap, 1024 );

							}

							if ( mat.emissiveMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data ) {

								if ( map_uuids.includes( mat.emissiveMap.uuid ) === false ) {

									name = 'emissiveMap' + count;

									map_uuids.push( mat.emissiveMap.uuid );
									map_names[ mat.emissiveMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Ke ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Ke ' + map_names[ mat.emissiveMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.bumpMap && mat.bumpMap.type === 1009 && mat.bumpMap.image ) {

							let map_to_process = mat.bumpMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.bumpMap, 1024 );

							}

							if ( mat.bumpMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data ) {

								if ( map_uuids.includes( mat.bumpMap.uuid ) === false ) {

									name = 'bumpMap' + count;

									map_uuids.push( mat.bumpMap.uuid );
									map_names[ mat.bumpMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									if ( mat.bumpScale === 1 ) {

										mtlOutput += 'map_bump ' + name + '.png' + '\n';

									} else {

										mtlOutput += 'map_bump -bm ' + mat.bumpScale + ' ' + name + '.png' + '\n';

									}

								} else {

									if ( mat.bumpScale === 1 ) {

										mtlOutput += 'map_bump ' + map_names[ mat.bumpMap.uuid ] + '.png' + '\n';

									} else {

										mtlOutput += 'map_bump -bm ' + mat.bumpScale + ' ' + map_names[ mat.bumpMap.uuid ] + '.png' + '\n';

									}

								}

							}

						}

						if ( mat.lightMap && mat.lightMap.type === 1009 && mat.lightMap.image ) {

							let map_to_process = mat.lightMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.lightMap, 1024 );

							}

							if ( mat.lightMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data ) {

								if ( map_uuids.includes( mat.lightMap.uuid ) === false ) {

									name = 'lightMap' + count;

									map_uuids.push( mat.lightMap.uuid );
									map_names[ mat.lightMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Pl ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Pl ' + map_names[ mat.lightMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.anisotropyMap && mat.anisotropyMap.type === 1009 && mat.anisotropyMap.image ) {

							let map_to_process = mat.anisotropyMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.anisotropyMap, 1024 );

							}

							if ( mat.anisotropyMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data ) {

								if ( map_uuids.includes( mat.anisotropyMap.uuid ) === false ) {

									name = 'anisotropyMap' + count;

									map_uuids.push( mat.anisotropyMap.uuid );
									map_names[ mat.anisotropyMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Pa ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Pa ' + map_names[ mat.anisotropyMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.metalnessMap && mat.metalnessMap.type === 1009 && mat.metalnessMap.image ) {

							let map_to_process = mat.metalnessMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.metalnessMap, 1024 );

							}

							if ( mat.metalnessMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data ) {

								if ( map_uuids.includes( mat.metalnessMap.uuid ) === false ) {

									name = 'metalnessMap' + count;

									map_uuids.push( mat.metalnessMap.uuid );
									map_names[ mat.metalnessMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Pm ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Pm ' + map_names[ mat.metalnessMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.roughnessMap && mat.roughnessMap.type === 1009 && mat.roughnessMap.image ) {

							let map_to_process = mat.roughnessMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.roughnessMap, 1024 );

							}

							if ( mat.roughnessMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data ) {

								if ( map_uuids.includes( mat.roughnessMap.uuid ) === false ) {

									name = 'roughnessMap' + count;

									map_uuids.push( mat.roughnessMap.uuid );
									map_names[ mat.roughnessMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Pr ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Pr ' + map_names[ mat.roughnessMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.displacementMap && mat.displacementMap.type === 1009 && mat.displacementMap.image ) {

							let map_to_process = mat.displacementMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.displacementMap, 1024 );

							}

							if ( mat.displacementMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data ) {

								if ( map_uuids.includes( mat.displacementMap.uuid ) === false ) {

									name = 'displacementMap' + count;

									map_uuids.push( mat.displacementMap.uuid );
									map_names[ mat.displacementMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_disp ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_disp ' + map_names[ mat.displacementMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.normalMap && mat.normalMap.type === 1009 && mat.normalMap.image ) {

							let map_to_process = mat.normalMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.normalMap, 1024 );

							}

							if ( mat.normalMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data ) {

								if ( map_uuids.includes( mat.normalMap.uuid ) === false ) {

									name = 'normalMap' + count;

									map_uuids.push( mat.normalMap.uuid );
									map_names[ mat.normalMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'norm ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'norm ' + map_names[ mat.normalMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.alphaMap && mat.alphaMap.type === 1009 && mat.alphaMap.image ) {

							let map_to_process = mat.alphaMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.alphaMap, 1024 );

							}

							if ( mat.alphaMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data ) {

								if ( map_uuids.includes( mat.alphaMap.uuid ) === false ) {

									name = 'alphaMap' + count;

									map_uuids.push( mat.alphaMap.uuid );
									map_names[ mat.alphaMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_d ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_d ' + map_names[ mat.alphaMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.aoMap && mat.aoMap.type === 1009 && mat.aoMap.image ) {

							let map_to_process = mat.aoMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.aoMap, 1024 );

							}

							if ( mat.aoMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data ) {

								if ( map_uuids.includes( mat.aoMap.uuid ) === false ) {

									name = 'ambientMap' + count;

									map_uuids.push( mat.aoMap.uuid );
									map_names[ mat.aoMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Ka ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Ka ' + map_names[ mat.aoMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.clearcoatMap && mat.clearcoatMap.type === 1009 && mat.clearcoatMap.image ) {

							let map_to_process = mat.clearcoatMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.clearcoatMap, 1024 );

							}

							if ( mat.clearcoatMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data ) {

								if ( map_uuids.includes( mat.clearcoatMap.uuid ) === false ) {

									name = 'clearcoatMap' + count;

									map_uuids.push( mat.clearcoatMap.uuid );
									map_names[ mat.clearcoatMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Pccm ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Pccm ' + map_names[ mat.clearcoatMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.clearcoatNormalMap && mat.clearcoatNormalMap.type === 1009 && mat.clearcoatNormalMap.image ) {

							let map_to_process = mat.clearcoatNormalMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.clearcoatNormalMap, 1024 );

							}

							if ( mat.clearcoatNormalMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data ) {

								if ( map_uuids.includes( mat.clearcoatNormalMap.uuid ) === false ) {

									name = 'clearcoatNormalMap' + count;

									map_uuids.push( mat.clearcoatNormalMap.uuid );
									map_names[ mat.clearcoatNormalMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Pccnm ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Pccnm ' + map_names[ mat.clearcoatNormalMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.clearcoatRoughnessMap && mat.clearcoatRoughnessMap.type === 1009 && mat.clearcoatRoughnessMap.image ) {

							let map_to_process = mat.clearcoatRoughnessMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.clearcoatRoughnessMap, 1024 );

							}

							if ( mat.clearcoatRoughnessMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data ) {

								if ( map_uuids.includes( mat.clearcoatRoughnessMap.uuid ) === false ) {

									name = 'clearcoatRoughnessMap' + count;

									map_uuids.push( mat.clearcoatRoughnessMap.uuid );
									map_names[ mat.clearcoatRoughnessMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Pccrm ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Pccrm ' + map_names[ mat.clearcoatRoughnessMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.iridescenceMap && mat.iridescenceMap.type === 1009 && mat.iridescenceMap.image ) {

							let map_to_process = mat.iridescenceMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.iridescenceMap, 1024 );

							}

							if ( mat.iridescenceMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data ) {

								if ( map_uuids.includes( mat.iridescenceMap.uuid ) === false ) {

									name = 'iridescenceMap' + count;

									map_uuids.push( mat.iridescenceMap.uuid );
									map_names[ mat.iridescenceMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Pirm ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Pirm ' + map_names[ mat.iridescenceMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.iridescenceThicknessMap && mat.iridescenceThicknessMap.type === 1009 && mat.iridescenceThicknessMap.image ) {

							let map_to_process = mat.iridescenceThicknessMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.iridescenceThicknessMap, 1024 );

							}

							if ( mat.iridescenceThicknessMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data ) {

								if ( map_uuids.includes( mat.iridescenceThicknessMap.uuid ) === false ) {

									name = 'iridescenceThicknessMap' + count;

									map_uuids.push( mat.iridescenceThicknessMap.uuid );
									map_names[ mat.iridescenceThicknessMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Pirthm ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Pirthm ' + map_names[ mat.iridescenceThicknessMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.sheenColorMap && mat.sheenColorMap.type === 1009 && mat.sheenColorMap.image ) {

							let map_to_process = mat.sheenColorMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.sheenColorMap, 1024 );

							}

							if ( mat.sheenColorMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data ) {

								if ( map_uuids.includes( mat.sheenColorMap.uuid ) === false ) {

									name = 'sheenColorMap' + count;

									map_uuids.push( mat.sheenColorMap.uuid );
									map_names[ mat.sheenColorMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Pshcm ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Pshcm ' + map_names[ mat.sheenColorMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.sheenRoughnessMap && mat.sheenRoughnessMap.type === 1009 && mat.sheenRoughnessMap.image ) {

							let map_to_process = mat.sheenRoughnessMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.sheenRoughnessMap, 1024 );

							}

							if ( mat.sheenRoughnessMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data ) {

								if ( map_uuids.includes( mat.sheenRoughnessMap.uuid ) === false ) {

									name = 'sheenRoughnessMap' + count;

									map_uuids.push( mat.sheenRoughnessMap.uuid );
									map_names[ mat.sheenRoughnessMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Pshrm ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Pshrm ' + map_names[ mat.sheenRoughnessMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.specularIntensityMap && mat.specularIntensityMap.type === 1009 && mat.specularIntensityMap.image ) {

							let map_to_process = mat.specularIntensityMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.specularIntensityMap, 1024 );

							}

							if ( mat.specularIntensityMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data ) {

								if ( map_uuids.includes( mat.specularIntensityMap.uuid ) === false ) {

									name = 'specularIntensityMap' + count;

									map_uuids.push( mat.specularIntensityMap.uuid );
									map_names[ mat.specularIntensityMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Psim ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Psim ' + map_names[ mat.specularIntensityMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.specularColorMap && mat.specularColorMap.type === 1009 && mat.specularColorMap.image ) {

							let map_to_process = mat.specularColorMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.specularColorMap, 1024 );

							}

							if ( mat.specularColorMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data ) {

								if ( map_uuids.includes( mat.specularColorMap.uuid ) === false ) {

									name = 'specularColorMap' + count;

									map_uuids.push( mat.specularColorMap.uuid );
									map_names[ mat.specularColorMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Pscm ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Pscm ' + map_names[ mat.specularColorMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.thicknessMap && mat.thicknessMap.type === 1009 && mat.thicknessMap.image ) {

							let map_to_process = mat.thicknessMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.thicknessMap, 1024 );

							}

							if ( mat.thicknessMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data ) {

								if ( map_uuids.includes( mat.thicknessMap.uuid ) === false ) {

									name = 'thicknessMap' + count;

									map_uuids.push( mat.thicknessMap.uuid );
									map_names[ mat.thicknessMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Pthm ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Pthm ' + map_names[ mat.thicknessMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.transmissionMap && mat.transmissionMap.type === 1009 && mat.transmissionMap.image ) {

							let map_to_process = mat.transmissionMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.transmissionMap, 1024 );

							}

							if ( mat.transmissionMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data ) {

								if ( map_uuids.includes( mat.transmissionMap.uuid ) === false ) {

									name = 'transmissionMap' + count;

									map_uuids.push( mat.transmissionMap.uuid );
									map_names[ mat.transmissionMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Ptrm ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Ptrm ' + map_names[ mat.transmissionMap.uuid ] + '.png' + '\n';

								}

							}

						}

						count += 1;

					}

				}

				return { obj: output, mtl: mtlOutput, tex: textures };

			} else {

				return { obj: output };

			}

			// the following functions were adopted from ColladaExporter.js

			function imageToData( image, ext ) {

				let canvas, ctx;

				canvas = canvas || document.createElement( 'canvas' );
				ctx = ctx || canvas.getContext( '2d' );
				canvas.width = image.width;
				canvas.height = image.height;

				// this seems to work fine for exporting TGA images as PNG
				if ( image.data && image.data.constructor === Uint8Array ) {

					let imgData = new ImageData( new Uint8ClampedArray( image.data ), image.width, image.height );

					ctx.putImageData( imgData, 0, 0 );

				} else {

					ctx.drawImage( image, 0, 0 );

				}

				// Get the base64 encoded data
				const base64data = canvas.toDataURL( `image/${ext}`, 1 ).replace( /^data:image\/(png|jpg);base64,/, '' );

				// Convert to a uint8 array
				return base64ToBuffer( base64data );

			}

			function base64ToBuffer( str ) {

				const b = atob( str );
				const buf = new Uint8Array( b.length );

				for ( let i = 0, l = buf.length; i < l; i ++ ) {

					buf[ i ] = b.charCodeAt( i );

				}

				return buf;

			}

		}

	}

	THREE.OBJExporter = OBJExporter;

} )();
