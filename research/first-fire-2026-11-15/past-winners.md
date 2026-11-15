# NASA Space Apps: winners, history, and lessons for Flame in Freefall

Research checked 13 October 2026 (Asia/Kolkata). This is an internal research appendix for the participation game plan. Official results establish the awards; entrants' own sites establish what their prototypes claim. Neither an award nor an entrant description independently validates the underlying science.

## Main findings

- **Flame in Freefall appears to be a new 2026 challenge.** I found the current official challenge, current participant work, and an older thematically related project, but no earlier Space Apps challenge under this title or past winner of this exact challenge. Absence from search is not proof that no predecessor ever existed.
- **The most useful precedent is SpaceGenes+, the 2025 Best Use of Science winner:** a focused interface for interpreting NASA research and exposing interactions relevant to crew health. Study its user journey, scoped MVP, evidence links, and explanation of what is live versus future work.
- **There is no historical one-winner-per-challenge pattern.** Three 2025 winners addressed Commercializing Low Earth Orbit; two 2024 winners addressed agricultural decision-making; two 2023 winners addressed Moonquake Map 2.0. Choosing a seemingly uncrowded challenge does not establish better winning odds.
- **Real scientific evidence is necessary, but not a unique differentiator for Flame.** One publicly indexed 2026 entrant expressly labels its entire dataset and scores synthetic; another, [MicroFire Atlas](https://microfire-atlas.vercel.app/), already presents real NASA evidence, provenance, uncertainty, and evidence briefs. A modest reproducible corpus remains valuable, but the strategy must add measurable usefulness beyond that existing approach. See the separate strategy review.
- Do not confuse microgravity combustion with Earth wildfire detection. Wildfire winners can illustrate communication and GIS design, but their fire physics, datasets, and users differ substantially.

## Space Apps history

Space Apps began in 2012 with approximately 2,000 participants, 25 events, and 17 countries. It originally emphasized space science and technology. In 2017 it moved to NASA's Earth Science Division and broadened its Earth science remit; arts and humanities also became part of the program. Local Leads organize the local communities and events. The 2020 pandemic period included a separate COVID-19 edition as well as the annual challenge. These facts come from the [official historical overview](https://legacy.spaceappschallenge.org/about/spaceappshistory/).

The current [About page](https://www.spaceappschallenge.org/about/) frames Space Apps as a public gateway to NASA science and an open-data, multidisciplinary hackathon; its current funding language names NASA's Science Mission Directorate. Historical funding language should not be assumed to describe the current organizational arrangement.

The awards have evolved: the [2019 archive](https://2019.spaceappschallenge.org/awards/) lists six award categories, including Best Use of Hardware; the [2024 awards page](https://www.spaceappschallenge.org/nasa-space-apps-2024/awards/) lists ten, including storytelling, connection, art, and local impact. Older winners therefore should not be compared as if award categories were constant.

## Flame in Freefall: challenge lineage and scientific history

The official title is **Flame in Freefall: AI-Powered Fire Safety Insights from Microgravity Combustion Data**. The indexed [official 2026 challenge](https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall-ai-powered-fire-safety-insights-from-microgravity-combustion-data/) and [Combustion Institute announcement](https://members.combustioninstitute.org/members/search/query.php?keyword=2026&org_id=CMBI) establish that this year's task concerns an interactive AI dashboard for organizing, summarizing, ranking, and interpreting decades of NASA combustion research for human exploration. The full official detail page returned 502 through the research fetcher; the main agent is inspecting the authenticated site.

### Relevant earlier Space Apps project

[BurningSat, 2014](https://2014.spaceappschallenge.org/project/burningsat) addressed the **CubeWorld** challenge. It proposed a satellite experiment to study smouldering materials in microgravity and inform fire detection and suppression. The archived entry links [source code](https://github.com/wsellier/BurningSat) and fire-safety literature. It is a historical thematic predecessor, **not a verified Global Winner**. Its hazard statistics are participant assertions and should not be copied as established NASA facts.

### Useful science milestones for the pitch

| Milestone | Why it matters to the proposed project | Primary source |
|---|---|---|
| NASA documented its microgravity combustion program by the late 1980s and updated it in 1992. | This is a long-running scientific field with heterogeneous records, not a new collection of interchangeable CSVs. | [NASA Technical Memorandum 105410](https://ntrs.nasa.gov/api/citations/19920017954/downloads/19920017954.pdf?attachment=true) |
| On 24 February 1997 a fire in an oxygen-generating system aboard Mir endangered six crew, obstructed one escape route, and filled modules with smoke. Lessons informed ISS design and operations. | A clear, documented human consequence for the opening story; distinguish this operational incident from the research experiments. | [NASA history of the Mir fire](https://www.nasa.gov/history/25-years-ago-fire-aboard-space-station-mir/) |
| FLEX research discovered non-premixed cool flames aboard ISS in 2012. NASA reported another cool-flame milestone in June 2021. | A useful demonstration of why visible-flame intuition and simplistic fire classifications can fail; ground the interpretation in the experiment's own conditions. | [NASA cool-flames article](https://www.nasa.gov/missions/station/cool-flames-created-during-a-first-for-international-space-station-research/) |
| Saffire I conducted a remotely controlled large-scale spacecraft fire experiment in a departed Cygnus vehicle in June 2016. | Adds scale and spacecraft relevance beyond small laboratory flames. | [NASA Saffire I announcement](https://www.nasa.gov/news-release/nasa-glenn-successfully-ignites-largest-fire-experiment-in-space/) |
| Saffire V examined structured material samples; NASA reported faster growth/burning along thinner ribs than thicker parts. | A promising example of a specific, source-backed observation that can be compared only when geometry and test conditions are retained. | [NASA Saffire V findings](https://www.nasa.gov/humans-in-space/saffire-ignites-new-discoveries-in-space/) |
| ACME investigated cleaner/efficient combustion and spacecraft fire prevention/material flammability. | Different investigations have different primary objectives; ranking everything on a single safety score would obscure that. | [NASA ACME objectives](https://science.nasa.gov/biological-physical/investigations/acme/) |

**Inference for the game plan:** use history to motivate evidence retrieval, not to claim that a hackathon prototype can issue operational firefighting instructions. A better demonstrable decision is “Which experiments and findings are relevant to this material, atmosphere, flow, and gravity condition, and why?”

## 2025: all ten verified Global Winners

More than 11,500 submissions; 10 winners. Award/team/challenge mappings are from the [NASA announcement, 18 December 2025](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-announces-2025-international-space-apps-challenge-global-winners/). Linked names below are the official team/project entries linked by NASA; some entries require login or are currently failing to load.

| Award | Winning team | Challenge |
|---|---|---|
| Best Use of Science | [SpaceGenes+](https://www.spaceappschallenge.org/2025/find-a-team/spacegenes/?tab=project) | Build a Space Biology Knowledge Engine |
| Best Use of Data | [Resonant Exoplanets](https://www.spaceappschallenge.org/2025/find-a-team/resonant-exoplanets/?tab=project) | A World Away: Hunting for Exoplanets with AI |
| Best Use of Technology | [Twisters](https://www.spaceappschallenge.org/2025/find-a-team/twisters/?tab=project) | Will It Rain on My Parade? |
| Galactic Impact | [Astro Sweepers: We Catch What Space Leaves Behind](https://www.spaceappschallenge.org/2025/find-a-team/astro-sweepers-we-catch-what-space-leaves-behind/?tab=project) | Commercializing Low Earth Orbit (LEO) |
| Best Mission Concept | [PureFlow](https://www.spaceappschallenge.org/2025/find-a-team/pureflow2/?tab=project) | Your Home in Space: The Habitat Layout Creator |
| Most Inspirational | [Photonics Odyssey](https://www.spaceappschallenge.org/2025/find-a-team/photonic-force/?tab=project) | Commercializing Low Earth Orbit (LEO) |
| Best Use of Storytelling | [HerCode Space](https://www.spaceappschallenge.org/2025/find-a-team/hercode-space/?tab=project) | Stellar Stories: Space Weather Through the Eyes of Earthlings |
| Global Connection | [Gaia+LEO](https://www.spaceappschallenge.org/2025/find-a-team/gaialeo/?tab=project) | Commercializing Low Earth Orbit (LEO) |
| Art & Technology | [Zumorroda-X](https://www.spaceappschallenge.org/2025/find-a-team/zumorroda-x/) | NASA Farm Navigators: Using NASA Data Exploration in Agriculture |
| Local Impact | [QUEÑARIS](https://www.spaceappschallenge.org/2025/find-a-team/watana-project/?tab=project) | BloomWatch: An Earth Observation Application for Global Flowering Phenology |

## 2024: all ten verified Global Winners

9,996 submissions; 10 winners. Mappings and named projects come from the [NASA announcement, 16 January 2025](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-international-space-apps-challenge-announces-2024-global-winners/). Team names and project names are kept distinct where NASA named both. Challenge labels are shortened in this table.

| Award | Team / named project | Challenge |
|---|---|---|
| Best Use of Science | [WMPGang / SkyShield](https://www.spaceappschallenge.org/nasa-space-apps-2024/find-a-team/wmpgang/?tab=project) | Near-Earth Object Orrery |
| Best Use of Data | [GaamaRamma / Waterwise](https://www.spaceappschallenge.org/nasa-space-apps-2024/find-a-team/gaamaramma/?tab=project) | Agricultural Decision-Making |
| Best Use of Technology | [42 QuakeHeroes](https://www.spaceappschallenge.org/nasa-space-apps-2024/find-a-team/42-quakeheroes/?tab=project) | Seismic Detection Across the Solar System |
| Galactic Impact | [NVS-knot / 2plant \| ! 2plant](https://www.spaceappschallenge.org/nasa-space-apps-2024/find-a-team/nvs-knot/?tab=project) | Agricultural Decision-Making |
| Best Mission Concept | [AsturExplorers / Landsat Connect](https://www.spaceappschallenge.org/nasa-space-apps-2024/find-a-team/asturexplorers/?tab=project) | Landsat Reflectance Data |
| Most Inspirational | [Innovisionaries / Eco-Metropolis](https://www.spaceappschallenge.org/nasa-space-apps-2024/find-a-team/innovisionaries/?tab=project) | SDGs in the Classroom |
| Best Storytelling | [TerraTales](https://www.spaceappschallenge.org/nasa-space-apps-2024/find-a-team/terratales/?tab=project) | Tell Us a Climate Story! |
| Global Connection | [Asteroid Destroyer](https://www.spaceappschallenge.org/nasa-space-apps-2024/find-a-team/asteroid-destroyer/?tab=project) | Habitable Worlds Observatory Navigator |
| Art & Technology | [Connected Earth Museum](https://www.spaceappschallenge.org/nasa-space-apps-2024/find-a-team/connected-earth-museum/?tab=project) | Imagine our Connected Earth |
| Local Impact | [Team I.O. / G.R.O.W.](https://www.spaceappschallenge.org/nasa-space-apps-2024/find-a-team/team-io/?tab=project) | Community Mapping |

## 2023: all ten verified Global Winners

5,556 submissions; 10 winners. Mappings come from the [NASA Science announcement](https://science.nasa.gov/directorates/smd/2023-nasa-international-space-apps-challenge-announces-10-global-winners/). These are winning **team** names unless the project is separately named.

| Award | Winning team | Challenge |
|---|---|---|
| Best Use of Science | [LunarTech Ensemble](https://www.spaceappschallenge.org/2023/find-a-team/lunartech-ensemble/?tab=project) | Make a Moonquake Map 2.0! |
| Best Use of Data | [Storm Prophet](https://www.spaceappschallenge.org/2023/find-a-team/storm-prophet/?tab=project) | Develop the Oracle of DSCOVR |
| Best Use of Technology | [Spacebee](https://www.spaceappschallenge.org/2023/find-a-team/spacebee/?tab=project) | Make a Moonquake Map 2.0! |
| Galactic Impact | [Greetings from Earth!!](https://www.spaceappschallenge.org/2023/find-a-team/greetings-from-earth1/?tab=project) | Ocean Gardens |
| Best Mission Concept | [ASTROGENESIS](https://www.spaceappschallenge.org/2023/find-a-team/astrogenesis/?tab=project) | Planetary Tourism Office |
| Most Inspirational | [Space Quest Maidens - Donzelas da Missao Espacial](https://www.spaceappschallenge.org/2023/find-a-team/space-quest-maidens-donzelas-da-missao-espacial/?tab=project) | Eclipses: Perspective is Everything |
| Best Storytelling | [TeamVoyagers](https://www.spaceappschallenge.org/2023/find-a-team/team-voyagers/?tab=project) | Everything Starts with Water |
| Global Connection | [Arcobaleno](https://www.spaceappschallenge.org/2023/find-a-team/arcobaleno/?tab=project) | Immersed in the Sounds of Space |
| Art & Technology | [Oogway Comics](https://www.spaceappschallenge.org/2023/find-a-team/oogway-comics/?tab=project) | Habitable Exoplanets: Creating Worlds Beyond Our Own |
| Local Impact | [$quality_over_quantity](https://www.spaceappschallenge.org/2023/find-a-team/quality_over_quantity/?tab=project) | Explore a Biodiversity Hotspot with Imaging Spectroscopy |

## Projects worth studying closely

### 1. SpaceGenes+ — closest structural precedent for Flame

Officially the 2025 science winner. NASA lists one team member, Saloni T. The entrant's [live project introduction](https://spacegenes-plus.framer.website/) describes a GeneLab dashboard that compares stressor conditions, highlights selected genes in a heatmap, shows fold-change values and study identifiers, and supports PNG export. It identifies OSD-288/GLDS-288 as its live case and labels other examples conceptual. An upload/new-study workflow is explicitly a future feature. [Dashboard link](https://spacegenes-bj15.bolt.host/) was linked by the project; interaction was not tested in this research.

The author's [design case study](https://salonitangal.framer.website/spacegenes) identifies a 48-hour sprint and tools including GeneLab, Figma, Bolt.new, and GeminiAI. It describes researcher, drug-development, and mission-planning users, a central heatmap, a visible flag, and source identifiers available through interaction. These are useful design precedents. Its performance and scientific accuracy claims are author claims; this review did not reproduce the analysis.

**Reusable lesson (inference):** narrow the prototype to one reliable, inspectable scientific workflow. A credible small system that answers a real question is a strong benchmark. For Flame, replace gene heatmaps with a condition-aware evidence matrix: experiment, fuel/material, oxygen, pressure, airflow, gravity, finding, applicability, and source location. Make the distinction between “computed here,” “reported in source,” and “future feature” visible.

### 2. 42 QuakeHeroes — inspectable technical work

The team's [GitHub repository](https://github.com/gabrielchayb/42-quake-heroes) contains a Flask/HTML/CSS project and describes AI-based detection of lunar/Martian tremors, with energy efficiency as the mission benefit. The [published project site](https://gabrielchayb.github.io/42-quake-heroes/) is linked from that repository. The README's real-time and energy-saving claims should be treated as intended capabilities until demonstrated. This research confirmed the official technology award, but did not reproduce the model or verify model metrics.

**Reusable lesson (inference):** make the implementation inspectable and tie each technical choice to a mission constraint. For Flame, a deterministic extraction/ranking baseline, a small evaluation set, and a clear comparison to AI-assisted retrieval can demonstrate engineering value more convincingly than an untested “AI researcher” claim.

### 3. WaterWise — study the actual submission video

The [team-uploaded 2024 submission video](https://www.youtube.com/watch?v=Wg-gE3kYaas) is dated 6 October 2024 and identifies the project as WaterWise, later a Best Use of Data winner. The video is a useful artifact for studying how much a team showed in its competition submission. It was discovered but not transcribed or reviewed frame by frame here. Its official project entry is included in the 2024 roster.

**Reusable lesson (inference):** judge-facing proof has to fit a short demonstration. Design Flame's demo around one question, two relevant studies, one comparison, one cited answer, and one visible limitation.

### 4. PureFlow, Twisters/SkySense, and Astro Sweepers — follow-up study priorities

These official winners represent useful neighboring product shapes: a habitat-design system, a weather decision interface, and orbital risk/compliance tooling. Their NASA-linked project entries are in the roster above. Full project content could not be retrieved in this research, so implementation specifics and numerical performance are not asserted here.

**Reusable lessons (inferences):** prioritize decision usefulness, explain risk calculations, make an export useful to a specific user, and show a complete path from NASA data to the user's next action. For Flame, a downloadable evidence brief for a spacecraft safety researcher is a clearer output than a generic conversation transcript.

## Current 2026 public participant work: context, not past winners

[FLARENEXUS / Team Cosmic Nexus](https://github.com/KhalidHasan03/Flame-in-Freefall) identifies itself as a 2026 Flame project and describes a research platform with a Flame Lab, Mission Lab, assistant, insights, and record comparison. The repository explicitly says its experiment records, metrics, risk scores, flame rendering, charts, and assistant responses are synthetic demonstration material; no record represents a specific NASA document and no result is scientifically validated.

This is a single publicly discoverable repository, not a reliable inventory of competitors, team quality, or final submissions. Do not infer challenge popularity or final rankings from it. It is evidence that attractive dashboards and simulation-like controls are already an obvious solution shape.

**Quality requirements, not uniqueness claims (inference):** real NASA source-backed comparisons; an explicit domain-of-applicability panel; exact source passages; measurable retrieval accuracy; and a useful export. [MicroFire Atlas](https://microfire-atlas.vercel.app/) already describes these capabilities. Keep any illustrative flame animation separately labeled and do not allow it to imply a validated physics simulation.

## Competition lessons and how to operationalize them

These are interpretations of verified winner patterns, not official judging promises or causal analysis. Only winners were examined; a winners-only sample cannot establish success rates for technology choices, categories, countries, or team size.

| Observed pattern | Action for Flame | Proof to put in the submission |
|---|---|---|
| Research-access and interpretation interfaces can win. | Define one primary user: a researcher comparing spacecraft-relevant fire findings. | A before/after task: fragmented sources to a traceable comparison in minutes. |
| Multiple winners can address one challenge. | Choose for team fit and scientific feasibility, then build a distinct workflow. | Explicit explanation of the user need and what your tool adds. |
| Specialized data benefits from an accessible interface. | Make filters meaningful to the actual experiments. | Real filters on pressure, oxygen, fuel/material, flow, gravity, and outcome. |
| Scope can be small while the product story is clear. | Fully implement a modest corpus before adding modalities or broad integrations. | Complete, sourced evidence cards and working comparisons rather than empty panels. |
| Scientific and technical outputs coexist with arts and storytelling winners. | Assign narrative/visual design ownership alongside data/science ownership. | A plain-language explanation and an intelligible main chart. |
| Mission and local-impact concepts focus on consequences. | Explain the safety-research task being improved without claiming operational certification. | A realistic researcher scenario and a measured time/accuracy result. |

### Suggested award positioning for Flame

Read the current-year guide before treating these as final. Based on the [official 2024 award definitions](https://www.spaceappschallenge.org/nasa-space-apps-2024/awards/):

- **Best Use of Data** is a natural primary narrative if the main achievement is making NASA combustion results accessible and comparable.
- **Best Use of Science** is a strong secondary narrative if the data model, comparisons, uncertainty, and evaluation are scientifically defensible.
- **Best Use of Technology** requires an actual technical contribution and evidence of its benefit; adding a model API alone does not demonstrate innovation.
- **Best Mission Concept** could fit a coherent researcher/mission-planning workflow, but do not stretch the project into a purported flight-qualified safety system.
- **Art & Technology / Storytelling** become credible only if the scientific communication itself is an exceptional, intentional part of the result.

Do not assume teams choose an award lane or that a challenge maps to one award; verify current submission/judging rules with the main participation research.

## Archive sources for extending the historical review

These are official sources, separated from verified rosters above. A link in this list does not mean every project in that year has been audited.

- [2012 mission report](https://assets.spaceappschallenge.org/media/documents/SpaceApps2012_MissionReport.pdf)
- [2013 mission report](https://assets.spaceappschallenge.org/media/documents/SpaceApps2013_MissionReport.pdf)
- [2014 mission report](https://assets.spaceappschallenge.org/media/documents/SpaceApps2014_MissionReport.pdf)
- [2015 mission report](https://assets.spaceappschallenge.org/media/documents/SpaceApps2015_Mission_Report.pdf)
- [2016 mission-report index](https://2016.spaceappschallenge.org/mission-reports)
- [2017 final global standings](https://2017.spaceappschallenge.org/awards/global-finalists)
- [2018 awards, linking to global standings](https://2018.spaceappschallenge.org/awards/)
- [2019 awards](https://2019.spaceappschallenge.org/awards/)
- [2020 awards](https://2020.spaceappschallenge.org/awards/)
- [Special 2020 COVID-19 edition](https://covid19.spaceappschallenge.org/)
- [2021 winners profile](https://www.spaceappschallenge.org/blog/meet-the-2021-global-winners/)
- [2022 winners profile](https://www.spaceappschallenge.org/blog/2022-global-winners/)
- [2023 NASA official winners](https://science.nasa.gov/directorates/smd/2023-nasa-international-space-apps-challenge-announces-10-global-winners/)
- [2024 NASA official winners](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-international-space-apps-challenge-announces-2024-global-winners/)
- [2025 NASA official winners](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-announces-2025-international-space-apps-challenge-global-winners/)

Past celebration benefits are historical, not a guaranteed 2026 prize. NASA [reported a March 2023 gathering](https://www.nasa.gov/image-article/nasa-hosts-event-past-space-apps-challenge-winners/) for earlier winners, including NASA leaders, challenge authors, and subject experts. The [June 2024 celebration](https://www.spaceappschallenge.org/blog/the-nasa-space-apps-2024-winners-celebration/) recognized earlier annual and special-edition winners at NASA Headquarters and Goddard. Neither source establishes funded travel, cash prizes, internships, or a job for current participants.

## Explicit limitations and verification queue

1. All 30 2023–2025 award/team mappings were verified in NASA official announcements. NASA's linked project URLs were extracted through those links, but most project pages returned 502/timeouts or login-dependent content. The full code, pitch, and working demo of all 30 winners were not audited.
2. The 2026 Flame challenge has no verified past winner under this exact title. BurningSat is a historical thematic entry only. No claim that it won an award is supported.
3. Official year-specific wording, exact submission rules, and scientific resources must be reconciled with the authenticated 2026 page. Search index excerpts can lag live content.
4. The entrant's SpaceGenes+ scientific formula and condition labels were not independently validated. Study its interface and scoping, then develop Flame's own scientifically checked model.
5. Winner descriptions establish what was entered and recognized. They do not establish production deployment, user adoption, validated forecast accuracy, or flight readiness.
6. Do not derive numerical “chances of winning” from these examples. The numerator is winners; this research did not analyze all entries, judging scores, or team-level covariates.
