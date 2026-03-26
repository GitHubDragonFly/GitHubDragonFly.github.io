import { Box3, Loader, MathUtils, Matrix4, PerspectiveCamera, Quaternion, Sphere, Vector3, WebGLRenderer } from 'three';
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.min.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.min.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.min.js";
import * as ThreeDTilesRenderer from 'https://cdn.jsdelivr.net/npm/3d-tiles-renderer@0.4.23/build/index.three.min.js';
import * as ThreeDTilesPlugins from 'https://cdn.jsdelivr.net/npm/3d-tiles-renderer@0.4.23/build/index.three-plugins.min.js';

/**
 * A loader for 3D Tilesets - normally loaded via tileset.json URL link.
 *
 * Created with assistance from Microsoft Copilot and Google Gemini
 *
 * Internally using 3d-tiles-renderer loader from https://github.com/NASA-AMMOS/3DTilesRendererJS
 *
 * ```js
 * const loader = new Three3DTilesLoader();
 *
 * loader.setCamera( camera );
 * loader.setControls( controls );
 * loader.setRenderer( renderer );
 *
 * const tileset_object = await loader.loadAsync( 'path_to/tileset.json' );
 * scene.add( tileset_object );
 * ```
 *
 * In your render loop, check whether tiles are still being loaded to pace any other events,
 * like for example forcing transform updates to center the whole tileset on the screen:
 *  const isLoading = tileset_obj.tilesRenderer.isLoading;
 *
 * For continuous updates, you will have to add the following to your render loop:
 *  tileset_obj.tilesRenderer.update();
 *
 * Dynamically change mesh material wireframe with some predefined boolean variable, like 'enabled':
 *  tileset_object.setWireframe( enabled );
 *
 * Dynamically change point size for loaded point clouds, with some predefined float variable, like 'size'.
 * Valid values range from [0.001, 10.0] for fine and coarse tuning.
 * Value can also be entered directly, instead of using a variable:
 *  tileset_object.setPointSize( size );
 *
 * Dispose of the tileset_object to free resources:
 *  if ( tileset_object.dispose ) tileset_object.dispose();
 *
 * @augments Loader
 * @three_import import { Three3DTilesLoader } from "path_to/3DTilesLoader2.js"
 */
class Three3DTilesLoader extends Loader {

	/**
	 * @param { import( 'three' ).LoadingManager } [ manager ]
	 */
	constructor( manager ) {

		super( manager );

		this._rootUrl = '';
		this._token = '';
		this._assetId = '1';

		this._maxDepthLevel = 4;
		this._maxCacheSize = 100;
		this._materialSide = -1;
		this._errorTarget = 5;

		this._variantLookup = new Map();
		this._metadataLookup = [];

		this._v1 = new Vector3();
		this._corner = new Vector3();
		this._R = 6378137; // WGS84 Semi-major axis

		this._camera = null;
		this._controls = null;
		this._renderer = null;

		this._dracoLoader = new DRACOLoader( manager );
		this._dracoLoader.setDecoderPath( "https://cdn.jsdelivr.net/npm/three@0.183.2/examples/jsm/libs/draco/" );
		this._dracoLoader.setDecoderConfig( { type: 'js' } );
		this._dracoLoader.preload();

		this._ktx2Loader = new KTX2Loader( manager );
		this._ktx2Loader.setTranscoderPath( "https://cdn.jsdelivr.net/npm/three@0.183.2/examples/jsm/libs/basis/" );

		this._gltfLoader = new GLTFLoader( manager );
		this._gltfLoader.setDRACOLoader( this._dracoLoader );
		this._gltfLoader.setMeshoptDecoder( MeshoptDecoder );

		this._gltfLoader.register( ( parser ) => new ThreeDTilesPlugins.GLTFMeshFeaturesExtension( parser ) );
		this._gltfLoader.register( ( parser ) => new ThreeDTilesPlugins.GLTFStructuralMetadataExtension( parser ) );

	}

	/**
	 * Passes camera instance.
	 * @param { import( 'three' ).Camera } camera
	 */
	setCamera( camera ) {

		this._camera = camera;
		return this;

	}

	/**
	 * Passes controls instance.
	 * @param { import( 'three' ).OrbitControls } controls
	 */
	setControls( controls ) {

		this._controls = controls;
		return this;

	}

	/**
	 * Passes renderer instance.
	 * @param { import( 'three' ).WebGLRenderer } renderer
	 */
	setRenderer( renderer ) {

		this._renderer = renderer;
		this._ktx2Loader.detectSupport( renderer );
		return this;

	}

	/**
	 * Sets the token required for some data providers.
	 * @param { string } token
	 */
	setToken( token ) {

		this._token = token.toString();
		return this;

	}

	/**
	 * Sets asset id to use with the token required for some data providers.
	 * @param { string } assetId
	 */
	setAssetID( assetId ) {

		this._assetId = assetId.toString();
		return this;

	}

	/**
	 * Sets the error target for tiles renderer.
	 * Clamped between 0.1 and 20.
	 * @param { number } target
	 */
	setErrorTarget( target ) {

		this._errorTarget = Math.max( 0.1, Math.min( 20.0, target ) );
		return this;

	}

	/**
	 * Sets the material side for meshes.
	 * Front = 0, Back = 1, Double = 2.
	 * @param { number } side
	 */
	setMaterialSide( side ) {

		this._materialSide = Math.max( 0, Math.min( 2, side ) );
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

				this._corner.addScaledVector( this._v1.set( b[ 3 ], b[ 4 ], b[ 5 ] ), ( i & 1 ) ? 1 : - 1 );   // ux
				this._corner.addScaledVector( this._v1.set( b[ 6 ], b[ 7 ], b[ 8 ] ), ( i & 2 ) ? 1 : - 1 );   // uy
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
						const z = ( this._R + alt ) * Math.sin( lat ); // is this y or z
						const y = ( this._R + alt ) * cosLat * Math.sin( lon ); // is this z or y

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
	 * Collapses bits by removing the one-bit gap between them.
	 * Reverse of _interleaveBits2D. Works for coordinates up to 16 bits.
	 * @param {number} n - The interleaved bit pattern.
	 * @returns {number} The original coordinate component.
	 */
	_deinterleaveBits2D( n ) { // QUADTREE

		n &= 0x55555555;
		n = ( n | ( n >> 1 ) ) & 0x33333333;
		n = ( n | ( n >> 2 ) ) & 0x0F0F0F0F;
		n = ( n | ( n >> 4 ) ) & 0x00FF00FF;
		n = ( n | ( n >> 8 ) ) & 0x0000FFFF;

		return n;

	}

	/**
	 * Decodes a large 2D Morton index back into its constituent [x, y, 0] coordinates.
	 * Use this instead of _decodeMorton2D if the index exceeds the range of 0-3.
	 * @param {number} index - The 2D Morton index.
	 * @returns {number[]} Array containing [x, y, 0].
	 */
	_decodeFullMorton2D( index ) { // QUADTREE

		return [
			this._deinterleaveBits2D( index ),      // x
			this._deinterleaveBits2D( index >> 1 ), // y
			0                                       // z
		];

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
			.replace( /\{level\}/g, level)
			.replace( /\{x\}/g, x )
			.replace( /\{y\}/g, y)
			.replace( /\{z\}/g, z );

		// 2. Ensure no leading slash so it matches the variantLookup keys

		if ( result.startsWith( '/' ) ) {

			result = result.substring( 1 );

		} else if ( result.startsWith( './' ) ) {

			result = result.substring( 2 );

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
			south + dy * halfLat,                              // new south
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
			if ( !bv ) return false;

			// Offset into the binary body

			const byteOffset = ( bv.byteOffset || 0 );
			const bitIndex = index % 8;
			const byteIndex = Math.floor( index / 8 );

			// Use DataView for safety, or direct array access if it's a TypedArray

			const byte = ( binary instanceof DataView )
				? binary.getUint8( byteOffset + byteIndex )
				: binary[ byteOffset + byteIndex ];

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

			// This trap catches 'tileBits[ anyIndex ]' and returns 0 or 1

			return new Proxy( {}, {

				get: ( target, prop ) => {

					if ( prop === 'length' ) return 1e6;
					return value;

				}

			});

			/*
			 The following would instead allow for the bracket syntax bits[ index ]
			 to work but also provide a fallback for direct access:

			 return {
				isConstant: true,
				value: value,
				[Symbol.iterator]: function* () { while( true ) yield value; }
			 };
			*/
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
	 * Calculates the stride (total byte length) of a property based on its type and component type.
	 * 
	 * @param {string} type - The element type (e.g., 'SCALAR', 'VEC3', 'MAT4').
	 * @param {string} componentType - The data type of individual components (e.g., 'FLOAT32', 'UINT16').
	 * @returns {number} The total number of bytes for one instance of the type.
	 */
	_getStride( type, componentType ) {

		const typeMap = { 'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT2': 4, 'MAT3': 9, 'MAT4': 16 };

		const componentMap = { 

			'INT8': 1, 'UINT8': 1, 
			'INT16': 2, 'UINT16': 2, 
			'INT32': 4, 'UINT32': 4, 
			'INT64': 8, 'UINT64': 8, 
			'FLOAT32': 4, 'FLOAT64': 8 

		};

		const numComponents = typeMap[ type ] || 1;
		const bytesPerComponent = componentMap[ componentType ] || 1;

		return numComponents * bytesPerComponent;

	}

	/**
	 * Returns the size in bytes for a given component type.
	 * 
	 * @param {string} componentType - The component type string (e.g., 'INT8', 'FLOAT64').
	 * @returns {number} The size in bytes, or 0 if the type is unrecognized.
	 */
	_getComponentSize( componentType ) {

		const sizes = { 'INT8': 1, 'UINT8': 1, 'INT16': 2, 'UINT16': 2, 'INT32': 4, 'UINT32': 4, 'FLOAT32': 4, 'FLOAT64': 8, 'INT64': 8, 'UINT64': 8 };
		return sizes[ componentType ] || 0;

	}

	/**
	 * Reads a value (or array of values) from a binary buffer based on the 3D Tiles metadata spec.
	 * Uses DataView relative to the binary's byteOffset to ensure correct alignment within the subtree.
	 *
	 * @param {Uint8Array} binary - The binary chunk from the .subtree file (sliced to start after JSON).
	 * @param {number} offset - The byte offset within the binary chunk.
	 * @param {string} type - The element type (e.g., 'SCALAR', 'VEC3', 'MAT4').
	 * @param {string} componentType - The component data type (e.g., 'FLOAT32', 'UINT32').
	 * @param {number} rowIndex - Required for BOOLEAN bitstream calculation.
	 * @returns {number|BigInt|Array|null} A single value for SCALAR, or an array for VEC/MAT.
	 */
	_readBinaryValue( binary, offset, type, componentType, rowIndex = 0 ) {

		const view = new DataView( binary.buffer, binary.byteOffset, binary.byteLength );

		// Handle BOOLEAN (Bitstream Logic)
		// Booleans are packed 8 to a byte. 

		if ( type === 'BOOLEAN' ) {

			const byteOffset = offset + Math.floor( rowIndex / 8 );
			const bitIndex = rowIndex % 8;
			const byte = view.getUint8( byteOffset );

			return ( ( byte >> bitIndex ) & 1 ) === 1;

		}

		const typeMap = { 'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT2': 4, 'MAT3': 9, 'MAT4': 16 };
		const componentSize = this._getComponentSize( componentType );
		const numComponents = typeMap[ type ] || 1;

		const results = [];

		for ( let i = 0; i < numComponents; i++ ) {

			const currentOffset = offset + ( i * componentSize );
			let val;

			switch ( componentType ) {
				case 'INT8':   val = view.getInt8( currentOffset ); break;
				case 'UINT8':  val = view.getUint8( currentOffset ); break;
				case 'INT16':  val = view.getInt16( currentOffset, true ); break;
				case 'UINT16': val = view.getUint16( currentOffset, true ); break;
				case 'INT32':  val = view.getInt32( currentOffset, true ); break;
				case 'UINT32': val = view.getUint32( currentOffset, true ); break;
				case 'FLOAT32': val = view.getFloat32( currentOffset, true ); break;
				case 'FLOAT64': val = view.getFloat64( currentOffset, true ); break;
				case 'INT64':   val = view.getBigInt64( currentOffset, true ); break;
				case 'UINT64':  val = view.getBigUint64( currentOffset, true ); break;
				default: val = null;
			}

			results.push( val );

		}

		// Return a single value for SCALAR, or an array for VEC/MAT

		return type === 'SCALAR' ? results[ 0 ] : results;

	}

	/**
	 * Extracts metadata for a specific tile or content from a v1.1 Property Table.
	 * Maps the property definitions from the Schema against the binary data in the Subtree.
	 *
	 * @param {number} tableIndex - The index of the property table within subtreeJson.propertyTables.
	 * @param {number} rowIndex - The specific row to read (e.g., mortonIndex * numContents + layerIdx).
	 * @param {Object} subtreeJson - The parsed JSON descriptor of the subtree.
	 * @param {Uint8Array} binary - The binary chunk of the subtree.
	 * @param {Object} schema - The 3D Tileset schema containing class and property definitions.
	 * @returns {Object|null} The extracted properties mapped by name, or null if schema/table is missing.
	 */
	_extractPropertyTableMetadata( tableIndex, rowIndex, subtreeJson, binary, schema ) {

		const table = ( typeof tableIndex === 'string' )
			? subtreeJson[ tableIndex ] // e.g., if you pass 'subtreeMetadata'
			: subtreeJson.propertyTables?.[ tableIndex ];

		if ( !table || !schema ) return null;

		// Get the class definition from the schema

		const classDef = schema.classes[ table.class ];
		if ( !classDef ) return null;

		const metadata = {
			class: table.class,
			properties: {}
		};

		for ( const [ propName, propDef ] of Object.entries( table.properties ) ) {

			// Look up the actual data types from the schema

			const schemaProp = classDef.properties[ propName ];

			// --- Handle JSON Literals (Constants) ---
			// If the property is just a value in the JSON, not a buffer reference

			if ( typeof propDef !== 'object' || propDef.values === undefined || Array.isArray( propDef ) ) {

				metadata.properties[ propName ] = propDef; 
				continue;

			}

			const type = schemaProp.type; // e.g., "SCALAR"
			const componentType = schemaProp.componentType; // e.g., "UINT32"

			const bufferViewIdx = propDef.values;
			const view = subtreeJson.bufferViews?.[ bufferViewIdx ];

			if ( type === 'BOOLEAN' ) {

				// For BOOLEAN, the 'stride' logic doesn't apply the same way.
				// We pass the base byteOffset of the bufferView and the rowIndex.

				metadata.properties[ propName ] = this._readBinaryValue( binary, view.byteOffset, type, null, rowIndex );

			} else if ( propDef.arrayOffsets !== undefined ) {

				// VARIABLE-LENGTH LOGIC (Strings and Numeric Arrays)

				const offsetViewIdx = propDef.arrayOffsets;
				const offsetBufferView = subtreeJson.bufferViews[ offsetViewIdx ];

				// 1. Get the start and end offsets for this specific row from the offsets buffer
				// Note: offsets are usually UINT32 or UINT64

				const offsetType = propDef.offsetComponentType || 'UINT32';
				const offsetSize = this._getComponentSize( offsetType );

				const startByte = Number( this._readBinaryValue( binary, offsetBufferView.byteOffset + ( rowIndex * offsetSize ), 'SCALAR', offsetType ) );
				const endByte = Number( this._readBinaryValue( binary, offsetBufferView.byteOffset + ( ( rowIndex + 1 ) * offsetSize ), 'SCALAR', offsetType ) );

				// 2. Slice the actual data buffer using these offsets

				const dataSlice = binary.slice( view.byteOffset + startByte, view.byteOffset + endByte );

				// 3. Decode based on Type (Assuming UTF-8 for strings)

				if ( type === 'STRING' ) {

					metadata.properties[ propName ] = new TextDecoder().decode( dataSlice );

				} else {

					// It's a Variable-Length Array of Numbers (e.g., SCALAR, VEC3)

					const elementStride = this._getStride( type, componentType );
					const numElements = ( endOffset - startOffset ) / elementStride;
					const arrayResult = [];

					for ( let i = 0; i < numElements; i++ ) {

						const elementByteOffset = i * elementStride; 

						// We use a temporary DataView/Uint8Array for the slice to read internal values

						arrayResult.push( this._readBinaryValue( dataSlice, elementByteOffset, type, componentType ) );

					}

					metadata.properties[ propName ] = arrayResult;

				}

			} else {

				// FIXED-WIDTH LOGIC (SCALAR, VEC, etc.)

				const stride = this._getStride( type, componentType );

				// USE rowIndex (which is (index * 2) + layerIdx)

				const byteOffset = view.byteOffset + ( rowIndex * stride );

				let value = this._readBinaryValue( binary, byteOffset, type, componentType );

				// --- ENUM RESOLUTION LOGIC ---

				if ( type === 'ENUM' ) {

					const enumType = schemaProp.enumType;
					const enumDef = schema.enums[ enumType ];

					if ( enumDef ) {

						// Find the name that matches the integer value we just read

						const enumValue = enumDef.values.find( v => v.value === value );

						if ( enumValue ) {

							value = enumValue.name; // Transform 0 into definition like "Solid Geometry"

						}

					}

				}

				metadata.properties[ propName ] = value;

			}

		}

		return metadata;

	}

	/**
	 * Resolves an implicit 3D Tileset into an explicit structure.
	 *
	 * This core recursive function translates Implicit Tiling (3D Tiles 1.1) into a 
	 * standard explicit tree. It handles subtree fetching, availability bitstream 
	 * parsing, Morton Z-order indexing, and multi-content layering.
	 *
	 * @async
	 * @param {Object} json - The original tileset JSON containing `implicitTiling` metadata.
	 * @param {string} rootPath - The base URL for resolving relative subtree and content URIs.
	 * @param {number} [level=0] - The current global subdivision level.
	 * @param {number} [x=0] - The global X coordinate in the quadtree/octree grid.
	 * @param {number} [y=0] - The global Y coordinate.
	 * @param {number} [z=0] - The global Z coordinate (used only for OCTREE).
	 * @param {boolean} [hasMultipleContent=false] - Whether the tileset uses the 1.1 `contents` array.
	 * @returns {Promise<Object>} A promise resolving to an explicit { asset, root } object.
	 *
	 * @description
	 * ### Key Mechanisms:
	 * 1. **Subtree Alignment**: Calculates the subtree root level to fetch the correct `.subtree` file.
	 * 2. **Morton Indexing**: Maps 2D/3D coordinates to a linear bitstream index within the subtree.
	 * 3. **Availability Mapping**: Uses `tileAvailability` and `contentAvailability` to prune empty tiles.
	 * 4. **1.1 Multi-Content Support**: Handles `contents` arrays by creating synthetic children with 
	 * `geometricError: 0` to ensure all variants load simultaneously.
	 * 5. **Subtree Boundary Traversal**: Detects when a tile is a subtree leaf and triggers 
	 * a new subtree fetch to continue expansion.
	 */
	async _resolveImplicit( json, rootPath, level = 0, x = 0, y = 0, z = 0 ) {

		const root = json.root;
		const jsonGE = json.geometricError;
		const implicit = root?.implicitTiling || json.implicitTiling;
		if ( !implicit ) return json;

		const isQuadtree = implicit.subdivisionScheme === "QUADTREE";
		const childCount = isQuadtree ? 4 : 8;
		const subtreeLevels = implicit.subtreeLevels;

		// Resolve Subtree URL and Fetch

		const subtreeRootLevel = Math.floor( level / subtreeLevels ) * subtreeLevels;

		const subtreeUrl = rootPath + this._replaceTemplate(

			implicit.subtrees.uri,
			subtreeRootLevel,
			x >> ( level - subtreeRootLevel ),
			y >> ( level - subtreeRootLevel ),
			isQuadtree ? 0 : z >> ( level - subtreeRootLevel )

		);

		// Fetch and Parse Subtree (Handle JSON or Binary)

		const response = await fetch( subtreeUrl );

		if ( !response.ok ) {

			console.error( `Could not load subtree: ${ subtreeUrl }` );
			return json;

		}

		let subtreeJson, subtree_isJson = false, binary, binaryView, tileBits;

		if ( subtreeUrl.endsWith( '.json' ) ) {

			subtreeJson = await response.json();
			subtree_isJson = true;

			// If binary data is separate or embedded, it would be handled here

		} else {

			const buffer = await response.arrayBuffer();
			const parsed = this._parseSubtree( buffer );
			subtreeJson = parsed.subtreeJson;
			binary = parsed.binary;
			binaryView = parsed.binaryView;

		}

		if ( subtreeJson.subtreeMetadata !== undefined ) {

			// This is global to all tiles in this subtree

			const subMetadata = this._extractPropertyTableMetadata(

				subtree_isJson ? 'subtreeMetadata' : subtreeJson.subtreeMetadata,
				0, // Subtree metadata usually only has one row (index 0)
				subtreeJson,
				binary,
				json.schema

			);

			// Store this or attach it to the root of the subtree

		}

		// Extract property tables if they exist in this subtree

		const propertyTables = subtreeJson.propertyTables || [];

		// Map ALL content availability layers (v1.1 support)

		if ( binary ) tileBits = this._getAvailability( subtreeJson, subtreeJson.tileAvailability, binary );

		// Ensure contentAvailability is treated as an array even if it's a single object

		const rawContentAvail = subtreeJson.contentAvailability;

		const contentAvailArray = Array.isArray( rawContentAvail )
			? rawContentAvail 
			: ( rawContentAvail ? [ rawContentAvail ] : [] );


		const contentBitLayers = contentAvailArray.map( avail => 

			this._getAvailability( subtreeJson, avail, binary )

		);

		// Identify content templates (plural for 1.1, fallback to singular for 1.0)

		let contentTemplates = [];

		if ( root.contents ) {

			contentTemplates = Array.isArray( root.contents ) ? root.contents : [ root.contents ];

		} else if ( root.content ) {

			contentTemplates = [ root.content ];

		}

		const buildNode = async ( lvl, cx, cy, cz ) => {

			// This stops building children if we have reached 1 level deeper than the start level

			const currentDepthRelativeToStart = lvl - level;

			if ( currentDepthRelativeToStart >= subtreeLevels ) {

				return ( await this._resolveImplicit( json, rootPath, lvl, cx, cy, cz ) ).root;

			}

			// Compute the Local Morton Index for 3D Tiles 1.1
			// We need local coordinates within the subtree (0 to 2^relativeLevel - 1)

			const mask = ( 1 << currentDepthRelativeToStart ) - 1;
			const localX = cx & mask;
			const localY = cy & mask;
			const localZ = cz & mask;

			// Level Offset formula: (childCount^relativeLevel - 1) / (childCount - 1)

			const levelOffset = Math.floor( ( Math.pow( childCount, currentDepthRelativeToStart ) - 1 ) / ( childCount - 1 ) );

			const mortonCode = isQuadtree 
				? this._morton2D( localX, localY )
				: this._morton3D( localX, localY, localZ );

			const index = levelOffset + mortonCode;

			const maxAllowedDepth = this._maxDepthLevel;

			let resolvedTileMetadata = null;

			// If the subtree defines metadata for tiles at this index:

			if ( subtreeJson.tileMetadata !== undefined || subtreeJson.subtreeMetadata !== undefined ) {

				// Use helper to extract values from the binary property table 
				// based on the Morton index

				resolvedTileMetadata = this._extractPropertyTableMetadata(

					subtree_isJson ? 'subtreeMetadata' : subtreeJson.tileMetadata,
					index,
					subtreeJson,
					binary,
					json.schema

				);

			}

			// Tile existence check

			const isTileAvailable = ( subtreeJson.tileAvailability?.constant === 1 ) || ( tileBits && tileBits[ index ] === 1 );

			if ( !isTileAvailable ) return null;

			// Process Multiple Contents

			const validContents = [];

			contentTemplates.forEach( ( template, layerIdx ) => {

				const layerBits = contentBitLayers[ layerIdx ];
				const contentAvailable = ( rawContentAvail?.constant === 1 ) || ( layerBits && layerBits[ index ] === 1 );

				if ( contentAvailable ) {

					// Apply template to get the actual URI

					let template_uri = this._replaceTemplate( template.uri, lvl, cx, cy, isQuadtree ? 0 : cz );
					const uri = rootPath + template_uri;

					// Metadata Logic

					let specificMetadata = null;

					if ( subtreeJson.tileMetadata !== undefined || subtreeJson.subtreeMetadata !== undefined ) {

						// Mapping: (MortonIndex * TotalLayers) + CurrentLayer

						const metadataIndex = ( index * contentTemplates.length ) + layerIdx;

						specificMetadata = this._extractPropertyTableMetadata(

							subtree_isJson ? 'subtreeMetadata' : subtreeJson.tileMetadata, 
							metadataIndex, 
							subtreeJson, 
							binary,
							json.schema

						);

					}

					// Populate Lookups

					this._variantLookup.set( template_uri, layerIdx );

					if ( specificMetadata ) {

						// Push to metadataLookup so the picker can find it by URI

						this._metadataLookup.push({

							uri: template_uri,
							metadataContent: null,
							metadataTile: specificMetadata,
							groupIndex: null

						});

					}

					validContents.push({

						uri: uri,
						metadata: specificMetadata

					});

				}

			});

			const hasMultipleContent = ( root.contents !== undefined );

			const node = {

				boundingVolume: this._computeChildBoundingVolume( root.boundingVolume, cx, cy, cz, isQuadtree ),
				geometricError: ( root.geometricError ?? jsonGE ) / Math.pow( 2, lvl ),
				refine: hasMultipleContent ? "ADD" : ( root.refine || "REPLACE" ),
				metadata: resolvedTileMetadata,
				children: []

			};

			// Flattening logic for threedTile compatibility

			if ( validContents.length > 0 ) {

				// Standard slot for the first content

				node.content = validContents[ 0 ];

				// If the content has specific metadata, it overrides or augments the tile metadata

				if ( validContents[ 0 ].metadata ) {

					node.content.metadata = validContents[ 0 ].metadata;

				}

				// Add a reference to the metadata class if applicable

				if ( contentTemplates[ 0 ].metadata ) {

					node.metadata = contentTemplates[ 0 ].metadata;

				}

				// Any additional contents are added as synthetic children
				// These children have 0 geometric error so they load / render at the same time as the parent

				if ( validContents.length > 1 ) {

					for ( let i = 1; i < validContents.length; i++ ) {

						node.children.push({

							content: validContents[ i ],
							boundingVolume: node.boundingVolume,     // Inherit same volume
							geometricError: 0,                       // Force immediate load
							refine: "ADD",                           // Additive refinement
							metadata: contentTemplates[ i ].metadata

						});

					}

				}

			}

			// Handle Subtree Traversal

			const isSubtreeLeaf = ( lvl + 1 - subtreeRootLevel ) % subtreeLevels === 0;
			const nextLevel = lvl + 1;

			if ( nextLevel < implicit.availableLevels && currentDepthRelativeToStart < maxAllowedDepth ) {

				for ( let i = 0; i < childCount; i++ ) {

					const [ dx, dy, dz ] = isQuadtree ? this._decodeMorton2D( i ) : this._decodeMorton3D( i );

					const nx = cx * 2 + dx;
					const ny = cy * 2 + dy;
					const nz = isQuadtree ? 0 : cz * 2 + dz;

					if ( isSubtreeLeaf ) {

						// Check if a child subtree exists at this leaf position
						const mask = ( 1 << subtreeLevels ) - 1;

						//const relativeLevel = nextLevel - subtreeRootLevel;
						//const mask = ( 1 << relativeLevel ) - 1;

						const leafIndex = isQuadtree 
							? this._morton2D( nx & mask, ny & mask ) 
							: this._morton3D( nx & mask, ny & mask, nz & mask );

						// Check availability before recursing

						const subAvailable = ( subtreeJson.childSubtreeAvailability?.constant === 1 ) ||
							this._checkAvailability( subtreeJson.childSubtreeAvailability, leafIndex, binaryView, subtreeJson);

						if ( subAvailable ) {

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
	 * Adapts 3D Tiles v1.0 JSON with Implicit Tiling extensions 
	 * into a format compatible with explicit loaders.
	 */
	async _resolveV10Implicit( json, rootPath, level = 0, x = 0, y = 0, z = 0, hasMultipleContent = false ) {

		const root = json.root;
		const schema = json.extensions?.[ '3DTILES_metadata' ]?.schema;

		// Support both the official 1.1 path and the 1.0 extension path

		const implicit = root?.extensions?.[ '3DTILES_implicit_tiling' ] || root?.implicitTiling || json.implicitTiling;

		if ( !implicit ) return json;

		const isQuadtree = implicit.subdivisionScheme === "QUADTREE";
		const childCount = isQuadtree ? 4 : 8;
		const subtreeLevels = implicit.subtreeLevels;

		// Resolve Subtree URL
		// We calculate which subtree file manages this specific tile coordinate

		const subtreeRootLevel = Math.floor( level / subtreeLevels ) * subtreeLevels;

		const subtreeUrl = rootPath + this._replaceTemplate(

			implicit.subtrees.uri,
			subtreeRootLevel,
			x >> ( level - subtreeRootLevel ),
			y >> ( level - subtreeRootLevel ),
			isQuadtree ? 0 : z >> ( level - subtreeRootLevel )

		);

		// Fetch and Parse Subtree (Handle JSON or Binary)

		const response = await fetch( subtreeUrl );

		if ( !response.ok ) {

			console.error( `Could not load subtree: ${ subtreeUrl }` );
			return json;

		}

		let subtreeJson, binary, binaryView, tileBits;

		if ( subtreeUrl.endsWith( '.json' ) ) {

			subtreeJson = await response.json();

			// If binary data is separate or embedded, it would be handled here

		} else {

			const buffer = await response.arrayBuffer();
			const parsed = this._parseSubtree( buffer );
			subtreeJson = parsed.subtreeJson;
			binaryView = parsed.binaryView;
			binary = parsed.binary;

		}

		// 3. Get Availability Bitstreams

		if ( binary ) tileBits = this._getAvailability( subtreeJson, subtreeJson.tileAvailability, binary );

		// Ensure contentAvailability is treated as an array even if it's a single object

		const rawContentAvail = subtreeJson.contentAvailability;

		const contentAvailArray = Array.isArray( rawContentAvail )
			? rawContentAvail 
			: ( rawContentAvail ? [ rawContentAvail ] : [] );

		const contentBitLayers = contentAvailArray.map( avail =>

			this._getAvailability( subtreeJson, avail, binary )

		);

		// Identify Content Templates (Handle single 'content' or array 'contents')

		let contentTemplates = [];

		if ( root.contents ) {

			contentTemplates = Array.isArray( root.contents ) ? root.contents : [ root.contents ];

		} else if ( root.content ) {

			contentTemplates = [ root.content ];

		}

		const buildNode = async ( lvl, cx, cy, cz ) => {

			const currentDepthInSubtree = lvl - level;

			// If we hit the boundary of the current subtree, jump to the next subtree

			if ( currentDepthInSubtree >= subtreeLevels ) {

				const nextSubtree = await this._resolveV10Implicit( json, rootPath, lvl, cx, cy, cz );
				return nextSubtree.root;

			}

			// Compute Morton Index for the current tile within the subtree

			const mask = ( 1 << currentDepthInSubtree ) - 1;

			const localX = cx & mask;
			const localY = cy & mask;
			const localZ = cz & mask;

			const levelOffset = Math.floor( ( Math.pow( childCount, currentDepthInSubtree ) - 1 ) / ( childCount - 1 ) );

			const mortonCode = isQuadtree 
				? this._morton2D( localX, localY ) 
				: this._morton3D( localX, localY, localZ );

			const index = levelOffset + mortonCode;

			const maxAllowedDepth = this._maxDepthLevel;

			// Check if this tile exists in the bitstream

			const isTileAvailable = (subtreeJson.tileAvailability?.constant === 1) || ( tileBits && tileBits[ index ] === 1 );

			if ( !isTileAvailable ) return null;

			let specificMetadata = null;

			// Resolve Content URIs if they are available at this index

			const validContents = [];

			contentTemplates.forEach( ( template, layerIdx ) => {

				const layerBits = contentBitLayers[ layerIdx ];

				const contentAvailable = ( rawContentAvail?.constant === 1 ) || ( layerBits && layerBits[ index ] === 1 );

				if ( contentAvailable ) {

					// Apply template to get the actual URI

					let template_uri = this._replaceTemplate( template.uri, lvl, cx, cy, isQuadtree ? 0 : cz );
					const uri = rootPath + template_uri;

					// 2. Metadata Logic

					if ( subtreeJson.subtreeMetadata !== undefined ) {

						// Mapping: (MortonIndex * TotalLayers) + CurrentLayer

						const metadataIndex = ( index * contentTemplates.length ) + layerIdx;

						specificMetadata = this._extractPropertyTableMetadata(

							'subtreeMetadata', 
							metadataIndex, 
							subtreeJson, 
							binary,
							schema

						);

					}

					// 3. Populate Lookups

					this._variantLookup.set( template_uri, layerIdx );

					if ( specificMetadata ) {

						// Push to metadataLookup so the picker can find it by URI

						this._metadataLookup.push({

							uri: template_uri,
							metadataContent: null,
							metadataTile: specificMetadata,
							groupIndex: null

						});

					}

					validContents.push({

						uri: uri,
						metadata: specificMetadata

					});

				}

			});

			const noContent = ( !root.content && root.children && root.children.length > 0 );

			const node = {

				boundingVolume: this._computeChildBoundingVolume( root.boundingVolume, cx, cy, cz, isQuadtree, lvl ),
				geometricError: root.geometricError / Math.pow( 2, lvl ),
				refine: hasMultipleContent ? "ADD" : noContent ? "REPLACE" : root.refine || "REPLACE",
				metadata: specificMetadata,
				children: []

			};

			if ( validContents.length > 0 ) {

				node.content = validContents[ 0 ];

				// Handle multiple contents as synthetic children (v1.1 feature)

				for ( let i = 1; i < validContents.length; i++ ) {

					node.children.push({

						content: validContents[ i ],
						boundingVolume: node.boundingVolume,
						geometricError: 0, // Force same-time loading
						refine: "ADD",
						metadata: contentTemplates[ i ].metadata

					});

				}

			}

			// Recursive step: Add children if they exist and we haven't hit the availability limit

			const isSubtreeLeaf = ( lvl + 1 - subtreeRootLevel ) % subtreeLevels === 0;
			const nextLevel = lvl + 1;

			if ( nextLevel < implicit.availableLevels && currentDepthInSubtree < maxAllowedDepth ) {

				for ( let i = 0; i < childCount; i++ ) {

					const [ dx, dy, dz ] = isQuadtree ? this._decodeMorton2D( i ) : this._decodeMorton3D( i );

					const nx = cx * 2 + dx;
					const ny = cy * 2 + dy;
					const nz = isQuadtree ? 0 : cz * 2 + dz;

					if ( isSubtreeLeaf ) {

						// Check if a child subtree exists at this leaf position

						const mask = ( 1 << subtreeLevels ) - 1;

						//const relativeLevel = nextLevel - subtreeRootLevel;
						//const mask = ( 1 << relativeLevel ) - 1;

						const leafIndex = isQuadtree 
							? this._morton2D( nx & mask, ny & mask ) 
							: this._morton3D( nx & mask, ny & mask, nz & mask );

						// Check availability before recursing

						const subAvailable = ( subtreeJson.childSubtreeAvailability?.constant === 1 ) ||
							this._checkAvailability( subtreeJson.childSubtreeAvailability, leafIndex, binaryView, subtreeJson );

						if ( subAvailable ) {

							const nextSubtree = await this._resolveV10Implicit( json, rootPath, nextLevel, nx, ny, nz );
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
	 * Recursively flattens 3D Tiles v1.1 'contents' arrays into a synthetic v1.0 child hierarchy.
	 * This ensures compatibility with threedTile loaders that expect a single content per tile.
	 *
	 * @async
	 * @param {Object} tile - The 3D Tile JSON object to process.
	 * @returns {Promise<void>}
	 */
	async _flattenExplicitContents( tile, hasMetadata = false, rootPath, level = 0 ) {

		// Determine if this tile is just a "folder" (no mesh, but has children)

		const isFolder = !tile.content && !tile.contents && tile.children && tile.children.length > 0;

		if ( isFolder ) {

			// 1. Force it to REPLACE so it swaps for its children

			tile.refine = "ADD";

			// 2. CRITICAL: Force a non-zero error. 
			// If it's 0, the renderer stops. We need it to be > 0 so it "refines".

			if ( tile.geometricError <= 0 ) {

				// Give it a value that forces refinement (e.g., half of parent's error)

				tile.geometricError = 512 / Math.pow( 2, level );

			}

		}

		// 1. Capture Tile-level metadata (if any)

		const tileMetadata = tile.metadata || null;

		// 2. Process v1.1 'contents' array

		if ( tile.contents ) {

			tile.refine = "ADD";
			tile.geometricError = 512 / Math.pow( 2, level );
			tile.children = tile.children || [];

			let i = 0;

			for ( const contentObj of tile.contents ) {

				let tile_uri = contentObj.uri;

				if ( tile_uri ) {

					// Remove leading slash
					if ( tile_uri.startsWith( '/' ) ) tile_uri = tile_uri.substring( 1 );

					// Remove leading './'
					if ( tile_uri.startsWith( './' ) ) tile_uri = tile_uri.substring( 2 );

				}

				if ( hasMetadata ) {

					const finalMetadata = contentObj.metadata || tileMetadata;

					// Modify the value stored in the Map

					const metadataPackage = {

						uri: tile_uri,
						metadataContent: finalMetadata,
						metadataTile: tileMetadata,
						groupIndex: contentObj.group ?? null // This is the index into the groups array

					};

					// Store the metadata keyed by the likely mesh prefix

					this._metadataLookup.push( metadataPackage );

				} else {

					this._variantLookup.set( tile_uri, i );
					i++;

				}

				const syntheticChild = {

					content: { uri: tile_uri }, 
					boundingVolume: contentObj.boundingVolume || tile.boundingVolume,
					geometricError: 0,
					refine: "ADD"

				};

				tile.children.push( syntheticChild );

			}

			delete tile.contents;

		} else if ( tile.content?.uri ) {

			let tile_content_uri = tile.content.uri;

			// Remove leading slash
			if ( tile_content_uri.startsWith( '/' ) ) tile_content_uri = tile_content_uri.substring( 1 );

			// Remove leading './'
			if ( tile_content_uri.startsWith( './' ) ) tile_content_uri = tile_content_uri.substring( 2 );

			tile.content.uri = rootPath + tile_content_uri;

		}


		// 3. Recurse through all children (including the ones we just added)

		if ( tile.children ) {

			for ( const child of tile.children ) {

				await this._flattenExplicitContents( child, hasMetadata, rootPath, level + 1 );

			}

		}

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

		scope._variantLookup.clear();
		scope._metadataLookup.length = 0;

		const urlObj = new URL( url );

		const params = urlObj.searchParams;

		// Check if this is a "Lazy" sub-call

		const level = parseInt( params.get( 'level' ) ) || 0;
		const x = parseInt( params.get( 'x' ) ) || 0;
		const y = parseInt( params.get( 'y' ) ) || 0;
		const z = parseInt( params.get( 'z' ) ) || 0;

		try {

			if ( !scope._camera ) {

				scope._camera = new PerspectiveCamera( 60, ww / wh, 0.1, 1e9 );

			}

			if ( !scope._renderer ) {

				scope._renderer = new WebGLRenderer( { antialias: false } );
				scope._ktx2Loader.detectSupport( scope._renderer );

			}

			scope._gltfLoader.setKTX2Loader( scope._ktx2Loader );

			let json = await fetch( url ).then( r => r.json() );

			const tilesetVersion = json.asset?.version || null;

			if ( tilesetVersion === '1.0' && json.root.implicitTiling !== undefined ) {

				console.warn( 'Tileset marked as v1.0 but is using v1.1 implicit tiling!' );
				throw new Error( 'Abort: Tileset inconsistency detected!' );

			}

			const hasMetadata = !!(

				json.metadata ||
				json.schema ||
				json.groups ||
				json.root?.metadata ||
				json.root?.contents?.some( c => c.metadata )

			);

			const json_transform = json.root.transform;

			const isImplicit = json.root.implicitTiling !== undefined;
			const isV10Implicit = json.root.extensions?.[ '3DTILES_implicit_tiling' ];

			if ( hasMetadata ) {

				scope._currentGroups = json.groups || [];
				scope._currentSchema = json.schema || null;
				scope._tilesetMetadata = json.metadata || null;

			} else if ( isV10Implicit ) {

				scope._currentSchema = json.extensions?.[ '3DTILES_metadata' ]?.schema || null;

			}

			// Check if the root or any child has multiple contents to set a global flag

			const hasMultiExplicit = json.root?.contents?.length > 1;
			const hasMultiImplicit = ( isImplicit || isV10Implicit ) && 
				( json.root?.implicitTiling?.contentAvailability?.length > 1 || json.root?.implicitTiling?.multipleContents );

			const hasMulti = hasMultiExplicit || hasMultiImplicit;

			// Resolve Implicit Tiling first

			if ( isImplicit ) {

				json = await scope._resolveImplicit( json, rootPath, level, x, y, z, hasMulti );

			} else if ( isV10Implicit ) {

				json = await scope._resolveV10Implicit( json, rootPath, level, x, y, z, hasMulti );

			} else if ( tilesetVersion === '1.1' ) {

				await scope._flattenExplicitContents( json.root, hasMetadata, rootPath );

			}

			const obv = json.boundingVolume || json.root?.boundingVolume;

			// Convert OBV → Box3 to attach initially to tilesRenderer.group

			const box_from_json = scope._computeBox3FromBoundingVolume( obv );

			let version_url = url;

			if ( isImplicit || isV10Implicit || tilesetVersion === '1.1' ) {

				// Create the Blob
				// We turn the JavaScript Object back into a String, then into a Blob

				const jsonString = JSON.stringify( json );
				const blob = new Blob( [ jsonString ], { type: 'application/json' } );

				// Generate the Object URL

				version_url = URL.createObjectURL( blob );

			}

			// Initialize the Core Renderer

			const tilesRenderer = new ThreeDTilesRenderer.TilesRenderer( version_url );

			tilesRenderer.setCamera( scope._camera );
			tilesRenderer.setResolutionFromRenderer( scope._camera, scope._renderer );
                        tilesRenderer.workingPath = rootPath;

			//tilesRenderer.maxTilesProcessed = scope._maxCacheSize;
			tilesRenderer.autoDisableRendererCulling = true;
			tilesRenderer.errorTarget = scope._errorTarget;
			tilesRenderer.maxDepth = scope._maxDepthLevel;
			tilesRenderer._optimizeRaycast = false;
			tilesRenderer._errorThreshold = 1.0;
			tilesRenderer.loadSiblings = false;

			// Tell the manager to use our configured gltfLoader

			tilesRenderer.manager.addHandler( /(gltf|glb)$/g, scope._gltfLoader );

			if ( scope._token && scope._token.length > 0 ) {

				const cleanToken = ( scope._token || '' ).trim();
				const cleanAssetId = String( scope._assetId || '1' ).trim();

				const authPlugin = new ThreeDTilesPlugins.CesiumIonAuthPlugin( {

					apiToken: cleanToken,
					assetId: cleanAssetId,
					autoRefreshToken: true

				} );

				tilesRenderer.registerPlugin( authPlugin );

			}

			// Register Performance Plugins (Cesium 2024 Enhancements)

			const fadePlugin = new ThreeDTilesPlugins.TilesFadePlugin();
			const compressionPlugin = new ThreeDTilesPlugins.TileCompressionPlugin();
			const updateOnChangePlugin = new ThreeDTilesPlugins.UpdateOnChangePlugin();

			tilesRenderer.registerPlugin( fadePlugin );
			tilesRenderer.registerPlugin( compressionPlugin );
			tilesRenderer.registerPlugin( updateOnChangePlugin );

			// Fallback bounding box for initial rendering

			tilesRenderer.group.boundingBox = box_from_json;

			const threedTile = tilesRenderer.group;

			threedTile.tilesetVersion = tilesetVersion;

			if ( hasMetadata || scope._metadataLookup.length > 0 ) {

				threedTile.hasMetadata = true;
				threedTile.userData.groups = scope._currentGroups;
				threedTile.userData.schema = scope._currentSchema;
				threedTile.userData.tileset = scope._tilesetMetadata;
				threedTile.userData.metadataRegistry = scope._metadataLookup;

				console.log( 'Metadata Support: ENABLED' );

			}

			if ( hasMulti ) {

				// Flag for the viewer.
				// Currently all contents will be visible so have the viewer set correct visibility.
				// The viewer can traverse children and set visibility by using userData.variantLookup

				threedTile.hasMultipleContents = true;
				threedTile.userData.rootPath = rootPath;
				threedTile.userData.variantLookup = scope._variantLookup;

			}

			function fitCameraToBox3( offset = 1.5 ) {

				const center = new Vector3();
				const size = new Vector3();

				// 1. Get dimensions from the Box3

				tilesRenderer.group.boundingBox.getCenter( center );
				tilesRenderer.group.boundingBox.getSize( size );

				// 2. Determine the "radius" of the box (distance from center to a corner)

				const maxDim = Math.max( size.x, size.y, size.z );
				const fov = camera.fov * ( Math.PI / 180 );

				// 3. Calculate how far back the camera needs to be
				// This uses the tangent of the half-FOV to ensure the box fits vertically

				let distance = Math.abs( maxDim / 2.0 / Math.tan( fov / 2.0 ) );
				distance *= offset; // Apply padding

				// 4. Position the camera 
				// We move it 'distance' units away from the center along the Z axis

				scope._camera.position.set( center.x, center.y, center.z + distance );

				// 5. Point the camera at the center

				scope._camera.lookAt( center );

				// 6. CRITICAL: Update OrbitControls so we rotate around the box, not the world origin

				if ( scope._controls ) {

					scope._controls.target.copy( center );
					scope._controls.update();

				}

			}

			// The "sledgehammer" fix for vanishing models (until this bug gets resolved)

			if ( isImplicit || isV10Implicit ) {

				tilesRenderer.displayActiveTiles = true;
				const originalSetTileVisible = tilesRenderer.setTileVisible;

				tilesRenderer.setTileVisible = function( tile, visible ) {

					originalSetTileVisible.call( this, tile, true );

				};

			}

			tilesRenderer.addEventListener( 'load-root-tileset', () => {

				const sphere = new Sphere();
				tilesRenderer.getBoundingSphere( sphere );

				// 1. Determine if we are in Earth-Centered space

				const distanceToOrigin = sphere.center.length();
				const isECEF = Math.abs( distanceToOrigin - scope._R ) < 500000;
				tilesRenderer.group.isECEF = isECEF;

				// 2. Reset the group transformations first

				tilesRenderer.group.position.set( 0, 0, 0 );
				tilesRenderer.group.quaternion.set( 0, 0, 0, 1 );
				tilesRenderer.group.updateMatrixWorld( true );

				// 3. Calculate the corrective rotation (for ECEF models)

				if ( isECEF ) {

					const surfaceNormal = sphere.center.clone().normalize();
					const up = new Vector3( 0, 1, 0 );

					// This is the rotation needed to make the Earth's surface 'flat'

					const worldQuaternion = new Quaternion().setFromUnitVectors( surfaceNormal, up );

					// Apply rotation to the group

					tilesRenderer.group.quaternion.copy( worldQuaternion );

				}

				// 4. Center the model exactly at 0,0,0
				// We rotate the center point first so the translation accounts for the tilt

				const offset = sphere.center.clone();

				if ( isECEF ) {

					offset.applyQuaternion( tilesRenderer.group.quaternion );

				}

				// Move the group by the negative offset of the center

				tilesRenderer.group.position.sub( offset );
				tilesRenderer.group.updateMatrixWorld();

				// 5. Update the Bounding Box to be centered at 0, 0, 0
				// Instead of translating the old box, we create a fresh one from the sphere 
				// to ensure it's perfectly symmetrical around the origin.

				const r = sphere.radius;
				tilesRenderer.group.boundingBox.min.set( -r, -r, -r );
				tilesRenderer.group.boundingBox.max.set( r, r, r );

				// Call camera fit function

				fitCameraToBox3();

			});

			let syncTimeout = null;

			tilesRenderer.addEventListener( 'load-model', ( tile ) => {

				if ( tile.tile?.engineData?.scene && tile.url ) {

					tile.tile.engineData.scene[ 'contentURL' ] = tile.url;

				}

				// 2. Debounce the heavy Sync call

				clearTimeout( syncTimeout );

				syncTimeout = setTimeout( () => {

					if ( !tilesRenderer.isLoading && tilesRenderer.group._syncMaterials ) {

						//console.log( 'All current tiles ready. Syncing materials...' );

						tilesRenderer.group._syncMaterials( false, true );

					}

				}, 200 ); // Wait 200ms after the LAST tile finishes

			});

			/**
			 * Internal state for wireframe rendering.
			 * @type { boolean }
			 * @private
			 */
			threedTile._wireframeMode = false;

			/**
			 * Sets the wireframe state for all current and future LOD tiles.
			 * @param { boolean } enabled - Whether to enable wireframe rendering.
			 * @memberof threedTile
			 */
			threedTile.setWireframe = ( enabled ) => {

				threedTile._wireframeMode = !!enabled;
				threedTile._syncMaterials();

			};

			/**
			 * Internal point size for point clouds rendering.
			 * @type { float }
			 * @private
			 */
			threedTile._pointTargetSize = 1.0;

			/**
			 * Sets the material point size for points models.
			 * @param { float } size - Sets point size for rendering.
			 * @memberof threedTile
			 */
			threedTile.setPointSize = ( size ) => {

				threedTile._pointTargetSize = size;
				threedTile._syncMaterials();

			};

			/**
			 * Sets material side for all current and future LOD tiles.
			 * @memberof threedTile
			 */
			threedTile.setMaterialSide = () => {

				threedTile._syncMaterials( true );

			};

			/**
			 * Traverses the tileset hierarchy to synchronize materials 
			 * with the current wireframe state and point size and
			 * performs metadata assignments to objects.
			 * This is called automatically after LOD updates.
			 * @private
			 * @memberof threedTile
			 */
			threedTile._syncMaterials = ( materialSideChanged = false, newTile = false ) => {

				threedTile.traverse( ( child ) => {

					if ( child.isMesh ) {

						const mats = Array.isArray( child.material ) ? child.material : [ child.material ];

						mats.forEach( m => {

							if ( !m.userData.originalMaterialSide ) m.userData.originalMaterialSide = m.side;

							if ( materialSideChanged ) {

								if ( scope._materialSide === -1 ) {

									m.side = m.userData.originalMaterialSide;

								} else {

									m.side = scope._materialSide;

								}

							} else if ( newTile && scope._materialSide !== -1 ) {

									m.side = scope._materialSide;

							}

							if ( m && m.wireframe !== threedTile._wireframeMode ) {

								m.wireframe = threedTile._wireframeMode;

							}

							m.needsUpdate = true;

						});

					} else if ( child.isPoints && child.material ) {

						if ( child.material.size !== threedTile._pointTargetSize ) {

							child.material.size = threedTile._pointTargetSize;
							child.material.needsUpdate = true;

						}

					}

					// --- METADATA SYNC ---
					// Only run if the object doesn't have metadata yet
					// The only identifiable property seems to be contentURL

					if ( threedTile.hasMetadata ) {

						if ( ( child.isMesh || child.isPoints ) && !child.userData.metadata ) {

							let internalURL = null;
							let curr = child;

							// Climb parents to find the URL (which should be present by now)

							while ( curr ) {

								if ( curr.contentURL?.length > 0 ) {

									internalURL = curr.contentURL;
									break;

								}

								curr = curr.parent;

							}

							if ( internalURL ) {

								const cleanURL = internalURL.split( '?' )[ 0 ].toLowerCase();

								const match = threedTile.userData.metadataRegistry.find( entry =>

									cleanURL.endsWith( entry.uri.toLowerCase() )

								);

								if ( match ) {

									child.userData.metadata = {

										tileset: threedTile.userData.tileset,
										schema: threedTile.userData.schema,
										content: match.metadataContent,
										tile: match.metadataTile

									};


									// Link the Group if it exists

									if ( match.groupIndex !== null && threedTile.userData.groups?.[ match.groupIndex ] ) {

										child.userData.metadata[ 'group' ] = threedTile.userData.groups[ match.groupIndex ];

									}

									// console.log( `Mapped metadata to streamed tile: ${ cleanURL }` );

								}

							}

						}

					}

				});

			};

			/**
			 * Custom dispose that cleans up Three.js resources AND the library state.
			 */
			threedTile.dispose = function() {

				// Remove from scene

				if ( threedTile.parent ) {

					threedTile.parent.remove( threedTile );

				}

				// Deep traverse to free GPU resources

				threedTile.traverse( ( child ) => {

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

				if ( typeof tilesRenderer.dispose === 'function' ) {

					tilesRenderer.dispose();

				}

				if (this._dracoLoader) this._dracoLoader.dispose();
				if (this._ktx2Loader) this._ktx2Loader.dispose();

				console.log( 'threedTileset and GPU resources disposed.' );

				return true;

			};

			return threedTile;

		} catch ( err ) {

			console.error( err );
			throw err;

		}

	}

}

export { Three3DTilesLoader };
