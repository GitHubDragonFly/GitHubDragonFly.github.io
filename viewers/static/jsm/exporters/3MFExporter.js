import {
	DefaultLoadingManager
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
		xmlString += '<model unit="millimeter" xml:lang="en-US" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n';
		xmlString += await this.createResourcesSection( scene );
		xmlString += await this.createBuildSection( scene );
		xmlString += '</model>\n';

		// Generate the Relationships file
		let relsString = await this.createRelsFile();
		let relsStringTextures = await this.createTexturesRelsFile( scene );

		// Combine the XML and Relationships content into a single 3MF package
		const files = relsStringTextures !== null ?
		{
			'[Content_Types].xml': strToU8( this.createContentTypesFile() ),
			'_rels/.rels': strToU8( relsString ),
			'3D/3dmodel.model': strToU8( xmlString ),
			'3D/_rels/3dmodel.model.rels': strToU8( relsStringTextures )
		} :
		{
			'[Content_Types].xml': strToU8( this.createContentTypesFile() ),
			'_rels/.rels': strToU8( relsString ),
			'3D/3dmodel.model': strToU8( xmlString )
		};

		// Add textures to the zip files
		await this.addTexturesToZip( scene, files, options );

		return zipSync( files, { level: 0 } );

	}

	async createResourcesSection( scene ) {

		const scope = this;

		let resourcesString = ' <resources>\n';

		scene.traverse( ( object ) => {

			if ( object.isMesh ) {

				let geometry = object.geometry;
				let material = object.material;

				if ( ! geometry.index ) geometry = mergeVertices( geometry, 1e-6 );

				if ( material.map ) {

					if ( material.map.isCompressedTexture === true ) {

						material.map = scope.decompress( material.map, Infinity, scope.renderer );

					}

					let name = material.map.name ? material.map.name : 'texture_' + material.map.uuid;
					if ( name.indexOf( '.' ) === -1 ) name += '.png';

					resourcesString += '  <m:texture2d id="' + material.map.id + '" path="3D/Textures/' + name + '" contenttype="image/png" />\n';

					if ( geometry.hasAttribute( 'uv' ) ) {

						resourcesString += this.generateUVs( geometry, material.map.id + 1, material.map.id );

					}

				}

				resourcesString += '  <basematerials id="' + material.id + '">\n';
				resourcesString += '   <base name="' + material.type + '" displaycolor="#' + material.color.getHexString().toUpperCase() + 'FF" />\n';
				resourcesString += '  </basematerials>\n';
				resourcesString += '  <object id="' + object.id + '" name="' + object.name + '" type="model">\n';
				resourcesString += '   <mesh>\n';
				resourcesString += this.generateVertices( geometry );
				resourcesString += this.generateTriangles( geometry );
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

			if (object.isMesh) {

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

		scene.traverse( ( object ) => {

			if ( object.isMesh && object.material.map ) {

				map_found = true;
				let name = object.material.map.name ? object.material.map.name : 'texture_' + object.material.map.uuid;
				if ( name.indexOf( '.' ) === -1 ) name += '.png';

				relsStringTextures += ' <Relationship Target="/3D/Textures/' + name + '" Id="rel' + object.material.map.id + '" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dtexture" />\n';

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

			verticesString += '     <vertex x="' + vertices[ i ] + '" y="' + vertices[ i + 1 ] + '" z="' + vertices[ i + 2 ] + '" />\n';

		}

		verticesString += '    </vertices>\n';

		return verticesString;

	}

	generateUVs( geometry, id, texid ) {

		const uvs = geometry.attributes.uv.array;
		let uvsString = '  <m:texture2dgroup id="' + id + '" texid="' + texid + '">\n';

		for ( let i = 0; i < uvs.length; i += 2 ) {

			uvsString += '   <m:tex2coord u="' + uvs[ i ] + '" v="' + uvs[ i + 1 ] + '" />\n';

		}

		uvsString += '  </m:texture2dgroup>\n';

		return uvsString;

	}

	generateTriangles( geometry ) {

		const indices = geometry.index.array;
		let trianglesString = '    <triangles>\n';

		for ( let i = 0; i < indices.length; i += 3 ) {

			trianglesString += '     <triangle v1="' + indices[ i ] + '" v2="' + indices[ i + 1 ] + '" v3="' + indices[ i + 2 ] + '" />\n';

		}

		trianglesString += '    </triangles>\n';

		return trianglesString;

	}

	async addTexturesToZip( scene, files, options ) {

		scene.traverse( ( object ) => {

			if ( object.isMesh && object.material.map ) {

				let texture = object.material.map;

				let name = texture.name ? texture.name : 'texture_' + texture.uuid;
				if ( name.indexOf( '.' ) === -1 ) name += '.png';

				const canvas = this.imageToCanvas( texture.image, options.map_flip_required, options.maxTextureSize );

				files[ '3D/Textures/' + name ] = strToU8( atob( canvas.toDataURL( 'image/png' ).split( ',' )[ 1 ] ) );

			}

		});

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

				canvas = canvas || document.createElement( 'canvas' );

				let scale = maxTextureSize / Math.max( image.width, image.height );

				canvas.width = image.width * Math.min( 1, scale );
				canvas.height = image.height * Math.min( 1, scale );

				ctx = ctx || canvas.getContext( '2d' );

				if ( flipY === true ) {

					// Flip image vertically

					ctx.translate( 0, canvas.height );
					ctx.scale( 1, - 1 );

				}

				// this seems to also work fine for exporting TGA images as PNG

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
