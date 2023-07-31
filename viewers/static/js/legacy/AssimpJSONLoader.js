/**
 * @author Alexander Gessler / http://www.greentoken.de/
 * https://github.com/acgessler
 *
 * Loader for models imported with Open Asset Import Library (http://assimp.sf.net)
 * through assimp2json (https://github.com/acgessler/assimp2json).
 *
 * Supports any input format that assimp supports, including 3ds, obj, dae, blend,
 * fbx, x, ms3d, lwo (and many more).
 *
 * See webgl_loader_assimp2json example.
 */

var blobs = null;
const root = new THREE.Object3D();
var bones = [];

THREE.AssimpJSONLoader = function ( manager ) {

	this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;

};

THREE.AssimpJSONLoader.prototype = {

	constructor: THREE.AssimpJSONLoader,

	texturePath : '',

	load: function ( url, onLoad, onProgress, onError, texturePath ) {

		var scope = this;

		if ( texturePath && ( typeof texturePath === "string" ) ) {

			if ( texturePath.includes( ',' ) ) {

				blobs = texturePath.split( ',' );
	
			} else {

				this.texturePath = texturePath;

			}

		} else {

			this.texturePath = this.extractUrlBase( url );

		}

		var loader = new THREE.FileLoader( this.manager );
		loader.setCrossOrigin( this.crossOrigin );

		loader.load( url, function ( text ) {

			try {

				var json = JSON.parse( text ), scene, metadata;
				
			} catch (error) {

				onError( error );
				return;
				
			}

			if ( json && json.meshes === undefined ) {

				onError( 'Unsupported file' );
				return;

			}

			// Check __metadata__ meta header if present
			// This header is used to disambiguate between
			// different JSON-based file formats.

			metadata = json.__metadata__;

			if ( typeof metadata !== 'undefined' ) {

				// Check if assimp2json at all

				if ( metadata.format !== 'assimp2json' ) {

					onError('Not an assimp2json scene');
					return;

				}

				// Check major format version

				else if ( metadata.version < 100 && metadata.version >= 200 ) {

					onError( 'Unsupported assimp2json file format version' );
					return;

				}

			}

			scene = scope.parse( json );

			if ( json.animations ) scene[ 'animations' ] = json.animations;
			if ( bones.length > 0 ) scene[ 'bones' ] = bones;

			onLoad( scene );

		}, onProgress, onError );

	},

	setCrossOrigin: function ( value ) {

		this.crossOrigin = value;

	},

	extractUrlBase: function ( url ) { // from three/src/loaders/Loader.js

		let parts = url.split( '/' );
		parts.pop();

		return ( parts.length < 1 ? '.' : parts.join( '/' ) ) + '/';

	},

	parse: function ( json ) {

		let meshes = this.parseList ( json.meshes, this.parseMesh );
		let materials = this.parseMaterialList ( json, this.parseMaterial );
		this.parseBones( json, json.rootnode );

		return this.parseObject( json, json.rootnode, meshes, materials );

	},

	parseList : function( json, handler ) {

		let meshes = new Array( json.length );

		for( let i = 0; i < json.length; i++ ) {

			meshes[ i ] = handler.call( this, json[ i ] );

		}

		return meshes;
	},

	parseMaterialList : function( json, handler ) {

		let materials = new Array( json.materials.length );

		for( let i = 0; i < json.materials.length; i++ ) {

			materials[ i ] = handler.call( this, json.materials[ i ], json.textures );

		}

		return materials;
	},

	parseMesh : function( json ) {

		var geometry, i, j, e, ee, face, src, a, b, c;

		geometry = new THREE.Geometry();

		// read vertex positions

		for( i = 0, e = json.vertices.length; i < e; i += 3 ) {

			geometry.vertices.push( new THREE.Vector3( json.vertices[ i ], json.vertices[ i + 1 ], json.vertices[ i + 2 ] ) );

		}

		// read faces

		for ( i = 0, e = json.faces.length; i < e; i++ ) {

			face = new THREE.Face3();

			src = json.faces[ i ];

			face.a = src[ 0 ];
			face.b = src[ 1 ];
			face.c = src[ 2 ];

			face.materialIndex = 0; //json.materialindex;

			geometry.faces.push( face );

		}

		// read texture coordinates - three.js attaches them to its faces

		json.texturecoords = json.texturecoords || [];

		for ( i = 0, e = json.texturecoords.length; i < e; i++ ) {

			function convertTextureCoords( in_uv, out_faces, out_vertex_uvs ) {

				for ( j = 0, ee = out_faces.length; j < ee; j++ ) {

					face = out_faces[ j ];

					a = face.a * 2;
					b = face.b * 2;
					c = face.c * 2;

					out_vertex_uvs.push([
						new THREE.Vector2( in_uv[ a ], in_uv[ a + 1 ] ),
						new THREE.Vector2( in_uv[ b ], in_uv[ b + 1 ] ),
						new THREE.Vector2( in_uv[ c ], in_uv[ c + 1 ] )
					]);

				}

			}

			convertTextureCoords( json.texturecoords[ i ], geometry.faces, geometry.faceVertexUvs[ i ] );
		}

		// read normals - three.js also attaches them to its faces

		if ( json.normals ) {

			function convertNormals( in_nor, out_faces ) {

				for ( i = 0, e = out_faces.length; i < e; i++ ) {

					face = out_faces[ i ];

					a = face.a * 3;
					b = face.b * 3;
					c = face.c * 3;

					face.vertexNormals = [
						new THREE.Vector3( in_nor[ a ], in_nor[ a + 1 ], in_nor[ a + 2 ] ),
						new THREE.Vector3( in_nor[ b ], in_nor[ b + 1 ], in_nor[ b + 2 ] ),
						new THREE.Vector3( in_nor[ c ], in_nor[ c + 1 ], in_nor[ c + 2 ] )
					];
				}
			}

			convertNormals( json.normals, geometry.faces );
		}

		// read vertex colors - three.js also attaches them to its faces

		if ( json.colors && json.colors[ 0 ] ) {

			function convertColors( in_color, out_faces) {

				function makeColor( start ) {

					let col = new THREE.Color( );
					col.setRGB( in_color[ start ], in_color[ start + 1 ], in_color[ start + 2 ] );

					// TODO: what about alpha?

					return col;

				}

				for ( i = 0, e = out_faces.length; i < e; i++ ) {

					face = out_faces[ i ];

					a = face.a * 4;
					b = face.b * 4;
					c = face.c * 4;

					face.vertexColors = [
						makeColor( a ),
						makeColor( b ),
						makeColor( c )
					];
				}
			}

			convertColors( json.colors[ 0 ], geometry.faces );
		}


		geometry.computeFaceNormals();
		geometry.computeVertexNormals();
		geometry.computeBoundingBox();
		geometry.computeBoundingSphere();

		return geometry;

	},

	parseMaterial : function( material, textures ) {

		let mat = null, 
		scope = this, i, prop, has_textures = [],

		init_props = { color: 0xFFFFFF, flatShading: false };

		function toColor( value_arr ) {

			let col = new THREE.Color();
			col.setRGB( value_arr[ 0 ], value_arr[ 1 ], value_arr[ 2 ] );

			return col;

		}

		function defaultTexture() {

			// Use DataTexture as in the docs example: https://threejs.org/docs/#api/en/textures/DataTexture

			const width = 128;
			const height = 128;

			const size = width * height;
			const data = new Uint8Array( 4 * size );
			const color = new THREE.Color( 0xffffff );

			const r = Math.floor( color.r * 255 );
			const g = Math.floor( color.g * 255 );
			const b = Math.floor( color.b * 255 );

			for ( let i = 0; i < size; i ++ ) {
				const stride = i * 4;
				data[ stride + 0 ] = r;
				data[ stride + 1 ] = g;
				data[ stride + 2 ] = b;
				data[ stride + 3 ] = 255;
			}

			return new THREE.DataTexture( data, width, height );

		}

		for ( i in material.properties ) {

			prop = material.properties[ i ];

			if ( prop.key === '$tex.file' ) {

				// prop.semantic gives the type of the texture
				// 1: diffuse
				// 2: specular map
				// 4: emissive map
				// 5: height map (bumps)
				// 6: normal map
				// more values (i.e. emissive, environment) are known by assimp and may be relevant

				if ( prop.semantic === 1 || prop.semantic === 2 || prop.semantic === 4 || prop.semantic === 5 || prop.semantic === 6 ) {

					( function( semantic ) {

						var loader = new THREE.TextureLoader( scope.manager ),
						keyname;

						if (semantic === 1) {

							keyname = 'map';

						}
						else if (semantic === 2) {

							keyname = 'specularMap';

						}
						else if (semantic === 4) {

							keyname = 'emissiveMap';

						}
						else if (semantic === 5) {

							keyname = 'bumpMap';

						}
						else if (semantic === 6) {

							keyname = 'normalMap';

						}

						has_textures.push( keyname );

						loader.setCrossOrigin( this.crossOrigin );

						let material_url;

						let filename = prop.value;

						if ( prop.value.includes( '/' ) === true ) {

							filename = filename.substring( filename.lastIndexOf( '/' ) + 1 );

						} else if ( filename.includes( '\\' ) === true ) {

							filename = filename.substring( filename.lastIndexOf( '\\' ) + 1 );

						}

						if ( filename.includes( '*' ) === true ) {

							try {

								let texture_index = parseInt( filename.substring( filename.lastIndexOf( '*' ) + 1 ) );

								if ( textures && textures[ texture_index ] && textures[ texture_index ].data ) {

									material_url = 'data:image/' + textures[ texture_index ].formathint + ';base64,' + textures[ texture_index ].data;

								}

							} catch (error) {

								console.warn( 'THREE.AssimpJSONLoader: Texture name is not numeric ' + filename );

							}

						}

						if ( blobs !== null ) {

							for ( j = 0, ee = blobs.length; j < ee; j += 2 ) {

								if ( blobs[ j ] === filename ) material_url = blobs[ j + 1 ];

							}

						} else {

							if ( material_url === undefined ) material_url = scope.texturePath + '/' + filename;

						}

						if ( material_url === undefined ) {

							console.warn( 'THREE.AssimpJSONLoader: Cannot find or load texture ' + filename );

						} else {

							material_url = material_url.replace( /\\/g , '/' );

							loader.load( material_url, function( tex ) {

								if ( tex ) {

									// TODO: read texture settings from assimp.
									// Wrapping is the default, though.
									tex.wrapS = tex.wrapT = THREE.RepeatWrapping;

									mat[ keyname ] = tex;
									mat.needsUpdate = true;

								}

							});

						}

					})( prop.semantic );
				}
			}
			else if ( prop.key === '?mat.name' ) {

				init_props[ 'name' ] = prop.value;

			}
			else if ( prop.key === '$clr.diffuse' ) {

				init_props[ 'color' ] = toColor( prop.value );

			}
			else if ( prop.key === '$clr.specular' ) {

				init_props[ 'specular' ] = toColor( prop.value );

			}
			else if ( prop.key === '$clr.emissive' ) {

				init_props[ 'emissive' ] = toColor( prop.value );

			}
			else if ( prop.key === '$mat.shadingm' ) {

				// aiShadingMode_Flat
				if ( prop.value >= 1 ) {

					init_props[ 'flatShading' ] = true;

				}

			}
			else if ( prop.key === '$mat.shininess' ) {

				init_props[ 'shininess' ] = prop.value;

			}

			// note: three.js does not like it when a texture is added after the geometry
			// has been rendered once, see http://stackoverflow.com/questions/16531759/.
			// for this reason we fill all slots upfront with default textures

			if ( has_textures.length ) {

				for ( i = 0, e = has_textures.length; i < e; i++ ) {

					init_props[ has_textures[ i ] ] = defaultTexture();

				}

			}

			mat = new THREE.MeshPhongMaterial( init_props );

		}

		return mat;

	},

	parseBones : function( json, node ) {

		// Not really sure how to use 'transformation' / 'offsetMatrix' / 'weights'
		if ( json.animations ) {

			for ( i = 0; node.children && i < node.children.length; i++ ) {

				if ( json.meshes[ 0 ].bones && node.children[ i ].name && node.children[ i ].name.toUpperCase() === 'ROOT' ) {

					let previous_bone, root_id = 0, child_id = 0;

					function traverse( node ) {

						node.forEach( child_2 => {

							let new_bone_2 = new THREE.Bone();

							new_bone_2[ 'name' ] = child_2.name;
							new_bone_2[ 'transformation' ] = child_2.transformation;

							json.meshes[ 0 ].bones.every( bone => {

								if ( bone.name === child_2.name ) {

									if ( bone.offsetmatrix ) new_bone_2[ 'offsetMatrix' ] = bone.offsetmatrix;
									if ( bone.weights ) new_bone_2[ 'weights' ] = bone.weights;
									return false;

								}

								return true;

							});

							bones.push( new_bone_2 );
							previous_bone.add( new_bone_2 );

							if ( child_2.children && child_2.children.length > 0 ) {

								previous_bone = previous_bone.children[ 0 ];
								traverse( child_2.children );

							}

							child_id += 1;
						});

						return;
					}

					node.children[ i ].children.forEach( child_1 => {

						let new_bone_1 = new THREE.Bone();

						new_bone_1[ 'name' ] = child_1.name;
						new_bone_1[ 'transformation' ] = child_1.transformation;

						json.meshes[ 0 ].bones.every( bone => {

							if ( bone.name === child_1.name ) {

								if ( bone.offsetmatrix ) new_bone_1[ 'offsetMatrix' ] = bone.offsetmatrix;
								if ( bone.weights ) new_bone_1[ 'weights' ] = bone.weights;
								return false;

							}

							return true;

						});

						bones.push( new_bone_1 );
						root.add( new_bone_1 );

						if ( child_1.children && child_1.children.length > 0 ) {

							previous_bone = root.children[ root_id ];
							traverse( child_1.children );

						}

						root_id += 1;

					});

				}

			}

		}

	},

	parseObject : function( json, node, meshes, materials ) {

		let obj = new THREE.Object3D()
		,	i
		,	idx
		;

		obj.name = node.name || '';
		obj.matrix = new THREE.Matrix4().fromArray( node.transformation ).transpose();
		obj.matrix.decompose( obj.position, obj.quaternion, obj.scale );

		for ( i = 0; node.meshes && i < node.meshes.length; i++ ) {

			idx = node.meshes[ i ];

			let buffer_geometry = meshes[ idx ].type === 'Geometry' ? new THREE.BufferGeometry().fromGeometry( meshes[ idx ] ) : meshes[ idx ];

			obj.add( new THREE.Mesh( buffer_geometry, materials[ json.meshes[ idx ].materialindex ] ) );

		}

		for ( i = 0; node.children && i < node.children.length; i++ ) {

			obj.add( this.parseObject( json, node.children[ i ], meshes, materials ) );

		}

		return obj;

	},

};
