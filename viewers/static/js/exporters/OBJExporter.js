( function () {

	class OBJExporter {

		parse( object, onDone, options = {} ) {

			const defaultOptions = {
				filename: 'model',
				map_flip_required: false,
				maxTextureSize: Infinity
			};

			options = Object.assign( defaultOptions, options );

			const map_flip_required = options.map_flip_required;
			const maxTextureSize = options.maxTextureSize;
			const filename = options.filename;

			let output = '';
			let indexVertex = 0;
			let indexVertexUvs = 0;
			let indexNormals = 0;
			let mesh_count = 0;
			let line_count = 0;
			let points_count = 0;
			let materials = {};
			let material_names = [];
			let vertexTangents = false;
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

					throw new Error( 'THREE.OBJExporter: Geometry is not THREE.BufferGeometry.' );

				}

				// shortcuts
				vertexTangents = geometry.attributes.tangent !== undefined;
				const groups = geometry.groups;
				const vertex_colors = geometry.getAttribute( 'color' );
				const vertices = geometry.getAttribute( 'position' );
				const normals = geometry.getAttribute( 'normal' );
				const uvs = geometry.getAttribute( 'uv' );
				const indices = geometry.getIndex();

				// name of the mesh object
				if ( mesh.name === '' ) {

					mesh[ 'name' ] = 'mesh_' + mesh_count;

				} else {

					mesh.name = mesh.name.replaceAll( '#', '' );
					mesh.name = mesh.name.replaceAll( ' ', '_' );

				}

				output += 'o ' + mesh.name + '\n';

				// name of the mesh material
				if ( mesh.material && mesh.material.name !== undefined ) {

					if ( mesh.material.name === '' ) {

						mesh.material[ 'name' ] = 'mesh_material_' + mesh_count;

					} else if ( mesh.material.name.toUpperCase().endsWith( '.PNG' ) || mesh.material.name.toUpperCase().endsWith( '.JPG' ) ) {

						mesh.material[ 'name' ] = mesh.material.name.substring( 0, mesh.material.name.lastIndexOf( '.' ) );

					}

					mesh.material.name = mesh.material.name.replaceAll( '#', '' );
					mesh.material.name = mesh.material.name.replaceAll( ' ', '_' );

					let temp_name = mesh.material.name;

					if ( material_names.includes( temp_name ) === false ) {

						material_names.push( temp_name );
						materials[ temp_name ] = mesh.material;

					}

					if ( ! materials[ temp_name ] ) {

						materials[ temp_name ] = mesh.material;
						output += 'usemtl ' + temp_name + '\n';

					} else if ( materials[ temp_name ] !== mesh.material ) {

						temp_name = mesh.material.name + '_' + mesh_count;
						mesh.material.name = temp_name;

						output += 'usemtl ' + temp_name + '\n';

						materials[ temp_name ] = mesh.material;
						material_names.push( temp_name );

					} else {

						output += 'usemtl ' + temp_name + '\n';

					}

				} else if ( mesh.material && Array.isArray( mesh.material ) ) {

					materials[ 'multi_' + mesh.name ] = mesh.material;

					if ( groups !== undefined ) {

						let mesh_group_material_count = 0;

						for ( let i = 0, l = groups.length; i < l; i ++ ) {

							if ( mesh.material[ groups[ i ].materialIndex ].name === '' ) {

								mesh.material[ groups[ i ].materialIndex ][ 'name' ] = 'mesh_group_material_' + mesh_count + '_' + mesh_group_material_count;
								mesh_group_material_count += 1;

							} else if ( mesh.material[ groups[ i ].materialIndex ].name.toUpperCase().endsWith( '.PNG' ) || mesh.material[ groups[ i ].materialIndex ].name.toUpperCase().endsWith( '.JPG' ) ) {

								mesh.material[ groups[ i ].materialIndex ][ 'name' ] = mesh.material[ groups[ i ].materialIndex ].name.substring( 0, mesh.material[ groups[ i ].materialIndex ].name.lastIndexOf( '.' ) );

							}

							mesh.material[ groups[ i ].materialIndex ].name = mesh.material[ groups[ i ].materialIndex ].name.replaceAll( '#', '' );
							mesh.material[ groups[ i ].materialIndex ].name = mesh.material[ groups[ i ].materialIndex ].name.replaceAll( ' ', '_' );
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

						uv.x = uvs.getX( i ) || 0; // avoid NaN values
						uv.y = uvs.getY( i ) || 0; // avoid NaN values

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
						output += 'vn ' + normal.x * mesh.scale.x + ' ' + normal.y * mesh.scale.y + ' ' + normal.z * mesh.scale.z + '\n';

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

				// name of the line object
				if ( line.name === '' ) {

					line[ 'name' ] = 'line_' + line_count;

				} else {

					line.name = line.name.replaceAll( '#', '' );
					line.name = line.name.replaceAll( ' ', '_' );

				}

				let nbVertex = 0;
				const geometry = line.geometry;
				const type = line.type;

				if ( geometry.isBufferGeometry !== true ) {

					throw new Error( 'THREE.OBJExporter: Geometry is not of type THREE.BufferGeometry.' );

				}

				// shortcuts
				const vertices = geometry.getAttribute( 'position' );
				const colors = geometry.getAttribute( 'color' );

				// name of the line object
				output += 'o ' + line.name + '\n';

				if ( line.material ) {

					if ( line.material.name ) {

						if ( line.material.name === '' ) {

							line.material.name = 'line_material_' + line_count;

						} else {

							line.material.name = line.material.name.replaceAll( '#', '' );
							line.material.name = line.material.name.replaceAll( ' ', '_' );

						}

					} else {

						line.material[ 'name' ] = 'line_material_' + line_count;

					}

					output += 'usemtl ' + line.material.name + '\n';
					materials[ line.material.name ] = line.material;

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
						output += 'v ' + vertex.x + ' ' + vertex.y + ' ' + vertex.z;

						if ( colors !== undefined ) {

							color.fromBufferAttribute( colors, i ).convertLinearToSRGB();
							output += ' ' + color.r + ' ' + color.g + ' ' + color.b;

						}

						output += '\n';

					}

				}

				if ( type === 'LineSegments' ) {

					for ( let j = 1, k = j + 1, l = vertices.count; j < l; j += 2, k = j + 1 ) {

						output += 'l ' + ( indexVertex + j ) + ' ' + ( indexVertex + k ) + '\n';

					}

				}

				if ( type === 'Line' ) {

					output += 'l ';

					for ( let j = 1, l = vertices.count; j <= l; j ++ ) {

						output += indexVertex + j + ' ';

					}

					output += '\n';

				}

				// update index
				indexVertex += nbVertex;

			}

			function parsePoints( points ) {

				// name of the points object
				if ( points.name === '' ) {

					points[ 'name' ] = 'points_' + points_count;

				} else {

					points.name = points.name.replaceAll( '#', '' );
					points.name = points.name.replaceAll( ' ', '_' );

				}

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

						if ( points.material.name === '' ) {

							points.material.name = 'points_material_' + points_count;

						} else {

							points.material.name = points.material.name.replaceAll( '#', '' );
							points.material.name = points.material.name.replaceAll( ' ', '_' );

						}

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

					parseMesh( child.clone() );

				}

				if ( child.isLine === true || child.isLineSegments === true ) {

					parseLine( child.clone() );

				}

				if ( child.isPoints === true ) {

					parsePoints( child.clone() );

				}

			} );

			if (Object.keys( materials ).length !== 0) {
				// mtl output (Ref: https://stackoverflow.com/questions/35070048/export-a-three-js-textured-model-to-a-obj-with-mtl-file)

				// add the provided filename as the name of the material library
				output = 'mtllib ' + filename + '.mtl' + '\n' + output;

				let mtlOutput = '# MTL file - created by a modified three.js OBJExporter' + '\n';
				let map_Px_set;
				let map_uuids = [];
				let map_names = {};
				let textures = [];
				let names = [];
				let count = 1;

				const ext = 'png';
				const image_extensions = [ '.PNG', '.JPG', '.JPEG', '.JFIF', '.PJP', '.PJPEG', '.BMP', '.GIF', '.SVG', '.WEBP' ];

				Object.keys( materials ).forEach( ( key ) => {

					if ( Array.isArray( materials[ key ] )) {

						materials[ key ].forEach( ( mtl ) => {

							map_Px_set = false;
							set_mtl_params_textures( mtl );

						});

					} else {

						map_Px_set = false;
						set_mtl_params_textures( materials[ key ] );

					}

				});

				// set MTL parameters and textures
				function set_mtl_params_textures( mat) {

					let name = ( mat.name && mat.name !== '' ) ? ( image_extensions.some( ext => mat.name.toUpperCase().endsWith( ext ) ) ? mat.name.substring( 0, mat.name.lastIndexOf( '.' ) ) : mat.name ) : 'material' + mat.id;
					name = name.replaceAll( '#', '' );
					name = name.replaceAll( ' ', '_' );

					if ( names.includes( name ) === false ) {

						names.push( name );

						let transparency = ( mat.opacity < 1 ) ? ( 1 - mat.opacity ) : '0.0000';
						if ( mat.transparent === true && parseFloat( transparency ) === 0 ) transparency = '0.0001';

						mtlOutput += '\n' + 'newmtl ' + name + '\n';

						mtlOutput += 'Tr ' + transparency + '\n';
						mtlOutput += 'Tf 1.0000 1.0000 1.0000\n'; // this property is not used by the three.js MTL Loader
						mtlOutput += 'illum 1\n'; // this property is not used by the three.js MTL Loader

						if ( mat.aoMapIntensity && mat.aoMapIntensity > 0 ) mtlOutput += 'Ka ' + mat.aoMapIntensity + ' ' + mat.aoMapIntensity + ' ' + mat.aoMapIntensity + '\n';
						if ( mat.color ) mtlOutput += 'Kd ' + mat.color.r + ' ' + mat.color.g + ' ' + mat.color.b + '\n';
						if ( mat.emissive ) mtlOutput += 'Ke ' + mat.emissive.r + ' ' + mat.emissive.g + ' ' + mat.emissive.b + '\n';
						if ( mat.specular ) mtlOutput += 'Ks ' + mat.specular.r + ' ' + mat.specular.g + ' ' + mat.specular.b + '\n';
						if ( ( mat.shininess !== undefined && mat.shininess > 0 ) || ( mat.glossiness !== undefined && mat.glossiness > 0 ) ) {
							mtlOutput += 'Ns ' + ( mat.shininess ? mat.shininess : mat.glossiness ) + '\n';
						}
						if ( mat.metalness !== undefined && mat.metalness >= 0 ) mtlOutput += 'Pm ' + mat.metalness + '\n';
						if ( mat.roughness !== undefined && mat.roughness >= 0 ) mtlOutput += 'Pr ' + mat.roughness + '\n';
						if ( mat.ior !== undefined && mat.ior >= 1 && mat.ior !== 1.5 ) {
							mtlOutput += 'Ni ' + mat.ior + '\n';
						} else if ( mat.refractionRatio !== undefined && mat.refractionRatio <= 1 && mat.refractionRatio !== 0.98) {
							mtlOutput += 'Ni ' + mat.refractionRatio + '\n';
						}
						if ( ( mat.normalScale && ! ( mat.normalScale.x === 1 && mat.normalScale.y === 1 ) && ! mat.sheen ) || vertexTangents === true ) {
							mtlOutput += 'Pns ' + mat.normalScale.x + ' ' + ( vertexTangents === true ? mat.normalScale.y *= -1 : mat.normalScale.y ) + '\n';
						}
						if ( mat.clearcoat && mat.clearcoat > 0 ) {
							mtlOutput += 'Pcc ' + mat.clearcoat + '\n';
							if ( mat.clearcoatRoughness ) mtlOutput += 'Pcr ' + mat.clearcoatRoughness + '\n';
							if ( ( mat.clearcoatNormalScale && ! ( mat.clearcoatNormalScale.x === 1 && mat.clearcoatNormalScale.y === 1 ) ) || vertexTangents === true ) {
								mtlOutput += 'Pcn ' + mat.clearcoatNormalScale.x + ' ' + ( vertexTangents === true ? mat.clearcoatNormalScale.y *= -1 : mat.clearcoatNormalScale.y ) + '\n';
							}
						}
						if ( mat.lightMapIntensity !== undefined && mat.lightMapIntensity !== 1 ) mtlOutput += 'Pli ' + mat.lightMapIntensity + '\n';
						if ( mat.emissiveIntensity !== undefined && mat.emissiveIntensity !== 1 ) mtlOutput += 'Pe ' + mat.emissiveIntensity + '\n';
						if ( mat.anisotropy && mat.anisotropy > 0 ) {
							mtlOutput += 'Pa ' + mat.anisotropy + '\n';
							if ( mat.anisotropyRotation !== undefined ) mtlOutput += 'Par ' + mat.anisotropyRotation + '\n';
						}
						if ( mat.iridescence && mat.iridescence > 0 ) {
							mtlOutput += 'Pi ' + mat.iridescence + '\n';
							if ( mat.iridescenceIOR && mat.iridescenceIOR >= 1 ) mtlOutput += 'Pii ' + mat.iridescenceIOR + '\n';
							if ( mat.iridescenceThicknessRange ) {
								mtlOutput += 'Pitx ' + mat.iridescenceThicknessRange[ 0 ] + '\n';
								mtlOutput += 'Pity ' + mat.iridescenceThicknessRange[ 1 ] + '\n';
							}
						}
						if ( mat.sheen && mat.sheen > 0 ) {
							mtlOutput += 'Pbr_ps ' + mat.sheen + '\n';
							if ( mat.sheenColor ) mtlOutput += 'Ps ' + mat.sheenColor.r + ' ' + mat.sheenColor.g + ' ' + mat.sheenColor.b + '\n';
							if ( mat.sheenRoughness !== undefined ) mtlOutput += 'Psr ' + mat.sheenRoughness + '\n';
						}
						if ( mat.specularColor || mat.specularIntensity || mat.specularColorMap || mat.specularIntensityMap ) {
							if ( mat.specularColor ) mtlOutput += 'Psp ' + mat.specularColor.r + ' ' + mat.specularColor.g + ' ' + mat.specularColor.b + '\n';
							if ( mat.specularIntensity !== undefined ) mtlOutput += 'Psi ' + mat.specularIntensity + '\n';
						}
						// thickness value currently appears to need a certain correction depending on the transmission and its own value
						// this workaround just brings the look of all Khronos examples with thickness rather close to GLTF Viewer's
						// not sure why this would be required in the first place
						if ( mat.thickness && mat.thickness > 0 ) {
							if ( mat.transmission && mat.transmission > 0 ) {
								if ( mat.thickness < 1 ) {
									mtlOutput += 'Pth ' + ( mat.thickness * 140 ) + '\n';
								} else {
									mtlOutput += 'Pth ' + ( mat.thickness * 11 ) + '\n';
								}
							} else {
								if ( mat.thickness < 1 ) {
									mtlOutput += 'Pth ' + ( mat.thickness * 210 ) + '\n';
								} else {
									mtlOutput += 'Pth ' + ( mat.thickness * 17 ) + '\n';
								}
							}
						}
						if ( mat.attenuationDistance && mat.attenuationDistance !== Infinity ) {
							mtlOutput += 'Pac ' + mat.attenuationColor.r + ' ' + mat.attenuationColor.g + ' ' + mat.attenuationColor.b + '\n';
							mtlOutput += 'Pad ' + ( mat.attenuationDistance + ( mat.thickness || 0 ) ) + '\n';
						}
						if ( mat.transmission && mat.transmission > 0 ) mtlOutput += 'Ptr ' + mat.transmission + '\n';

						if ( mat.reflectivity !== undefined && mat.reflectivity > 0 ) mtlOutput += 'Prf ' + mat.reflectivity + '\n';
						if ( mat.alphaTest > 0 ) mtlOutput += 'a ' + mat.alphaTest + '\n';
						if ( mat.depthTest !== undefined ) mtlOutput += 'Pdt ' + ( mat.depthTest === true ? 1 : 0 ) + '\n';
						mtlOutput += 's ' + mat.side + '\n';

						if ( mat.map && mat.map.image ) {

							let map_to_process = mat.map;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.map.clone(), maxTextureSize );

							}

							if ( mat.map.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data || map_to_process.image instanceof ImageBitmap ) {

								const hd = mat.map.type === 1016;

								const xs = mat.map.repeat.x;
								const ys = mat.map.repeat.y;
								const xo = mat.map.offset.x;
								const yo = mat.map.offset.y;
								const ws = mat.map.wrapS;
								const wt = mat.map.wrapT;
								const xc = mat.map.center ? mat.map.center.x : 0;
								const yc = mat.map.center ? mat.map.center.y : 0;
								const rot = mat.map.rotation ? mat.map.rotation : 0;

								if ( map_uuids.includes( mat.map.uuid ) === false ) {

									map_uuids.push( mat.map.uuid );
									map_names[ mat.map.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									if ( hd === true ) {

										mtlOutput += 'map_Kd -r ' + rot + ' -hd 1 -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + name + '.png' + '\n';

									} else {

										mtlOutput += 'map_Kd -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + name + '.png' + '\n';

									}

								} else {

									if ( hd === true ) {

										mtlOutput += 'map_Kd -r ' + rot + ' -hd 1 -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + map_names[ mat.map.uuid ] + '.png' + '\n';

									} else {

										mtlOutput += 'map_Kd -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + map_names[ mat.map.uuid ] + '.png' + '\n';

									}

								}

							}

						}

						if ( mat.specularMap && mat.specularMap.image ) {

							let map_to_process = mat.specularMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.specularMap.clone(), maxTextureSize );

							}

							if ( mat.specularMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data || map_to_process.image instanceof ImageBitmap ) {

								const xs = mat.specularMap.repeat.x;
								const ys = mat.specularMap.repeat.y;
								const xo = mat.specularMap.offset.x;
								const yo = mat.specularMap.offset.y;
								const ws = mat.specularMap.wrapS;
								const wt = mat.specularMap.wrapT;
								const xc = mat.specularMap.center ? mat.specularMap.center.x : 0;
								const yc = mat.specularMap.center ? mat.specularMap.center.y : 0;
								const rot = mat.specularMap.rotation ? mat.specularMap.rotation : 0;

								if ( map_uuids.includes( mat.specularMap.uuid ) === false ) {

									name = 'specMap' + count;

									map_uuids.push( mat.specularMap.uuid );
									map_names[ mat.specularMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Ks -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Ks -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys  + ' 1'+ ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + map_names[ mat.specularMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.emissiveMap && mat.emissiveMap.image ) {

							let map_to_process = mat.emissiveMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.emissiveMap.clone(), maxTextureSize );

							}

							if ( mat.emissiveMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data || map_to_process.image instanceof ImageBitmap ) {

								const xs = mat.emissiveMap.repeat.x;
								const ys = mat.emissiveMap.repeat.y;
								const xo = mat.emissiveMap.offset.x;
								const yo = mat.emissiveMap.offset.y;
								const ws = mat.emissiveMap.wrapS;
								const wt = mat.emissiveMap.wrapT;
								const xc = mat.emissiveMap.center ? mat.emissiveMap.center.x : 0;
								const yc = mat.emissiveMap.center ? mat.emissiveMap.center.y : 0;
								const rot = mat.emissiveMap.rotation ? mat.emissiveMap.rotation : 0;

								if ( map_uuids.includes( mat.emissiveMap.uuid ) === false ) {

									name = 'emMap' + count;

									map_uuids.push( mat.emissiveMap.uuid );
									map_names[ mat.emissiveMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Ke -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Ke -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + map_names[ mat.emissiveMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.bumpMap && mat.bumpMap.image ) {

							let map_to_process = mat.bumpMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.bumpMap.clone(), maxTextureSize );

							}

							if ( mat.bumpMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data || map_to_process.image instanceof ImageBitmap ) {

								const xs = mat.bumpMap.repeat.x;
								const ys = mat.bumpMap.repeat.y;
								const xo = mat.bumpMap.offset.x;
								const yo = mat.bumpMap.offset.y;
								const ws = mat.bumpMap.wrapS;
								const wt = mat.bumpMap.wrapT;
								const xc = mat.bumpMap.center ? mat.bumpMap.center.x : 0;
								const yc = mat.bumpMap.center ? mat.bumpMap.center.y : 0;
								const rot = mat.bumpMap.rotation ? mat.bumpMap.rotation : 0;

								if ( map_uuids.includes( mat.bumpMap.uuid ) === false ) {

									name = 'bmMap' + count;

									map_uuids.push( mat.bumpMap.uuid );
									map_names[ mat.bumpMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									if ( mat.bumpScale === 1 ) {

										mtlOutput += 'map_bump -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + name + '.png' + '\n';

									} else {

										mtlOutput += 'map_bump -bm ' + mat.bumpScale + ' -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + name + '.png' + '\n';

									}

								} else {

									if ( mat.bumpScale === 1 ) {

										mtlOutput += 'map_bump -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + map_names[ mat.bumpMap.uuid ] + '.png' + '\n';

									} else {

										mtlOutput += 'map_bump -bm ' + mat.bumpScale + ' -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + map_names[ mat.bumpMap.uuid ] + '.png' + '\n';

									}

								}

							}

						}

						if ( mat.lightMap && mat.lightMap.image ) {

							let map_to_process = mat.lightMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.lightMap.clone(), maxTextureSize );

							}

							if ( mat.lightMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data || map_to_process.image instanceof ImageBitmap ) {

								const xs = mat.lightMap.repeat.x;
								const ys = mat.lightMap.repeat.y;
								const xo = mat.lightMap.offset.x;
								const yo = mat.lightMap.offset.y;
								const ws = mat.lightMap.wrapS;
								const wt = mat.lightMap.wrapT;
								const xc = mat.lightMap.center ? mat.lightMap.center.x : 0;
								const yc = mat.lightMap.center ? mat.lightMap.center.y : 0;
								const rot = mat.lightMap.rotation ? mat.lightMap.rotation : 0;

								if ( map_uuids.includes( mat.lightMap.uuid ) === false ) {

									name = 'ltMap' + count;

									map_uuids.push( mat.lightMap.uuid );
									map_names[ mat.lightMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'Pbr_pl_map -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'Pbr_pl_map -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + map_names[ mat.lightMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.metalnessMap && mat.metalnessMap.image ) {

							if ( map_Px_set === false ) {

								let map_to_process = mat.metalnessMap;

								if ( map_to_process.isCompressedTexture === true ) {

									map_to_process = decompress( mat.metalnessMap.clone(), maxTextureSize );

								}

								if ( mat.metalnessMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data || map_to_process.image instanceof ImageBitmap ) {

									const xs = mat.metalnessMap.repeat.x;
									const ys = mat.metalnessMap.repeat.y;
									const xo = mat.metalnessMap.offset.x;
									const yo = mat.metalnessMap.offset.y;
									const ws = mat.metalnessMap.wrapS;
									const wt = mat.metalnessMap.wrapT;
									const xc = mat.metalnessMap.center ? mat.metalnessMap.center.x : 0;
									const yc = mat.metalnessMap.center ? mat.metalnessMap.center.y : 0;
									const rot = mat.metalnessMap.rotation ? mat.metalnessMap.rotation : 0;

									if ( map_uuids.includes( mat.metalnessMap.uuid ) === false ) {

										name = 'metalMap' + count;

										map_uuids.push( mat.metalnessMap.uuid );
										map_names[ mat.metalnessMap.uuid ] = name;

										textures.push( {
											name,
											ext,
											data: imageToData( map_to_process.image, ext )
										});

										if ( mat.roughnessMap && mat.roughnessMap === mat.metalnessMap ) {

											mtlOutput += 'map_Px -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + name + '.png' + '\n';
											map_Px_set = true;

										} else {

											mtlOutput += 'map_Pm -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + name + '.png' + '\n';

										}

									} else {

										if ( mat.roughnessMap && mat.roughnessMap === mat.metalnessMap ) {

											mtlOutput += 'map_Px -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + map_names[ mat.metalnessMap.uuid ] + '.png' + '\n';
											map_Px_set = true;

										} else {

											mtlOutput += 'map_Pm -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + map_names[ mat.metalnessMap.uuid ] + '.png' + '\n';

										}

									}

								}

							}

						}

						if ( mat.roughnessMap && mat.roughnessMap.image ) {

							if ( map_Px_set === false ) {

								let map_to_process = mat.roughnessMap;

								if ( map_to_process.isCompressedTexture === true ) {

									map_to_process = decompress( mat.roughnessMap.clone(), maxTextureSize );

								}

								if ( mat.roughnessMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data || map_to_process.image instanceof ImageBitmap ) {

									const xs = mat.roughnessMap.repeat.x;
									const ys = mat.roughnessMap.repeat.y;
									const xo = mat.roughnessMap.offset.x;
									const yo = mat.roughnessMap.offset.y;
									const ws = mat.roughnessMap.wrapS;
									const wt = mat.roughnessMap.wrapT;
									const xc = mat.roughnessMap.center ? mat.roughnessMap.center.x : 0;
									const yc = mat.roughnessMap.center ? mat.roughnessMap.center.y : 0;
									const rot = mat.roughnessMap.rotation ? mat.roughnessMap.rotation : 0;

									if ( map_uuids.includes( mat.roughnessMap.uuid ) === false ) {

										name = 'roughMap' + count;

										map_uuids.push( mat.roughnessMap.uuid );
										map_names[ mat.roughnessMap.uuid ] = name;

										textures.push( {
											name,
											ext,
											data: imageToData( map_to_process.image, ext )
										});

										if ( mat.metalnessMap && mat.metalnessMap === mat.roughnessMap ) {

											mtlOutput += 'map_Px -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + name + '.png' + '\n';
											map_Px_set = true;

										} else {

											mtlOutput += 'map_Pr -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + name + '.png' + '\n';

										}

									} else {

										if ( mat.metalnessMap && mat.metalnessMap === mat.roughnessMap ) {

											mtlOutput += 'map_Px -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + map_names[ mat.roughnessMap.uuid ] + '.png' + '\n';
											map_Px_set = true;

										} else {

											mtlOutput += 'map_Pr -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + map_names[ mat.roughnessMap.uuid ] + '.png' + '\n';

										}

									}

								}

							}

						}

						if ( mat.displacementMap && mat.displacementMap.image ) {

							let map_to_process = mat.displacementMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.displacementMap.clone(), maxTextureSize );

							}

							if ( mat.displacementMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data || map_to_process.image instanceof ImageBitmap ) {

								const xs = mat.displacementMap.repeat.x;
								const ys = mat.displacementMap.repeat.y;
								const xo = mat.displacementMap.offset.x;
								const yo = mat.displacementMap.offset.y;
								const ws = mat.displacementMap.wrapS;
								const wt = mat.displacementMap.wrapT;
								const xc = mat.displacementMap.center ? mat.displacementMap.center.x : 0;
								const yc = mat.displacementMap.center ? mat.displacementMap.center.y : 0;
								const rot = mat.displacementMap.rotation ? mat.displacementMap.rotation : 0;

								if ( map_uuids.includes( mat.displacementMap.uuid ) === false ) {

									name = 'displaceMap' + count;

									map_uuids.push( mat.displacementMap.uuid );
									map_names[ mat.displacementMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'disp -mm ' + mat.displacementBias + ' ' + mat.displacementScale + ' -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'disp -mm ' + mat.displacementBias + ' ' + mat.displacementScale + ' -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + map_names[ mat.displacementMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.normalMap && mat.normalMap.image ) {

							let map_to_process = mat.normalMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.normalMap.clone(), maxTextureSize );

							}

							if ( mat.normalMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data || map_to_process.image instanceof ImageBitmap ) {

								const xs = mat.normalMap.repeat.x;
								const ys = mat.normalMap.repeat.y;
								const xo = mat.normalMap.offset.x;
								const yo = mat.normalMap.offset.y;
								const ws = mat.normalMap.wrapS;
								const wt = mat.normalMap.wrapT;
								const xc = mat.normalMap.center ? mat.normalMap.center.x : 0;
								const yc = mat.normalMap.center ? mat.normalMap.center.y : 0;
								const rot = mat.normalMap.rotation ? mat.normalMap.rotation : 0;

								if ( map_uuids.includes( mat.normalMap.uuid ) === false ) {

									name = 'norMap' + count;

									map_uuids.push( mat.normalMap.uuid );
									map_names[ mat.normalMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'norm -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'norm -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + map_names[ mat.normalMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.alphaMap && mat.alphaMap.image ) {

							let map_to_process = mat.alphaMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.alphaMap.clone(), maxTextureSize );

							}

							if ( mat.alphaMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data || map_to_process.image instanceof ImageBitmap ) {

								const xs = mat.alphaMap.repeat.x;
								const ys = mat.alphaMap.repeat.y;
								const xo = mat.alphaMap.offset.x;
								const yo = mat.alphaMap.offset.y;
								const ws = mat.alphaMap.wrapS;
								const wt = mat.alphaMap.wrapT;
								const xc = mat.alphaMap.center ? mat.alphaMap.center.x : 0;
								const yc = mat.alphaMap.center ? mat.alphaMap.center.y : 0;
								const rot = mat.alphaMap.rotation ? mat.alphaMap.rotation : 0;

								if ( map_uuids.includes( mat.alphaMap.uuid ) === false ) {

									name = 'alpMap' + count;

									map_uuids.push( mat.alphaMap.uuid );
									map_names[ mat.alphaMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_d -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_d -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + map_names[ mat.alphaMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.aoMap && mat.aoMap.image ) {

							let map_to_process = mat.aoMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.aoMap.clone(), maxTextureSize );

							}

							if ( mat.aoMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data || map_to_process.image instanceof ImageBitmap ) {

								const xs = mat.aoMap.repeat.x;
								const ys = mat.aoMap.repeat.y;
								const xo = mat.aoMap.offset.x;
								const yo = mat.aoMap.offset.y;
								const ws = mat.aoMap.wrapS;
								const wt = mat.aoMap.wrapT;
								const xc = mat.aoMap.center ? mat.aoMap.center.x : 0;
								const yc = mat.aoMap.center ? mat.aoMap.center.y : 0;
								const rot = mat.aoMap.rotation ? mat.aoMap.rotation : 0;

								if ( map_uuids.includes( mat.aoMap.uuid ) === false ) {

									name = 'ambMap' + count;

									map_uuids.push( mat.aoMap.uuid );
									map_names[ mat.aoMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Ka -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Ka -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + map_names[ mat.aoMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.anisotropyMap && mat.anisotropyMap.image ) {

							let map_to_process = mat.anisotropyMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.anisotropyMap.clone(), maxTextureSize );

							}

							if ( mat.anisotropyMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data || map_to_process.image instanceof ImageBitmap ) {

								const xs = mat.anisotropyMap.repeat.x;
								const ys = mat.anisotropyMap.repeat.y;
								const xo = mat.anisotropyMap.offset.x;
								const yo = mat.anisotropyMap.offset.y;
								const ws = mat.anisotropyMap.wrapS;
								const wt = mat.anisotropyMap.wrapT;
								const xc = mat.anisotropyMap.center.x;
								const yc = mat.anisotropyMap.center.y;
								const rot = mat.anisotropyMap.rotation;

								if ( map_uuids.includes( mat.anisotropyMap.uuid ) === false ) {

									name = 'anisMap' + count;

									map_uuids.push( mat.anisotropyMap.uuid );
									map_names[ mat.anisotropyMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Pa -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Pa -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + map_names[ mat.anisotropyMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.clearcoatMap && mat.clearcoatMap.image ) {

							let map_to_process = mat.clearcoatMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.clearcoatMap.clone(), maxTextureSize );

							}

							if ( mat.clearcoatMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data || map_to_process.image instanceof ImageBitmap ) {

								const xs = mat.clearcoatMap.repeat.x;
								const ys = mat.clearcoatMap.repeat.y;
								const xo = mat.clearcoatMap.offset.x;
								const yo = mat.clearcoatMap.offset.y;
								const ws = mat.clearcoatMap.wrapS;
								const wt = mat.clearcoatMap.wrapT;
								const xc = mat.clearcoatMap.center.x;
								const yc = mat.clearcoatMap.center.y;
								const rot = mat.clearcoatMap.rotation;

								if ( map_uuids.includes( mat.clearcoatMap.uuid ) === false ) {

									name = 'ccMap' + count;

									map_uuids.push( mat.clearcoatMap.uuid );
									map_names[ mat.clearcoatMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Pcc -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Pcc -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + map_names[ mat.clearcoatMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.clearcoatNormalMap && mat.clearcoatNormalMap.image ) {

							let map_to_process = mat.clearcoatNormalMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.clearcoatNormalMap.clone(), maxTextureSize );

							}

							if ( mat.clearcoatNormalMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data || map_to_process.image instanceof ImageBitmap ) {

								const xs = mat.clearcoatNormalMap.repeat.x;
								const ys = mat.clearcoatNormalMap.repeat.y;
								const xo = mat.clearcoatNormalMap.offset.x;
								const yo = mat.clearcoatNormalMap.offset.y;
								const ws = mat.clearcoatNormalMap.wrapS;
								const wt = mat.clearcoatNormalMap.wrapT;
								const xc = mat.clearcoatNormalMap.center.x;
								const yc = mat.clearcoatNormalMap.center.y;
								const rot = mat.clearcoatNormalMap.rotation;

								if ( map_uuids.includes( mat.clearcoatNormalMap.uuid ) === false ) {

									name = 'ccnMap' + count;

									map_uuids.push( mat.clearcoatNormalMap.uuid );
									map_names[ mat.clearcoatNormalMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Pcn -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Pcn -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + map_names[ mat.clearcoatNormalMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.clearcoatRoughnessMap && mat.clearcoatRoughnessMap.image ) {

							let map_to_process = mat.clearcoatRoughnessMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.clearcoatRoughnessMap.clone(), maxTextureSize );

							}

							if ( mat.clearcoatRoughnessMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data || map_to_process.image instanceof ImageBitmap ) {

								const xs = mat.clearcoatRoughnessMap.repeat.x;
								const ys = mat.clearcoatRoughnessMap.repeat.y;
								const xo = mat.clearcoatRoughnessMap.offset.x;
								const yo = mat.clearcoatRoughnessMap.offset.y;
								const ws = mat.clearcoatRoughnessMap.wrapS;
								const wt = mat.clearcoatRoughnessMap.wrapT;
								const xc = mat.clearcoatRoughnessMap.center.x;
								const yc = mat.clearcoatRoughnessMap.center.y;
								const rot = mat.clearcoatRoughnessMap.rotation;

								if ( map_uuids.includes( mat.clearcoatRoughnessMap.uuid ) === false ) {

									name = 'ccrMap' + count;

									map_uuids.push( mat.clearcoatRoughnessMap.uuid );
									map_names[ mat.clearcoatRoughnessMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Pcr -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Pcr -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + map_names[ mat.clearcoatRoughnessMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.iridescenceMap && mat.iridescenceMap.image ) {

							let map_to_process = mat.iridescenceMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.iridescenceMap.clone(), maxTextureSize );

							}

							if ( mat.iridescenceMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data || map_to_process.image instanceof ImageBitmap ) {

								const xs = mat.iridescenceMap.repeat.x;
								const ys = mat.iridescenceMap.repeat.y;
								const xo = mat.iridescenceMap.offset.x;
								const yo = mat.iridescenceMap.offset.y;
								const ws = mat.iridescenceMap.wrapS;
								const wt = mat.iridescenceMap.wrapT;
								const xc = mat.iridescenceMap.center.x;
								const yc = mat.iridescenceMap.center.y;
								const rot = mat.iridescenceMap.rotation;

								if ( map_uuids.includes( mat.iridescenceMap.uuid ) === false ) {

									name = 'irMap' + count;

									map_uuids.push( mat.iridescenceMap.uuid );
									map_names[ mat.iridescenceMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Pi -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Pi -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + map_names[ mat.iridescenceMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.iridescenceThicknessMap && mat.iridescenceThicknessMap.image ) {

							let map_to_process = mat.iridescenceThicknessMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.iridescenceThicknessMap.clone(), maxTextureSize );

							}

							if ( mat.iridescenceThicknessMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data || map_to_process.image instanceof ImageBitmap ) {

								const xs = mat.iridescenceThicknessMap.repeat.x;
								const ys = mat.iridescenceThicknessMap.repeat.y;
								const xo = mat.iridescenceThicknessMap.offset.x;
								const yo = mat.iridescenceThicknessMap.offset.y;
								const ws = mat.iridescenceThicknessMap.wrapS;
								const wt = mat.iridescenceThicknessMap.wrapT;
								const xc = mat.iridescenceThicknessMap.center.x;
								const yc = mat.iridescenceThicknessMap.center.y;
								const rot = mat.iridescenceThicknessMap.rotation;

								if ( map_uuids.includes( mat.iridescenceThicknessMap.uuid ) === false ) {

									name = 'irthMap' + count;

									map_uuids.push( mat.iridescenceThicknessMap.uuid );
									map_names[ mat.iridescenceThicknessMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Pit -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Pit -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + map_names[ mat.iridescenceThicknessMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.sheenColorMap && mat.sheenColorMap.image ) {

							let map_to_process = mat.sheenColorMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.sheenColorMap.clone(), maxTextureSize );

							}

							if ( mat.sheenColorMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data || map_to_process.image instanceof ImageBitmap ) {

								const xs = mat.sheenColorMap.repeat.x;
								const ys = mat.sheenColorMap.repeat.y;
								const xo = mat.sheenColorMap.offset.x;
								const yo = mat.sheenColorMap.offset.y;
								const ws = mat.sheenColorMap.wrapS;
								const wt = mat.sheenColorMap.wrapT;
								const xc = mat.sheenColorMap.center.x;
								const yc = mat.sheenColorMap.center.y;
								const rot = mat.sheenColorMap.rotation;

								if ( map_uuids.includes( mat.sheenColorMap.uuid ) === false ) {

									name = 'shcMap' + count;

									map_uuids.push( mat.sheenColorMap.uuid );
									map_names[ mat.sheenColorMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Psc -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Psc -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + map_names[ mat.sheenColorMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.sheenRoughnessMap && mat.sheenRoughnessMap.image ) {

							let map_to_process = mat.sheenRoughnessMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.sheenRoughnessMap.clone(), maxTextureSize );

							}

							if ( mat.sheenRoughnessMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data || map_to_process.image instanceof ImageBitmap ) {

								const xs = mat.sheenRoughnessMap.repeat.x;
								const ys = mat.sheenRoughnessMap.repeat.y;
								const xo = mat.sheenRoughnessMap.offset.x;
								const yo = mat.sheenRoughnessMap.offset.y;
								const ws = mat.sheenRoughnessMap.wrapS;
								const wt = mat.sheenRoughnessMap.wrapT;
								const xc = mat.sheenRoughnessMap.center.x;
								const yc = mat.sheenRoughnessMap.center.y;
								const rot = mat.sheenRoughnessMap.rotation;

								if ( map_uuids.includes( mat.sheenRoughnessMap.uuid ) === false ) {

									name = 'shrMap' + count;

									map_uuids.push( mat.sheenRoughnessMap.uuid );
									map_names[ mat.sheenRoughnessMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Psr -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Psr -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + map_names[ mat.sheenRoughnessMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.specularIntensityMap && mat.specularIntensityMap.image ) {

							let map_to_process = mat.specularIntensityMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.specularIntensityMap.clone(), maxTextureSize );

							}

							if ( mat.specularIntensityMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data || map_to_process.image instanceof ImageBitmap ) {

								const xs = mat.specularIntensityMap.repeat.x;
								const ys = mat.specularIntensityMap.repeat.y;
								const xo = mat.specularIntensityMap.offset.x;
								const yo = mat.specularIntensityMap.offset.y;
								const ws = mat.specularIntensityMap.wrapS;
								const wt = mat.specularIntensityMap.wrapT;
								const xc = mat.specularIntensityMap.center.x;
								const yc = mat.specularIntensityMap.center.y;
								const rot = mat.specularIntensityMap.rotation;

								if ( map_uuids.includes( mat.specularIntensityMap.uuid ) === false ) {

									name = 'spiMap' + count;

									map_uuids.push( mat.specularIntensityMap.uuid );
									map_names[ mat.specularIntensityMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Psi -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Psi -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + map_names[ mat.specularIntensityMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.specularColorMap && mat.specularColorMap.image ) {

							let map_to_process = mat.specularColorMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.specularColorMap.clone(), maxTextureSize );

							}

							if ( mat.specularColorMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data || map_to_process.image instanceof ImageBitmap ) {

								const xs = mat.specularColorMap.repeat.x;
								const ys = mat.specularColorMap.repeat.y;
								const xo = mat.specularColorMap.offset.x;
								const yo = mat.specularColorMap.offset.y;
								const ws = mat.specularColorMap.wrapS;
								const wt = mat.specularColorMap.wrapT;
								const xc = mat.specularColorMap.center.x;
								const yc = mat.specularColorMap.center.y;
								const rot = mat.specularColorMap.rotation;

								if ( map_uuids.includes( mat.specularColorMap.uuid ) === false ) {

									name = 'spcMap' + count;

									map_uuids.push( mat.specularColorMap.uuid );
									map_names[ mat.specularColorMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Psp -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Psp -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + map_names[ mat.specularColorMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.thicknessMap && mat.thicknessMap.image ) {

							let map_to_process = mat.thicknessMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.thicknessMap.clone(), maxTextureSize );

							}

							if ( mat.thicknessMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data || map_to_process.image instanceof ImageBitmap ) {

								const xs = mat.thicknessMap.repeat.x;
								const ys = mat.thicknessMap.repeat.y;
								const xo = mat.thicknessMap.offset.x;
								const yo = mat.thicknessMap.offset.y;
								const ws = mat.thicknessMap.wrapS;
								const wt = mat.thicknessMap.wrapT;
								const xc = mat.thicknessMap.center.x;
								const yc = mat.thicknessMap.center.y;
								const rot = mat.thicknessMap.rotation;

								if ( map_uuids.includes( mat.thicknessMap.uuid ) === false ) {

									name = 'thMap' + count;

									map_uuids.push( mat.thicknessMap.uuid );
									map_names[ mat.thicknessMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Pth -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Pth -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + map_names[ mat.thicknessMap.uuid ] + '.png' + '\n';

								}

							}

						}

						if ( mat.transmissionMap && mat.transmissionMap.image ) {

							let map_to_process = mat.transmissionMap;

							if ( map_to_process.isCompressedTexture === true ) {

								map_to_process = decompress( mat.transmissionMap.clone(), maxTextureSize );

							}

							if ( mat.transmissionMap.isCompressedTexture === true || map_to_process.image.src || map_to_process.image.data || map_to_process.image instanceof ImageBitmap ) {

								const xs = mat.transmissionMap.repeat.x;
								const ys = mat.transmissionMap.repeat.y;
								const xo = mat.transmissionMap.offset.x;
								const yo = mat.transmissionMap.offset.y;
								const ws = mat.transmissionMap.wrapS;
								const wt = mat.transmissionMap.wrapT;
								const xc = mat.transmissionMap.center.x;
								const yc = mat.transmissionMap.center.y;
								const rot = mat.transmissionMap.rotation;

								if ( map_uuids.includes( mat.transmissionMap.uuid ) === false ) {

									name = 'trMap' + count;

									map_uuids.push( mat.transmissionMap.uuid );
									map_names[ mat.transmissionMap.uuid ] = name;

									textures.push( {
										name,
										ext,
										data: imageToData( map_to_process.image, ext )
									});

									mtlOutput += 'map_Ptr -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + name + '.png' + '\n';

								} else {

									mtlOutput += 'map_Ptr -r ' + rot + ' -c ' + xc + ' ' + yc + ' -s ' + xs + ' ' + ys + ' 1' + ' -o ' + xo + ' ' + yo + ' 0 ' + '-w ' + ws + ' ' + wt + ' ' + map_names[ mat.transmissionMap.uuid ] + '.png' + '\n';

								}

							}

						}

						count += 1;

					}

				}

				Promise.all( textures ).then( () => {

					if ( typeof onDone === 'function' ) {

						onDone( { obj: output, mtl: mtlOutput, tex: textures } );

					} else {

						return { obj: output, mtl: mtlOutput, tex: textures };

					}

				});

			} else {

				if ( typeof onDone === 'function' ) {

					onDone( { obj: output } );

				} else {

					return { obj: output };

				}

			}

			// the following functions were adopted from ColladaExporter.js

			function imageToData( image, ext ) {

				let canvas, ctx;

				canvas = canvas || document.createElement( 'canvas' );

				let scale = maxTextureSize / Math.max( image.width, image.height );

				canvas.width = image.width * Math.min( 1, scale );
				canvas.height = image.height * Math.min( 1, scale );

				ctx = ctx || canvas.getContext( '2d' );

				if ( map_flip_required === true ) {

					// Flip image vertically

					ctx.translate( 0, canvas.height );
					ctx.scale( 1, - 1 );

				}

				// this seems to also work fine for exporting TGA images as PNG
				if ( image instanceof ImageData ) {

					ctx.putImageData( image, 0, 0 );
	
				} else if ( image.data && ( image.data.constructor === Float32Array || image.data.constructor === Uint16Array ) ) {

					let f32 = image.data.constructor === Float32Array;
					let u8 = new Uint8Array( image.data.length );
					let fromHF = THREE.DataUtils.fromHalfFloat;

					for ( let i = 0; i < image.data.length; i ++ ) {
					  let tmp = Math.max( -1, Math.min( 1, f32 === true ? image.data[ i ] : fromHF( image.data[ i ] ) ) );
					  tmp = tmp < 0 ? ( tmp * 0x8000 ) : ( tmp * 0x7FFF );
					  u8[ i ] = tmp / 128.0;
					}

					let imgData = new ImageData( new Uint8ClampedArray( u8.buffer ), image.width, image.height );
					ctx.putImageData( imgData, 0, 0 );

				} else if ( image.data && image.data.constructor === Uint8Array ) {

					let imgData = new ImageData( new Uint8ClampedArray( image.data ), image.width, image.height );

					ctx.putImageData( imgData, 0, 0 );

				} else {

					ctx.drawImage( image, 0, 0, canvas.width, canvas.height );

				}

				// Get the base64 encoded data
				const base64data = canvas.toDataURL( `image/${ext}`, 1 ).split( ',' )[ 1 ];

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

			// decompress function is from TextureUtils.js

			function decompress( texture, maxTextureSize = 16384, renderer = null ) {

				let _renderer;
				let fullscreenQuadGeometry;
				let fullscreenQuadMaterial;
				let fullscreenQuad;

				if ( ! fullscreenQuadGeometry ) fullscreenQuadGeometry = new THREE.PlaneGeometry( 2, 2, 1, 1 );
				if ( ! fullscreenQuadMaterial ) fullscreenQuadMaterial = new THREE.ShaderMaterial( {
					uniforms: { blitTexture: new THREE.Uniform( texture ) },
					vertexShader: `
						varying vec2 vUv;
						void main(){
							vUv = uv;
							gl_Position = vec4(position.xy * 1.0,0.,.999999);
						}`,
					fragmentShader: `
						uniform sampler2D blitTexture; 
						varying vec2 vUv;
		
						void main(){ 
							gl_FragColor = vec4(vUv.xy, 0., 1.0);
						
							#ifdef IS_SRGB
							gl_FragColor = LinearTosRGB( texture2D( blitTexture, vUv) );
							#else
							gl_FragColor = texture2D( blitTexture, vUv);
							#endif
						}`
				} );

				fullscreenQuadMaterial.uniforms.blitTexture.value = texture;
				fullscreenQuadMaterial.defines.IS_SRGB = texture.colorSpace == THREE.SRGBColorSpace;
				fullscreenQuadMaterial.needsUpdate = true;

				if ( ! fullscreenQuad ) {

					fullscreenQuad = new THREE.Mesh( fullscreenQuadGeometry, fullscreenQuadMaterial );
					fullscreenQuad.frustrumCulled = false;

				}

				const _camera = new THREE.PerspectiveCamera();
				const _scene = new THREE.Scene();
				_scene.add( fullscreenQuad );

				if ( ! renderer ) {

					renderer = _renderer = new THREE.WebGLRenderer( { antialias: false } );

				}

				renderer.setSize( Math.min( texture.image.width, maxTextureSize ), Math.min( texture.image.height, maxTextureSize ) );
				renderer.clear();
				renderer.render( _scene, _camera );

				const readableTexture = new THREE.Texture( renderer.domElement );

				readableTexture.minFilter = texture.minFilter;
				readableTexture.magFilter = texture.magFilter;
				readableTexture.wrapS = texture.wrapS;
				readableTexture.wrapT = texture.wrapT;
				readableTexture.name = texture.name;

				if ( _renderer ) {

					_renderer.dispose();
					_renderer = null;

				}

				fullscreenQuadMaterial.dispose();
				fullscreenQuadGeometry.dispose();
				texture.dispose();

				return readableTexture;

			}

		}

	}

	THREE.OBJExporter = OBJExporter;

} )();
