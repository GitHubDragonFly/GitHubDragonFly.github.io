# GitHubDragonFly.github.io
GitHubDragonFly's Website - access it [here](https://githubdragonfly.github.io)

Initially designed to serve as a hub with links to repositories and [three.js](https://threejs.org) 3D model viewers.

Do understand that GitHub servers are providing correct access to files, so cloning or downloading this repository will not have the same functionality if run locally without some server.

Repositories do contain projects in several different programming languages or a mix of: Java, VB .Net, C#, python, JavaScript, jQuery, HTML/CSS, shell.

There is a lot of information and descriptions, some intended for Industrial Automation and some for general/personal use.

Notes about three.js viewers:
 - they are functional `AS THEY ARE`
 - intended for viewing a single 3D model
 - the best choice of loading 3D models is via the viewers `URL` option (for URLs that have no CORS restrictions)
 - multiple URLs are allowed in some viewers and can be from mixed websites
 - buttons, where applicable:
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
   - `RST` - reset
   - `#` - grid
 - light controls, where applicable:
   - `AL` - ambient light
   - `DL` - directional light
   - `HL` - hemisphere light
   - `SL` - spotlight
   - `DLi` - directional light intensity
   - `SLi` - spotlight intensity
 - other controls, where applicable:
   - `C` - object color
   - `BG` - background color
   - `Eq` - equirectangular
     - `R` - reflectivity
   - `Shdw` - shadow
 - see `URLS4MODELS.md` for examples as well as [HTML_CSS_JS_Flask](https://github.com/GitHubDragonFly/HTML_CSS_JS_Flask) repository
 - lots of loading instructions in the [HTML_CSS_JS](https://github.com/GitHubDragonFly/HTML_CSS_JS) repository
 - all files have to be in the same folder when loading files locally from a hard drive
 - some viewers might have some limitations when loading files locally from a hard drive
 - STEP / IGES Viewer is using [occt-import-js](https://github.com/kovacsv/occt-import-js)
 - JSON Viewer has timeouts which might need to be adjusted when loading large files
 - LDRAW Viewer currently only supports MPD packed files as they are in the [three.js](https://github.com/mrdoob/three.js/tree/master/examples/models/ldraw/officialLibrary/models) repository, LDR and L3B support is possible but would require the whole LDraw parts library and modifications to the loader
 - DAE (Collada) exporter appears to brighten up the original model as well as the exported model
 - MMD / GLTF viewers can export to DAE (Collada) / OBJ formats but all exported textures seem to need to be flipped vertically afterwards (use some paint program for this)
 - GLTF / FBX / DAE viewers will also export animations to JSON format
 - GLTF / GLB exporter seems to have a limitation related to shader material which can be seen when exporting MMD models
 - Tips:
   - if it happens that the model is correctly loaded but you cannot see it then try any or all of the following: apply edges - zoom in/out or apply Scale - apply flatShading - apply Vertex Colors - change ambient light to white - change background color to white
   - exporting some models might be better done using multiple viewers, for example MMD -> OBJ and then OBJ -> JSON might be better than straight MMD -> JSON export
   - large resolution textures should be scaled down before loading, as an example see `Bedroom` [here](https://casual-effects.com/data/index.html) which is using 8k images (you would also need to modify map_Kd and map_Ke statements in the MTL file by removing `-bm + value` entries since the loader is not reading them properly)
   - you could also try using [COLLADA2GLTF](https://github.com/KhronosGroup/COLLADA2GLTF) and [FBX2glTF](https://github.com/facebookincubator/FBX2glTF) converters

This is all MIT licensed but please observe any other licenses that might be applicable to some files or content.
