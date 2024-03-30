import {
	BufferGeometry,
	Color,
	DoubleSide,
	FileLoader,
	Float32BufferAttribute,
	Group,
	InstancedMesh,
	Loader,
	Matrix4,
	MeshStandardMaterial,
	Quaternion,
	Vector3
} from "three";

import { mergeVertices } from "https://cdn.jsdelivr.net/npm/three@0.163.0/examples/jsm/utils/BufferGeometryUtils.min.js";

// Based on: https://github.com/ricaun/dotbim.three.js

class BIMLoader extends Loader {

	constructor( manager ) {

		super( manager );

	}

	load( url, onLoad, onProgress, onError ) {

		const scope = this;
		const loader = new FileLoader( scope.manager );
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
		const bim_meshes = new Group();
		const scale = new Vector3( 1.0, 1.0, 1.0 );

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

			let name = ( info && info.Name ) ? info.Name : '';

			geometry.computeVertexNormals();

			let material = new MeshStandardMaterial( {

				name: ( info && info[ 'Material' ] ) ? info[ 'Material' ] : '__DEFAULT',
				side: DoubleSide,
				flatShading: false,
				transparent: true,
				metalness: 0.4,
				roughness: 0.6,
				color: 0xFFFFFF

			} );

			if ( color ) {

				if ( color.r === 0 && color.g === 0 && color.b === 0 && color.a === 0 ) color = null;

			}

			// Support `face_colors` in element

			if ( face_colors && face_colors.length > 0 ) {

				if ( geometry.index ) geometry = geometry.toNonIndexed(); // Remove index to make color work with face

				if ( geometry.hasAttribute( 'color' ) ) geometry.deleteAttribute( 'color' );

				const buffer_colors = createFaceColors( face_colors, 3, 4 * geometry.attributes.position.count );
				geometry.setAttribute( 'color', new Float32BufferAttribute( buffer_colors, 4 ) );

				material.color.setRGB( 1, 1, 1 );
				material.opacity = 1.0;
				material.transparent = true;
				material.vertexColors = true;

			} else if ( color ) {

				material.color = new Color( color.r / 255.0, color.g / 255.0, color.b / 255.0 );
				material.opacity = color.a / 255.0;
				material.transparent = material.opacity < 1.0;

			}

			if ( ! vector ) vector = { x: 0, y: 0, z: 0 };
			if ( ! rotation ) rotation = { qx: 0, qy: 0, qz: 0, qw: 1 };

			let mesh;

			if ( face_colors && mesh_id_keys[ mesh_id ][ 'face_colors_group' ][ face_colors ] ) {

				let mesh_id_key = mesh_id_keys[ mesh_id ][ 'face_colors_group' ][ face_colors ];

				if ( mesh_id_key[ 'mesh' ] === null ) {

					mesh_id_key[ 'mesh' ] = new InstancedMesh( geometry, material, mesh_id_key.instance_count );

				}

				mesh = mesh_id_key.mesh;

				let pos = new Vector3( vector.x, vector.y, vector.z );
				let rotq = new Quaternion( rotation.qx, rotation.qy, rotation.qz, rotation.qw );

				let matrix = new Matrix4().compose( pos, rotq, scale );

				mesh.setMatrixAt( mesh_id_key.current_instance, matrix );
				mesh.instanceMatrix.needsUpdate = true;

				if (name === '') name = 'mesh_' + mesh_id + '_' + mesh.id + '_' + mesh_id_key.current_instance;

				mesh.userData[ mesh_id_key.current_instance ] = { name: name, guid: guid, type: type, info: info || {} };

				mesh_id_key.current_instance++;

			} else { // expected existing 'color'

				if ( ! color ) return;

				let el_color = [ color.r, color.g, color.b, color.a ];
				let mesh_id_key = mesh_id_keys[ mesh_id ][ 'color_group' ][ el_color ];

				if (mesh_id_key[ 'mesh' ] === null) {

					mesh_id_key[ 'mesh' ] = new InstancedMesh( geometry, material, mesh_id_key.instance_count );

				}

				mesh = mesh_id_key.mesh;

				let pos = new Vector3( vector.x, vector.y, vector.z );
				let rotq = new Quaternion( rotation.qx, rotation.qy, rotation.qz, rotation.qw );

				let matrix = new Matrix4().compose( pos, rotq, scale );

				mesh.setMatrixAt( mesh_id_key.current_instance, matrix );
				mesh.instanceMatrix.needsUpdate = true;

				mesh.setColorAt( mesh_id_key.current_instance, material.color );
				mesh.instanceColor.needsUpdate = true;

				if (name === '') name = 'mesh_' + mesh_id + '_' + mesh.id + '_' + mesh_id_key.current_instance;

				mesh.userData[ mesh_id_key.current_instance ] = { name: name, guid: guid, type: type, info: info || {} };

				mesh_id_key.current_instance++;

			}

			return mesh;

		}

		function dotbim_Meshes2Geometries( meshes ) {

			return meshes.map( mesh => dotbim_Mesh2GeometryColor( mesh ) );

		}

		function dotbim_Mesh2GeometryColor( mesh ) {

			const { mesh_id, coordinates, indices, colors } = mesh;

			let geometry = new BufferGeometry();

			geometry.setAttribute( 'position', new Float32BufferAttribute( coordinates, 3 ) );
			geometry.computeVertexNormals();

			if ( colors && colors.length > 0 ) {

				const buffer_colors = createFaceColors( colors, 3, 4 * geometry.attributes.position.count );
				geometry.setAttribute( 'color', new Float32BufferAttribute( buffer_colors, 4 ) );

			} else {

				if ( indices ) {

					geometry.setIndex( indices );

				} else {

					geometry = mergeVertices( geometry );

				}

			}

			geometry.userData[ 'mesh_id' ] = mesh_id;

			return geometry;

		}

		function createFaceColors( color4arrary, repeat = 3, max = 0 ) {

			let colors = [];

			for ( let index = 0, length = color4arrary.length; index < length; index += 4 ) {

				let c1 = color4arrary[ index + 0 ] / 255.0;
				let c2 = color4arrary[ index + 1 ] / 255.0;
				let c3 = color4arrary[ index + 2 ] / 255.0;
				let c4 = color4arrary[ index + 3 ] / 255.0;

				for ( let i = 0; i < repeat; i++ ) { colors.push( c1, c2, c3, c4 ); }

			}

			while ( colors.length < max ) {

				for ( let k = 0; k < repeat; k++ ) { colors.push( colors[ 0 ], colors[ 1 ], colors[ 2 ], colors[ 3 ] ); }

			}

			return colors;

		}

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

			for ( const element of elements ) {

				if ( ! mesh_id_keys[ element[ 'mesh_id' ] ]) mesh_id_keys[ element[ 'mesh_id' ] ] = { face_colors_group: {}, color_group: {} };

				if ( element[ 'face_colors' ] ) {

					let mesh_id_key = mesh_id_keys[ element[ 'mesh_id' ] ][ 'face_colors_group' ][ element[ 'face_colors' ] ];

					if ( ! mesh_id_key ) {

						mesh_id_keys[ element[ 'mesh_id' ] ][ 'face_colors_group' ][ element[ 'face_colors' ] ] = { instance_count: 1, current_instance: 0, mesh: null };

					} else {

						mesh_id_key.instance_count++;

					}

				} else { // expected existing element[ 'color' ]

					if ( ! element[ 'color' ] ) continue;

					let el_color = [ element[ 'color' ].r, element[ 'color' ].g, element[ 'color' ].b, element[ 'color' ].a ];
					let mesh_id_key = mesh_id_keys[ element[ 'mesh_id' ] ][ 'color_group' ][ el_color ];

					if ( ! mesh_id_key ) {

						mesh_id_keys[ element[ 'mesh_id' ] ][ 'color_group' ][ el_color ] = { instance_count: 1, current_instance: 0, mesh: null };

					} else {

						mesh_id_key.instance_count++;

					}

				}

			}

			const geometries = dotbim_Meshes2Geometries( meshes );

			dotbim_Elemments2Meshes( elements, geometries ).forEach( bim_mesh => {

				if ( bim_mesh ) bim_meshes.add( bim_mesh );

			});

			if ( bim_meshes.children.length === 0 ) {

				throw new Error( 'THREE.BIMLoader: No meshes found!' );

			}

			if ( bim_meshes.children.length > 1 ) bim_meshes.rotateX( - Math.PI / 2 );

			return bim_meshes;

		}

		return dotbim_CreateMeshes( text );

	}

}

export { BIMLoader };
