function dotbim_CreateMeshes(dotbim) {
    if (dotbim === undefined) {
        console.log( 'No BIM model provided!' );
        return;
    }

    if (typeof dotbim === "string") {
        dotbim = JSON.parse(dotbim);
    } else {
        console.log( 'Unknown file format!' );
        return [];
    }

    const { schema_version, meshes, elements, info } = dotbim;
    
    if (!meshes || !elements) {
        console.log( 'No meshes or elements found!' );
        return [];
    }

    const geometrys = dotbim_Meshes2Geometrys(meshes);

    return dotbim_Elemments2Meshes(elements, geometrys);
}

function dotbim_Elemments2Meshes(elements, geometrys) {
    return elements.map(element => dotbim_Elemment2Mesh(element, geometrys));
}

function dotbim_Elemment2Mesh(element, geometrys) {
    let { mesh_id, vector, rotation, guid, type, color, face_colors, info } = element;
    let geometry = geometrys[mesh_id];

    geometry.computeVertexNormals();

    let material = new THREE.MeshPhongMaterial({
        side: THREE.DoubleSide,
        flatShading: false,
        transparent: true,
        color: 0xCCCCCC
    });

    if (color) {
        if (color.r === 0 & color.g === 0 & color.b === 0 & color.a === 0) color = null;
    }

    // Support `face_colors` in element
    if (face_colors) {
        geometry = geometry.clone();
        let colors = createFaceColors(face_colors);
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    }
    else if (color)
    {
        geometry = geometry.clone();
        geometry.deleteAttribute('color'); // Remove default color in the geometry

        material.color = convertTHREEColorRGB(color.r,color.g,color.b);
        material.opacity = convertColorAlpha(color.a);
        material.transparent = material.opacity < 1.0;
    }

    // Force to use geometry color if exists ('colors')
    if (geometry.getAttribute('color')) {
        material.color = undefined;
        material.opacity = 1.0;
        material.transparent = true;
        material.vertexColors = true;
    }

    if (!vector) vector = { x: 0, y: 0, z: 0 };
    if (!rotation) rotation = { qx: 0, qy: 0, qz: 0, qw: 1 };

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(vector.x, vector.y, vector.z);
    mesh.quaternion.set(rotation.qx, rotation.qy, rotation.qz, rotation.qw);

    let innerGeometry = new THREE.BufferGeometry();
    innerGeometry.setAttribute( 'position', mesh.geometry.attributes.position );
    let innerEdgesGeometry = new THREE.EdgesGeometry( innerGeometry, 30 );
    let outline_material = new THREE.LineBasicMaterial( { color: 0xFF0000 } );
    let edges = new THREE.LineSegments( innerEdgesGeometry, outline_material );
    edges.position.set(vector.x, vector.y, vector.z);
    edges.quaternion.set(rotation.qx, rotation.qy, rotation.qz, rotation.qw);
    mesh[ 'edges' ] = edges;

    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();

    return mesh;
}

function dotbim_Meshes2Geometrys(meshes) {
    return meshes.map(mesh => dotbim_Mesh2GeometryColor(mesh));
}

function dotbim_Mesh2GeometryColor(mesh) {
    const { mesh_id, coordinates, indices, colors } = mesh;
    let geometry = new THREE.BufferGeometry();

    geometry.id = mesh_id;
    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(coordinates, 3));
    geometry = geometry.toNonIndexed(); // Use this to remove Index and make color work with face

    if (colors) {
        buffer_colors = createFaceColors(colors, 3, 4 * indices.length);
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(buffer_colors, 4));
    }
    
    geometry.computeVertexNormals();
    return geometry;
}

function dotbim_Mesh2Geometry(mesh) {
    const { mesh_id, coordinates, indices } = mesh;
    const geometry = new THREE.BufferGeometry();

    geometry.id = mesh_id;
    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(coordinates, 3));
    geometry.computeVertexNormals();
    return geometry;
}

function createFaceColors(color4arrary, repeat = 3, max = 0) {
    let colors = [];
    for (let index = 0; index < color4arrary.length; index += 4) {
        let c1 = color4arrary[index + 0];
        let c2 = color4arrary[index + 1];
        let c3 = color4arrary[index + 2];
        let c4 = convertColorAlpha(color4arrary[index + 3]);
        var color = convertTHREEColorRGB(c1,c2,c3);

        for (let i = 0; i < repeat; i++)
            colors.push(color.r, color.g, color.b, c4);
    }

    while (colors.length < max) {
        for (let i = 0; i < repeat; i++)
            colors.push(colors[0], colors[1], colors[2], colors[3]);
    }

    return colors;
}

function convertTHREEColorRGB(r,g,b)
{
    return new THREE.Color(`rgb(${r}, ${g}, ${b})`);
}

function convertColorAlpha(alpha)
{
    return alpha / 255.0;
}