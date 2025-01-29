The Lego Brick model was originally created as OBJ file by [JSModeler](https://github.com/kovacsv/JSModeler) and then modified and converted to other formats.

Legacy JSON examples are from r68 and r69 releases of the three.js and were modified as follows:

- Adjusted positions of the root bone - all models
- Changed `transparency` to `opacity` - `marine` `human_walk_0_female` models

Some additional legacy models can also be found here: `http://geoffair.org/fg/globe/`.

Cerberus examples:

- Original files from [three.js OBJ examples](https://github.com/mrdoob/three.js/tree/dev/examples/models/obj/cerberus).
- Converted and modified to showcase multiple different `OBJ + MTL` loading options:
  - Can be loaded as ZIP files in the OBJ+MTL Viewer
- GLB related ZIP files can be loaded as such in either GLTF Viewer or GLTF WebGPU:
  - Designed to showcase loading EXR texture with DRC and GLB cerberus model that has a built-in `uv` set
  - Exporters might have difficulties exporting these models due to their lack of support for EXR images

Damaged Helmet example from [three.js GLTF examples](https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/DamagedHelmet/glTF).
- Zipped up for testing purposes

Quarks atom is used in [Cube Shading](https://githubdragonfly.github.io/viewers/templates/Cube%20Shading.html) example:
- Three.quarks: `https://github.com/Alchemist0823/three.quarks`
- Sandbox Example: `https://codesandbox.io/p/sandbox/three-quarks-atom-particle-system-xp3fvz?file=%2Findex.html`
- Official Website: `https://quarks.art`
