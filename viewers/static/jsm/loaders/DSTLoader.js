//DST embroidery file loader for THREEJS by thrax. 1/15/24

/*

This is a loader/scope/renderer for the .dst embroidery machine file format.
It renders the stitches to textured geometry, and can optionally then render that to a rendertarget for
more efficient display..

Colors , geometry, and thread parameters can be changed on the fly...
a normalized drawRange is supported to display the stitches at different times in the process..

the loader takes an options parameter, and returns a container for the resulting mesh or line primitive

options:
  quads:true | fals  , // whether to generate quads or line primitives...
  threadThickness:0 to Infinity.. defaults to 2
  jumpThreadThickness:0 to Infinity.. defaults to 0.01
  palette:['red','white','blue'] .. the colors to use for the thread color steps.. 
             // ideally 1+ the number of thread color steps in the file..
             // unsupplied entries are set to random colors...

the load method returns an object:
the object returned has:

mesh: the Mesh or Line primitive...
and then all the parameters in "options" which can be changed on the fly.

Modified and customized by GitHubDragonFly on 5/7/24:
- additional option: resetInProgress = false
  - this should come from the app using the loader to allow removing current model when loading a new one
  - workaround for the racing condition of the mesh.onBeforeRender function, at least in the DST Viewer
*/

import {
  Box3,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  LinearFilter,
  LinearMipmapLinearFilter,
  Loader,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  Vector2,
  Vector3,
  WebGLRenderTarget
} from "three";

class DSTLoader extends Loader {

	constructor( manager ) {

		super( manager );

    this.quads = true;
    this.resetInProgress = false;
    this.threadThickness = 2;
    this.jumpThreadThickness = 0.01;
    this.palette = [ '#FF0000', '#00FF00', '#0000FF', '#FFFFFF', '#808080', '#000000' ];
    this.v0 = new Vector3();

    this.buffer = new ArrayBuffer( 0 );

  }

  decodeCoordinate( byte1, byte2, byte3 ) {

    let cmd = byte1 | ( byte2 << 8 ) | ( byte3 << 16 );

    let x = 0, y = 0, jump, cstop;

    let bit = ( bit ) => cmd & ( 1 << bit );

    if ( bit( 23 ) ) y += 1;
    if ( bit( 22 ) ) y -= 1;
    if ( bit( 21 ) ) y += 9;
    if ( bit( 20 ) ) y -= 9;
    if ( bit( 19 ) ) x -= 9;
    if ( bit( 18 ) ) x += 9;
    if ( bit( 17 ) ) x -= 1;
    if ( bit( 16 ) ) x += 1;

    if ( bit( 15 ) ) y += 3;
    if ( bit( 14 ) ) y -= 3;
    if ( bit( 13 ) ) y += 27;
    if ( bit( 12 ) ) y -= 27;
    if ( bit( 11 ) ) x -= 27;
    if ( bit( 10 ) ) x += 27;
    if ( bit( 9 ) ) x -= 3;
    if ( bit( 8 ) ) x += 3;

    if ( bit( 7 ) ) jump = true;
    if ( bit( 6 ) ) cstop = true;
    if ( bit( 5 ) ) y += 81;
    if ( bit( 4 ) ) y -= 81;
    if ( bit( 3 ) ) x -= 81;
    if ( bit( 2 ) ) x += 81;

    /*
    //FROM THE SPEC:
    23	Y += 1 add 0.1 mm to needle's Y current coordinate
    22	Y -= 1 subtract 0.1 mm from the needle's current Y position
    21	Y += 9
    20	Y -= 9
    19	X -= 9
    18	X += 9
    17	X -= 1
    16	X += 1
    15	Y += 3
    14	Y -= 3
    13	Y += 27
    12	Y -= 27
    11	X -= 27
    10	X += 27
    9	X -= 3
    8	X += 3
    7	Jump stitch (not a normal stitch)
    6	Stop for colour change or end of pattern
    5	Y += 81
    4	Y -= 81, the end-of-pattern code sets both Y += 81 and Y -= 81 which cancel each other
    3	X -= 81
    2	X += 81
    */

    return { x, y, jump, cstop };

  }

  async loadBinaryData( url, onError ) {

    const scope = this;

    try {

      const response = await fetch( url );

      if ( ! response.ok ) {

				if ( onError ) {

					onError( `HTTP error! status: ${response.status}` );

				} else {

					throw new Error( `HTTP error! status: ${response.status}` );

				}

				scope.manager.itemError( url );

        return [];

      }

      let buffer = await response.arrayBuffer();

      return buffer;

    } catch ( error ) {

      if ( onError ) {

        onError( 'Failed to load binary data: ', error );

      } else {

        throw new Error( 'Failed to load binary data: ', error );

      }

    }

  }
  
  parseDST() {

		const scope = this;

    let dataView = new DataView( scope.buffer );
    let start = 512; // Starting byte
    let indices = [];
    let vertices = [];
    let colors = [];
    let normals = [];
    let uvs = [];

    let cx = 0;
    let cy = 0;
    let cr = 1;
    let cg = 1;
    let cb = 1;

    let header = String.fromCharCode.apply(
      String,
      new Uint8Array( scope.buffer, 0, 512 )
    );

    let coff = header.indexOf( 'CO:' );
    let colorCount = 0;

    if ( coff > 0 ) colorCount = parseInt( header.slice( coff + 3, coff + 7 ) );

    let vcount = 0;
    let wasJumpOrStop = false;
    let pidx = 0;
    let cpalette;

    if ( ! scope.palette ) scope.palette = [];

    while ( scope.palette.length < colorCount + 1 ) {

      cr = Math.random();
      cg = Math.random();
      cb = Math.random();

      scope.v0.set( cr, cg, cb ).normalize();

      scope.palette.push( '#' + new Color( scope.v0.x, scope.v0.y, scope.v0.z ).getHexString() );

    }

    cpalette = [];

    for ( let i = 0; i < scope.palette.length; i++ ) {

      cpalette[ i ] = new Color( scope.palette[ i ] );

      let p = cpalette[ pidx % cpalette.length ];

      cr = p.r;
      cg = p.g;
      cb = p.b;

    }

    for ( let i = start; i < dataView.byteLength; i += 3 ) {

      if ( i >= dataView.byteLength - 3 ) break;

      let byte1 = dataView.getUint8( i );
      let byte2 = dataView.getUint8( i + 1 );
      let byte3 = dataView.getUint8( i + 2 );

      // Check for end of file sequence

      if ( byte1 === 0x00 && byte2 === 0x00 && byte3 === 0xf3 ) break;

      let { x, y, cstop, jump } = this.decodeCoordinate( byte3, byte2, byte1 );

      let px = cx;
      let py = cy;

      cx += x;
      cy += y;

      if ( cstop ) {

        if ( cpalette ) {

          //Get next step color

          pidx++;

          let p = cpalette[ pidx % cpalette.length ];

          cr = p.r;
          cg = p.g;
          cb = p.b;

        } else {

          cr = Math.random();
          cg = Math.random();
          cb = Math.random();

          scope.v0.set( cr, cg, cb ).normalize();

          cr = scope.v0.x;
          cg = scope.v0.y;
          cb = scope.v0.z;

        }

      }

      if ( scope.quads ) {

        let dx = cx - px;
        let dy = cy - py;
        let dtx = -dy;
        let dty = dx;

        let llen = scope.v0.set( dtx, dty, 0 ).length();

        if ( llen ) scope.v0.multiplyScalar( 1 / llen );

        let thickness = wasJumpOrStop ? scope.jumpThreadThickness : scope.threadThickness;

        dtx = scope.v0.x * thickness;
        dty = scope.v0.y * thickness;

        //if (jump || cstop) vertices.push(Infinity, Infinity, Infinity);
        //else

        vertices.push( px + dtx, py + dty, 0 );
        vertices.push( px - dtx, py - dty, 0 );
        vertices.push( cx - dtx, cy - dty, 0 );
        vertices.push( cx + dtx, cy + dty, 0 );

        let vy = Math.random() * 0.5;

        uvs.push( 0, 0 + vy, 1, 0 + vy, 1, llen / 80 + vy, 0, llen / 80 + vy );

        colors.push(cr, cg, cb);
        colors.push(cr, cg, cb);
        colors.push(cr, cg, cb);
        colors.push(cr, cg, cb);

        //normals.push( dtx, dty, .5, -dtx, -dty, .5, -dtx, -dty, .5, dtx, dty, .5 );

        normals.push( 0, 0, 1, -0, -0, 1, -0, -0, 1, 0, 0, 1 );

        indices.push(
          vcount,
          vcount + 1,
          vcount + 2,
          vcount + 2,
          vcount + 3,
          vcount + 0
        );

        vcount += 4;

      } else {

        //lines

        vertices.push( cx, cy, 0 ); // Z-coordinate is 0 as embroidery designs are 2D
        colors.push( cr, cg, cb );

      }

      wasJumpOrStop = jump || cstop;

    }

    let geometry = new BufferGeometry();

    geometry.setAttribute( 'position', new Float32BufferAttribute( vertices, 3 ) );
    geometry.setAttribute( 'color', new Float32BufferAttribute( colors, 3 ) );

    uvs.length && geometry.setAttribute( 'uv', new Float32BufferAttribute( uvs, 2 ) );
    normals.length && geometry.setAttribute( 'normal', new Float32BufferAttribute( normals, 3 ) );
    indices.length && geometry.setIndex( indices );

    return geometry;
  }

  loadAsync = async ( url, options ) =>
    new Promise( ( resolve, reject ) => this.load( url, resolve, undefined, reject, options ) );

  load( url, onLoad, onProgress, onError, opts = {} ) {

		const scope = this;
    scope.palette = [];

    scope.loadBinaryData( url, onError ).then( ( buffer ) => {

      scope.buffer = buffer;

      function generate() {

        if ( opts.quads !== undefined )
          scope.quads = opts.quads;

        if ( opts.resetInProgress !== undefined )
          scope.resetInProgress = opts.resetInProgress;

        if ( opts.threadThickness !== undefined )
          scope.threadThickness = opts.threadThickness;

        if ( opts.jumpThreadThickness !== undefined )
          scope.jumpThreadThickness = opts.jumpThreadThickness;

        if ( opts.palette !== undefined )
          scope.palette = opts.palette;

        opts.quads = scope.quads;
        opts.resetInProgress = scope.resetInProgress;
        opts.threadThickness = scope.threadThickness;
        opts.jumpThreadThickness = scope.jumpThreadThickness;

        let geometry = scope.parseDST( scope.buffer, opts );

        opts.palette = scope.palette;

        let lines = scope.quads ? new Mesh(
          geometry.clone(),
          new MeshStandardMaterial({
            color: "white",
            vertexColors: true,
            side: DoubleSide,
            depthTest: false,
            metalness: 0.0,
            roughness: 0.9,
            normalScale: new Vector2( 0.8, 0.8 ),
          })
        ) : new Line(
          geometry.clone(),
          new LineBasicMaterial({
            color: "white",
            vertexColors: true,
          })
        );

        lines.scale.set( 0.01, 0.01, 0.01 );
        lines.updateMatrixWorld( true );

        geometry.dispose();

        return lines;

      };

      let mesh = generate();

      let params = {
        mesh,
        get resetInProgress() {
          return opts.resetInProgress;
        },
        set resetInProgress( b ) {
          opts.resetInProgress = b;
        },
        get quads() {
          return opts.quads || false;
        },
        set quads( on ) {
          opts.quads = on === true;
          params.meshNeedsUpdate = true;
        },
        get threadThickness() {
          return opts.threadThickness;
        },
        set threadThickness( f ) {
          opts.threadThickness = parseFloat( f );
          params.meshNeedsUpdate = true;
        },
        get jumpThreadThickness() {
          return opts.jumpThreadThickness;
        },
        set jumpThreadThickness( f ) {
          opts.jumpThreadThickness = parseFloat( f );
          params.meshNeedsUpdate = true;
        },
        get palette() {
          return opts.palette;
        },
        set palette( arry ) {
          opts.palette = arry;
          params.meshNeedsUpdate = true;
        },
        toTexture( renderer, scene, maxDim, padding = 10 ) {

          if ( ! opts.map ) {

            let bounds = new Box3();
            bounds.setFromObject( params.mesh );

            let bsz = bounds.getSize( new Vector3() );

            let aspect = bsz.x / bsz.y;

            let pad = bsz.x / maxDim + ( padding * 2 ) / maxDim;

            let szx = ( bsz.x + pad ) / 2;
            let szy = ( bsz.y + pad / aspect ) / 2;

            const camera = new OrthographicCamera(
              -szx,
              szx,
              szy,
              -szy,
              1,
              1000
            );

            params.mesh.localToWorld( camera.position.set( 0, 0, 0 ) );
            camera.position.z += 500; // adjust as needed
            camera.lookAt( params.mesh.position );

            if ( bsz.x > bsz.y ) {

              bsz.y = maxDim * ( bsz.y / bsz.x );
              bsz.x = maxDim;

            } else {

              bsz.x = maxDim * ( bsz.x / bsz.y );
              bsz.y = maxDim;

            }

            const renderTarget = new WebGLRenderTarget(
              bsz.x | 0,
              bsz.y | 0,
              {
                generateMipmaps: true,
                minFilter: LinearMipmapLinearFilter,
                magFilter: LinearFilter,
              }
            );
 
            renderer.setRenderTarget( renderTarget );

            let sv = scene.background;
            scene.background = null;
            renderer.setClearAlpha( 0 );
            renderer.render( scene, camera );

            const width = renderTarget.width;
            const height = renderTarget.height;
            const size = width * height * 4; // 4 components (RGBA) per pixel
            const buffer = new Uint8Array( size );

            // Read the pixels

            renderer.readRenderTargetPixels(
              renderTarget,
              0,
              0,
              width,
              height,
              buffer
            );

            // Create a canvas to transfer the pixel data

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext("2d");

            // Create ImageData and put the render target pixels into it

            const imageData = new ImageData(
              new Uint8ClampedArray( buffer ),
              width,
              height
            );

            context.putImageData( imageData, 0, 0 );

            params.canvas = canvas;

            scene.background = sv;

            renderer.setClearAlpha( 1 );
            renderer.setRenderTarget( null );

            return renderTarget.texture;

          }

        },
        get normalMap() {},
      };

      let meshUpdateStarted = false;
      let updateStarted = false;

      mesh.onBeforeRender = async function () {

        if ( params.drawRange !== undefined ) {

          let dr = params.mesh.geometry.index
            ? params.mesh.geometry.index.count
            : params.mesh.geometry.attributes.position.count;

          params.mesh.geometry.drawRange.count = ( params.drawRange * dr ) | 0;

        }

        if ( params.meshNeedsUpdate === true && opts.resetInProgress === false ) {

          if ( meshUpdateStarted ) return;

          meshUpdateStarted = true;

          await new Promise( resolve => {

            let newmesh = generate();
            params.mesh.geometry.dispose();
            newmesh.position.copy( params.mesh.position );
            newmesh.scale.copy( params.mesh.scale );
            newmesh.rotation.copy( params.mesh.rotation );
            newmesh.material.map = mesh.material.map;
            mesh.material.map.dispose();
            newmesh.material.normalMap = mesh.material.normalMap;
            mesh.material.normalMap.dispose();
            mesh.material.dispose();
            params.mesh.parent.add( newmesh );
            newmesh.onBeforeRender = params.mesh.onBeforeRender;
            params.mesh.parent.remove( params.mesh );
            params.mesh = newmesh;

            resolve( meshUpdateStarted = false );

          });

          params.meshNeedsUpdate = false;

        } else if ( opts.resetInProgress === true ) {

          await new Promise( resolve => {

            resolve( params.mesh.parent.remove( params.mesh ) );

          });

        } else if ( params.needsUpdate === true ) {

          if ( updateStarted ) return;

          updateStarted = true;

          await new Promise( resolve => {

            params.mesh.geometry.dispose();
            params.mesh.geometry = generate().geometry;
            resolve( updateStarted = false );

          });

          params.needsUpdate = false;

        }

        params.meshNeedsUpdate = false;
        params.needsUpdate = false;

      };

      onLoad( params );

    });

  };

}

export { DSTLoader };
