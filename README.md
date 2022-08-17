# GitHubDragonFly.github.io
GitHubDragonFly's Website - access it [here](https://githubdragonfly.github.io)

Designed to serve as a hub with links to repositories and FREE online [three.js](https://threejs.org) 3D model viewers.

GitHub servers are providing correct access to files, so cloning or downloading this repository will not have the same functionality if run locally without some server.

Repositories do contain projects in several different programming languages or a mix of: `Java` `VB.Net` `C#` `python` `JavaScript` `jQuery` `HTML/CSS` `shell`.

There is a lot of information and descriptions, some intended for Industrial Automation and some for general/personal use.

# Mozilla Firefox screenshot

![Start Page](images/screenshot.png?raw=true)

# Notes about three.js 3D Model Viewers

- They are functional `AS THEY ARE` and intended for viewing a single 3D model
- Import formats, where applicable:
  - 3DS, 3DM, 3MF, AMF, DAE, FBX, GLB, GLTF, IFC, IGES, IGS, JSON, MTL, OBJ, PCD, PDB, PLY, VTK, VTP, STL, STEP, STP, PRWM, WRL
  - LDRAW supported formats: DAT, L3B, LDR, MPD
  - MMD supported formats: PMD, PMX, VMD, VPD, SPA, SPH, MP3, OGG
- Export formats, where applicable:
  - DAE, GLB, GLTF, JSON, OBJ, PLY, STL
- JSON import/export is actually three.js created format
- The best choice of loading 3D models is via the viewers `URL` option (for URLs with no CORS restrictions)
- Multiple URLs, comma separated, are allowed in some viewers and can be from mixed websites
- See `URLS4MODELS.md` file for examples as well as [HTML_CSS_JS_Flask](https://github.com/GitHubDragonFly/HTML_CSS_JS_Flask) repository
- Lots of loading instructions in the [HTML_CSS_JS](https://github.com/GitHubDragonFly/HTML_CSS_JS) repository
- All files have to be in the same folder when loading files locally from a hard drive
- Some viewers might have some limitations when loading files locally from a hard drive
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
- STEP / IGES Viewer is using [occt-import-js](https://github.com/kovacsv/occt-import-js)
- JSON Viewer has timeouts which might need to be adjusted when loading large files
- GLTF / FBX / DAE viewers will also export animations to JSON format
- DAE (Collada) exporter appears to brighten up the original model as well as the exported model
- MMD / GLTF viewers can export to DAE (Collada) / OBJ formats but all exported textures seem to need to be flipped vertically afterwards (use some paint program for this)
- GLTF / GLB exporter has a limitation related to shader material, seen when exporting MMD models
- Tips:
  - if model is correctly loaded but you cannot see it then try any or all of the following:
    - apply `edges`
    - zoom `in/out` or apply `Scale`
    - apply `flatShading`
    - apply `Vertex Colors`
    - change `ambient light` to white
    - change `background color` to white
  - exporting some models might be better done using multiple viewers, for example MMD -> OBJ and then OBJ -> JSON might be better than straight MMD -> JSON export
  - experiment with all exporters available by exporting original model as well as its exported versions
  - large resolution textures should be scaled down before loading, as an example download [`Bedroom`](https://casual-effects.com/data/index.html) which is using 8k images (2k size seems to be optimal for browsers)
  - `Lambert` material does not have flatShading functionality
  - you could also try using [COLLADA2GLTF](https://github.com/KhronosGroup/COLLADA2GLTF) and [FBX2glTF](https://github.com/facebookincubator/FBX2glTF) converters

# Notes about three.js Texture Viewer

- Supporting PNG, JPG, JPEG, JFIF, PJPEG, PJP, BMP, DIB, GIF, TIF, TIFF, TGA, SVG, DDS, KTX, KTX2, BASIS and Lottie JSON texture files
- Use `T` button to switch between textures
- Texture is displayed on a rotatable plane

# License

This is all MIT licensed but please observe any other licenses that might be applicable to some files or content.

# Trademarks

Any and all trademarks, either directly or indirectly mentioned in this project, belong to their respective owners.
