

The included MIT license is for three.js files in any of the folders.

jQuery license can be seen here: https://jquery.org/license/

OrbitControlsGizmo MIT license can be seen here: https://github.com/Fennec-hub/ThreeOrbitControlsGizmo/blob/master/LICENSE

Notes about modifications:

 - MMDLoader.js file has an additional `@param {string} extension` since its code could not extract the file extension from loaded blob
 - `ddsLoader` section was added to ColladaLoader.js and FBXLoader.js files to support DDS textures
 - OrbitControls.js file has `rotateLeft` and `rotateUp` exposed so the OrbitControlsGizmo could work properly
 - OrbitControlsGizmo file was converted to non-module

