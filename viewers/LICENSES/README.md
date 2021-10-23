

The included MIT license is for three.js files in any of the folders.Notes about other licenses might be included in some three.js files.

License for three.js extensions is in the `viewers/static/jsm/extensions` folder

jQuery license can be seen here: https://jquery.org/license/

OrbitControlsGizmo MIT license can be seen here: https://github.com/Fennec-hub/ThreeOrbitControlsGizmo/blob/master/LICENSE

Notes about modifications:

 - MMDLoader.js file has an additional `@param {string} extension` since its code could not extract the file extension from loaded blob
 - MMDLoader.js file includes modification to set resource path for all locally loaded texture blobs
 - `ddsLoader` section was added to ColladaLoader.js and FBXLoader.js files to support DDS textures
 - OrbitControls.js file has `rotateLeft` and `rotateUp` exposed so the OrbitControlsGizmo could work properly
 - OrbitControlsGizmo file was converted to non-module
 - other minor modifications mainly to module paths to be able to access the `viewers/static/libs` folder

