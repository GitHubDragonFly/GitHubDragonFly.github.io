/**
 * Transcodes structured data object to a .splat buffer.
 * Adds configurable background filtering, SH weights, focus and brightness.
 *
 * @param {Object} [data] Structured data object returned by customized three.js KSPLAT / SPLAT / SPZ loaders
 * @param {Object} [options]
 * @param {boolean} [options.backgroundFilterEnabled=false] - Enable distance-based culling.
 * @param {number} [options.brightness=1.15]                - Global RGB multiplier before clamping.
 * @param {number} [options.maxRadius=15]                   - Max distance from origin to keep splats (if backgroundFilterEnabled).
 * @param {number} [options.sampleStep=1]                   - Skip every n-th splat to increase FPS.
 * @param {number} [options.sh1Scale=2.0]                   - Scale for degree-1 SH contribution.
 * @param {number} [options.sh2Scale=1.5]                   - Scale for degree-2 SH contribution.
 * @param {number} [options.sh3Scale=1.0]                   - Scale for degree-3 SH contribution.
 * @param {number} [options.focusFactor=1.0]                - Focus factor to control blur.
 * @returns {ArrayBuffer} Cleaned sequential .splat buffer
 */
export function transcodeToSplatBuffer( data, options = {} ) {

	const {
		backgroundFilterEnabled = false,
		brightness = 1.15,
		maxRadius = 15,
		sampleStep = 1,
		sh1Scale = 2.0,
		sh2Scale = 1.5,
		sh3Scale = 1.0,
		focusFactor = 1.0
	} = options;

	// These are the raw, un-instanced flat typed arrays directly from the stream parser

	const {
		count,
		positions,          // centers (Float32Array)
		scales,             // raw integer scale bytes (Uint8Array)
		rotations,          // quaternionXYZW (Float32Array)
		colors,             // colorBytes (Uint8ClampedArray)
		sphericalHarmonics  // sphericalHarmonicsBands object
	} = data;

	// Pull out SH band arrays if they exist

	const sh1Array = sphericalHarmonics?.sh1 || null;
	const sh2Array = sphericalHarmonics?.sh2 || null;
	const sh3Array = sphericalHarmonics?.sh3 || null;

	let keptCount = 0;

	for ( let i = 0; i < count; i += sampleStep ) {

		if ( backgroundFilterEnabled ) {

			const i3 = i * 3;
			const distanceSq = positions[ i3 ] * positions[ i3 ] + positions[ i3 + 1 ] * positions[ i3 + 1 ] + positions[ i3 + 2 ] * positions[ i3 + 2 ];
			if ( distanceSq > maxRadius * maxRadius ) continue;

		}

		keptCount++;

	}

	const outBuffer = new ArrayBuffer( keptCount * 32 );
	const outFloat  = new Float32Array( outBuffer );
	const outUint8  = new Uint8Array( outBuffer );

	let writeIndex = 0;

	for ( let i = 0; i < count; i += sampleStep ) {

		const i3 = i * 3;
		const x = positions[ i3 + 0 ];
		const y = positions[ i3 + 1 ];
		const z = positions[ i3 + 2 ];

		if ( backgroundFilterEnabled ) {

			const distanceSq = x * x + y * y + z * z;
			if ( distanceSq > maxRadius * maxRadius ) continue;

		}

		const i4 = i * 4;
		const floatOffset = writeIndex * 8;
		const byteOffset  = writeIndex * 32;

		// 1. Position Translation

		outFloat[ floatOffset + 0 ] = x;
		outFloat[ floatOffset + 1 ] = y;
		outFloat[ floatOffset + 2 ] = z;

		// 2. Scale Translation

		outFloat[ floatOffset + 3 ] = scales[ i3 + 0 ] * focusFactor;
		outFloat[ floatOffset + 4 ] = scales[ i3 + 1 ] * focusFactor;
		outFloat[ floatOffset + 5 ] = scales[ i3 + 2 ] * focusFactor;

		// 3. Color Processing

		let r = colors[ i4 + 0 ];
		let g = colors[ i4 + 1 ];
		let b = colors[ i4 + 2 ];
		let a = colors[ i4 + 3 ];

		if ( sh1Array ) {

			const packedVal = sh1Array[ i3 + 0 ];

			r += ( ( packedVal        & 0xFF ) / 255.0 - 0.5 ) * sh1Scale;
			g += ( ( (packedVal >> 8) & 0xFF ) / 255.0 - 0.5 ) * sh1Scale;
			b += ( ( (packedVal >>16) & 0xFF ) / 255.0 - 0.5 ) * sh1Scale;

		}

		if ( sh2Array ) {

			const packedVal2 = sh2Array[ i4 + 0 ];

			r += ( ( packedVal2        & 0xFF ) / 255.0 - 0.5 ) * sh2Scale;
			g += ( ( (packedVal2 >> 8) & 0xFF ) / 255.0 - 0.5 ) * sh2Scale;
			b += ( ( (packedVal2 >>16) & 0xFF ) / 255.0 - 0.5 ) * sh2Scale;

		}

		if ( sh3Array ) {

			const packedVal3 = sh3Array[ i * 6 ]; 

			r += ( ( packedVal3        & 0xFF ) / 255.0 - 0.5 ) * sh3Scale;
			g += ( ( (packedVal3 >> 8) & 0xFF ) / 255.0 - 0.5 ) * sh3Scale;
			b += ( ( (packedVal3 >>16) & 0xFF ) / 255.0 - 0.5 ) * sh3Scale;

		}

		outUint8[ byteOffset + 24 ] = Math.max( 0, Math.min( 255, Math.floor( r * brightness ) ) );
		outUint8[ byteOffset + 25 ] = Math.max( 0, Math.min( 255, Math.floor( g * brightness ) ) );
		outUint8[ byteOffset + 26 ] = Math.max( 0, Math.min( 255, Math.floor( b * brightness ) ) );
		outUint8[ byteOffset + 27 ] = a;

		// 4. Quaternion Alignment

		let qx = rotations[ i4 + 0 ];
		let qy = rotations[ i4 + 1 ];
		let qz = rotations[ i4 + 2 ];
		let qw = rotations[ i4 + 3 ];

		const len = Math.sqrt( qx * qx + qy * qy + qz * qz + qw * qw );

		if ( len > 1e-5 ) {

			qx /= len; qy /= len; qz /= len; qw /= len;

		}

		outUint8[ byteOffset + 28 ] = Math.floor( ( qw + 1 ) * 127.5 );
		outUint8[ byteOffset + 29 ] = Math.floor( ( qx + 1 ) * 127.5 );
		outUint8[ byteOffset + 30 ] = Math.floor( ( qy + 1 ) * 127.5 );
		outUint8[ byteOffset + 31 ] = Math.floor( ( qz + 1 ) * 127.5 );

		writeIndex++;
	}

	return outBuffer;
}
