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
 - buttons, where applicable: `E` - edges, `F` - flatShading, `K` - kinematics, `A` - animations, `X`- morphs, `V` - variants, `T` - textures, `R` - reflectivity, `P` - poses, `CS` - construction step (ldraw), `DS` - material side (front/back/double), `#` - grid, `RST` - reset
 - light controls, where applicable: `DL` - directional, `SL` - spotlight, `HL` - hemisphere, `AL` - ambient, `DLi` or `SLi` - light intensity
 - other controls, where applicable: `BG` - background color, `C` - object color, `Eq` - equirectangular, `Opy` - opacity, `Shdw` - shadow
 - see `URLS4MODELS.md` for examples as well as [HTML_CSS_JS_Flask](https://github.com/GitHubDragonFly/HTML_CSS_JS_Flask) repository
 - lots of loading instructions in the [HTML_CSS_JS](https://github.com/GitHubDragonFly/HTML_CSS_JS) repository
 - all files have to be in the same folder when loading files locally from a hard drive
 - some viewers might have some limitations when loading files locally from a hard drive
 - STEP Viewer is using [occt-import-js](https://github.com/kovacsv/occt-import-js)
 - JSON Viewer has timeouts which might need to be adjusted when loading large files
 - LDRAW Viewer currently only supports MPD packed files as they are in the [three.js](https://github.com/mrdoob/three.js/tree/master/examples/models/ldraw/officialLibrary/models) repository, LDR and L3B support is possible but would require the whole LDraw parts library and modifications to the loader
 - DAE (Collada) exporter appears to brighten up the original model as well as the exported model
 - MMD / GLTF viewers can export to DAE (Collada) format but all exported textures seem to need to be flipped vertically afterwards (use some paint program for this)
 - GLTF viewer can export to OBJ format but all exported textures seem to need to be flipped vertically afterwards (use some paint program for this)
 - GLTF/GLB exporter seems to have a limitation, as reported [here](https://discourse.threejs.org/t/exporting-model-with-animations/6792), applicable to DAE / FBX / MMD models which contain joints (for DAE you could try [COLLADA2GLTF](https://github.com/KhronosGroup/COLLADA2GLTF) and for FBX you could try [FBX2glTF](https://github.com/facebookincubator/FBX2glTF) converters instead)

This is all MIT licensed but please observe any other licenses that might be applicable to some files or content.
