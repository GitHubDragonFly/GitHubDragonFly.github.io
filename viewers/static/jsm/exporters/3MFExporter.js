import {
	BufferAttribute,
	ClampToEdgeWrapping,
	Color,
	DefaultLoadingManager,
	InterleavedBufferAttribute,
	LinearFilter,
	Matrix4,
	MirroredRepeatWrapping,
	NearestFilter,
	Quaternion,
	Vector3
} from "three";

import {
	strToU8,
	zipSync,
} from "three/addons/libs/fflate.module.min.js";

import { deinterleaveAttribute, mergeVertices } from "three/addons/utils/BufferGeometryUtils.min.js";

async function import_decompress() {

	try {

		const { WebGLRenderer } = await import( "three" );
		const { decompress } = await import(
			"https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/utils/TextureUtils.min.js"
		);

		const renderer = new WebGLRenderer( { antialias: true } );

		return { decompress, renderer };

	} catch ( error ) { /* just continue */ }

	try {

		const { CanvasTexture, NodeMaterial, QuadMesh, WebGPURenderer } = await import( "three" );
		const { texture, uv } = await import( "three/tsl" );

		const renderer = new WebGPURenderer( { antialias: true } );
		await renderer.init();

		/* Modified decompress function from TextureUtilsGPU.js file (non-async) */

		const _quadMesh = /*@__PURE__*/ new QuadMesh();

		function decompress( blitTexture, maxTextureSize = Infinity, renderer = null ) {

			const blitTexture_clone = blitTexture.clone();

			blitTexture_clone.offset.set( 0, 0 );
			blitTexture_clone.repeat.set( 1, 1 );

			const material = new NodeMaterial();
			material.fragmentNode = texture( blitTexture_clone, uv().flipY() );

			const width = Math.min( blitTexture_clone.image.width, maxTextureSize );
			const height = Math.min( blitTexture_clone.image.height, maxTextureSize );

			renderer.setSize( width, height );
			renderer.outputColorSpace = blitTexture_clone.colorSpace;

			_quadMesh.material = material;
			_quadMesh.render( renderer );

			const canvas = document.createElement( 'canvas' );
			const context = canvas.getContext( '2d' );

			canvas.width = width;
			canvas.height = height;

			context.drawImage( renderer.domElement, 0, 0, width, height );

			const readableTexture = new CanvasTexture( canvas );

			/* set to the original texture parameters */

			readableTexture.offset.set( blitTexture.offset.x, blitTexture.offset.y );
			readableTexture.repeat.set( blitTexture.repeat.x, blitTexture.repeat.y );
			readableTexture.colorSpace = blitTexture.colorSpace;
			readableTexture.minFilter = blitTexture.minFilter;
			readableTexture.magFilter = blitTexture.magFilter;
			readableTexture.wrapS = blitTexture.wrapS;
			readableTexture.wrapT = blitTexture.wrapT;
			readableTexture.name = blitTexture.name;

			blitTexture_clone.dispose();

			return readableTexture;

		}

		return { decompress, renderer };

	} catch ( error ) {

		/* should not really get here */
		throw new Error( 'THREE.3MFExporter: Could not import decompress function!' );

	}

}

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

		this.manager = manager || DefaultLoadingManager;

		this.decompress = null;
		this.renderer = null;

	}

	parse( scene, onDone, onError, options = {} ) {

		this.parseAsync( scene, options ).then( onDone ).catch( onError );

	}

	async parseAsync( scene, options = {} ) {

		scene.updateMatrixWorld( true, true );

		const { decompress, renderer } = await import_decompress();

		this.decompress = decompress;
		this.renderer = renderer;

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

		files[ '[Content_Types].xml' ] = await strToU8( this.createContentTypesFile( options ) );
		files[ '_rels/.rels' ] = await strToU8( relsString );

		if ( relsStringTextures !== null ) {

			files[ '3D/_rels/3dmodel.model.rels' ] = await strToU8( relsStringTextures );

			// Add textures to the zip files
			await this.addTexturesToZip( scene, files, options );

		}

		files[ '3D/3dmodel.model' ] = await strToU8( xmlString );

		return zipSync( files, { level: 8 } );

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

				if ( ! geometry.index ) geometry = mergeVertices( geometry, 1e-6 );
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

						if ( mtl.opacity < 1 ) {

							let hex_opacity = ( parseInt( mtl.opacity * 255 ) ).toString( 16 ).toUpperCase().padStart( 2, '0' );
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

							let styleu = mtl.map.wrapS === MirroredRepeatWrapping ? 'mirror' :
								( mtl.map.wrapS === ClampToEdgeWrapping ? 'clamp' :'wrap' );

							let stylev = mtl.map.wrapT === MirroredRepeatWrapping ? 'mirror' :
								( mtl.map.wrapT === ClampToEdgeWrapping ? 'clamp' : 'wrap' );

							let filter = ( mtl.map.magFilter === NearestFilter && mtl.map.minFilter === NearestFilter ) ? 'nearest' :
								( ( mtl.map.magFilter === LinearFilter && mtl.map.minFilter === LinearFilter ) ? 'linear' : 'auto' );

							resourcesString += '  <m:texture2d id="' + mtl.map.id + '" path="/3D/Textures/' + name + '" contenttype="image/png" tilestyleu="' + styleu + '" tilestylev="' + stylev + '" filter="' + filter + '" />\n';

							if ( geometry.hasAttribute( 'uv' ) ) {

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

						let styleu = material.map.wrapS === MirroredRepeatWrapping ? 'mirror' :
						( material.map.wrapS === ClampToEdgeWrapping ? 'clamp' :'wrap' );

						let stylev = material.map.wrapT === MirroredRepeatWrapping ? 'mirror' :
						( material.map.wrapT === ClampToEdgeWrapping ? 'clamp' : 'wrap' );

						let filter = ( material.map.magFilter === NearestFilter && material.map.minFilter === NearestFilter ) ? 'nearest' :
						( ( material.map.magFilter === LinearFilter && material.map.minFilter === LinearFilter ) ? 'linear' : 'auto' );

						resourcesString += '  <m:texture2d id="' + material.map.id + '" path="/3D/Textures/' + name + '" contenttype="image/png" tilestyleu="' + styleu + '" tilestylev="' + stylev + '" filter="' + filter + '" />\n';

						if ( geometry.hasAttribute( 'uv' ) ) {

							resourcesString += this.generateUVs( geometry, object.id, material.map.id );

						}

					} else { // Material only

						let hex_uc = '#' + material.color.getHexString().toUpperCase();

						if ( material.opacity < 1 ) {

							let hex_opacity = ( parseInt( material.opacity * 255 ) ).toString( 16 ).toUpperCase().padStart( 2, '0' );
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

				const matrix = new Matrix4();
				matrix.copy( object.matrixWorld );

				// Decompose the matrix into position, quaternion, and scale
				const pos = new Vector3();
				const quat = new Quaternion();
				const scale = new Vector3();

				matrix.decompose( pos, quat, scale );

				// Create the transformation string
				const transform = new Matrix4().compose( pos, quat, scale );
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

			let str = ( new Color().fromBufferAttribute( colors, i ) ).getHexString().toUpperCase() + 'FF';

			colorsString += '   <m:color color="#' + str + '" />\n';

		}

		return colorsString;

	}

	generateVertices( geometry, index = null ) {

		const indices = geometry.index.array;
		const vertices = geometry.attributes.position.array;

		let verticesString = '    <vertices>\n';

		let start = ( index !== null && geometry.groups[ index ] !== undefined ) ? geometry.groups[ index ].start : 0;
		let end = ( index !== null && geometry.groups[ index ] !== undefined ) ? geometry.groups[ index ].start + geometry.groups[ index ].count : vertices.length;
		if ( end === Infinity ) end = indices.length;

		if ( index !== null && geometry.groups[ index ] !== undefined ) {

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

		let start = 0;
		let end = ( index !== null && geometry.groups[ index ] !== undefined ) ? geometry.groups[ index ].count : indices.length;
		if ( end === Infinity ) end = index !== null ? indices.length - geometry.groups[ index ].start : indices.length;

		for ( let i = start; i < end; i += 3 ) {

			let v1 = ( index !== null && geometry.groups[ index ] !== undefined ) ? i : indices[ i ];
			let v2 = ( index !== null && geometry.groups[ index ] !== undefined ) ? i + 1 : indices[ i + 1 ];
			let v3 = ( index !== null && geometry.groups[ index ] !== undefined ) ? i + 2 : indices[ i + 2 ];

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

		let start = ( index !== null && geometry.groups[ index ] !== undefined ) ? geometry.groups[ index ].start : 0;
		let end = ( index !== null && geometry.groups[ index ] !== undefined ) ? ( geometry.groups[ index ].start + geometry.groups[ index ].count ) : uvs.length;

		if ( index !== null && geometry.groups[ index ] !== undefined ) {

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

								texture = this.decompress( mtl.map.clone(), Infinity, this.renderer );

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

							texture = this.decompress( object.material.map.clone(), Infinity, this.renderer );

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

export { ThreeMFExporter };
