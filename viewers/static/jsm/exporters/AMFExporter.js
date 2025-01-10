import {
	BufferAttribute,
	DefaultLoadingManager,
	InterleavedBufferAttribute,
	Matrix4,
	Quaternion,
	Vector3
} from "three";

import {
	strToU8,
	zipSync,
} from "three/addons/libs/fflate.module.min.js";

import { deinterleaveAttribute, mergeVertices } from "three/addons/utils/BufferGeometryUtils.min.js";

/**
 *
 * Created with assistance from Microsoft Copilot
 *
 * Custom Additive Manufacturing Format (AMF) Exporter
 *
 *
 * Meshes, materials and material colors supported
 * Exported as fflate zipped file
 * 
 */

class AMFExporter {

	constructor( manager ) {

		this.manager = manager || DefaultLoadingManager;

	}

	parse( scene, onDone, onError, options = {} ) {

		this.parseAsync( scene, options ).then( onDone ).catch( onError );

	}

	async parseAsync( scene, options = {} ) {

		scene.updateMatrixWorld( true, true );

		options = Object.assign( {
			filename: 'Model'
		}, options );

		// Start the AMF file content

		let date = new Date();
		let date_str = date.toString().split( ' ' )[ 0 ] + " " + date.toLocaleDateString();

		let xmlString = '<?xml version="1.0" encoding="UTF-8"?>\n';
		xmlString += '<amf unit="millimeter" version="1.1">\n';
		xmlString += ' <metadata type="name">' + options.filename + '</metadata>\n';
		xmlString += ' <metadata type="application">Custom AMF Exporter</metadata>\n';
		xmlString += ' <metadata type="author">GitHubDragonFly</metadata>\n';
		xmlString += ' <metadata type="date">' + date_str + '</metadata>\n';
		xmlString += await this.createResourcesString( scene );
		xmlString += '</amf>\n';

		const files = {};

		// Add the XML into a zipped AMF package

		let name = options.filename + '.amf';

		files[ name ] = await strToU8( xmlString );

		return zipSync( files, { level: 8 } );

	}

	async createResourcesString( scene ) {

		let materialsString = '';
		let resourcesString = ' <object id="0">\n';

		scene.traverse( ( object ) => {

			if ( object.isMesh === true ) {

				resourcesString += '  <mesh>\n';

				let geometry = this.interleaved_buffer_attribute_check( object.geometry.clone() );
				let material = object.material;

				const matrix = new Matrix4();
				matrix.copy( object.matrixWorld );

				// Decompose the matrix into position, quaternion, and scale
				const pos = new Vector3();
				const quat = new Quaternion();
				const scale = new Vector3();

				matrix.decompose( pos, quat, scale );

				// Create the transformation string
				const transform = new Matrix4().compose( pos, quat, scale );

				geometry.applyMatrix4( transform );

				if ( ! geometry.index ) geometry = mergeVertices( geometry, 1e-6 );
				if ( ! geometry.attributes.normal ) geometry.computeVertexNormals();
				geometry.normalizeNormals();

				if ( Array.isArray( material ) && geometry.groups.length === material.length ) {

					material.forEach( ( mtl, index ) => {

						resourcesString += this.generateVertices( geometry, index );
						resourcesString += this.generateTriangles( geometry, mtl, index );

						let r = '' + mtl.color.r;
						let g = '' + mtl.color.g;
						let b = '' + mtl.color.b;
						let a = '' + mtl.opacity;

						materialsString += ` <material id="${ mtl.id }"><color><r>${ r }</r><g>${ g }</g><b>${ b }</b><a>${ a }</a></color></material>\n`;

					});

				} else {

					resourcesString += this.generateVertices( geometry );
					resourcesString += this.generateTriangles( geometry, material );

					let r = '' + material.color.r;
					let g = '' + material.color.g;
					let b = '' + material.color.b;
					let a = '' + material.opacity;

					materialsString += ` <material id="${ material.id }"><color><r>${ r }</r><g>${ g }</g><b>${ b }</b><a>${ a }</a></color></material>\n`;

				}

				resourcesString += '  </mesh>\n';

			}

		});

		resourcesString += ' </object>\n';

		resourcesString += materialsString;

		return resourcesString;

	}

	generateVertices( geometry, index = null ) {

		const indices = geometry.index.array;
		const vertices = geometry.attributes.position.array;

		let verticesString = '   <vertices>\n';

		let start = ( index && geometry.groups[ index ] ) ? geometry.groups[ index ].start : 0;
		let end = ( index && geometry.groups[ index ] ) ? ( geometry.groups[ index ].start + ( geometry.groups[ index ].count ) ) : vertices.length;
		if ( end === Infinity ) end = indices.length;

		if ( index && geometry.groups[ index ] ) {

			for ( let i = start; i < end; i ++ ) {

				let v1 = vertices[ indices[ i ] * 3 ];
				let v2 = vertices[ indices[ i ] * 3 + 1 ];
				let v3 = vertices[ indices[ i ] * 3 + 2 ];

				verticesString += `    <vertex><coordinates><x>${ v1 }</x><y>${ v2 }</y><z>${ v3 }</z></coordinates></vertex>\n`;

			}

		} else {

			for ( let i = start; i < end; i += 3 ) {

				let v1 = vertices[ i ];
				let v2 = vertices[ i + 1 ];
				let v3 = vertices[ i + 2 ];

				verticesString += `    <vertex><coordinates><x>${ v1 }</x><y>${ v2 }</y><z>${ v3 }</z></coordinates></vertex>\n`;

			}

		}

		verticesString += '   </vertices>\n';

		return verticesString;

	}

	generateTriangles( geometry, material, index = null ) {

		const indices = geometry.index.array;

		let trianglesString = '   <volume materialid="' + material.id + '">\n';

		let start = ( index && geometry.groups[ index ] ) ? geometry.groups[ index ].start : 0;
		let end = ( index && geometry.groups[ index ] ) ? geometry.groups[ index ].start + geometry.groups[ index ].count : indices.length;
		if ( end === Infinity ) end = indices.length;

		for ( let i = start; i < end; i += 3 ) {

			let v1 = ( index && geometry.groups[ index ] ) ? i : indices[ i ];
			let v2 = ( index && geometry.groups[ index ] ) ? i + 1 : indices[ i + 1 ];
			let v3 = ( index && geometry.groups[ index ] ) ? i + 2 : indices[ i + 2 ];

			trianglesString += `    <triangle><v1>${ v1 }</v1><v2>${ v2 }</v2><v3>${ v3 }</v3></triangle>\n`;

		}

		trianglesString += '   </volume>\n';

		return trianglesString;

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

export { AMFExporter };
