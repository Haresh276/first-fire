# FIRST FIRE — project page text for the Space Apps submission

Copy each block into the matching field of the submission form. Global judges see only this page, the demo link and the final project link, so every block below stands on its own. Submit by 21:30 IST; the form closes at 23:59 IST.

## Project name

FIRST FIRE — A Research Desk for Spacecraft Fire Safety

## High-level summary

NASA is about to light the first fire ever on the Moon: FM² will burn four fabric strips in a sealed chamber on the lunar surface. Nobody knows the result, because every fire test in NASA's Physical Sciences Informatics archive was flown in orbit, with no gravity. FIRST FIRE turns that freefall data into fire-safety answers for the Moon, Mars and pressurized rovers. A browser research desk organises 1,622 source rows from the 15 challenge investigations and checks every claim against its source. FLINT, our open physics engine built on NASA's own extinction model, predicts NASA's four lunar-gravity flammability limits from Earth tests alone to within 1.4 points of oxygen. It also shows that FM²'s oxygen sensor will read about a point high, finds CO₂ a better suppressant than helium in 274 Space Station droplet runs, and shows that a rover cabin fire is a materials problem. We sealed our forecast with a timestamp before the flight. If we're wrong, the Moon will tell us.

## Link to project demo

The 30-second captioned film: https://first-fire-lunar-lab.vercel.app/master-film.mp4

The demo must be a video of 30 seconds or less, or at most seven slides. Our Round 2 deck has twelve slides, so link the film.

## Link to final project

https://first-fire-lunar-lab.vercel.app/judging.html

## Detailed project description

**What it does.** FIRST FIRE answers one question at the centre of the challenge: will a material that passed NASA's Earth fire test keep burning on the Moon, on Mars or in a pressurized rover? It has three parts.

- A research desk over the 15 PSI combustion investigations: an Atlas of every record, a Compass that ranks tests by closeness to a chosen habitat, a Rulebook that audits seven fire-safety assumptions for orbit, the Moon and Mars, and passports for each investigation.
- FLINT, a physics engine that predicts a material's oxygen limit at any gravity, pressure and atmosphere. It reads sealed-chamber burns such as FM² correctly, models droplet flames in freefall from NASA's FLEX runs and works through a pressurized-rover fire case.
- A sealed forecast of FM²'s four burns, timestamped before the flight and scored when NASA reports.

**How it works.** The desk is a static website that runs offline. A small local language model only selects passages from NASA's records; it does not compose numbers. A Referee checks that every quotation exists on the cited page, that the claim follows from it and that each number recomputes, and every rejected claim is published.

FLINT is built on the two-limit extinction model in NASA's 2025 lunar flammability paper (ICES-2025-392). A flame dies when the flow blows it off or when it loses heat faster than it makes it. We added the two things that paper lists as open: a flow speed for any gravity and a flame temperature for any atmosphere. Calibrated only on NASA's 1-g tests, FLINT predicts NASA's four lunar-gravity limits, each held out in turn, with a mean error of 1.4 points of oxygen, against 2.3 for a straight-line estimate.

**What we found.**

1. **Why some materials resisted.** FLINT explains why polycarbonate and Nomex burned less readily on the Moon: the weak buoyant flow starves them. It predicts they burn more readily on Mars.
2. **FM² will read high.** In FM²'s sealed chamber the flame's own CO₂ and steam choke it. At extinction the oxygen sensor will read about 27% while the flame felt about 26%, and burns stop sooner than oxygen bookkeeping predicts.
3. **CO₂ beats helium.** Across 274 FLEX droplet runs, CO₂ raises the oxygen a flame needs more than helium does. Helium can make a heptane fire harder to put out.
4. **A rover fire is a materials problem.** In a 13 m³ rover at 34% oxygen, every cabin item we modelled keeps burning with the fans off. A CO₂ flood would triple the cabin pressure, and venting works only with the crew suited.

**Benefits.** Cabin-material engineers at NASA, ISRO, ESA and JAXA get an evidence trail from each flight record to each prediction, with every result labelled validated, extrapolated or not modelled. The same physics informs fire safety in oxygen-enriched hospital wards, mines, submarines and aircraft. Students get a two-minute explainer in English, Hindi, Telugu and Tamil.

**What makes it creative.** It forecasts an experiment that has not happened yet, sealed and scored, so the project can be proven wrong. It publishes its own failures next to its scores. And it proposes four follow-up fires on existing NASA hardware, each with FLINT's prediction and the result that would falsify it.

**What we considered.**

- FM² has not flown.
- FLINT is validated on four materials at 8.2 psia and has not been reviewed by NASA.
- Other pressures, and quiescent flames in orbit, are extrapolations.
- The CFI-G gas-jet ignition test showed no skill, and we report that negative result.

**Tools.** Python (NumPy, SciPy, Matplotlib, pytest) for FLINT; HTML, CSS and JavaScript for the desk; Playwright and Node tests; local open-weight language models in the browser. More than 170 automated tests pass.

## Use of SI

Paste the disclosure from https://first-fire-lunar-lab.vercel.app/team-handoff.html#disclosure without shortening it. It names each SI tool, what it did, the synthetic film narration and the SI-generated rover illustration.

## NASA data

Fifteen PSI investigations, cited by DOI:

| Investigation | DOI |
|---|---|
| BASS | 10.60555/58h4-dy80 |
| BASS-II | 10.60555/4qc4-de67 |
| CFI | 10.60555/m6pj-a914 |
| ACME CFI-G | 10.60555/cyt1-kh64 |
| ACME E-FIELD Flames | 10.60555/se5a-8c73 |
| ACME BRE | 10.60555/vb93-3y72 |
| FLEX | 10.60555/mbq8-0451 |
| FLEX-2 | 10.60555/byp8-h018 |
| Saffire-I | 10.60555/0t15-1z43 |
| Saffire-II | 10.60555/2chp-m469 |
| Saffire-III | 10.60555/040q-4h36 |
| SAME | 10.60555/gd4k-8h62 |
| SAME-R | 10.60555/2np7-jv14 |
| SLICE | 10.60555/pm12-rg61 |
| SPICE | 10.60555/9kbh-e962 |

NASA papers:

- ICES-2025-392, lunar-gravity flammability (NTRS 20250002114)
- The FM² briefing, LPSC 2026 (NTRS 20260001966)
- The LUCI briefing, ASGSR 2025 (NTRS 20250010653)
- NASA-STD-6001 Test 1

## Space agency partner and other data

- The JAXA/Toyota Lunar Cruiser pressurized-rover concept, used for the cabin size in the rover fire case.
- The full list of sources, licences, fonts and libraries is on https://first-fire-lunar-lab.vercel.app/submission.html.

## For the team: how each global award is covered

| Award | The evidence to point to |
|---|---|
| Best Use of Science | A forecast sealed before the experiment; FLINT tested on held-out lunar data; four falsifiable follow-up predictions (mission-concept.html) |
| Best Use of Data | 1,622 rows traced to file, row and checksum; 1,058 normalized observations; FLEX and CFI-G reused for new questions |
| Best Use of Technology | FLINT physics engine; an offline desk with local models and a Referee gate; a benchmark with failures published |
| Galactic Impact | Fire-safety answers for the first Moon habitats and rovers |
| Best Mission Concept | Mission concept page: four follow-up fires on existing NASA hardware, each with its falsifier |
| Most Inspirational | "If we're wrong, the Moon will tell us": a student forecast of the first fire on the Moon |
| Best Use of Storytelling | The rule, the doubt, the test, told on the start-here page and in the 30-second film |
| Global Connection | Evidence from NASA and JAXA in one desk; an explainer in four languages; runs offline anywhere |
| Art & Technology | The deck's flame and Moon art, the rover workbench, the ignition illustration |
| Local Impact | Gaganyaan and hospital oxygen wards in India, explained in Hindi, Telugu and Tamil |
