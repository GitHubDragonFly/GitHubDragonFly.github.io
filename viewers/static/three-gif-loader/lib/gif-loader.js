( function () {

  class GifLoader {

    constructor( manager ) {

      this.manager = manager || THREE.DefaultLoadingManager;
      this.crossOrigin = 'anonymous';
      this.path = '';

    }

    load( url, onLoad, onProgress, onError ) {

      const texture = new THREE.GifTexture();

      const loader = new THREE.FileLoader( this.manager );
      loader.setPath( this.path );
      loader.setResponseType( 'arraybuffer' );

      loader.load( url, ( response ) => {

        const gifData = new Uint8Array( response );
        const reader = new GifReader( gifData );

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

  THREE.GifLoader = GifLoader;

} )();
