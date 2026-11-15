# The sealed-cabin model and its next validation experiment

## Run the Physics Lab

Open **Physics Lab** in the dashboard. Choose a cabin volume, starting oxygen by volume and absolute pressure. Select cellulose or polyethylene and set the linear mass loading, strip length, assumed spread speed and oxygen cutoff. Scrub across the 120-second trace to inspect wet-basis oxygen, carbon dioxide, chemical and electrical energy, and burned length. The rover sandbox lets you combine and name components, edit their size, mass and energy, and save one design on the device. Cabin and chassis presets are illustrative. The NASA Lunar Terrain Vehicle is open and NASA describes JAXA's rover as pressurized. [NASA LTV](https://www.nasa.gov/moonbase/lunar-terrain-vehicle/) · [NASA–Japan rover agreement](https://www.nasa.gov/news-release/nasa-japan-advance-space-cooperation-sign-agreement-for-lunar-rover/).

The chamber starts at 300 K with oxygen and nitrogen. Initial gas amount in moles follows the ideal gas law. For each dry repeat unit CₐHᵦO𝒸, complete combustion consumes ν = a + b/4 − c/2 moles of O₂, produces a moles of CO₂ and b/2 moles of water vapor, and leaves nitrogen unchanged. If n₀ is the starting gas amount, x₀ the starting oxygen fraction, xₗ the assumed cutoff, and Δn = a + b/2 − ν, the cutoff-limited extent is max(0, n₀(x₀ − xₗ)/(ν + xₗΔn)). The reaction extent at a given time is the smallest of that quantity, the available repeat units and the units consumed at the imposed speed. Both oxygen and carbon dioxide percentages use the final gas amount as denominator.

The heat calculation uses 15.2 MJ/kg for cellulose and 43.4 MJ/kg for polyethylene. The battery adds the prescribed power multiplied by elapsed time, capped at available watt-hours. A separate constant-pressure, stoichiometric flame-zone calculation balances net chemical heat against temperature-dependent sensible enthalpy for nitrogen, CO₂ and water vapor. Its upper fit bound is 3,500 K. It omits dissociation and heat loss. Condensation, smoke chemistry, electrical runaway, flame quenching, wall temperature and actual pressure history require additional models. Gravity changes weight and an illustrative buoyant velocity scale; neither the Moon nor Mars setting supplies a gravity-specific measured front speed. [NBS heat-of-combustion data](https://nvlpubs.nist.gov/nistpubs/Legacy/TN/nbstechnicalnote1128.pdf) · [Cantera GRI-Mech thermochemical fits](https://github.com/Cantera/cantera/blob/v3.1.0/data/gri30.yaml).

## Compare the model with the Saffire-I record

**Reverse the flow** pairs the two Saffire-I runs with a controlled sensitivity test. In PSI-98, original CSV rows 2 and 3 report 20 cm/s airflow, 21.5–21.7% starting oxygen for S1 and approximately 21.5% for S2. The archived source records describe SIBAL fabric. NASA's slide 21 annotates the measured fronts at 1.8 mm/s concurrent with flow and 1.3 mm/s opposed. The rates are cited publication measurements, distinct from the original table cells. [NASA PSI-98](https://doi.org/10.60555/0t15-1z43) · [NASA Saffire-I result, slide 21](https://ntrs.nasa.gov/api/citations/20170008805/downloads/20170008805.pdf#page=21).

Select **Compare both inputs**. FIRST FIRE converts the two speeds to 0.18 and 0.13 cm/s and runs two scenarios at the same selected time. It holds all other user inputs fixed and preserves material exhaustion and the assumed oxygen cutoff. At the default conditions and 60 seconds the fronts reach 10.8 and 7.8 cm. These are scenario outputs. The flight rates are inputs, so replaying them supplies no independent test of a propagation prediction. Separate oxygen, flow, specimen geometry, material, gravity and front-position evidence would be necessary to transfer a measurement. The proposed follow-up uses fresh specimens and counterbalances direction order to help distinguish flow effects from thermal history.

The design takes inspiration from FLUXFIRE's explicit condition matching and FlameBound's presentation of a target beside a source-located condition. The interface, calculations and tests are original to FIRST FIRE. [FLUXFIRE evidence policy](https://github.com/shomratmortaza/fluxfire-Orbital.Mind/blob/ea74d6249d636abe40220d1e907fac454487b294/SCIENTIFIC_INTEGRITY.md) · [FlameBound condition comparison](https://github.com/prattaybanik03/flamebound-flame-in-freefall/blob/main/web/src/components/HazardBanner.tsx).

## Experimental liquid-network benchmark

The on-device estimator predicts oxygen percentage over the same 120-second trajectory. Forty-two recurrent neurons have input- and state-dependent conductances. The recurrent weights are seeded and fixed; ridge regression fits their output weights on 640 whole synthetic simulator runs. The model constrains its prediction to the initial oxygen and assumed cutoff. Prediction is disabled outside the documented training domain. Evaluation reserved 160 independently sampled whole runs, with 60 post-initial time points per run.

| Oxygen error, percentage points | Result |
| --- | ---: |
| Network mean absolute error | 0.275 |
| 95th percentile absolute error | 0.957 |
| Worst absolute error | 3.288 |
| Mean absolute error from holding O₂ constant | 1.109 |

These errors measure agreement with the sealed-chamber equations. Surface-specific fire validation needs independently measured burns. Runtime speedup has not been benchmarked. To reproduce the parameters and scores from the repository root, run `node scripts/train_cabin_liquid.cjs`. Run `node --test tests/physics-lab.test.cjs` for conservation, boundary conditions, temperature fit bounds, and surrogate range checks. [Liquid time-constant networks](https://arxiv.org/abs/2006.04439).

## Validation with sensor traces

The new [transport lab](#transport-lab) implements a prescribed finite tracer pulse in two connected compartments, a remote sensor, and a fit-and-repeat check against published whole-room mixing times. [Equations and measured errors](advanced-methods.md). Further validation requires independent concentration time series.

Start with a question the measurements can constrain: given a prescribed release of tracer gas into a ventilated chamber, what concentration should a remote sensor read, and how long should it take to respond? A model of transport can address that question without claiming to predict ignition, flame spread or whether a cabin is safe. It matters for the archive: outlet concentration can rise when flow falls even if the material does not produce more gas. NASA has modeled the vehicle response using measurements from Saffire V. [NASA vehicle-modeling paper](https://ntrs.nasa.gov/api/citations/20240008602/downloads/ICES-2024-310.pdf)

### Tracer transport experiment

1. Represent the test chamber and a remote sampling volume as connected, well-mixed zones. Store gas mass and species masses in kilograms, temperature in kelvin, pressure in pascals, zone volume in cubic metres, and directional mass flows in kg/s. Distinguish total pressure, oxygen volume fraction and oxygen in a burner stream.
2. At each step, compute each species' mass change from incoming and outgoing species flow plus a **prescribed** source, then update the sensor with its own transport delay and first-order response. The same nonnegative flux exits one zone and enters the next. Specify the initial state, inlet composition, exhaust condition and clock origin; if a necessary condition is missing, request it. Converting a recorded volumetric flow to a mass flow requires its pressure, temperature and composition.
3. Begin with an analytic control: for constant density, volume and ventilation, a passive well-mixed tracer decays as C(t) = C₀ exp(−Qt/V) above a zero-concentration inlet, with Q and V expressed in compatible units. Test zero source, a sealed zone, mass balance, positivity and step-size convergence. A seal cannot silently dispose of gas.
4. Fit exchange and sensor-response parameters on calibration time series with known release and ventilation. Reserve **entire runs or sensors** for validation; adjacent video frames cannot be separate train/test samples. Align sample clocks and estimate calibration error. Compare against a single-zone mixing baseline using held-out concentration residuals, onset-time error and interval coverage; publish a residual plot stratified by flow changes. Predeclare acceptable error from measurement uncertainty or an engineering use case before fitting. An attractive animation is not a validation result.

The 1,058 archived observation rows are an index, not synchronized full-field trajectories. Obtain sensor streams, a geometry sketch, release history, timestamps, pressure and ventilation calibration before training or fitting. A short burn or sparse summary may make source strength and mixing rate non-identifiable. A plume image without radiometric calibration cannot be converted into arbitrary heat-release units.

## Expansion and stopping rules

| Candidate | Add when | Principal limitation |
| --- | --- | --- |
| Two-zone conservative transport | A known source and independent time series are available | Cannot predict ignition, fuel production or gravity-driven plume geometry. |
| Coupled solid heating and pyrolysis with low-Mach flow | Material properties, geometry, boundary conditions and suitable independent experiments are available | Needs convergence checks and separate validation for each gravity, material and ventilation regime. |
| Learned surrogate of a verified solver | There is a designed parameter sweep, a runtime need and held-out experimental validation | Can interpolate solver bias; must reject extrapolation and report uncertainty. |
| Generative visual model | Only when generating clearly labelled educational illustrations | Cannot supply numerical physics, experimental evidence or a validation target. |

[NIST’s reduced-gravity spacecraft-fire study](https://www.nist.gov/publications/large-scale-fire-dynamics-spacecraft-reduced-gravity) explains the particular challenge of predicting fuel generation. Use the [FDS technical, verification and validation guides](https://pages.nist.gov/fds-smv/manuals.html) when selecting a high-fidelity comparison. Microgravity, partial gravity and Earth gravity need separate checks. A well-mixed model fitted in orbit cannot acquire lunar buoyancy by changing a number in a prompt.

## Chat-to-solver boundary

A later tool could accept a versioned **Scenario** (geometry, units, material/phase, gravity vector, gas state, boundary conditions, measured inputs, provenance and uncertainties) and return a **Run** (solver/version, input hash, calibration domain, numerical warnings, output time series and validation status). The server validates all fields, enforces model applicability and executes a fixed solver; chat can explain a returned result with a run ID. The interface must label **measured**, **simulated**, **assumed** and **unknown** separately. The current FM² shared-threshold probability exercise is not a fluid or combustion simulator. Refuse to invent a simulation, certify a material, or silently substitute Earth values when evidence is missing.
