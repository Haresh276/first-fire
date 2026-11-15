# FIRST FIRE — project submission

**Team** Code Blooded  
**Challenge** Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data  
**Project title** FIRST FIRE — A Research Desk for Spacecraft Fire Safety

## Project demonstration

[Six-slide judge demonstration](../demo.html) · [Public demonstration URL for the submission form](https://first-fire-lunar-lab.christsamuel26.chatgpt.site/demo.html) · [Six-slide PDF](../first-fire-demo.pdf)

## Final project

[FIRST FIRE dashboard](../index.html) · [Public project URL for the submission form](https://first-fire-lunar-lab.christsamuel26.chatgpt.site/) · [Download the offline edition](https://first-fire-lunar-lab.christsamuel26.chatgpt.site/first-fire-offline.zip) · [Project source](https://github.com/Haresh276/first-fire)

## High-level project summary

FIRST FIRE helps aerospace researchers and engineering students decide which NASA fire experiments can answer a proposed question. It ranks flight observations by test conditions and traces each conclusion to its source. In NASA’s FLEX methanol data, tightening one diameter tolerance reverses the average burn-time difference and requiring the same test day leaves no comparable pair. In NASA’s SAME-R smoke data, interpreting the Shuttle alarm depends on its power flag, which stayed off throughout three repeat runs. A user can reproduce each finding, export the evidence, and identify the next experiment.

## Detailed project description

A researcher comparing fire tests needs to know what changed, what was measured and which comparison survives. FIRST FIRE preserves NASA’s original row IDs, units and experiment conditions. Its challenge atlas exposes 1,622 nonempty source rows across 15 challenge investigations. Its normalized data table contains 1,058 observations from nine investigations. Some records are setup or smoke measurements. The dashboard lets the user inspect the denominator behind each result.

**How does initial oxygen relate to droplet burn duration?** The Transfer Lab first matches NASA FLEX methanol runs using recorded pre-ignition conditions. At 15% versus 21% chamber oxygen and a target pressure of 14.7 psia, a maximum diameter difference of 0.35 mm yields three pairs. Higher-minus-lower oxygen burn durations differ by −4.8, −3.3 and +12.9 seconds, averaging +1.6 seconds. At 0.05 mm, one pair remains at −3.3 seconds. Requiring both tests to fall on the same UTC date leaves zero pairs. A researcher can reveal the outcomes, select a cell to inspect its NASA run IDs and download the study JSON. The next controlled experiment would repeat both oxygen settings on the same day with matched starting diameters. [Reproduce the FLEX comparison](https://first-fire-lunar-lab.christsamuel26.chatgpt.site/index.html#transfer-lab?view=sensitivity&reveal=1) · [NASA FLEX](https://doi.org/10.60555/mbq8-0451)

**Does a quiet alarm establish a missed detection?** In SAME-R, NASA identifies Kapton runs 85 and 93 as repeats of run 75. The ISS optical signal changed in all three. The separate Shuttle power and alarm flags both remained zero in all 3,792 telemetry records carrying those test numbers. A judge can open the original run workbooks and see why three missed alarms cannot be inferred. A separate run, 92, shows Shuttle power on in 691 of 721 records and zero alarm-on records. Its heater setting differs. A performance comparison would need powered detectors, evidence of readiness and matched smoke exposure. [Open the detector challenge](https://first-fire-lunar-lab.christsamuel26.chatgpt.site/detector.html) · [NASA SAME-R](https://doi.org/10.60555/2np7-jv14)

Other cases include Saffire-II, where an acrylic strip burned next to discolored Nomex, and LUCI, where a fabric flame moved more slowly in simulated lunar gravity but lasted longer before extinction. Team-authored numerical scenarios are labeled. Four prospective FM² outcomes have team-assigned probabilities fixed by a signed timestamp. Observed lunar outcomes remain pending. [Saffire-II flight report](https://ntrs.nasa.gov/citations/20170008805) · [LUCI comparison](https://ntrs.nasa.gov/citations/20250010653) · [NASA FM² design](https://ntrs.nasa.gov/citations/20260001966)

**Who can use it?** A researcher can send a comparison link to another laboratory, which can rerun the settings against the same archived source rows. The static distribution also runs offline. For students in Amaravati and other communities, a classroom exercise in English and Telugu uses two NIST room experiments to connect a reported alarm reading to the instrument clock. The team provides a blinded comparison protocol for future participant testing. Classroom adoption, human time savings and external laboratory validation have yet to be measured. [Classroom exercise](https://first-fire-lunar-lab.christsamuel26.chatgpt.site/classroom.html) · [Evaluation protocol](https://github.com/Haresh276/first-fire/blob/main/research/evaluation.md)

**What has been evaluated?** A project evaluator prepared a new 24-question set with reference answers derived from the frozen archive. The revised archive calculator passed 22 on its first attempt. It initially misread a follow-up about heptane and returned a whole-archive count. After fixing the selection, replaying those same 24 questions yielded 24 passes. The first-attempt score describes performance on questions that were new at test time. [Question sets and failure analysis](https://github.com/Haresh276/first-fire/blob/main/research/science-chat-audit.md)

## Use of Super Intelligence (SI) and AI

OpenAI Codex assisted with source discovery, drafting, software implementation, test generation and verification. The project uses Model2Vec/potion-base-2M embeddings and lexical search to retrieve evidence from a local archive. The optional local chat service can use an instruction model to select sourced passages. The archive calculator computes table answers from explicit fields and filters. The FLEX matches and detector figures are calculated from the cited NASA measurements. FIRST FIRE’s simulations and model-generated values are labeled separately. The SIBAL photograph in the demonstration is credited to NASA Glenn. The charts in the demonstration plot the recorded data or their stated differences. Human scientific sign-off is pending. [Model selection and evaluation](https://github.com/Haresh276/first-fire/blob/main/research/chat-models.md) · [Model2Vec](https://github.com/MinishLab/model2vec) · [NASA Glenn SIBAL image source](https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/flammability-of-materials-on-the-moon-fm2/)

## NASA data and resources

- [NASA Physical Sciences Informatics combustion catalog, a challenge-listed resource](https://psi.nasa.gov/physci/repo/search?q=combustion) · [Versioned FIRST FIRE manifest](https://github.com/Haresh276/first-fire/blob/main/data/raw/psi-manifest.json)
- [FLEX, PSI-69 experimental table](https://doi.org/10.60555/mbq8-0451) · [NASA FLEX flight report](https://ntrs.nasa.gov/citations/20150023456)
- [SAME-R, PSI-101, study version 4](https://doi.org/10.60555/2np7-jv14) · [Run 75](https://psi.nasa.gov/geode-py/ws/studies/PSI-101/download?file=PSI-101_Analyzed+Data_2010_238_18_kapton_run75.xls&version=1&studyVersion=4) · [Run 85](https://psi.nasa.gov/geode-py/ws/studies/PSI-101/download?file=PSI-101_Analyzed+Data_2010_242_12_kapton_run85.xls&version=1&studyVersion=4) · [Run 93](https://psi.nasa.gov/geode-py/ws/studies/PSI-101/download?file=PSI-101_Analyzed+Data_2010_250_13_kapton_run93.xls&version=1&studyVersion=4) · [Run 92](https://psi.nasa.gov/geode-py/ws/studies/PSI-101/download?file=PSI-101_Analyzed+Data_2010_250_16_kapton_run92.xls&version=1&studyVersion=4)
- [Saffire-II, PSI-99](https://psi.nasa.gov/physci/repo/data/investigations/PSI-99) · [Flight report and Table I](https://ntrs.nasa.gov/citations/20170008805) · [NASA LUCI partial-gravity study](https://ntrs.nasa.gov/citations/20250010653) · [NASA FM² science requirements](https://ntrs.nasa.gov/citations/20260001966)
- [NASA CFI-G data](https://doi.org/10.60555/cyt1-kh64) · [NASA materials standard](https://standards.nasa.gov/standard/NASA/NASA-STD-6001) · [NASA’s corrected ICES report](https://ntrs.nasa.gov/citations/20250002114) · [Exploration atmospheres engineering assessment](https://ntrs.nasa.gov/citations/20260003925)

## Other references and tools

- [NIST room smoke-alarm experiments and data dictionary](https://www.nist.gov/el/fire/engineered-fire-safety/data-smoke-alarm-performance) · [Room time series](https://www.nist.gov/system/files/documents/2016/12/15/roomdata.zip) · [Summary workbook](https://www.nist.gov/system/files/documents/2016/12/14/summary_nistsmokebox_roomresults.xlsx)

- [Detector study by the investigators](https://pmc.ncbi.nlm.nih.gov/articles/PMC7918997/) · [CFI-G configuration and chamber conditions](https://api.drum.lib.umd.edu/server/api/core/bitstreams/278c77a3-6e86-4dc5-8413-c0381ebe74a9/content) · [Research bibliography and limits](https://github.com/Haresh276/first-fire/blob/main/research/review.md)
- [Model2Vec model and license](https://huggingface.co/minishlab/potion-base-2M) · [Qwen3 0.6B model](https://huggingface.co/Qwen/Qwen3-0.6B) · [Ollama local runtime](https://github.com/ollama/ollama) · [OpenAI Codex](https://openai.com/codex/)
- [DM Sans](https://github.com/google/fonts/tree/main/ofl/dmsans) · [Barlow Condensed](https://github.com/google/fonts/tree/main/ofl/barlowcondensed) · [Code and third-party notices](https://github.com/Haresh276/first-fire/blob/main/LICENSE) · [Additional public project and technical references](https://github.com/Haresh276/first-fire/blob/main/research/challenge-projects.md)
