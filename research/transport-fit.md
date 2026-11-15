# Fit a sensor trace

Use **Transport Lab → Fit a sensor trace** to ask whether a transport model calibrated on one tracer release predicts the reading at a remote sensor during a second release. The two runs can have different release masses, pulse durations, volumes and ventilation. The model carries the calibrated exchange rate and sensor response time into the second run. A common sensor and comparable exchange conditions make that transfer interpretable.

## Run the comparison

1. Choose two distinct releases. Use their baseline-corrected concentration readings, timed from the start of each release. Supply a two-column CSV per run with header `time_s,sensor_mg_m3` or `time_s,sensor_ug_m3`. The tool converts µg/m³ to mg/m³. It accepts 6–3,000 readings, increasing timestamps from 0 to 300 seconds, at least 10 seconds of coverage, and files up to 2 MB. Negative baseline-corrected values are accepted.
2. Enter the source and sensor compartment volumes in m³, remote clean-air supply in L/s, released mass in grams and uniform pulse duration in whole seconds for **each** run. Select each file’s data origin. Include sensor location, clock alignment, background subtraction and flow configuration in your research notes.
3. Choose the near-fit allowance in mg/m³ and select **Fit and test held-out run**. The output compares held-out errors, plots residuals and reports how many parameter combinations fit the calibration trace within the allowance. **Download fit and residuals** saves the settings, origins, normalized observations, predictions and errors in JSON. Uploaded data are processed in the browser.

## What the model estimates

With constant equal-volume exchange in both directions, tracer flow from the source to the sensor compartment equals the exchange rate times the difference between their concentrations. Clean ventilation removes tracer from the sensor volume. A first-order sensor follows the remote concentration with time constant τ. Both compartments and the sensor start at zero excess concentration. The status of a smoke alarm is outside this passive-tracer model.

The fitting routine searches exchange from 0 to 800 L/s and τ from 0 to 60 s. A coarse grid followed by smaller local steps minimizes calibration root mean squared error (RMSE), weighting each recorded reading equally. Irregular sampling gives denser periods greater weight. The predictor integrates at 0.2 s, stores one-second samples and linearly interpolates to observation times. A competing single-compartment model instantly mixes the same mass throughout the combined volume, uses the same clean-air supply and calibrates its own τ on a 0.5 s grid.

The held-out readings enter only after the two fits. RMSE penalizes large misses, mean absolute error reports typical absolute error, and signed bias is prediction minus observation. Compare the residual curves for delayed arrivals or late departures even if the average error is small. The held-out run tests transfer to these conditions. Generalization needs independently repeated runs at other relevant settings.

## Read the synthetic example

Both examples use a 4 m³ source, an 8 m³ sensor compartment, 15 L/s of clean air, 38 L/s exchange and an 11 s sensor response. Calibration releases 0.50 g over 20 s. The held-out run releases 0.75 g over 32 s. The generator integrates at 0.05 s, samples every 5 s and adds two deterministic sinusoidal perturbations with different phases between runs. Each CSV contains 61 readings. These data were generated for checking the implementation.

| Held-out quantity | Two compartments | Single compartment |
| --- | ---: | ---: |
| RMSE (mg/m³) | 0.138 | 5.080 |
| Mean absolute error (mg/m³) | 0.120 | 4.288 |
| Signed bias (mg/m³) | +0.017 | +4.288 |

The fit recovers 38 L/s and 11 s. The single-compartment fit reaches its allowed sensor-lag maximum of 60 s. At the default 0.15 mg/m³ allowance, 72 of 358 examined two-parameter settings fall within that much RMSE of the best setting. Their exchange rates span 36.5–39.25 L/s and their sensor times span 9–12.5 s. The JSON records actual joint settings at each extreme. These ranges describe the sampled grid and chosen tolerance. They carry no statistical confidence level. An isolated chamber illustrates why this matters. When tracer cannot reach the sensor, the entire tested lag range can fit the zero signal.

The separate measured-repeat panel in Transport Lab uses published room mixing times. Its endpoint summaries cannot supply the sensor-concentration CSVs needed here. [Um et al., experimental mixing times, §3.1 and Fig. 5](https://eta-publications.lbl.gov/sites/default/files/2026-03/demonstration_of_a_novel_tracer_gas_method.pdf#page=5)
