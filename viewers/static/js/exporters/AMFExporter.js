( function () {

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

			this.manager = manager || THREE.DefaultLoadingManager;

			if ( typeof fflate === 'undefined' ) {

				throw Error( 'THREE.AMFExporter: External library fflate required.' );

			}

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

			files[ name ] = await fflate.strToU8( xmlString );

			return fflate.zipSync( files, { level: 8 } );

		}

		async createResourcesString( scene ) {

			let materialsString = '';
			let resourcesString = ' <object id="0">\n';

			scene.traverse( ( object ) => {

				if ( object.isMesh === true ) {

					resourcesString += '  <mesh>\n';

					let geometry = this.interleaved_buffer_attribute_check( object.geometry.clone() );
					let material = object.material;

					if ( geometry.matrixAutoUpdate ) geometry.updateMatrix();
					if ( geometry.matrix === undefined ) geometry.matrix = new THREE.Matrix4();

					const matrix = new THREE.Matrix4();
					matrix.copy( object.matrixWorld );

					// Decompose the matrix into position, quaternion, and scale
					const pos = new THREE.Vector3();
					const quat = new THREE.Quaternion();
					const scale = new THREE.Vector3();

					matrix.decompose( pos, quat, scale );

					// Create the transformation string
					const transform = new THREE.Matrix4().compose( pos, quat, scale );

					geometry.matrix.premultiply( transform );

					if ( geometry.position === undefined ) geometry.position = new THREE.Vector3();
					if ( geometry.quaternion === undefined ) geometry.quaternion = new THREE.Quaternion();
					if ( geometry.scale === undefined ) geometry.scale = new THREE.Vector3();

					geometry.matrix.decompose( geometry.position, geometry.quaternion, geometry.scale );

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
			let end = ( index && geometry.groups[ index ] ) ? ( geometry.groups[ index ].start + geometry.groups[ index ].count ) : vertices.length;

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

			let start = 0;
			let end = ( index && geometry.groups[ index ] ) ? geometry.groups[ index ].count : indices.length;

			for ( let i = start; i < end; i += 3 ) {

				let v1 = ( index && geometry.groups[ index ] ) ? i : indices[ i ];
				let v2 = ( index && geometry.groups[ index ] ) ? i + 1 : indices[ i + 1 ];
				let v3 = ( index && geometry.groups[ index ] ) ? i + 2 : indices[ i + 2 ];

				trianglesString += `    <triangle><v1>${ v1 }</v1><v2>${ v2 }</v2><v3>${ v3 }</v3></triangle>\n`;

			}

			trianglesString += '   </volume>\n';

			return trianglesString;

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

	THREE.AMFExporter = AMFExporter;

} )();
