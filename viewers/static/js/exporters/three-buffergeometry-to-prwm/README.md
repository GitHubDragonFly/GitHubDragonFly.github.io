# three-buffergeometry-to-prwm

Takes a THREE.BufferGeometry and returns an ArrayBuffer containing a PRWM file.

Packed Raw WebGL Model is a binary file format for nD geometries specifically designed for JavaScript and WebGL with a strong focus on fast parsing (from 1ms to 0.1ms in Chrome 59 on a MBP Late 2013). More information on this [here](https://github.com/kchapelier/PRWM).

Mostly a convenience wrapper around [prwm](https://www.npmjs.com/package/prwm).

## Installing

With [npm](http://npmjs.org) do:

```
npm install three-buffergeometry-to-prwm
```

## Example

```js
var threeBufferGeometryToPrwm = require('three-buffergeometry-to-prwm');

console.log(threeBufferGeometryToPrwm(bufferGeometry));
```

## API

```js
threeBufferGeometryToPrwm(bufferGeometry, bigEndian);
```

### Arguments

 * geometry : an instance of THREE.BufferGeometry (can be indexed or non-indexed).
 * bigEndian : whether the endianness of the generated file should be Big Endian.

## Changelog

### 1.0.0 (2017.06.10) :

 * First release.

## Roadmap

 * Tests

## License

MIT
