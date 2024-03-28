import {
	BufferAttribute,
	DefaultLoadingManager,
	InterleavedBufferAttribute,
	Matrix4,
	Quaternion,
	Vector3
} from "three";

import { deinterleaveAttribute, mergeVertices } from "https://cdn.jsdelivr.net/npm/three@0.162.0/examples/jsm/utils/BufferGeometryUtils.js";

/** Simple BIM (dotbim) Exporter
*
*	Dotbim library: https://github.com/paireks/dotbim
*
*	Intended for exporting textureless meshes that will be structured as:
*
*		dotbim = { schema_version, meshes, elements, info }
*		mesh = { mesh_id, coordinates, indices, colors }
*		element = { mesh_id, vector, rotation, guid, type, color, face_colors, info }
*
*	Usage:
*
*		const { BIMExporter } = await import( "path-to-exporter/BIMExporter.js" );
*		const exporter = new BIMExporter( manager );
*
*		await exporter.parse( scene, function( dotbim ) {
*			let file = new File( [ dotbim ], 'model.bim' );
*
*			let link = document.createElement( 'a' );
*			link.style.display = 'none';
*			document.body.appendChild( link );
*			link.href = URL.createObjectURL( file );
*			URL.revokeObjectURL( file );
*			link.download = file.name;
*			link.click();
*			document.body.removeChild( link );
*		});
*
*	Optional full format: exporter.parse( scene, onDone, onError, options );
*
*		options = { skipMatrixCheck: true };
*
*			skipMatrixCheck [ default = false ] - mainly intended for BIM to BIM re-export
*
*/

class BIMExporter {

	constructor( manager ) {

		this.manager = manager || DefaultLoadingManager;

	}

	async parse( scene, onDone, onError, options = {} ) {

		const scope = this;

		const defaultOptions = {
			skipMatrixCheck: false
		};

		options = Object.assign( defaultOptions, options );

		const skipMatrixCheck = options.skipMatrixCheck;

		const dotbim = { schema_version: `1.1.0`, meshes: [], elements: [], info: { Author: `User`, Date: new Date() } };

		let id = 0, mesh_matrix4;

		scene.traverse( ( child ) => {

			function cumulative_matrix_check( parent, mesh_in_mesh = false ) {

				if ( parent && ( parent.type === 'Group' || parent.type === 'Object3D' || mesh_in_mesh === true ) ) {

					mesh_matrix4 = mesh_matrix4.premultiply( parent.matrix );

					cumulative_matrix_check( parent.parent, ( parent.isMesh && parent.parent && parent.parent.isMesh ) );

				}	

			}

			if ( child.isMesh ) {

				const uuid = child.userData.guid ? child.userData.guid : child.uuid;

				let child_geometry_clone = scope.interleaved_buffer_attribute_check( child.geometry.clone() );

				if ( skipMatrixCheck === false ) {

					mesh_matrix4 = new Matrix4().copy( child.matrix );

					cumulative_matrix_check( child.parent, ( child.isMesh && child.parent && child.parent.isMesh ) );

					child_geometry_clone = child_geometry_clone.applyMatrix4( mesh_matrix4 );

				}

				let position = new Vector3();
				let rotation = new Quaternion();
				let scale = new Vector3();

				child.matrix.decompose( position, rotation, scale );

				const element_position = { x: position.x, y: position.y, z: position.z };
				const element_rotation = { qx: rotation.x, qy: rotation.y, qz: rotation.z, qw: rotation.w };

				const element_name = child.userData.name ? child.userData.name : ( child.name ? child.name : 'element_' + id );
				const element_info = child.userData.info ? child.userData.info : { Name: element_name };
				const element_type = child.userData.type ? child.userData.type : `Other`;

				let element_color;

				// Pack as integer for export

				const face_colors = [];

				if ( child_geometry_clone.attributes.color ) {

					const arr = child_geometry_clone.attributes.color.array;

					if ( child_geometry_clone.attributes.color.itemSize === 3 ) {

						// Convert to RGBA

						const a = ( child.material && child.material.opacity ) ? child.material.opacity : 1;

						for ( let i = 0; i < arr.length; i += 9 ) {

							face_colors.push( Math.round( arr[ i + 0 ] * 255.0 ) );
							face_colors.push( Math.round( arr[ i + 1 ] * 255.0 ) );
							face_colors.push( Math.round( arr[ i + 2 ] * 255.0 ) );
							face_colors.push( Math.round( a * 255.0 ) );

						}

					} else {

						for ( let i = 0; i < arr.length; i += 12 ) {

							face_colors.push( Math.round( arr[ i + 0 ] * 255.0 ) );
							face_colors.push( Math.round( arr[ i + 1 ] * 255.0 ) );
							face_colors.push( Math.round( arr[ i + 2 ] * 255.0 ) );
							face_colors.push( Math.round( arr[ i + 3 ] * 255.0 ) );

						}

					}

				}

				if ( child_geometry_clone.groups && child_geometry_clone.groups.length > 1 ) {

					element_color = { r: 255, g: 255, b: 255, a: 255 };

					for ( const group of child_geometry_clone.groups ) {

						// Convert to vertex colors

						let mtl_color, mtl_opacity;

						if ( Array.isArray( child.material ) && child.material[ group.materialIndex ] ) {

							mtl_color = child.material[ group.materialIndex ].color.clone().convertLinearToSRGB();
							mtl_opacity = child.material[ group.materialIndex ].opacity;

						} else {

							mtl_color = child.material.color.clone().convertLinearToSRGB();
							mtl_opacity = child.material.opacity;

						}

						for ( let i = group.start; i < ( group.start + group.count ); i += 3 ) {

							face_colors.push( Math.round( mtl_color.r * 255.0 ) );
							face_colors.push( Math.round( mtl_color.g * 255.0 ) );
							face_colors.push( Math.round( mtl_color.b * 255.0 ) );
							face_colors.push( Math.round( mtl_opacity * 255.0 ) );

						}

					}

				} else {

					if ( ! child_geometry_clone.index ) {

						child_geometry_clone = mergeVertices( child_geometry_clone.clone() );

					}

					if ( ( child.material && child.material.color ) || ( Array.isArray( child.material ) && child.material.length === 1 ) ) {

						let mtl_color, mtl_opacity;

						if ( Array.isArray( child.material ) === true ) {

							mtl_color = child.material[ 0 ].color.clone().convertLinearToSRGB();
							mtl_opacity = child.material[ 0 ].opacity;

						} else {

							mtl_color = child.material.color.clone().convertLinearToSRGB();
							mtl_opacity = child.material.opacity;

						}

						element_color = {
							r: Math.round( mtl_color.r * 255.0 ),
							g: Math.round( mtl_color.g * 255.0 ),
							b: Math.round( mtl_color.b * 255.0 ),
							a: Math.round( mtl_opacity * 255.0 )
						};

					} else {

						element_color = { r: 255, g: 255, b: 255, a: 255 };

					}

				}

				const index = child_geometry_clone.index ? [ ''.concat( child_geometry_clone.index.array ) ] : undefined;
				const coords = [ ''.concat( child_geometry_clone.attributes.position.array ) ];
				const colors = face_colors.length > 0 ? [ ''.concat( face_colors ) ] : undefined;

				dotbim.meshes.push( {
					mesh_id: id,
					coordinates: coords,
					indices: index
				} );

				dotbim.elements.push( {
					mesh_id: id,
					vector: element_position,
					rotation: element_rotation,
					guid: uuid,
					type: element_type,
					color: element_color,
					face_colors: colors,
					info: element_info
				} );

				child_geometry_clone.dispose();

				id ++;

			}

		});

		if ( id === 0 ) {

			if ( typeof onError === 'function' ) {

				onError( 'THREE.BIMExporter: No meshes found!' );
				return null;

			} else {

				throw new Error( 'THREE.BIMExporter: No meshes found!' );

			}

		} else {

			let dotbim_file = JSON.stringify( dotbim );

			dotbim_file = dotbim_file.replaceAll( '["', '[' ).replaceAll( '"]', ']' );
			dotbim_file = dotbim_file.replaceAll( '"{', '{' ).replaceAll( '}"', '}' );
			dotbim_file = dotbim_file.replaceAll( '"undefined"', 'undefined' );

			if ( typeof onDone === 'function' ) {

				onDone( dotbim_file );

			} else {

				return dotbim_file;

			}

		}

	}

	deinterleave( geometry, attribute = 'color' ) {

		const attr = geometry.attributes[ attribute ];
		const itemSize = attr.itemSize;
		const offset = attr.offset;

		const data = attr.data;

		if ( data === undefined ) return [];

		let iBA = new InterleavedBufferAttribute( data, itemSize, offset );

		let attr_items = deinterleaveAttribute( iBA );

		let temp_array = Array( attr_items.array.length );

		for ( let i = 0, l = attr_items.array.length; i < l; i ++ ) {

			temp_array[ i ] = isNaN( attr_items.array[ i ] ) ? 0 : attr_items.array[ i ]; // avoid NaN values

		}

		return new BufferAttribute( new Float32Array( temp_array ), itemSize );

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
					geo.setAttribute( attribute, new BufferAttribute( new Float32Array( temp_array ), itemSize ) );

				}

			}

		}

		return geo;

	}

}

export { BIMExporter };
