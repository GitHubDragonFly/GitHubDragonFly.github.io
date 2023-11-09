import * as THREE from 'three';
import * as fflate from '../libs/fflate.module.js';

class USDZExporter {

	async parse( scene, options = {} ) {

		options = Object.assign( {
			ar: {
				anchoring: { type: 'plane' },
				planeAnchoring: { alignment: 'horizontal' }
			},
			quickLookCompatible: false,
		}, options );

		const files = {};
		const modelFileName = 'model.usda'; // model file should be first in USDZ archive so we init it here

		files[ modelFileName ] = null;
		let output = buildHeader();
		const materials = {};
		const textures = {};

		scene.traverseVisible( object => {

			if ( object.isMesh ) {

				if ( object.material.isMeshStandardMaterial ) {

					const geometry = object.geometry;
					const material = object.material;
					const geometryFileName = 'geometries/Geometry_' + geometry.id + '.usd';

					if ( ! ( geometryFileName in files ) ) {

						const meshObject = buildMeshObject( geometry );
						files[ geometryFileName ] = buildUSDFileAsString( meshObject );

					}

					if ( ! ( material.uuid in materials ) ) {

						materials[ material.uuid ] = material;

					}

					output += buildXform( object, geometry, material );

				} else {

					console.warn( 'THREE.USDZExporter: Unsupported material type (USDZ only supports MeshStandardMaterial)', object );

				}

			}

		} );

		output += buildMaterials( materials, textures, options.quickLookCompatible );
		files[ modelFileName ] = fflate.strToU8( output );
		output = null;

		for ( const id in textures ) {

			const texture = textures[ id ];
			const color = id.split( '_' )[ 1 ];
			const isRGBA = texture.format === 1023;
			const canvas = imageToCanvas( texture.image, color );
			const blob = await new Promise( resolve => canvas.toBlob( resolve, isRGBA ? 'image/png' : 'image/jpeg', 1 ) );
			files[ `textures/Texture_${id}.${isRGBA ? 'png' : 'jpg'}` ] = new Uint8Array( await blob.arrayBuffer() );

		}

		// 64 byte alignment
		// https://github.com/101arrowz/fflate/issues/39#issuecomment-777263109

		let offset = 0;

		for ( const filename in files ) {

			const file = files[ filename ];
			const headerSize = 34 + filename.length;
			offset += headerSize;
			const offsetMod64 = offset & 63;

			if ( offsetMod64 !== 4 ) {

				const padLength = 64 - offsetMod64;
				const padding = new Uint8Array( padLength );
				files[ filename ] = [ file, {
					extra: {
						12345: padding
					}
				} ];

			}

			offset = file.length;

		}

		return fflate.zipSync( files, {
			level: 0
		} );

	}

}

function imageToCanvas( image, color ) {

	if ( typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement || typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement || typeof OffscreenCanvas !== 'undefined' && image instanceof OffscreenCanvas || typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap ) {

		const scale = 1024 / Math.max( image.width, image.height );
		const canvas = document.createElement( 'canvas' );
		canvas.width = image.width * Math.min( 1, scale );
		canvas.height = image.height * Math.min( 1, scale );
		const context = canvas.getContext( '2d' );
		context.drawImage( image, 0, 0, canvas.width, canvas.height );

		if ( color !== undefined ) {

			const hex = parseInt( color, 16 );
			const r = ( hex >> 16 & 255 ) / 255;
			const g = ( hex >> 8 & 255 ) / 255;
			const b = ( hex & 255 ) / 255;
			const imagedata = context.getImageData( 0, 0, canvas.width, canvas.height );
			const data = imagedata.data;

			for ( let i = 0; i < data.length; i += 4 ) {

				data[ i + 0 ] = data[ i + 0 ] * r;
				data[ i + 1 ] = data[ i + 1 ] * g;
				data[ i + 2 ] = data[ i + 2 ] * b;

			}

			context.putImageData( imagedata, 0, 0 );

		}

		return canvas;

	} else {

		throw new Error( 'THREE.USDZExporter: No valid image data found. Unable to process texture.' );

	}

}

//

const PRECISION = 7;

function buildHeader() {

	return `#usda 1.0
(
	customLayerData = {
		string creator = "Three.js USDZExporter"
	}
	defaultPrim = "Root"
	metersPerUnit = 1
	upAxis = "Y"
)

`;

}

function buildUSDFileAsString( dataToInsert ) {

	let output = buildHeader();
	output += dataToInsert;
	return fflate.strToU8( output );

} // Xform


function buildXform( object, geometry, material ) {

	const name = 'Object_' + object.id;
	const transform = buildMatrix( object.matrixWorld );

	if ( object.matrixWorld.determinant() < 0 ) {

		console.warn( 'THREE.USDZExporter: USDZ does not support negative scales', object );

	}

	return `def Xform "${name}" (
prepend references = @./geometries/Geometry_${geometry.id}.usd@</Geometry>
)
{
matrix4d xformOp:transform = ${transform}
uniform token[] xformOpOrder = ["xformOp:transform"]

rel material:binding = </Materials/Material_${material.id}>
}

`;

}

function buildMatrix( matrix ) {

	const array = matrix.elements;
	return `( ${buildMatrixRow( array, 0 )}, ${buildMatrixRow( array, 4 )}, ${buildMatrixRow( array, 8 )}, ${buildMatrixRow( array, 12 )} )`;

}

function buildMatrixRow( array, offset ) {

	return `(${array[ offset + 0 ]}, ${array[ offset + 1 ]}, ${array[ offset + 2 ]}, ${array[ offset + 3 ]})`;

} // Mesh


function buildMeshObject( geometry ) {

	const mesh = buildMesh( geometry );
	return `
def "Geometry"
{
${mesh}
}
`;

}

function buildMesh( geometry ) {

	const name = 'Geometry';
	const attributes = geometry.attributes;
	const count = attributes.position.count;
	return `
def Mesh "${name}"
{
	int[] faceVertexCounts = [${buildMeshVertexCount( geometry )}]
	int[] faceVertexIndices = [${buildMeshVertexIndices( geometry )}]
	normal3f[] normals = [${buildVector3Array( attributes.normal, count )}] (
		interpolation = "vertex"
	)
	point3f[] points = [${buildVector3Array( attributes.position, count )}]
	float2[] primvars:st = [${buildVector2Array( attributes.uv, count )}] (
		interpolation = "vertex"
	)
	uniform token subdivisionScheme = "none"
}
`;

}

function buildMeshVertexCount( geometry ) {

	const count = geometry.index !== null ? geometry.index.count : geometry.attributes.position.count;
	return Array( count / 3 ).fill( 3 ).join( ', ' );

}

function buildMeshVertexIndices( geometry ) {

	const index = geometry.index;
	const array = [];

	if ( index !== null ) {

		for ( let i = 0; i < index.count; i ++ ) {

			array.push( index.getX( i ) );

		}

	} else {

		const length = geometry.attributes.position.count;

		for ( let i = 0; i < length; i ++ ) {

			array.push( i );

		}

	}

	return array.join( ', ' );

}

function buildVector3Array( attribute, count ) {

	if ( attribute === undefined ) {

		console.warn( 'USDZExporter: Normals missing.' );
		return Array( count ).fill( '(0, 0, 0)' ).join( ', ' );

	}

	const array = [];

	for ( let i = 0; i < attribute.count; i ++ ) {

		const x = attribute.getX( i );
		const y = attribute.getY( i );
		const z = attribute.getZ( i );
		array.push( `(${x.toPrecision( PRECISION )}, ${y.toPrecision( PRECISION )}, ${z.toPrecision( PRECISION )})` );

	}

	return array.join( ', ' );

}

function buildVector2Array( attribute, count ) {

	if ( attribute === undefined ) {

		console.warn( 'USDZExporter: UVs missing.' );
		return Array( count ).fill( '(0, 0)' ).join( ', ' );

	}

	const array = [];

	for ( let i = 0; i < attribute.count; i ++ ) {

		const x = attribute.getX( i );
		const y = attribute.getY( i );
		array.push( `(${x.toPrecision( PRECISION )}, ${1 - y.toPrecision( PRECISION )})` );

	}

	return array.join( ', ' );

} // Materials


function buildMaterials( materials, textures, quickLookCompatible = false ) {

	const array = [];

	for ( const uuid in materials ) {

		const material = materials[ uuid ];
		array.push( buildMaterial( material, textures, quickLookCompatible ) );

	}

	return `def "Materials"
{
${array.join( '' )}
}

`;

}

function buildMaterial( material, textures, quickLookCompatible = false ) {

	// https://graphics.pixar.com/usd/docs/UsdPreviewSurface-Proposal.html
	const pad = '            ';
	const inputs = [];
	const samplers = [];

	function buildTexture( texture, mapType, color ) {

		const uv = texture.channel > 0 ? 'st' + texture.channel : 'st';

		const WRAPPINGS = {
			1000: 'repeat', // RepeatWrapping
			1001: 'clamp', // ClampToEdgeWrapping
			1002: 'mirror' // MirroredRepeatWrapping
		};

		const id = texture.id + ( color ? '_' + color.getHexString() : '' );
		const isRGBA = texture.format === 1023;
		textures[ id ] = texture;

		const repeat = texture.repeat.clone();
		const offset = texture.offset.clone();
		const rotation = texture.rotation;

		// rotation is around the wrong point. after rotation we need to shift offset again so that we're rotating around the right spot
		const xRotationOffset = Math.sin( rotation );
		const yRotationOffset = Math.cos( rotation );

		// texture coordinates start in the opposite corner, need to correct
		offset.y = 1 - offset.y - repeat.y;

		// turns out QuickLook is buggy and interprets texture repeat inverted/applies operations in a different order.
		// Apple Feedback: 	FB10036297 and FB11442287
		if ( quickLookCompatible ) {

			// This is NOT correct yet in QuickLook, but comes close for a range of models.
			// It becomes more incorrect the bigger the offset is

			offset.x = offset.x / repeat.x;
			offset.y = offset.y / repeat.y;

			offset.x += xRotationOffset / repeat.x;
			offset.y += yRotationOffset - 1;

		} else {

			// results match glTF results exactly. verified correct in usdview.
			offset.x += xRotationOffset * repeat.x;
			offset.y += ( 1 - yRotationOffset ) * repeat.y;

		}

		return `
	def Shader "PrimvarReader_${ mapType }"
	{
		uniform token info:id = "UsdPrimvarReader_float2"
		float2 inputs:fallback = (0.0, 0.0)
		token inputs:varname = "${ uv }"
		float2 outputs:result
	}

	def Shader "Transform2d_${mapType}" (
		sdrMetadata = {
			string role = "math"
		}
	)
	{
		uniform token info:id = "UsdTransform2d"
		float2 inputs:in.connect = </Materials/Material_${material.id}/uvReader_st.outputs:result>
		float2 inputs:scale = ${buildVector2( texture.repeat )}
		float inputs:rotation = ${ ( rotation * ( 180 / Math.PI ) ).toFixed( PRECISION ) }
		float2 inputs:translation = ${buildVector2( texture.offset )}
		float2 outputs:result
	}

	def Shader "Texture_${texture.id}_${mapType}"
	{
		uniform token info:id = "UsdUVTexture"
		asset inputs:file = @textures/Texture_${id}.${isRGBA ? 'png' : 'jpg'}@
		float2 inputs:st.connect = </Materials/Material_${material.id}/Transform2d_${mapType}.outputs:result>
		token inputs:wrapS = "${ WRAPPINGS[ texture.wrapS ] }"
		token inputs:wrapT = "${ WRAPPINGS[ texture.wrapT ] }"
		float outputs:r
		float outputs:g
		float outputs:b
		float3 outputs:rgb
	}`;

	}

	if ( material.opacity ) {

		if ( material.transmission && material.transmission > 0.0 ) {

			// workaround - use '0.0002' to let USDZ Loader set transmission
			// this will approximate the models appearance

			inputs.push( `${pad}float inputs:opacity = ${material.transmission}` );
			inputs.push( `${pad}float inputs:opacityThreshold = 0.0002` );

			if ( material.transmissionMap ) {

				inputs.push( `${pad}float inputs:opacity.connect = </Materials/Material_${material.id}/Texture_${material.transmissionMap.id}_opacity.outputs:r>` );
				samplers.push( buildTexture( material.transmissionMap, 'opacity' ) );

			}

		} else if ( material.transparent === true || material.opacity < 1.0 ) {

			inputs.push( `${pad}float inputs:opacity = ${material.opacity}` );
			inputs.push( `${pad}float inputs:opacityThreshold = 0.0001` );

		} else if ( material.alphaMap ) {

			inputs.push( `${pad}float inputs:opacity = ${material.opacity}` );
			inputs.push( `${pad}float inputs:opacityThreshold = 0.0001` );

			inputs.push( `${pad}float inputs:opacity.connect = </Materials/Material_${material.id}/Texture_${material.alphaMap.id}_opacity.outputs:r>` );
			samplers.push( buildTexture( material.alphaMap, 'opacity' ) );

		} else {

			inputs.push( `${pad}float inputs:opacity = ${material.opacity}` );

		}

	}

	if ( material.color ) inputs.push( `${pad}color3f inputs:diffuseColor = ${buildColor( material.color )}` );

	if ( material.map ) {

		inputs.push( `${pad}color3f inputs:diffuseColor.connect = </Materials/Material_${material.id}/Texture_${material.map.id}_diffuse.outputs:rgb>` );
		samplers.push( buildTexture( material.map, 'diffuse', material.color ) );

	}

	if ( material.emissive.getHex() > 0.0 ) {

		inputs.push( `${pad}color3f inputs:emissiveColor = ${buildColor( material.emissive )}` );

		if ( material.emissiveMap ) {

			inputs.push( `${pad}color3f inputs:emissiveColor.connect = </Materials/Material_${material.id}/Texture_${material.emissiveMap.id}_emissive.outputs:rgb>` );
			samplers.push( buildTexture( material.emissiveMap, 'emissive' ) );

		}

	}

	if ( material.normalMap ) {

		inputs.push( `${pad}normal3f inputs:normal.connect = </Materials/Material_${material.id}/Texture_${material.normalMap.id}_normal.outputs:rgb>` );
		samplers.push( buildTexture( material.normalMap, 'normal' ) );

	}

	if ( material.aoMap ) {

		inputs.push( `${pad}float inputs:occlusion.connect = </Materials/Material_${material.id}/Texture_${material.aoMap.id}_occlusion.outputs:r>` );
		samplers.push( buildTexture( material.aoMap, 'occlusion' ) );

	}

	if ( material.roughness && material.roughness > 0.0 ) {

		inputs.push( `${pad}float inputs:roughness = ${material.roughness}` );

		if ( material.roughnessMap ) {

			inputs.push( `${pad}float inputs:roughness.connect = </Materials/Material_${material.id}/Texture_${material.roughnessMap.id}_roughness.outputs:g>` );
			samplers.push( buildTexture( material.roughnessMap, 'roughness' ) );

		}

	}

	if ( material.metalness && material.metalness > 0.0 ) {

		inputs.push( `${pad}float inputs:metallic = ${material.metalness}` );

		if ( material.metalnessMap ) {

			inputs.push( `${pad}float inputs:metallic.connect = </Materials/Material_${material.id}/Texture_${material.metalnessMap.id}_metallic.outputs:b>` );
			samplers.push( buildTexture( material.metalnessMap, 'metallic' ) );

		}

	}

	if ( material.isMeshPhysicalMaterial ) {

		if ( material.specularColor ) {

			inputs.push( `${pad}color3f inputs:specularColor = ${buildColor( material.specularColor )}` );

			if ( material.specularColorMap ) {

				inputs.push( `${pad}color3f inputs:specularColor.connect = </Materials/Material_${material.id}/Texture_${material.specularColorMap.id}_specularColor.outputs:rgb>` );
				samplers.push( buildTexture( material.specularColorMap, 'specularColor' ) );

			}

		}

		if ( material.clearcoat && material.clearcoat > 0.0 ) {

			inputs.push( `${pad}float inputs:clearcoat = ${material.clearcoat}` );

			if ( material.clearcoatMap ) {

				inputs.push( `${pad}float inputs:clearcoat.connect = </Materials/Material_${material.id}/Texture_${material.clearcoatMap.id}_clearcoat.outputs:r>` );
				samplers.push( buildTexture( material.clearcoatMap, 'clearcoat' ) );

			}

		}

		if ( material.clearcoatRoughness && material.clearcoatRoughness > 0.0 ) {

			inputs.push( `${pad}float inputs:clearcoatRoughness = ${material.clearcoatRoughness}` );

			if ( material.clearcoatRoughnessMap ) {

				inputs.push( `${pad}float inputs:clearcoatRoughness.connect = </Materials/Material_${material.id}/Texture_${material.clearcoatRoughnessMap.id}_clearcoatRoughness.outputs:g>` );
				samplers.push( buildTexture( material.clearcoatRoughnessMap, 'clearcoatRoughness' ) );

			}

		}

		if ( material.ior && material.ior >= 1.0 ) inputs.push( `${pad}float inputs:ior = ${material.ior}` );

	}

	return `
def Material "Material_${material.id}"
{
	def Shader "PreviewSurface"
	{
		uniform token info:id = "UsdPreviewSurface"
${inputs.join( '\n' )}
		int inputs:useSpecularWorkflow = 0
		token outputs:surface
	}

	token outputs:surface.connect = </Materials/Material_${material.id}/PreviewSurface.outputs:surface>
	token inputs:frame:stPrimvarName = "st"

	def Shader "uvReader_st"
	{
		uniform token info:id = "UsdPrimvarReader_float2"
		token inputs:varname.connect = </Materials/Material_${material.id}.inputs:frame:stPrimvarName>
		float2 inputs:fallback = (0.0, 0.0)
		float2 outputs:result
	}

${samplers.join( '\n' )}

}
`;

}

function buildColor( color ) {

	return `(${color.r}, ${color.g}, ${color.b})`;

}

function buildVector2( vector ) {

	return `(${vector.x}, ${vector.y})`;

}

export { USDZExporter };
