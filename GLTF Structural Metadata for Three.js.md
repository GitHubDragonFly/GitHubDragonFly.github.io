📘 GLTF Structural Metadata for Three.js

A lightweight bridge between Cesium’s metadata extensions and the Three.js ecosystem.
- Created with assistance from AI - Google Gemini, Microsoft Copilot and Perplexity.
- As of the time of writing, this appears to be one of the first comprehensive open-source bridges for these specific extensions in Three.js:
  - Not counting libraries specifically designed for 3D Tiles ecosystem

This repository hosts a custom glTF bridge to structural metadata, a missing piece of Three.js puzzle.
Enabling you to load, inspect, pick, and export metadata-rich glTF models, including those used in 3D Tiles.

Three.js does not natively support EXT_structural_metadata extension as official extension:
- GLTF Loader will parse the JSON structure and bufferViews, but leave all metadata interpretation to the application.

This project fills that gap with a minimal, practical, production-ready pipeline.

Some might see it as a `Bit-Level Accurate Metadata Engine` for easy data browsing.

----------------------------------------------------------------------------------

✨ What This Project Enables

✔ Load metadata from glTF models

- Support for Cesium’s metadata extensions:
  - EXT_structural_metadata
  - EXT_mesh_features
  - EXT_instance_features

✔ Interpret metadata

- With hydration of:
  - schemas
  - property tables
  - metadata textures
  - typed arrays
  - string/array offsets

…and exposing them as clean JavaScript objects.
This is the heart of this engine.

✔ Feature-level picking

- Click a mesh → get the exact feature → get its metadata.

✔ Round-trip exporting

- Export to GLTF / GLB that will include:
  - structural metadata
  - metadata textures
  - feature IDs
  - schemas

…preserved and rebuilt deterministically.

✔ Duplicate-safe texture handling

- Metadata textures are processed once, tracked, and re-indexed safely.

----------------------------------------------------------------------------------

🎯 Picking Logic

The picking system in this project originates from custom 3D Tiles viewers available in this repository.

It was adapted to work with standalone glTF files because the metadata model is the same.

The picking flow is identical whether the glTF is part of a tileset or loaded on its own.

Here is the picking pipeline, maybe somewhat simplified:

```
[ 1. GEOMETRIC PICKING ]        [ 2. ID RESOLUTION ]         [ 3. DATA HYDRATION ]
                                                                    
Raycast Intersection ────────┐                                  Property Table
      │                      │                                 (Binary Buffers)
      ▼                      ▼                                        ▼
Mesh / Instanced / Point      Feature ID (Key) ───────▶───────────────┤
      │                      ▲                                        ▼
      ├─ Attribute Lookup ──▶┤           ┌─── Read String (Offsets) ──┤
      ├─ Texture Sampling ──▶┤           ├─── Read Array (Strides)  ──┤
      └─ Vertex Index     ──▶┘           └─── Read Enum (Schema)    ──┤
                                                                      ▼
                                                              [ Final JS Object ]
                                                             { Name: "Building A",
                                                               Height: 42.5 ... }
```

This unified approach ensures:

- Consistent feature‑level picking
- Correct resolution of feature IDs
- Correct mapping into property tables
- Correct decoding of metadata textures
- Renderer-independent behavior ( WebGL and WebGPU )
- Even Google’s model-viewer component can support picking

It’s the same logic used in 3D Tiles, just scoped to a single glTF asset.

🧩 How It Works (High‑Level)

- Resolves schema types
- Resolves feature IDs
- Hydrates property tables
- Decodes metadata textures
- Produces clean metadata objects
- Performs sophisticated value identification
- Provides styled presentation of values in a popup card

----------------------------------------------------------------------------------

🛠 Exporter

A metadata-aware extension to customized version of GLTF Exporter:

- Rebuilds structural metadata
- Rebuilds property textures
- Preserves indices
- Avoids duplicate processing
- Ensures deterministic output

Metadata textures require special handling since they can easily be altered by the canvas element.

----------------------------------------------------------------------------------

🛠 Current Limitations

- Three.js re-encodes main textures during export
- PNG size may increase (normal Three.js behavior)
- No KTX2 metadata textures yet

These are Three.js limitations, not metadata limitations.

----------------------------------------------------------------------------------

🔮 Roadmap

- Optional PNG optimization
- KTX2 metadata textures
- GPU-driven metadata picking
- Metadata-driven rendering (classification, heatmaps)

----------------------------------------------------------------------------------

🧭 Who This Is For

- Developers working with 3D Tiles
- Anyone integrating Cesium metadata into custom Three.js apps
- Digital twin / BIM / GIS / simulation projects
- Anyone who needs feature‑level picking and metadata inspection in WebGL

----------------------------------------------------------------------------------

📦 Examples & Specs

Cesium maintains the following:
- Excellent metadata-rich glTF examples inside their [3D Tiles](https://github.com/CesiumGS/3d-tiles-samples/glTF) sample repository
  - These examples would include all of the extensions mentioned above
- Official specs can be found [here](https://github.com/CesiumGS/glTF/tree/3d-tiles-next/extensions/2.0/Vendor)

This project focuses on making those models work inside Three.js, not on duplicating Cesium’s documentation.

Additional examples could be found in [bertt's GitHub](https://github.com/bertt/cesium_3dtiles_samples/tree/master/samples/1.1) repository.

Here is a screenshot of the metadata popup card in my GLTF Viewer (having loaded glTF file from Cesium's [Complex Types](https://github.com/CesiumGS/3d-tiles-samples/tree/main/glTF/EXT_structural_metadata/ComplexTypes) example):

<img width="1469" height="1305" alt="GLTF Metadata Picking" src="https://github.com/user-attachments/assets/7a9baf5a-178c-478b-bdf9-46179e6e15c9" />

----------------------------------------------------------------------------------

Live Demo: My repository is public, using GitHub Pages to host the functional GLTF viewers that demonstrate metadata picking.

----------------------------------------------------------------------------------

Bonus Features
- With a little bit of additional coding you could turn this metadata picking into highly functional live data `Digital Twin` (as some might call it this name):
  - Make sure to implement communication path to your data sources, either via MQTT or Modbus or WebSockets or any other
  - Collect corresponding data, normally you should use some unique identifier like Feature ID
  - Pass the data to corresponding fields of the popup card
  - Optionally setup some alarming if desired

To demonstrate this, here is a quick video showing some random values being provided to the same property of unique Feature IDs:
- Cesium's [Multiple Feature IDs and Properties](https://github.com/CesiumGS/3d-tiles-samples/tree/main/glTF/EXT_structural_metadata/MultipleFeatureIdsAndProperties) glTF file was used in this demo
- Coloring is done by setting a Threshold and Critical limits, with colors representing the following:
  - Light blue represent regular / acceptable values, under the threshold limit
  - Yellow represents a warning, values being over threshold limit
  - Red represents values being over critical limit
- A sharp eye might catch that these values are being polled at different intervals

https://github.com/user-attachments/assets/4a439c3a-d8a0-4baa-933d-8c9202c652f8
