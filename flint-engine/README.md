# FLINT: Flammability Limits In Nonterrestrial gravity

FLINT is the simulation engine of **FIRST FIRE**, built by Team Code Blooded for NASA Space Apps Challenge 2026 (challenge *Flame in Freefall*). It predicts the oxygen level below which a thin solid stops burning, at any gravity, pressure and atmosphere. It also simulates burns in a sealed chamber like FM², the experiment that will light the first fire on the Moon.

It is a reduced-order engine. It is built on the two-limit extinction model in NASA's ICES-2025-392 paper (Urban et al. 2025), which follows Fernandez-Pello's flame-spread theory and Thomsen et al. FLINT generalizes that model and calibrates it on NASA's published measurements. It is not computational fluid dynamics, and it does not replace NASA-STD-6001 testing.

## What it does

| Module | Question it answers |
|---|---|
| `thermo` | What is the flame temperature of this fuel in this atmosphere? This includes chambers polluted with CO₂ and H₂O. |
| `limits` | What is the lowest oxygen at which the flame survives? Two limits answer this: blow-off (chemistry too slow for the flow) and quenching (heat lost faster than it is supplied). |
| `limits.Buoyancy` | What flow speed does a flame feel at lunar, Martian or Earth gravity, with or without fans? |
| `calibrate` | Fits the model to NASA's 1-g data and tests it on lunar-g data it has not seen. |
| `chamber` | Simulates an FM²-style sealed burn: burned length, oxygen and CO₂ readings, temperature and pressure. It also inverts a measured burn into the true oxygen limit and chooses the most informative next burn. |
| `chamber.cabin_fire` | Simulates a panel fire in a closed cabin: the flame front spreads, and each patch burns until its fuel is used up. |
| `droplet` | Droplet flames in freefall, fitted and tested on NASA's FLEX runs from the ISS (PSI-69, 274 runs). It gives the burning rate, the size at which the flame dies, and the oxygen below which it dies when CO₂ or helium replaces nitrogen. |
| `ignition` | A tested negative: CFI-G's 333 gas-jet runs (PSI-159) do not let flame temperature and pressure predict hot ignition, so FLINT offers no gas-leak rule. |
| `atlas` | 350 scenarios across gravity, atmosphere, ventilation and fuel, each labelled validated, extrapolated or not modelled. |
| `rover` | The pressurized-rover fire case. Which cabin items burn, with fans on or off; the trade between atmosphere and pre-breathe; fire timelines; and the CO₂ dose, nitrogen dose or vent pressure that stops each fire. |

## Install and reproduce

```bash
pip install numpy scipy matplotlib pytest
python -m pytest -q                 # 19 tests
python -m flint.report flint_out    # every number and figure, about 2 minutes
python -m flint.rover_report rover_out   # the pressurized-rover fire case, about 5 seconds
python -m flint.micro_report micro_out   # FLEX droplets, CFI-G and the atlas, about 7 seconds
```

## Quick start

```python
from flint import *
from flint.calibrate import fit_ckl, P_ICES
from dataclasses import replace

b = Buoyancy()                                         # u = 35 cm/s x (g/g_earth)^(1/3)
pc, _ = fit_ckl("PC", b)                               # blow-off branch fitted to NASA 1-g data
pc = replace(pc, Ch=4.18)                              # shared quenching constant (see results)
print(pc.loc(P_ICES, b.u_eff(0, GRAVITY["mars"])))     # polycarbonate limit at Mars gravity, 8.2 psia

ch = Chamber()                                         # FM2: 14.4 L, 8.2 psia
s = Sample(Fuel(C=14, H=10, O=2, N=2), areal_density=0.094)
print(simulate(ch, s, X0=0.33, L=0.26)["summary"])     # burn 2 if the limit is 26 %
```

## Results (from `python -m flint.report`)

**Calibration.** The blow-off constant is fitted per material to the four 1-g limit points from NASA's White Sands high-flow tests (8.2 psia, 60–145 cm/s). The RMS misfit is 0.3 to 0.7 percentage points of oxygen.

**Validation on lunar gravity (leave one material out).** NASA measured four lunar-g limits in the Glenn drop-tower centrifuge (ICES Fig. 13). The single shared quenching constant is fitted on three of them and used to predict the fourth.

| Material | Measured | FLINT | Branch | Straight-line method |
|---|---|---|---|---|
| PMMA | 13.1 % | 12.9 % | blow-off | 14.9 % |
| P213 tape | 13.7 % | 12.4 % | blow-off | 13.4 % |
| Polycarbonate | 20.1 % | 18.4 % | quenching | 17.6 % |
| Nomex Velcro | 25.6 % | 28.2 % | quenching | 21.0 % |
| **Mean absolute error** | | **1.4 points** | | 2.3 points |

The default flow closure was chosen before the comparison. Of the eight closures tried, it has the lowest error, and the others score 1.6 to 2.6 points.

On the lunar values read from the single-material figures (Figs. 11 and 12 disagree with Fig. 13), FLINT's error rises to 2.6 points, against 2.1 for the simpler methods. Four materials and inconsistent figures make neither result decisive. FM² is the real test.

**What the model says.** These figures are at 8.2 psia with no fans, using the quenching constant fitted on all four lunar points. The first number is the default closure; the range in brackets covers the eight flow closures tried. Add about ±1.7 points of model error, the leave-one-out RMS.

| Material | Moon | Mars | Most flammable near |
|---|---|---|---|
| PMMA | 12.9 % (11.4–12.9) | 13.5 % (12.0–13.5) | 0.08 g |
| P213 | 12.4 % (11.2–12.4) | 12.9 % (11.5–12.9) | 0.10 g |
| Polycarbonate | 18.9 % (18.9–19.6) | 17.8 % (16.3–17.8) | 0.27 g |
| Nomex Velcro | 26.4 % (26.4–27.3) | 22.6 % (21.0–22.6) | 0.92 g |

The quenching branch explains why the high-pyrolysis-temperature materials (polycarbonate 700 K, Nomex 750 K) burned less readily at lunar gravity. This was the hypothesis offered in ICES-2025-392, and FLINT shows it is consistent with that paper's own numbers. It also predicts that these materials burn *more* readily at Mars gravity than at lunar gravity.

**FM² (sealed 14.4 L chamber).** NASA expects a whole strip to use 0.08 of the oxygen mole fraction. If the fabric's limit is 26 %, FLINT predicts these burned lengths: 20, 14.9, 6.4 and 0 cm. Bookkeeping that tracks oxygen alone gives 20, 17.5, 7.5 and 0 cm. The difference is vitiation: CO₂ and H₂O from the burn cool the flame. At extinction, the wet O₂ sensor would read about 27.0 % (dry about 27.5 %), while the flame-equivalent oxygen is 26.0 %. Burns that stop part-way carry the most information: about 1.7 bits each for the 33 % and 29 % starts, against 0.3 bits for 37 % and 0.5 bits for 25 %.

## Freefall results (FLINT 1.1)

**FLEX droplets (ISS, PSI-69).** The burning-rate law was fitted on plain O₂/N₂ runs at 1 atm. It predicts methanol burning in CO₂ atmospheres with a 3 % bias and 12 % error over 54 runs. It over-predicts helium runs by 40 %. Cross-validated extinction-diameter error is 0.29 mm for methanol and 0.37 mm for heptane; the simple rules score 0.47 to 0.77 mm. For a 3 mm droplet at 1 atm, the flame dies below 10.7 % O₂ for methanol and 14.1 % for heptane. 30 % CO₂ raises these limits to 12.1 % and 16.6 %. 30 % helium raises methanol's to only 11.3 % and *lowers* heptane's to 12.9 %, which the FLEX runs support.

**CFI-G gas jets (ISS, PSI-159).** With flame temperature and pressure, the leave-one-out Brier score is 0.197 for normal flames, against 0.196 for the base rate, so there is no skill. This negative result is reported, not hidden.

**Atlas.** 350 scenarios: 48 validated, 282 extrapolated, 20 not modelled. See `results/micro/atlas_*.csv`.

## Known limits

- The flame temperature ignores dissociation; the constants are effective values.
- Thin fuels only; char smouldering is not modelled.
- Orbit: FLINT's solid-fuel constants come from flames spreading with the flow; opposed-flow limits are higher, and a quiescent orbit is not modelled.
- Droplets: inside FLEX's ranges only; cool flames are not modelled; no buoyancy, so not for the Moon or Mars.
- Validated at 8.2 psia only. The pressure scaling (Da ∝ P², as ICES Eq. 5 writes it) is unvalidated.
- The 1-g buoyant velocity (35 cm/s) and the exponent (1/3) are literature estimates, not measurements. ICES-2025-392 says the lunar buoyant velocity is not known.
- The chamber is assumed well mixed. Spread rate, wall cooling and radiant fraction in `simulate` are assumptions; burned length at extinction does not depend on them.
- All calibration points were digitized from published figures (about ±0.003 mole fraction).

## Data provenance

See `flint/data.py`. Sources: ICES-2025-392 (NTRS 20250002114), Table 1, Table 2 and Figs. 7–13; FM² slides (LPSC 2026, NTRS 20260001966); and LUCI slides (ASGSR 2025, NTRS 20250010653). Our reading of ICES-2025-392 also found that some single-material figures do not match Fig. 13 and Table 2; the details are in `ICES_FIGURE_NOTES`, and we would like the authors to confirm them.

## Licence and credit

MIT licence. Team Code Blooded: Haresh G. (owner of FLINT), Samuel Christ and Hanmathgundam Hamsika. Written with SI assistance (Claude), which is declared in the project's SI disclosure. If you use FLINT, cite the NASA papers above first.
