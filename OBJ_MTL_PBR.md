# OBJ Material Entries (MTL file)

Keep in mind that this repository is using the following customized OBJ related three.js files: `MTL Loader` and `OBJ Exporter`.

These files have been synchronized to work with each other and process all custom PBR entries found in the MTL file, as listed further below, aiming at providing the GLTF alike functionality in the OBJ Viewer by taking advantage of the `THREE.MeshPhysicalMaterial` and a modified `GLTF Loader`.

All the entries have been set as such so they are compatible with `three.js` as well as the `assimp` library being used in this repository.

Most, if not all, of the available viewers do include the OBJ Exporter, thus can try to export their models to `OBJ + MTL + textures` format with whatever limitations there might be (like animations for example).

This document would represent a summary of PBR entries that can be found in the exported MTL file, with mentioning of some possibly utilized standard entries whose description can be seen online [here](https://paulbourke.net/dataformats/mtl/).

## Standard Entries:

 - Ka, Kd, Ke, Ks, Ns, Ni, Tr, Tf, d, illum, -bm, -s, -o
 - map_Ka, map_Kd, map_Ke, map_Ks, bump, map_bump, map_d, norm, disp

## PBR Entries with associated textures (maps):

 - `a` - alphaTest (alphaCutoff)
 - `s` - material side
 - `Pe` - emissive intensity
 - `Prf` - reflectivity
 - `Pac` / `Pad` - attenuationColor / attenuationDistance

 - `Pm` - metalness
   - `map_Pm` - metalnessMap
 - `Pr` - roughness
   - `map_Pr` - roughnessMap
 - `map_Px` - replaces both `map_Pm` and `map_Pr` when they are identical

 - `Pa`/ `Par` - anisotropy (strength) / anisotropyRotation
   - `map_Pa` - anisotropyMap

 - `Pi` / `Pii` - iridescence / iridescenceIOR
   - `map_Pi` - iridescenceMap
 - `Pitx` / `Pity` - iridescenceThicknessMinimum / iridescenceThicknessMaximum (aka iridescenceThicknessRange[x, y] in three.js)
   - `map_Pit` - iridescenceThicknessMap

 - `Pcc` / `Pcr` - clearcoat / clearcoatRoughness
   - `map_Pcc` - clearcoatMap
   - `map_Pcn` - clearcoatNormalMap
   - `map_Pcr` - clearcoatRoughnessMap

 - `Ps` / `Psr` - sheenColor / sheenRoughness
   - `map_Psc` - sheenColorMap
   - `map_Psr` - sheenRoughnessMap`

 - `Pth` - thickness
   - `map_Pth` - thicknessMap

 - `Ptr` - transmission
   - `map_Ptr` - transmissionMap

 - `Psp` - specularColor
   - `map_Psp` - specularColorMap

 - `Psi` - specularIntensity
   - `map_Psi` - specularIntensityMap

Entries currently not compatible with the `assimp` library but working fine in the OBJ + MTL Viewer:

 - `-c` - texture center of rotation
 - `-r` - texture rotation value
 - `-w` - texture wrapping parameters (`wrapS` and `wrapT`)
 - `Pns` - normalScale
 - `Pcn` - clearcoatNormalScale
 - `Pli` - lightMapIntensity
 - `disp_b` - displacementBias
 - `disp_s` - displacementScale
 - `Pbr_ps` - sheen (layer intensity)
 - `Pbr_pl_map` - lightMap

Remember that other OBJ + MTL viewers will probably NOT be able to interpret most of these PBR entries.

# Testing

This can be tested by using the [Khronos Group glTF v2.0 examples](https://github.-com/KhronosGroup/glTF-Sample-Models/tree/master/2.0) and following these instructions:

 - Use my [GLTF Viewer](https://githubdragonfly.github.io/viewers/templates/GLTF%20Viewer.html) to load one of those example GLTF files via the viewer's `URL` option, here is an example url:
   - `https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/2.0/IridescenceMetallicSpheres/glTF/IridescenceMetallicSpheres.gltf`
 - Use the viewer's `OBJ` export option to get `OBJ + MTL + textures` in a zip file
 - Extract all the files to a folder on your device (this needs to be done since my viewers currently don't support loading of zip files)
 - Examine the MTL file to see what the entries look like and then do the following:
   - Use my [OBJ Viewer](https://githubdragonfly.github.io/viewers/templates/ASSIMP%20Viewer.html) or [ASSIMP Viewer](https://githubdragonfly.github.io/viewers/templates/ASSIMP%20Viewer.html) and select its `Browse` option to load these extracted files all at once - your device will have to allow loading local files
 - After the model is loaded then make sure to check the `Eq` box in the viewer to get the environment texture / lights

Not all the examples will work properly but lots of them do.

# Credits

 - Ref: https://stackoverflow.com/questions/35070048/export-a-three-js-textured-model-to-a-obj-with-mtl-file

# Trademarks

 - Any and all trademarks, either directly or indirectly mentioned, belong to their respective owners.
