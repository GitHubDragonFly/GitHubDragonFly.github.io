# GitHubDragonFly.github.io
GitHubDragonFly's Website - access it [here](https://githubdragonfly.github.io).

Designed to serve as a hub with links to repositories and FREE online [three.js](https://threejs.org) based 3D model viewers.
Fit for a desktop but should be functional on mobile devices in spite of its tiny look. 

GitHub servers are providing correct access to files, so cloning or downloading this repository will not have the same functionality if run locally without some server.

Repositories do contain projects in several different programming languages or a mix of: `Java` `VB.Net` `C#` `python` `JavaScript` `jQuery` `HTML/CSS` `shell`.

There is a lot of information and descriptions, some intended for Industrial Automation and some for general/personal use.

# Mozilla Firefox screenshot

Main Menu Page
![Start Page](images/screenshot.png?raw=true)

# Notes about three.js 3D Model Viewers

- They are functional `AS THEY ARE` and intended for viewing a single 3D model
- Import files locally from a file browser dialog or specify remote URL
- Import formats, where applicable, with any optional/required textures:
  - 3DS, 3DM, 3MF, AMF, BRP, BREP, DAE, FBX, IFC, IGES, IGS, JSON, OBJ + MTL, PCD, PDB, PLY, VTK, VTP, STL, STEP, STP, PRWM, WRL
  - GLTF supported formats: GLB, GLTF + BIN, DRC
  - GCODE supported formats: GCODE, NCC, NGC
  - LDRAW supported formats: DAT, L3B, LDR, MPD
  - MMD ( Miku Miku Dance ) supported formats: PMD, PMX, VMD, VPD, SPA, SPH, MP3, OGG
- Export formats, where applicable:
  - DAE, GIF, GLB, GLTF, JSON, OBJ + MTL, PLY, STL
- JSON import/export is actually three.js created format
- GIF export is actually Animated GIF based on mrdoob's [example](https://github.com/mrdoob/omggif-example) and is using [omggif](https://github.com/deanm/omggif) library:
  - currently set to 500 x 500 size in the centre of the window
  - the approximate GIF area rectangle will be shown during the GIF generation
  - the larger the model and/or the more colors in the model will affect the size/quality of the resulting GIF file
  - it disregards the background color but does observe the background image with simple color palette
  - consider changing Directional Light color and/or using Ambient Light to avoid poor quality GIF for some models
  - non-animated / non-rotating models will spin 360 degrees
  - see the `legobrick` generated GIF examples and their optimized / resized version in the `images` folder
- The best choice of loading 3D models is via the viewers `URL` option (for URLs with no CORS restrictions)
- Multiple comma separated URLs are allowed in some viewers and can be from mixed websites
- See `URLS4MODELS.md` file for examples as well as [HTML_CSS_JS_Flask](https://github.com/GitHubDragonFly/HTML_CSS_JS_Flask) repository
- Lots of loading instructions in the [HTML_CSS_JS](https://github.com/GitHubDragonFly/HTML_CSS_JS) repository
- All files have to be in the same folder when loading files locally from a hard drive
- Some viewers might have some limitations when loading files locally from a hard drive
- Possibly update your models to look for textures in the same folder when loading files locally from a hard drive
- Buttons, where applicable:
  - `A` - animations
  - `E` - edges
  - `F` - flatShading
  - `K` - kinematics (collada)
  - `L` - lines (ldraw)
  - `O` - opacity
  - `P` - poses (mmd)
  - `S` - skeleton
  - `T` - textures
  - `V` - variants (gltf)
  - `X` - morphs
  - `CS` - construction step (ldraw)
  - `MP` - material (Phong / Standard / Lambert)
    - `*` - envMap + metalness (vtk / prwm)
  - `OS` - material side (Original / Front / Back / Double)
  - `VC` - vertex colors
  - `XS` - xtra smooth
  - `RST` - reset
  - `#` - grid
- Light controls, where applicable:
  - `AL` - ambient light
  - `DL` - directional light
  - `HL` - hemisphere light
  - `SL` - spotlight
  - `DLi` - directional light intensity
  - `SLi` - spotlight intensity
- Other controls, where applicable:
  - `C` - object color
  - `BG` - background color
  - `Eq` - equirectangular
    - `R` - reflectivity
  - `Shdw` - shadow
- STEP / IGES / BREP Viewer is using [occt-import-js](https://github.com/kovacsv/occt-import-js)
- JSON Viewer has timeouts which might need to be adjusted when loading large files
- GLTF / FBX / DAE viewers will also export animations to JSON format
- DAE (Collada) exporter appears to brighten up the original model as well as the exported model
- MMD / GLTF viewers can export to DAE (Collada) / OBJ formats but all exported textures seem to need to be flipped vertically afterwards (use some paint program for this)
- GLTF / GLB exporter has a limitation related to shader material, seen when exporting MMD models
- Using Animated GIF as a texture is experimental and currently available only in OBJ Viewer and should be tried on simple models, see the Animated GIF of a cube using Animated GIF as a texture in the `images` folder
- Tips:
  - if the model is correctly loaded but you cannot see it then try any or all of the following:
    - apply `edges`
    - zoom `in/out` or apply `Scale`
    - apply `flatShading`
    - apply `Vertex Colors`
    - change `ambient light` to white
    - change `background color` to white
  - exporting some models might be better done using multiple viewers, for example MMD -> OBJ and then OBJ -> JSON might be better than straight MMD -> JSON export
  - experiment with all exporters available by exporting the original model as well as its exported versions
  - large resolution textures should be scaled down before loading, as an example download [`Bedroom`](https://casual-effects.com/data/index.html) with 8k images and try it as is and then scale them down to 2k (which seems to be optimal for browsers)
  - `Lambert` material does not have flatShading functionality
  - you could also try using [COLLADA2GLTF](https://github.com/KhronosGroup/COLLADA2GLTF) and [FBX2glTF](https://github.com/facebookincubator/FBX2glTF) converters

PLY Viewer
![PLY Viewer](images/PLY%20Viewer.png?raw=true)

# Notes about three.js Texture Viewer

- Supporting PNG, JPG, JPEG, JFIF, PJPEG, PJP, BMP, DIB, GIF, TIF, TIFF, WEBP, TGA, SVG, DDS, KTX, KTX2, BASIS and Lottie JSON texture files
- Animated GIF file support provided by modified [gif-loader](https://github.com/movableink/three-gif-loader) using [omggif](https://github.com/deanm/omggif) library
- TIF / TIFF image file support provided by [geotiffjs](https://github.com/geotiffjs/geotiff.js)
- Use the `T` button to switch between textures
- Texture is displayed on a rotatable plane

![Texture Viewer](images/Texture%20Viewer.png?raw=true)

# License

This is all MIT licensed but please observe any other licenses that might be applicable to some files or content.

# Trademarks

Any and all trademarks, either directly or indirectly mentioned in this project, belong to their respective owners.
