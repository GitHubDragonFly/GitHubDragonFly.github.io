import {
	DefaultLoadingManager,
	ClampToEdgeWrapping,
	LinearFilter,
	MirroredRepeatWrapping,
	NearestFilter
} from "three";

import {
	strToU8,
	zipSync,
} from "three/addons/libs/fflate.module.min.js";

import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.min.js";

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
 * Created with assistance from Microsoft Copilot
 *
 * 3D Manufacturing Format (3MF) specification: https://3mf.io/specification/
 *
 * The following features from the core specification should be working fine:
 *
 * - 3D Models
 * - Object Resources (Meshes)
 * - Material Resources (Base Materials)
 *
 * The following features are somewhat implemented and not fully functional:
 *
 * - Texture 2D
 * - Texture 2D Groups
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

		const scope = this;

		const { decompress, renderer } = await import_decompress();

		scope.decompress = decompress;
		scope.renderer = renderer;

		options = Object.assign( {
			upAxis: 'Y_UP',
			map_flip_required: false,
			maxTextureSize: Infinity,
		}, options );

		// Start the 3MF file content
		let xmlString = '<?xml version="1.0" encoding="UTF-8"?>\n';
		xmlString += '<model unit="millimeter" xml:lang="en-US" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n';
		xmlString += await this.createResourcesSection( scene );
		xmlString += await this.createBuildSection( scene );
		xmlString += '</model>\n';

		const files = {};

		// Generate the Relationships file
		const relsString = await this.createRelsFile();
		const relsStringTextures = await this.createTexturesRelsFile( scene );

		// Combine the XML and Relationships content into a single 3MF package
		files[ '[Content_Types].xml' ] = await strToU8( this.createContentTypesFile() );
		files[ '_rels/.rels' ] = await strToU8( relsString );

		if ( relsStringTextures !== null ) {

			files[ '3D/_rels/3dmodel.model.rels' ] = await strToU8( relsStringTextures );

			// Add textures to the zip files
			await this.addTexturesToZip( scene, files, options );

		}

		files[ '3D/3dmodel.model' ] = await strToU8( xmlString );

		return zipSync( files, { level: 8 } );

	}

	async createResourcesSection( scene ) {

		const scope = this;

		let resourcesString = ' <resources>\n';

		scene.traverse( ( object ) => {

			if ( object.isMesh ) {

				let geometry = object.geometry;
				let material = object.material;

				if ( ! geometry.index ) geometry = mergeVertices( geometry, 1e-6 );
				if ( ! geometry.attributes.normal ) geometry.computeVertexNormals();

				if ( material.map ) {

					if ( material.map.isCompressedTexture === true ) {

						material.map = scope.decompress( material.map, Infinity, scope.renderer );

					}

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

				}

				resourcesString += '  <basematerials id="' + material.id + '">\n';
				resourcesString += '   <base name="' + material.type + '" displaycolor="#' + material.color.getHexString().toUpperCase() + 'FF" />\n';
				resourcesString += '  </basematerials>\n';

				resourcesString += '  <object id="' + object.id + '" name="' + object.name + '" type="model">\n';
				resourcesString += '   <mesh>\n';
				resourcesString += this.generateVertices( geometry );
				resourcesString += this.generateTriangles( geometry, material.map ? object.id : null );
				resourcesString += '   </mesh>\n';
				resourcesString += '  </object>\n';

			}

		});

		resourcesString += ' </resources>\n';

		return resourcesString;

	}

	async createBuildSection( scene ) {

		let buildString = ' <build>\n';

		scene.traverse( ( object ) => {

			if ( object.isMesh ) {

				buildString += '  <item objectid="' + object.id + '" />\n';

			}

		});

		buildString += ' </build>\n';

		return buildString;

	}

	async createRelsFile() {

		let relsString = '<?xml version="1.0" encoding="UTF-8"?>\n';
		relsString += '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n';
		relsString += ' <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />\n';
		relsString += '</Relationships>\n';

		return relsString;

	}

	async createTexturesRelsFile( scene ) {

		let map_found = false;
		let relsStringTextures = '<?xml version="1.0" encoding="UTF-8"?>\n';
		relsStringTextures += '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n';

		const image_names = {};

		scene.traverse( ( object ) => {

			if ( object.isMesh && object.material.map ) {

				map_found = true;
				let name = object.material.map.name ? object.material.map.name : 'texture_' + object.material.map.uuid;
				if ( name.indexOf( '.' ) === -1 ) name += '.png';

				if ( ! image_names[ name ] ) {

					image_names[ name ] = name;

					relsStringTextures += ' <Relationship Target="/3D/Textures/' + name + '" Id="rel' + object.material.map.id + '" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dtexture" />\n';

				}

			}

		});

		relsStringTextures += '</Relationships>\n';

		return map_found === true ? relsStringTextures : null;

	}

	createContentTypesFile() {

		let contentTypesString = '<?xml version="1.0" encoding="UTF-8"?>\n';
		contentTypesString += '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n';
		contentTypesString += ' <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />\n';
		contentTypesString += ' <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />\n';
		contentTypesString += ' <Default Extension="png" ContentType="image/png" />\n';
		contentTypesString += '</Types>\n';

		return contentTypesString;

	}

	generateVertices( geometry ) {

		const vertices = geometry.attributes.position.array;

		let verticesString = '    <vertices>\n';

		for ( let i = 0; i < vertices.length; i += 3 ) {

			let v1 = vertices[ i ];
			let v2 = vertices[ i + 1 ];
			let v3 = vertices[ i + 2 ];

			verticesString += '     <vertex x="' + v1 + '" y="' + v2 + '" z="' + v3 + '" />\n';

		}

		verticesString += '    </vertices>\n';

		return verticesString;

	}

	generateTriangles( geometry, pid ) {

		const indices = geometry.index.array;

		let trianglesString = '    <triangles>\n';

		for ( let i = 0; i < indices.length; i += 3 ) {

			let v1 = indices[ i ];
			let v2 = indices[ i + 1 ];
			let v3 = indices[ i + 2 ];

			if ( pid ) {

				trianglesString += '     <triangle v1="' + v1 + '" v2="' + v2 + '" v3="' + v3 + '" pid="' + pid + '" p1="' + i + '" p2="' + ( i + 1 ) + '" p3="' + ( i + 2 ) + '" />\n';

			} else {

				trianglesString += '     <triangle v1="' + v1 + '" v2="' + v2 + '" v3="' + v3 + '" />\n';

			}

		}

		trianglesString += '    </triangles>\n';

		return trianglesString;

	}

	generateUVs( geometry, id, texid ) {

		const uvs = geometry.attributes.uv.array;

		let uvsString = '  <m:texture2dgroup id="' + id + '" texid="' + texid + '">\n';

		for ( let i = 0; i < uvs.length; i += 2 ) {

			const uvu = uvs[ i ] || 0;
			const uvv = uvs[ i +  1 ] || 0;

			uvsString += '   <m:tex2coord u="' + uvu + '" v="' + uvv + '" />\n';

		}

		uvsString += '  </m:texture2dgroup>\n';

		return uvsString;

	}

	async addTexturesToZip( scene, files, options ) {

		const image_names = {};
		const textures = [];

		scene.traverse( ( object ) => {

			if ( object.isMesh && object.material.map ) {

				let texture = object.material.map;

				let name = texture.name ? texture.name : 'texture_' + texture.uuid;
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

}

export { ThreeMFExporter };
