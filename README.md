# GitHubDragonFly.github.io
GitHubDragonFly's Website - access it [here](https://githubdragonfly.github.io)

Initially designed to serve as a hub with links to repositories and [three.js](https://threejs.org) 3D model viewers.

Do understand that GitHub servers are providing correct access to files, so cloning or downloading this repository will not have the same functionality if run locally without some server.

Repositories do contain projects in several different programming languages or a mix of: Java, VB .Net, C#, python, JavaScript, jQuery, HTML/CSS, shell.

There is a lot of information and descriptions, some intended for Industrial Automation and some for general/personal use.

Notes about three.js viewers:
 - they are functional `AS THEY ARE`
 - intended for viewing a single 3D model
 - the best choice of loading 3D models is via the viewers `URL` option
 - multiple URLs are allowed and can be from mixed websites
 - Buttons, where applicable: `E` - edges, `F` - flatShading, `K` - kinematics, `A` - animations, `X`- morphs, `V` - variants, `T` - textures, `P` - poses, `DS` - side, `#` - grid
 - Light controls, where applicable: `DL` - directional, `SL` - spotlight, `HL` - hemisphere, `AL` - ambient, `XXi` - XX light intensity
 - FBX / OBJ / 3DS viewers allow setting texture path with URL just like in the following examples:
   - `https://raw.githubusercontent.com/antlafarge/ALLoader/master/examples/textures/, https://raw.githubusercontent.com/antlafarge/ALLoader/master/examples/fbx/crate.fbx`
   - `https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/3ds/portalgun/textures/, https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/3ds/portalgun/portalgun.3ds`
 - access to all [three.js](https://github.com/mrdoob/three.js/tree/master/examples) examples can be achieved with the following URL format, mind the correct path after `models`:
   - `https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/LittlestTokyo.glb`
   - `https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/collada/abb_irb52_7_120.dae`
   - `https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/vrml/house.wrl`
   - `https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/fbx/stanford-bunny.fbx`
   - `https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/pdb/diamond.pdb`
   - `https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/ply/binary/Lucy100k.ply`
   - `https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/stl/binary/colored.stl`
   - `https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/3dm/Rhino_Logo.3dm`
   - `https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/3mf/truck.3mf`
   - `https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/pcd/binary/Zaghetto.pcd`
   - `https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/prwm/smooth-suzanne.le.prwm`
   - `https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/ifc/rac_advanced_sample_project.ifc`
   - `https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/obj/male02/male02_dds.mtl, https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/obj/male02/male02.obj`
   - `https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/mmd/miku/miku_v2.pmd, https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/mmd/vmds/wavefile_v2.vmd, https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/mmd/vmds/wavefile_camera.vmd, https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/mmd/audios/wavefile_short.mp3`
 - access to all [KhronosGroup](https://github.com/KhronosGroup/glTF-Sample-Models) GLTF examples, mind the correct path after `2.0`:
   - `https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Sponza/glTF/Sponza.gltf`
   - `https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/GlamVelvetSofa/glTF/GlamVelvetSofa.gltf`
 - access to some 3DS example files at [tutushubham](https://github.com/tutushubham/3D-Models---Military), mind the correct path after `master`:
   - `https://raw.githubusercontent.com/tutushubham/3D-Models---Military/master/SWIM/SWIM/SWIM_L.3DS`
   - `https://raw.githubusercontent.com/tutushubham/3D-Models---Military/master/M60/M60/M60_L.3DS`
 - more URL examples available in the [HTML_CSS_JS_Flask](https://github.com/GitHubDragonFly/HTML_CSS_JS_Flask) repository
 - lots of loading instructions in the [HTML_CSS_JS](https://github.com/GitHubDragonFly/HTML_CSS_JS) repository
 - all files have to be in the same folder when loading files locally from a hard drive
 - some viewers might have some limitations when loading files locally from a hard drive
 - GLTF/GLB exporter seems to have a limitation, as reported [here](https://discourse.threejs.org/t/exporting-model-with-animations/6792), applicable to both DAE / FBX (for DAE you could try this [converter](https://github.com/KhronosGroup/COLLADA2GLTF) and for FBX you could try this [converter](https://github.com/facebookincubator/FBX2glTF) instead)

This is all MIT licensed but please observe any other licenses that might be applicable to some files or content.
