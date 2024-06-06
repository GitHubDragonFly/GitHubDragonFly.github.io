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
var scope;
var root;
var bones = [];
var bone_id;
var has_bones = false;
var has_points_or_lines = false;
var isPoints = false;
var isLines = false;

THREE.AssimpJSONLoader = function ( manager ) {

	this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;

};

THREE.AssimpJSONLoader.prototype = {

	constructor: THREE.AssimpJSONLoader,

	texturePath : '',

	load: function ( url, onLoad, onProgress, onError, texturePath ) {

		scope = this;

		if ( texturePath && ( typeof texturePath === "string" ) ) {

			if ( texturePath.includes( ',' ) ) {

				blobs = texturePath.split( ',' );
	
			} else {

				scope.texturePath = texturePath;

			}

		} else {

			scope.texturePath = scope.extractUrlBase( url );

		}

		var loader = new THREE.FileLoader( scope.manager );
		loader.setCrossOrigin( scope.crossOrigin );

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

			scene[ 'has_bones' ] = has_bones;

			if ( json.animations && has_bones === true ) {

				scene[ 'animations' ] = json.animations;
				//TODO: fix bones & parse animations

			}

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

		let meshes = this.parseMeshList ( json, this.parseMesh );
		let materials = this.parseMaterialList ( json, this.parseMaterial );

		return this.parseObject( json, json.rootnode, meshes, materials );

	},

	parseMeshList : function( json, handler ) {

		let meshes = new Array( json.meshes.length );

		for( let i = 0; i < json.meshes.length; i++ ) {

			meshes[ i ] = handler.call( this, json.meshes[ i ], json );

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

	parseMesh : function( mesh, json ) {

		var geometry, i, j, e, ee, face, src, a, b, c;

		geometry = new THREE.Geometry();

		if ( mesh.primitivetypes === 1 ) {

			isPoints = true;
			has_points_or_lines = true;
			geometry[ 'isPoints' ] = true;

		} else if ( mesh.primitivetypes === 2 ) {

			isLines = true;
			has_points_or_lines = true;
			geometry[ 'isLines' ] = true;

		}

		// read vertex positions

		for( i = 0, e = mesh.vertices.length; i < e; i += 3 ) {

			geometry.vertices.push( new THREE.Vector3( mesh.vertices[ i ], mesh.vertices[ i + 1 ], mesh.vertices[ i + 2 ] ) );

		}

		// read faces

		for ( i = 0, e = mesh.faces.length; i < e; i++ ) {

			face = new THREE.Face3();

			src = mesh.faces[ i ];

			face.a = src[ 0 ];
			face.b = ( isPoints === true ) ? src[ 0 ] : src[ 1 ];
			face.c = ( isPoints === true ) ? src[ 0 ] : ( ( isLines === true ) ? src[ 1 ] : src[ 2 ] );

			face.materialIndex = 0; //mesh.materialindex;

			geometry.faces.push( face );

		}

		// read texture coordinates - three.js attaches them to its faces

		mesh.texturecoords = mesh.texturecoords || [];

		if ( geometry.faceVertexUvs === undefined ) geometry.faceVertexUvs = {};

		for ( i = 0, e = mesh.texturecoords.length; i < e; i++ ) {

			if ( geometry.faceVertexUvs[ i ] === undefined ) geometry.faceVertexUvs[ i ] = [];

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

			convertTextureCoords( mesh.texturecoords[ i ], geometry.faces, geometry.faceVertexUvs[ i ] );
		}

		// read normals - three.js also attaches them to its faces

		if ( mesh.normals ) {

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

			convertNormals( mesh.normals, geometry.faces );
		}

		// read vertex colors - three.js also attaches them to its faces

		if ( mesh.colors && mesh.colors[ 0 ] ) {

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

			convertColors( mesh.colors[ 0 ], geometry.faces );
		}

		if ( mesh.bones ) {

			this.parseBones( json.rootnode, mesh.bones );
			geometry[ 'bones' ] = bones;
			has_bones = true;

		}

		geometry.computeFaceNormals();
		geometry.computeVertexNormals();
		geometry.computeBoundingBox();
		geometry.computeBoundingSphere();

		isPoints = false;
		isLines = false;

		return geometry;

	},

	parseMaterial : function( material, textures ) {

		scope = this;

		let mat = null;
		let i, e, prop, has_textures = [];
		let init_props = { color: 0xFFFFFF, flatShading: false };

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
			const color = new THREE.Color( 0xFFFFFF );

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

			let tex = new THREE.DataTexture( data, width, height );
			tex.encoding = THREE.sRGBEncoding;

			return tex;

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

								console.warn( 'THREE.AssimpJSONLoader: Texture pointer is not numeric ' + filename );

							}

						} else if ( filename.toLowerCase().endsWith( '.dds' ) ) {

							if ( THREE.DDSLoader ) {

								loader = new THREE.DDSLoader( scope.manager );

							}

						} else if ( filename.toLowerCase().endsWith( '.tga' ) ) {

							if ( THREE.TGALoader ) {

								loader = new THREE.TGALoader( scope.manager );

							}

						}

						loader.setCrossOrigin( scope.crossOrigin );

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
									tex.encoding = THREE.sRGBEncoding;
									tex.format = THREE.RGBAFormat;

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

	parseBones : function( rootnode, mesh_bones ) {

		if ( mesh_bones ) {

			bones.length = 0;

			for ( i = 0, il = rootnode.children.length; i < il; i++ ) {

				root = new THREE.Object3D();

				let root_pos = new THREE.Vector3();
				let root_rotq = new THREE.Quaternion();
				let root_scl = new THREE.Vector3();

				new THREE.Matrix4().fromArray( rootnode.children[ i ].transformation ).transpose().decompose( root_pos, root_rotq, root_scl );

				root.position.x = root_pos.x;
				root.position.y = root_pos.y;
				root.position.z = root_pos.z;

				root.quaternion.x = root_rotq.x;
				root.quaternion.y = root_rotq.y;
				root.quaternion.z = root_rotq.z;
				root.quaternion.w = root_rotq.w;

				root.scale.x = root_scl.x;
				root.scale.y = root_scl.y;
				root.scale.z = root_scl.z;

				bone_id = 0;
				let current_index = -1;

				this.traverse( rootnode.children[ i ].children, current_index, mesh_bones );

			}

		}

	},

	traverse: function( children, current_index, mesh_bones ) {

		// Not really sure how to manipulate 'transformation' / 'offsetMatrix' / 'weights'

		for ( let i = 0, il = children.length; i < il; i++ ) {

			let pos = new THREE.Vector3();
			let rotq = new THREE.Quaternion();
			let scl = new THREE.Vector3();
	
			let new_bone = new THREE.Bone();

			new_bone[ 'name' ] = children[ i ].name;
			new_bone[ 'transformation' ] = children[ i ].transformation;

			let new_bone_transformation = new THREE.Matrix4().fromArray( children[ i ].transformation );
			let new_bone_inverse_transformation = new_bone_transformation.getInverse( new_bone_transformation );

			mesh_bones.every( bone => {

				if ( bone.name === children[ i ].name ) {

					new_bone[ 'offsetMatrix' ] = bone.offsetmatrix;
					new_bone[ 'weights' ] = bone.weights;

					let new_bone_offsetmatrix = new THREE.Matrix4().fromArray( bone.offsetmatrix );
					let new_bone_inverse_offsetmatrix = new_bone_offsetmatrix.getInverse( new_bone_offsetmatrix );

					new_bone_transformation.multiply( new_bone_offsetmatrix ).transpose().decompose( pos, rotq, scl );

					new_bone.position.x = pos.x;
					new_bone.position.y = pos.y;
					new_bone.position.z = pos.z;

					new_bone.quaternion.x = rotq.x;
					new_bone.quaternion.y = rotq.y;
					new_bone.quaternion.z = rotq.z;
					new_bone.quaternion.w = rotq.w;

					new_bone.scale.x = scl.x;
					new_bone.scale.y = scl.y;
					new_bone.scale.z = scl.z;

					return false;

				}

				return true;

			});

			bones.push( new_bone );

			if ( current_index === -1 ) {

				root.add( new_bone );

			} else {

				bones[ bone_id - current_index - 1 ].add( new_bone );

			}

			bone_id += 1;
			current_index += 1;

			if ( children[ i ].children && children[ i ].children.length > 0 ) {
	
				this.traverse( children[ i ].children, i, mesh_bones );

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
			if ( bones.length > 0 ) buffer_geometry[ 'bones' ] = bones;

			if ( meshes[ idx ].isPoints && meshes[ idx ].isPoints === true ) {

				obj.add( new THREE.Points( buffer_geometry, new THREE.PointsMaterial( { size: 0.02, color: materials[ json.meshes[ idx ].materialindex ].color } ) ) );

			} else if ( meshes[ idx ].isLines && meshes[ idx ].isLines === true ) {

				obj.add( new THREE.LineSegments( buffer_geometry, new THREE.LineBasicMaterial( { color: materials[ json.meshes[ idx ].materialindex ].color, linewidth: 0.5 } ) ) );

			} else {

				obj.add( new THREE.Mesh( buffer_geometry, materials[ json.meshes[ idx ].materialindex ] ) );

			}

		}

		for ( i = 0; node.children && i < node.children.length; i++ ) {

			obj.add( this.parseObject( json, node.children[ i ], meshes, materials ) );

		}

		obj[ 'has_points_or_lines' ] = has_points_or_lines;

		return obj;

	},

};
