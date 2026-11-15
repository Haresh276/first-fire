# FIRST FIRE rover workbench handoff

**Project location** — `/Users/samuelmorningstar/Documents/Projects/NASA/first-fire/rover-design/`. The standalone workbench opens at [127.0.0.1:8766/prototype/](http://127.0.0.1:8766/prototype/). Every path below is relative to the project location. This package owns its renderer and models. The integration chat owns shared navigation, awareness, deployment and the existing Physics Lab adapter.

| Deliverable | Exact package path |
|---|---|
| Workbench, walkthrough and field procedure | [prototype/index.html](prototype/index.html) · [OPERATIONS.md](OPERATIONS.md) · [preview/rover-workbench.mp4](preview/rover-workbench.mp4) |
| Research chapter, partners and equations | [rover-chapter.md](rover-chapter.md) · [agency-register.md](agency-register.md) · [tool-reference.md](tool-reference.md) |
| Scenario input and simulation output | [scenario.schema.json](scenario.schema.json) · [result.schema.json](result.schema.json) · [prototype/model.mjs](prototype/model.mjs) |
| Parts, cited sources and archived documents | [parts.json](parts.json) · [sources.json](sources.json) · [evidence/files/](evidence/files/) |
| 3D viewer and controller | [prototype/scene/scene.mjs](prototype/scene/scene.mjs) · [prototype/workbench.mjs](prototype/workbench.mjs) · [prototype/app.mjs](prototype/app.mjs) |
| Surface motion, energy and replay | [prototype/traverse.mjs](prototype/traverse.mjs) · [traverse-reference.md](traverse-reference.md) · [route-plan.schema.json](route-plan.schema.json) |
| NASA terrain and traverse extracts | [terrain/lola.json](terrain/lola.json) · [terrain/jezero-route.json](terrain/jezero-route.json) · [terrain/README.md](terrain/README.md) |
| Baseline, material swap, changed conditions and route | [examples/lunar-cellulose.json](examples/lunar-cellulose.json) · [examples/lunar-pe.json](examples/lunar-pe.json) · [examples/mars-night-pe.json](examples/mars-night-pe.json) · [examples/results.json](examples/results.json) · [examples/jezero-sol15-plan.json](examples/jezero-sol15-plan.json) |
| Mission and field comparisons | [prototype/mission-review.mjs](prototype/mission-review.mjs) · [agency-review.md](agency-review.md) · [prototype/field-comparison.mjs](prototype/field-comparison.mjs) |
| Offline distribution | [package_workbench.py](package_workbench.py) builds `share/first-fire-rover-workbench.zip` with both licences, both NASA data extracts, the public source copies, tests and the walkthrough. |

## Input and output

| Artifact | Producer and consumer | Fields and units |
|---|---|---|
| Editable scenario JSON | Import/export scenario, `simulate` | Version 1.0. Eleven part IDs, 56 typed condition values, optional design names. Each numerical unit is in the input schema. |
| Static result JSON | `simulate` → Results and review | Version 1.0. Component results, source IDs, simulation class and unverified compatibility. Nullable fields preserve missing or withheld quantities. |
| Editable route JSON | Save route plan / Load plan | `{format:"first-fire.route/1",scenario,terrain,preset,overrides,waypoints:[{xM,zM}]}`. Coordinates are projected metres. Up to 64 goals. The reader rechecks the selected source path before retaining the NASA route name. |
| Drive state / telemetry CSV | `stepTraverse`, `runRoute` or live viewer → replay and export | `elapsedS, xM, yM, zM, headingRad, pitchRad, rollRad, slopeRad, wheelAngleRad, leftWheelAngleRad, rightWheelAngleRad, speedMps, steer, distanceM, batteryWh, driveWh, hotelWh, solarWh, curtailedWh, status`. Column order follows the exported header. X right, Z forward, Y up; positions in m, angles in rad. `steer` is a dimensionless command. On the polar DEM axes follow the map grid. |
| Observed field trial CSV | Team recorder → independent field trial | Required `elapsedS,xM,zM`, optional `batteryWh`. Strictly increasing time, finite metres, optional blank charge. The form records trial provenance, clock alignment and frame. |
| Field comparison CSV | Field comparison → local download | Matched observation number/time, both displacements, signed X/Z error, horizontal error, charge changes, signed/absolute charge error, anchor and provenance. Positive errors mean model minus observation. |
| Review JSON | Mission review → local download | `format:"first-fire.design-review", version:1`; optional team label, captured A and current B scenarios/results/traverse snapshots, comparison, parts, curated evidence, missing source IDs and separately identified user-supplied records in `teamEvidence`. Trajectory and terrain records travel with the captured drive. [Review contract](agency-review.md) |

## Call the calculator

Input is `{version, name, parts, conditions, customNames?}`. Load the lunar example, parts catalogue and scenario schema as JSON. All 11 slot IDs and 56 conditions are required. Selecting a part merges its declared defaults. Importing a scenario preserves explicit overrides.

```js
import { selectPart, setEnvironment, simulate } from './prototype/model.mjs';

const baseline = simulate(lunarScenario, partsCatalogue, scenarioSchema);
const swapped = selectPart(lunarScenario, 'material', 'pe', partsCatalogue);
const night = setEnvironment(swapped, 'Mars', 'night');
const result = simulate(night, partsCatalogue, scenarioSchema);
```

`result` contains `version, name, resultClass, compatibility, sourceIds, mobility, power, thermal, air, coupon, tracer, flow, suppression, sourcing, notes`. Units and nullability are in [result.schema.json](result.schema.json). `sourceIds` joins to `sources[].id` for selected component references and shared methods. All calculated results have `resultClass = "simulation"` and `compatibility = "unverified"`. A null field or group means unavailable/withheld. Keep it distinct from zero. `simulate` throws on invalid input. Catch the exception and display the message before updating results.

The existing adapter uses an imposed flame-front speed and reports wet combustion-product fractions. This package uses dry initial gas and leaves `flow.spreadRateMmS` null. Map shared inputs with units and model domains preserved. Label any defaults supplied when importing legacy designs.

## Run and verify

From the folder containing this handoff, run the server and open [the local workbench](http://127.0.0.1:8766/prototype/). The provided offline ZIP unpacks to the same layout. No JavaScript build step or online service is required. Review files and imported observations stay in the browser until a user downloads them.

```sh
python3 -m http.server 8766 --bind 127.0.0.1
```

Run these checks from a second terminal in the same folder. The first two use the Python and Node standard libraries. The browser checks require local Playwright and Chromium; set `PLAYWRIGHT_MODULE`, `CHROMIUM_EXECUTABLE` and optionally `ROVER_TEST_URL` to use existing installations.

```sh
python3 verify_catalogues.py
node --test prototype/*.test.mjs
node tests/3d-browser.cjs
node tests/field-browser.cjs
node tests/overlay-browser.cjs
python3 package_workbench.py
```

The portable tests verify the tile's data bytes and provenance. Running inside the full NASA workspace additionally compares all 4,225 lunar samples with the project’s original PDS row-band. Rebuilding from the upstream imagery requires that external row-band. The workbench uses the local extract at runtime. [NASA conversions and validation](terrain/README.md)

## Research coverage

The 54 records include 51 complete local files. The AEB management report, AEP GuaraniSat-2 drawing and KASA rover announcement are link-only after incomplete downloads. Each agency entry has locally archived supporting evidence. Individual records identify contractors, instrument teams and national programmes.

Edit the reviewed records under `evidence/{partners-a,partners-b,partners-c,methods}.json`. Run `python3 verify_catalogues.py --write` after review to regenerate the hash-checked catalogue.
