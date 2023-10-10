# OBJ Material Entries (MTL file)

Keep in mind that this repository is using the following customized OBJ related three.js files: `OBJ Loader`, `MTL Loader` and `OBJ Exporter`.

These files have been synchronized to work with each other and process all custom PBR entries found in the MTL file, as listed further below, aiming at providing the GLTF alike functionality in the OBJ Viewer by taking advantage of the THREE.MeshPhysicalMaterial.

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
 - `Pac` / `Pad` - attenuationColor / attenuationDistance

 - `Pm` - metalness
   - `map_Pm` - metalnessMap
 - `Pr` - roughness
   - `map_Pr` - roughnessMap
 - `map_Px` - replaces both `map_Pm` and `map_Pr` when they are identical

 - `Pa` / `Pas` / `Par` - anisotropy / anisotropyStrength / anisotropyRotation
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

 - `Pns` - normalScale
 - `Pcn` - clearcoatNormalScale
 - `Pli` - lightMapIntensity
 - `disp_b` - displacementBias
 - `disp_s` - displacementScale
 - `Pbr_ps` - sheen (layer intensity)
 - `Pbr_refl` - reflectivity
 - `Pbr_pl_map` - lightMap

Remember that other OBJ + MTL viewers will probably NOT be able to interpret most of these PBR entries.

# Credits

 - Ref: https://stackoverflow.com/questions/35070048/export-a-three-js-textured-model-to-a-obj-with-mtl-file

# Trademarks

 - Any and all trademarks, either directly or indirectly mentioned, belong to their respective owners.
