# GitHubDragonFly.github.io
GitHubDragonFly's Website - access it [here](https://githubdragonfly.github.io).

Even though this is all usable, none of it is perfect so try to set your expectations accordingly.

The description below is a bit lengthy but should provide pertinent information.

Pictures or intro video might not reflect the current looks of any GUI.

This website is designed to serve as a hub with links to:
  - My repositories
  - Number Type Converter
  - [nunuStudio](https://github.com/tentone/nunuStudio/tree/master/source/page/src/examples) games and experiences examples
  - FREE online in-browser [three.js](https://threejs.org) based `3D Model` and `Texture` viewers.

Originally designed for a desktop but has been adapted to also show properly on mobile devices with some limitations:
  - See screenshots below for different appearances of the main menu page
  - As per the [PageSpeed Insights](https://pagespeed.web.dev/) basic tests, almost all the pages / code:
    - **Are highly performant**:
      - relatively scored depending on how busy and responsive `github` `cdn.jsdelivr.net` `esm.sh` networks are at the time of testing
    - **Follow Best Practices**
    - **Are SEO optimized**
    - **Are Accessibility optimized** (AODA in Ontario)
      - keyboard users might be somewhat limited to what's implemented within three.js library

The `M3D` button, which stands for `Mobile 3D`, provides access to:
 - Simple Cube Shading example
 - nunuStudio Games and Experiences examples
   - not as functional and visually appealing as on a desktop but made available regardless
 - Stripped down and simplified version of mobile friendly 3D viewers:
   - Almost all viewers are currently available and should work fine on desktop devices as well
   - Mobile `Quick Viewer`, `GM Viewer` and `GLTF Viewer` also include some export options and more features
   - Consider bookmarking the [mobile main page](https://githubdragonfly.github.io/viewers/templates/Mobile/index.html) for continuous access to all viewers
   - Consider bookmarking any single viewer's link for continuous access to that particular viewer
   - Consider using WiFi connection, whenever possible, since the library files still need to be downloaded
   - All mobile testing was done on an Android mobile phone and an iPad

GitHub servers are providing correct access to all files:
  - Cloning or downloading this repository and using it offline will have a somewhat reduced functionality if run locally without some server
  - These GitHub servers are also setting `CacheControl` to last only for 10 minutes so you might need to refresh the current page as needed
  - No cookies will be served by my pages

Repositories do contain projects in several different programming languages, or a mix of: 
 - `HTML / CSS / JavaScript / jQuery`
 - `Java`
 - `VB.Net`
 - `C#`
 - `python`
 - `shell`

There is a lot of information and descriptions, some intended for Industrial Automation and some for general or personal use. All is good as an educational resource as well.

For those who either deal with or are just learning about Programmable Logic Controllers (PLC):
 - Use whatever you can from my repositories
 - Make the [AdvancedHMI](https://www.advancedhmi.com/) website your next stop for highly functional FREE software.

The `Intro` button on the main page will connect to the video that shows how to start using 3D viewers by browsing and loading model files from a hard drive:
 - Opening models via any viewer's `URL` option might be simpler than browsing locally, provided that you have the actual model's URL available
 - This video was captured by using the free and open source [OBS Studio](https://github.com/obsproject/obs-studio) software

Videos available in my other repositories were also captured by the OBS Studio.

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

# Notes about nunuStudio Games and Experiences Examples

- This page is just showcasing the [nunuStudio](https://github.com/tentone/nunuStudio) games and experiences examples
- These examples are interesting and could keep you busy and entertained for a little while
- Designed for a desktop, might not be as good on mobile devices but are available regardless:
  - As for the AR / VR experience, `AR` and/or `VR` button should remain visible if your device supports it:
    - got at least VR working on an Android phone with Chrome + Cardboard
- The code of my page shows how to import and use the latest available nunuStudio version from CDN
- The nunuStudio repository has not been updated in a while and appears to have some unresolved issues

# Notes about three.js based 3D Model Viewers

- They are functional `AS THEY ARE`
- Purely designed as an online convenience
- Intended for viewing a single 3D model or scene
- Memory handling should be good, relatively speaking:
  - With every next model loaded the previous model geometries / materials are being disposed of
  - Viewers are webpages so it might be easier to refresh the whole page before loading the next model
- Desktop viewers should be usable on as low as 800 x 600 screen resolution:
  - Page zoom might need to be adjusted to keep controls uncluttered
  - There is a full-screen switching button which can also help or just use your browser shortcut keys
  - 640 x 480 screen resoultion should also work but might present a limited workspace and visibility
  - Workaround for any low resolution is to use stripped down and mobile friendly viewers instead
- Different [three.js](https://github.com/mrdoob/three.js) revisions are used throughout and with lots of customized code:
  - Most viewers page title should show what three.js revision is used
- Error handling narrows down to showing the `ERROR!` message so check the console output for details
- On a desktop computer, most viewers will show some renderer info in the console after the model is loaded (like number of draw calls, triangles ... etc)
- To modify or customize your 3D model, use either the official [three.js editor](https://threejs.org/editor/) or try its [customized version](https://github.com/GitHubDragonFly/Localized_3js)
  - Additional tool for textures, requires an account and compatible hardware: [NVIDIA Texture Tools Exporter](https://developer.nvidia.com/texture-tools-exporter)
- These would be the mouse controls:
  - Rotation = left-click + hold + drag
  - Move = right-click + hold + drag
  - Zoom In / Out = mouse scroll wheel
  - The equivalent touch controls should work fine on mobile devices
  - Hover the mouse over controls in the desktop viewers to se a popup description of the control:
    - If the control is not disabled then it might show a red border around it (applicable to button, color and select controls)

- Special notes about `AR / VR Viewer`:
  - Using slightly modified version of the three.js `DeviceOrientationControls`, last available in r133
  - Currently highly experimental so it might work or it might not work properly or at all
  - My tests had it working with Chrome browser on both the desktop and an Android mobile phone:
    - Either as a standard viewer or with AR / VR support
  - Supported import formats (single model or scene only):
    - 3MF, BIM, DAE, FBX, GLB, GLTF, PLY, USDZ
    - Local blobs and remote URL loading are supported
      - Local model files should be self-contained (embedded or binary)
  - Currently available features:
    - Model resizing
    - Auto rotation
    - Equirectangular background

- Special notes about `A-FRAME Viewer`:
  - It is using [A-Frame Library / Framework](https://aframe.io) which makes it A-Frame specific
  - It is currently highly experimental so not sure if everything works as it should be
  - It is supposed to be used mainly on mobile devices supporting AR / VR
  - Supported import formats (single model or scene only):
    - BIM, DAE, FBX, GLB, GLTF, PLY, USDZ
    - Local blobs and remote URL loading are supported
      - Local model files should be self-contained (embedded or binary)

- Special notes about `SPLAT Viewer`:
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
    - More info on [Luma WebGL Library](https://github.com/lumalabs/luma-web-examples)
    - [Luma AI](https://lumalabs.ai/) website appears to have an iOS App available for capturing luma splats

- Special notes about GLTF viewers:
  - `GM Viewer` is for v2.0 glTF files and is currently using Google's [model-viewer](https://github.com/google/model-viewer) web component:
    - Supports both local (blob) and remote URL loading
    - Local loading supports self-contained models (embedded GLTF or binary GLB) as well as GLTF + BIN + Textures
    - The viewer supports loading of multiple models at once, which will be switchable with the viewer's `M` button
  - `GLTF Viewer` is for v2.0 glTF files and is currently using r167 of three.js:
    - does not support obsolete `pbrSpecularGlossiness`
    - supports currently arbitrary `KHR_animation_pointer`
  - `GLTFS Viewer` is for v2.0 glTF files and is currently using r150 of three.js:
    - supports obsolete `pbrSpecularGlossiness`
    - does not support either `Anisotropy` or currently arbitrary `KHR_animation_pointer`
  - `GLTF Legacy` viewer is for v1.0 glTF files and is purely experimental and rather limited (see notes further below)

- Special notes about `ASSIMP Viewer` which is using [ASSIMPJS](https://github.com/kovacsv/assimpjs) interface and [ASSIMP](https://github.com/assimp/assimp) library:
  - This is a revamped version of my GLTF Viewer and is a sort of ASSIMP(JS) + three.js hybrid
  - It can be used instead of both GLTF v1.0 and v2.0 viewers and also provides more export options
  - Here are example URLs for GLTF v1.0 of the [Barramundi Fish](https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/1.0/BarramundiFish) so just pay attention to the special case of the `glTF + BIN + textures` formatting:
    - `https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/1.0/BarramundiFish/glTF-Binary/BarramundiFish.glb`
    - `https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/1.0/BarramundiFish/glTF-Embedded/BarramundiFish.gltf`
    - `https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/1.0/BarramundiFish/glTF/BarramundiFish.gltf, https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/1.0/BarramundiFish/glTF/BarramundiFish.bin, https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/1.0/BarramundiFish/glTF/BarramundiFish_texture_0001.jpg, https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/1.0/BarramundiFish/glTF/BarramundiFish_texture_0002.jpg, https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/1.0/BarramundiFish/glTF/BarramundiFish_texture_0003.jpg, https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/1.0/BarramundiFish/glTF/BarramundiFish_texture_0004.jpg, https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/1.0/BarramundiFish/glTF/BarramundiFish0FS.glsl, https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/1.0/BarramundiFish/glTF/BarramundiFish0VS.glsl`
  - Might have bugs and interface / library related limitations and slow to load some models
  - Loading ASSIMP models will have `flatShading` turned ON so hit the `F` button to turn it OFF if required
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
      - `https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/CesiumMilkTruck/glTF/CesiumMilkTruck.gltf, https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/CesiumMilkTruck/glTF/CesiumMilkTruck.bin`
    - For MD2 models you would have to add their texture URL, for example:
      - `https://raw.githubusercontent.com/assimp/assimp/master/test/models/MD2/faerie.md2, https://raw.githubusercontent.com/assimp/assimp/master/test/models/MD2/faerie2.bmp`
    - If textures are not automatically fetched with the model URL only then add the texture location URL, for example:
      - `https://raw.githubusercontent.com/SaschaWillems/VulkanSponza/master/data/sponza.dae, https://raw.githubusercontent.com/SaschaWillems/VulkanSponza/master/data/sponza/`
      - `https://raw.githubusercontent.com/oecax2208/PyMikuMikuDance/master/example/vdproject_peach_v1/小桃初代女仆v1.pmx, https://raw.githubusercontent.com/oecax2208/PyMikuMikuDance/master/example/vdproject_peach_v1/Texture/`

- Special notes about mobile `Quick Viewer` which is using [Online 3D Viewer](https://github.com/kovacsv/Online3DViewer) engine:
  - It is purely online based and can be used as standalone HTML file (just delete `favicon.ico` import)
  - Supported import formats: 3DS, 3DM, 3MF, AMF, BIM, BREP, BRP, DAE, FBX, FCSTD, GLB, GLTF + BIN, IFC, IGES, IGS, OBJ + MTL, OFF, PLY, STL, STEP, STP, WRL
  - Supported export formats: BIM, PLY, STL, OBJ, OFF, GLB and GLTF v2.0 (even on a mobile phone as tested on an Android device)
  - Loading via URL currently requires all model files URLs and comma separated (no files will be fetched automatically), here is an example for Khronos [CesiumMilkTruck](https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/CesiumMilkTruck):
    - `https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMilkTruck/glTF/CesiumMilkTruck.gltf, https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMilkTruck/glTF/CesiumMilkTruck_data.bin, https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMilkTruck/glTF/CesiumMilkTruck.jpg`
  - For proper viewing and additional features try using the actual [Online 3D Viewer](https://3dviewer.net/) website
  - Might have bugs and library related limitations
  - Most of the following notes do not apply to Quick Viewer in general

- Special notes about `USDZ Viewer`:
  - Currently, it only supports USDZ files with USDA (ascii model packed in)
  - USDZ files with USDC (binary model packed in) can be viewed with the following:
    - [USDZ Online Viewer](https://www.usdz-viewer.net/)
    - [USD Viewer](https://usd-viewer.glitch.me/?file=)
    - Both of the above can also be used as a workaround to export some models to GLB format and then:
      - use either my [GLTF Viewer](https://githubdragonfly.github.io/viewers/templates/GLTF%20Viewer.html) or [three.js editor](https://threejs.org/editor/) to export it to USDZ with USDA packed in

- Special notes about `GLTF Legacy` viewer which is using modified version of mrdoob's [model-tag](https://github.com/mrdoob/model-tag):
  - Set in 500 x 500 viewport and seems to have a good fit on mobile devices
  - It is relatively simple and might have bugs and limitations
  - Supported import formats: GLTF v1.0 + BIN + Textures
  - Unsupported import formats: GLB
  - It can export to GLTF / GLB v2.0 and OBJ formats (animations are not currently supported)
  - Use ASSIMP Viewer instead since it has less limitations and more export options
  - Most of the following notes do not apply to GLTF Legacy viewer in general

## Applicable to most viewers

- Menu with controls can be located either on top or on the bottom of the page
- Almost all viewers include the interactive [Orbit Controls Gizmo](https://github.com/Fennec-hub/ThreeOrbitControlsGizmo) for orientation
- Most viewers, if not all, have been tested as functional in the latest Firefox / Chrome / Edge / Safari browsers
  - do note that mobile Safari browser might be finicky about certain features
- For quick testing of any viewer, see the `URLS4MODELS.md` file for corresponding URL examples
- Some loading instructions are also available in [HTML_CSS_JS_Flask](https://github.com/GitHubDragonFly/HTML_CSS_JS_Flask) and [HTML_CSS_JS](https://github.com/GitHubDragonFly/HTML_CSS_JS) repositories
- Drag-and-drop is currently not supported in any viewer
- ZIP file support is only available in OBJ+MTL Viewer
- Import files locally from a file browser dialog:
  - All files have to be in the same folder
  - Some viewers might have some limitations
  - Possibly update your models to look for textures in the same folder
  - Make any necessary changes on your device to allow local file browsing
- Import files via remote URL:
  - Multiple comma separated URLs are allowed in some viewers and can be from mixed websites
  - For single URL:
    - most viewers support GitHub
    - some viewers support Dropbox and URLs without extension
  - URLs should have no CORS restrictions
- Import formats, where applicable, with any optional or required textures:
  - 3DS, 3DM, 3MF, AMF, DAE, FBX, IFC, JSON, OBJ + MTL, PCD, PDB, PLY, VTK, VTP, STL, PRWM, USDZ, WRL, XYZ
  - GLTF supported formats: GLB, GLTF + BIN, DRC, VRM
  - GCODE supported formats: GCODE, NCC, NGC
  - LDRAW supported formats: DAT, L3B, LDR, MPD
  - MMD ( Miku Miku Dance ) supported formats: PMD, PMX, VMD, VPD, SPA, SPH, MP3, OGG
  - Embroidery supported formats: DST
    - This is using customized [DST Embroidery File Loader](https://github.com/manthrax/dst-format)
    - The `images` folder also includes `threadNormal` and `threadTexture` images from the same website
  - OCCT supported formats: STEP, STP, IGES, IGS, BREP, BRP, BIM
    - STEP Viewer is using [occt-import-js](https://github.com/kovacsv/occt-import-js) and a modified version of [dotbim.three.js](https://github.com/ricaun/dotbim.three.js):
      - Custom BIM Loader is also available
- Export formats, where applicable:
  - 3DM, BIM, DAE, APNG, FBX, STEP, X3D, X, ASSJSON, GIF, GLB, GLTF, JSON, OBJ + MTL, OFF, PLY, STL, PRWM, USDZ
    - OFF exports are only available in the Quick Viewer, as stated further above
    - BIM exports are available in the Quick Viewer as well as some other viewers with custom BIM Exporter
    - 3DM exports are powered by [rhino3dm](https://github.com/mcneel/rhino3dm), with the following notes:
      - This is a custom exporter not officially available in the three.js library
      - It requires a modified version of the 3DM Loader, which is included in this repository
      - Currently supports exporting textured meshes, points and line segments:
        - Mesh geometry could be either of: Buffer, Sphere, Box, Cylinder, Cone, Icosahedron and maybe other
        - Textures and additional MeshPhysicalMaterial properties are passed via user strings
        - Maximum texture resolution is limited to 2.5k (2560 x 2560)
      - GLTFS Viewer might produce richer colors in exported 3DM models than GLTF Viewer
      - USDZ Viewer appears to produce more accurate output than other viewers
      - Exported 3dm files might not show properly in any other 3rd party 3DM viewer
    - PRWM exports are powered by [PRWM](https://github.com/kchapelier/PRWM)
    - ASSJSON, FBX, STEP, X3D and X exports are powered by [ASSIMPJS](https://github.com/kovacsv/assimpjs) and [ASSIMP](https://github.com/assimp/assimp):
      - STEP exports don't appear to be optimizied in the assimp library so use only if needed
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
    - Try not to change file names when saving files during initial export
    - Exporting some models might crash the browser when running out of memory 
    - Exporting some models might be easier / better done with multiple viewers, examples:
      - MMD -> OBJ and then OBJ -> JSON might be better than straight MMD -> JSON export
      - IFC -> GLB and then GLB -> GLB_m (with MESHOPT compression) and then GLB_m -> GLB_d (with DRACO compression) might be easier than straight IFC -> GLB_d export
    - DAE, GLB, GLTF, JSON, OBJ + MTL, PLY, STL, USDZ modified exporters are [three.js](https://github.com/mrdoob/three.js) based
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
  - GLB exports, where applicable, can additionally have either DRACO or MESHOPT and optional WEBP texture compression available by using [glTF Transform](https://gltf-transform.dev):
    - These exports are marked as either of: `GLB_d` `GLB_dw` `GLB_m` `GLB_mw` (for regular exports) `GLBx_d` `GLBx_dw` `GLBx_m` `GLBx_mw` (for alternative exports)
    - WEBP exported texture resolution will retain original size in mobile GLTF Viewer but is selectable in desktop viewers (128, 256, 512, 768, 1k, 1.2k, 1.5k, 1.7k, 2k, 3k, 4k)
    - KTX2 texture compression is additionally available by using [ktx2-encoder](https://www.npmjs.com/package/ktx2-encoder) and marked as following:
      - `KTX2` offers ETC1S + UASTC compression, automatically selected as per specific type of texture
      - `KTX2e` offers ETC1S only compression applicable to all textures
      - `KTX2u` offers UASTC only compression applicable to all textures
    - These exports seem to work fine in general but might not be good for some rare models
  - Some viewers also offer alternative exports marked as `OBJx` `DAEx` `GLTFx` `USDZx`:
    - Should be tried either out of curiosity or if their regular export counterparts don't produce good results
    - Might even produce smaller exported file size than regular export
    - If applicable, will support exporting THREE.InstancedMesh to OBJ + MTL / DAE / USDZ as well
    - If applicable, will support exporting morph animations but will not export other animations
  - Some viewers also offer setting the following exported textures features:
    - Resolution: 128, 256, 512, 768, 1k, 1.2k, 1.5k, 1.7k, 2k, 3k, 4k
    - Y-flip, which is intended for 3DM / DAE / OBJ / USDZ exports
  - GLTFS Viewer seems to do OK job in exporting still models with `pbrSpecularGlossiness` but would suggest that you use [gltf.report](https://gltf.report/) instead
  - Experiment with all exporters available by exporting the original model as well as its exported versions:
    - Considering how many export options are available in any viewer, a certain combination might just work properly
- Buttons, where applicable:
  - `A` - animations
  - `E` - edges
    - `EC` - edge color
  - `F` - flatShading
  - `f` - allows for Y-Flip of DDS textures when present in the model (ASSIMP Viewer)
  - `G` - linear gradient background
    - will reset the background color
    - will clear the `Eq` input if present
    - also sets environment in some viewers
  - `I` - raycasting intersects (available in VTK Viewer only)
  - `K` - kinematics (available in DAE viewers only)
  - `L` - lines (LDRAW and its exports in ASSIMP, GLTF, OBJ, JSON viewers)
  - `O` - opacity (normally enabled with mouse double-click)
  - `P` - poses (available in MMD viewers only)
  - `S` - skeleton with demo (available in JSON viewers only)
  - `T` - optional textures
    - when loaded then can be applied to the model one at the time
    - kind of expect UVs to be present
  - `V` - variants that might be present in GLTF models (ASSIMP, GLTF, GLTFS and GM viewers)
  - `W` - button or `Wire` checkbox to show wireframe
  - `X` - morphs
  - `Y` - Y-flip exported textures (available in mobile GLTF Viewer only)
  - `As` - and / or `atoms` button (available in PDB viewers only)
  - `Bs` - and / or `bonds` button (available in PDB viewers only)
  - `C0` - camera index
    - 0 being default (ASSIMP, GLTF, GLTFS viewers)
    - shows as `Cam + Index` in the GLTF Legacy viewer
  - `CS` - construction step (available in LDRAW viewers only)
  - `DT` - material's depthTest switching (ASSIMP, GLTF, GLTFS viewers)
  - `Ls` - and / or `labels` button (available in PDB viewers only)
  - `MP` - material switching - Phong (MP), Standard (MS), Lambert (ML)
  - `OL` - outline effect (available in MMD viewers only)
  - `OS` - material side - Original (OS), Front (FS), Back (BS), Double (DS)
  - `PM` - show model as points (PLY+STL, PRWM and VTK viewers)
  - `VC` - vertex colors
    - `!` - random vertex colors
  - `XS` - xtra smooth (available in OBJ Viewer only)
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
    - will reset the `G` button if enabled
    - will clear the `Eq` input if present
  - `C` - object or points color
  - `Eq` - button or checkbox for setting an equirectangular background with additional controls, where applicable:
    - `setEnvMap` for setting envMap + metalness
    - `toneMapping` with `exposure` and `envMapIntensity`
    - scene background `backBlurriness` and `backIntensity`
    - this will also disable/enable the gradient background `G` button and background color control 
- JSON viewers support three.js and assimp JS / JSON formats with limitations:
  - JSON Viewer is currently using r167 of three.js and cannot open legacy formats
  - JSON Legacy viewer is using r111 of three.js to support legacy THREE.Geometry:
    - It is using 4 loaders: ObjectLoader, BufferGeometryLoader, LegacyJSONLoader and AssimpJSONLoader
    - It could possibly open and export current three.js JSON format, with limitations of r111
    - Some animations and/or skeletons might be off or missing
- GLTF / FBX / DAE viewers will also include animations to exported JSON format
- 3DS viewer is using MeshPhysicalMaterial instead of MeshPhongMaterial
- Multiple viewers will also try mapping any valid `BGND` image as equirectangular when `Eq` is enabled:
  - Maybe download the following three.js examples and load either of them locally via the `BGND` file input:
    - [land_ocean_ice_cloud_2048.jpg](https://github.com/mrdoob/three.js/blob/dev/examples/textures/land_ocean_ice_cloud_2048.jpg)
    - [2294472375_24a3b8ef46_o.jpg](https://github.com/mrdoob/three.js/blob/dev/examples/textures/2294472375_24a3b8ef46_o.jpg)
    - [equirectangular.png](https://github.com/mrdoob/three.js/blob/dev/examples/textures/equirectangular.png)
    - [kandao3.jpg](https://github.com/mrdoob/three.js/blob/dev/examples/textures/kandao3.jpg)
  - These viewers are also using [gainmap-js](https://github.com/MONOGRID/gainmap-js) encoder and decoder:
    - To support loading a single JPEG file with integrated gainmaps
    - To support loading EXR and HDR files, which will be encoded on-the-fly into a single JPEG file with integrated gainmaps
      - You could find some texture examples in the official three.js [equirectangular](https://github.com/mrdoob/three.js/tree/dev/examples/textures/equirectangular) folder
- PLY+STL, PRWM and VTK viewers can also:
  - Show a points version of the loaded model and export it as such (if the model is not rather large):
    - Tip: export this points model into PLY format and then drop the PLY file into [WebGL Gaussian Splat Viewer](https://antimatter15.com/splat/) to get SPLAT file
  - Export edges, when enabled, in OBJ and GLTF exports of both solid and points model (a popup alert will notify about this)
- Using Animated GIF as a texture is experimental and powered by modified [gif-loader](https://github.com/movableink/three-gif-loader) using [omggif](https://github.com/deanm/omggif) library
    - currently available only in `FBX` `OBJ` `PLY+STL` `PRWM` viewers and should be tried on simple models
    - see the Animated GIF of a cube using Animated GIF as a texture in the `images` folder
- There is also a simple cube shading example available at the bottom of the menu:
    - It is fully automatic and manipulates each of the RGBA components
    - Ref: [The Book of Shaders](https://thebookofshaders.com/04/) by Patricio Gonzalez Vivo & Jen Lowe
    - It also has a little bit of [Proton](https://github.com/drawcall/three.proton) mouse flare thanks to [threejs-mesh-modifiers](https://github.com/drawcall/threejs-mesh-modifiers) example
- Tips:
  - if the model is correctly loaded but you cannot see it then try any or all of the following:
    - apply `edges`
    - zoom `in/out` or apply `Scale`
    - apply `flatShading`
    - apply `Vertex Colors` and `Random Vertex Colors`
    - change `ambient light` to white
    - change `background color` to white
    - try anything else not mentioned above
  - large resolution textures should be scaled down before loading, as an example download [`Bedroom`](https://casual-effects.com/data/index.html) with 8k images and try it AS IS, then scale them down to 1k or 2k (which will speed up loading in browsers)
  - you could also try using [COLLADA2GLTF](https://github.com/KhronosGroup/COLLADA2GLTF) and [FBX2glTF](https://github.com/facebookincubator/FBX2glTF) and [Online 3D Viewer](https://3dviewer.net) exporters / converters

PLY+STL Viewer
![PLY+STL Viewer](images/PLY%20Viewer.png?raw=true)

# Notes about three.js Texture Viewer

- Supporting the following image formats:
  - PNG, APNG, JPG, JPEG, JFIF, PJPEG, PJP, BMP, DIB, GIF, PCX, TIF, TIFF
  - WEBP, TGA, SVG, DDS, KTX, KTX2, EXR, HDR, BASIS and Lottie JSON
  - Also supported are: MP4 / WEBM / OGV video files and M4A / M4B / OGG audio files
- It is using [gainmap-js](https://github.com/MONOGRID/gainmap-js) encoder and decoder:
  - Support loading a single JPEG file with integrated gainmaps
  - Support loading EXR and HDR files which will be encoded on-the-fly into a single JPEG file with integrated gainmaps
  - Set to handle still JPEG without gainmaps, PNG, BMP, GIF and WEBP texture loading
- Animated GIF file support is powered in part by [omggif](https://github.com/deanm/omggif) and displayed with [THREE.CSS2DRenderer](https://threejs.org/docs/#examples/en/renderers/CSS2DRenderer)
- Animated PNG file support is powered in part by [UPNG.js](https://github.com/photopea/UPNG.js) and displayed with [THREE.CSS2DRenderer](https://threejs.org/docs/#examples/en/renderers/CSS2DRenderer)
- Animated WEBP file is displayed with [THREE.CSS2DRenderer](https://threejs.org/docs/#examples/en/renderers/CSS2DRenderer)
- All of the above animated files are "view only" so most viewer controls will not have any effect and will be disabled
- TIF / TIFF image file support is powered by [UTIF.js](https://github.com/photopea/UTIF.js)
- PCX image file support is powered by [pcx-js](https://github.com/warpdesign/pcx-js)
- Use the `T` button to switch between textures
- Texture is displayed on a rotatable plane which can also be moved and zoomed in / out:
  - This is not applicable to Animated GIF - PNG - WEBP and / or video files (gizmo will disappear)
- Video player has its own controls for playback and full-screen switching
- URL text box also allows entering a single base64 string of the image data, see the `URLS4MODELS.md` file for an example
- For certain formats and their manipulation an easy alternative to this viewer would be `https://ezgif.com`
- Most of these files can easily be viewed with some operating system applications or by the browsers themselves (like animated GIF / PNG / WEBP or MP4 / WEBM / OGV videos):
  - In Windows, for example, right-click the file itself then choose `Open With` and select `Firefox` browser
  - Windows users could also consider getting the [QuickLook](https://apps.microsoft.com/store/detail/quicklook/9NV4BS3L1H4S) app

![Texture Viewer](images/Texture%20Viewer.png?raw=true)

# License

This is all MIT licensed but please observe any other licenses that might be applicable to some files or content.

# Trademarks

Any and all trademarks, either directly or indirectly mentioned in this project, belong to their respective owners.
