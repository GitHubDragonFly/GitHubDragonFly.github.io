( function () {

	class BIMLoader extends THREE.Loader {

		constructor( manager ) {

			super( manager );

		}

		load( url, onLoad, onProgress, onError ) {

			const scope = this;
			const loader = new THREE.FileLoader( scope.manager );
			loader.setPath( scope.path );
			loader.setResponseType( 'text' );
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

		parse( text ) {

			const mesh_id_keys = {};
			const bim_meshes = new THREE.Group();
			const scale = new THREE.Vector3( 1.0, 1.0, 1.0 );

			function dotbim_CreateMeshes( dotbim ) {

				if ( typeof dotbim === 'string' ) {

					dotbim = JSON.parse( dotbim );

				} else {

					throw new Error( 'THREE.BIMLoader: Unknown format!' );

				}

				const { schema_version, meshes, elements, info } = dotbim;

				bim_meshes.userData[ 'schema_version' ] = schema_version || {};
				bim_meshes.userData[ 'info' ] = info || {};

				if ( info.Name && info.Name !== '' ) bim_meshes.name = info.Name;

				if ( ! meshes || ! elements ) {

					throw new Error( 'THREE.BIMLoader: No meshes or elements found!' );

				}

				elements.forEach( element => {

					if ( ! mesh_id_keys[ element[ 'mesh_id' ] ]) mesh_id_keys[ element[ 'mesh_id' ] ] = { face_colors_group: {}, color_group: {} };

					if ( element[ 'face_colors' ] ) {

						let mesh_id_key = mesh_id_keys[ element[ 'mesh_id' ] ][ 'face_colors_group' ][ element[ 'face_colors' ] ];

						if ( ! mesh_id_key ) {

							mesh_id_keys[ element[ 'mesh_id' ] ][ 'face_colors_group' ][ element[ 'face_colors' ] ] = { instance_count: 1, current_instance: 0, mesh: null };

						} else {

							mesh_id_key.instance_count++;

						}

					} else { // expected existing element[ 'color' ]

						let el_color = [ element[ 'color' ].r, element[ 'color' ].g, element[ 'color' ].b, element[ 'color' ].a ];
						let mesh_id_key = mesh_id_keys[ element[ 'mesh_id' ] ][ 'color_group' ][ el_color ];

						if ( ! mesh_id_key ) {

							mesh_id_keys[ element[ 'mesh_id' ] ][ 'color_group' ][ el_color ] = { instance_count: 1, current_instance: 0, mesh: null };

						} else {

							mesh_id_key.instance_count++;

						}

					}

				});

				const geometries = dotbim_Meshes2Geometries( meshes );

				dotbim_Elemments2Meshes( elements, geometries ).forEach( bim_mesh => {

					bim_meshes.add( bim_mesh );

				});

				if ( bim_meshes.children.length > 1 ) bim_meshes.rotateX( - Math.PI / 2 );

				return bim_meshes;

			}

			function dotbim_Elemments2Meshes( elements, geometries ) {

				return elements.map( element => dotbim_Elemment2Mesh( element, geometries ) );

			}

			function dotbim_Elemment2Mesh( element, geometries ) {

				let { mesh_id, vector, rotation, guid, type, color, face_colors, info } = element;

				let geometry;

				if ( geometries[ mesh_id ] ) {

					geometry = geometries[ mesh_id ].clone();

				} else {

					for ( const geo of geometries ) {

						if ( geo.userData.mesh_id === mesh_id ) {

							geometry = geo.clone();
							break;

						}

					}

					if ( ! geometry ) {

						throw new Error( 'THREE.BIMLoader: Geometry not found!' );

					}

				}

				let name = info.Name || '';

				geometry.computeVertexNormals();

				let material = new THREE.MeshStandardMaterial( {

					name: info[ 'Material' ] || 'Default Material',
					side: THREE.DoubleSide,
					flatShading: false,
					transparent: true,
					metalness: 0.5,
					roughness: 0.5,
					color: 0xFFFFFF

				} );

				if ( color ) {

					if ( color.r === 0 && color.g === 0 && color.b === 0 && color.a === 0 ) color = null;

				}

				// Support `face_colors` in element

				if ( face_colors ) {

					geometry = geometry.clone();

					let colors = createFaceColors( face_colors );

					geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colors, 4 ) );

				} else if ( color )	{

					geometry = geometry.clone();

					geometry.deleteAttribute( 'color' ); // Remove default color in the geometry

					material.color = convertTHREEColorRGB( color.r, color.g, color.b );
					material.opacity = convertColorAlpha( color.a );
					material.transparent = material.opacity < 1.0;
					material.needsUpdate = true;

				}

				// Force the use of geometry color if exists ('colors')

				if ( geometry.getAttribute( 'color' ) ) {

					material.color.setRGB( 1, 1, 1 );
					material.opacity = 1.0;
					material.transparent = true;
					material.vertexColors = true;
					material.needsUpdate = true;

				}

				if ( ! vector ) vector = { x: 0, y: 0, z: 0 };
				if ( ! rotation ) rotation = { qx: 0, qy: 0, qz: 0, qw: 1 };

				let mesh;

				if (face_colors && mesh_id_keys[ mesh_id ][ 'face_colors_group' ][ face_colors ]) {

					let mesh_id_key = mesh_id_keys[ mesh_id ][ 'face_colors_group' ][ face_colors ];

					if (mesh_id_key[ 'mesh' ] === null) {

						mesh_id_key[ 'mesh' ] = new THREE.InstancedMesh( geometry, material, mesh_id_key.instance_count );

					}

					mesh = mesh_id_key.mesh;

					let pos = new THREE.Vector3( vector.x, vector.y, vector.z );
					let rotq = new THREE.Quaternion( rotation.qx, rotation.qy, rotation.qz, rotation.qw );

					let matrix = new THREE.Matrix4().compose( pos, rotq, scale );

					mesh.setMatrixAt( mesh_id_key.current_instance, matrix );
					mesh.instanceMatrix.needsUpdate = true;

					if (name === '') name = 'mesh_' + mesh_id + '_' + mesh.id + '_' + mesh_id_key.current_instance;

					mesh.userData[ mesh_id_key.current_instance ] = { name: name, guid: guid || {}, type: type || {}, info: info || {} };
	
					mesh_id_key.current_instance++;

				} else { // expected existing 'color'

					let el_color = [ color.r, color.g, color.b, color.a ];
					let mesh_id_key = mesh_id_keys[ mesh_id ][ 'color_group' ][ el_color ];

					if ( mesh_id_key[ 'mesh' ] === null ) {

						mesh_id_key[ 'mesh' ] = new THREE.InstancedMesh( geometry, material, mesh_id_key.instance_count );

					}

					mesh = mesh_id_key.mesh;

					let pos = new THREE.Vector3( vector.x, vector.y, vector.z );
					let rotq = new THREE.Quaternion( rotation.qx, rotation.qy, rotation.qz, rotation.qw );

					let matrix = new THREE.Matrix4().compose( pos, rotq, scale );

					mesh.setMatrixAt( mesh_id_key.current_instance, matrix );
					mesh.instanceMatrix.needsUpdate = true;

					mesh.setColorAt( mesh_id_key.current_instance, material.color );
					mesh.instanceColor.needsUpdate = true;

					if (name === '') name = 'mesh_' + mesh_id + '_' + mesh.id + '_' + mesh_id_key.current_instance;

					mesh.userData[ mesh_id_key.current_instance ] = { name: name, guid: guid || {}, type: type || {}, info: info || {} };

					mesh_id_key.current_instance++;
				}

				if ( info.Name && info.Name !== '' ) mesh.name = info.Name;

				return mesh;

			}

			function dotbim_Meshes2Geometries( meshes ) {

				return meshes.map( mesh => dotbim_Mesh2GeometryColor( mesh ) );

			}

			function dotbim_Mesh2GeometryColor( mesh ) {

				const { mesh_id, coordinates, indices, colors } = mesh;

				let geometry = new THREE.BufferGeometry();

				geometry.setIndex( indices );
				geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( coordinates, 3 ) );

				geometry = geometry.toNonIndexed(); // Use this to remove Index and make color work with face

				if ( colors ) {

					buffer_colors = createFaceColors( colors, 3, 4 * indices.length );
					geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( buffer_colors, 4 ) );

				}

				geometry.computeVertexNormals();

				geometry.userData[ 'mesh_id' ] = mesh_id;

				return geometry;

			}

			function createFaceColors( color4arrary, repeat = 3, max = 0 ) {

				let colors = [];

				for ( let index = 0, length = color4arrary.length; index < length; index += 4 ) {

					let c1 = color4arrary[ index + 0 ];
					let c2 = color4arrary[ index + 1 ];
					let c3 = color4arrary[ index + 2 ];

					let c4 = convertColorAlpha( color4arrary[ index + 3 ] );

					let color = convertTHREEColorRGB( c1, c2, c3 );

					for ( let i = 0; i < repeat; i++ ) colors.push( color.r, color.g, color.b, c4 );

				}

				while ( colors.length < max ) {

					for ( let i = 0; i < repeat; i++ ) colors.push( colors[ 0 ], colors[ 1 ], colors[ 2 ], colors[ 3 ] );

				}

				return colors;

			}

			function convertTHREEColorRGB( r, g, b ) {

				let new_color = new THREE.Color( r / 255.0, g / 255.0, b / 255.0 );
				new_color.setStyle( new_color.getStyle(), THREE.SRGBColorSpace );

				return new_color;

			}

			function convertColorAlpha( alpha )	{

				return alpha / 255.0;

			}

			return dotbim_CreateMeshes( text );

		}

	}

	THREE.BIMLoader = BIMLoader;

} )();
