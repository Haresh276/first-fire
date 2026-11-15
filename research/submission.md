# FIRST FIRE — project submission

**Team** Code Blooded

**Challenge** Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data

**Project title** FIRST FIRE — A Research Desk for Spacecraft Fire Safety

## A minute with the evidence

[Public judging route](https://first-fire-lunar-lab.vercel.app/judging.html) · [FLINT engine and validation](https://first-fire-lunar-lab.vercel.app/flint.html) · [Pressurized Rover Fire Case](https://first-fire-lunar-lab.vercel.app/rover-fire-case.html) · [Freeze links for the form](https://first-fire-lunar-lab.vercel.app/submission.html)

1. [Inspect the four sealed FM² forecasts and their timestamp](https://first-fire-lunar-lab.vercel.app/#forecast).
2. [Open the Moon column in the Atlas](https://first-fire-lunar-lab.vercel.app/#atlas). Distinguish planned settings from observations.
3. [Test the planted quotation in the Referee](https://first-fire-lunar-lab.vercel.app/#referee) and open the source page.

## Project demonstration

[Round 2 oral presentation](https://first-fire-lunar-lab.vercel.app/master-round2-slides.pdf) · [Timed run sheet](https://first-fire-lunar-lab.vercel.app/master-round2.html). For the global submission demonstration, use the short film or the six-slide deck below.

[Six-slide judge demonstration](../dist/demo.html) · [Public demonstration URL for the submission form](https://first-fire-lunar-lab.vercel.app/demo.html) · [Six-slide PDF](../dist/first-fire-demo.pdf)

[Narrated 30-second film, with English captions](https://first-fire-lunar-lab.vercel.app/master-film.mp4) · [Round 2 team kit](../dist/index.html#field-guide?tab=judges) · [One-page judge handout](../dist/judge-brief.pdf)

## Final project

[FIRST FIRE dashboard](../dist/index.html) · [Public project URL for the submission form](https://first-fire-lunar-lab.vercel.app/) · [Download the offline edition](https://first-fire-lunar-lab.vercel.app/offline.html) · [FLINT Python source and data](https://first-fire-lunar-lab.vercel.app/flint/FIRST-FIRE_FLINT-engine.zip)

## High-level project summary

NASA designed FM² to burn four fabric strips in a sealed chamber on the Moon. FIRST FIRE uses the existing flight archive to show what a researcher can learn before those burns take place. Its Atlas links 1,622 source rows from 15 NASA investigations to their original tables. Researchers can compare two experiments, see whether a single record matches a proposed cabin, check a quotation, and model a fire in a pressurized rover. The Moon-surface column in this archive has no measured fire outcomes. Team Code Blooded fixed four probabilities of sustained spread with a signed timestamp. A predeclared Brier score will compare those probabilities with a stated comparator when official outcomes become available.

## Detailed project description

A researcher comparing fire tests needs to know what changed, what was measured and which comparison survives. FIRST FIRE preserves NASA’s original row IDs, units and experiment conditions. Its challenge atlas exposes 1,622 nonempty source rows across 15 challenge investigations. Its normalized data table contains 1,058 observations from nine investigations. Some records are setup or smoke measurements. The dashboard lets the user inspect the denominator behind each result.

**How does initial oxygen relate to droplet burn duration?** The Transfer Lab first matches NASA FLEX methanol runs using recorded pre-ignition conditions. At 15% versus 21% chamber oxygen and a target pressure of 14.7 psia, a maximum diameter difference of 0.35 mm yields three pairs. Higher-minus-lower oxygen burn durations differ by −4.8, −3.3 and +12.9 seconds, averaging +1.6 seconds. At 0.05 mm, one pair remains at −3.3 seconds. Requiring both tests to fall on the same UTC date leaves zero pairs. A researcher can reveal the outcomes, select a cell to inspect its NASA run IDs and download the study JSON. The next controlled experiment would repeat both oxygen settings on the same day with matched starting diameters. [Reproduce the FLEX comparison](https://first-fire-lunar-lab.vercel.app/index.html#transfer-lab?view=sensitivity&reveal=1) · [NASA FLEX](https://doi.org/10.60555/mbq8-0451)

**Does a quiet alarm establish a missed detection?** In SAME-R, NASA identifies Kapton runs 85 and 93 as repeats of run 75. The ISS optical signal changed in all three. The separate Shuttle power and alarm flags both remained zero in all 3,792 telemetry records carrying those test numbers. A judge can open the original run workbooks and see why three missed alarms cannot be inferred. A separate run, 92, shows Shuttle power on in 691 of 721 records and zero alarm-on records. Its heater setting differs. A performance comparison would need powered detectors, evidence of readiness and matched smoke exposure. [Open the detector challenge](https://first-fire-lunar-lab.vercel.app/detector.html) · [NASA SAME-R](https://doi.org/10.60555/2np7-jv14)

Other cases include Saffire-II, where an acrylic strip burned next to discolored Nomex, and LUCI, where a fabric flame moved more slowly in simulated lunar gravity but lasted longer before extinction. Team-authored numerical scenarios are labeled. Four prospective FM² outcomes have team-assigned probabilities fixed by a signed timestamp. Observed lunar outcomes remain pending. [Saffire-II flight report](https://ntrs.nasa.gov/citations/20170008805) · [LUCI comparison](https://ntrs.nasa.gov/citations/20250010653) · [NASA FM² design](https://ntrs.nasa.gov/citations/20260001966)

**Who can use it?** A researcher can send a comparison link to another laboratory, which can rerun the settings against the same archived source rows. The static distribution also runs offline. For students in Amaravati and other communities, a classroom exercise in English and Telugu uses two NIST room experiments to connect a reported alarm reading to the instrument clock. The team provides a blinded comparison protocol for future participant testing. Classroom adoption, human time savings and external laboratory validation have yet to be measured. [Classroom exercise](https://first-fire-lunar-lab.vercel.app/classroom.html) · [Evaluation protocol](https://first-fire-lunar-lab.vercel.app/research/evaluation.md)

**What has been evaluated?** A project evaluator prepared a new 24-question set with reference answers derived from the frozen archive. The revised archive calculator passed 22 on its first attempt. It initially misread a follow-up about heptane and returned a whole-archive count. After fixing the selection, replaying those same 24 questions yielded 24 passes. The first-attempt score describes performance on questions that were new at test time. [Question sets and failure analysis](https://first-fire-lunar-lab.vercel.app/research/science-chat-audit.md)

## SI disclosure

ChatGPT and Codex (OpenAI) assisted with the build, including source discovery, implementation, technical writing and tests. Claude (Anthropic) assisted with the FLINT engine, its tests and figures, the master documents and the Pressurized Rover Fire Case, as well as the learner’s guide, original deck and PSI retrieval scripts.

The film uses synthetic English narration (macOS speech synthesis) and displays “SI-generated narration”. The rover concept illustration is SI-generated and marked on the image. NASA photographs and mission imagery are credited separately; the film also uses captures of the project interface. FLINT figures plot model results and source data.

Inside the research desk, Qwen3 or SmolLM2 selects passages, Gemma and MobileBERT support quotation review, Model2Vec and BGE-small retrieve text, and a liquid reservoir estimates oxygen from simulated runs. None supplies an experimental measurement. Named team sign-off remains pending.

The current gated prose replay and the browser’s row-calculation tests measure different tasks. The release publishes both rates, the separate routing trials, and the failed confidence calibration. [Current measurements](answer-verification.md) · [Master acceptance record](master-requirements.md)

## NASA data and resources

- [NASA Physical Sciences Informatics combustion catalog, a challenge-listed resource](https://psi.nasa.gov/physci/repo/search?q=combustion) · [Versioned FIRST FIRE manifest](https://first-fire-lunar-lab.vercel.app/data/raw/psi-manifest.json)
- [FLEX, PSI-69 experimental table](https://doi.org/10.60555/mbq8-0451) · [NASA FLEX flight report](https://ntrs.nasa.gov/citations/20150023456)
- [SAME-R, PSI-101, study version 4](https://doi.org/10.60555/2np7-jv14) · [Run 75](https://psi.nasa.gov/geode-py/ws/studies/PSI-101/download?file=PSI-101_Analyzed+Data_2010_238_18_kapton_run75.xls&version=1&studyVersion=4) · [Run 85](https://psi.nasa.gov/geode-py/ws/studies/PSI-101/download?file=PSI-101_Analyzed+Data_2010_242_12_kapton_run85.xls&version=1&studyVersion=4) · [Run 93](https://psi.nasa.gov/geode-py/ws/studies/PSI-101/download?file=PSI-101_Analyzed+Data_2010_250_13_kapton_run93.xls&version=1&studyVersion=4) · [Run 92](https://psi.nasa.gov/geode-py/ws/studies/PSI-101/download?file=PSI-101_Analyzed+Data_2010_250_16_kapton_run92.xls&version=1&studyVersion=4)
- [Saffire-II, PSI-99](https://psi.nasa.gov/physci/repo/data/investigations/PSI-99) · [Flight report and Table I](https://ntrs.nasa.gov/citations/20170008805) · [NASA LUCI partial-gravity study](https://ntrs.nasa.gov/citations/20250010653) · [NASA FM² science requirements](https://ntrs.nasa.gov/citations/20260001966)
- [NASA CFI-G data](https://doi.org/10.60555/cyt1-kh64) · [NASA materials standard](https://standards.nasa.gov/standard/NASA/NASA-STD-6001) · [NASA’s corrected ICES report](https://ntrs.nasa.gov/citations/20250002114) · [Exploration atmospheres engineering assessment](https://ntrs.nasa.gov/citations/20260003925)

### Fifteen investigations in the challenge Atlas

| Investigation | PSI accession | NASA data DOI |
| --- | --- | --- |
| BASS-II | PSI-25 | [10.60555/4qc4-de67](https://doi.org/10.60555/4qc4-de67) |
| BASS | PSI-26 | [10.60555/58h4-dy80](https://doi.org/10.60555/58h4-dy80) |
| Saffire-I | PSI-98 | [10.60555/0t15-1z43](https://doi.org/10.60555/0t15-1z43) |
| Saffire-II | PSI-99 | [10.60555/2chp-m469](https://doi.org/10.60555/2chp-m469) |
| Saffire-III | PSI-100 | [10.60555/040q-4h36](https://doi.org/10.60555/040q-4h36) |
| SAME | PSI-102 | [10.60555/gd4k-8h62](https://doi.org/10.60555/gd4k-8h62) |
| SAME-R | PSI-101 | [10.60555/2np7-jv14](https://doi.org/10.60555/2np7-jv14) |
| FLEX | PSI-69 | [10.60555/mbq8-0451](https://doi.org/10.60555/mbq8-0451) |
| FLEX-2 | PSI-68 | [10.60555/byp8-h018](https://doi.org/10.60555/byp8-h018) |
| BRE | PSI-20 | [10.60555/vb93-3y72](https://doi.org/10.60555/vb93-3y72) |
| CFI | PSI-39 | [10.60555/m6pj-a914](https://doi.org/10.60555/m6pj-a914) |
| CFI-G | PSI-159 | [10.60555/cyt1-kh64](https://doi.org/10.60555/cyt1-kh64) |
| E-FIELD Flames | PSI-22 | [10.60555/se5a-8c73](https://doi.org/10.60555/se5a-8c73) |
| SPICE | PSI-107 | [10.60555/9kbh-e962](https://doi.org/10.60555/9kbh-e962) |
| SLICE | PSI-106 | [10.60555/pm12-rg61](https://doi.org/10.60555/pm12-rg61) |

## Other references and tools

- [ISRO Gaganyaan crew-module ECLSS requirements](https://www.isro.gov.in/media_isro/pdf/Tenders/2024/44_Tender_Document1602424.pdf) · [JAXA FLARE slide 26, measured points and predicted boundaries](https://iss.jaxa.jp/kiboexp/news/images/2018ams_flare.pdf#page=26) · [NASA reduced-gravity five-material study](https://ntrs.nasa.gov/citations/20250006779) · [Cantera equilibrium solver](https://cantera.org/) · [NIST Fire Dynamics Simulator](https://pages.nist.gov/fds-smv/)

- [NIST room smoke-alarm experiments and data dictionary](https://www.nist.gov/el/fire/engineered-fire-safety/data-smoke-alarm-performance) · [Room time series](https://www.nist.gov/system/files/documents/2016/12/15/roomdata.zip) · [Summary workbook](https://www.nist.gov/system/files/documents/2016/12/14/summary_nistsmokebox_roomresults.xlsx)

- [Detector study by the investigators](https://pmc.ncbi.nlm.nih.gov/articles/PMC7918997/) · [CFI-G configuration and chamber conditions](https://api.drum.lib.umd.edu/server/api/core/bitstreams/278c77a3-6e86-4dc5-8413-c0381ebe74a9/content) · [Research bibliography and limits](https://first-fire-lunar-lab.vercel.app/research/review.md)
- [Model2Vec model and license](https://huggingface.co/minishlab/potion-base-2M) · [Qwen3 0.6B model](https://huggingface.co/Qwen/Qwen3-0.6B) · [Ollama local runtime](https://github.com/ollama/ollama) · [OpenAI Codex](https://openai.com/codex/)
- [DM Sans](https://github.com/google/fonts/tree/main/ofl/dmsans) · [Barlow Condensed](https://github.com/google/fonts/tree/main/ofl/barlowcondensed) · [Code and third-party notices](https://first-fire-lunar-lab.vercel.app/licenses/software.txt) · [Additional public project and technical references](https://first-fire-lunar-lab.vercel.app/research/challenge-projects.md)
