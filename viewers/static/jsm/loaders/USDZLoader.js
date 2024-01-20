import {
	BufferAttribute,
	BufferGeometry,
	ClampToEdgeWrapping,
	FileLoader,
	Group,
	Loader,
	Mesh,
	MeshPhysicalMaterial,
	MirroredRepeatWrapping,
	NoColorSpace,
	RepeatWrapping,
	TextureLoader,
	Object3D,
	Vector2,
} from "three";
import * as fflate from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/fflate.module.js";

class USDAParser {

	parse( text ) {

		const data = {};

		const lines = text.split( '\n' );

		let group, meta;
		let string = null;
		let target = data;
		let lhs, rhs, assignment;

		const stack = [ data ];

		function parse_lines() {

			for ( const line of lines ) {

				if ( line.trim() === '' ) continue;

				if ( line.includes( '=' ) ) {

					assignment = line.split( '=' );

					lhs = assignment[ 0 ].trim();
					rhs = assignment[ 1 ].trim();

					if ( rhs.endsWith( '{' ) ) {

						group = {};
						stack.push( group );

						target[ lhs ] = group;
						target = group;

					} else {

						target[ lhs ] = rhs;

					}

				} else if ( line.endsWith( '{' ) ) {

					group = target[ string ] || {};
					stack.push( group );

					target[ string ] = group;
					target = group;

				} else if ( line.endsWith( '}' ) ) {

					stack.pop();

					if ( stack.length === 0 ) continue;

					target = stack[ stack.length - 1 ];

				} else if ( line.endsWith( '(' ) ) {

					meta = {};
					stack.push( meta );

					string = line.split( '(' )[ 0 ].trim() || string;

					target[ string ] = meta;
					target = meta;

				} else if ( line.endsWith( ')' ) ) {

					stack.pop();

					if ( stack.length === 0 ) continue;

					target = stack[ stack.length - 1 ];

				} else {

					string = line.trim();

				}

			}

		}

		parse_lines();

		return data;

	}

}

class USDZLoader extends Loader {

	constructor( manager ) {

		super( manager );

	}

	load( url, onLoad, onProgress, onError ) {

		const scope = this;

		const loader = new FileLoader( scope.manager );
		loader.setPath( scope.path );
		loader.setResponseType( 'arraybuffer' );
		loader.setRequestHeader( scope.requestHeader );
		loader.setWithCredentials( scope.withCredentials );
		loader.load( url, function ( text ) {

			try {

				onLoad( scope.parse( text ) );

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

	parse( buffer ) {

		const parser = new USDAParser();

		function parseAssets( zip ) {

			const data = {};
			const loader = new FileLoader();
			loader.setResponseType( 'arraybuffer' );

			for ( const filename in zip ) {

				if ( filename.endsWith( 'png' ) ) {

					const blob = new Blob( [ zip[ filename ] ], { type: { type: 'image/png' } } );
					data[ filename ] = URL.createObjectURL( blob );

				}

				if ( filename.endsWith( 'usd' ) || filename.endsWith( 'usda' ) ) {

					const text = fflate.strFromU8( zip[ filename ] );
					data[ filename ] = parser.parse( text );

				}

			}

			return data;

		}

		function findUSD( zip ) {

			for ( const filename in zip ) {

				if ( filename.endsWith( 'usda' ) ) {

					return zip[ filename ];

				} else if ( filename.endsWith( 'usdc' ) ) {

					console.warn( 'THREE.USDZLoader: Found crate file (.usdc) which is not supported.' );

				}

			}

		}

		const zip = fflate.unzipSync( new Uint8Array( buffer ) );

		const assets = parseAssets( zip );

		const file = findUSD( zip );

		if ( file === undefined ) {

			throw new Error( 'THREE.USDZLoader: No usda file found.' );

		}

		// Parse file

		const text = fflate.strFromU8( file );
		const root = parser.parse( text );

		// Build scene

		function findMeshGeometry( data ) {

			if ( ! data ) return undefined;

			if ( 'prepend references' in data ) {

				const reference = data[ 'prepend references' ];
				const parts = reference.split( '@' );
				const path = parts[ 1 ].replace( /^.\//, '' );
				const id = parts[ 2 ].replace( /^<\//, '' ).replace( />$/, '' );

				return findGeometry( assets[ path ], id );

			}

			return findGeometry( data );

		}

		function findGeometry( data, id ) {

			if ( ! data ) return undefined;

			if ( id !== undefined ) {

				const def = `def Mesh "${id}"`;

				if ( def in data ) {

					return data[ def ];

				}

			}

			for ( const name in data ) {

				const object = data[ name ];

				if ( name.startsWith( 'def Mesh' ) ) {

					// Move points to Mesh

					if ( 'point3f[] points' in data ) {

						object[ 'point3f[] points' ] = data[ 'point3f[] points' ];

					}

					// Move st to Mesh

					if ( 'float2[] primvars:st' in data ) {

						object[ 'float2[] primvars:st' ] = data[ 'float2[] primvars:st' ];

					}

					if ( 'texCoord2f[] primvars:st' in data ) {

						object[ 'texCoord2f[] primvars:st' ] = data[ 'texCoord2f[] primvars:st' ];

					}

					// Move st indices to Mesh

					if ( 'int[] primvars:st:indices' in data ) {

						object[ 'int[] primvars:st:indices' ] = data[ 'int[] primvars:st:indices' ];

					}

					return object;

				}


				if ( typeof object === 'object' ) {

					const geometry = findGeometry( object );

					if ( geometry ) return geometry;

				}

			}

		}

		function buildGeometry( data ) {

			if ( ! data ) return undefined;

			let geometry = new BufferGeometry();

			if ( 'int[] faceVertexIndices' in data ) {

				const indices = JSON.parse( data[ 'int[] faceVertexIndices' ] );
				geometry.setIndex( indices );

			}

			if ( 'point3f[] points' in data ) {

				const positions = JSON.parse( data[ 'point3f[] points' ].replace( /[()]*/g, '' ) );
				const attribute = new BufferAttribute( new Float32Array( positions ), 3 );
				geometry.setAttribute( 'position', attribute );

			}

			if ( 'normal3f[] normals' in data ) {

				const normals = JSON.parse( data[ 'normal3f[] normals' ].replace( /[()]*/g, '' ) );
				const attribute = new BufferAttribute( new Float32Array( normals ), 3 );
				geometry.setAttribute( 'normal', attribute );

			} else {

				geometry.computeVertexNormals();

			}

			if ( 'float2[] primvars:st' in data ) {

				data[ 'texCoord2f[] primvars:st' ] = data[ 'float2[] primvars:st' ];

			}

			if ( 'texCoord2f[] primvars:st' in data ) {

				const uvs = JSON.parse( data[ 'texCoord2f[] primvars:st' ].replace( /[()]*/g, '' ) );
				const attribute = new BufferAttribute( new Float32Array( uvs ), 2 );

				if ( 'int[] primvars:st:indices' in data ) {

					geometry = geometry.toNonIndexed();

					const indices = JSON.parse( data[ 'int[] primvars:st:indices' ] );
					geometry.setAttribute( 'uv', toFlatBufferAttribute( attribute, indices ) );

				} else {

					geometry.setAttribute( 'uv', attribute );

				}

			}

			return geometry;

		}

		function toFlatBufferAttribute( attribute, indices ) {

			const array = attribute.array;
			const itemSize = attribute.itemSize;

			const array2 = new array.constructor( indices.length * itemSize );

			let index = 0, index2 = 0;

			for ( let i = 0, l = indices.length; i < l; i ++ ) {

				index = indices[ i ] * itemSize;

				for ( let j = 0; j < itemSize; j ++ ) {

					array2[ index2 ++ ] = array[ index ++ ];

				}

			}

			return new BufferAttribute( array2, itemSize );

		}

		function findMeshMaterial( data ) {

			if ( ! data ) return undefined;

			if ( 'rel material:binding' in data ) {

				const reference = data[ 'rel material:binding' ];
				const id = reference.replace( /^<\//, '' ).replace( />$/, '' );
				const parts = id.split( '/' );

				return findMaterial( root, ` "${ parts[ 1 ] }"` );

			}

			return findMaterial( data );

		}

		function findMaterial( data, id = '' ) {

			for ( const name in data ) {

				const object = data[ name ];

				if ( name.startsWith( 'def Material' + id ) ) {

					return object;

				}

				if ( typeof object === 'object' ) {

					const material = findMaterial( object, id );

					if ( material ) return material;

				}

			}

		}

		function setTextureParams( map, data_value ) {

			// rotation, scale and translation

			if ( data_value[ 'float inputs:rotation' ] ) {

				map.rotation = parseFloat( data_value[ 'float inputs:rotation' ] );

			}

			if ( data_value[ 'float2 inputs:scale' ] ) {

				map.repeat = new Vector2().fromArray( JSON.parse( '[' + data_value[ 'float2 inputs:scale' ].replace( /[()]*/g, '' ) + ']' ) );

			}

			if ( data_value[ 'float2 inputs:translation' ] ) {

				map.offset = new Vector2().fromArray( JSON.parse( '[' + data_value[ 'float2 inputs:translation' ].replace( /[()]*/g, '' ) + ']' ) );

			}

		}

		function buildMaterial( data ) {

			const material = new MeshPhysicalMaterial( { name: Loader.DEFAULT_MATERIAL_NAME } );

			if ( data !== undefined ) {

				if ( 'def Shader "PreviewSurface"' in data ) {

					const surface = data[ 'def Shader "PreviewSurface"' ];

					if ( 'float inputs:opacity' in surface ) {

						material.opacity = parseFloat( surface[ 'float inputs:opacity' ] );

						if ( 'float inputs:opacityThreshold' in surface ) {

							let opacity_threshold = parseFloat( surface[ 'float inputs:opacityThreshold' ] );

							// workaround to set transmission values
							// this will approximate the models appearance

							if ( opacity_threshold === 0.0059 || opacity_threshold === 0.0058 ) {

								material.transmission = 1;

								// set transmissionMap

								if ( 'float inputs:opacity.connect' in surface ) {

									const path = surface[ 'float inputs:opacity.connect' ];
									const sampler = findTexture( root, /(\w+).output/.exec( path )[ 1 ] );

									material.transmissionMap = buildTexture( sampler );
									material.transmissionMap.colorSpace = NoColorSpace;

									if ( 'def Shader "Transform2d_opacity"' in data ) {

										setTextureParams( material.transmissionMap, data[ 'def Shader "Transform2d_opacity"' ] );

									}

								}

							} else { // opacity_threshold is 0.0057

								material.transparent = true;

								// set alphaMap

								if ( 'float inputs:opacity.connect' in surface ) {

									const path = surface[ 'float inputs:opacity.connect' ];
									const sampler = findTexture( root, /(\w+).output/.exec( path )[ 1 ] );

									material.alphaMap = buildTexture( sampler );
									material.alphaMap.colorSpace = NoColorSpace;

									if ( 'def Shader "Transform2d_opacity"' in data ) {

										setTextureParams( material.alphaMap, data[ 'def Shader "Transform2d_opacity"' ] );

									}

								}

							}

						}

					}

					if ( 'color3f inputs:diffuseColor' in surface ) {

						const color = surface[ 'color3f inputs:diffuseColor' ].replace( /[()]*/g, '' );
						material.color.fromArray( JSON.parse( '[' + color + ']' ) );

					}

					if ( 'color3f inputs:diffuseColor.connect' in surface ) {

						const path = surface[ 'color3f inputs:diffuseColor.connect' ];
						const sampler = findTexture( root, /(\w+).output/.exec( path )[ 1 ] );

						material.map = buildTexture( sampler );
						material.map.colorSpace = NoColorSpace;

						if ( 'def Shader "Transform2d_diffuse"' in data ) {

							setTextureParams( material.map, data[ 'def Shader "Transform2d_diffuse"' ] );

						}

					}

					if ( 'color3f inputs:emissiveColor' in surface ) {

						const color = surface[ 'color3f inputs:emissiveColor' ].replace( /[()]*/g, '' );

						material.emissive.fromArray( JSON.parse( '[' + color + ']' ) );

						if ( material.emissive.getHex() > 0 ) {

							if ( 'color3f inputs:emissiveColor.connect' in surface ) {

								const path = surface[ 'color3f inputs:emissiveColor.connect' ];
								const sampler = findTexture( root, /(\w+).output/.exec( path )[ 1 ] );

								material.emissiveMap = buildTexture( sampler );
								material.emissiveMap.colorSpace = NoColorSpace;

								if ( 'def Shader "Transform2d_emissive"' in data ) {

									setTextureParams( material.emissiveMap, data[ 'def Shader "Transform2d_emissive"' ] );

								}

							}

						} else {

							material.emissive.fromArray( [ 1, 1, 1 ] );

						}

					}

					if ( 'color3f inputs:specularColor' in surface ) {

						const color = surface[ 'color3f inputs:specularColor' ].replace( /[()]*/g, '' );
						material.specularColor.fromArray( JSON.parse( '[' + color + ']' ) );

						if ( material.specularColor.getHex() > 0 ) {

							if ( 'color3f inputs:specularColor.connect' in surface ) {

								const path = surface[ 'color3f inputs:specularColor.connect' ];
								const sampler = findTexture( root, /(\w+).output/.exec( path )[ 1 ] );

								material.specularColorMap = buildTexture( sampler );
								material.specularColorMap.colorSpace = NoColorSpace;

								if ( 'def Shader "Transform2d_specularColor"' in data ) {

									setTextureParams( material.specularColorMap, data[ 'def Shader "Transform2d_specularColor"' ] );

								}

							}

						}

					}

					if ( 'normal3f inputs:normal.connect' in surface ) {

						const path = surface[ 'normal3f inputs:normal.connect' ];
						const sampler = findTexture( root, /(\w+).output/.exec( path )[ 1 ] );

						material.normalMap = buildTexture( sampler );
						material.normalMap.colorSpace = NoColorSpace;

						if ( 'def Shader "Transform2d_normal"' in data ) {

							setTextureParams( material.normalMap, data[ 'def Shader "Transform2d_normal"' ] );

						}

					}

					if ( 'float inputs:roughness' in surface ) {

						material.roughness = parseFloat( surface[ 'float inputs:roughness' ] );
						if ( material.transmission > 0 && material.roughness === 1 ) material.roughness = 0.95;

						if ( 'float inputs:roughness.connect' in surface ) {

							const path = surface[ 'float inputs:roughness.connect' ];
							const sampler = findTexture( root, /(\w+).output/.exec( path )[ 1 ] );

							if ( ! material.roughness || material.roughness === 0 ) material.roughness = 1.0;

							material.roughnessMap = buildTexture( sampler );
							material.roughnessMap.colorSpace = NoColorSpace;

							if ( 'def Shader "Transform2d_roughness"' in data ) {

								setTextureParams( material.roughnessMap, data[ 'def Shader "Transform2d_roughness"' ] );

							}

						}

					}

					if ( 'float inputs:metallic' in surface ) {

						material.metalness = parseFloat( surface[ 'float inputs:metallic' ] );

						if ( 'float inputs:metallic.connect' in surface ) {

							const path = surface[ 'float inputs:metallic.connect' ];
							const sampler = findTexture( root, /(\w+).output/.exec( path )[ 1 ] );

							if ( ! material.metalness || material.metalness === 0 ) material.metalness = 1.0;

							material.metalnessMap = buildTexture( sampler );
							material.metalnessMap.colorSpace = NoColorSpace;

							if ( 'def Shader "Transform2d_metallic"' in data ) {

								setTextureParams( material.metalnessMap, data[ 'def Shader "Transform2d_metallic"' ] );

							}

						}

					}

					if ( 'float inputs:clearcoat' in surface ) {

						material.clearcoat = parseFloat( surface[ 'float inputs:clearcoat' ] );

						if ( material.clearcoat > 0 ) {

							if ( 'float inputs:clearcoat.connect' in surface ) {

								const path = surface[ 'float inputs:clearcoat.connect' ];
								const sampler = findTexture( root, /(\w+).output/.exec( path )[ 1 ] );

								material.clearcoatMap = buildTexture( sampler );
								material.clearcoatMap.colorSpace = NoColorSpace;

								if ( 'def Shader "Transform2d_clearcoat"' in data ) {

									setTextureParams( material.clearcoatMap, data[ 'def Shader "Transform2d_clearcoat"' ] );

								}

							}

						}

					}

					if ( 'float inputs:clearcoatRoughness' in surface ) {

						material.clearcoatRoughness = parseFloat( surface[ 'float inputs:clearcoatRoughness' ] );

						if ( material.clearcoatRoughness > 0 ) {

							if ( 'float inputs:clearcoatRoughness.connect' in surface ) {

								const path = surface[ 'float inputs:clearcoatRoughness.connect' ];
								const sampler = findTexture( root, /(\w+).output/.exec( path )[ 1 ] );

								material.clearcoatRoughnessMap = buildTexture( sampler );
								material.clearcoatRoughnessMap.colorSpace = NoColorSpace;

								if ( 'def Shader "Transform2d_clearcoatRoughness"' in data ) {

									setTextureParams( material.clearcoatRoughnessMap, data[ 'def Shader "Transform2d_clearcoatRoughness"' ] );

								}

							}

						}

					}

					if ( 'float inputs:ior' in surface ) {

						material.ior = parseFloat( surface[ 'float inputs:ior' ] );

					}

					if ( 'float inputs:occlusion.connect' in surface ) {

						const path = surface[ 'float inputs:occlusion.connect' ];
						const sampler = findTexture( root, /(\w+).output/.exec( path )[ 1 ] );

						material.aoMap = buildTexture( sampler );
						material.aoMap.colorSpace = NoColorSpace;

						if ( 'def Shader "Transform2d_occlusion"' in data ) {

							setTextureParams( material.aoMap, data[ 'def Shader "Transform2d_occlusion"' ] );

						}

					}

				}

				if ( 'def Shader "diffuseColor_texture"' in data ) {

					const sampler = data[ 'def Shader "diffuseColor_texture"' ];

					material.map = buildTexture( sampler );
					material.map.colorSpace = NoColorSpace;

				}

				if ( 'def Shader "normal_texture"' in data ) {

					const sampler = data[ 'def Shader "normal_texture"' ];

					material.normalMap = buildTexture( sampler );
					material.normalMap.colorSpace = NoColorSpace;

				}

			}

			return material;

		}

		function findTexture( data, id ) {

			for ( const name in data ) {

				const object = data[ name ];

				if ( name.startsWith( `def Shader "${ id }"` ) ) {

					return object;

				}

				if ( typeof object === 'object' ) {

					const texture = findTexture( object, id );

					if ( texture ) return texture;

				}

			}

		}

		function buildTexture( data ) {

			if ( 'asset inputs:file' in data ) {

				const path = data[ 'asset inputs:file' ].replace( /@*/g, '' );

				const loader = new TextureLoader();

				const texture = loader.load( assets[ path ] );

				const map = {
					'"clamp"': ClampToEdgeWrapping,
					'"mirror"': MirroredRepeatWrapping,
					'"repeat"': RepeatWrapping
				};

				if ( 'token inputs:wrapS' in data ) {

					texture.wrapS = map[ data[ 'token inputs:wrapS' ] ];

				}

				if ( 'token inputs:wrapT' in data ) {

					texture.wrapT = map[ data[ 'token inputs:wrapT' ] ];

				}

				return texture;

			}

			return null;

		}

		function buildObject( data ) {

			const geometry = buildGeometry( findMeshGeometry( data ) );
			const material = buildMaterial( findMeshMaterial( data ) );

			const mesh = geometry ? new Mesh( geometry, material ) : new Object3D();

			if ( 'matrix4d xformOp:transform' in data ) {

				const array = JSON.parse( '[' + data[ 'matrix4d xformOp:transform' ].replace( /[()]*/g, '' ) + ']' );

				mesh.matrix.fromArray( array );
				mesh.matrix.decompose( mesh.position, mesh.quaternion, mesh.scale );

			}

			return mesh;

		}

		function buildHierarchy( data, group ) {

			for ( const name in data ) {

				if ( name.startsWith( 'def Scope' ) ) {

					buildHierarchy( data[ name ], group );

				} else if ( name.startsWith( 'def Xform' ) ) {

					const mesh = buildObject( data[ name ] );

					if ( /def Xform "(\w+)"/.test( name ) ) {

						mesh.name = /def Xform "(\w+)"/.exec( name )[ 1 ];

					}

					group.add( mesh );

					buildHierarchy( data[ name ], mesh );

				}

			}

		}

		const group = new Group();

		buildHierarchy( root, group );

		return group;

	}

}

export { USDZLoader };
