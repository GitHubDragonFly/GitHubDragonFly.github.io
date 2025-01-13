( function () {

	/**
	 *
	 * Created with assistance from Microsoft Copilot
	 *
	 * 3D Manufacturing Format (3MF) specification: https://3mf.io/specification/
	 *
	 * The following features from the core specification appear to be working fine:
	 *
	 * - 3D Models
	 * - Object Resources (Meshes)
	 * - Material Resources (Base Materials)
	 *
	 * The following features also appear to be working fine:
	 *
	 * - Texture 2D
	 * - Texture 2D Groups
	 * - Color Groups (Vertex Colors)
	 * - Metallic Display Properties (PBR)
	 * - Material Arrays
	 * - Adding thumbnail
	 *
	 */

	class ThreeMFExporter {

		constructor( manager ) {

			this.manager = manager || THREE.DefaultLoadingManager;

			if ( typeof fflate === 'undefined' ) {

				throw Error( 'THREE.3MFExporter: External library fflate required.' );

			}

		}

		parse( scene, onDone, onError, options = {} ) {

			this.parseAsync( scene, options ).then( onDone ).catch( onError );

		}

		async parseAsync( scene, options = {} ) {

			scene.updateMatrixWorld( true, true );

			options = Object.assign( {
				upAxis: 'Y_UP',
				map_flip_required: false,
				maxTextureSize: Infinity,
				thumbnail: null
			}, options );

			// Start the 3MF file content
			let core_url = 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02';
			let material_url = 'http://schemas.microsoft.com/3dmanufacturing/material/2015/02';
			let msft_url = 'http://www.microsoft.com/3dmanufacturing/microsoftextension/2017/01';

			let date = new Date();
			let date_str = date.toString().split( ' ' )[ 0 ] + " " + date.toLocaleDateString();

			let xmlString = '<?xml version="1.0" encoding="UTF-8"?>\n';
			xmlString += '<model unit="millimeter" xml:lang="en-US" xmlns="' + core_url + '" xmlns:m="' + material_url + '" xmlns:msft="' + msft_url + '">\n';
			xmlString += ' <metadata name="Description">Custom 3MF Exporter</metadata>\n';
			xmlString += ' <metadata name="Designer">GitHubDragonFly</metadata>\n';
			xmlString += ' <metadata name="CreationDate">' + date_str + '</metadata>\n';
			xmlString += await this.createResourcesSection( scene );
			xmlString += await this.createBuildSection( scene );
			xmlString += '</model>\n';

			const files = {};

			// Generate the Relationships file
			const relsString = await this.createRelsFile( options );
			const relsStringTextures = await this.createTexturesRelsFile( scene );

			// Combine the XML and Relationships content into a single 3MF package
			if ( options.thumbnail ) files[ 'Metadata/thumbnail.png' ] = options.thumbnail;

			files[ '[Content_Types].xml' ] = await fflate.strToU8( this.createContentTypesFile( options ) );
			files[ '_rels/.rels' ] = await fflate.strToU8( relsString );

			if ( relsStringTextures !== null ) {

				files[ '3D/_rels/3dmodel.model.rels' ] = await fflate.strToU8( relsStringTextures );

				// Add textures to the zip files
				await this.addTexturesToZip( scene, files, options );

			}

			files[ '3D/3dmodel.model' ] = await fflate.strToU8( xmlString );

			return fflate.zipSync( files, { level: 8 } );

		}

		async createRelsFile( options ) {

			let relsString = '<?xml version="1.0" encoding="UTF-8"?>\n';
			relsString += '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n';
			relsString += ' <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />\n';
			if ( options.thumbnail !== null ) relsString += ' <Relationship Target="/Metadata/thumbnail.png" Id="rel1" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail" />\n';
			relsString += '</Relationships>\n';

			return relsString;

		}

		async createTexturesRelsFile( scene ) {

			let map_found = false;
			let relsStringTextures = '<?xml version="1.0" encoding="UTF-8"?>\n';
			relsStringTextures += '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n';

			const image_names = {};

			scene.traverse( ( object ) => {

				if ( object.isMesh === true ) {

					if ( Array.isArray( object.material ) ) {

						object.material.forEach( mtl => {

							if ( mtl.map ) {

								// If there is no name then use texture uuid as a part of new name

								map_found = true;
								let name = mtl.map.name ? mtl.map.name : 'texture_' + mtl.map.uuid;
								if ( name.indexOf( '.' ) === -1 ) name += '.png';

								if ( ! image_names[ name ] ) {

									image_names[ name ] = name;

									let texture_url = 'http://schemas.microsoft.com/3dmanufacturing/2013/01/3dtexture';

									relsStringTextures += ' <Relationship Target="/3D/Textures/' + name + '" Id="rel' + mtl.map.id + '" Type="' + texture_url + '" />\n';

								}

							}

						});

					} else {

						if ( object.material.map ) {

							// If there is no name then use texture uuid as a part of new name

							map_found = true;
							let name = object.material.map.name ? object.material.map.name : 'texture_' + object.material.map.uuid;
							if ( name.indexOf( '.' ) === -1 ) name += '.png';

							if ( ! image_names[ name ] ) {

								image_names[ name ] = name;

								let texture_url = 'http://schemas.microsoft.com/3dmanufacturing/2013/01/3dtexture';

								relsStringTextures += ' <Relationship Target="/3D/Textures/' + name + '" Id="rel' + object.material.map.id + '" Type="' + texture_url + '" />\n';

							}

						}

					}

				}

			});

			relsStringTextures += '</Relationships>\n';

			return map_found === true ? relsStringTextures : null;

		}

		createContentTypesFile( options ) {

			let contentTypesString = '<?xml version="1.0" encoding="UTF-8"?>\n';
			contentTypesString += '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n';
			contentTypesString += ' <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />\n';
			contentTypesString += ' <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />\n';
			contentTypesString += ' <Default Extension="png" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodeltexture" />\n';
			if ( options.thumbnail !== null ) contentTypesString += ' <Override PartName="/Metadata/thumbnail.png" ContentType="image/png" />\n';
			contentTypesString += '</Types>\n';

			return contentTypesString;

		}

		async createResourcesSection( scene ) {

			let resourcesString = ' <resources>\n';

			scene.traverse( ( object ) => {

				if ( object.isMesh === true ) {

					let geometry = this.interleaved_buffer_attribute_check( object.geometry.clone() );
					let material = object.material;

					if ( geometry.groups.length > 0 ) {

						// Sort groups by material index

						geometry.groups = geometry.groups.sort( ( a, b ) => {

							if ( a.materialIndex !== b.materialIndex ) return a.materialIndex - b.materialIndex;

							return a.start - b.start;

						} );

					}

					if ( ! geometry.index ) geometry = this.mergeVertices( geometry, 1e-6 );
					if ( ! geometry.attributes.normal ) geometry.computeVertexNormals();
					geometry.normalizeNormals();

					let map_id = null;
					let color_id = null;

					if ( geometry.attributes.color ) { // Check if vertex colors are present

						color_id = geometry.id;

						resourcesString += '  <object id="' + object.id + '" name="' + object.name + '" type="model">\n';

						resourcesString += '  <m:colorgroup id="' + color_id + '">\n';
						resourcesString += this.generateColors( geometry );
						resourcesString += '  </m:colorgroup>\n';

						resourcesString += '   <mesh>\n';
						resourcesString += this.generateVertices( geometry );
						resourcesString += this.generateTriangles( geometry, map_id, color_id );
						resourcesString += '   </mesh>\n';

						resourcesString += '  </object>\n';

					}

					if ( Array.isArray( material ) && geometry.groups.length === material.length ) {

						// Create new object for each group / material pair
						// Add it as a component to the main object

						let componentsString = '';

						material.forEach( ( mtl, index ) => {

							// For id uniqueness let's hope there is not 1000000000+ objects in the model

							let object_id = object.id + 1000000000 + mtl.id + index;
							let object_name = ( object.name || object.id ) + '_group_' + index;

							let hex_uc = '#' + mtl.color.getHexString().toUpperCase();

							if ( mtl.opacity < 1 || mtl.transparent === true ) {

								let hex_opacity = mtl.opacity === 1 ? 'FD' : ( parseInt( mtl.opacity * 255 ) ).toString( 16 ).toUpperCase().padStart( 2, '0' );
								hex_uc += hex_opacity;

							}

							if ( mtl.metalness !== undefined ) {

								let m_id = 1000000000 + mtl.id;
								let metalness = mtl.metalness;
								let roughness = mtl.roughness;

								resourcesString += '  <m:pbmetallicdisplayproperties id="' + m_id + '">\n';
								resourcesString += '   <m:pbmetallic name="Metallic" metallicness="' + metalness + '" roughness="' + roughness + '" />\n';
								resourcesString += '  </m:pbmetallicdisplayproperties>\n';

								resourcesString += '  <m:basematerials id="' + mtl.id + '">\n';
								resourcesString += '   <m:base name="Metallic" displaycolor="' + hex_uc + '" displaypropertiesid="' + m_id + '" index="' + index + '" />\n';
								resourcesString += '  </m:basematerials>\n';

							} else {

								resourcesString += '  <m:basematerials id="' + mtl.id + '">\n';
								resourcesString += '   <m:base name="' + ( mtl.name || mtl.type ) + '" displaycolor="' + hex_uc + '" index="' + index + '" />\n';
								resourcesString += '  </m:basematerials>\n';

							}

							if ( mtl.map ) { // Check if texture is present

								resourcesString += '  <object id="' + object_id + '" name="' + object_name + '" type="model">\n';

								map_id = object_id;

								// If there is no name then use texture uuid as a part of new name

								let name = mtl.map.name ? mtl.map.name : 'texture_' + mtl.map.uuid;
								if ( name.indexOf( '.' ) === -1 ) name += '.png';

								let styleu = mtl.map.wrapS === THREE.MirroredRepeatWrapping ? 'mirror' :
									( mtl.map.wrapS === THREE.ClampToEdgeWrapping ? 'clamp' :'wrap' );

								let stylev = mtl.map.wrapT === THREE.MirroredRepeatWrapping ? 'mirror' :
									( mtl.map.wrapT === THREE.ClampToEdgeWrapping ? 'clamp' : 'wrap' );

								let filter = ( mtl.map.magFilter === THREE.NearestFilter && mtl.map.minFilter === THREE.NearestFilter ) ? 'nearest' :
									( ( mtl.map.magFilter === THREE.LinearFilter && mtl.map.minFilter === THREE.LinearFilter ) ? 'linear' : 'auto' );

								resourcesString += '  <m:texture2d id="' + mtl.map.id + '" path="/3D/Textures/' + name + '" contenttype="image/png" tilestyleu="' + styleu + '" tilestylev="' + stylev + '" filter="' + filter + '" />\n';

								if ( geometry.attributes.uv ) {

									resourcesString += this.generateUVs( geometry, object_id, mtl.map.id, index );

								}

								resourcesString += '   <mesh>\n';
								resourcesString += this.generateVertices( geometry, index );
								resourcesString += this.generateTriangles( geometry, map_id, color_id, index );
								resourcesString += '   </mesh>\n';

								resourcesString += '  </object>\n';

							} else {

								resourcesString += '  <object id="' + object_id + '" pid="' + mtl.id + '" pindex="0" name="' + object_name + '" type="model">\n';

								resourcesString += '   <mesh>\n';
								resourcesString += this.generateVertices( geometry, index );
								resourcesString += this.generateTriangles( geometry, map_id, color_id, index );
								resourcesString += '   </mesh>\n';

								resourcesString += '  </object>\n';

							}

							componentsString += '    <component objectid="' + object_id + '" />\n';

						});

						resourcesString += '  <object id="' + object.id + '" name="' + object.name + '" type="model">\n';
						resourcesString += '   <components>\n';
						resourcesString += componentsString;
						resourcesString += '   </components>\n';
						resourcesString += '  </object>\n';

					} else {

						if ( material.map ) { // Check if texture is present

							map_id = object.id;

							resourcesString += '  <object id="' + object.id + '" name="' + object.name + '" type="model">\n';

							// If there is no name then use texture uuid as a part of new name

							let name = material.map.name ? material.map.name : 'texture_' + material.map.uuid;
							if ( name.indexOf( '.' ) === -1 ) name += '.png';

							let styleu = material.map.wrapS === THREE.MirroredRepeatWrapping ? 'mirror' :
								( material.map.wrapS === THREE.ClampToEdgeWrapping ? 'clamp' :'wrap' );

							let stylev = material.map.wrapT === THREE.MirroredRepeatWrapping ? 'mirror' :
								( material.map.wrapT === THREE.ClampToEdgeWrapping ? 'clamp' : 'wrap' );

							let filter = ( material.map.magFilter === THREE.NearestFilter && material.map.minFilter === THREE.NearestFilter ) ? 'nearest' :
								( ( material.map.magFilter === THREE.LinearFilter && material.map.minFilter === THREE.LinearFilter ) ? 'linear' : 'auto' );

							resourcesString += '  <m:texture2d id="' + material.map.id + '" path="/3D/Textures/' + name + '" contenttype="image/png" tilestyleu="' + styleu + '" tilestylev="' + stylev + '" filter="' + filter + '" />\n';

							if ( geometry.attributes.uv ) {

								resourcesString += this.generateUVs( geometry, object.id, material.map.id );

							}

						} else { // Material only

							let hex_uc = '#' + material.color.getHexString().toUpperCase();

							if ( material.opacity < 1 || material.transparent === true ) {

								let hex_opacity = material.opacity === 1 ? 'FD' : ( parseInt( material.opacity * 255 ) ).toString( 16 ).toUpperCase().padStart( 2, '0' );
								hex_uc += hex_opacity;

							}

							if ( material.metalness !== undefined ) {

								let m_id = 1000000000 + material.id;
								let metalness = material.metalness;
								let roughness = material.roughness;

								resourcesString += '  <m:pbmetallicdisplayproperties id="' + m_id + '">\n';
								resourcesString += '   <m:pbmetallic name="Metallic" metallicness="' + metalness + '" roughness="' + roughness + '" />\n';
								resourcesString += '  </m:pbmetallicdisplayproperties>\n';

								resourcesString += '  <m:basematerials id="' + material.id + '">\n';
								resourcesString += '   <m:base name="Metallic" displaycolor="' + hex_uc + '" displaypropertiesid="' + m_id + '" />\n';
								resourcesString += '  </m:basematerials>\n';

							} else {

								resourcesString += '  <m:basematerials id="' + material.id + '">\n';
								resourcesString += '   <m:base name="' + ( material.name || material.type ) + '" displaycolor="' + hex_uc + '" />\n';
								resourcesString += '  </m:basematerials>\n';

							}

							resourcesString += '  <object id="' + object.id + '" pid="' + material.id + '" pindex="0" name="' + object.name + '" type="model">\n';

						}

						resourcesString += '   <mesh>\n';
						resourcesString += this.generateVertices( geometry );
						resourcesString += this.generateTriangles( geometry, map_id, color_id );
						resourcesString += '   </mesh>\n';

						resourcesString += '  </object>\n';

					}

				}

			});

			resourcesString += ' </resources>\n';

			return resourcesString;

		}

		async createBuildSection( scene ) {

			let buildString = ' <build>\n';

			scene.traverse( ( object ) => {

				if ( object.isMesh === true ) {

					const matrix = new THREE.Matrix4();
					matrix.copy( object.matrixWorld );

					// Decompose the matrix into position, quaternion, and scale
					const pos = new THREE.Vector3();
					const quat = new THREE.Quaternion();
					const scale = new THREE.Vector3();

					matrix.decompose( pos, quat, scale );

					// Create the transformation string
					const transform = new THREE.Matrix4().compose( pos, quat, scale );
					const e = transform.elements;

					let str = '';

					str += e[ 0 ] + ' ' + e[ 1 ] + ' ' + e[ 2 ] + ' ' + e[ 4 ] + ' ';
					str += e[ 5 ] + ' ' + e[ 6 ] + ' ' + e[ 8 ] + ' ' + e[ 9 ] + ' ';
					str += e[ 10 ] + ' ' + e[ 12 ] + ' ' + e[ 13 ] + ' ' + e[ 14 ];

					buildString += '  <item objectid="' + object.id + '" transform="' + str + '" />\n';

				}

			});

			buildString += ' </build>\n';

			return buildString;

		}

		generateColors( geometry ) {

			const colors = geometry.getAttribute( 'color' );

			let colorsString = '';

			for ( let i = 0; i < colors.count; i ++ ) {

				let str = ( new THREE.Color(
					colors.getX( i ),
					colors.getY( i ),
					colors.getZ( i )
				) ).getHexString().toUpperCase() + 'FF';

				colorsString += '   <m:color color="#' + str + '" />\n';

			}

			return colorsString;

		}

		generateVertices( geometry, index = null ) {

			const indices = geometry.index.array;
			const vertices = geometry.attributes.position.array;

			let verticesString = '    <vertices>\n';

			const groups = index !== null && geometry.groups[ index ] !== undefined;

			let start = groups === true ? geometry.groups[ index ].start : 0;
			let end = groups === true ? geometry.groups[ index ].start + geometry.groups[ index ].count : vertices.length;
			if ( end === Infinity ) end = indices.length;

			if ( groups === true ) {

				for ( let i = start; i < end; i ++ ) {

					let v1 = vertices[ indices[ i ] * 3 ];
					let v2 = vertices[ indices[ i ] * 3 + 1 ];
					let v3 = vertices[ indices[ i ] * 3 + 2 ];

					verticesString += '     <vertex x="' + v1 + '" y="' + v2 + '" z="' + v3 + '" />\n';

				}

			} else {

				for ( let i = start; i < end; i += 3 ) {

					let v1 = vertices[ i ];
					let v2 = vertices[ i + 1 ];
					let v3 = vertices[ i + 2 ];

					verticesString += '     <vertex x="' + v1 + '" y="' + v2 + '" z="' + v3 + '" />\n';

				}

			}

			verticesString += '    </vertices>\n';

			return verticesString;

		}

		generateTriangles( geometry, map_pid = null, color_pid = null, index = null ) {

			const indices = geometry.index.array;

			let trianglesString = '    <triangles>\n';

			const groups = index !== null && geometry.groups[ index ] !== undefined;

			let start = 0;
			let end = groups === true ? geometry.groups[ index ].count : indices.length;
			if ( end === Infinity ) end = index !== null ? indices.length - geometry.groups[ index ].start : indices.length;

			for ( let i = start; i < end; i += 3 ) {

				let v1 = groups === true ? i : indices[ i ];
				let v2 = groups === true ? i + 1 : indices[ i + 1 ];
				let v3 = groups === true ? i + 2 : indices[ i + 2 ];

				if ( map_pid ) {

					trianglesString += '     <triangle v1="' + v1 + '" v2="' + v2 + '" v3="' + v3 + '" pid="' + map_pid + '" p1="' + v1 + '" p2="' + v2 + '" p3="' + v3 + '" />\n';

				} else if ( color_pid ) {

					trianglesString += '     <triangle v1="' + v1 + '" v2="' + v2 + '" v3="' + v3 + '" pid="' + color_pid + '" p1="' + v1 + '" />\n';

				} else {

					trianglesString += '     <triangle v1="' + v1 + '" v2="' + v2 + '" v3="' + v3 + '" />\n';

				}

			}

			trianglesString += '    </triangles>\n';

			return trianglesString;

		}

		generateUVs( geometry, id, texid, index = null ) {

			const indices = geometry.index.array;
			const uvs = geometry.attributes.uv.array;

			let uvsString = '  <m:texture2dgroup id="' + id + '" texid="' + texid + '">\n';

			const groups = index !== null && geometry.groups[ index ] !== undefined;

			let start = groups === true ? geometry.groups[ index ].start : 0;
			let end = groups === true ? ( geometry.groups[ index ].start + geometry.groups[ index ].count ) : uvs.length;

			if ( groups === true ) {

				for ( let i = start; i < end; i ++ ) {

					const uvu = uvs[ indices[ i ] * 2 ];
					const uvv = uvs[ indices[ i ] * 2 + 1 ];

					uvsString += '   <m:tex2coord u="' + uvu + '" v="' + uvv + '" />\n';

				}

			} else {

				for ( let i = start; i < end; i += 2 ) {

					const uvu = uvs[ i ];
					const uvv = uvs[ i + 1 ];

					uvsString += '   <m:tex2coord u="' + uvu + '" v="' + uvv + '" />\n';

				}

			}

			uvsString += '  </m:texture2dgroup>\n';

			return uvsString;

		}

		async addTexturesToZip( scene, files, options ) {

			const image_names = {};
			const textures = [];

			scene.traverse( ( object ) => {

				if ( object.isMesh === true ) {

					if ( Array.isArray( object.material ) ) {

						for ( const mtl of object.material ) {

							if ( mtl.map ) {

								// Preserve original texture uuid in case if
								// it was used as a part of the texture name

								const uuid = mtl.map.uuid;

								let texture;

								if ( mtl.map.isCompressedTexture === true ) {

									texture = this.decompress( mtl.map.clone(), Infinity, null );

								} else {

									texture = mtl.map.clone();

								}

								let name = texture.name ? texture.name : 'texture_' + uuid;
								if ( name.indexOf( '.' ) === -1 ) name += '.png';

								if ( ! image_names[ name ] ) {

									image_names[ name ] = name;

									const canvas = this.imageToCanvas( texture.image, options.map_flip_required, options.maxTextureSize );

									const base64 = canvas.toDataURL( 'image/png', 1 ).split( ',' )[ 1 ];

									const binaryString = atob( base64 );
									const len = binaryString.length;
									const bytes = new Uint8Array( len );

									for ( let i = 0; i < len; i++ ) { bytes[ i ] = binaryString.charCodeAt( i ); }

									const blob = new Blob( [ bytes ], { type: 'image/png' } );

									textures.push( new Promise( async resolve => {

										const buff = await blob.arrayBuffer();
										const u8 = new Uint8Array( buff );

										resolve( files[ '3D/Textures/' + name ] = u8 );

									}));

								}

							}

						}

					} else {

						if ( object.material.map ) {

							// Preserve original texture uuid in case if
							// it was used as a part of the texture name

							const uuid = object.material.map.uuid;

							let texture;

							if ( object.material.map.isCompressedTexture === true ) {

								texture = this.decompress( object.material.map.clone(), Infinity, null );

							} else {

								texture = object.material.map.clone();

							}

							let name = texture.name ? texture.name : 'texture_' + uuid;
							if ( name.indexOf( '.' ) === -1 ) name += '.png';

							if ( ! image_names[ name ] ) {

								image_names[ name ] = name;

								const canvas = this.imageToCanvas( texture.image, options.map_flip_required, options.maxTextureSize );

								const base64 = canvas.toDataURL( 'image/png', 1 ).split( ',' )[ 1 ];

								const binaryString = atob( base64 );
								const len = binaryString.length;
								const bytes = new Uint8Array( len );

								for ( let i = 0; i < len; i++ ) { bytes[ i ] = binaryString.charCodeAt( i ); }

								const blob = new Blob( [ bytes ], { type: 'image/png' } );

								textures.push( new Promise( async resolve => {

									const buff = await blob.arrayBuffer();
									const u8 = new Uint8Array( buff );

									resolve( files[ '3D/Textures/' + name ] = u8 );

								}));

							}

						}

					}

				}

			});

			await Promise.all( textures );

		}

		imageToCanvas( image, flipY, maxTextureSize ) {

			if ( ( typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement ) ||
				( typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement ) ||
				( typeof OffscreenCanvas !== 'undefined' && image instanceof OffscreenCanvas ) ||
				( typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap ) ) {

				let canvas, ctx;

				if ( typeof image === 'canvas' ) {

					canvas = image;

				} else {

					canvas = document.createElement( 'canvas' );

					let scale = maxTextureSize / Math.max( image.width, image.height );

					canvas.width = image.width * Math.min( 1, scale );
					canvas.height = image.height * Math.min( 1, scale );

					ctx = canvas.getContext( '2d', { willReadFrequently: true } );

					if ( flipY === true ) {

						// Flip image vertically

						ctx.translate( 0, canvas.height );
						ctx.scale( 1, - 1 );

					}

					if ( image instanceof ImageData ) {

						ctx.putImageData( image, 0, 0 );

					} else if ( image.data && image.data.constructor === Uint8Array ) {

						let imgData = new ImageData( new Uint8ClampedArray( image.data ), image.width, image.height );

						ctx.putImageData( imgData, 0, 0 );

					} else {

						ctx.drawImage( image, 0, 0, canvas.width, canvas.height );

					}

				}

				return canvas;

			} else {

				throw new Error( 'THREE.3MFExporter: No valid image data found. Unable to process texture.' );

			}

		}

		// decompress function is from TextureUtils.js

		decompress( texture, maxTextureSize = Infinity, renderer = null ) {

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
							gl_FragColor = vec4(vUv.xy, 0, 1);
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

			return readableTexture;

		}

		// deinterleaveAttribute function is from BufferGeometryUtils.js

		deinterleaveAttribute( attribute ) {

			const cons = attribute.data.array.constructor;
			const count = attribute.count;
			const itemSize = attribute.itemSize;
			const normalized = attribute.normalized;

			const array = new cons( count * itemSize );

			let newAttribute;

			if ( attribute.isInstancedInterleavedBufferAttribute ) {

				newAttribute = new THREE.InstancedBufferAttribute( array, itemSize, normalized, attribute.meshPerAttribute );

			} else {

				newAttribute = new THREE.BufferAttribute( array, itemSize, normalized );

			}

			for ( let i = 0; i < count; i ++ ) {

				newAttribute.setX( i, attribute.getX( i ) );

				if ( itemSize >= 2 ) {

					newAttribute.setY( i, attribute.getY( i ) );

				}

				if ( itemSize >= 3 ) {

					newAttribute.setZ( i, attribute.getZ( i ) );

				}

				if ( itemSize >= 4 ) {

					newAttribute.setW( i, attribute.getW( i ) );

				}

			}

			return newAttribute;

		}

		deinterleave( geometry, attribute = 'color' ) {

			const attr = geometry.attributes[ attribute ];
			const itemSize = attr.itemSize;
			const offset = attr.offset;

			const data = attr.data;

			if ( data === undefined ) return [];

			let iBA = new THREE.InterleavedBufferAttribute( data, itemSize, offset );

			let attr_items = deinterleaveAttribute( iBA );

			let temp_array = Array( attr_items.array.length );

			for ( let i = 0, l = attr_items.array.length; i < l; i ++ ) {

				temp_array[ i ] = isNaN( attr_items.array[ i ] ) ? 0 : attr_items.array[ i ]; // avoid NaN values

			}

			return new THREE.BufferAttribute( new Float32Array( temp_array ), itemSize );

		}

		interleaved_buffer_attribute_check( geo ) {

			const attribute_array = [ 'position', 'normal', 'color', 'tangent', 'uv', 'uv1', 'uv2', 'uv3' ];

			for (const attribute of attribute_array) {

				if ( geo.attributes[ attribute ] && geo.attributes[ attribute ].isInterleavedBufferAttribute ) {

					if ( geo.attributes[ attribute ].data ) {

						if ( geo.attributes[ attribute ].data.array ) {

							let geometry_attribute_array = this.deinterleave( geo, attribute );

							geo.deleteAttribute( attribute );
							geo.setAttribute( attribute, geometry_attribute_array );

						}

					}

				} else {

					if ( geo.attributes[ attribute ] && geo.attributes[ attribute ].array ) {

						const itemSize = geo.attributes[ attribute ].itemSize;
						const arr = geo.attributes[ attribute ].array;
						const temp_array = Array( arr.length );

						for ( let i = 0, l = arr.length; i < l; i ++ ) {

							temp_array[ i ] = isNaN( arr[ i ] ) ? 0 : arr[ i ]; // avoid NaN values

						}

						geo.deleteAttribute( attribute );
						geo.setAttribute( attribute, new THREE.BufferAttribute( new Float32Array( temp_array ), itemSize ) );

					}

				}

			}

			return geo;

		}

		// mergeVertices function is from BufferGeometryUtils.js

		mergeVertices( geometry, tolerance = 1e-6 ) {

			tolerance = Math.max( tolerance, Number.EPSILON );

			// Generate an index buffer if the geometry doesn't have one
			// or optimize it if it's already available.

			const hashToIndex = {};
			const indices = geometry.getIndex();
			const positions = geometry.getAttribute( 'position' );
			const vertexCount = indices ? indices.count : positions.count; // next value for triangle indices

			let nextIndex = 0; // attributes and new attribute arrays

			const attributeNames = Object.keys( geometry.attributes );
			const attrArrays = {};
			const morphAttrsArrays = {};
			const newIndices = [];
			const getters = [ 'getX', 'getY', 'getZ', 'getW' ]; // initialize the arrays

			for ( let i = 0, l = attributeNames.length; i < l; i ++ ) {

				const name = attributeNames[ i ];
				attrArrays[ name ] = [];
				const morphAttr = geometry.morphAttributes[ name ];

				if ( morphAttr ) {

					morphAttrsArrays[ name ] = new Array( morphAttr.length ).fill().map( () => [] );

				}

			} // convert the error tolerance to an amount of decimal places to truncate to

			const decimalShift = Math.log10( 1 / tolerance );
			const shiftMultiplier = Math.pow( 10, decimalShift );

			for ( let i = 0; i < vertexCount; i ++ ) {

				const index = indices ? indices.getX( i ) : i;

				// Generate a hash for the vertex attributes at the current index 'i'

				let hash = '';

				for ( let j = 0, l = attributeNames.length; j < l; j ++ ) {

					const name = attributeNames[ j ];
					const attribute = geometry.getAttribute( name );
					const itemSize = attribute.itemSize;

					for ( let k = 0; k < itemSize; k ++ ) {

						// double tilde truncates the decimal value
						hash += `${~ ~ ( attribute[ getters[ k ] ]( index ) * shiftMultiplier )},`;

					}

				}

				// Add another reference to the vertex if it's already used by another index

				if ( hash in hashToIndex ) {

					newIndices.push( hashToIndex[ hash ] );

				} else {

					// copy data to the new index in the attribute arrays
					for ( let j = 0, l = attributeNames.length; j < l; j ++ ) {

						const name = attributeNames[ j ];
						const attribute = geometry.getAttribute( name );
						const morphAttr = geometry.morphAttributes[ name ];
						const itemSize = attribute.itemSize;
						const newarray = attrArrays[ name ];
						const newMorphArrays = morphAttrsArrays[ name ];

						for ( let k = 0; k < itemSize; k ++ ) {

							const getterFunc = getters[ k ];
							newarray.push( attribute[ getterFunc ]( index ) );

							if ( morphAttr ) {

								for ( let m = 0, ml = morphAttr.length; m < ml; m ++ ) {

									newMorphArrays[ m ].push( morphAttr[ m ][ getterFunc ]( index ) );

								}

							}

						}

					}

					hashToIndex[ hash ] = nextIndex;
					newIndices.push( nextIndex );
					nextIndex ++;

				}

			}

			// Generate typed arrays from new attribute arrays and update the attributeBuffers

			const result = geometry.clone();

			for ( let i = 0, l = attributeNames.length; i < l; i ++ ) {

				const name = attributeNames[ i ];
				const oldAttribute = geometry.getAttribute( name );
				const buffer = new oldAttribute.array.constructor( attrArrays[ name ] );
				const attribute = new THREE.BufferAttribute( buffer, oldAttribute.itemSize, oldAttribute.normalized );
				result.setAttribute( name, attribute ); // Update the attribute arrays

				if ( name in morphAttrsArrays ) {

					for ( let j = 0; j < morphAttrsArrays[ name ].length; j ++ ) {

						const oldMorphAttribute = geometry.morphAttributes[ name ][ j ];
						const buffer = new oldMorphAttribute.array.constructor( morphAttrsArrays[ name ][ j ] );
						const morphAttribute = new THREE.BufferAttribute( buffer, oldMorphAttribute.itemSize, oldMorphAttribute.normalized );
						result.morphAttributes[ name ][ j ] = morphAttribute;

					}

				}

			}

			// indices

			result.setIndex( newIndices );

			return result;

		}

	}

	THREE.ThreeMFExporter = ThreeMFExporter;

} )();
