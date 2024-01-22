# GitHubDragonFly.github.io
GitHubDragonFly's Website - access it [here](https://githubdragonfly.github.io).

Designed to serve as a hub with links to repositories, Number Type Converter and FREE online in-browser [three.js](https://threejs.org) based `3D Model` and `Texture` viewers.

Originally designed for a desktop but has been adapted to also show properly on mobile devices with some limitations, see screenshots below for different appearances of the main menu page.

The `M3D` button will open a page to access stripped down and simplified version of mobile friendly 3D viewers:
 - Almost all viewers are currently available and should work fine on desktop devices as well
 - Mobile `Quick Viewer` and `GLTF Viewer` also include export options and more features
 - All mobile testing was done on an Android mobile phone and an iPad
 - Consider bookmarking the [mobile main page](https://githubdragonfly.github.io/viewers/templates/Mobile/index.html) for any continuous access to the viewers

GitHub servers are providing correct access to all files, so cloning or downloading this repository and using it offline will have a reduced functionality if run locally without some server. These GitHub servers are setting `CacheControl` to last only for 10 minutes so you might need to refresh the current page as needed.

Repositories do contain projects in several different programming languages or a mix of: `Java` `VB.Net` `C#` `python` `JavaScript` `jQuery` `HTML/CSS` `shell`.

There is a lot of information and descriptions, some intended for Industrial Automation and some for general or personal use. All is good as an educational resource as well.

For those who either deal with or are just learning about Programmable Logic Controllers (PLC), use whatever you can from my repositories and then make the [AdvancedHMI](https://www.advancedhmi.com/) website your next stop for highly functional FREE software.

Intro video shows how to start using 3D viewers by loading model files from a hard drive. It was captured by using the free and open source [OBS Studio](https://github.com/obsproject/obs-studio) software.

# Mozilla Firefox screenshots

Main Menu Page (desktop)

![Desktop Start Page](images/screenshot.png?raw=true)

Main Menu Page (mobile)

![Mobile Start Page](images/screenshot_mobile.jpg?raw=true)

# Notes about Number Type Converter

- Appears to be fully functional for conversion between binary, hex, octal, signed and unsigned 8 / 16 / 32 / 64 / 128-bit integers and 32 / 64-bit floating-point numbers
- This is an online version of the Windows App found [here](https://github.com/GitHubDragonFly/Number_Type_Converter) so check its description
- An open mind and some knowledge of number systems, hopefully binary, will help understand the displayed values
- Not all numbers might be easily visible on mobile devices so use only when needed
- Possibly of good use to those who deal with Programmable Logic Controllers (PLC) and students
- Note about float parser: if it encounters an invalid character, as per standard number rules, then it will stop and complete parsing of the string as a valid number which was present up to that point (ex. if you would enter `-75-88.5` under Float32 then it will be parsed as `-75`)
- Integer representation of the floating-point values might be inaccurate due to precision and / or rounding

Number Type Converter
![Number Type Converter](images/Number%20Type%20Converter.png?raw=true)

# Notes about three.js based 3D Model Viewers

- They are functional `AS THEY ARE` and intended for viewing a single 3D model or scene
- Several different three.js revisions are being used and there is lots of customized code
- If you wish to modify or customize your 3D model then use either the official [three.js editor](https://threejs.org/editor/) or try its [customized version](https://github.com/GitHubDragonFly/Localized_3js)
- These would be the mouse controls:
  - Rotation = left-click + hold + drag
  - Move = right-click + hold + drag
  - Zoom In / Out = mouse scroll wheel

- Notes about A-FRAME Viewer:
  - It is using [A-Frame Library / Framework](https://aframe.io) which makes it A-Frame specific
  - It is currently highly experimental so not sure if everything works as it should be
  - It is supposed to be used mainly on mobile devices supporting AR / VR
  - Supported formats (single model or scene only): BIM, DAE, FBX, GLB, GLTF, PLY, USDZ:
    - Local and remote URL loading is supported
    - Local model files should be self-contained (embedded or binary)

- Notes about SPLAT Viewer:
  - It is using [@pmndrs/drei-vanilla](https://github.com/pmndrs/drei-vanilla#splat) splat loader built around [antimatter15/splat](https://github.com/antimatter15/splat)
  - Supports both local blob and remote URL loading
  - It requires a good and fast graphics hardware
  - There is an untested VR button available
  - Only APNG exporter is available
  - For converting your PLY files to splat you could use:
    - the original [WebGL Gaussian Splat Viewer](https://antimatter15.com/splat/)
    - [Super Splat](https://playcanvas.com/super-splat) editor
  - Here is a URL for the lego brick splat model, made of points and available in my repository, that you can use for testing:
    - `https://raw.githubusercontent.com/GitHubDragonFly/GitHubDragonFly.github.io/main/viewers/examples/legobrick.splat`
  - This viewer also supports loading of Luma Splats URLs:
    - An example URL to use for testing `https://lumalabs.ai/capture/ca9ea966-ca24-4ec1-ab0f-af665cb546ff`
    - More info on [Luma WebGL Library](https://lumalabs.ai/luma-web-library)
    - [Luma AI](https://lumalabs.ai/) website appears to have an iOS App available for capturing luma splats

- Notes about GLTF viewers:
  - `GM Viewer` is for v2.0 glTF files and is currently using Google's [model-viewer](https://github.com/google/model-viewer) web component:
    - Supports both local (blob) and remote URL loading
    - Local loading only supports self-contained models (embedded GLTF or binary GLB)
    - The viewer supports loading of multiple models, switchable with the viewer's `M` button
    - Error handling narrows down to showing the `ERROR!` message so check the console output for details 
    - Support for USDZ was also added but is untested
  - `GLTF Viewer` is for v2.0 glTF files and is currently using r160 of three.js:
    - doesn't support obsolete `pbrSpecularGlossiness`
    - supports currently arbitrary `KHR_animation_pointer`
  - `GLTFS Viewer` is for v2.0 glTF files and is currently using r150 of three.js:
    - supports obsolete `pbrSpecularGlossiness`
    - doesn't support either `Anisotropy` or currently arbitrary `KHR_animation_pointer`
  - `GLTF Legacy` viewer is for v1.0 glTF files and is purely experimental and rather limited (see notes further below)

- Special notes about `ASSIMP Viewer` which is using [ASSIMPJS](https://github.com/kovacsv/assimpjs) interface and [ASSIMP](https://github.com/assimp/assimp) library:
  - This is a revamped version of my GLTF Viewer and is a sort of ASSIMP(JS) / three.js hybrid
  - It can be used instead of both GLTF v1.0 and v2.0 viewers and also provides more export options, here is an example URLs for GLTF v1.0 of the [Barramundi Fish](https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/1.0/BarramundiFish) so just pay attention to the special case of the `glTF + BIN + textures` formatting:
    - `https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/1.0/BarramundiFish/glTF-Binary/BarramundiFish.glb`
    - `https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/1.0/BarramundiFish/glTF-Embedded/BarramundiFish.gltf`
    - `https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/1.0/BarramundiFish/glTF/BarramundiFish.gltf, https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/1.0/BarramundiFish/glTF/BarramundiFish.bin, https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/1.0/BarramundiFish/glTF/BarramundiFish_texture_0001.jpg, https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/1.0/BarramundiFish/glTF/BarramundiFish_texture_0002.jpg, https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/1.0/BarramundiFish/glTF/BarramundiFish_texture_0003.jpg, https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/1.0/BarramundiFish/glTF/BarramundiFish_texture_0004.jpg, https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/1.0/BarramundiFish/glTF/BarramundiFish0FS.glsl, https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/1.0/BarramundiFish/glTF/BarramundiFish0VS.glsl`
  - Might have bugs and interface / library related limitations and slow to load some models
  - It tries to take advantage of the `THREE.MeshPhysicalMaterial` to bring a GLTF alike functionality for OBJ + MTL models
  - Has multiple export options available, with special notes about JSON formats:
    - Try using [JSON Viewer](https://githubdragonfly.github.io/viewers/templates/JSON%20Viewer.html) to see all models exported as `JSON`
    - Try using [JSON Legacy](https://githubdragonfly.github.io/viewers/templates/JSON%20Legacy.html) viewer to see all models exported as `ASSJSON`
    - Both `JSON` and `ASSJSON` exported files use the same `.json` extension
  - GLTF / GLB v2.0 and DRC models will be handled by three.js, as originally intended, and there is no special URL formatting required for `glTF + BIN + textures` (just use the URL of the GLTF model)
  - All other formats, including GLTF / GLB v1.0, will be initially handled by ASSIMP(JS), converted to `GLB2` and passed on to the three.js `GLTF Loader` for displaying
  - Supported formats: 3D, 3DS, 3MF, A3D, AC, AC3D, ACC, AMF, ASE, B3D, BLEND, BVH, COB, CSM, DAE, DRC, DXF, FBX, GLB, GLTF + BIN, HMP, IFC, IQM, IRR, IRRMESH, KMZ, LWO, LWS, LXO, MD2, MD3, MD5MESH, MDC, MDL, MESH, MS3D, NDO, NFF, OBJ + MTL, OFF, OGEX, PK3, PLY, PMX, Q3O, Q3S, RAW, SIB, SMD, STL, TER, X, X3D, XGL, XML, ZAE, ZGL
  - Unsupported formats: BSP, JT, M3, WRL
    - the viewer will allow you to select these files but they didn't work for me
  - [M3D](https://bztsrc.gitlab.io/model3d/) format is disabled since no longer maintained within ASSIMP
  - When using the viewer's `URL` option remember the following:
    - BIN and / or MTL file URLs might need to be added alongside the model URL and comma separated, this would normally apply to some GLTF and OBJ files, for example:
      - `https://raw.githubusercontent.com/assimp/assimp/master/test/models/OBJ/spider.obj, https://raw.githubusercontent.com/assimp/assimp/master/test/models/OBJ/spider.mtl`
      - `https://raw.githubusercontent.com/assimp/assimp/master/test/models/glTF/CesiumMilkTruck/CesiumMilkTruck.gltf, https://raw.githubusercontent.com/assimp/assimp/master/test/models/glTF/CesiumMilkTruck/CesiumMilkTruck.bin`
    - For MD2 models you would have to add their texture URL, for example:
      - `https://raw.githubusercontent.com/assimp/assimp/master/test/models/MD2/faerie.md2, https://raw.githubusercontent.com/assimp/assimp/master/test/models/MD2/faerie2.bmp`
    - If textures are not automatically fetched with the model URL only then add the texture location URL, for example:
      - `https://raw.githubusercontent.com/SaschaWillems/VulkanSponza/master/data/sponza.dae, https://raw.githubusercontent.com/SaschaWillems/VulkanSponza/master/data/sponza/`
      - `https://raw.githubusercontent.com/oecax2208/PyMikuMikuDance/master/example/vdproject_peach_v1/小桃初代女仆v1.pmx, https://raw.githubusercontent.com/oecax2208/PyMikuMikuDance/master/example/vdproject_peach_v1/Texture/`

- Special notes about mobile `Quick Viewer` which is using [Online 3D Viewer engine](https://github.com/kovacsv/Online3DViewer) and [occt-import-js](https://github.com/kovacsv/occt-import-js) library:
  - It is purely online based and can be used as standalone HTML file (just delete `favicon.ico` import)
  - It can currently export to BIM, PLY, STL, OBJ, OFF, GLB and GLTF formats even on a mobile phone (as tested on an Android device)
  - Supported import formats: 3DS, 3DM, 3MF, AMF, BIM, BREP, BRP, DAE, FBX, GLB, GLTF + BIN, IFC, IGES, IGS, OBJ + MTL, OFF, PLY, STL, STEP, STP, WRL
  - Unsupported import format: FCSTD (requires accessing a remote worker)
  - Loading via URL currently requires all model files URLs and comma separated (no files will be fetched automatically), here is an example for Khronos [CesiumMilkTruck](https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/CesiumMilkTruck):
    - `https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMilkTruck/glTF/CesiumMilkTruck.gltf, https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMilkTruck/glTF/CesiumMilkTruck_data.bin, https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMilkTruck/glTF/CesiumMilkTruck.jpg`
  - For proper viewing and additional features try using the actual [Online 3D Viewer](https://3dviewer.net/) website
  - Might have bugs and library related limitations
  - Most of the following notes do not apply to Quick Viewer in general

- Special notes about `USDZ Viewer`:
  - Currently, it only supports USDZ files with USDA (ascii) model packed in
  - USDZ files with USDC (binary) model packed in can be viewed with the following:
    - [USDZ Online Viewer](https://www.usdz-viewer.net/)
    - [USD Viewer](https://usd-viewer.glitch.me/?file=)
      - this viewer can also be used as a workaround to export the model to GLB format and then use my [GLTF Viewer](https://githubdragonfly.github.io/viewers/templates/GLTF%20Viewer.html) or [three.js editor](https://threejs.org/editor/) to export it to USDZ with USDA packed in

- Special notes about `GLTF Legacy` viewer which is using modified version of mrdoob's [model-tag](https://github.com/mrdoob/model-tag):
  - Set in 500 x 500 viewport and seems to have a good fit on mobile devices
  - It is relatively simple and might have bugs and limitations
  - Supported import formats: GLTF v1.0 + BIN + Textures
  - Unsupported import formats: GLB
  - It can export to GLTF / GLB v2.0 and OBJ formats (animations are not currently supported)
  - Use ASSIMP Viewer instead since it has less limitations and more export options
  - Most of the following notes do not apply to GLTF Legacy viewer in general

- Menu with controls can be located either on top or on the bottom of the page
- Almost all viewers include the interactive [Orbit Controls Gizmo](https://github.com/Fennec-hub/ThreeOrbitControlsGizmo) for orientation
- Most viewers, if not all, have been tested as functional in the latest Firefox / Chrome / Edge / Safari browsers
  - do note that mobile Safari browser might be finicky about certain features
- See `URLS4MODELS.md` file for URL examples
- Some loading instructions also available in [HTML_CSS_JS_Flask](https://github.com/GitHubDragonFly/HTML_CSS_JS_Flask) and [HTML_CSS_JS](https://github.com/GitHubDragonFly/HTML_CSS_JS) repositories
- ZIP files and drag-and-drop are currently not supported
- Import files locally from a file browser dialog:
  - All files have to be in the same folder
  - Some viewers might have some limitations
  - Possibly update your models to look for textures in the same folder
  - Make any necessary changes on your device to allow local file browsing
- Import files via remote URL:
  - Multiple comma separated URLs are allowed in some viewers and can be from mixed websites
  - Some viewers do support Dropbox and GitHub and URLs without extension (normally applicable to single URL)
  - URLs should have no CORS restrictions
- Import formats, where applicable, with any optional or required textures:
  - 3DS, 3DM, 3MF, AMF, DAE, FBX, IFC, JSON, OBJ + MTL, PCD, PDB, PLY, VTK, VTP, STL, PRWM, USDZ, WRL, XYZ
  - GLTF supported formats: GLB, GLTF + BIN, DRC
  - GCODE supported formats: GCODE, NCC, NGC
  - LDRAW supported formats: DAT, L3B, LDR, MPD
  - MMD ( Miku Miku Dance ) supported formats: PMD, PMX, VMD, VPD, SPA, SPH, MP3, OGG
  - OCCT supported formats: STEP, STP, IGES, IGS, BREP, BRP, BIM
    - STEP Viewer is using [occt-import-js](https://github.com/kovacsv/occt-import-js) and a modified version of [dotbim.three.js](https://github.com/ricaun/dotbim.three.js)
- Export formats, where applicable:
  - 3DM, DAE, APNG, FBX, M3D, X3D, X, ASSJSON, GIF, GLB, GLTF, JSON, OBJ + MTL, PLY, STL, PRWM, USDZ
    - Try not to change file names when saving files during initial export
    - Exporting some models might crash the browser when running out of memory 
    - Exporting some models might be easier / better done with multiple viewers, examples:
      - MMD -> OBJ and then OBJ -> JSON might be better than straight MMD -> JSON export
      - IFC -> GLB and then GLB -> GLB_m (with MESHOPT compression) and then GLB_m -> GLB_d (with DRACO compression) might be easier than straight IFC -> GLB_d export
    - DAE, GLB, GLTF, JSON, OBJ + MTL, PLY, STL, USDZ exporters are [three.js](https://github.com/mrdoob/three.js) based
    - 3DM exports are powered by [rhino3dm](https://github.com/mcneel/rhino3dm)
      - Currently limited to exporting meshes without textures and points only
      - GLTFS Viewer might produce richer colors in exported 3DM models than GLTF Viewer
    - PRWM exports are powered by [PRWM](https://github.com/kchapelier/PRWM)
    - ASSJSON / FBX / M3D / X3D / X exports are powered by [ASSIMPJS](https://github.com/kovacsv/assimpjs) / [ASSIMP](https://github.com/assimp/assimp)
    - Animated GIF export is based on mrdoob's [example](https://github.com/mrdoob/omggif-example) using [omggif](https://github.com/deanm/omggif) library:
      - currently set to 500 x 500 size in the centre of the window
      - the approximate GIF area rectangle will be shown during the GIF generation
      - if the model leaves this area during the GIF generation, due to its motion, the process might error out
      - the larger the model and / or the more colors in the model will affect the size / quality of the resulting GIF file
      - it disregards the background color but does observe the background image with simple color palette
      - consider changing Directional Light color and / or using Ambient Light to avoid poor quality GIF for some models
      - non-animated models will spin 360 degrees
      - see the `legobrick` generated GIF examples and their optimized / resized version in the `images` folder
    - Animated PNG (APNG) exports are powered by [UPNG.js](https://github.com/photopea/UPNG.js) and [Pako.js](https://github.com/nodeca/pako)
      - almost the same features as in the Animated GIF export, see above
      - use some background image to avoid visual anomalies (artifacts) in the resulting file due to transparency:
        - where applicable, use the `Eq` checkbox to apply equirectangular scene background
        - where applicable, use the `G` button to add grayish linear gradient as a scene background
        - use `black.gif` or `white.gif` or `dark_blue.png` files found in the `images` folder as a simple choice for background image
      - see the `legobrick` generated (A)PNG example and its optimized / resized version in the `images` folder
      - currently set for full color PNG but can be changed to Lossy PNG to speed up processing (see the comment in the code)
    - JSON export is actually three.js created format
    - USDZ exporter tips:
      - Handles GLTF / GLB formats the best due to their use of the THREE.MeshStandardMaterial
      - Optionally export your 3D model to GLB format first, including GLB files that might be using compressed textures, and then export it to USDZ format
      - Exported USDZ files should work in the Apple's Quick Look (as tested on an iPad)
      - Viewers which include this exporter will try to export the model automatically
    - OBJ + MTL exporter and loaders try to take advantage of the THREE.MeshPhysicalMaterial to bring a GLTF alike functionality
      - Check the `OBJ_MTL_PBR.md` file for the exported MTL entries description
    - OBJ exporter might currently, along with the exported MTL file, export multiple copies of the same texture but under different names:
      - Select 1 copy of the texture and rename it if you wish, then update the corresponding MTL file entries to point to that texture
      - Delete all other copies of that same texture
      - This bug has been corrected for most models I tested but some odd models might still sneak by
    - DAE (Collada) exporter might currently export multiple copies of the same texture but under different names:
      - Select 1 copy of the texture and rename it if you wish, then update the corresponding `<init_from>` lines inside the `<library_images>` section of the DAE file to point to that texture
      - Delete all other copies of that same texture
      - This bug might eventually get fixed
    - PLY exporter will include vertex colors and will convert material color to vertex color if the material has no texture
  - BIM and OFF exports are only available in Quick Viewer, as stated above
  - GLB exports, where applicable, can additionally have either DRACO or DRACO+WEBP or MESHOPT or MESHOPT+WEBP compression applied by using [glTF Transform](https://gltf-transform.dev):
    - These exports are marked as either of: `GLB_d` `GLB_dw` `GLB_m` `GLB_mw` (for regular exports) `GLBx_d` `GLBx_dw` `GLBx_m` `GLBx_mw` (for alternative exports)
    - Seem to work fine in general but might not be good for some rare models
  - Some viewers also offer alternative exports marked as `OBJx` `DAEx` `GLTFx` `USDZx`:
    - Should be tried either out of curiosity or if their regular export counterparts don't produce good results
    - Might even produce smaller exported file size than regular export
    - If applicable, will support exporting THREE.InstancedMesh to OBJ + MTL / DAE / USDZ as well
    - If applicable, will support exporting morph animations but will not export other animations
  - Some viewers also offer setting the exported textures resolution and Y flip
  - GLTFS Viewer seems to do OK job in exporting models with `pbrSpecularGlossiness`
- Buttons, where applicable:
  - `A` - animations
  - `E` - edges
    - `EC` - edge color
  - `F` - flatShading
  - `G` - linear gradient background
  - `I` - raycasting intersects (VTK Viewer)
  - `K` - kinematics (DAE viewer)
  - `L` - lines (LDRAW and its exports in GLTF, OBJ, JSON viewers)
  - `O` - opacity
  - `P` - poses (MMD viewer)
  - `S` - skeleton with demo (JSON viewers)
  - `T` - textures
  - `V` - variants (GLTF viewer)
  - `W` - wireframe (available on simple mobile viewers only)
  - `X` - morphs
  - `As` - and / or `atoms` button (available in PDB viewers only)
  - `Bs` - and / or `bonds` button (available in PDB viewers only)
  - `C0` - camera index, with 0 being default (GLTF viewer) (`CAM` + Index in GLTF Legacy viewer)
  - `CS` - construction step (LDRAW viewer)
  - `Ls` - and / or `labels` button (available in PDB viewers only)
  - `MP` - material switching - Phong (MP), Standard (MS), Lambert (ML)
  - `OL` - outline effect (MMD Viewer)
  - `OS` - material side - Original (OS), Front (FS), Back (BS), Double (DS)
  - `PM` - show model as points (PLY+STL / PRWM / VTK viewers)
  - `VC` - vertex colors
    - `!` - random vertex colors
  - `XS` - xtra smooth
  - `RST` - reset
  - `#` - grid
- Light controls, where applicable:
  - `AL` - ambient light
    - `ALi` - ambient light intensity
  - `DL` - directional light
    - `DLi` - directional light intensity
  - `HL` - hemisphere light
  - `SL` - spotlight
    - `SLi` - spotlight intensity
- Other controls, where applicable:
  - `B` or `BG` - background color
  - `C` - object or points color
  - `Eq` - equirectangular background
    - `setEnvMap` for setting envMap + metalness
    - `toneMapping` with `exposure`
    - scene background controls:
      - `blurriness`
      - `intensity`
- JSON viewers support three.js and assimp JS / JSON formats with limitations:
  - JSON Viewer is currently using r160 of three.js and cannot open legacy formats
  - JSON Legacy viewer is using r111 of three.js to support legacy THREE.Geometry:
    - It is using 4 loaders: ObjectLoader, BufferGeometryLoader, LegacyJSONLoader and AssimpJSONLoader
    - It could possibly open and export current three.js JSON format, with limitations of r111
    - Some animations and/or skeletons might be off or missing
- GLTF / FBX / DAE viewers will also include animations to exported JSON format
- 3DS viewer is using MeshPhysicalMaterial instead of MeshPhongMaterial
- PLY+STL / PRWM / VTK viewers can also show a points version of the loaded model and export it as such (if the model is not rather large):
  - export this points model into PLY format and then drop it into [WebGL Gaussian Splat Viewer](https://antimatter15.com/splat/) to get splat file
- Using Animated GIF as a texture is experimental and powered by modified [gif-loader](https://github.com/movableink/three-gif-loader) using [omggif](https://github.com/deanm/omggif) library
    - currently available only in `FBX` `OBJ` `PLY+STL` `PRWM` viewers and should be tried on simple models
    - see the Animated GIF of a cube using Animated GIF as a texture in the `images` folder
- Tips:
  - if the model is correctly loaded but you cannot see it then try any or all of the following:
    - apply `edges`
    - zoom `in/out` or apply `Scale`
    - apply `flatShading`
    - apply `Vertex Colors` and `Random Vertex Colors`
    - change `ambient light` to white
    - change `background color` to white
  - experiment with all exporters available by exporting the original model as well as its exported versions
  - large resolution textures should be scaled down before loading, as an example download [`Bedroom`](https://casual-effects.com/data/index.html) with 8k images and try it as is and then scale them down to 1k or 2k (which will speed up loading in browsers)
  - you could also try using [COLLADA2GLTF](https://github.com/KhronosGroup/COLLADA2GLTF) and [FBX2glTF](https://github.com/facebookincubator/FBX2glTF) and [Online 3D Viewer](https://3dviewer.net) exporters / converters

PLY+STL Viewer
![PLY+STL Viewer](images/PLY%20Viewer.png?raw=true)

# Notes about three.js Texture Viewer

- Supporting PNG, APNG, JPG, JPEG, JFIF, PJPEG, PJP, BMP, DIB, GIF, TIF, TIFF, WEBP, TGA, SVG, DDS, KTX, KTX2, EXR, HDR, BASIS and Lottie JSON texture files as well as MP4 / WEBM / OGV video files and M4A / M4B / OGG audio files
- Animated GIF file support is powered in part by [omggif](https://github.com/deanm/omggif) and displayed with [THREE.CSS2DRenderer](https://threejs.org/docs/#examples/en/renderers/CSS2DRenderer)
- Animated PNG file support is powered in part by [UPNG.js](https://github.com/photopea/UPNG.js) and displayed with [THREE.CSS2DRenderer](https://threejs.org/docs/#examples/en/renderers/CSS2DRenderer)
- Animated WEBP file is displayed with [THREE.CSS2DRenderer](https://threejs.org/docs/#examples/en/renderers/CSS2DRenderer)
- All of the above animated files are "view only" so most viewer controls will not have any effect and will be disabled
- TIF / TIFF image file support is powered by [UTIF.js](https://github.com/photopea/UTIF.js)
- Use the `T` button to switch between textures
- Texture is displayed on a rotatable plane which can also be moved and zoomed in / out
- Rotation / Move / Zoom are not applicable to Animated GIF - PNG - WEBP and / or video files (gizmo will disappear)
- Video player has its own controls for playback and full-screen switching
- URL text box also allows entering a single base64 string of the image data, see the `URLS4MODELS.md` file for an example
- For certain formats and their manipulation an easy alternative to this viewer would be `https://ezgif.com`
- Most of these files can easily be viewed with some operating system applications or by the browsers themselves (like animated GIF / PNG / WEBP or MP4 / WEBM / OGV videos):
  - all it takes in Windows, for example, is to right-click the file itself then choose `Open With` and select `Firefox` browser
  - Windows users could also consider getting the [QuickLook](https://apps.microsoft.com/store/detail/quicklook/9NV4BS3L1H4S) app

![Texture Viewer](images/Texture%20Viewer.png?raw=true)

# License

This is all MIT licensed but please observe any other licenses that might be applicable to some files or content.

# Trademarks

Any and all trademarks, either directly or indirectly mentioned in this project, belong to their respective owners.
