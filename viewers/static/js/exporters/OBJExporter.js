( function () {

	class OBJExporter {

		parse( object ) {

			let output = '';
			let indexVertex = 0;
			let indexVertexUvs = 0;
			let indexNormals = 0;
			let materials = {};
			let multi_materials = {};
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

				output += 'o ' + mesh.name + '\n'; // name of the mesh material

				if ( mesh.material && mesh.material.name ) {

					output += 'usemtl ' + mesh.material.name + '\n';
					materials[ mesh.material.id ] = mesh.material;

				} else if ( mesh.material && Array.isArray( mesh.material ) ) {

					materials[ 'multi_' + mesh.name ] = mesh.material;

					if ( groups !== undefined ) {

						for ( let i = 0, l = groups.length; i < l; i ++ ) {

							multi_materials[ groups[ i ].start ] = 'multi_' + mesh.material[ groups[ i ].materialIndex ].name;

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
      
				let mtlOutput = '';
				let textures = [];
				const ext = 'png';
				let count = 1;
      
				Object.keys( materials ).forEach( ( key ) => {

					if ( Array.isArray( materials[ key ] )) {

						materials[ key ].forEach( ( mtl ) => {

							let mat = mtl;
							let name = 'multi_' + ( mat.name ? ( mat.name.toUpperCase().endsWith( '.PNG' ) ? mat.name.substring(0, mat.name.lastIndexOf( '.' ) ) : mat.name ) : mat.name ) || 'material' + mat.id;
		
							mtlOutput += 'newmtl ' + name + '\n';
		
							mtlOutput += 'Ns 15.0000\n';
							mtlOutput += 'Ni 1.5000\n';
							mtlOutput += 'd 1.0000\n';
							mtlOutput += 'Tr 0.0000\n';
							mtlOutput += 'Tf 1.0000 1.0000 1.0000\n';
							mtlOutput += 'illum 2\n';
							mtlOutput += 'Ka 0.7500 0.7500 0.7500\n';
							mtlOutput += 'Kd ' + mat.color.r + ' ' + mat.color.g + ' ' + mat.color.b + ' ' + '\n';
							mtlOutput += 'Ks 0.2500 0.2500 0.2500\n';
							mtlOutput += mat.emissive ? 'Ke ' + mat.emissive.r + ' ' + mat.emissive.g + ' ' + mat.emissive.b + ' ' + '\n' : 'Ke 0.0000 0.0000 0.0000\n';
		
							if ( mat.map && mat.map instanceof THREE.Texture ) {
		
								textures.push( {
									name,
									ext,
									data: imageToData( mat.map.image, ext )
								});
			
								mtlOutput += 'map_Kd ' + name + '.png' + '\n';
		
							}
							
							if ( mat.emissiveMap && mat.emissiveMap instanceof THREE.Texture ) {
		
								name = 'emissiveMap' + count;
		
								textures.push( {
									name,
									ext,
									data: imageToData( mat.emissiveMap.image, ext )
								});
			
								mtlOutput += 'map_Ke ' + name + '.png' + '\n';
		
							}
		
							if ( mat.bumpMap && mat.bumpMap instanceof THREE.Texture ) {

								name = 'bumpMap' + count;
		
								textures.push( {
									name,
									ext,
									data: imageToData( mat.bumpMap.image, ext )
								});
			
								mtlOutput += 'map_bump ' + name + '.png' + '\n';
		
							}
		
							if ( mat.roughnessMap && mat.roughnessMap instanceof THREE.Texture ) {
		
								name = 'bump' + count;
		
								textures.push( {
									name,
									ext,
									data: imageToData( mat.roughnessMap.image, ext )
								});
			
								mtlOutput += 'bump ' + name + '.png' + '\n';
		
							}
			
							if ( mat.normalMap && mat.normalMap instanceof THREE.Texture ) {
		
								name = 'normalMap' + count;
		
								textures.push( {
									name,
									ext,
									data: imageToData( mat.normalMap.image, ext )
								});
			
								mtlOutput += 'map_Ks ' + name + '.png' + '\n';
		
							}
		
							if ( mat.alphaMap && mat.alphaMap instanceof THREE.Texture ) {
		
								name = 'alphaMap' + count;
		
								textures.push( {
									name,
									ext,
									data: imageToData( mat.alphaMap.image, ext )
								});
			
								mtlOutput += 'map_d ' + name + '.png' + '\n';
		
							}
		
							if ( mat.aoMap && mat.aoMap instanceof THREE.Texture ) {
		
								name = 'ambientMap' + count;
		
								textures.push( {
									name,
									ext,
									data: imageToData( mat.aoMap.image, ext )
								});
			
								mtlOutput += 'map_Ka ' + name + '.png' + '\n';
		
							}
		
							count += 1;
	
	
						});

					} else {

						let mat = materials[ key ];
						let name = ( mat.name ? ( mat.name.toUpperCase().endsWith( '.PNG' ) ? mat.name.substring(0, mat.name.lastIndexOf( '.' ) ) : mat.name ) : mat.name ) || 'material' + mat.id;
	
						mtlOutput += 'newmtl ' + name + '\n';
	
						mtlOutput += 'Ns 15.0000\n';
						mtlOutput += 'Ni 1.5000\n';
						mtlOutput += 'd 1.0000\n';
						mtlOutput += 'Tr 0.0000\n';
						mtlOutput += 'Tf 1.0000 1.0000 1.0000\n';
						mtlOutput += 'illum 2\n';
						mtlOutput += 'Ka 0.7500 0.7500 0.7500\n';
						mtlOutput += 'Kd ' + mat.color.r + ' ' + mat.color.g + ' ' + mat.color.b + ' ' + '\n';
						mtlOutput += 'Ks 0.2500 0.2500 0.2500\n';
						mtlOutput += mat.emissive ? 'Ke ' + mat.emissive.r + ' ' + mat.emissive.g + ' ' + mat.emissive.b + ' ' + '\n' : 'Ke 0.0000 0.0000 0.0000\n';
	
						if ( mat.map && mat.map instanceof THREE.Texture ) {
	
							textures.push( {
								name,
								ext,
								data: imageToData( mat.map.image, ext )
							});
		
							mtlOutput += 'map_Kd ' + name + '.png' + '\n';
	
						}
						
						if ( mat.emissiveMap && mat.emissiveMap instanceof THREE.Texture ) {
	
							name = 'emissiveMap' + count;
	
							textures.push( {
								name,
								ext,
								data: imageToData( mat.emissiveMap.image, ext )
							});
		
							mtlOutput += 'map_Ke ' + name + '.png' + '\n';
	
						}
	
						if ( mat.bumpMap && mat.bumpMap instanceof THREE.Texture ) {

							name = 'bumpMap' + count;
	
							textures.push( {
								name,
								ext,
								data: imageToData( mat.bumpMap.image, ext )
							});
		
							mtlOutput += 'map_bump ' + name + '.png' + '\n';
	
						}
	
						if ( mat.roughnessMap && mat.roughnessMap instanceof THREE.Texture ) {
	
							name = 'bump' + count;
	
							textures.push( {
								name,
								ext,
								data: imageToData( mat.roughnessMap.image, ext )
							});
		
							mtlOutput += 'bump ' + name + '.png' + '\n';
	
						}
		
						if ( mat.normalMap && mat.normalMap instanceof THREE.Texture ) {
	
							name = 'normalMap' + count;
	
							textures.push( {
								name,
								ext,
								data: imageToData( mat.normalMap.image, ext )
							});
		
							mtlOutput += 'map_Ks ' + name + '.png' + '\n';
	
						}
	
						if ( mat.alphaMap && mat.alphaMap instanceof THREE.Texture ) {
	
							name = 'alphaMap' + count;
	
							textures.push( {
								name,
								ext,
								data: imageToData( mat.alphaMap.image, ext )
							});
		
							mtlOutput += 'map_d ' + name + '.png' + '\n';
	
						}
	
						if ( mat.aoMap && mat.aoMap instanceof THREE.Texture ) {
	
							name = 'ambientMap' + count;
	
							textures.push( {
								name,
								ext,
								data: imageToData( mat.aoMap.image, ext )
							});
		
							mtlOutput += 'map_Ka ' + name + '.png' + '\n';
	
						}
	
						count += 1;

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
