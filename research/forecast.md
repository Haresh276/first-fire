# FM²: a forecast that can be wrong

FM² is a planned first lunar-surface combustion investigation. NASA's current Glenn project page describes four individual fuel samples, an autonomous chamber, cameras and gas sensors. A search of Glenn, NTRS, the conference records and the FY 2027 budget found no published lunar outcomes as of 14 November 2026. The four entries in the model are unobserved. [NASA Glenn](https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/flammability-of-materials-on-the-moon-fm2/)

## Which design?

| Source | What the source describes | How FIRST FIRE uses it |
| --- | --- | --- |
| [2024 Glenn symposium](https://ntrs.nasa.gov/citations/20240008623) and [2024 poster](https://ntrs.nasa.gov/citations/20240015307) | Early concepts with two SIBAL fabric strips and two PMMA rods, two atmospheres and two spread directions. One names an HLS lander, the other a CP-21 CLPS delivery. | Historical context. These samples are different from the later planned series. |
| [Ferkul et al., 57th LPSC, March 2026](https://ntrs.nasa.gov/api/citations/20260001966/downloads/Ferkul-Lunar%20and%20Planetary%20Science%20Conf%202026%20v2.pdf) | PDF pp. 4–6 and 9–11 (printed slides 3–5 and 8–10). After replanning, four 2 × 20 cm Synergy Pro Navy fabric samples, bottom hot-wire ignition for upward spread, nitrogen balance, 8.2 ± 0.3 psia with a freshly prepared atmosphere for each sample. The delivery slide names a SpaceX uncrewed demo. | Defines the scenario. Cite printed slide 4 for the qualitative expectation and printed slide 9 for the material and initial conditions. Appendix slides describe other materials and ground analogues. |
| [LPSC abstract 1799](https://www.hou.usra.edu/meetings/lpsc2026/pdf/1799.pdf) and [NASA FY 2027 budget request, April 2026](https://www.nasa.gov/wp-content/uploads/2026/04/fiscal-year-2027-full-budget-request.pdf) | The abstract anticipated late 2026. The later budget request plans FM² lunar work in 2027. | List a dated planning year only. A fixed launch date has not been verified. |
| [Firefly Blue Ghost 3 mission](https://fireflyspace.com/missions/blue-ghost-elytra-gruithuisen-domes/) | Gruithuisen Domes targeted no earlier than 2028. The six named NASA surface payloads omit FM². | An old CP-21 reference does not establish that FM² will fly on this vehicle or inherit its launch year. |

## One event per burn

The scoring question is whether the fabric sustains flame propagation after the hot-wire igniter switches off. A nominal attempt that never ignites counts as no. A momentary flash without sustained spread also counts as no. Actual outcome classification requires an attributable flight report, sample identity, conditions and a clear statement of what happened. Keep a changed or aborted protocol, faulty igniter/sensor, or unclassifiable event void. Ground tests, simulations, launch animations, and weakly glowing hot wire do not resolve the question. Retain missing data as pending. A separate observation, extinction oxygen, requires a sustained burn that reaches a measured extinction point and a valid oxygen reading there. A sample exhausted or extinguished on command cannot supply that endpoint.

The fourth NASA expectation is specifically about **ignition**. The FIRST FIRE event is **sustained spread**, which implies ignition. For burns 1–3 NASA envisages propagation until the atmosphere reaches the limiting oxygen level. A high starting oxygen and finite sample might still yield burnout before a threshold can be measured. The model does not simulate igniter heat transfer, oxygen depletion, thermal transients, fabric-to-fabric differences, or operational faults.

## Reproduce the illustrative model

Let one uncertain effective threshold L have a normal distribution with mean 26% oxygen and standard deviation 1.5 percentage points. For a nominal burn starting at x, the model assumes propagation exactly when x > L. P(sustained spread) is the normal cumulative probability at (x−26)/1.5. The central 80% model interval for L is 24.08–27.92%. These are the learner guide's B8.3 worked assumptions. NASA gives an expected 24–26% lunar limiting-oxygen range, without a probability density or standard deviation. None of the project probabilities was fitted to flight data, and no externally timestamped forecast has been registered here.

| Burn | Initial O₂ by volume | NASA's qualitative expectation | Illustrative P(sustained spread) | Comparator P |
| --- | ---: | --- | ---: | ---: |
| 1 | 37% | Continue to the limit | >99.99% | 90% |
| 2 | 33% | Continue to the limit | >99.99% | 90% |
| 3 | 29% | Continue to the limit | 97.72% | 90% |
| 4 | 25% | Ignition unlikely | 25.25% | 10% |

The learner guide’s B8.4 worked example uses 90/10 for an illustrative “NASA-style” comparator. The researchers give qualitative expectations only; the guide does not establish that the team formally adopted the example. The same four targets were used when selecting the assumptions, so agreement with NASA's expectations is not a validation test. Moving the mean from 24 to 27 with the same 1.5-point spread moves the burn-4 probability from 74.75% to 9.12%. Other materials behave differently in simulated lunar tests; they provide physical motivation, not Synergy Pro calibration. [ICES-2025-392, PDF pp. 9–11](https://ntrs.nasa.gov/api/citations/20250002114/downloads/ICES_2025-392-correctedcaptions.pdf)

Under the Brier score, smaller is better. Average (predicted probability − binary observed outcome)² across the same resolved burns for both predictors, and give the coverage. The full score requires all four. With hypothetical outcomes yes/yes/yes/no, the model scores 0.0161 and the comparator 0.0100. With yes/yes/yes/yes, they score 0.1398 and 0.2100. Neither is an observed result. Four tests with a common material and shared threshold do not establish population calibration, even when results eventually arrive.

For one hypothetical repeat, choose a starting O₂ value on a 22–30% grid in 0.5-point steps, keeping everything else fixed. With a noiseless threshold observation, binary entropy is the expected information about L. At the default mean, 26% yields an even split and 1 bit. For two simultaneous design choices x<y, the three possible patterns have probabilities F(x), F(y)−F(x), and 1−F(y). The grid maximum is 25.5% and 26.5% with 1.567 bits of joint information. Counting the two single-test entropies separately double-counts shared information. These are proposed extra conditions under the model. If the goal changes to qualifying a material, or ignition has independent variability, the design criterion changes.

From the project root:

```sh
python3 scripts/forecast.py --check
python3 scripts/forecast.py --scenario 25 2
python3 scripts/forecast.py --score yes yes pending void
```

Only the default invocation writes data/forecast.json. Alternate assumptions and score examples print to standard output. The protocol and numerical choices would need independent acceptance and an external timestamp before calling any prediction preregistered.

## Candidate features considered for FM²

| Rank | Design | Evidence against or limitation | Acceptance test |
| --- | --- | --- | --- |
| 1 | Dated design comparison and source-linked protocol | The 2024 and 2026 payload and material descriptions disagree | An older CP-21/SIBAL input shows its historical date. It cannot populate a measured Synergy Pro outcome or inherit Firefly's 2028 target. |
| 2 | Event definitions and adjudication record | Failure to ignite, sustained spread, final extinction and specimen exhaustion are different endpoints | An aborted burn remains void; a nominal non-ignition resolves only the spread question; missing sensor data cannot yield a limiting O₂ value. |
| 3 | Adjustable threshold assumptions | No lunar Synergy Pro data constrain the shape or dispersion of a normal prior | The selected case gives 25.25% on burn 4, changing the mean visibly changes that probability, and outputs are labeled illustrative. |
| 4 | Explicit numerical comparator and score | NASA published directions, not probabilities. Four dependent trials cannot establish general calibration | Numerical comparator is attributed to the learner guide’s worked example, both scores use the identical subset, and no actual score appears while all outcomes are missing. |
| 5 | Design the next hypothetical oxygen test | Binary entropy is expected information about the shared threshold only in the noiseless-model assumption | Default optimum is 26%; a fixed pair gets less than log₂3 joint bits. No claim about a new NASA flight or safety qualification. |
| 6 | Fit and certify a classifier on PMMA/SIBAL or unrelated PSI rows | Different fuel, forced flow, pressure and geometry prevent direct estimation of a Synergy Pro lunar threshold | Withhold a trained FM² outcome predictor until comparable measurements and an independently held-out target exist. |
