import { Box3, Loader, MathUtils, Matrix4, Quaternion, Sphere, Vector3, WebGLRenderer } from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.min.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.min.js';
import * as OGC3D from 'https://cdn.jsdelivr.net/npm/@jdultra/threedtiles@14.0.26/dist/threedtiles.es.min.js';

/**
 * A loader for 3D Tilesets - normally loaded via tileset.json URL link.
 *
 * Created with assistance from Microsoft Copilot and Google Gemini
 *
 * Internally using OGC3DTile loader from @jdultra/threedtiles
 *
 * ```js
 * const loader = new Three3DTilesLoader();
 *
 * loader.setRenderer( renderer );
 *
 * const tileset_object = await loader.loadAsync( 'path_to/tileset.json' );
 * scene.add( tileset_object );
 * ```
 *
 * Add the following to your render loop:
 *  tileset_object.update( camera );
 *  tileset_object.tileLoader.update();
 *
 * Also, check whether tiles are still being loaded
 *  tileset_obj.getStreamingInfo();
 *
 * Dynamically change mesh material wireframe with predefined boolean variable 'enabled':
 *  tileset_object.setWireframe( enabled );
 *
 * Dynamically change point size for loaded point clouds, with predefined float variable 'size'.
 * Valid values are from range [1 to 10] and value can be entered directly instead of variable:
 *  tileset_object.setPointSize( size );
 *
 * Dispose of the tileset_object to free resources:
 *  if ( tileset_object.dispose ) tileset_object.dispose();
 *
 * @augments Loader
 * @three_import import { Three3DTilesLoader } from "path_to/3DTilesLoader.js"
 */
class Three3DTilesLoader extends Loader {

	/**
	 * @param { import( 'three' ).LoadingManager } [ manager ]
	 */
	constructor( manager ) {

		super( manager );

		this._rootUrl = '';
		this._keyAPI = '';
		this._token = '';

		this._maxDepthLevel = 1;
		this._variantLookup = new Map();

		this._v1 = new Vector3();
		this._corner = new Vector3();
		this._R = 6378137; // WGS84 Semi-major axis

		this._renderer = null;
		this._maxCacheSize = 100;

		this._dracoLoader = new DRACOLoader();
		this._dracoLoader.setDecoderPath( "https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/libs/draco/" );
		this._dracoLoader.setDecoderConfig( { type: 'js' } );
		this._dracoLoader.preload();

		this._ktx2Loader = new KTX2Loader();
		this._ktx2Loader.setTranscoderPath( "https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/libs/basis/" );

	}

	/**
	 * Passes renderer instance.
	 * @param { import( 'three' ).WebGLRenderer } renderer
	 */
	setRenderer( renderer ) {

		this._renderer = renderer;
		return this;

	}

	/**
	 * Sets the API key required for some data providers.
	 * @param { string } key
	 */
	setAPIKey( key ) {

		this._keyAPI = key.toString();
		return this;

	}

	/**
	 * Sets the token required for some data providers.
	 * @param { string } token
	 */
	setToken( key ) {

		this._token = token.toString();
		return this;

	}

	/**
	 * Determines maximum number of levels to be loaded.
	 * Clamped between 1 and 100.
	 * @param { integer } maxDepthLevel
	 */
	setMaxDepthLevel( maxDepthLevel ) {

		if ( typeof maxDepthLevel !== 'number' || !Number.isFinite( maxDepthLevel ) ) {

			console.warn( `Invalid maxDepthLevel: ${ maxDepthLevel }. Using default.` );
			return this;

		}

		this._maxDepthLevel = Math.max( 1, Math.min( 100, maxDepthLevel ) );
		return this;

	}

	/**
	 * Determines how many tiles are kept in the "ready" state.
	 * Clamped between 100 and 5000.
	 * @param { integer } maxCacheSize
	 */
	setMaxCacheSize( maxCacheSize ) {

		if ( typeof maxCacheSize !== 'number' || !Number.isFinite( maxCacheSize ) ) {

			console.warn( `Invalid maxCacheSize: ${ maxCacheSize }. Using default.` );
			return this;

		}

		this._maxCacheSize = Math.max( 100, Math.min( 5000, maxCacheSize ) );
		return this;

	}

	/**
	 * Converts an Oriented Bounding Box (OBB) to an Axis-Aligned Bounding Box (Box3).
	 * @param { Object } obb - The OBB object with center and e1, e2, e3 vectors.
	 * @returns { Box3 }
	 * @private
	 */
	_obbToBox3( obb, target = new Box3() ) {

		const { center, e1, e2, e3, halfSize } = obb;

		// Determine the effective half-size.
		// If halfSize exists, we use it.
		// If not, we assume scale is already in e1,e2,e3 (size 1.0)

		const hx = halfSize ? halfSize.x : 1.0;
		const hy = halfSize ? halfSize.y : 1.0;
		const hz = halfSize ? halfSize.z : 1.0;

		// Calculate the "Radius" (Projection) onto World Axes
		// We multiply the axis component by its respective half-size

		const rx = Math.abs( e1.x * hx ) + Math.abs( e2.x * hy ) + Math.abs( e3.x * hz );
		const ry = Math.abs( e1.y * hx ) + Math.abs( e2.y * hy ) + Math.abs( e3.y * hz );
		const rz = Math.abs( e1.z * hx ) + Math.abs( e2.z * hy ) + Math.abs( e3.z * hz );

		// Set the Box3 boundaries

		target.min.set( center.x - rx, center.y - ry, center.z - rz );
		target.max.set( center.x + rx, center.y + ry, center.z + rz );

		return target;

	}

	/**
	 * Creates a Box3 from a bounding sphere.
	 * @param { Object } sphere - Object containing center and radius.
	 * @returns { Box3 }
	 * @private
	 */
	_boxFromSphere( sphere ) {

		const center = new Vector3(

			sphere.center.x,
			sphere.center.y,
			sphere.center.z

		);

		const r = sphere.radius;

		return new Box3(

			new Vector3( center.x - r, center.y - r, center.z - r ),
			new Vector3( center.x + r, center.y + r, center.z + r )

		);

	}

	/**
	 * Computes a Box3 from a bounding volume (Sphere or OBB).
	 * @param { Object } bv - The bounding volume from the tileset.
	 * @returns { Box3 }
	 * @private
	 */
	_computeBox3FromBoundingVolume( bv ) {

		if ( bv.isSphere ) {

			return this._boxFromSphere( bv );

		} else if ( bv.isOBB ) {

			return this._obbToBox3( bv );

		} else if ( bv.box && Array.isArray( bv.box ) ) {

			const b = bv.box;
			// b[0..2] = center, b[3..5] = ux, b[6..8] = uy, b[9..11] = uz

			const box = new Box3();
			box.makeEmpty();

			// Instead of an array, we manually calculate the
			// 8 permutations of: center +/- ux +/- uy +/- uz

			for ( let i = 0; i < 8; i ++ ) {

				this._corner.set( b[ 0 ], b[ 1 ], b[ 2 ] ); // Start at center

				// Use bitmasking to add or subtract the half-axes

				this._corner.addScaledVector( this._v1.set( b[ 3 ], b[ 4 ], b[ 5 ] ), ( i & 1 ) ? 1 : - 1 ); // ux
				this._corner.addScaledVector( this._v1.set( b[ 6 ], b[ 7 ], b[ 8 ] ), ( i & 2 ) ? 1 : - 1 ); // uy
				this._corner.addScaledVector( this._v1.set( b[ 9 ], b[ 10 ], b[ 11 ] ), ( i & 4 ) ? 1 : - 1 ); // uz

				box.expandByPoint( this._corner );

			}

			return box;

		} else if ( bv.region ) {

			const box = new Box3();
			box.makeEmpty();

			const [ west, south, east, north, minH, maxH ] = bv.region;
			const lons = [ west, east ];
			const lats = [ south, north ];
			const alts = [ minH, maxH ];

			// We calculate ECEF for all 8 combinations of the region

			for ( let i = 0; i < 2; i++ ) { // lon

				for ( let j = 0; j < 2; j++ ) { // lat

					for ( let k = 0; k < 2; k++ ) { // alt

						const lon = lons[ i ];
						const lat = lats[ j ];
						const alt = alts[ k ];

						// Standard Geodetic to ECEF conversion

						const cosLat = Math.cos( lat );
						const x = ( this._R + alt ) * cosLat * Math.cos( lon );
						const y = ( this._R + alt ) * Math.sin( lat );
						const z = ( this._R + alt ) * cosLat * Math.sin( lon );

						box.expandByPoint( this._v1.set( x, y, z ) );

					}

				}

			}

			return box;

		}

		console.warn( 'Unsupported boundingVolume type, falling back to identity Box3.' );

		return new Box3(

			new Vector3( - 1, - 1, - 1 ),
			new Vector3( 1, 1, 1 )

		);

	}

	/**
	 * Interleaves the lower 8 bits of a number into a 3D Morton pattern.
	 *
	 * This expands the bits of `n` so they occupy every third bit:
	 *   b0 → bit 0
	 *   b1 → bit 3
	 *   b2 → bit 6
	 *   ...
	 *
	 * Used internally by `_morton3D` to encode (x, y, z) into a single Morton index.
	 *
	 * @param {number} n - The integer whose bits will be interleaved (typically 0–255).
	 * @returns {number} The interleaved bit pattern for use in 3D Morton encoding.
	 */
	_interleaveBits3D( n ) { // OCTREE

		n = ( n | ( n << 8 ) ) & 0x00F00F;
		n = ( n | ( n << 4 ) ) & 0x0C30C3;
		n = ( n | ( n << 2 ) ) & 0x249249;

		return n;

	}

	/**
	 * Computes a 3D Morton code (Z‑order curve index) for the given (x, y, z)
	 * coordinates. Each coordinate is interleaved using `_interleaveBits3D`.
	 *
	 * Morton layout:
	 *   bit 0 → x0
	 *   bit 1 → y0
	 *   bit 2 → z0
	 *   bit 3 → x1
	 *   bit 4 → y1
	 *   bit 5 → z1
	 *   ...
	 *
	 * @param {number} x - The X coordinate (0–255).
	 * @param {number} y - The Y coordinate (0–255).
	 * @param {number} z - The Z coordinate (0–255).
	 * @returns {number} The 3D Morton index.
	 */
	_morton3D( x, y, z ) { // OCTREE

		return this._interleaveBits3D( x ) | ( this._interleaveBits3D( y ) << 1 ) | ( this._interleaveBits3D( z ) << 2 );

	}

	/**
	 * Extracts every third bit from a Morton‑encoded integer, reversing the effect
	 * of `_interleaveBits3D`. This recovers the original coordinate component.
	 *
	 * Used internally by `_decodeMorton3D`.
	 *
	 * @param {number} n - The Morton‑encoded integer.
	 * @returns {number} The de‑interleaved integer (0–255).
	 */
	_deinterleaveBits3D( n ) { // OCTREE

		n &= 0x249249;
		n = ( n | ( n >> 2 ) ) & 0x0C30C3;
		n = ( n | ( n >> 4 ) ) & 0x00F00F;
		n = ( n | ( n >> 8 ) ) & 0x0000FF;

		return n;

	}

	/**
	 * Decodes a 3D Morton index into its (x, y, z) components.
	 *
	 * Morton layout:
	 *   x bits → n
	 *   y bits → n >> 1
	 *   z bits → n >> 2
	 *
	 * Each component is recovered using `_deinterleaveBits3D`.
	 *
	 * @param {number} index - The Morton index to decode.
	 * @returns {number[]} A 3‑element array `[x, y, z]`.
	 */
	_decodeMorton3D( index ) { // OCTREE

		return [
			this._deinterleaveBits3D( index ),         // x
			this._deinterleaveBits3D( index >> 1 ),    // y
			this._deinterleaveBits3D( index >> 2 )     // z
		];

	}

	/**
	 * Interleaves the lower 8 bits of a number into a 2D Morton pattern.
	 *
	 * This expands the bits of `n` so they occupy every second bit:
	 *   b0 → bit 0
	 *   b1 → bit 2
	 *   b2 → bit 4
	 *   ...
	 *
	 * Used internally by `_morton2D`.
	 *
	 * @param {number} n - The integer whose bits will be interleaved (typically 0–255).
	 * @returns {number} The interleaved bit pattern for use in 2D Morton encoding.
	 */
	_interleaveBits2D( n ) { // QUADTREE

		n = ( n | ( n << 4 ) ) & 0x0F0F;
		n = ( n | ( n << 2 ) ) & 0x3333;
		n = ( n | ( n << 1 ) ) & 0x5555;

		return n;

	}

	/**
	 * Computes a 2D Morton code (Z‑order curve index) for the given (x, y)
	 * coordinates. Each coordinate is interleaved using `_interleaveBits2D`.
	 *
	 * Morton layout:
	 *   bit 0 → x0
	 *   bit 1 → y0
	 *   bit 2 → x1
	 *   bit 3 → y1
	 *   ...
	 *
	 * @param {number} x - X coordinate (0–255).
	 * @param {number} y - Y coordinate (0–255).
	 * @returns {number} The 2D Morton index.
	 */
	_morton2D( x, y ) { // QUADTREE

		return this._interleaveBits2D( x ) | ( this._interleaveBits2D( y ) << 1 );

	}

	/**
	 * Decodes a 2D Morton index (0–3) into its corresponding (x, y, z) child
	 * coordinates for QUADTREE subdivision. This is used when iterating over the
	 * four children of a quadtree tile.
	 *
	 * Morton → child mapping:
	 *   0 → [0, 0, 0]
	 *   1 → [1, 0, 0]
	 *   2 → [0, 1, 0]
	 *   3 → [1, 1, 0]
	 *
	 * Z is always 0 because QUADTREE subdivision is 2D.
	 *
	 * @param {number} index - Morton index in the range 0–3.
	 * @returns {number[]} A 3‑element array `[x, y, 0]` representing the child’s local coordinates.
	 */
	_decodeMorton2D( index ) { // QUADTREE

		// For Quadtree child iterations (0-3)
		// index 0: [0,0,0], 1: [1,0,0], 2: [0,1,0], 3: [1,1,0]

		return [
			( index & 1 ),      // x
			( index >> 1 ) & 1, // y
			0                   // z is always 0 in 2D
		];

	}

	/**
	 * Computes the Morton index of a tile within a subtree for implicit tiling.
	 *
	 * The index is composed of:
	 *   1. A *relative Morton code* for (x, y, z) within the subtree
	 *   2. A *level offset* that accounts for all Morton codes of previous levels
	 *
	 * This produces a single linear index into the subtree’s availability
	 * bitstreams (tile/content/child-subtree).
	 *
	 * ### Relative coordinates
	 * The tile’s global (x, y, z) coordinates are masked to the subtree’s local
	 * coordinate space:
	 *   - `relativeLevel = level - subtreeRootLevel`
	 *   - `mask = (1 << relativeLevel) - 1`
	 *   - `rx = x & mask`
	 *   - `ry = y & mask`
	 *   - `rz = z & mask` (OCTREE only)
	 *
	 * ### Morton encoding
	 * - QUADTREE → `_morton2D(rx, ry)`
	 * - OCTREE   → `_morton3D(rx, ry, rz)`
	 *
	 * ### Level offset
	 * Ensures that Morton indices from different levels do not overlap:
	 * - QUADTREE: `(4^relativeLevel - 1) / 3`
	 * - OCTREE:   `(8^relativeLevel - 1) / 7`
	 *
	 * @param {number} level - The absolute implicit tile level.
	 * @param {number} x - The tile’s global X coordinate.
	 * @param {number} y - The tile’s global Y coordinate.
	 * @param {number} z - The tile’s global Z coordinate (0 for QUADTREE).
	 * @param {number} subtreeRootLevel - The absolute level at which the current subtree begins.
	 * @param {boolean} [isQuadtree=false] Whether the implicit tiling scheme is QUADTREE (2D) instead of OCTREE (3D).
	 * @returns {number} The Morton index of the tile within the subtree’s availability arrays.
	 */
	_computeMortonIndex( level, x, y, z, subtreeRootLevel, isQuadtree = false ) {

		const relativeLevel = level - subtreeRootLevel;
		const mask = ( 1 << relativeLevel ) - 1;

		const rx = x & mask;
		const ry = y & mask;

		if ( isQuadtree ) {

			// Quadtree Math

			const morton = this._morton2D( rx, ry );
			const levelOffset = ( Math.pow( 4, relativeLevel ) - 1 ) / 3;

			return levelOffset + morton;

		} else {

			// Octree Math

			const rz = z & mask;
			const morton = this._morton3D( rx, ry, rz );
			const levelOffset = ( Math.pow( 8, relativeLevel ) - 1 ) / 7;

			return levelOffset + morton;

		}

	}

	/**
	 * Replaces implicit‑tiling template variables in a URI with concrete values.
	 *
	 * Supported template tokens:
	 *   - {level}
	 *   - {x}
	 *   - {y}
	 *   - {z}
	 *
	 * These appear in subtree URIs and content URIs for implicit tilesets.
	 *
	 * @param {string} uri - The URI template containing one or more `{token}` placeholders.
	 * @param {number} level - The implicit tile level to substitute into `{level}`.
	 * @param {number} x - The tile's X coordinate to substitute into `{x}`.
	 * @param {number} y - The tile's Y coordinate to substitute into `{y}`.
	 * @param {number} z - The tile's Z coordinate to substitute into `{z}` (not used for QUADTREE).
	 * @returns {string} The URI with all template tokens replaced by their numeric values.
	 */
	_replaceTemplate( uri, level, x, y, z ) {

		let result = uri
			.replace( '{level}', level)
			.replace( '{x}', x )
			.replace( '{y}', y)
			.replace( '{z}', z );

		// 2. Ensure no leading slash so it matches the variantLookup keys

		if ( result.startsWith( '/' ) ) {

			result = result.substring( 1 );

		}

		return result;

	}

	/**
	 * Computes the oriented bounding box (OBB) for a child tile derived from a
	 * parent OBB. A 3D Tiles `box` is defined as a 12‑element array:
	 *
	 *   [ cx, cy, cz,  hx1, hy1, hz1,  hx2, hy2, hz2,  hx3, hy3, hz3 ]
	 *
	 * where:
	 *   - (cx, cy, cz) is the center
	 *   - the next three triplets are the half‑axis vectors X, Y, Z
	 *
	 * This function subdivides the parent box into 2×2 (QUADTREE) or 2×2×2 (OCTREE)
	 * children by:
	 *   - Halving the X and Y half‑axes (always)
	 *   - Halving the Z half‑axis only for OCTREE
	 *   - Offsetting the center along each half‑axis based on (dx, dy, dz)
	 *
	 * @param {number[]} p - The parent OBB array of length 12.
	 * @param {number} dx - Child index along the X half‑axis (0 or 1).
	 * @param {number} dy - Child index along the Y half‑axis (0 or 1).
	 * @param {number} dz - Child index along the Z half‑axis (0 or 1). Ignored for QUADTREE.
	 * @param {boolean} [isQuadtree=false] Whether the implicit tiling scheme is QUADTREE (2D).
	 * @returns {number[]} A new 12‑element OBB array representing the child tile’s bounding volume.
	 *
	 * @description
	 * ### How subdivision works
	 *
	 * **Half‑axes**
	 * - X and Y half‑axes are always halved.
	 * - Z half‑axis is halved only for OCTREE; QUADTREE preserves it.
	 *
	 * **Center shift**
	 * The child center is computed as:
	 * ```
	 * childCenter = parentCenter
	 *             + offsetX * parentHalfAxisX
	 *             + offsetY * parentHalfAxisY
	 *             + offsetZ * parentHalfAxisZ
	 * ```
	 * where each offset is ±0.5 depending on dx/dy/dz.
	 */
	_computeChildBox( p, dx, dy, dz, isQuadtree = false ) {

		const childBox = new Array( 12 );

		// New half-axes (halve X and Y, halve Z only if Octree)
		// Vector X (3,4,5) and Vector Y (6,7,8)

		for ( let i = 3; i < 9; i++ ) {

			childBox[ i ] = p[ i ] * 0.5;

		}

		// Vector Z (9,10,11)

		if ( isQuadtree ) {

			childBox[ 9 ] = p[ 9 ];
			childBox[ 10 ] = p[ 10 ];
			childBox[ 11 ] = p[ 11 ];

		} else {

			childBox[ 9 ] = p[ 9 ] * 0.5;
			childBox[ 10 ] = p[ 10 ] * 0.5;
			childBox[ 11 ] = p[ 11 ] * 0.5;

		}

		// Shift center
		// New Center = Old Center + (offset * VectorX) + (offset * VectorY) + (offset * VectorZ)

		const offsetX = dx ? 0.5 : -0.5;
		const offsetY = dy ? 0.5 : -0.5;
		const offsetZ = isQuadtree ? 0 : (dz ? 0.5 : -0.5);

		childBox[ 0 ] = p[ 0 ] + ( p[ 3 ] * offsetX ) + ( p[ 6 ] * offsetY ) + ( p[ 9 ] * offsetZ );
		childBox[ 1 ] = p[ 1 ] + ( p[ 4 ] * offsetX ) + ( p[ 7 ] * offsetY ) + ( p[ 10 ] * offsetZ );
		childBox[ 2 ] = p[ 2 ] + ( p[ 5 ] * offsetX ) + ( p[ 8 ] * offsetY ) + ( p[ 11 ] * offsetZ );

		return childBox;

	}

	/**
	 * Computes the geographic `region` bounding volume for a child tile derived
	 * from a parent region. A region is defined as:
	 * `[west, south, east, north, minHeight, maxHeight]`.
	 *
	 * The parent region is subdivided into 2×2 (QUADTREE) or 2×2×2 (OCTREE)
	 * children. The child is selected using (dx, dy, dz), where each component
	 * is either 0 or 1 depending on which half of the parent volume is chosen.
	 *
	 * @param {number[]} p - The parent region array: `[west, south, east, north, minHeight, maxHeight]`.
	 * @param {number} dx - Child index in the longitudinal direction (0 or 1).
	 * @param {number} dy - Child index in the latitudinal direction (0 or 1).
	 * @param {number} dz - Child index in the vertical direction (0 or 1). Ignored for QUADTREE.
	 * @param {boolean} [isQuadtree=false] Whether the implicit tiling scheme is QUADTREE (2D).
	 * @returns {number[]} A new region array representing the child tile’s bounding volume.
	 *
	 * @description
	 * ### How subdivision works
	 *
	 * - Longitude and latitude are always split in half.
	 * - Height is split only for OCTREE; QUADTREE preserves the full height.
	 * - The child region is computed by offsetting the parent’s west/south/minHeight
	 *   by the appropriate half‑sizes.
	 */
	_computeChildRegion( p, dx, dy, dz, isQuadtree = false ) {

		const [ west, south, east, north, minH, maxH ] = p;

		const halfLat = ( north - south ) * 0.5;
		const halfLon = ( east - west ) * 0.5;
		const halfHeight = ( maxH - minH ) * 0.5;

		const childRegion = [

			west + dx * halfLon,                               // new west
			south + dy * halfLon,                              // new south
			west + ( dx + 1 ) * halfLon,                       // new east
			south + ( dy + 1 ) * halfLat,                      // new north
			isQuadtree ? minH : minH + dz * halfHeight,        // min height
			isQuadtree ? maxH : minH + ( dz + 1 ) * halfHeight // max height

		];

		return childRegion;

	}

	/**
	 * Computes the bounding volume for a child tile derived from a parent tile's
	 * bounding volume. Supports both `box` and `region` volume types as defined in
	 * 3D Tiles. The subdivision is determined by the implicit tiling coordinates
	 * (dx, dy, dz) and whether the tiling scheme is QUADTREE or OCTREE.
	 *
	 * Delegates the actual subdivision math to:
	 *   - `_computeChildBox`    for oriented bounding boxes
	 *   - `_computeChildRegion` for geographic regions
	 *
	 * If the parent bounding volume type is not recognized, the parent volume is
	 * returned unchanged.
	 *
	 * @param {Object} parentBV - The parent tile's bounding volume with either a box or region.
	 * @param {number} dx - Child index offset in the X direction (0 or 1 for QUADTREE; 0–1 for OCTREE).
	 * @param {number} dy - Child index offset in the Y direction.
	 * @param {number} dz - Child index offset in the Z direction (ignored for QUADTREE).
	 * @param {boolean} [isQuadtree=false] Whether the implicit tiling scheme is QUADTREE (2D) instead of OCTREE (3D).
	 * @returns {Object} A new bounding volume object of the same type as the parent (box or region).
	 */
	_computeChildBoundingVolume( parentBV, dx, dy, dz, isQuadtree = false ) {

		if ( parentBV.box ) {

			return { box: this._computeChildBox( parentBV.box, dx, dy, dz, isQuadtree ) };

		} else if ( parentBV.region ) {

			return { region: this._computeChildRegion( parentBV.region, dx, dy, dz, isQuadtree ) };

		}

		return parentBV;

	}

	/**
	 * Decodes an availability bitstream from a subtree's binary chunk into a flat
	 * array of 0/1 values. Bitstreams in 3D Tiles 1.1 are stored LSB‑first, meaning
	 * bit 0 is the least significant bit of the first byte.
	 *
	 * The bitstream is referenced by a bufferView index inside the subtree JSON.
	 * This function extracts the corresponding byte range from the binary chunk and
	 * expands each byte into eight individual availability bits.
	 *
	 * @param {Object} json - The parsed subtree JSON, must contain `bufferViews`.
	 * @param {Uint8Array} binary - The raw binary chunk of the subtree file.
	 * @param {number} bitstreamIndex - Index into `json.bufferViews`.
	 * @returns {Uint8Array} A flat array of bits (0 or 1), length = `byteLength * 8` (LSB‑first order).
	 *
	 * @description
	 * ### How it works
	 *
	 * 1. Look up the bufferView for the bitstream.
	 * 2. Slice the corresponding byte range from the subtree's binary chunk.
	 * 3. Allocate a `Uint8Array` large enough to hold one entry per bit.
	 * 4. For each byte:
	 *    - Extract bits 0–7 using `(byte >> b) & 1`
	 *    - Store them in LSB‑first order
	 *
	 * This function performs no interpretation of the bits; it simply expands the
	 * raw bitstream into a form that higher‑level availability checks can index
	 * directly.
	 */
	_decodeBitstream( json, binary, bitstreamIndex ) {

		const bv = json.bufferViews[ bitstreamIndex ];

		// Safety: Ensure we aren't reading past the end of the binary chunk

		const start = bv.byteOffset || 0;
		const end = start + bv.byteLength;
		const bytes = binary.subarray( start, end );

		const bits = new Uint8Array( bytes.length * 8 );

		for ( let i = 0; i < bytes.length; i++ ) {

			const byte = bytes[ i ];

			for ( let b = 0; b < 8; b++ ) {

				// Cesium bitstreams are LSB-first

				bits[ i * 8 + b ] = ( byte >> b ) & 1;

			}

		}

		return bits;

	}

	/**
	 * Returns the availability (true/false) of a single tile/content/subtree entry
	 * at the given Morton index. Availability in 3D Tiles 1.1 can be expressed as:
	 *
	 * 1. **Constant availability**
	 *    `{ constant: 0 | 1 }`
	 *    In this case, the function simply returns whether the constant equals 1.
	 *
	 * 2. **Bitstream availability**
	 *    `{ bitstream: <bufferViewIndex> }`
	 *    The function locates the referenced bufferView inside the subtree JSON,
	 *    computes the byte and bit position for the given index, and extracts the
	 *    corresponding bit from the subtree's binary chunk.
	 *
	 * If no availability information is provided, the function returns `false`.
	 *
	 * @param {Object} availability - The availability descriptor from the subtree JSON.
	 * @param {number} index - The Morton index of the tile/content/subtree entry being queried.
	 * @param {DataView} binary - A DataView over the subtree's binary chunk. Used to read individual bytes.
	 * @param {Object} subtreeJson - The parsed subtree JSON. Required for resolving bufferViews for bitstreams.
	 * @returns {boolean} `true` if the entry is available, `false` otherwise.
	 *
	 * @description
	 * ### How it works
	 *
	 * **Constant availability**
	 * ```
	 * { constant: 1 } → always available
	 * { constant: 0 } → never available
	 * ```
	 *
	 * **Bitstream availability**
	 * - Look up the bufferView referenced by `availability.bitstream`
	 * - Compute:
	 *   - `byteIndex = floor(index / 8)`
	 *   - `bitIndex = index % 8`
	 * - Read the byte from the binary chunk
	 * - Extract the bit using `(byte >> bitIndex) & 1`
	 *
	 * This function is intentionally low‑level and optimized for repeated calls
	 * during implicit‑tiling expansion.
	 */
	_checkAvailability( availability, index, binary, subtreeJson ) {

		if ( !availability ) return false;

		// Check for constant values (0 or 1)

		if ( availability.constant !== undefined ) {

			return availability.constant === 1;

		}

		// If no constant, we must check the bitstream

		if ( availability.bitstream !== undefined ) {

			const bufferViewIndex = availability.bitstream;
			const bv = subtreeJson.bufferViews[ bufferViewIndex ];

			// Offset into the binary body

			const byteOffset = ( bv.byteOffset || 0 );
			const bitIndex = index % 8;
			const byteIndex = Math.floor( index / 8 );

			const byte = binary.getUint8( byteOffset + byteIndex );

			return ( ( byte >> bitIndex ) & 1 ) === 1;

		}

		return false;

	}

	/**
	 * Resolves an availability descriptor from a subtree JSON into a random‑access
	 * availability structure used during implicit tiling expansion.
	 *
	 * Availability in 3D Tiles 1.1 can be expressed in two ways:
	 *
	 * 1. **Constant availability**
	 *    `{ constant: 0 | 1 }`
	 *    In this case, the function returns a Proxy that behaves like an infinite
	 *    array where any index access returns the constant value. This allows
	 *    callers to freely query `availability[index]` without bounds checks.
	 *
	 * 2. **Bitstream availability**
	 *    `{ bitstream: <byteOffset> }`
	 *    The function decodes the referenced bitstream from the subtree's binary
	 *    chunk and returns a dense array-like object of 0/1 values.
	 *
	 * If no availability information is present, a default `{ 0: 0 }` object is
	 * returned, meaning “not available”.
	 *
	 * @param {Object} subtreeJson - The parsed subtree JSON object. Required when resolving bitstreams.
	 * @param {Object} availability - The availability descriptor from the subtree JSON.
	 * @param {Uint8Array} binary - The raw binary chunk of the subtree file. Used when decoding bitstreams.
	 * @returns {Object|Proxy} Multiple return types.
	 *
	 * @description
	 *
	 * Implicit tiling requires fast, random‑access checks like:
	 * ```
	 * if (tileBits[index] === 1) { ... }
	 * ```
	 *
	 * This helper normalizes all availability formats into something that behaves
	 * like an array, regardless of whether the source data was a constant or a
	 * bitstream. The Proxy approach avoids allocating huge arrays for constant
	 * availability while still supporting arbitrary index access.
	 *
	 * ### Notes
	 * - Bitstream decoding is delegated to `_decodeBitstream`.
	 * - The returned object intentionally does **not** expose a real `length`
	 *   except in the constant case, where a large dummy value is provided to
	 *   satisfy code paths that iterate over availability.
	 */
	_getAvailability( subtreeJson, availability, binary ) {

		if ( !availability ) return { 0: 0 };

		// Handle Constant

		if ( availability.constant !== undefined ) {

			const value = availability.constant;

			// This trap catches 'tileBits[anyIndex]' and returns 0 or 1

			return new Proxy( {}, {

				get: ( target, prop ) => {

					if ( prop === 'length' ) return 1e6;
					return value;

				}

			});

		}

		// Handle Bitstream

		if ( subtreeJson && availability.bitstream !== undefined ) {

			return this._decodeBitstream( 

				subtreeJson,
				binary, 
				availability.bitstream 

			);

		}

		return { 0: 0 };

	}

	/**
	 * Parses a 3D Tiles 1.1 subtree binary buffer into its JSON and binary components.
	 *
	 * A subtree file (`.subtree`) contains:
	 *   - A 24‑byte header:
	 *       * magic: 4 bytes ("subt")
	 *       * version: uint32 (little‑endian)
	 *       * jsonByteLength: uint64 (little‑endian)
	 *       * binaryByteLength: uint64 (little‑endian)
	 *   - A JSON chunk of length `jsonByteLength`
	 *   - A binary chunk of length `binaryByteLength`
	 *
	 * This function extracts and decodes both chunks, returning:
	 *   - `subtreeJson`: the parsed JSON object
	 *   - `binary`: a Uint8Array view of the binary chunk
	 *   - `binaryView`: a DataView over the same binary chunk (for bitstream access)
	 *
	 * @param {ArrayBuffer} buffer - The raw subtree file data loaded from the network or filesystem.
	 * @returns {{ subtreeJson: Object, binary: Uint8Array, binaryView: DataView }} Parsed subtree components.
	 * @throws {Error} If the file does not begin with the expected `"subt"` magic header.
	 *
	 * @description
	 * ### What this parser does
	 *
	 * **1. Validates the subtree header**
	 * Ensures the file begins with `"subt"` and reads the version and chunk lengths.
	 * Uses `BigInt` for 64‑bit length fields to remain fully spec‑compliant.
	 *
	 * **2. Extracts the JSON chunk**
	 * Reads `jsonByteLength` bytes starting at offset 24, decodes them with
	 * `TextDecoder`, and parses the resulting JSON text.
	 *
	 * **3. Extracts the binary chunk**
	 * Immediately follows the JSON chunk. Returned both as a `Uint8Array` and a
	 * `DataView` so availability bitstreams can be read efficiently.
	 *
	 * ### Notes
	 * - This function does *not* interpret availability bitstreams; that is handled
	 *   by `_getAvailability` and `_checkAvailability`.
	 * - It is intentionally minimal and spec‑aligned, serving as the foundation for
	 *   implicit tiling expansion.
	 */
	_parseSubtree( buffer ) {

		const dv = new DataView( buffer );

		// Header (24 bytes total)

		const magic = String.fromCharCode( dv.getUint8( 0 ), dv.getUint8( 1 ), dv.getUint8( 2 ), dv.getUint8( 3 ) );

		if ( magic !== 'subt' ) throw new Error( 'Invalid subtree magic' );

		const version = dv.getUint32( 4, true );

		// 3D Tiles 1.1 uses 64-bit unsigned integers for lengths
		// Using BigInt for spec-compliance (or dv.getUint32(8, true) if files are small)

		const jsonByteLength = Number( dv.getBigUint64( 8, true ) );
		const binaryByteLength = Number( dv.getBigUint64( 16, true ) );

		// Extract JSON Chunk

		const jsonStart = 24; 
		const jsonUint8 = new Uint8Array( buffer, jsonStart, jsonByteLength );
		const jsonText = new TextDecoder().decode( jsonUint8 );

		// JSON.parse handles the space padding (0x20) automatically

		const subtreeJson = JSON.parse( jsonText );

		// Extract Binary Chunk
		// The binary chunk starts immediately after the JSON chunk

		const binaryStart = jsonStart + jsonByteLength;
		const binary = new Uint8Array( buffer, binaryStart, binaryByteLength );
		const binaryView = new DataView( buffer, binaryStart, binaryByteLength );

		return { subtreeJson, binary, binaryView };

	}

	/**
	 * Recursively flattens 3D Tiles v1.1 'contents' arrays into a synthetic child hierarchy.
	 * This ensures compatibility with OGC3DTile loaders that expect a single content per tile.
	 * ** Each additional content is injected as a child with a geometricError of 0 and 
	 *    an 'ADD' refinement to force simultaneous rendering with the parent tile.
	 *
	 * @async
	 * @param {Object} tile - The 3D Tile JSON object to process.
	 * @returns {Promise<void>}
	 */
	async _flattenExplicitContents( tile ) {

		// Handle Multiple Contents in the current tile

		if ( tile.contents && Array.isArray( tile.contents ) ) {

			// Inject as children

			if ( tile.contents.length > 1 ) {

				if ( !tile.children ) tile.children = [];

				for ( let i = 0; i < tile.contents.length; i++ ) {

					let tile_uri = tile.contents[ i ].uri;

					if ( tile_uri.startsWith( '/' ) ) {

						tile_uri = tile_uri.substring( 1 );

					}

					this._variantLookup.set( tile_uri, i );

					tile.children.push({

						content: tile.contents[ i ],
						boundingVolume: tile.boundingVolume,
						geometricError: 0, // Render simultaneously with parent
						refine: "ADD"

					});

				}

			}

			delete tile.contents; // Clean up to avoid confusion

		}

		// Recurse through existing explicit children

		if ( tile.children ) {

			for ( const child of tile.children ) {

				await this._flattenExplicitContents( child );

			}

		}

	}

	/**
	 * Resolves an implicit 3D Tiles tileset (using implicit tiling) into an explicit
	 * tileset structure that the Three3DTilesLoader can consume.
	 *
	 * This function:
	 *  - Will be limited by the selected Depth Level
	 *  - Determines the correct subtree for the current tile (based on level/x/y/z)
	 *  - Fetches and parses the subtree binary + JSON
	 *  - Reads availability bitstreams (tile/content/child-subtree)
	 *  - Recursively expands implicit tiles into explicit tile nodes
	 *  - Computes child bounding volumes and geometric errors
	 *  - Generates explicit content URIs using template replacement
	 *
	 * The result is a fully explicit `{ asset, root }` tileset object.
	 *
	 * @async
	 * @param {Object} json - The original tileset JSON.
	 * @param {string} path - The URL from which the tileset JSON was loaded.
	 * @param {number} [level=0] The current implicit tile level. Level 0 corresponds to the root tile.
	 * @param {number} [x=0] The implicit tile's X coordinate within its level.
	 * @param {number} [y=0] The implicit tile's Y coordinate within its level.
	 * @param {number} [z=0] The implicit tile's Z coordinate (only used for OCTREE subdivision).
	 * @returns {Promise<Object>} A promise resolving to an explicit tileset object:
	 *
	 * @description
	 * ### How it works
	 *
	 * **1. Detect implicit tiling**
	 * If the tileset does not use implicit tiling, the function returns the JSON unchanged.
	 *
	 * **2. Determine subtree root**
	 * Each subtree spans `subtreeLevels` implicit levels. The function computes the
	 * subtree root level and derives the subtree's (x, y, z) coordinates relative to it.
	 *
	 * **3. Fetch and parse the subtree**
	 * Loads the subtree binary, extracts:
	 *  - `tileAvailability`
	 *  - `contentAvailability`
	 *  - `childSubtreeAvailability`
	 *
	 * These availability bitstreams determine which tiles exist, which have content,
	 * and which spawn new subtrees.
	 *
	 * **4. Recursively build explicit nodes**
	 * For each tile inside the subtree:
	 *  - Compute its Morton index (2D for QUADTREE, 3D for OCTREE)
	 *  - Check tile availability
	 *  - Compute bounding volume subdivision
	 *  - Compute geometric error reduction
	 *  - Generate content URI if available
	 *
	 * **5. Handle subtree boundaries**
	 * When reaching the last level of a subtree, the function checks
	 * `childSubtreeAvailability` and recursively loads the next subtree if present.
	 *
	 * This continues until all reachable implicit tiles are expanded.
	 *
	 * ### Notes
	 * - This function is the core of implicit → explicit conversion.
	 * - It ensures compatibility with loaders that only support explicit tilesets.
	 * - It preserves all geometric error and bounding volume semantics defined by the
	 *   implicit tiling specification.
	 */
	async _resolveImplicit( json, rootPath, level = 0, x = 0, y = 0, z = 0 ) {

		const root = json.root;
		const implicit = root?.implicitTiling || json.implicitTiling;
		if ( !implicit ) return json;

		const isQuadtree = implicit.subdivisionScheme === "QUADTREE";
		const childCount = isQuadtree ? 4 : 8;
		const subtreeLevels = implicit.subtreeLevels;

		// 1. Resolve Subtree URL and Fetch

		const subtreeRootLevel = Math.floor( level / subtreeLevels ) * subtreeLevels;

		const subtreeUrl = rootPath + this._replaceTemplate(

			implicit.subtrees.uri,
			subtreeRootLevel,
			x >> ( level - subtreeRootLevel ),
			y >> ( level - subtreeRootLevel ),
			isQuadtree ? 0 : z >> ( level - subtreeRootLevel )

		);

		const buffer = await fetch( subtreeUrl ).then( r => r.arrayBuffer() );
		const { subtreeJson, binary, binaryView } = this._parseSubtree( buffer );

		// 2. Map ALL content availability layers (v1.1 support)

		const tileBits = this._getAvailability( subtreeJson, subtreeJson.tileAvailability, binary );

		const contentBitLayers = subtreeJson.contentAvailability.map( avail => 

			this._getAvailability( subtreeJson, avail, binary )

		);

		// Identify content templates (plural for 1.1, fallback to singular for 1.0)

		const contentTemplates = root.contents || ( root.content ? [ root.content ] : [] );

		const buildNode = async ( lvl, cx, cy, cz ) => {

			// This stops building children if we have reached 1 level deeper than the start level

			const currentDepthRelativeToStart = lvl - level;
			const maxAllowedDepth = this._maxDepthLevel;

			const index = this._computeMortonIndex( lvl, cx, cy, cz || 0, subtreeRootLevel, isQuadtree );

			// Tile existence check

			if ( tileBits[ index ] !== 1 ) return null;

			// 3. Process Multiple Contents

			const validContents = [];

			contentTemplates.forEach( ( template, layerIdx ) => {

				const layerBits = contentBitLayers[ layerIdx ];

				if ( layerBits && layerBits[ index ] === 1 ) {

					// Apply template to get the actual URI

					const template_uri = this._replaceTemplate( template.uri, lvl, cx, cy, isQuadtree ? 0 : cz );

					const uri = rootPath + template_uri;

					// Map metadata or variant info if needed for lookup

					if ( template_uri.startsWith( '/' ) ) {

						template_uri = template_uri.substring( 1 );

					}

					this._variantLookup.set( template_uri, layerIdx );

					validContents.push( { uri: uri } );

				}

			});

			const node = {

				boundingVolume: this._computeChildBoundingVolume( root.boundingVolume, cx, cy, cz, isQuadtree ),
				geometricError: root.geometricError / Math.pow( 2, lvl ),
				refine: root.refine || "REPLACE",
				children: []

			};

			// 4. Flattening logic for OGC3DTile compatibility

			if ( validContents.length > 0 ) {

				// Standard slot for the first content

				node.content = validContents[ 0 ];

				// Any additional contents are added as synthetic children
				// These children have 0 geometric error so they load / render at the same time as the parent

				if ( validContents.length > 1 ) {

					for ( let i = 1; i < validContents.length; i++ ) {

						node.children.push({

							content: validContents[ i ],
							boundingVolume: node.boundingVolume, // Inherit same volume
							geometricError: 0,                   // Force immediate load
							refine: "ADD"                        // Additive refinement

						});

					}

				}

			}

			// 5. Handle Subtree Traversal

			const isSubtreeLeaf = ( lvl + 1 ) % subtreeLevels === 0;
			const nextLevel = lvl + 1;

			if ( nextLevel < implicit.availableLevels && currentDepthRelativeToStart < maxAllowedDepth ) {

				for ( let i = 0; i < childCount; i++ ) {

					const [ dx, dy, dz ] = isQuadtree ? this._decodeMorton2D( i ) : this._decodeMorton3D( i );

					const nx = cx * 2 + dx;
					const ny = cy * 2 + dy;
					const nz = isQuadtree ? 0 : cz * 2 + dz;

					if ( isSubtreeLeaf ) {

						const relativeLevel = nextLevel - subtreeRootLevel;
						const mask = ( 1 << relativeLevel ) - 1;

						const leafIndex = isQuadtree 
							? this._morton2D( nx & mask, ny & mask ) 
							: this._morton3D( nx & mask, ny & mask, nz & mask );

						if ( this._checkAvailability( subtreeJson.childSubtreeAvailability, leafIndex, binaryView, subtreeJson ) ) {

							const nextSubtree = await this._resolveImplicit( json, rootPath, nextLevel, nx, ny, nz );
							node.children.push( nextSubtree.root );

						}

					} else {

						const child = await buildNode( nextLevel, nx, ny, nz );
						if ( child ) node.children.push( child );

					}

				}

			}

			return node;

		};

		const rootNode = await buildNode( level, x, y, z );

		return { asset: json.asset, root: rootNode };

	}

	/**
	 * Three.js-style callback API.
	 * @param { string } url
	 * @param { ( group: Object3D ) => void } [ onLoad ]
	 * @param { ( event: ProgressEvent<EventTarget> ) => void } [ onProgress ]
	 * @param { ( error: any ) => void } [ onError ]
	 */
	load( url, onLoad, onProgress, onError ) {

		// Non-async wrapper around loadAsync

		this.loadAsync( url )
			.then( group => {

				if ( onLoad ) onLoad( group );
				return group;

			} )
			.catch( err => {

				if ( onError ) onError( err );
				else console.error( err );
				return null;

			});

	}

	/**
	 * Promise-based API.
	 * @param { string } url
	 * @returns { Object3D }
	 */
	async loadAsync( url ) {

		const scope = this;
		scope._rootUrl = url;
		const rootPath = url.substring( 0, url.lastIndexOf( '/' ) + 1 );

		const urlObj = new URL( url );

		const params = urlObj.searchParams;

		// Check if this is a "Lazy" sub-call

		const level = parseInt( params.get( 'level' ) ) || 0;
		const x = parseInt( params.get( 'x' ) ) || 0;
		const y = parseInt( params.get( 'y' ) ) || 0;
		const z = parseInt( params.get( 'z' ) ) || 0;

		try {

			if ( !scope._renderer ) scope._renderer = new WebGLRenderer( { antialias: false } );
			scope._ktx2Loader.detectSupport( scope._renderer );

			let json = await fetch( url ).then( r => r.json() );

			const json_transform = json.root.transform;

			const tilesetVersion = json.asset?.version || null;
			const isImplicit = json.root.implicitTiling !== undefined;

			// Check if the root or any child has multiple contents to set a global flag

			const hasMultiExplicit = json.root.contents?.length > 1;
			const hasMultiImplicit = isImplicit && 
				json.root.implicitTiling.contentAvailability?.length > 1;

			const hasMulti = hasMultiExplicit || hasMultiImplicit;

			// Resolve Implicit Tiling first (last param after 'z' is userMaxDepth = Infinity)
			if ( isImplicit ) json = await scope._resolveImplicit( json, rootPath, level, x, y, z );

			// Resolve Multiple Contents to make it OGC3DTile compatible
			if ( json.root.contents ) await scope._flattenExplicitContents( json.root );

			const ogc3DTile = await new Promise( resolve => {

				const tileset = new OGC3D.OGC3DTile({

					url: url,
					json: json,
					centerModel: false,
					rootPath: rootPath,
					displayErrors: true,
					loadOutsideView: true,
					drawBoundingVolume: true,
					renderer: scope._renderer,
					geometricErrorMultiplier: 0.5,
					ktx2Loader: scope._ktx2Loader,
					dracoLoader: scope._dracoLoader,
					maxCacheSize: scope._maxCacheSize,
					loadingStrategy: isImplicit ? "IMMEDIATE" : "PERLEVEL",
					queryParams: scope._keyAPI !== '' ? { key: scope._keyAPI } : undefined,
					headers: scope._token ? { Authorization: `Bearer ${ scope._token }` } : undefined,
					meshCallback: mesh => { mesh.material.wireframe = this._wireframeMode || false; },
					pointsCallback: points => { points.material.size = this._pointTargetSize || 1.0; },
					onLoadCallback: tileset => resolve( tileset )

				});

			});

			ogc3DTile.tilesetVersion = tilesetVersion;

			const obv = ogc3DTile.boundingVolume;

			// 1. Extract the components from the matrix

			const matrix = new Matrix4().fromArray( ogc3DTile.matrix.elements );
			const position = new Vector3();
			const quat = new Quaternion();
			const scale = new Vector3();

			matrix.decompose( position, quat, scale );

			const zToYMatrix = ogc3DTile.tileLoader.zUpToYUpMatrix;
			const isIdentity = ( quat.x === 0 && quat.y === 0 && quat.z === 0 && quat.w === 1 );

			const isRegion = !!obv.region;

			const obvCenter = ( isRegion && !!json_transform )
				? new Vector3( json_transform[ 12 ], json_transform[ 13 ], json_transform[ 14 ] )
				: new Vector3( obv.center.x, obv.center.y, obv.center.z );

			const upVec = obvCenter.clone().normalize();
			const worldUp = new Vector3( 0, 1, 0 );

			const earthTiltAngle = upVec.angleTo( worldUp );

			const isECEF = obvCenter.length() > 1000000;
			ogc3DTile.isECEF = isECEF;

			let correction;

			if ( isECEF && MathUtils.radToDeg( earthTiltAngle ) > 0.1 ) {

				const alignQuat = new Quaternion().setFromUnitVectors( upVec, worldUp );
				ogc3DTile.quaternion.copy( alignQuat );

				// Calculate where the center is after rotation

				const rotatedCenter = obvCenter.clone().applyQuaternion( alignQuat );

				// Move the tile back to the origin based on that rotated center

				ogc3DTile.position.copy( rotatedCenter ).multiplyScalar( -1 );

			} else if ( !isECEF && !isIdentity ) {

				correction = new Matrix4().makeRotationX( MathUtils.degToRad( -90 ) );
				ogc3DTile.quaternion.setFromRotationMatrix( correction );

			}

			// Convert OBV → Box3

			const box = scope._computeBox3FromBoundingVolume( obv );

			// Apply correction to the box as well

			if ( isECEF && MathUtils.radToDeg( earthTiltAngle ) > 0.1 ) {

				const rotationMatrix = new Matrix4().makeRotationFromQuaternion( ogc3DTile.quaternion );
				box.applyMatrix4( rotationMatrix );

			} else if ( !isECEF && !isIdentity ) {

				if ( correction ) box.applyMatrix4( correction );

			} else if ( tilesetVersion === '1.0' ) {

				box.applyMatrix4( zToYMatrix );

			}

			// --- Normalize non-uniform scale back to ( 1, 1, 1 ) ---

			const hasNonUnitScale =
				ogc3DTile.scale.x !== 1 ||
				ogc3DTile.scale.y !== 1 ||
				ogc3DTile.scale.z !== 1;

			if ( hasNonUnitScale ) {

				ogc3DTile.scale.set( 1, 1, 1 );

			}

			// Center the tileset

			const center = box.getCenter( new Vector3() ).clone();

			// Position the tileset so the model is at ( 0, 0, 0 )

			ogc3DTile.position.copy( center ).multiplyScalar( -1 );

			// Shift the bounding box so it stays aligned with the moved tile

			box.translate( center.multiplyScalar( -1 ) );

			// Store it for later

			ogc3DTile.boundingBox = box;

			if ( hasMulti ) {

				// Flag for the viewer.
				// Currently all contents will be visible so have the viewer set correct visibility.
				// The viewer can traverse children and set visibility by using userData.variantLookup

				ogc3DTile.userData.rootPath = rootPath;
				ogc3DTile.userData.hasMultipleContents = true;
				ogc3DTile.userData.variantLookup = this._variantLookup;

			}

			/**
			 * Internal state for wireframe rendering.
			 * @type { boolean }
			 * @private
			 */
			ogc3DTile._wireframeMode = false;

			/**
			 * Sets the wireframe state for all current and future LOD tiles.
			 * @param { boolean } enabled - Whether to enable wireframe rendering.
			 * @memberof OGC3DTile
			 */
			ogc3DTile.setWireframe = ( enabled ) => {

				// The override update function will pass this value

				ogc3DTile._wireframeMode = !!enabled;

			};

			/**
			 * Internal point size for point clouds rendering.
			 * @type { float }
			 * @private
			 */
			ogc3DTile._pointTargetSize = 1.0;

			/**
			 * Sets the material point size for points models.
			 * @param { float } size - Sets point size for rendering.
			 * @memberof OGC3DTile
			 */
			ogc3DTile.setPointSize = ( size ) => {

				// The override update function will pass this value

				ogc3DTile._pointTargetSize = size;

			};

			/**
			 * Traverses the tileset hierarchy to synchronize materials 
			 * with the current wireframe state and point size.
			 * This is called automatically after LOD updates.
			 * @private
			 * @memberof OGC3DTile
			 */
			ogc3DTile._syncMaterials = () => {

				ogc3DTile.traverse( ( child ) => {

					if ( child.isMesh ) {

						const mats = Array.isArray( child.material ) ? child.material : [ child.material ];

						mats.forEach( m => {

							if ( m && m.wireframe !== ogc3DTile._wireframeMode ) {

								m.wireframe = ogc3DTile._wireframeMode;

							}

						});

					} else if ( child.isPoints && child.material ) {

						if ( child.material.size !== ogc3DTile._pointTargetSize ) {

							child.material.size = ogc3DTile._pointTargetSize;
							child.material.needsUpdate = true;

						}

					}

				});

			};

			const originalUpdate = ogc3DTile.update.bind( ogc3DTile );

			/**
			 * Overrides the standard OGC3DTile update to ensure material states 
			 * are persisted across Level of Detail (LOD) swaps.
			 * @param { import( 'three' ).Camera } camera
			 * @override
			 */
			ogc3DTile.update = function( camera ) {

				// Run the library's original LOD logic

				originalUpdate( camera );

				// Immediately force our wireframe or point size state on any newly swapped tiles

				this._syncMaterials();

			};

			/**
			 * Automatically positions and points the camera to fit the tileset.
			 * @param { import( 'three' ).PerspectiveCamera } camera 
			 * @memberof OGC3DTile
			 */
			ogc3DTile.frameCamera = function( camera ) {

				// Force the tileset to update its matrices so we get current world positions

				ogc3DTile.updateMatrixWorld( true );

				// Use the pre-calculated local bounding box

				const localBox = ogc3DTile.boundingBox;
				const size = localBox.getSize( new Vector3() );
				const center = localBox.getCenter( new Vector3() );

				const fov = MathUtils.degToRad( camera.fov );

				// Calculate distance based on the largest dimension to ensure it fits

				const maxDim = Math.max( size.x, size.y, size.z );
				const distance = maxDim + ( maxDim / 2.0 ) / Math.tan( fov / 2.0 );

				// Position camera looking at the center (which is 0,0,0 now)

				camera.position.set( center.x, center.y, center.z + distance );
				camera.lookAt( center );
				camera.updateProjectionMatrix();

			};

			/**
			 * Cleans up stale tile registration entries in the TileLoader.
			 *
			 * The OGC TileLoader keeps a `register` map of tileIdentifier → callback
			 * for tiles that are scheduled or in-flight. After a tile finishes loading,
			 * the loader sets the callback to `null` but does not remove the entry.
			 *
			 * This results in "zombie" registrations that incorrectly signal that the
			 * loader is still busy. Since a tile is guaranteed to be present in the
			 * cache once fully processed, this function removes any register entries
			 * whose keys already exist in the cache.
			 *
			 * @param {Object} loader - The internal tileLoader instance.
			 * @private
			 */
			ogc3DTile._cleanupRegister = ( loader ) => {

				for ( const key in loader.register ) {

					const entry = loader.register[ key ];

					/**
					 * We clean up if:
					 * 1. The entry is null (loader marked it finished).
					 * 2. The entry is an empty object (no active callbacks).
					 * 3. The tile is already in the cache (fallback safety).
					 */

					const isFinished = entry === null || Object.keys( entry ).length === 0;
					const isCached = !!loader.cache.get( key );

					if ( isFinished || isCached ) {

						delete loader.register[ key ];

					}

				}

			};

			/**
			 * Reports the current streaming/loading state of the internal TileLoader.
			 *
			 * This method inspects several internal loader signals to determine whether
			 * the tileset is actively streaming content. A tileset is considered "loading"
			 * if any of the following conditions are true:
			 *
			 *  - One or more network downloads are currently in flight
			 *    (tracked via the global `concurrentDownloads` counter).
			 *
			 *  - The TileLoader still holds active registration entries for tiles that
			 *    have not yet completed their load callbacks.
			 *
			 *  - The TileLoader has scheduled downloads waiting to be processed
			 *    (`downloads` or `ready` queues are non‑empty).
			 *
			 * Additionally, this method performs a cleanup pass to remove stale
			 * registration entries left behind by the upstream loader. Once a tile is
			 * fully cached, its registration entry is no longer meaningful and is removed
			 * to prevent false "still loading" signals.
			 *
			 * @returns {boolean} True if the tileset is actively streaming or processing
			 *                    tile content; false when fully idle.
			 */
			ogc3DTile.getStreamingInfo = () => {

				const loader = ogc3DTile.tileLoader;

				const hasActiveDownloads = ( window.concurrentDownloads ?? 0 ) > 0;

				const hasPendingRegistrations =
					Object.values( loader.register ).some( entry => Object.keys( entry ).length > 0 );

				const hasScheduledDownloads =
					loader.downloads.length > 0 || loader.ready.length > 0;

				if ( !hasScheduledDownloads ) ogc3DTile._cleanupRegister( loader );

				return hasActiveDownloads || hasPendingRegistrations || hasScheduledDownloads;

			};

			const originalLibraryDispose = ogc3DTile.dispose.bind( ogc3DTile );

			/**
			 * Custom dispose that cleans up Three.js resources AND the OGC library state.
			 */
			ogc3DTile.dispose = function() {

				// Remove from scene

				if ( ogc3DTile.parent ) {

					ogc3DTile.parent.remove( ogc3DTile );

				}

				// Deep traverse to free GPU resources

				ogc3DTile.traverse( ( child ) => {

					if ( child.isMesh || child.isPoints || child.isLine ) {

						if ( child.geometry ) {

							child.geometry.dispose();
							child.geometry = null;

						}

						if ( child.material ) {

							const materials = Array.isArray( child.material ) ? child.material : [ child.material ];

							materials.forEach( m => {

								// Dispose all textures in the material

								for ( const key in m ) {

									if ( m[ key ] && m[ key ].isTexture ) {

										m[ key ].dispose();
										m[ key ] = null;

									}

								}

								m.dispose();

							});

							child.material = null;

						}

					}

				});

				// Call the library's original cleanup (clears internal cache/workers)

				if ( typeof originalLibraryDispose === 'function' ) {

					originalLibraryDispose();

				}

				console.log( 'OGC3DTileset and GPU resources disposed.' );

				return true;

			};

			const copyright_info = OGC3D.getOGC3DTilesCopyrightInfo();

			if ( copyright_info.length > 0 ) {

				ogc3DTile.copyrightVisible = true;
				ogc3DTile.displayCopyright = true;
				ogc3DTile.showCopyright();

			}

			// This seems to be needed for IMMEDIATE strategy and v1.1 model with transform

			if ( !!json_transform && tilesetVersion === '1.1' && ogc3DTile.loadingStrategy === 'IMMEDIATE' ) {

				ogc3DTile.translateX( ogc3DTile.position.x * ( - 1 ) );
				ogc3DTile.translateY( ogc3DTile.position.y * ( - 1 ) );
				ogc3DTile.translateZ( ogc3DTile.position.z * ( - 1 ) );

				ogc3DTile.position.set( 0, 0, 0 );

			}

			return ogc3DTile;

		} catch ( err ) {

			console.error( err );
			throw err;

		}

	}

}

export { Three3DTilesLoader };
