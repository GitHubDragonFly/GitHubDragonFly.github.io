import { CanvasTexture } from "three";

class GifTexture extends CanvasTexture {

  constructor( image, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy ) {

    super( image, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy );

    this.needsUpdate = false;

  }

  setReader( reader ) {

    this.reader = reader;

    this.image = document.createElement( 'canvas' );
    this.image.width = reader.width;
    this.image.height = reader.height;
    this.context = this.image.getContext( '2d', { willReadFrequently: true } );

    this.frameNumber = 0;
    this.previousFrameInfo = null;
    this.draw();

  }

  draw() {

    if ( !this.reader ) return;

    const { reader, image, context } = this;
    const { width, height } = image;

    const frameNum = ++this.frameNumber % reader.numFrames();
    const frameInfo = reader.frameInfo( frameNum );

    if ( frameNum === 0 ) {

      // always clear canvas to start
      context.clearRect( 0, 0, width, height );

    } else if ( this.previousFrameInfo && this.previousFrameInfo.disposal === 2 ) {

      // disposal was "restore to background" which is essentially "restore to transparent"
      context.clearRect( this.previousFrameInfo.x, this.previousFrameInfo.y, this.previousFrameInfo.width, this.previousFrameInfo.height );

    }

    const imageData = context.getImageData( 0, 0, width, height );
    reader.decodeAndBlitFrameRGBA( frameNum, imageData.data );
    context.putImageData( imageData, 0, 0 );

    this.needsUpdate = true;

    this.previousFrameInfo = frameInfo;
    setTimeout( this.draw.bind(this), frameInfo.delay * 10 );

  }

};

export { GifTexture };
