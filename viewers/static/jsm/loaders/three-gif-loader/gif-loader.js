import {
  DefaultLoadingManager,
  FileLoader
} from "three";
import { GifTexture } from "./gif-texture.js";
import { GifReader } from "../../libs/omggif/omggif.js";

class GifLoader {

  constructor( manager ) {

    this.manager = manager || DefaultLoadingManager;
    this.crossOrigin = 'anonymous';
    this.path = '';

  }

  load( url, onLoad, onProgress, onError ) {

    const texture = new GifTexture();

    const loader = new FileLoader( this.manager );
    loader.setPath( this.path );
    loader.setResponseType( 'arraybuffer' );

    loader.load( url, ( response ) => {

      const gifData = new Uint8Array( response );
      const reader = new GifReader( gifData );

      texture[ 'num_frames' ] = reader.numFrames();

      texture.setReader( reader );

      if ( onLoad ) onLoad( reader );

    }, onProgress, onError);

    return texture;

  }

  setPath( value ) {

    this.path = value;
    return this;

  }
}
export { GifLoader };
