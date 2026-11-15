# NASA terrain and traverse references

The Moon reference supplies an elevation field. The Mars reference supplies a horizontal route flown by Perseverance. Wheel loads, speeds, battery consumption and travel times shown in the workbench come from the selected hypothetical assembly. [Lunar product label](ldem_80s_80m.lbl) · [NASA Perseverance location map](https://science.nasa.gov/mission/mars-2020-perseverance/location-map/)

## LRO/LOLA south polar grid

NASA’s LDEM_80S_80M V2.0 is a 7,600 × 7,600 polar stereographic grid constructed from LRO/LOLA altimetry acquired between July 2009 and February 2017. Grid spacing is 80 m at the pole. PDS stores elevation as a signed little-endian 16-bit integer in units of 0.5 m relative to a sphere of radius 1,737,400 m. The source team interpolated the instrument ground tracks to produce the grid. Wheel-sized rocks and subpixel slopes remain unresolved. [NASA PDS image](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_80s_80m.img) · [PDS product label](ldem_80s_80m.lbl)

The parent project archived zero-based source rows 750–5000 inclusive, with all 7,600 columns. The extraction reads rows 3578–3642 and columns 3768–3832 inclusive. The 65 × 65 sample centres span 5,120 m on each axis. The centre, source row 3610 and column 3800, is at approximately 89.500057° S, 0.151176° E with elevation −715.5 m relative to the reference sphere. Local +X increments source column and +Z decrements source row. These axes follow the map grid. The workbench subtracts the centre elevation and interpolates bilinearly; rendering clamps to the sampled bounds, while driving enforces the boundary. [Tile metadata](lola.json) · [Source row-band manifest](../../../clps-prototype/data/terrain/dem-source-manifest.json)

From this directory, rebuild the two generated lunar files using the parent project’s archived row band:

```sh
python3 extract_lola.py
```

The extractor checks the parent row band SHA-256. The independent tests additionally compare each of the 4,225 signed integers with the source band when it is available. A standalone package still checks the generated file, original label, centre, orientation and the canonical little-endian bytes for the tile. The latter digest is `13bede5403bb9f7c17522105a0379766aa9c906dcf1e57d5d3bb14894e9853d6`. [Extractor](extract_lola.py) · [Machine tests](https://github.com/Haresh276/first-fire/blob/main/rover-design/prototype/terrain-reference.test.mjs)

## Perseverance at Jezero, sol 15

The archived NASA Mars 2020 traverse collection named `M20_Traverse_Path_tosol2022` contains one sol 15 feature from rover motion counter `3_110` to `3_386`. Its NASA length is 36.39 m. The source feature contains 47 longitude, latitude and elevation triples, including repeated positions. Source clock endpoints are retained in the properties. Individual positions have no timestamps, tire slip measurements or energy readings in this feature. [Archived flight feature](perseverance-sol15.geojson) · [NASA/JPL traverse collection](https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json)

The local route starts at 77.45094675° E, 18.44454338° N. Let R = 3,389,500 m and angles be in radians. The projection is x = R cos(latitude₀) × (longitude − longitude₀) and z = R × (latitude − latitude₀). The full horizontal polyline is about 36.3214 m in this approximation. Ramer–Douglas–Peucker simplification with a 0.15 m perpendicular-distance tolerance leaves the origin and three goals. Four decimal places in metres retain a 36.3020 m route. The workbench follows those goals on a flat Mars test surface and computes a fresh time and power history. The source elevations remain in the GeoJSON. [Projection and goals](jezero-route.json) · [Converter](extract-jezero.mjs)

Rebuild the saved route or verify a separately retained copy of the complete source download:

```sh
node extract-jezero.mjs --out jezero-route.json
node extract-jezero.mjs --verify-upstream /path/to/M20_traverse.json
node --test ../prototype/terrain-reference.test.mjs
```

The local feature SHA-256 is `cb233a675fb31af4d941f4effad9800304d1a1ba15ed5eb87c7647543724fa88`. The complete source snapshot SHA-256 is `6ddd0ece913d75b45d105946082f95ed84e68f4718b68d32a4421dc30877e7e6`. NASA may extend its live collection. The optional full-snapshot check requires the recorded collection version and verifies its selected feature matches the local copy. The checked-in feature suffices to regenerate the exact three goals offline.
