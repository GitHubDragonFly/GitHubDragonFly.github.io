# three-gif-loader

Three.js plugin for loading animated gifs as textures.

## Usage

```javascript
import THREE from 'three';
import GifLoader from 'three-gif-loader';

// instantiate a loader
const loader = new GifLoader();

// load a image resource
const texture = loader.load(
  // resource URL
  'textures/animated-sparkles.gif',

  // onLoad callback
  function (reader) {
    // You probably don't need to set onLoad, as it is handled for you. However,
    // if you want to manipulate the reader, you can do so here:
    console.log(reader.numFrames());
  },

  // onProgress callback
  function (xhr) {
    console.log(`${(xhr.loaded / xhr.total * 100)}% loaded`);
  }

  // onError callback
  function () {
    console.error('An error happened.');
  }
);
const material = new THREE.MeshBasicMaterial({
  map: texture,
  transparent: true
});

```

## License

Copyright 2018 Movable, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
