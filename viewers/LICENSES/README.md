

The included MIT license is for three.js files in any of the folders. Notes about other licenses might be included in some three.js files.

License for three.js extensions is in the `viewers/static/jsm/extensions` folder

jQuery license can be seen [here](https://jquery.org/license/)

OrbitControlsGizmo MIT license can be seen [here](https://github.com/Fennec-hub/ThreeOrbitControlsGizmo/blob/master/LICENSE)

TIF/TIFF image file support provided by [geotiffjs](https://github.com/geotiffjs/geotiff.js) whose license can be seen [here](https://github.com/geotiffjs/geotiff.js/blob/master/LICENSE)

[OCCT](https://github.com/kovacsv/occt-import-js) licenses are in the `viewers/static/occt-import-js/dist` folder

Notes about modifications, some of which are only added to work with these viewers:

 - MMDLoader.js file has an additional `@param {string} extension` since its code could not extract the file extension from loaded blob
 - MMDLoader.js file includes modification to set resource path for all locally loaded texture blobs
 - GLTFLoader.js file includes modification to set resource path for all locally loaded texture and bin blobs
 - VRMLLoader.js file includes modification to support all locally loaded texture blobs
 - MTLLoader.js file includes modification for local loading of DDS and TGA texture files in OBJ viewer
 - TDSLoader.js file includes modification for both local and URL loading of texture files in 3DS viewer
 - FBXLoader.js file includes modification for both local and URL loading of texture files in FBX viewer
 - PLYLoader.js file includes "vertex_index" to avoid console error related to non-existing "vertex_indices"
 - LDRAWLoader.js file includes additional color definitions
 - ColladaLoader.js file includes modification for supporting THREE.Points
 - ColladaExporter.js file includes modifications for exporting TGA textures as well as supporting THREE.Points
 - OBJExporter.js file includes modification for exporting MTL file & textures
 - `ddsLoader` section was added to ColladaLoader.js and FBXLoader.js files to support DDS textures
 - OrbitControls.js file has `rotateLeft` and `rotateUp` exposed so the OrbitControlsGizmo could work properly
 - OrbitControlsGizmo file was converted to non-module
 - other minor modifications mainly to module paths to be able to access the `viewers/static/libs` folder

