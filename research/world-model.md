# A physics model the chat can question

**Design proposal; no world simulator has been built or benchmarked.** Start with a question the measurements can constrain: given a prescribed release of tracer gas into a ventilated chamber, what concentration should a remote sensor read, and how long should it take to respond? A model of transport can address that question without claiming to predict ignition, flame spread or whether a cabin is safe. It matters for the archive: outlet concentration can rise when flow falls even if the material does not produce more gas. NASA has modeled the vehicle response using measurements from Saffire V. [NASA vehicle-modeling paper](https://ntrs.nasa.gov/api/citations/20240008602/downloads/ICES-2024-310.pdf)

## First experiment: tracer transport

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
