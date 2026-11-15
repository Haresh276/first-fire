# FIRST FIRE

**NASA is about to light the first fire ever on the Moon. FIRST FIRE turns NASA's freefall fire data into checkable predictions for the Moon, Mars and the pressurized rovers in between, and we sealed our forecast before the experiment flies.**

[Start here: two-minute explainer](https://first-fire-lunar-lab.vercel.app/start.html) · [Cabin Fire Simulator](https://first-fire-lunar-lab.vercel.app/cabin-fire.html) · [Material Lab](https://first-fire-lunar-lab.vercel.app/material-lab.html) · [Gravity fire lab](https://first-fire-lunar-lab.vercel.app/fire-lab.html) · [FM² day-one decoder](https://first-fire-lunar-lab.vercel.app/fm2-decoder.html) · [Judging route](https://first-fire-lunar-lab.vercel.app/judging.html) · [India](https://first-fire-lunar-lab.vercel.app/india.html) · [FLINT evidence](https://first-fire-lunar-lab.vercel.app/flint.html) · [Rover fire case](https://first-fire-lunar-lab.vercel.app/rover-fire-case.html) · [Mission concept](https://first-fire-lunar-lab.vercel.app/mission-concept.html) · [Captioned film](https://first-fire-lunar-lab.vercel.app/master-film.mp4)

Built for the 2026 NASA Space Apps Challenge *Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data* by Team Code Blooded: Haresh G., Samuel Christ and Hanmathgundam Hamsika.

## In sixty seconds

- **The problem.** Spacecraft materials are cleared by one upward-burn test on Earth (NASA-STD-6001 Test 1). At lunar gravity, NASA found that three of five materials burned more easily than on Earth (ICES-2025-392). Moon habitats and rovers are planned at 34% oxygen. All 1,622 fire tests in NASA's PSI archive flew in orbit; none were run at lunar or Martian gravity.
- **What we built.** A browser research desk over the 15 PSI combustion investigations named by the challenge, with a Referee that checks every quote, claim and number before it is shown. Underneath it runs FLINT, an open Python engine built on NASA's two-limit extinction model, which predicts a material's oxygen limit at any gravity, pressure and atmosphere.
- **Sealed before the flight.** Forecast v1 (14 Nov 2026, 12:57 UTC) and FLINT's forecast v2 (15 Nov 2026, 06:27 UTC) carry DigiCert RFC 3161 timestamps.
- **Honest limits.** FM² has not flown. FLINT is validated on four materials at 8.2 psia and has not been reviewed by NASA; other pressures are extrapolations. One method, CFI-G gas-jet ignition, showed no skill and is reported as a negative result.

| What we found | The number | Evidence |
|---|---|---|
| Earth tests predict NASA's Moon results, each held out | 1.4 points of O₂ mean error; a straight-line estimate gives 2.3 | [flint.html](site/flint.html) |
| FM²'s sealed chamber will read high | At extinction the sensor reads about 27.0% against a flame-equivalent 26.0%; burn 2 stops at 14.9 cm, not 17.5 | [forecast register](site/forecast-register.html) |
| In freefall, CO₂ beats helium | 274 FLEX droplet runs; heptane dies below 14.1% O₂ in nitrogen, 16.6% with 30% CO₂, 12.9% with 30% helium | [flint.html#freefall](site/flint.html) |
| A Moon rover fire is a materials problem | All four cabin items burn at 34% O₂ with fans off; a CO₂ flood needs 26 kg and triples the pressure; venting stops Nomex near 4 psia | [rover fire case](site/rover-fire-case.html) |
| Mars reverses the Moon | Nomex's limit falls from 26.4% (Moon) to 22.6% (Mars): a prediction, not yet tested | [mission concept](site/mission-concept.html) |
| Any new material can be tested | The [Material Lab](site/material-lab.html) builds a material from its atoms or a blend, calibrates it on one Earth test and predicts its limit on four worlds; NASA's presets reproduce the library exactly | [Material Lab](site/material-lab.html) |
| A cabin fire can be followed second by second | The [Cabin Fire Simulator](site/cabin-fire.html) reproduces FLINT's Python rover case to the half second and compares fans off, CO₂ and nitrogen floods and venting, with the crew's CO₂ and oxygen | [Cabin Fire Simulator](site/cabin-fire.html) |
| FM² can be read on day one | The [decoder](site/fm2-decoder.html) turns four measured burn lengths into the lunar limit; reading the sensor naively would overstate it by about 0.7 points | [FM² decoder](site/fm2-decoder.html) |

## Verify it yourself

```sh
python -m pytest -q                  # the desk tests and FLINT's 19 tests (see pytest.ini)
node --test tests/*.test.cjs         # browser, data and release tests
cd flint-engine && python -m flint.report out   # every FLINT number and figure, about two minutes
```

## How FIRST FIRE answers the challenge

| The challenge asks for | FIRST FIRE | Where |
|---|---|---|
| An SI-powered dashboard over NASA microgravity combustion data | Browser research desk; a local model selects sourced passages; the Referee gates every answer | [desk](site/index.html), [Referee](site/index.html) |
| Summaries, rankings and interpretations of the investigations | Passports, a Compass that ranks tests by closeness to a habitat, a Rulebook of seven fire-safety assumptions | [desk](site/index.html) |
| Fire-safety insight for human exploration | FLINT limits at lunar and Martian gravity; the FM² reader; rover fire responses; a material tester for materials NASA has not flown | [FLINT](site/flint.html), [Material Lab](site/material-lab.html), [Cabin Fire Simulator](site/cabin-fire.html) |
| Investigations relevant to crew habitats, including pressurized rovers | Compass lunar preset (8.2 psia, 34% O₂); the pressurized rover fire case; a live cabin fire simulator for rovers, habitats and station modules | [rover](site/rover-fire-case.html), [simulator](site/cabin-fire.html) |
| Data that supports predictive modelling | `data/tests.csv` (1,058 normalized observations); FLINT datasets and a 350-scenario labelled atlas | [data](data), [FLINT](flint-engine) |
| Research for next-generation controls and equipment | CO₂ versus helium suppression; vent and flood responses; four follow-up tests with falsifiable predictions; an FM² decoder for the day NASA reports | [mission concept](site/mission-concept.html), [decoder](site/fm2-decoder.html) |
| Insight anyone can explore | The gravity fire lab runs FLINT in the browser: orbit to Earth, any cabin air, fans on or off, with each result labelled validated or extrapolated | [fire lab](site/fire-lab.html) |
| Possible Earth applications | Hospital oxygen wards, mines, submarines and aircraft, each with its transfer limits; a sourced page on India's hospital ICU fires | [desk](site/index.html), [India](site/india.html) |
| An audience from students to engineers | A two-minute explainer with summaries in Hindi, Telugu, Tamil, Spanish, French, Portuguese, Japanese and Chinese; reading levels; technical manual | [start here](site/start.html) |

## Full project guide

[Open the judging route](https://first-fire-lunar-lab.vercel.app/judging.html) · [Pressurized Rover Fire Case](https://first-fire-lunar-lab.vercel.app/rover-fire-case.html) · [FLINT evidence and source](https://first-fire-lunar-lab.vercel.app/flint.html) · [Captioned film](https://first-fire-lunar-lab.vercel.app/master-film.mp4)

A browser-based research desk for the 2026 NASA Space Apps [Flame in Freefall challenge](https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/?tab=resources). Start with a research question and find the source, boundary and next test. The project does not issue a material rating or certify a cabin design.

[Technical manual](site/technical-manual.html) · [Download technical manual (PDF)](dist/first-fire-technical-manual.pdf)

Open the [six-slide project demonstration](dist/demo.html) to follow a flight comparison from the original measurements to the next test. The [FLEX sensitivity view](dist/index.html#transfer-lab?view=sensitivity) lets you change the droplet matching rule before revealing burn durations. In the [SAME-R detector case](dist/detector.html), inspect optical readings and instrument power in four NASA flight workbooks. The [English and Telugu classroom exercise](dist/classroom.html) asks two readers to match a NIST alarm report to the original sensor record and exchange evidence. Results from independent participants have yet to be collected.

[Inspect the fresh local chat benchmarks](https://first-fire-lunar-lab.christsamuel26.chatgpt.site/fresh-chat-benchmark.html) to compare model answers, calibrations and individual failures. [Local chat setup](chat/README.md) includes both tested model sizes.

## FLINT 1.1 and the Pressurized Rover Fire Case

**Built (Python engine).** Start at the [FLINT report](site/flint.html) to compare the measured and predicted lunar limits, conditional FM² burn lengths, FLEX suppressant fits, the CFI-G negative result and the labelled atlas of solids and droplets. The browser calculator runs the calibrated thin-solid limit solver. The [original ZIP](site/flint/FIRST-FIRE_FLINT-engine.zip) contains the full Python analyses; its source and saved outputs are also in [flint-engine](flint-engine). Use Python 3.10+ in a clean virtual environment:

```sh
cd flint-engine
python -m pip install numpy scipy matplotlib pytest
python -m pytest -q
python -m flint.report out
python -m flint.micro_report micro_out
python -m flint.rover_report rover_out
```

Compare the JSON and CSV results with [core, micro and rover reference outputs](flint-engine/results). Elapsed time can differ. The [PSI provenance manifest](site/flint/psi-pack-comparison.csv) compares each supplied table with the frozen source bytes. Keep the original package intact, including its legacy version strings.

The [rover fire case](site/rover-fire-case.html) starts with cabin components, not a vehicle route. Select a material, change the atmosphere and compare the difference between cabin oxygen and its predicted spread limit. Inspect the pre-breathe trade, assumed ignition timeline, fan shutdown, CO₂ or N₂ addition and vent pressure against the cited experiments. Reference rows come from [rover_case.json](flint-engine/results/rover/rover_case.json). **Validated at 8.2 psia** applies only to the reference limit comparison; timelines and pressure-changing responses are **Model extrapolation**. These are scenarios, not operational procedures.

The solid-fuel check holds out one material at a time under the ICES upward-burning protocol at 8.2 psia. Fig. 13 and the single-material figures disagree; FLINT reports both readings and omits cotton. Changing pressure, flow, geometry or gravity can take a scenario outside that comparison. Orbiting solids are extrapolated; a still solid in orbit without imposed flow is not modelled by this closure. The FLEX droplet fits have helium bias and heptane scatter. The CFI-G test did not establish a gas-jet hot-ignition rule.

## Master document edition

[Download the offline app and optional primary-source reference packs](https://first-fire-lunar-lab.vercel.app/offline.html).

Open the [field guide and instruments](https://first-fire-lunar-lab.vercel.app/#field-guide), [vehicle designer](dist/index.html#vehicle-designer), [cabin model validation](research/master-physics.md) or [judge walkthrough](dist/index.html#field-guide?tab=judges). The [implementation record](research/master-requirements.md) maps each feature to the master document, its acceptance evidence and the remaining team work. The [38-page science reader](site/first-fire-field-guide.pdf) covers FM², combustion, low gravity and the glossary. The [review log and deposition package](dist/team-handoff.html) support participant and team verification.

Use the new atmosphere and material tools to select a fuel and a cabin pressure. Inspect the original NASA or JAXA measurement before transferring it to a proposed vehicle. The [physics report](research/master-physics.md) compares the model with prescribed NIST burners, a Cantera reference and SIBAL flight measurements. [Research chat verification](research/answer-verification.md) separates numeric replays, general routing, recorded prose answers and confidence calibration.

## Run a research investigation

Start the [guided research session](https://first-fire-lunar-lab.vercel.app/#session), enter your question, and download the evidence record at any step. The same workflow runs in the offline edition.

1. [Match real FLEX flight runs](dist/index.html#transfer-lab). Set common eligibility conditions and size tolerance before revealing paired differences. Test whether any comparison survives a same-day requirement.
2. [Challenge a remote sensor reading](dist/index.html#transport-lab). Inspect transport, sensor lag and mass conservation; compare against published room repeat times, or fit one sensor trace and score a second run against a single-compartment baseline.
3. [Plan an FM² oxygen test](dist/index.html#design-lab). Choose an objective and specimen budget, try a hypothetical result, and export a payload test request with the camera endpoint, oxygen measurements and matched Earth comparison.
4. [Question the archive](dist/index.html#chat). Ask for a count or a measured quantity and inspect the supporting source rows. [Chat evaluations and original failures](research/science-chat-audit.md) and [methods](research/advanced-methods.md).

## Explore the deck

- **The Gap.** The [Atlas](dist/index.html#atlas) includes 1,622 nonempty source rows from 15 challenge investigations and 16 tables. The [Compass](dist/index.html#compass) ranks the comparable observations with usable measurements.
- **The Audit.** The [Rulebook](dist/index.html#rulebook) audits seven assumptions across orbital, lunar and Martian gravity. [Passports](dist/index.html#passports) identify dataset versions, coverage and provenance.
- **The Oracle.** [Four FM² predictions and Next Fire](dist/index.html#forecast) include a signed RFC 3161 timestamp and a transparent point scenario for flame travel. A DOI has not been issued.
- **At Home.** [Earth applications](dist/index.html#earth) link crew cabins, oxygen wards, mines, submarines and aircraft to their own evidence and transfer limits.

Use the [Physics Lab](dist/index.html#physics) and [Rover Sandbox](dist/index.html#physics?mode=rover) to examine a sealed compartment. The experimental liquid network displays its error against held-out simulator runs. The [Referee](dist/index.html#referee) exposes its source checks, independent model disagreements and rejected examples. [Watch the 30-second demo](dist/first-fire-demo.mp4).

## Ask the research chat

On this computer, open **http://127.0.0.1:8765/#chat** when the local service is running. From this directory, start Ollama and run `.chat-venv/bin/python -m chat.server`. On a fresh machine, first install Ollama and Python 3.12, launch Ollama, then run `python3.12 scripts/setup_chat.py` to fetch the model and create the Python environment. [Complete local setup and provider contract](chat/README.md).

Ask “Which material burned in Saffire-II sample 2-7?” and then “What does the 140 seconds refer to?” The source cards are part of the answer. The model selects from sourced passages; the presence of a real citation alone does not make a reply correct. The integrated [100-question benchmark](dist/index.html#benchmark) shows individual answers, failures and source checks. Version 2.1 passed 78 of the original 100 strict checks and 14/24 separately written questions. Separate browser tests cover Apollo 1 and Apollo 13, which are outside those two suites. Inspect failed answers before extending the model to new uses. See the [model comparison](research/chat-models.md), [benchmark report](research/chat-benchmark.md) and [physics lab and validation plan](research/world-model.md). No Grok key is needed. Closed-book controls and complete model outputs are included in `research/chat-runs/`.

## Open the static archive

Unzip the complete distribution, then open **dist/index.html** in a modern browser. No installation or API key is required for the static archive. Its chat uses the bundled archive; a local model conversation requires the service above. Start with **Case library → SIBAL** or **Case library → Saffire-II** to inspect what the evidence actually supports. Try **Check a claim** for your own question. The in-app **User guide**, [printable user manual](dist/first-fire-user-manual.pdf), [six-slide demonstration](dist/demo.html) and [demonstration PDF](dist/first-fire-demo.pdf) are included.

The deployed edition is a static site. The static archive keeps notes, forecasts and study files in the browser. The local transformer service processes chat requests on loopback. Browser storage may be disabled or partitioned for local files; use the download buttons for durable copies. External source links require an internet connection. To serve the offline copy with a stable local origin:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Open http://127.0.0.1:8000/ in a browser. The HTML, fonts, image, model, manuals and data are all included. Static hosting can serve the contents of dist directly.

## What is inside

- **Six published research cases**: LUCI/SIBAL, Saffire-II, FLEX, SAME, CFI-G and ICES. Two questions per case, a traceable decision, a scope limit, a next test, and six ranked architecture options with trade-offs and acceptance checks. FM² is a separate, prospective case with six options of its own.
- **Evidence tools**: review a claim; search the seven case discussions and 19 investigation descriptions with a local Model2Vec index; compare paired records; test quotations against pinned document pages; export a research brief with its sources.
- **NASA archive**: 19 catalogue records, 20 source CSVs, 1,058 normalized observations from nine investigations. The other ten remain in the catalog with explicit coverage limits. Filter fields separately, open original rows, export CSV and rank evidence by matching mission conditions. Unknown conditions stay unknown.
- **Forecast**: vary the parameters of a shared-threshold model, see how they change the four predictions, and score hypothetical outcomes without changing the official outcome fields. Inspect [the fixed team forecast](dist/forecast-lock/fm2-v1.json) and its [signed timestamp](dist/forecast-lock/fm2-v1.tsr). The numerical probabilities and the comparator are team assumptions. No flight outcomes have been verified.
- **Evaluation lab**: anonymous allocation to two methods, timer, masked answers, separate assessor key, optional next-action judgment, analyst join and export. No participant performance result is asserted. [Study protocol](research/evaluation.md).
- **Review and reproducibility**: [repository code audit](research/code-review.md), [challenge project and document review](research/challenge-projects.md), [science and gaps](research/review.md), [PSI data audit](research/data.md), [forecast method](research/forecast.md), [retrieval benchmark](research/search.md), [challenge handoff](research/submission.md) and [quotation verification](data/evidence/README.md). Reports are also formatted for reading under Sources & methods.

## Rebuild or audit

Run these commands from the directory containing this file. Build and data checks use Python 3.10+ standard library. Node 18+ runs the JavaScript checks; Node 20+ is recommended. The bundled site does not require these tools to open.

```sh
python3 scripts/build.py
python3 -m unittest discover -s tests -p '*_test.py'
node --test tests/*.test.cjs
node scripts/evaluate_science_chat.cjs
# With Playwright and Chromium installed: node tests/advanced_browser.cjs
node scripts/benchmark_search.cjs
python3 scripts/verify_quotes.py
```

The build works from the frozen local archive, rebuilds the normalized dataset and forecast, checks quote receipts and model hashes, and stages the result into dist/. Run `python3 scripts/fetch_psi.py --help` before refreshing externally hosted NASA files; a source revision changes the evidence and needs review. Optional strict verification against original PDFs uses pypdf 6.10.0 and access to the pinned publications. Browser automation instructions are in tests/browser.cjs. To check a fresh build against its manifest, run `python3 scripts/verify_release.py`.

## Directory map

| Path | Purpose |
| --- | --- |
| dist/ | Finished offline site. Keep the files together. |
| chat/ | Local model service, retrieval, provider interface, dependencies and setup notes. |
| site/ | Editable dashboard, local assets, user manual and demo. |
| data/raw/ | Frozen CSVs, metadata and source provenance. |
| data/{tests.csv, investigations.json, cases.json} | Harmonized observations, searchable catalog and case decisions. |
| data/evidence/, data/model/ | Original-document fingerprints and pinned retrieval model. |
| scripts/, tests/ | Rebuilding, retrieval checks, forecast scoring, blind study and browser verification. |
| research/chat-runs/ | Frozen benchmark transcripts, comparison model outputs, score tables, and the human-readable failure audit. |
| research/ | Source review, evaluation protocol, data audit and preparation materials. |
| research/evaluation-examples/ | Exposed rehearsal participant pack and rehearsal assessor key. Never reuse these as independent holdouts. The participant-facing site does not include an assessor key. |

## Rights and scientific status

See [LICENSE](LICENSE) for original code. The model, fonts and bundled Markdown reader retain their respective licenses. Original NASA and third-party publications and imagery retain their own rights and attribution; consult each source. Citation receipts check where a quotation occurs, not whether an interpretation is valid. Cases are source-checked; independent team sign-off is pending. The team forecast has an independently signed timestamp. Its DOI, lunar outcome data, human blind-study results and formal challenge submission are pending.
