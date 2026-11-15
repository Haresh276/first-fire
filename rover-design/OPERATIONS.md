# FIRST FIRE rover workbench

Choose a pressurized lunar rover, inspect the eleven installed systems, then drive the same design on an adjustable course. Every component has a conceptual 3D representation. The selectable configuration includes 30 agency-inspired or theoretical component choices. Three render modes expose the hull, cabin interior and separated assemblies. [Open the local workbench](http://127.0.0.1:8766/prototype/#workbench) · [16-second recorded walkthrough](preview/rover-workbench.mp4)

## Drive and inspect

1. Select **Drive**, choose Moon, Mars or Earth and choose day or night. Orbit puts the rover in free fall and disables surface driving. The scenario name belongs to the design and stays editable under **Design and reference scenarios**.
2. Drag the scene to orbit the camera, or use the on-screen camera buttons. Scroll or pinch to zoom. Click the rover or open **Inspect** and choose a subsystem. The inspector shows the selected part, its calculated quantities and the scope of its evidence. The menu reaches interior and uninstalled component choices.
3. Drive by holding the pad buttons or focusing the scene and pressing W/A/S/D or the arrow keys. For a repeatable traverse, add waypoints by clicking the map or entering X and Z in metres. Select **Run planned traverse**. Playback speed changes how fast the simulation is shown. Scrub the replay to inspect a particular instant. The orange path and CSV cover the portion of the drive displayed so far.
4. Expand **Drive assumptions** to set speed, turn rate, wheel radius, track width, slip, friction, rolling resistance, efficiency and battery reserve. Changing a motion input starts a fresh drive. A stop can mean insufficient traction, depleted reserve, the edge of mapped terrain or the one-hour route limit. The change in stored energy includes wheels, other loads, solar production and curtailment. [Equations and acceptance cases](traverse-reference.md)
5. Select **Cabin test** to animate an ideal tracer pulse in a sealed cabin. Move the release or sensor, change fan exchange, or scrub to read concentrations and alarm time. Edit fan inlet and coupon ignition end under **Conditions**. The model reports oxygen and agent inventories separately. It cannot predict extinction or a time to safety. [Fire and atmosphere models](tool-reference.md)

### Read a 3D overlay

The selector above the scene adds direction or location to the numerical readout. Graphic lengths, translucent volumes, colors, and marker areas carry no engineering units. Parts and markers use conceptual mounting positions. A pressure boundary, pipe route or clearance needs a drawing for the chosen design.

| Overlay | What to read | An informative comparison |
|---|---|---|
| Gravity | Vertical direction on a supported surface, g in m/s² and static weight in N | Switch Earth to Moon for the same mass. Orbital free fall suppresses the ground arrow. |
| Solar power | Incident direction schematic and modeled electrical generation in W | Switch day to night or install battery-only power. Zero generation removes the marker. |
| Radiator exchange | Direction and magnitude of net longwave exchange in W | Raise effective sink temperature above skin temperature to reverse the heat arrow. The Results panel also accounts for absorbed sunlight and internal load. |
| Airlock gas loss | Interface location, cycle gas loss and separate hull leakage in mol over the specified case | Compare lock vs suitport at the same pressure and temperature. A hull leak has no assigned location. |
| Cabin ventilation | Assumed duct flow direction, L/s, mean m/s and alignment with the ignition end | Reverse the fan inlet keeping ignition fixed, then select zero flow. Use the cutaway to inspect the duct. |
| Agent discharge | Installed agent location, delivered kg and remaining kg | Change the commanded discharge duration. The marker identifies the supply only. |

Wheel count follows the scenario, including odd layouts. Left and right wheel rotation follow the differential-drive model. Display geometry can compress extreme track widths or wheel radii to keep the rover legible. The viewer flags this when it happens. Rover mounts, terrain dressing, colors, sky and cabin equipment are illustrations.

## Use NASA data

**Lunar elevation.** Select Moon and **Lunar south pole · LOLA**. The terrain heights come from 4,225 samples in NASA's LRO LOLA south polar product, spaced 80 m apart. The 5.12 km square is centered at approximately 89.50006° S, 0.15118° E. Wheel-scale rocks, surface bearing strength and traction remain unresolved. A survey loop only a few tens of metres across fits mostly within one grid cell. The track uses bilinearly interpolated elevations. [Original NASA PDS label](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_80s_80m.lbl) · [Tile provenance and reproducibility](terrain/README.md)

**Mars flight path.** Select **Perseverance · Sol 15**. The workbench selects Mars and a level surface, projects 47 flight-map coordinates into local east/north metres, and follows a simplified three-waypoint path. NASA's catalogue gives 36.39 m. The GeoJSON retains its original elevations and motion counters. The derived exercise has independently assumed speed, mass, timing, ground conditions and power. [NASA/JPL location map](https://science.nasa.gov/mission/mars-2020-perseverance/location-map/) · [Archived feature](terrain/perseverance-sol15.geojson) · [Reusable route plan](examples/jezero-sol15-plan.json)

## Compare with an independent trial

A team can bring its own field experiment from any country. In **Independent field trial**, load a local UTF-8 CSV with the following header. Use seconds, projected metres, and optional stored watt-hours. Missing battery observations may be blank.

```csv
elapsedS,xM,zM,batteryWh
```

Enter the observation source or test identifier, clock/start event, and physical meaning of the common axes. Align axis direction and handedness before import. If the recorder started later than the simulation, enter a positive time offset in seconds. A maximum interpolation gap can exclude undersampled intervals. Run a simulated traverse first, move replay to the desired endpoint, then click **Compare observed trial with current drive**.

The comparison adopts the first time-matched position as the translation anchor. It interpolates simulated positions at observed times within overlapping coverage. Horizontal RMSE measures disagreement in displacement after alignment. The anchor contributes one zero residual, which matters for short series. Absolute landing position, initial localization error and angular frame registration require separate measurements. Battery-change errors use the first valid matched charge pair. The CSV retains signed and absolute errors, origin and clock details. Re-run the comparison to capture a new drive. An exported simulation trace is suitable for a software round-trip check. Independent observations are required to evaluate model accuracy. [Comparison implementation](prototype/field-comparison.mjs) · [Acceptance cases](prototype/field-comparison.test.mjs)

## Review and share a design

Use **Mission review** to capture design A. Change just one part or condition, rerun the same course to the same endpoint, then inspect the B−A differences. Search the NASA and partner evidence, attach relevant records, and export the review. Any organization can add a primary-source record with its locator, measured quantities and units, test conditions, supported claim and limits. The review exports it as user-supplied and unverified. Technical interfaces, flightworthiness and performance of a newly mixed vehicle remain unverified. [Agency review workflow](agency-review.md) · [Agency register](agency-register.md)

An editable scenario, editable route plan, simulation telemetry CSV, field-comparison CSV, and mission review each answer a different question. Save the route plan to reproduce the design and driving inputs. Save the review for source evidence and a captured run. Use a static HTTP server from the package root to host the workbench locally. The renderer, fonts, source catalogue and both NASA extracts are included. The public source URLs open their respective publishers. [Run commands and data contracts](HANDOFF.md)
