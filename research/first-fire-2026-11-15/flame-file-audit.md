# Full-file coverage of the November 15 Flame in Freefall search

The six public GitHub searches returned 469 distinct repositories, including the team's own [FIRST FIRE repository](https://github.com/Haresh276/first-fire). This is a discovery set. A name, README or subject match does not establish that the repository belongs to an official entrant. The 2026 [challenge brief](https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/) defines the project scope.

Default-branch checks ran 2026-11-15 between 02:29 and 02:33 UTC. The audit enumerated 462 complete Git trees, found 7 empty default branches and recorded 0 unavailable trees. Relative to the earlier audit, 194 repositories remained at the same commit, 95 had changed and 173 supplied a commit that had no previous pin in that cache.

Across 67,097 tracked path occurrences, this pass read the entire contents of **54,819 eligible text paths**. These span 46,669 distinct verified Git blobs and 1,205,380,761 bytes counting repeated paths. Each scan verified the file length and recomputed its Git blob hash before searching its full decoded contents. The ledger records every tracked path in each available tree, its commit, blob or submodule object, size, status, file class and line locations of matching indicators. Repeated content shares a scan result by hash. No external project code was executed.

[Download the complete file ledger, compressed CSV](flame-repository-files.csv.gz) · [Per-repository revision, coverage and signals, CSV](flame-repository-coverage.csv)

## What other projects already demonstrate

Among the 468 external search matches, 461 yielded readable text and 437 had a program, notebook or web-markup/style path. The counts below use those 437 repositories as the population. A matching string can occur in a comment, quoted study, test, placeholder, generated code that escaped the filter, or notebook output. Team submissions and scientific claims were not verified by this scan.

| Evidence present in a program, notebook or web file | External repositories |
| --- | ---: |
| NASA PSI identifiers, the repository hostname or a PSI DOI prefix | 335 |
| Named experimental input or outcome fields | 276 |
| Row, page, source-file, citation or evidence identifier fields | 184 |
| Named uncertainty, abstention or out-of-domain methods | 65 |
| Named evaluation metrics or splitting methods | 73 |
| Named group-aware split implementation | 41 |
| Test/spec path containing a recognized assertion | 246 |

**A target-specific holdout is worth showing.** IGNIS Lab's FLEX evaluation excludes an entire campaign, then removes from training every condition also present in that campaign. Project-99 groups runs by FLEX identifier, asserts that train and test groups are disjoint, then evaluates a training-mean baseline and two learned alternatives. These choices answer different generalization questions. FIRST FIRE can identify whether a claim applies to a new record, new date, new campaign or new material, and disclose which test actually supports it. For today's demonstration, changing its existing same-day FLEX filter and showing the surviving source IDs gives the judge a direct test. [IGNIS Lab campaign-split implementation](https://github.com/WingManOO7/ignis-lab/blob/95e601c1c8f1433cfb1722a95345360b32b373fd/scripts/experiments/model_search.py#L181-L196) · [Project-99 baseline and group-overlap assertion](https://github.com/Abdoullah27/Project-99/blob/e685f8735498f09ba89382a6dbe54fbb240ddc62/src/flame_intelligence/evaluation/flex_baselines.py#L13-L39)

**Publish both the comparison target and the baseline.** Ignis Core's FLEX card records the target unit, training table and condition grouping, alongside condition-held-out and date-held-out errors and a mean predictor. A FIRST FIRE sensor evaluation could likewise give each run ID, its error units, error against the fitted one-zone baseline and cohort size, then say whether the proposed method improved that particular held-out run. The archived terrestrial repeat-time comparison already documents a tie. Showing that tie and the unanswered spacecraft-transfer question gives a reader a defensible reason to collect an independent cabin trace. [Ignis Core model card](https://github.com/ankathakanksha21/ignis-core/blob/04ec8870df1971d20cb1f1bb971371e65515f022/ml/src/ignis_ml/models/flex_burning_rate.py#L272-L306) · [FIRST FIRE science and limitations](../../research/advanced-methods.md)

**A timed pilot would add different evidence from the existing benchmark.** FireWise proposes that two or three people locate helium FLEX tests, compare BASS with Saffire-III, and navigate by keyboard. Its table gives targets. CombustionLens publishes a second-pass agreement table recording zero checked rows and a pending human dataset. FIRST FIRE can show stronger evidence by running its existing masked protocol on fresh questions, publishing completed participant counts, errors and times for each method, and leaving a planned pilot labeled as planned if nobody completes it. [FireWise task targets](https://github.com/Ahmedvini/firewise/blob/1ae89b635bac25540d3910e5d54fa1711e19a1cc/docs/RISKS_AND_VALIDATION.md#L57-L64) · [CombustionLens assessor status](https://github.com/Dharaneeshsl/Nasa-Space-Apps-Challenge/blob/ad70ed4a5a1fdbb0bd5de401569861bdcde53665/eval/results.md#L48-L52) · [FIRST FIRE study protocol](../../research/evaluation.md)

## What was read and excluded

| Completed text class | Tracked paths |
| --- | ---: |
| program_or_notebook | 24,794 |
| text_data | 10,871 |
| other_text | 9,277 |
| documentation | 6,317 |
| configuration | 1,888 |
| web_markup_or_style | 1,672 |

| Coverage status | Tracked paths |
| --- | ---: |
| complete_text_scan | 54,819 |
| binary_media_document_or_model | 9,299 |
| binary_content | 965 |
| generated_or_vendor_directory | 551 |
| generated_or_lockfile | 313 |
| credential_file_pattern | 257 |
| binary_or_generated | 254 |
| generated_vendor_or_binary_pattern | 224 |
| data_over_2_MiB | 217 |
| non_utf_text_or_binary | 127 |
| dependencies_or_cache | 62 |
| symlink | 8 |
| over_size_cap | 1 |

Data-like text (CSV, JSON, XML, SVG and related formats) had a 2 MiB cap, notebooks a 32 MiB cap and remaining eligible text an 8 MiB cap. The scan excluded known dependency, cache and build directories, credential-pattern paths, minified bundles, locks, native binaries, media, office/PDF containers, trained weights, archives, large data files, symlinks and submodule contents. It screened UTF-8 and marked UTF-16 files. Missing, nontext and excluded files retain their path-level status. Some mixed-format directories or copied/generated code can evade path rules. The archive covers public, keyword-discovered default-branch snapshots. Private work, alternate branches, differently named projects and changes after those snapshots lie outside its coverage.

To check any entry, open the repository at its recorded revision, select its exact path, and download the raw bytes. Running `git hash-object <file>` on that download should produce the ledger’s `git_object`. Filter the file ledger by repository and `complete_text_scan` to identify which paths were examined end to end.

The indicator search also traversed documentation and data files. The narrower comparison above uses only program/notebook or web files. Broad reference signals include PSI accession numbers, PSI host/DOI strings and common locator names such as `source_row` and `citation_id`. Group-split indicators recognize the names `GroupKFold`, `StratifiedGroupKFold`, `GroupShuffleSplit` and `LeaveOneGroupOut`. The test indicator requires a test-like path and assertion syntax in the same source or web file. Absence of these English names can miss valid implementations. A static match does not establish that an evaluation ran, succeeded or predicts spacecraft performance.
