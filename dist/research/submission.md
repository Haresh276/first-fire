# FIRST FIRE — Project submission copy

**Team:** Code Blooded  
**Challenge:** Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data  
**Project title:** FIRST FIRE — A Research Desk for Spacecraft Fire Safety  
**Project demonstration:** [Six-slide judge demonstration](../demo.html)  
**30-second walkthrough:** [Watch the live product demo](../first-fire-demo.mp4)

**Final project:** [FIRST FIRE dashboard](../index.html)

The links above open the packaged project. The public release is available at [FIRST FIRE](https://first-fire-lunar-lab.christsamuel26.chatgpt.site/). On the official form, enter the public addresses for the hosted `demo.html` and `index.html` once available. The six-slide demonstration also works offline and can be printed as a slide presentation. On this date, the official event site gives **Sunday, 15 November 2026, 11:59 p.m.** as the closing time. The team owner's local-event timezone governs the deadline. The organizing team's published guidance calls for the project title, summary, demonstration, final project, detailed description, data/resources, SI/AI disclosure and terms acknowledgment. A Navigator confirms a maximum of seven slides, including any title and closing slides. [Official event timeline](https://www.spaceappschallenge.org/2026/), [organizing-team guidance on submission fields](https://github.com/nasa/spaceapps/discussions/1858), [demonstration and disclosure guidance](https://github.com/nasa/spaceapps/discussions/1947), [official guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), [local-event timezone guidance](https://github.com/nasa/spaceapps/discussions/1916)

## High-level summary

FIRST FIRE compares 1,622 NASA source rows across 15 investigations with the conditions of a proposed habitat. Its seven-rule evidence audit explains where an extrapolation fails. The team fixed a forecast for four planned lunar FM² burns before any recorded result. A signed timestamp, a scoring rule and the source records are public. Researchers can explore sealed-compartment scenarios in the Physics Lab, inspect a liquid-network model's measured approximation error, and test an altered quote in the Referee. The six detailed case studies trace specific observations back to the original publications.

## Detailed description

FIRST FIRE helps students and aerospace researchers decide what earlier experiments can tell them about a specific scenario. A user can search a question in plain language, select a mission atmosphere, compare observations, inspect a case and export a research brief. The brief preserves the evidence, the limit of the comparison and the next measurement the user needs.

For example, NASA’s Lunar Combustion Investigation compared a downward-spreading SIBAL fabric flame in simulated lunar gravity with a ground run. The flame base advanced at 0.9 mm/s in the flight comparison and 1.5 mm/s on Earth, yet the flight flame lasted about 45 seconds longer. A 20-second aircraft run offers an independent comparison for early flame speed. Its duration is too short to establish the extinction difference. FIRST FIRE puts these distinctions alongside the original figures. [LUCI comparison, pp. 33–34](https://ntrs.nasa.gov/api/citations/20250010653/downloads/ASGSR%202025-LUCI-Ferkul-Presentation-v2-20250010653.pdf#page=33), [parabolic flight results, pp. 21–22](https://ntrs.nasa.gov/api/citations/20260001966/downloads/Ferkul-Lunar%20and%20Planetary%20Science%20Conf%202026%20v2.pdf#page=21)

Each case includes six alternative designs for organizing and interpreting its evidence, a trade-off for each, and a condition that would demonstrate success. A separate forecast explores the four starting oxygen levels NASA proposed for FM². Changing an assumed limiting oxygen concentration updates the probabilities under an explicit shared-threshold model. The slider changes an exploratory scenario. The team’s fixed predictions and external timestamp can be downloaded together and verified; the four lunar outcomes remain pending. [Fixed team forecast](../forecast-lock/fm2-v1.json) · [signed timestamp](../forecast-lock/fm2-v1.tsr). [NASA FM² design, pp. 5–10](https://ntrs.nasa.gov/api/citations/20260001966/downloads/Ferkul-Lunar%20and%20Planetary%20Science%20Conf%202026%20v2.pdf#page=5)

## Data and methods

The software preserves the source bytes for 20 public experimental CSVs returned by 19 NASA Physical Sciences Informatics records. It normalizes 1,058 identifiable observation records from nine investigations while retaining original filenames, row numbers, units, identifiers and provenance. Some rows represent attempted ignitions or smoke-aging observations. The other ten investigations remain in the catalog with their available source material and coverage limits. Percent oxygen in a burner, ambient oxygen, smoke generation time and visible extinction time each have distinct meanings. The dashboard preserves those distinctions when filtering and ranking.

NASA papers and the original investigators’ publications provide definitions, endpoint interpretations and contradictory examples that the CSVs alone cannot supply. Ten short source passages have verifiable page or section fingerprints made from seven full publisher originals. An automated check rejects planted quote edits and wrong-page citations. This verifies where words occurred. The project records team review of their scientific interpretation as pending. [Complete references and review](review.md), [data provenance and exclusions](data.md), [source verification method](../data/evidence/README.md)

## Impact and evaluation

FIRST FIRE gives a researcher a way to identify the next measurement. A search about a lunar textile can return a closely matched early-spread test while also showing the observation window needed to answer a question about extinction. That distinction can guide an experimental design or help a student defend a scientific claim to a reviewer.

The project includes a blind evaluation workflow with participant tasks, masked assessment and analysis of completed sessions. The intended measures include correct evidence use, critical errors and elapsed time. No human participant results or measured improvement are claimed. [Evaluation protocol](evaluation.md)

## Use of SI / AI

OpenAI Codex assisted with source discovery, study interpretation, drafting, software implementation and verification. The dashboard uses the pretrained Model2Vec `minishlab/potion-base-2M` static sentence embedding model locally in the browser alongside lexical matching. It retrieves case records and investigation descriptions from the project’s corpus. The measurements originate with the cited investigators. Search scores indicate relevance, while the forecast probabilities follow from user-visible model assumptions. The ten marked quotations have passed automated verification against original publications. The project does not record human approval by any team member. The imagery of SIBAL fabric comes from NASA Glenn and is attributed wherever used. [Embedding model and licence](https://huggingface.co/minishlab/potion-base-2M), [NASA Glenn image source](https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/flammability-of-materials-on-the-moon-fm2/)

## References for the submission form

* [NASA PSI catalog, with individual dataset DOIs and versions in the project manifest](https://psi.nasa.gov/physci/repo) · [local versioned manifest](../data/raw/psi-manifest.json).
* [Saffire-II flight results, sample 2-7 and Table I](https://ntrs.nasa.gov/citations/20170008805) · [Saffire-II PSI record](https://psi.nasa.gov/physci/repo/data/investigations/PSI-99).
* [NASA LUCI partial-gravity study](https://ntrs.nasa.gov/citations/20250010653) · [NASA ICES-2025-392 corrected paper](https://ntrs.nasa.gov/citations/20250002114) · [NASA materials standard](https://standards.nasa.gov/standard/NASA/NASA-STD-6001).
* [NASA FLEX report](https://ntrs.nasa.gov/citations/20150023456) · [FLEX experimental table](https://doi.org/10.60555/mbq8-0451) · [SAME-R experimental table](https://doi.org/10.60555/2np7-jv14) · [Meyer et al., detector performance](https://pmc.ncbi.nlm.nih.gov/articles/PMC7918997/).
* [NASA CFI-G dataset](https://doi.org/10.60555/cyt1-kh64) · [Kimber, CFI-G fuel and oxidizer configurations](https://api.drum.lib.umd.edu/server/api/core/bitstreams/278c77a3-6e86-4dc5-8413-c0381ebe74a9/content).
* [NASA FM² science requirements](https://ntrs.nasa.gov/api/citations/20260001966/downloads/Ferkul-Lunar%20and%20Planetary%20Science%20Conf%202026%20v2.pdf) · [NASA engineering assessment of reduced-pressure atmospheres](https://ntrs.nasa.gov/citations/20260003925).
* [Model2Vec model card](https://huggingface.co/minishlab/potion-base-2M) · [Model2Vec project](https://github.com/MinishLab/model2vec) · [DM Sans typeface](https://github.com/google/fonts/tree/main/ofl/dmsans) · [Barlow Condensed typeface](https://github.com/google/fonts/tree/main/ofl/barlowcondensed).
* [Further publications, counterevidence and prior work](review.md) · [mission forecast and assumptions](forecast.md).
