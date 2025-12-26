

The included MIT license is for three.js files in any of the folders. Notes about other licenses might be included in some three.js files.

License for the three.js extensions is in the `viewers/static/jsm/extensions` folder

See `viewers/static/js/omggif` folder for licenses and Animated GIF export info, related to mrdoob's [example](https://github.com/mrdoob/omggif-example) and [omggif](https://github.com/deanm/omggif) library

See `viewers/static/js/model-tag` folder for license related to mrdoob's [model-tag](https://github.com/mrdoob/model-tag) used in `GLTF Legacy` viewer

Google's [Model Viewer](https://github.com/google/model-viewer) element Apache License, Version 2.0 can be seen [here](https://www.apache.org/licenses/LICENSE-2.0)

[glTF Transform](https://gltf-transform.dev) MIT license can be seen [here](https://github.com/donmccurdy/glTF-Transform?tab=MIT-1-ov-file#readme)

[meshoptimizer](https://github.com/zeux/meshoptimizer) MIT license can be seen [here](https://github.com/zeux/meshoptimizer?tab=MIT-1-ov-file#readme)

[web-ifc](https://github.com/ThatOpen/engine_web-ifc) library Mozilla Public License Version 2.0 can be seen [here](https://github.com/ThatOpen/engine_web-ifc?tab=MPL-2.0-1-ov-file#readme)
[web-ifc-three](https://github.com/ThatOpen/web-ifc-three) IFC Loader MIT license can be seen [here](https://github.com/ThatOpen/web-ifc-three?tab=MIT-1-ov-file#readme)

[@jsquash/avif](https://github.com/jamsinclair/jSquash) Apache License, Version 2.0 can be seen [here](https://www.apache.org/licenses/LICENSE-2.0)

[Polyslice](https://github.com/jgphilpott/polyslice) MIT license can be seen [here](https://github.com/jgphilpott/polyslice?tab=MIT-1-ov-file#readme)

[ktx2-encoder](https://github.com/gz65555/ktx2-encoder) MIT license can be seen [here](https://github.com/gz65555/ktx2-encoder?tab=MIT-1-ov-file#readme)

[hdrpng](https://github.com/enkimute/hdrpng.js/) MIT license can be seen [here](https://github.com/enkimute/hdrpng.js/?tab=MIT-1-ov-file#readme)

[JSZip](https://github.com/Stuk/jszip) MIT license can be seen [here](https://github.com/Stuk/jszip?tab=License-1-ov-file#readme)

[UPNG](https://github.com/photopea/UPNG.js) MIT license can be seen [here](https://github.com/photopea/UPNG.js?tab=MIT-1-ov-file#readme)

[Pako](https://github.com/nodeca/pako) MIT license can be seen [here](https://github.com/nodeca/pako?tab=MIT-1-ov-file#readme)

[bitmap2vector](https://github.com/cancerberoSgx/univac) does not appear to have any specific license

[svgo](https://github.com/svg/svgo) MIT license can be seen [here](https://github.com/svg/svgo?tab=MIT-1-ov-file#readme)

The licenses for the [ASSIMPJS](https://github.com/kovacsv/assimpjs) interface and for the [ASSIMP](https://github.com/assimp/assimp) library can be found in the `viewers/static/assimpjs` folder

jQuery license can be seen [here](https://jquery.org/license/)

[Rhino3dm](https://github.com/mcneel/rhino3dm) MIT license can be seen [here](https://github.com/mcneel/rhino3dm?tab=MIT-1-ov-file#readme)

OrbitControlsGizmo MIT licenses can be seen here: [old](https://github.com/Fennec-hub/ThreeOrbitControlsGizmo/blob/master/LICENSE) and [new](https://github.com/Fennec-hub/three-viewport-gizmo?tab=MIT-1-ov-file#readme)

[@monogrid/gaimap-js](https://github.com/MONOGRID/gainmap-js) MIT license can be seen [here](https://github.com/MONOGRID/gainmap-js?tab=MIT-1-ov-file#readme)

[three.quarks](https://github.com/Alchemist0823/three.quarks) MIT license can be seen [here](https://github.com/Alchemist0823/three.quarks?tab=MIT-1-ov-file#readme)
[three.proton](https://github.com/drawcall/three.proton) MIT license can be seen [here](http://www.opensource.org/licenses/mit-license)

[PCX-js](https://github.com/warpdesign/pcx-js) MIT license can be seen [here](https://github.com/warpdesign/pcx-js?tab=MIT-1-ov-file#readme)

TIF/TIFF image file support is powered by the [UTIF.js](https://github.com/photopea/UTIF.js) whose license is included in the `viewers/static/js/utif` folder

PRWM exports are powered by the [PRWM](https://github.com/kchapelier/PRWM) whose licenses can be seen in their respective folders: `viewers/static/js/obj2prwm` and `viewers/static/js/three-buffergeometry-to-prwm`

[nunuStudio](https://github.com/tentone/nunuStudio) MIT license can be seen [here](https://github.com/tentone/nunuStudio?tab=MIT-1-ov-file#readme)

[A-Frame](https://github.com/aframevr/aframe) MIT license can be seen [here](https://github.com/aframevr/aframe?tab=MIT-1-ov-file#readme)

[@pmndrs/drei-vanilla](https://github.com/pmndrs/drei-vanilla#splat) MIT license can be seen [here](https://github.com/pmndrs/drei-vanilla?tab=MIT-1-ov-file#readme)

[Luma WebGL](https://github.com/lumalabs/luma-web-examples) MIT license can be seen [here](https://github.com/lumalabs/luma-web-examples?tab=MIT-1-ov-file#readme)

[OCCT](https://github.com/kovacsv/occt-import-js) licenses are in the `viewers/static/occt-import-js/dist` folder

[loaders.gl](https://github.com/visgl/loaders.gl) MIT license can be seen [here](https://github.com/visgl/loaders.gl?tab=License-1-ov-file#readme)

Some of the above mentioned licenses might also be found in some of the folders within this repository

Notes about modifications, some of which are only added to work with these viewers:

 - MMDLoader.js file has an additional `@param {string} extension` since its code could not extract the file extension from loaded blob
 - MMDLoader.js file includes modification to set resource path for all locally loaded texture blobs
 - GLTFLoader.js file includes modification to set resource path for all locally loaded texture and bin blobs
 - VRMLLoader.js file includes `Switch` case as well as modification to support all locally loaded texture blobs
 - MTLLoader.js file includes modification for local loading of DDS and TGA texture files in OBJ viewer
 - TDSLoader.js file includes modification for both local and URL loading of texture files in 3DS viewer
 - FBXLoader.js file includes modification for both local and URL loading of texture files in FBX viewer
 - PLYLoader.js file includes both "vertex_index" and "vertex_indices"
 - LASZLoader.js file was created with Microsoft Copilot assistance and is using loaders.gl library
 - GCodeLoader.js file is a modified version from: https://github.com/emplast/Threejs-GcodeLoaderNGCfile
 - ColladaLoader.js file includes modification to support THREE.Points
 - ColladaExporter.js file includes modifications for exporting TGA textures as well as supporting THREE.Points
 - OBJExporter.js file includes modification for exporting MTL file & textures
 - LDRAW parts library path is pointing to: https://github.com/gkjohnson/ldraw-parts-library
 - `ddsLoader` section was added to ColladaLoader.js and FBXLoader.js files to support DDS textures
 - OrbitControls.js file has `rotateLeft` and `rotateUp` exposed so the OrbitControlsGizmo could work properly
 - OrbitControlsGizmo file was converted to non-module
 - other minor modifications mainly to module paths to be able to access the `viewers/static/libs` folder
 - some non-breaking code updates, where applicable, as per the latest three.js revisions

