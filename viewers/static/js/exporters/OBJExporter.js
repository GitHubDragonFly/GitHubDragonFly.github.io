( function () {

	class OBJExporter {

		parse( object, filename ) {

			let output = '';
			let indexVertex = 0;
			let indexVertexUvs = 0;
			let indexNormals = 0;
			let mesh_count = 0;
			let materials = {};
			let multi_materials = {};
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
				const geometry = mesh.geometry;
				const normalMatrixWorld = new THREE.Matrix3();

				if ( geometry.isBufferGeometry !== true ) {

					throw new Error( 'THREE.OBJExporter: Geometry is not of type THREE.BufferGeometry.' );

				} // shortcuts

				const groups = geometry.groups;
				const vertex_colors = geometry.getAttribute( 'color' );
				const vertices = geometry.getAttribute( 'position' );
				const normals = geometry.getAttribute( 'normal' );
				const uvs = geometry.getAttribute( 'uv' );
				const indices = geometry.getIndex(); // name of the mesh object

				if (mesh.name === '') {
					mesh[ 'name' ] = 'mesh_' + mesh_count;
					mesh_count += 1;
				} else {
					mesh.name = mesh.name.replace( '#', '' );
					mesh.name = mesh.name.replace( ' ', '_' );
				}

				output += 'o ' + mesh.name + '\n'; // name of the mesh material

				if ( mesh.material && mesh.material.name ) {

					if (mesh.material.name === '') {
						mesh.material[ 'name' ] = 'mesh_material_' + mesh_count;
						mesh_count += 1;
					} else if ( mesh.material.name.toUpperCase().endsWith( '.PNG' ) || mesh.material.name.toUpperCase().endsWith( '.JPG' ) ) {
						mesh.material[ 'name' ] = mesh.material.name.substring( 0, mesh.material.name.lastIndexOf( '.' ) );
					}

					mesh.material.name = mesh.material.name.replace( '#', '' );
					mesh.material.name = mesh.material.name.replace( ' ', '_' );

					let temp_name = mesh.material.name;

					if (material_names.includes( temp_name ) === false || material_colors.temp_name !== mesh.material.color) {
						if (material_colors.temp_name !== mesh.material.color) mesh.material.name = temp_name + '_' + mesh.material.id;

						material_names.push( mesh.material.name );
						material_colors[ mesh.material.name ] = mesh.material.color;
					}

					output += 'usemtl ' + mesh.material.name + '\n';
					materials[ mesh.material.id ] = mesh.material;

				} else if ( mesh.material && Array.isArray( mesh.material ) ) {

					materials[ 'multi_' + mesh.name ] = mesh.material;

					if ( groups !== undefined ) {

						for ( let i = 0, l = groups.length; i < l; i ++ ) {

							if (mesh.material[ groups[ i ].materialIndex ].name === '') {
								mesh.material[ groups[ i ].materialIndex ][ 'name' ] = 'mesh_group_material_' + mesh_count;
								mesh_count += 1;
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
					materials[ mesh.material.id ] = mesh.material;

				} // vertices


				if ( vertices !== undefined ) {

					for ( let i = 0, l = vertices.count; i < l; i ++, nbVertex ++ ) {

						vertex.x = vertices.getX( i );
						vertex.y = vertices.getY( i );
						vertex.z = vertices.getZ( i ); // transform the vertex to world space

						vertex.applyMatrix4( mesh.matrixWorld ); // transform the vertex to export format

						if ( vertex_colors ) {

							output += 'v ' + vertex.x + ' ' + vertex.y + ' ' + vertex.z + ' ' + vertex_colors.getX( i ) + ' ' + vertex_colors.getY( i ) + ' ' + vertex_colors.getZ( i ) + '\n';

						} else {

							output += 'v ' + vertex.x + ' ' + vertex.y + ' ' + vertex.z + '\n';

						}

					}

				} // uvs


				if ( uvs !== undefined ) {

					for ( let i = 0, l = uvs.count; i < l; i ++, nbVertexUvs ++ ) {

						uv.x = uvs.getX( i );
						uv.y = uvs.getY( i ); // transform the uv to export format

						output += 'vt ' + uv.x + ' ' + uv.y + '\n';

					}

				} // normals


				if ( normals !== undefined ) {

					normalMatrixWorld.getNormalMatrix( mesh.matrixWorld );

					for ( let i = 0, l = normals.count; i < l; i ++, nbNormals ++ ) {

						normal.x = normals.getX( i );
						normal.y = normals.getY( i );
						normal.z = normals.getZ( i ); // transform the normal to world space

						normal.applyMatrix3( normalMatrixWorld ).normalize(); // transform the normal to export format

						output += 'vn ' + normal.x + ' ' + normal.y + ' ' + normal.z + '\n';

					}

				} // faces


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

						} // transform the face to export format


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

						} // transform the face to export format


						output += 'f ' + face.join( ' ' ) + '\n';

					}

				} // update index


				indexVertex += nbVertex;
				indexVertexUvs += nbVertexUvs;
				indexNormals += nbNormals;

			}

			function parseLine( line ) {

				let nbVertex = 0;
				const geometry = line.geometry;
				const type = line.type;

				if ( geometry.isBufferGeometry !== true ) {

					throw new Error( 'THREE.OBJExporter: Geometry is not of type THREE.BufferGeometry.' );

				} // shortcuts


				const vertices = geometry.getAttribute( 'position' ); // name of the line object

				output += 'o ' + line.name + '\n';

				if ( vertices !== undefined ) {

					for ( let i = 0, l = vertices.count; i < l; i ++, nbVertex ++ ) {

						vertex.x = vertices.getX( i );
						vertex.y = vertices.getY( i );
						vertex.z = vertices.getZ( i ); // transform the vertex to world space

						vertex.applyMatrix4( line.matrixWorld ); // transform the vertex to export format

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

				} // update index


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

				} // update index

				indexVertex += nbVertex;

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

				output = 'mtllib ' + filename + 'mtl' + '\n' + output; // add name of the material library

				let mtlOutput = '# MTL file - created by a modified three.js OBJExporter' + '\n';
				let textures = [];
				let names = [];
				const ext = 'png';
				let count = 1;

				Object.keys( materials ).forEach( ( key ) => {

					if ( Array.isArray( materials[ key ] )) {

						materials[ key ].forEach( ( mtl ) => {

							let mat = mtl;

							let name = ( mat.name && mat.name !== '' ) ? ( ( mat.name.toUpperCase().endsWith( '.PNG' ) || mat.name.toUpperCase().endsWith( '.JPG' ) ) ? mat.name.substring(0, mat.name.lastIndexOf( '.' ) ) : mat.name ) : 'material' + mat.id;
							name = name.replace( '#', '' );
							name = name.replace( ' ', '_' );

							if ( names.includes( name ) === false ) {

								names.push( name );

								let transparency = ( mat.opacity < 1 ) ? ( 1 - mat.opacity ) : '0.0000';

								mtlOutput += '\n' + 'newmtl ' + name + '\n';

								mtlOutput += 'Ns 15.0000\n';
								mtlOutput += 'Ni 1.5000\n';
								mtlOutput += 'd 1.0000\n';
								mtlOutput += 'Tr ' + transparency + '\n';
								mtlOutput += 'Tf 1.0000 1.0000 1.0000\n';
								mtlOutput += 'illum 2\n';
								mtlOutput += 'Ka 0.7500 0.7500 0.7500\n';
								mtlOutput += 'Kd ' + mat.color.r + ' ' + mat.color.g + ' ' + mat.color.b + ' ' + '\n';
								mtlOutput += mat.specular ? 'Ks ' + mat.specular.r + ' ' + mat.specular.g + ' ' + mat.specular.b + ' ' + '\n' : 'Ks 0.2500 0.2500 0.2500\n';
								mtlOutput += mat.emissive ? 'Ke ' + mat.emissive.r + ' ' + mat.emissive.g + ' ' + mat.emissive.b + ' ' + '\n' : 'Ke 0.0000 0.0000 0.0000\n';

								if ( mat.map && mat.map.type === 1009 && mat.map.image ) {

									if ( mat.map.image.src || mat.map.image.data ) {

										textures.push( {
											name,
											ext,
											data: imageToData( mat.map.image, ext )
										});

										mtlOutput += 'map_Kd ' + name + '.png' + '\n';

									}

								}

								if ( mat.specularMap && mat.specularMap.type === 1009 && mat.specularMap.image ) {

									if ( mat.specularMap.image.src || mat.specularMap.image.data ) {

										name = 'specularMap' + count;

										textures.push( {
											name,
											ext,
											data: imageToData( mat.specularMap.image, ext )
										});

										mtlOutput += 'map_Ks ' + name + '.png' + '\n';

									}

								}

								if ( mat.emissiveMap && mat.emissiveMap.type === 1009 && mat.emissiveMap.image ) {

									if ( mat.emissiveMap.image.src || mat.emissiveMap.image.data ) {

										name = 'emissiveMap' + count;

										textures.push( {
											name,
											ext,
											data: imageToData( mat.emissiveMap.image, ext )
										});

										mtlOutput += 'map_Ke ' + name + '.png' + '\n';

									}

								}

								if ( mat.bumpMap && mat.bumpMap.type === 1009 && mat.bumpMap.image ) {

									if ( mat.bumpMap.image.src || mat.bumpMap.image.data ) {

										name = 'bumpMap' + count;

										textures.push( {
											name,
											ext,
											data: imageToData( mat.bumpMap.image, ext )
										});

										mtlOutput += 'map_bump ' + name + '.png' + '\n';

									}

								}

								if ( mat.roughnessMap && mat.roughnessMap.type === 1009 && mat.roughnessMap.image ) {

									if ( mat.roughnessMap.image.src || mat.roughnessMap.image.data ) {

										name = 'bumpMap' + count;

										textures.push( {
											name,
											ext,
											data: imageToData( mat.roughnessMap.image, ext )
										});

										mtlOutput += 'map_bump ' + name + '.png' + '\n';

									}

								}

								if ( mat.normalMap && mat.normalMap.type === 1009 && mat.normalMap.image ) {

									if ( mat.normalMap.image.src || mat.normalMap.image.data ) {

										name = 'normalMap' + count;

										textures.push( {
											name,
											ext,
											data: imageToData( mat.normalMap.image, ext )
										});

										mtlOutput += 'norm ' + name + '.png' + '\n';

									}

								}

								if ( mat.alphaMap && mat.alphaMap.type === 1009 && mat.alphaMap.image ) {

									if ( mat.alphaMap.image.src || mat.alphaMap.image.data ) {

										name = 'alphaMap' + count;

										textures.push( {
											name,
											ext,
											data: imageToData( mat.alphaMap.image, ext )
										});

										mtlOutput += 'map_d ' + name + '.png' + '\n';

									}

								}

								if ( mat.aoMap && mat.aoMap.type === 1009 && mat.aoMap.image ) {

									if ( mat.aoMap.image.src || mat.aoMap.image.data ) {

										name = 'ambientMap' + count;

										textures.push( {
											name,
											ext,
											data: imageToData( mat.aoMap.image, ext )
										});

										mtlOutput += 'map_Ka ' + name + '.png' + '\n';

									}

								}

								count += 1;

							}

						});

					} else {

						let mat = materials[ key ];

						let name = ( mat.name && mat.name !== '' ) ? ( ( mat.name.toUpperCase().endsWith( '.PNG' ) || mat.name.toUpperCase().endsWith( '.JPG' ) ) ? mat.name.substring(0, mat.name.lastIndexOf( '.' ) ) : mat.name ) : 'material' + mat.id;
						name = name.replace( '#', '' );
						name = name.replace( ' ', '_' );

						if ( names.includes( name ) === false ) {

							names.push( name );

							let transparency = ( mat.opacity < 1 ) ? ( 1 - mat.opacity ) : '0.0000';

							mtlOutput += '\n' + 'newmtl ' + name + '\n';

							mtlOutput += 'Ns 15.0000\n';
							mtlOutput += 'Ni 1.5000\n';
							mtlOutput += 'd 1.0000\n';
							mtlOutput += 'Tr ' + transparency + '\n';
							mtlOutput += 'Tf 1.0000 1.0000 1.0000\n';
							mtlOutput += 'illum 2\n';
							mtlOutput += 'Ka 0.7500 0.7500 0.7500\n';
							mtlOutput += 'Kd ' + mat.color.r + ' ' + mat.color.g + ' ' + mat.color.b + ' ' + '\n';
							mtlOutput += mat.specular ? 'Ks ' + mat.specular.r + ' ' + mat.specular.g + ' ' + mat.specular.b + ' ' + '\n' : 'Ks 0.2500 0.2500 0.2500\n';
							mtlOutput += mat.emissive ? 'Ke ' + mat.emissive.r + ' ' + mat.emissive.g + ' ' + mat.emissive.b + ' ' + '\n' : 'Ke 0.0000 0.0000 0.0000\n';

							if ( mat.map && mat.map.type === 1009 && mat.map.image ) {

								if ( mat.map.image.src || mat.map.image.data ) {

									textures.push( {
										name,
										ext,
										data: imageToData( mat.map.image, ext )
									});

									mtlOutput += 'map_Kd ' + name + '.png' + '\n';

								}

							}

							if ( mat.specularMap && mat.specularMap.type === 1009 && mat.specularMap.image ) {

								if ( mat.specularMap.image.src || mat.specularMap.image.data ) {

									name = 'specularMap' + count;

									textures.push( {
										name,
										ext,
										data: imageToData( mat.specularMap.image, ext )
									});

									mtlOutput += 'map_Ks ' + name + '.png' + '\n';

								}

							}

							if ( mat.emissiveMap && mat.emissiveMap.type === 1009 && mat.emissiveMap.image ) {

								if ( mat.emissiveMap.image.src || mat.emissiveMap.image.data ) {

									name = 'emissiveMap' + count;

									textures.push( {
										name,
										ext,
										data: imageToData( mat.emissiveMap.image, ext )
									});

									mtlOutput += 'map_Ke ' + name + '.png' + '\n';

								}

							}

							if ( mat.bumpMap && mat.bumpMap.type === 1009 && mat.bumpMap.image ) {

								if ( mat.bumpMap.image.src || mat.bumpMap.image.data ) {

									name = 'bumpMap' + count;

									textures.push( {
										name,
										ext,
										data: imageToData( mat.bumpMap.image, ext )
									});

									mtlOutput += 'map_bump ' + name + '.png' + '\n';

								}

							}

							if ( mat.roughnessMap && mat.roughnessMap.type === 1009 && mat.roughnessMap.image ) {

								if ( mat.roughnessMap.image.src || mat.roughnessMap.image.data ) {

									name = 'bumpMap' + count;

									textures.push( {
										name,
										ext,
										data: imageToData( mat.roughnessMap.image, ext )
									});

									mtlOutput += 'map_bump ' + name + '.png' + '\n';

								}

							}

							if ( mat.normalMap && mat.normalMap.type === 1009 && mat.normalMap.image ) {

								if ( mat.normalMap.image.src || mat.normalMap.image.data ) {

									name = 'normalMap' + count;

									textures.push( {
										name,
										ext,
										data: imageToData( mat.normalMap.image, ext )
									});

									mtlOutput += 'norm ' + name + '.png' + '\n';

								}

							}

							if ( mat.alphaMap && mat.alphaMap.type === 1009 && mat.alphaMap.image ) {

								if ( mat.alphaMap.image.src || mat.alphaMap.image.data ) {

									name = 'alphaMap' + count;

									textures.push( {
										name,
										ext,
										data: imageToData( mat.alphaMap.image, ext )
									});

									mtlOutput += 'map_d ' + name + '.png' + '\n';

								}

							}

							if ( mat.aoMap && mat.aoMap.type === 1009 && mat.aoMap.image ) {

								if ( mat.aoMap.image.src || mat.aoMap.image.data ) {

									name = 'ambientMap' + count;

									textures.push( {
										name,
										ext,
										data: imageToData( mat.aoMap.image, ext )
									});

									mtlOutput += 'map_Ka ' + name + '.png' + '\n';

								}

							}

							count += 1;

						}

					}

				});

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

					let imgData = ctx.createImageData( image.width, image.height );

					for (let i = 0; i < imgData.data.length; i += 4) {

						imgData.data[ i + 0 ] = image.data[ i + 0 ];
					  	imgData.data[ i + 1 ] = image.data[ i + 1 ];
					  	imgData.data[ i + 2 ] = image.data[ i + 2 ];
					  	imgData.data[ i + 3 ] = image.data[ i + 3 ];

					}

					ctx.putImageData( imgData, 0, 0 );

				} else {

					ctx.drawImage( image, 0, 0 ); // Get the base64 encoded data

				}

				const base64data = canvas.toDataURL( `image/${ext}`, 1 ).replace( /^data:image\/(png|jpg);base64,/, '' ); // Convert to a uint8 array

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
