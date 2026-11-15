# Source-access audit of the master bibliography

15 November 2026. This register follows the 101-page interim master, Part J (printed pp. 89–95). It preserves its original identifiers, including the late additions [61] and [62]. The historical letters describe the team’s preparation of the master: **V** read and checked then, **R** cited in project research, **K** standard reference, **U** team-supplied, **T** team artefact.

For this audit we opened the source URLs embedded in the PDF, followed redirects and recorded the returned page identity or PDF file signature. We queried NASA metadata for NTRS accessions, checked the nineteen dataset DOI redirects, and recomputed seven stored source fingerprints and twenty CSV fingerprints. A successful request establishes access at the time of the test. Verification of individual scientific claims requires the cited passage, its conditions and its endpoint. A 403, 503 or browser challenge describes the access path used here.

[Original source register with status letters](../first-fire-field-guide.pdf#page=32) · [Scientific source review](review.md) · [Claim verification methods](answer-verification.md)

## J1 · Challenge and rules

| ID | Source | Master | Access and identification on 15 November |
|---|---|---|---|
| [1] | [Flame in Freefall · 2026 challenge, resources and teams](https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/) | V | HTTP 200. The challenge heading identifies Flame in Freefall. The three tabs were not independently audited line by line. |
| [2] | [NASA Space Apps Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/) | V | HTTP 200. Page heading identifies the submission guide. Event-specific eligibility was outside this check. |
| [3] | [NASA Space Apps Awards and judging stages](https://www.spaceappschallenge.org/awards/) | V | HTTP 200 at the supplied awards page. The official 2025 global-winners announcement is independently located at [59]. |
| [4] | Amaravati 2026 event schedule · organisers’ PDF | V | The PDF records an organiser-supplied schedule and marks it V. The original event file was unavailable for a new check. The master gives the local dates and venue on p. 10. |
| [5] | [Space Apps organising-team discussions 1858, 1947 and 1916](https://github.com/nasa/spaceapps/discussions/1858) | R | All three threads returned HTTP 200. The first two are labelled for a different Space Apps challenge; use its actual organiser replies and the global guide before applying the advice here. Other threads: [1947](https://github.com/nasa/spaceapps/discussions/1947) and [1916](https://github.com/nasa/spaceapps/discussions/1916). |

## J2 · NASA data

| ID | Source | Master | Access and identification on 15 November |
|---|---|---|---|
| [6] | [NASA Physical Sciences Informatics repository](https://psi.nasa.gov/physci/repo) | V | HTTP 200 returned the NASA PSI portal. The investigation and CSV checks are recorded separately under [8]. |
| [7] | [NASA PSI Database Guide](https://science.nasa.gov/wp-content/uploads/2024/11/psi-database-guide.pdf) | R | HTTP 200 with a PDF signature at NASA’s published database-guide URL. |
| [8] | 15 challenge datasets and four extended PSI records in Table C1 · [Repository dataset description](data.md) | V (15), R (4) | All 19 DOI links redirected to their matching NASA PSI accession pages (HTTP 200). Recomputed SHA-256 for all 20 repository CSVs. See the accession table below. |

## J3 · FM² and partial gravity

| ID | Source | Master | Access and identification on 15 November |
|---|---|---|---|
| [9] | [Material Flammability at Lunar and Martian Gravity · March 2026 presentation](https://ntrs.nasa.gov/citations/20260001966) | V | Archived source bytes match the release SHA-256 (89c604a71fe3…). Evidence locator: presentation p. 5. NASA’s JSON record also returned the cited title. |
| [10] | [Lunar and Planetary Science Conference abstract 1799](https://www.hou.usra.edu/meetings/lpsc2026/pdf/1799.pdf) | V | HTTP 200 and PDF signature at the USRA conference archive, abstract 1799. |
| [11] | [NASA Glenn · Flammability of Materials on the Moon](https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/flammability-of-materials-on-the-moon-fm2/) | R | HTTP 200. NASA Glenn page names the FM² investigation. |
| [12] | [Solid Fuel Ignition Testing for Lunar Applications, Theory and Experimental Results · corrected captions](https://ntrs.nasa.gov/citations/20250002114) | V | Archived source bytes match the release SHA-256 (a7beb30e4beb…). Evidence locator: PDF pp. 9, 10 and 11. The source URL names the corrected-caption version. |
| [13] | [Lunar Combustion Investigation · rotating sounding-rocket flammability results](https://ntrs.nasa.gov/citations/20250010653) | V | Archived source bytes match the release SHA-256 (bb0aadd2f954…). Evidence locator: presentation p. 34. NASA’s JSON record matches the sounding-rocket paper. |
| [14] | [Impacts of Reduced Pressure Atmospheres on Environmental Control and Life Support Systems Architectures](https://ntrs.nasa.gov/citations/20260003925) | V | HTTP 200. NTRS metadata and title identify NASA/TM-20260003925. |
| [15] | [NASA-STD-6001B Change 3 · flammability and compatibility test procedures](https://standards.nasa.gov/standard/NASA/NASA-STD-6001) | R | HTTP 200. The NASA standards catalogue identifies the standard. A catalogue URL can show a newer revision; use the specific Change 3 copy when applying its procedures. |
| [16] | [Earlier FM² concepts · symposium 20240008623 and poster 20240015307](https://ntrs.nasa.gov/citations/20240008623) | R | Both supplied NTRS accession numbers returned HTTP 200 metadata for the earlier FM² concepts. [Poster metadata](https://ntrs.nasa.gov/api/citations/20240015307). |
| [17] | [NASA FY 2027 full budget request](https://www.nasa.gov/wp-content/uploads/2026/04/fiscal-year-2027-full-budget-request.pdf) | R | HTTP 200 and PDF signature for the full FY 2027 budget request. Mission funding line items were outside this check. |
| [18] | [Firefly Blue Ghost Mission 3 · Gruithuisen Domes](https://fireflyspace.com/missions/blue-ghost-elytra-gruithuisen-domes/) | R | HTTP 200. Firefly identifies Blue Ghost and Elytra at the Gruithuisen Domes. Mission schedules can change. |

## J4 · Orbital cases

| ID | Source | Master | Access and identification on 15 November |
|---|---|---|---|
| [19] | [Results of Large-Scale Spacecraft Flammability Tests · Saffire-I/II](https://ntrs.nasa.gov/citations/20170008805) | R | Archived source bytes match the release SHA-256 (e38ec36f5481…). Evidence locator: presentation p. 25. The live NTRS record returned the flight-report title. |
| [20] | [Preliminary Results from the Saffire VI Experiment](https://ntrs.nasa.gov/citations/20240002981) | R | HTTP 200. NASA record identifies the preliminary Saffire-VI report. |
| [21] | [Detailed Results from the Flame Extinguishment Experiment (FLEX)](https://ntrs.nasa.gov/citations/20150023456) | R | Archived source bytes match the release SHA-256 (b4f6ca983e27…). Evidence locator: PDF pp. 154 and 189. These are PDF indices; the printed report has its own page numbering. |
| [22] | [Droplet Combustion Experiments Aboard the International Space Station](https://doi.org/10.1007/s12217-014-9372-2) | R | DOI redirected to Springer. The final page returned HTTP 200 and the matching paper title. |
| [23] | [Meyer et al. · spacecraft smoke detector performance, with companion NIST story](https://pmc.ncbi.nlm.nih.gov/articles/PMC7918997/) | R | PMC returned an HTTP 200 browser challenge. Europe PMC matched the article title. Archived source bytes match the release SHA-256 (a05df377a80c…). Evidence locator: HTML section S8. The master prints a single URL for the paper and its companion news story. |
| [24] | [Spherical gas-fueled cool diffusion flames, with companion CFI-G thesis](https://doi.org/10.1016/j.proci.2022.07.015) | R | The DOI reached an Elsevier redirect page. Crossref identifies the paper. Archived source bytes match the release SHA-256 (b01d986ee1e4…). Evidence locator: companion Maryland thesis, PDF p. 21. [Archived thesis source](https://api.drum.lib.umd.edu/server/api/core/bitstreams/278c77a3-6e86-4dc5-8413-c0381ebe74a9/content). |
| [25] | [Update on NASA Materials Flammability Research](https://ntrs.nasa.gov/citations/20210021181) | R | HTTP 200. NASA record identifies the 2021 materials research update. |
| [26] | [Olson, Ruff and Miller · Microgravity Flame Spread in Exploration Atmospheres](https://ntrs.nasa.gov/citations/20080034883) | R | HTTP 200. NASA’s record identifies the study of pressure, oxygen and velocity in opposed spread. |
| [27] | [Vehicle Modeling During the Burning of Thermally Thick Samples in the Saffire V Experiments](https://ntrs.nasa.gov/citations/20240008602) | R | HTTP 200. NASA’s record identifies the Saffire V thermally thick sample modelling paper. |
| [28] | [Large Scale Fire Dynamics in Spacecraft in Reduced Gravity](https://www.nist.gov/publications/large-scale-fire-dynamics-spacecraft-reduced-gravity) | R | HTTP 200. The NIST page identifies Gregory T. Linteris and the 2011 report. |
| [29] | [Shuttle–Mir combustion experiments · NASA SP-4225](https://www.nasa.gov/wp-content/uploads/static/history/SP-4225/science/combustion-summary.pdf) | R | HTTP 200 and PDF signature at the Shuttle–Mir combustion summary. |
| [30] | [Spacecraft fire detection white paper 20210022143 and study 20260005612](https://ntrs.nasa.gov/citations/20210022143) | R | Both NASA records returned HTTP 200. The first identifies spacecraft fire-detection challenges. The second identifies early detection in partial and low gravity. [2026 detection study](https://ntrs.nasa.gov/api/citations/20260005612). |
| [62] | [Saffire IV/V scale study · ICES-2021-266](https://ntrs.nasa.gov/citations/20210011521) | R | HTTP 200. NASA metadata identifies the Saffire IV/V large-scale flame-spread paper. Sample size affects transfer to other geometries. |

## J5 · Partner agencies and Earth applications

| ID | Source | Master | Access and identification on 15 November |
|---|---|---|---|
| [31] | [JAXA FLARE · reduced-gravity fire-safety research](https://humans-in-space.jaxa.jp/en/biz-lab/experiment/theme/detail/000807.html) | R | HTTP 200. JAXA identifies its reduced-gravity international fire-safety research project. |
| [32] | [NASA pursues lunar terrain vehicle services, with companion LTV page](https://www.nasa.gov/press-release/nasa-pursues-lunar-terrain-vehicle-services-for-artemis-missions/) | V | HTTP 200. The supplied NASA release identifies the LTV procurement. The companion LTV programme page is named without a second URL in Part J. |
| [33] | [NASA–Japan pressurized lunar rover agreement](https://www.nasa.gov/news-release/nasa-japan-advance-space-cooperation-sign-agreement-for-lunar-rover/) | R | HTTP 200. NASA’s page identifies the bilateral pressurized rover agreement. |
| [61] | [Toyota Times · JAXA/Toyota pressurized rover concept, 2019](https://global.toyota/en/newsroom/corporate/toyotatimes/27157958.html) | V | HTTP 200. The Toyota Times page identifies the pressurized lunar-rover concept. Specifications apply to the dated concept. |
| [34] | [ISRO crew-module ECLSS requirements · 2024 tender](https://www.isro.gov.in/media_isro/pdf/Tenders/2024/44_Tender_Document1602424.pdf) | R | HTTP 200 with a PDF signature on the ISRO tender. It is a public engineering tender; the complete operational flight configuration is outside this check. |
| [35] | [WHO · Medical oxygen fire risk mitigation measures](https://www.who.int/publications/m/item/medical-oxygen-fire-risk-mitigation-measures) | R | HTTP 200. WHO’s heading identifies the medical oxygen fire-risk mitigation document. |
| [36] | [Fire in the surgical center · PubMed 22656688](https://pubmed.ncbi.nlm.nih.gov/22656688/) | R | The direct PubMed request returned HTTP 203 and a cookie requirement. Europe PMC independently matched PMID 22656688 to the listed case. [Record metadata](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID%3A22656688%20AND%20SRC%3AMED&format=json). |
| [37] | [NIOSH mining fires and explosions](https://www.cdc.gov/niosh/mining/topics/fires-explosions.html) | R | Direct request received HTTP 403. The indexed CDC page identifies Mining Fires and Explosions and discusses smoke and ventilation. Availability varies by access path. |
| [38] | [FAA material fire test criteria · TC-17-46](https://www.fire.tc.faa.gov/pdf/TC-17-46.pdf) | R | Direct request received HTTP 503. A second retrieval timed out. The original PDF content was unavailable for rechecking. |
| [39] | [U.S. Navy standard organization and regulations · OPNAVINST 3120.32](https://www.med.navy.mil/Portals/62/Documents/NMFA/NMCPHC/root/Field%20Activities/Pages/NEPMU6/Operational%20Support/Environmental%20Health/OPNAVINST-3120-32.pdf) | R | The master points to At Home without a literal URL. The URL extracted from the released At Home source returned HTTP 403, including a second retrieval. The instruction’s text was unavailable for rechecking. |

## J6 · Methods, models and tools

| ID | Source | Master | Access and identification on 15 November |
|---|---|---|---|
| [40] | [Brier (1950) · Verification of Forecasts Expressed in Terms of Probability](https://journals.ametsoc.org/doi/10.1175/1520-0493%281950%29078%3C0001%3AVOFEIT%3E2.0.CO%3B2) | K | No URL printed. The independently located American Meteorological Society record identifies Glenn W. Brier, January 1950, pp. 1–3. |
| [41] | [RFC 3161 · Internet X.509 Public Key Infrastructure Time-Stamp Protocol](https://www.rfc-editor.org/rfc/rfc3161) | K | HTTP 200. RFC Editor identifies RFC 3161 and the TSP title. |
| [42] | [Zenodo repository](https://zenodo.org/) | K | HTTP 200 for the repository homepage. The forecast’s deposit and DOI are separate, pending actions. |
| [43] | [Qwen3-0.6B model card](https://huggingface.co/Qwen/Qwen3-0.6B) | R | HTTP 200. The model repository identifies Qwen/Qwen3-0.6B. |
| [44] | [Gemma 3 technical report and 1B model card](https://arxiv.org/abs/2503.19786) | R | HTTP 200. arXiv identifies the Gemma 3 technical report. Part J gives one URL for the report and model card; the separate card was outside this check. |
| [45] | [Model2Vec potion-base-2M](https://huggingface.co/minishlab/potion-base-2M) | R | HTTP 200. The model repository identifies minishlab/potion-base-2M. |
| [46] | [BGE-small-en-v1.5 embedding model](https://huggingface.co/BAAI/bge-small-en-v1.5) | R | HTTP 200. The model repository identifies BAAI/bge-small-en-v1.5. |
| [47] | [MobileBERT · A Compact Task-Agnostic BERT for Resource-Limited Devices](https://arxiv.org/abs/2004.02984) | K | HTTP 200. arXiv identifies the MobileBERT paper. |
| [48] | [Ollama documentation](https://docs.ollama.com/) | R | HTTP 200. The documentation homepage identifies Ollama. |
| [49] | [xAI Grok API documentation](https://docs.x.ai/) | R | HTTP 200 after a redirect to the Grok API overview. This project has a proposed hosted adapter; visiting the documentation makes no authenticated API call. |
| [50] | [Liquid Time-constant Networks](https://arxiv.org/abs/2006.04439) | R | HTTP 200. arXiv identifies Liquid Time-constant Networks. |
| [51] | [Closed-form continuous-time neural networks](https://doi.org/10.1038/s42256-022-00556-7) | K | The DOI redirected to Nature Machine Intelligence. HTTP 200 returned the matching publication title. |
| [52] | [Cantera and GRI-Mech 3.0 data](https://cantera.org/) | R | HTTP 200. The supplied URL identifies the Cantera project. The release pins the mechanism and records its calculation separately. [GRI-Mech file cited in the solver report](https://github.com/Cantera/cantera/blob/v3.2.0/data/gri30.yaml). |
| [53] | [NIST Fire Dynamics Simulator and Smokeview manuals](https://pages.nist.gov/fds-smv/manuals.html) | R | HTTP 200. NIST identifies the FDS/Smokeview manuals. The separately executed release comparisons use prescribed burners. |
| [54] | [NIST CFAST two-zone model](https://github.com/firemodels/cfast) | R | HTTP 200. Repository identity matches NIST’s Consolidated Model of Fire and Smoke Transport. |
| [55] | [National Bureau of Standards Technical Note 1128 · heats of combustion](https://nvlpubs.nist.gov/nistpubs/Legacy/TN/nbstechnicalnote1128.pdf) | R | HTTP 200 and PDF signature at the NIST-hosted scan of Technical Note 1128. |
| [56] | [WebLLM browser inference](https://github.com/mlc-ai/web-llm) | K | HTTP 200. The mlc-ai WebLLM repository identifies browser inference. |
| [57] | [MDN browser capability APIs](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/deviceMemory) | K | HTTP 200. The supplied MDN URL identifies Navigator.deviceMemory. The other three APIs named in Part J have no separate printed URLs in this entry. |
| [58] | [CRediT · Contributor Roles Taxonomy](https://credit.niso.org/) | K | HTTP 200. The taxonomy site identifies CRediT. The release’s 12-role matrix is a team selection of roles. |

## J7 · Teams and previous winners

| ID | Source | Master | Access and identification on 15 November |
|---|---|---|---|
| [59] | [2025 global winners · team’s Previous Winners compilation](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-announces-2025-international-space-apps-challenge-global-winners/) | U | The master cites the team’s compilation with no URL. A separately located NASA announcement identifies ten winners. The original team compilation was unavailable for comparison. |
| [60] | [Team’s review of 310 public challenge repositories](code-review.md) · [Project inventory report](challenge-projects.md) | T | The two specified repository reports exist. The review covers 303 repositories with commits and seven empty repositories in its frozen 310-repository inventory. |

### Dataset DOI and raw-table checks for [8]

All 19 DOI destinations matched the expected accession on the NASA portal. The counts below describe original experimental CSV files available in the frozen archive. PSI-115 provides no experimental table in this release. The fifteen challenge records account for 16 tables.

| Accession | Dataset DOI | Frozen CSVs whose SHA-256 matched |
|---|---|---|
| PSI-10 | [10.60555/w4zy-bt45](https://doi.org/10.60555/w4zy-bt45) | 2 |
| PSI-20 | [10.60555/vb93-3y72](https://doi.org/10.60555/vb93-3y72) | 1 |
| PSI-21 | [10.60555/23e1-9950](https://doi.org/10.60555/23e1-9950) | 1 |
| PSI-22 | [10.60555/se5a-8c73](https://doi.org/10.60555/se5a-8c73) | 1 |
| PSI-23 | [10.60555/k57n-p030](https://doi.org/10.60555/k57n-p030) | 1 |
| PSI-25 | [10.60555/4qc4-de67](https://doi.org/10.60555/4qc4-de67) | 1 |
| PSI-26 | [10.60555/58h4-dy80](https://doi.org/10.60555/58h4-dy80) | 1 |
| PSI-39 | [10.60555/m6pj-a914](https://doi.org/10.60555/m6pj-a914) | 1 |
| PSI-68 | [10.60555/byp8-h018](https://doi.org/10.60555/byp8-h018) | 1 |
| PSI-69 | [10.60555/mbq8-0451](https://doi.org/10.60555/mbq8-0451) | 1 |
| PSI-98 | [10.60555/0t15-1z43](https://doi.org/10.60555/0t15-1z43) | 1 |
| PSI-99 | [10.60555/2chp-m469](https://doi.org/10.60555/2chp-m469) | 1 |
| PSI-100 | [10.60555/040q-4h36](https://doi.org/10.60555/040q-4h36) | 1 |
| PSI-101 | [10.60555/2np7-jv14](https://doi.org/10.60555/2np7-jv14) | 1 |
| PSI-102 | [10.60555/gd4k-8h62](https://doi.org/10.60555/gd4k-8h62) | 1 |
| PSI-106 | [10.60555/pm12-rg61](https://doi.org/10.60555/pm12-rg61) | 1 |
| PSI-107 | [10.60555/9kbh-e962](https://doi.org/10.60555/9kbh-e962) | 1 |
| PSI-115 | [10.60555/q0v5-1v28](https://doi.org/10.60555/q0v5-1v28) | 0 |
| PSI-159 | [10.60555/cyt1-kh64](https://doi.org/10.60555/cyt1-kh64) | 2 |

## J8 · Team artefacts

| Master ID | Direct evidence and access boundary |
|---|---|
| T1 | The master records revision [4cb1a9a](https://github.com/Haresh276/first-fire/commit/4cb1a9adf2a7a2655b26289b243bc44e2e5016de). The local commit object exists. The team repository requires authorised access. |
| T2 | The master links the [public project](https://first-fire-lunar-lab.christsamuel26.chatgpt.site/). The release audit separately tests the current publication. |
| T3 | Recomputed the SHA-256 of the [fixed forecast](../forecast-lock/fm2-v1.json): `9f565bc7195936bde5faff67841c5e1e6537581bc4fc560018838fbf996a8fa3`. The [timestamp response](../forecast-lock/fm2-v1.tsr) accompanies the file. |
| T4 | Opened the supplied Round 1 PDF locally. It has 12 slides; slide 6 contains the forecast. The release separately offers the [Round 2 presentation](../master-round2-slides.pdf). |
| T5 | The earlier team data-pack ZIP was unavailable. The [reconstructed pack](../challenge-data-pack.zip) preserves the 16 public challenge CSVs. Its checksums cannot establish that the earlier team and browser fetches occurred. |
| T6 | Opened the [technical manual](../first-fire-technical-manual.pdf) and [user manual](../first-fire-user-manual.pdf). Each contains nine pages in this release. |
| T7 | The [six-slide demonstration](../demo.html) and [30-second film](../first-fire-demo.mp4) have separate files. The [master-edition narrated film](../master-film.mp4) includes English captions. |

## J9 · Claim boundaries

The master’s [checked and unused claims](../first-fire-field-guide.pdf#page=37) are a historical record. The March FM² source, the corrected mixed-material lunar study, LUCI and Saffire each have distinct experiment conditions. The master leaves smoke-size ratios, a general NASA statement about lunar flammability, Indian advisory dates and station milestones outside its project claims. The 2025 announcement identifies the winners for that year. It does not establish a standing one-award-per-team rule. The [forecast methods](forecast.md), [case review](review.md) and [current evidence register](master-requirements.md) document the applicable release statements.
