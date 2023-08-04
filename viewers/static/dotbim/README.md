# dotbim.three.js

Test [dotbim](https://github.com/paireks/dotbim) with [three.js](https://github.com/mrdoob/three.js) using release version [r147](https://github.com/mrdoob/three.js/releases/tag/r147).

## dotbim

Move and test colors for each face using in the mesh object.

### meshes
* mesh_id - `number`
* coordinates - `[x1,y1,z1,x2,y2,z2...]`
* indices - `[i1,i2,i3,j1,j2,j3...]`
* colors - `[ir,ig,ib,ia,jr,jg,jb,ja...]`

`colors` could have one default color or one color for each face `(indices.length / 3)`.

### elements
* mesh_id - `number`
* vector - `{x,y,z}` - `if undefined use {0,0,0}`
* rotation - `{qx,qy,qz,qw}` - `if undefined use {0,0,0,1}`
* color - `{r,g,b,a}` - `if undefined use colors default mesh`
* face_colors - `remove`


In this example the color in the `element` is blending with the color in the mesh, need to remove the `face_colors` from element and move to mesh `colors` and remove the color from element.

## License

This package is [licensed](LICENSE) under the [MIT Licence](https://en.wikipedia.org/wiki/MIT_License).

---

Do you like this package? Please [star this project on GitHub](../../stargazers)!

---

Copyright © ricaun 2023