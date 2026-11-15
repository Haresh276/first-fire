# Driving and replaying a rover traverse

Use the traverse to compare how a declared assembly would move and spend energy on a chosen height field. A waypoint run and manual driving both call the same physics step. The rover turns, climbs, draws power and can stop short of a destination. The assumed wheel slip and friction need calibration against a specific wheel, normal load and surface. NASA, for example, used displacement measured by Curiosity’s cameras to check slip against wheel odometry. [Curiosity visual odometry](https://science.nasa.gov/resource/curiosity-tracks-its-tracks/) · [Ground wheel and simulant experiment, §2.1](https://link.springer.com/article/10.1007/s11214-025-01164-8)

## Drive an assembly

The module is plain JavaScript and also runs in Node. Pass the selected scenario and its current simulation result to `makeTraverseConfig`. This imports assembly mass, battery capacity, starting charge, solar generation and electrical load. The traverse starts from the scenario’s **initial** battery state. Its energy budget is independent of the stationary calculation over the scenario’s full duration. [Traverse API](prototype/traverse.mjs) · [Assembly model](prototype/model.mjs)

```js
import { simulate } from './prototype/model.mjs';
import { makeTraverseConfig, createTraverse, stepTraverse, runRoute } from './prototype/traverse.mjs';

const result = simulate(scenario, parts, schema);
const config = makeTraverseConfig(scenario, result, {
  terrain: 'grade',
  slipFraction: 0.05,
  reservePct: 15
});
const start = { xM: 0, zM: 0, headingRad: 0 };
let pose = createTraverse(config, start);
pose = stepTraverse(pose, { throttle: 0.5, steer: 0 }, 1, config);

const goals = [{ xM: 0, zM: 10 }, { xM: 5, zM: 10 }];
const options = { start, dtS: 0.5, maxTimeS: 120, toleranceM: 0.15 };
const route = runRoute(config, goals, options);
```

## Coordinates and terrain

Coordinates and heights use metres. Heading zero faces +Z, positive heading turns toward +X and +Y is up. Positive pitch raises the nose. Positive roll raises the right side. `heightAt(xM,zM,terrain)` returns the ground contact reference elevation. The renderer adds the chassis offset and reads the pose in radians.

| Terrain ID | Height or source |
|---|---|
| `flat` | Zero height everywhere. |
| `grade` | Height = 0.10 × zM. The plane climbs 10% toward +Z, approximately 5.71°. |
| `rolling` | Height in m = 2 sin(xM/16) + 3 sin(zM/22). Both sinusoidal terms are synthetic. |
| `lola` | Lunar south polar topography sampled from LRO’s Lunar Orbiter Laser Altimeter elevation product. Bilinear interpolation between grid samples spaced 80 m apart gives model height relative to the centre. Coverage extends 2,560 m from the centre in either coordinate. It must be used with the Moon environment. Interpolation cannot resolve local hazards smaller than the grid. [Subset metadata](terrain/lola.json) · [Original product label](terrain/ldem_80s_80m.lbl) |

A centred elevation stencil estimates the terrain gradient, using the available side at the lunar map boundary. Projecting that gradient along the vehicle heading and toward its right yields pitch and roll. The steepest-direction slope governs the normal force. The two directional angles are grade indicators. The contact point and their values do not resolve suspension articulation, individual wheel contacts or a rollover margin.

## Motion and traction

Throttle ranges from −1 (reverse) to +1 (forward), with zero stationary. Steer ranges from −1 to +1. It commands angular rate independently, so a stationary rover can pivot. The ideal centre speed along the surface is `speedMps × throttle × (1 − slipFraction)`. The longitudinal slip fraction is prescribed. Dividing actual centre travel by the retained fraction gives the distance indicated by the driven wheels. The average wheel rotation equals signed wheel travel divided by wheel radius. For a heading change Δψ, the left and right rotations also gain and lose Δψ × track width / (2 × wheel radius), respectively. The differential-drive approximation permits smooth curves and pivots for mixed component concepts. Geometry-specific steering and soil deformation would require additional calibration.

The surface step uses idealized low-speed force balance. The weight is mass × nominal local gravity (1.62 m/s² on the Moon, 3.71 on Mars and 9.80665 on Earth). The normal force N equals weight × cos(steepest slope). The gravitational force along the heading is weight × sin(pitch). The remainder of the tangential gravity vector acts across the vehicle. Rolling resistance adds a signed force of magnitude `rollingResistance × N` in the direction of travel. The available static traction is `friction × N`. The magnitude of the required tangential force, plus a turn allowance of `rollingResistance × N` when steering, must fit within that traction budget. Otherwise the step stops at the previous feasible pose. Open decks and pressurized cabins may both drive on a surface. Ideal orbital free fall has no supported wheel contact.

Horizontal travel is the surface speed projected through the mid-step pitch. An arc with constant angular rate advances the horizontal pose. Each call accepts 0–2 seconds and splits it into equal substeps no longer than 0.25 s. This bounds the slope approximation on changing terrain. A map-boundary stop rejects the first substep whose endpoint would leave the supported area. The final pose can be a fraction of a step inside that boundary. This model has no collisions, tire sinkage, suspension dynamics, inertial braking distance or lateral skid trajectory.

## Energy accounting

The effective longitudinal wheel speed is the signed centre speed divided by the retained fraction after slip. Multiplying by the signed required longitudinal force gives mechanical power. Downhill braking dissipates surplus mechanical energy. Turning adds the assumed resistance force × absolute angular rate × half track width. Dividing the motoring and turning powers by efficiency gives electrical drive power. The base equipment draw `hotelW` is separate. Enter a base draw that excludes the extra traction energy calculated here.

A period of t seconds contributes power × t/3,600 watt-hours. Solar energy is counted gross. Surplus after the pack is full is recorded as curtailment. A net draw stops at the requested reserve, and the final moving substep is shortened to the exact available duration. An idle command can recharge the vehicle when solar generation exceeds base load. A traction, map or orbital stop adds no time or standby energy for the rejected part of a command. In each accepted step:

```text
initial battery Wh + solar Wh = final battery Wh + drive Wh + hotel Wh + curtailed Wh
```

| Configuration field | Meaning and accepted range | Default |
|---|---|---|
| `speedMps`, `turnRateRadS` | Full-command wheel surface speed 0.01–8 m/s, yaw rate 0.01–2 rad/s | 1, 0.35 |
| `trackWidthM`, `wheelRadiusM` | Track width 0.05–10 m, wheel radius 0.01–2 m | 1.8, 0.25 |
| `rollingResistance`, `friction` | Dimensionless rolling-resistance coefficient 0–1 and available static-friction coefficient 0–2 | 0.05, 0.5 |
| `efficiency`, `slipFraction` | Motoring efficiency 0.01–1 and assumed longitudinal slip 0–0.95 | 0.75, 0.05 |
| `reservePct` | Lower operating reserve, 0–100% of capacity | 10% |
| `massKg` | Total driving mass, 0.01–100,000 kg | Scenario mass |
| `solarW`, `hotelW` | Constant delivered solar power 0–160,000 W and base draw 0–30,000 W | Stationary result generation and scenario load |
| `capacityWh`, `initialWh` | Battery capacity and charge, each 0–200,000 Wh. Initial charge must fit in the pack. | Scenario capacity and initial state of charge |

## Waypoints, telemetry and replay

`runRoute(config, waypoints, options)` accepts 1–64 ordered horizontal goals. It rotates toward each goal, then travels toward it, reducing the final throttle to avoid overshoot. The route follows the supplied goals in order and stops at an infeasible segment. No search for a lower-energy detour is performed. The caller may provide a different route and replay both under identical assumptions. A goal is reached within the horizontal acceptance radius, default 0.15 m (allowed 0.01–5 m). Start and goal coordinates must be finite and within ±1,000,000 m. Lunar-map goals have the tighter map bound above.

The control interval is 0.05–2 s (default 0.5 s). The maximum mission time is 0–86,400 s (default 3,600 s), capped at 100,000 control intervals. The return contains `status`, `waypointsReached`, final `state` and `track`. A route terminates with `route complete`, `time limit`, `traction limit`, `battery reserve`, `map boundary` or `orbital free fall`. The track starts at the initial pose, includes states at successive control intervals and ends with the final status.

Each state contains position (`xM,yM,zM`), orientation (`headingRad,pitchRad,rollRad`), terrain slope (`slopeRad`), wheel rotation (`wheelAngleRad,leftWheelAngleRad,rightWheelAngleRad`), last steering command (`steer`), signed surface speed (`speedMps`), cumulative surface distance (`distanceM`), elapsed time (`elapsedS`), stored energy (`batteryWh`) and cumulative electrical budgets (`driveWh,hotelWh,solarWh,curtailedWh`). A terminal state reports zero current speed. A pivot can use time and energy while adding zero centre travel.

Serialize the exact configuration, waypoints, initial pose and options to reproduce an automatic route. For manual drives, retain the ordered throttle, steer and duration triples. Replaying the same sequence against the same version and terrain reproduces the trajectory. Actual navigation errors from wheel slip, localization or unobserved obstacles would require independent position measurements. [NASA’s lunar surface navigation survey](https://ntrs.nasa.gov/api/citations/20250000720/downloads/Lunar_Surface_Nav_Survey_AAS_GNC_011825.pdf)

The executable tests compare flat and sloped motion against independent calculations, check reserve crossing, energy conservation and wheel odometry, repeat a route from serialized inputs and exercise map boundaries and orbital free fall. Run `node --test prototype/traverse.test.mjs` from this directory. [Traverse tests](https://github.com/Haresh276/first-fire/blob/main/rover-design/prototype/traverse.test.mjs)
