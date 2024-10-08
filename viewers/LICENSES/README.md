

The included MIT license is for three.js files in any of the folders. Notes about other licenses might be included in some three.js files.

License for the three.js extensions is in the `viewers/static/jsm/extensions` folder

See `viewers/static/js/omggif` folder for licenses and Animated GIF export info, related to mrdoob's [example](https://github.com/mrdoob/omggif-example) and [omggif](https://github.com/deanm/omggif) library

See `viewers/static/js/model-tag` folder for license related to mrdoob's [model-tag](https://github.com/mrdoob/model-tag) used in `GLTF Legacy` viewer

The licenses for the [ASSIMPJS](https://github.com/kovacsv/assimpjs) interface and for the [ASSIMP](https://github.com/assimp/assimp) library can be found in the `viewers/static/assimpjs` folder

See `viewers/static/js/jszip/dist` folder for license related to [JSZip](https://stuk.github.io/jszip/) used for zipping up exported models

jQuery license can be seen [here](https://jquery.org/license/)

OrbitControlsGizmo MIT license can be seen [here](https://github.com/Fennec-hub/ThreeOrbitControlsGizmo/blob/master/LICENSE)

TIF/TIFF image file support is powered by the [UTIF.js](https://github.com/photopea/UTIF.js) whose license is included in the `viewers/static/js/utif` folder

PRWM exports are powered by the [PRWM](https://github.com/kchapelier/PRWM) whose licenses can be seen in their respective folders: `viewers/static/js/obj2prwm` and `viewers/static/js/three-buffergeometry-to-prwm`

APNG image file support is, apart from three.js, also powered by the [UPNG.js](https://github.com/photopea/UPNG.js) and the [Pako.js](https://github.com/nodeca/pako) whose licenses can be seen in their respective folders: `viewers/static/js/upng` and `viewers/static/js/pako`

[OCCT](https://github.com/kovacsv/occt-import-js) licenses are in the `viewers/static/occt-import-js/dist` folder

Notes about modifications, some of which are only added to work with these viewers:

 - MMDLoader.js file has an additional `@param {string} extension` since its code could not extract the file extension from loaded blob
 - MMDLoader.js file includes modification to set resource path for all locally loaded texture blobs
 - GLTFLoader.js file includes modification to set resource path for all locally loaded texture and bin blobs
 - VRMLLoader.js file includes `Switch` case as well as modification to support all locally loaded texture blobs
 - MTLLoader.js file includes modification for local loading of DDS and TGA texture files in OBJ viewer
 - TDSLoader.js file includes modification for both local and URL loading of texture files in 3DS viewer
 - FBXLoader.js file includes modification for both local and URL loading of texture files in FBX viewer
 - PLYLoader.js file includes both "vertex_index" and "vertex_indices"
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

