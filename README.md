# FIRST FIRE

[Open the 3D rover workbench](https://first-fire-lunar-lab.christsamuel26.chatgpt.site/rover-workbench/prototype/index.html#workbench). Assemble a rover, drive a NASA reference course, and compare telemetry with a field trial. [Source and integration guide](rover-design/HANDOFF.md).

A browser-based research desk for the 2026 NASA Space Apps [Flame in Freefall challenge](https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/?tab=resources). Start with a research question and find the source, boundary and next test. The project does not issue a material rating or certify a cabin design.

[Technical manual](site/technical-manual.html) · [Download technical manual (PDF)](dist/first-fire-technical-manual.pdf)

Open the [six-slide project demonstration](dist/demo.html) to follow a flight comparison from the original measurements to the next test. The [FLEX sensitivity view](dist/index.html#transfer-lab?view=sensitivity) lets you change the droplet matching rule before revealing burn durations. In the [SAME-R detector case](dist/detector.html), inspect optical readings and instrument power in four NASA flight workbooks. The [English and Telugu classroom exercise](dist/classroom.html) asks two readers to match a NIST alarm report to the original sensor record and exchange evidence. Results from independent participants have yet to be collected.

## Master document edition

Open the [field guide and instruments](https://first-fire-lunar-lab.christsamuel26.chatgpt.site/#field-guide), [vehicle designer](dist/index.html#vehicle-designer), [cabin model validation](research/master-physics.md) or [judge walkthrough](dist/index.html#field-guide?tab=judges). The [implementation record](research/master-requirements.md) maps each feature to the master document, its acceptance evidence and the remaining team work. The [38-page science reader](site/first-fire-field-guide.pdf) covers FM², combustion, low gravity and the glossary. The [review log and deposition package](dist/team-handoff.html) support participant and team verification.

Use the new atmosphere and material tools to select a fuel and a cabin pressure. Inspect the original NASA or JAXA measurement before transferring it to a proposed vehicle. The [physics report](research/master-physics.md) compares the model with prescribed NIST burners, a Cantera reference and SIBAL flight measurements. [Research chat verification](research/answer-verification.md) separates numeric replays, general routing, recorded prose answers and confidence calibration.

## Run a research investigation

Start the [guided research session](https://first-fire-lunar-lab.christsamuel26.chatgpt.site/#session), enter your question, and download the evidence record at any step. The same workflow runs in the offline edition.

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
