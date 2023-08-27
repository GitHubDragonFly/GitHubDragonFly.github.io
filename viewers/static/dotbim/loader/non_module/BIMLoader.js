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

			const bim_meshes = new THREE.Group();
			const bim_edges = new THREE.Group();

			function dotbim_CreateMeshes( dotbim ) {

				if ( typeof dotbim === 'string' ) {

					dotbim = JSON.parse( dotbim );

				} else {

					throw new Error( 'THREE.BIMLoader: Unknown format!' );

				}

				const { schema_version, meshes, elements, info } = dotbim;

				if ( ! meshes || ! elements ) {

					throw new Error( 'THREE.BIMLoader: No meshes or elements found!' );

				}

				const geometries = dotbim_Meshes2Geometries( meshes );

				dotbim_Elemments2Meshes( elements, geometries ).forEach( bim_mesh => {

					bim_mesh[ 'name' ] = 'mesh_' + bim_mesh.id;

					bim_meshes.add( bim_mesh );

					if ( bim_mesh.edges ) bim_edges.add( bim_mesh.edges );

				});

				if ( bim_meshes.children.length > 1 ) bim_meshes.rotateX( - Math.PI / 2 );
				if ( bim_edges.children.length > 0 ) bim_meshes.userData[ 'edges' ] = bim_edges;

				return bim_meshes;

			}
			
			function dotbim_Elemments2Meshes( elements, geometries ) {

				return elements.map( element => dotbim_Elemment2Mesh( element, geometries ) );

			}
			
			function dotbim_Elemment2Mesh( element, geometries ) {

				let { mesh_id, vector, rotation, guid, type, color, face_colors, info } = element;

				let geometry = geometries[ mesh_id ];
			
				geometry.computeVertexNormals();
			
				let material = new THREE.MeshPhongMaterial( {

					side: THREE.DoubleSide,
					flatShading: false,
					transparent: true,
					color: 0xCCCCCC

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

				}
			
				// Force the use of geometry color if exists ('colors')

				if ( geometry.getAttribute( 'color' ) ) {

					material.color = undefined;
					material.opacity = 1.0;
					material.transparent = true;
					material.vertexColors = true;

				}
			
				if ( ! vector ) vector = { x: 0, y: 0, z: 0 };
				if ( ! rotation ) rotation = { qx: 0, qy: 0, qz: 0, qw: 1 };
			
				let mesh = new THREE.Mesh( geometry, material );

				mesh.position.set( vector.x, vector.y, vector.z );
				mesh.quaternion.set( rotation.qx, rotation.qy, rotation.qz, rotation.qw );
			
				let innerGeometry = new THREE.BufferGeometry();
				innerGeometry.setAttribute( 'position', mesh.geometry.attributes.position );

				let innerEdgesGeometry = new THREE.EdgesGeometry( innerGeometry, 30 );
				let outline_material = new THREE.LineBasicMaterial( { color: 0xFF0000 } );
				let edges = new THREE.LineSegments( innerEdgesGeometry, outline_material );

				edges.position.set( vector.x, vector.y, vector.z );
				edges.quaternion.set( rotation.qx, rotation.qy, rotation.qz, rotation.qw );

				mesh[ 'edges' ] = edges;
			
				mesh.geometry.computeBoundingBox();
				mesh.geometry.computeBoundingSphere();
			
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
