# obj2prwm

CLI tool to convert WaveFront OBJ files into PRWM files.

Packed Raw WebGL Model is a binary file format for nD geometries specifically designed for JavaScript and WebGL with a strong focus on fast parsing (from 1ms to 0.1ms in Chrome 59 on a MBP Late 2013). More information on this [here](https://github.com/kchapelier/PRWM).

Currently this tool only support the conversion of OBJ containing a single model made of triangles.

## Installing

With [npm](http://npmjs.org) do:

```
npm install obj2prwm -g
```

## CLI Usage

### obj2prwm -i inputFile -o outputFile [OPTIONS]

**Options**

 * **--positions :** Include the vertices positions in the destination file.
 * **--normals :** Include the normals in the destination file. Missing normals will be generated.
 * **--uvs :** Include the UVs in the destination file.
 * **--indexed :** Indicate that the geometry stored in the destination file must be indexed. (recommended)
 * **--be :** Indicate that the destination file must be in Big Endian byte order. By default the destination file is in Little Endian.
 * **-q, --quiet :** Quiet mode. Silence the output to the console.

## API

### obj2prwm.convert(objString, options)

**Arguments**

 * **objString :** The obj file as a string.
 * **options :** Options
    * **positions :** Include the vertices positions in the destination file.
    * **normals :** Include the normals in the destination file. Missing normals will be generated.
    * **uvs :** Include the UVs in the destination file.
    * **indexed :** Indicate that the geometry stored in the destination file must be indexed. (recommended)
    * **bigEndian :** Indicate that the destination file must be in Big Endian byte order. By default the destination file is in Little Endian.
    * **quiet :** Quiet mode. Silence the output to the console.

## Example

```
$ obj2prwm -i original.obj -o destination.prwm --positions --normals --uvs --indexed

 * Reading original.obj
 * Parsing WaveFront OBJ data
 * Formatting data
 * Writing destination.prwm

Operation completed in 0.16s.
Original OBJ file size : 1502.48kB
Generated indexed PRWM file size : 386.42kB
Individual vertices : 12147
```

## Changelog

### 1.1.1 (2017.12.26) :

 * Update `wavefront-obj-parser` and other dependencies.

### 1.1.0 (2017.08.19) :

 * Allow to use the module programmatically.
 * Generate missing normals.

### 1.0.0 (2017.06.10) :

 * First release.

## Roadmap

 * Support OBJ with quads
 * Support the generation of tangents

## License

MIT
