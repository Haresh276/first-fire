# Rover sandbox tool reference

Version 1.0 evaluates one assembly over a user-specified interval. Gas, electric power, thermal rejection, a prescribed reaction, passive tracer and agent discharge are independent calculations. A power shortfall is reported in the output. It does not automatically slow the fan or disable a detector. [Calculation code](prototype/model.mjs) · [Executable acceptance tests](https://github.com/Haresh276/first-fire/blob/main/rover-design/prototype/model.test.mjs)

## Inputs and results

Use the per-field schema for the exact spelling, units, inclusive minimum and maximum, integer constraints and permitted text values. Every field listed in `conditions.required` must be present, including fields unused by the selected assembly. Defaults help construct a scenario. The simulator rejects missing or unknown fields, invalid part IDs, numeric strings, nonfinite numbers and out-of-range values. Input bounds are limits of this implementation. A value inside those limits still needs physical justification for the assembly. [Scenario schema](scenario.schema.json) · [Complete lunar example](examples/lunar-cellulose.json)

The return value contains `version`, the scenario `name`, `resultClass` set to `simulation`, `compatibility` set to `unverified`, unique `sourceIds`, diagnostic `notes` and the result groups below. A JSON `null` means the calculation is unavailable or its outcome is unknown. Zero is a calculated value. Source IDs point to records with the document, locator, conditions and limitations. [Evidence register](sources.json) · [Output field schema](result.schema.json)

## Assemble the vehicle and payload

`selectPart(scenario, slot, id, catalog)` accepts an existing slot and an ID from that slot. Its returned scenario copies the input, replaces the ID in that slot and merges the part’s `assumedSettings` into the conditions. This overwrites only the settings listed for the incoming part. Previously entered values survive when the new part supplies no replacement. `simulate` uses the saved conditions as entered. The catalog does not certify a mount, power connection or software interface. Optional per-slot `customNames` are 1–80 characters and change the label only. [Part catalog](parts.json) · [Scenario schema](scenario.schema.json)

| Slot | What changes in the calculations |
|---|---|
| Cabin | A sealed cabin enables the shared atmosphere, coupon, flow and tracer tools. An open deck returns `null` for all four. Suits require a separate budget. |
| Chassis and wheels | Selection can set chassis mass and wheel count. They feed the static support calculation. Terrain traction, clearance, suspension travel and structural margins require separate evidence. |
| Payload | Select the spectrometer, cargo locker, weather suite, navigation camera, drill or regolith instruments. Enter the installed payload and fixtures once in `payloadKg` (kg), include its draw in `loadW` (W) and any heat actually routed to the panel in `internalW` (W). |
| Power, thermal, life support and access | Selections provide the solar or battery configuration, radiator areas, scrubber capability and cycled access volume used below. |
| Material, detection and suppression | Selections determine which chemical constants apply, whether a detector can alarm and whether there is an installed agent supply. |

**Assembly check.** Select `drill` for `payload` in the lunar example. Its empty settings object preserves the declared 40 kg payload, 500 W total load and 1,660 kg assembly mass. The result includes references `esa-01`, `esa-02`, `asi-01` and `uksa-01`; the simulated hole depth is unspecified. Selecting `open-deck` in the power slot throws an error. The generic part-selection test checks every catalog row, the merged settings, provenance and input immutability. [Interface scopes and payload evidence](parts.json)

## Environment and illumination

`setEnvironment(scenario, world, phase)` returns a copy with the chosen world and phase, updated absolute exterior pressure, stored sunlit flux and the corresponding day or night radiant sink. Radiant sink temperature describes the effective longwave surroundings of the panel. The user can edit a preset. The actual shortwave flux used by both the solar array and radiator is the stored value during day and exactly zero at night. The tool accepts a phase label directly and does not derive sunrise from coordinates. [Environment method records `moon-env`, `mars-env` and `orbit-env`](evidence/methods.json)

| World | Ideal support reference (m/s²) | Exterior pressure (kPa abs) | Sunlit flux (W/m²) | Day / night radiant sink (K) |
|---|---:|---:|---:|---:|
| Moon | 1.62 | 0 | 900 | 245 / 100 |
| Mars | 3.71 | 0.636 | 450 | 235 / 185 |
| Earth | 9.80665 | 101.325 | 700 | 295 / 275 |
| Orbit, ideal free fall | 0 | 0 | 1,361 | 225 / 180 |

**Preset check.** Applying Mars/night sets the stored flux to 450 W/m² and the sink to 185 K. Even with nonzero panel area, generation and absorbed shortwave power both equal 0 W. A lunar or orbital scenario specifying exterior pressure above 0 kPa is rejected. Changing only the stored `phase` field on import does not reset a custom `sinkK`; use the preset function to apply all four environmental settings.

## Static wheel loading and accelerometer

Mass is `chassisKg + hardwareKg + payloadKg + crew × personKg` in kg. Include other installed dry hardware in `hardwareKg` and worn gear in `personKg`. The result reports `mobility.massKg`, `idealSupportAccelerationMs2` in m/s² and `staticSupportN = massKg × g` in N. Ground cases assume level, equally loaded wheels and divide by the installed integer `wheels` to give `staticLoadPerWheelN`. In orbital free fall the ideal support force is zero and wheel contact load is `null`.

For an entered three-axis reading (`accelX`, `accelY`, `accelZ`, m/s²), `specificForceNormMs2` is the square root of the sum of squares. In `stationary supported` mode on a surface, `stationaryNormAgrees` is true when the norm differs from the reference by at most `imuTolerance` (m/s²). A moving or free-falling reading still yields its norm with agreement `null`. The `no reading` setting returns both fields as `null`. No measured acceleration is synthesized.

**Load and IMU checks.** A 500 kg assembly on four wheels on the Moon gives 810 N total and 202.5 N per wheel. A stationary supported reading of (−0.972, 0, 1.296) m/s² gives 1.62 m/s² and agrees. The same reading in orbit has no stationary comparison. [Gravity and IMU tests](https://github.com/Haresh276/first-fire/blob/main/rover-design/prototype/model.test.mjs)

## Electrical energy

Inputs are the effective day/night flux, `panelM2` (m² projected), `pvEff` (fraction), `capacityWh` (usable Wh), `startPct`, `loadW` (whole vehicle W) and `hours` (h). Solar generation is flux × area × efficiency in W. Battery-only hardware always gives zero generation. Initial energy is capacity × start percentage / 100. Raw ending energy is initial energy + (generation − load) × hours.

`power.generationW` is instantaneous generation under the specified constant conditions. `demandWh` is load × hours. `endWh` is raw ending energy clamped to [0, capacity]. `curtailedWh` is excess above capacity and `unmetWh` is the positive deficit below zero. The calculation sums energy over the interval with no separate charge-rate limit.

**Check.** A 1,000 Wh pack starting at 80%, a 4 m² panel, 500 W/m², 25% conversion, 400 W demand and 2 h give 500 W generation, 800 Wh demand and 1,000 Wh ending energy. Keeping that starting charge and drawing 600 W for 2 h at night leaves 0 Wh and 400 Wh unmet.

## Radiator heat balance

Enter `skinK` and `sinkK` in K, total `radiatorM2` and sun-facing `projectedM2` in m², infrared `emissivity` and solar `absorptivity` as fractions, and `internalW` as heat delivered to this radiator. Projected area must be no greater than emitting area. With σ = 5.670374419 × 10⁻⁸ W/(m²·K⁴), the thermal group returns three signed or nonnegative rates in W.

- `netLongwaveOutW = emissivity × σ × radiatorM2 × (skinK⁴ − sinkK⁴)`. A warmer sink produces a negative value.
- `absorbedSunW = absorptivity × projectedM2 × effective solar flux`.
- `rejectedMinusLoadW = netLongwaveOutW − absorbedSunW − internalW`. A positive result indicates excess rejection at the prescribed skin temperature. Skin temperature, elapsed cooling time and cabin temperature are not solved.

**Check.** With a 300 K skin, 200 K sink, 2 m² radiator, 0.5 m² projection, emissivity 0.8, absorptivity 0.25, 800 W/m² sun and 50 W internal load, these outputs are 589.719 W, 100 W and 439.719 W. [Thermal method `thermal-method`](evidence/methods.json)

## Sealed cabin, crew and gas losses

**Initial atmosphere.** Enter dry gas `volumeM3` (m³), `pressureKPa` (absolute kPa), `gasK` (K) and `oxygenPct` (vol %). With x = oxygenPct/100 and R = 8.31446261815324 J/(mol·K), the `air` group returns `inventoryMol = 1000 × pressureKPa × volumeM3 / (R × gasK)`, `initialO2Mol = x × inventoryMol` and `initialO2KPa = x × pressureKPa`. **Check.** A 12 m³ cabin at 70 kPa, 295 K and 30% oxygen holds 342.4704 mol total and 102.7411 mol O₂. Its oxygen partial pressure is 21 kPa.

**Crew and removal.** Enter `crew` (people), `hours`, `activity` and `scrubGhr` (g CO₂/h). Oxygen demand and carbon dioxide production each equal the corresponding rate × occupants × hours × 60. The paired O₂/CO₂ rates in g per person per minute are 0.37/0.44 for sleep, 0.59/0.69 for nominal activity and 3.99/5.22 for aerobic activity. Outputs are `metabolicO2G`, `metabolicCO2G`, `scrubbedCO2G` and `unremovedCO2G`, all in grams. With a scrubber, removed mass is the smaller of production and capacity × hours. Storage-only hardware removes zero. **Check.** One nominal occupant for 1 h consumes 35.4 g O₂ and produces 41.4 g CO₂. With a 12 g/h scrubber, 29.4 g CO₂ remains unremoved. [`crew-method`, NASA BVAD table 3-24](evidence/methods.json)

**Leak, airlock and suitport.** Assume a regulated, uniform cabin and constant gas temperature. For Δp = cabin − exterior pressure in kPa and Δp ≥ 0, `outwardLeakMol = leakMolHrKPa × Δp × hours`, where conductance is in mol/(h·kPa). The lock or suitport cycles only the isolated interface volume. `accessLossMol = 1000 × Δp × lockM3 × cycles × (1 − recovery) / (R × gasK)`. Recovery is a fraction. The standard lock presets 1.5 m³ and 75% recovery. The suitport presets 0.04 m³ and zero recovery. Suit purge would be a separate demand. [Access method `access-method`](evidence/methods.json)

`replacementMixtureMol` equals leakage + access loss. For the model’s binary O₂/N₂ make-up gas, `oxygenSupplyG = metabolicO2G + replacementMixtureMol × x × 31.998` and `nitrogenSupplyG = replacementMixtureMol × (1 − x) × 28.014`. These are required supply masses. Inward gradients withhold all five loss and supply outputs as `null`. Initial cabin inventory and metabolic demand remain available.

**Checks.** At 70 kPa above vacuum for 4 h, conductance 0.002 mol/(h·kPa) loses 0.56 mol. One standard lock cycle at 295 K loses 10.7022 mol. Under the same conditions the suitport loses about 1.142 mol. Full recovery removes the cycling loss. Equal pressures give zero outward and cycling losses.

## Coupon chemistry and stock sourcing

For a sealed cabin and a characterized material, enter `reactedG` (prescribed dry mass in g). Let M be the repeat-unit molar mass in g/mol, ν the stoichiometric mol O₂ per mol repeat unit and H the net heat in kJ/g. For cellulose (C₆H₁₀O₅), M = 162.141, ν = 6 and H = 15.2. For polyethylene, using CH₂, M = 14.027, ν = 1.5 and H = 43.4. `coupon` returns `prescribedG`, `stoichiometricO2Mol = reactedG × ν / M`, `netChemicalPotentialKJ = reactedG × H`, and `inventoryCoversDemand` (demand ≤ initial cabin O₂). A shortage makes this flag false. It does not truncate the prescribed reaction. Unknown chemistry or an open deck yields `coupon: null`. The calculation gives no ignition time, flame speed, heat-release rate or combustion history. [`material-heat`, NBS TN 1128 table 1](evidence/methods.json)

**Chemistry check.** For 10 g, cellulose requires 0.370048 mol O₂ and gives 152 kJ of potential net heat. Switching only to polyethylene gives 1.069366 mol and 434 kJ. Tracer concentrations and alarm time are identical for this matched pair. [Lunar cellulose](examples/lunar-cellulose.json) · [Lunar polyethylene](examples/lunar-pe.json)

The stock budget applies to every assembly. Enter `stockOrigin`, `yieldPct`, `thicknessMm`, `lotId` and `reactedG`. `sourcing` returns `origin`, `netG = reactedG`, `feedG = netG / (yieldPct/100)`, `trimG = feedG − netG` and the recorded `thicknessMm`. An Earth supplier plus known chemistry yields `evidenceStatus` of `vendor analogue only`. All other combinations return `unverified source or process`. `traceability` reports the trimmed user-entered lot or `lot unknown`. `qualification` is always `null`. Thickness records the stock description and does not drive a burn law. **Stock check.** A 12 g coupon at 50% yield needs 24 g of stock and produces 12 g trim. Changing its origin to reclaimed stock changes its evidence status and preserves those masses. [Stock records `stock-cellulose` and `stock-pe`](evidence/methods.json)

## Ventilation, tracer and detection

**Bulk flow at the coupon.** In a sealed case, a single ideal return duct carries `exchangeLs` (0–500 L/s) through `sectionM2` (0.001–1 m²). `flow.ductSpeedMs = exchangeLs / (1000 × sectionM2)`. The inlet `fanFrom` and ignition end `igniteAt` each accept `end A` or `end B`. For positive flow, equal ends give `relativeDirection = concurrent` and opposite ends give `opposed`. With no exchange, the value is `no forced flow`. `spreadRateMmS` stays `null`. This diagnostic gives an ideal bulk velocity. A measured velocity profile at the actual coupon would require an instrument and a geometry-specific test. **Check.** 30 L/s through 0.15 m² gives 0.2 m/s. Reversing only the coupon ignition end toggles the direction label and leaves the speed unchanged. [Flow comparator `psi-saffire` and measurement reference `flow-measurement`](sources.json)

**Passive tracer exchange.** Divide the sealed volume V (`volumeM3`) into two equal, internally mixed zones. Inject `pulseMg` once into `ignition` (equipment bay or crew space). Sample in `sensor` (same choices). These zone names are independent of the coupon’s duct-end labels. Let μ = pulseMg/V (mg/m³), Q = exchangeLs/1000 (m³/s) and k = 4Q/V (s⁻¹). At t = `windowS`, the `tracer` group returns `sourceMgM3 = μ(1 + exp(−kt))`, `remoteMgM3 = μ(1 − exp(−kt))` and the selected concentration `atSamplingZoneMgM3`. `tracerAccountedMg` is their combined source and remote concentration multiplied by V/2. Symmetric exchange conserves the released mass. It does not consume oxygen or generate smoke from the chosen coupon.

**Tracer check.** A 100 mg pulse in 10 m³, with 25 L/s exchange and a 100 s window, gives 13.6788 mg/m³ at the release zone, 6.3212 mg/m³ at the remote zone and 100 mg accounted. Zero exchange keeps the two concentrations at 20 and 0 mg/m³.

**Ideal detector.** For a detector in the release zone, threshold crossing occurs at t = 0 if the initial concentration 2μ reaches or exceeds `thresholdMgM3`. Otherwise that zone only decreases. A remote sensor crosses at −ln(1 − threshold/μ)/k only when k > 0 and threshold < μ. Equality at a positive remote threshold takes infinite time. `thresholdTimeWithDelayS` is crossing time + `delayS` if a detector is fitted and that time is within `windowS`, inclusive. Otherwise the result is `null`. Concentrations remain available with no detector. **Detector check.** At 100 mg, 10 m³ and 25 L/s, a remote 5 mg/m³ threshold plus a 5 s delay gives 74.3147 s in a 75 s window, or `null` in a 74 s window. [Detector reference `fire-method`](evidence/methods.json)

## Suppression inventory

Enter `agentKg` (kg), `agentGps` (g/s) and `dischargeS` (s). With an installed supply, `suppression.deliveredKg = min(agentKg, agentGps × dischargeS / 1000)` and `remainingKg = agentKg − deliveredKg`. Without an installed supply, both masses are zero. `extinction` is always `null`. The mass budget also runs on an open deck. Agent distribution, compatibility, cooling and extinguishment require evidence for the actual hardware and fire. **Check.** A 2 kg supply commanded at 40 g/s for 15 s delivers 0.6 kg and retains 1.4 kg. A 100 s command delivers only the available 2 kg. [`mist-method` and `fire-method`](evidence/methods.json)

Run the contract checks from this directory with `node --test prototype/*.test.mjs`. Numerical examples above are rounded for display. The executable checks use unrounded values and include invalid inputs, zero-duration cases, absence of hardware, energy clipping, mass conservation and the matched material comparison. [Acceptance tests](https://github.com/Haresh276/first-fire/blob/main/rover-design/prototype/model.test.mjs)

## Visual and field tools

The six engineering overlays display sign, direction or hardware location for the quantities above. They have fixed illustrative sizes and inherit the underlying model bounds. Positive solar generation shows incident light, higher-than-skin sink temperature reverses net longwave direction, zero access loss removes the cycling marker and zero discharge removes the agent marker. Turning a fan from end A to end B reverses the duct direction while the independent two-zone exchange rate retains its magnitude. Orbital free fall suppresses the surface support case. [Overlay operation and acceptance cases](OPERATIONS.md) · [Real-browser verification](https://github.com/Haresh276/first-fire/blob/main/rover-design/tests/overlay-browser.cjs)

The traverse takes bounded speed, turn rate, wheel geometry, terrain, slip, resistance, efficiency and reserve settings and returns a time-ordered state with wheel angles, position, attitude, energy and stop reason. The route file accepts at most 64 projected waypoints. [Inputs, equations, bounds and acceptance tests](traverse-reference.md) · [Route interchange schema](route-plan.schema.json)

The field comparator accepts 2–50,000 time-ordered observations up to 5 MB, a signed time offset in s and an optional positive interpolation-gap limit in s. Overlap must contain at least two matched rows. Translate both tracks at the first common physical sample. For row i, horizontal error is √(Δxᵢ² + Δzᵢ²), with signed differences computed as model minus observation in metres. Horizontal RMSE is √(Σ horizontal errorᵢ² / matched count). Battery-change RMSE uses available pairs relative to the first matched Wh pair. Outputs include matched counts, coverage, clock and origin provenance, missing/out-of-time rows and per-sample errors. A delayed recorder following the same constant-velocity path yields zero displacement error when correctly aligned in time. [API and independent acceptance cases](https://github.com/Haresh276/first-fire/blob/main/rover-design/prototype/field-comparison.test.mjs) · [Trial procedure](OPERATIONS.md)
