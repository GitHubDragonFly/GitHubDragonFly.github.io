/**
 * Transcodes r186+ geometry to a .splat buffer optimized for low-spec hardware.
 * - Same 32-byte per splat layout as original version (positions, scales, RGBA, quat).
 * - Adds configurable background filtering, SH weights, and brightness.
 * - Keeps fast trace-based covariance → quaternion approximation.
 *
 * @param {THREE.BufferGeometry} splatGeometry
 * @param {Object} [options]
 * @param {number} [options.maxRadius=15]                   - Max distance from origin to keep splats (if backgroundFilterEnabled).
 * @param {number} [options.sampleStep=1]                   - Skip every n-th splat to increase FPS.
 * @param {boolean} [options.backgroundFilterEnabled=false] - Enable distance-based culling.
 * @param {number} [options.brightness=1.15]                - Global RGB multiplier before clamping.
 * @param {number} [options.sh1Scale=2.0]                   - Scale for degree-1 SH contribution.
 * @param {number} [options.sh2Scale=1.5]                   - Scale for degree-2 SH contribution.
 * @param {number} [options.sh3Scale=1.0]                   - Scale for degree-3 SH contribution.
 * @returns {ArrayBuffer} Cleaned sequential .splat buffer
 */
export function transcodeGeometryToSplatBuffer( splatGeometry, options = {} ) {

    const {
        maxRadius = 15,
        sampleStep = 1,
        backgroundFilterEnabled = false,
        brightness = 1.15,
        sh1Scale = 2.0,
        sh2Scale = 1.5,
        sh3Scale = 1.0
    } = options;

    const positionAttr = splatGeometry.getAttribute( 'position' );
    const colorAttr    = splatGeometry.getAttribute( 'color' );
    const covAttr      = splatGeometry.getAttribute( 'covariance' );

    const sh1Attr = splatGeometry.getAttribute( 'sphericalHarmonics1' );
    const sh2Attr = splatGeometry.getAttribute( 'sphericalHarmonics2' );
    const sh3Attr = splatGeometry.getAttribute( 'sphericalHarmonics3' );

    const count     = positionAttr.count;
    const posArray  = positionAttr.array;
    const colorArray = colorAttr.array;
    const covArray  = covAttr.array;

    const sh1Array = sh1Attr ? sh1Attr.array : null;
    const sh2Array = sh2Attr ? sh2Attr.array : null;
    const sh3Array = sh3Attr ? sh3Attr.array : null;

    let keptCount = 0;

    // FIRST PASS: count splats that survive filters + sampling
    for ( let i = 0; i < count; i += sampleStep ) {

        const i3 = i * 3;

        if ( backgroundFilterEnabled ) {

            const x = posArray[ i3 + 0 ];
            const y = posArray[ i3 + 1 ];
            const z = posArray[ i3 + 2 ];

            const distance = Math.sqrt( x * x + y * y + z * z );
            if ( distance > maxRadius ) continue;

        }

        keptCount++;

    }

    // Allocate final buffer once
    const outBuffer = new ArrayBuffer( keptCount * 32 );
    const outFloat  = new Float32Array( outBuffer );
    const outUint8  = new Uint8Array( outBuffer );

    let writeIndex = 0;

    // SECOND PASS: stream directly into final buffer
    for ( let i = 0; i < count; i += sampleStep ) {

        const i3 = i * 3;

        const x = posArray[ i3 + 0 ];
        const y = posArray[ i3 + 1 ];
        const z = posArray[ i3 + 2 ];

        if ( backgroundFilterEnabled ) {

            const distance = Math.sqrt( x * x + y * y + z * z );
            if ( distance > maxRadius ) continue;

        }

        const i4 = i * 4;
        const i5 = i * 5;
        const i6 = i * 6;

        const floatOffset = writeIndex * 8;
        const byteOffset  = writeIndex * 32;

        // 1. Positions
        outFloat[ floatOffset + 0 ] = x;
        outFloat[ floatOffset + 1 ] = y;
        outFloat[ floatOffset + 2 ] = z;

        // 2. Scales from covariance diagonal
        outFloat[ floatOffset + 3 ] = Math.sqrt( Math.max( 0.000001, covArray[ i6 + 0 ] ) );
        outFloat[ floatOffset + 4 ] = Math.sqrt( Math.max( 0.000001, covArray[ i6 + 3 ] ) );
        outFloat[ floatOffset + 5 ] = Math.sqrt( Math.max( 0.000001, covArray[ i6 + 5 ] ) );

        // 3. Colors + SH contributions
        let r = colorArray[ i4 + 0 ];
        let g = colorArray[ i4 + 1 ];
        let b = colorArray[ i4 + 2 ];
        let a = colorArray[ i4 + 3 ];

        if ( sh1Array ) {

            const packedVal = sh1Array[ i3 + 0 ];

            const shX = ( ( packedVal        & 0xFF ) / 255.0 - 0.5 ) * sh1Scale;
            const shY = ( ( (packedVal >> 8) & 0xFF ) / 255.0 - 0.5 ) * sh1Scale;
            const shZ = ( ( (packedVal >>16) & 0xFF ) / 255.0 - 0.5 ) * sh1Scale;

            r += shX;
            g += shY;
            b += shZ;

        }

        if ( sh2Array ) {

            const packedVal2 = sh2Array[ i4 + 0 ];

            const sh2X = ( ( packedVal2        & 0xFF ) / 255.0 - 0.5 ) * sh2Scale;
            const sh2Y = ( ( (packedVal2 >> 8) & 0xFF ) / 255.0 - 0.5 ) * sh2Scale;
            const sh2Z = ( ( (packedVal2 >>16) & 0xFF ) / 255.0 - 0.5 ) * sh2Scale;

            r += sh2X;
            g += sh2Y;
            b += sh2Z;

        }

        if ( sh3Array ) {

            const packedVal3 = sh3Array[ i5 + 0 ];

            const sh3X = ( ( packedVal3        & 0xFF ) / 255.0 - 0.5 ) * sh3Scale;
            const sh3Y = ( ( (packedVal3 >> 8) & 0xFF ) / 255.0 - 0.5 ) * sh3Scale;
            const sh3Z = ( ( (packedVal3 >>16) & 0xFF ) / 255.0 - 0.5 ) * sh3Scale;

            r += sh3X;
            g += sh3Y;
            b += sh3Z;

        }

        // Brightening + clamp
        outUint8[ byteOffset + 24 ] = Math.max( 0, Math.min( 255, Math.floor( r * brightness ) ) );
        outUint8[ byteOffset + 25 ] = Math.max( 0, Math.min( 255, Math.floor( g * brightness ) ) );
        outUint8[ byteOffset + 26 ] = Math.max( 0, Math.min( 255, Math.floor( b * brightness ) ) );
        outUint8[ byteOffset + 27 ] = a;

        // 4. Quaternion from covariance (trace-based approximation)
        const c0 = covArray[ i6 + 0 ];
        const c3 = covArray[ i6 + 3 ];
        const c5 = covArray[ i6 + 5 ];
        const tr = c0 + c3 + c5;

        let qx = 0, qy = 0, qz = 0, qw = 1;

        if ( tr > 0 ) {

            const S = Math.sqrt( tr + 1.0 ) * 2;

            qw = 0.1 * S;
            qx = covArray[ i6 + 4 ] / S;
            qy = covArray[ i6 + 2 ] / S;
            qz = covArray[ i6 + 1 ] / S;

        } else if ( ( c0 > c3 ) && ( c0 > c5 ) ) {

            const S = Math.sqrt( 1.0 + c0 - c3 - c5 ) * 2;

            qw = covArray[ i6 + 4 ] / S;
            qx = 0.1 * S;
            qy = ( covArray[ i6 + 1 ] + covArray[ i6 + 2 ] ) / S;
            qz = ( covArray[ i6 + 2 ] + covArray[ i6 + 1 ] ) / S;

        } else if ( c3 > c5 ) {

            const S = Math.sqrt( 1.0 + c3 - c0 - c5 ) * 2;

            qw = covArray[ i6 + 2 ] / S;
            qx = ( covArray[ i6 + 1 ] + covArray[ i6 + 2 ] ) / S;
            qy = 0.1 * S;
            qz = ( covArray[ i6 + 4 ] + covArray[ i6 + 1 ] ) / S;

        } else {

            const S = Math.sqrt( 1.0 + c5 - c0 - c3 ) * 2;

            qw = covArray[ i6 + 1 ] / S;
            qx = ( covArray[ i6 + 2 ] + covArray[ i6 + 1 ] ) / S;
            qy = ( covArray[ i6 + 4 ] + covArray[ i6 + 1 ] ) / S;
            qz = 0.1 * S;

        }

        const len = Math.sqrt( qx * qx + qy * qy + qz * qz + qw * qw );

        if ( len > 0.00001 ) {

            qx /= len;
            qy /= len;
            qz /= len;
            qw /= len;

        }

        outUint8[ byteOffset + 28 ] = Math.floor( ( qx + 1 ) * 127.5 );
        outUint8[ byteOffset + 29 ] = Math.floor( ( qy + 1 ) * 127.5 );
        outUint8[ byteOffset + 30 ] = Math.floor( ( qz + 1 ) * 127.5 );
        outUint8[ byteOffset + 31 ] = Math.floor( ( qw + 1 ) * 127.5 );

        writeIndex++;

    }

    return outBuffer;

}
