# How FIRST FIRE checks a chat answer

## Follow a question through the system

1. In Research chat, ask **“Compare FLEX-155 versus FLEX-120.”** The intent router identifies two stable record IDs, loads the NASA observation table and compares its normalized fields. The answer distinguishes matching entries, differences and unreported values. Open either citation to see the NASA table, CSV row, investigation DOI and source-file fingerprint.
2. Ask **“Compare CFI-G 21088A1 with CFI-G 21202.”** The second label lacks a unique run suffix. Chat asks for two distinct identifiers before calculating a difference. Use **Not what I meant** to change the tool and rerun the original question.
3. Ask **“Rank liquid records for a lunar habitat at 34% oxygen and 8.2 psia.”** Compass receives the phase, gravity, oxygen and pressure together. Its receipt identifies the actual row that matched. An envelope constructed from different tests cannot satisfy a joint match.
4. Ask **“What if cellulose burns in a 12 m³ sealed cabin?”** The Physics lab receives the supplied fuel and volume, and requests the other scenario inputs. A completed run replays the same mass-balance equations. Its outputs describe an assumed cabin and model coefficients. They cannot establish a lunar material limit or certify a vehicle.

Ten labels cover single records, pair comparisons, Compass, Rulebook, FM², cabin physics, mission history, claim checking, archive arithmetic and insufficient evidence. Browsers use the same gate for local service completions, offline evidence, calculations and reader-assisted selections. Opening a tool carries explicit available fields. Each reply exposes its effective intent and offers manual correction.

## What the proof means

- **Source.** An issued research claim is bound to a publisher page or section, a quoted passage, or a structured source row. Curated narrative bindings include the original document digest, locator, quote and exact proposed claim. The release builder finds the quote in normalized source text before collecting an independent review. Chat checks the binding when it displays the answer. The report link and SHA identify the archived revision. Normalization accommodates PDF text extraction, spacing and line breaks.
- **Interpretation.** An independently run local Gemma 3 1B model checked 32 additional facets against eight original publisher documents. It supported 22, contradicted nine and marked one insufficient. Unapproved interpretations can fall back to verified original wording when its quantities qualify. These machine judgments can err. The ten NASA mission-history excerpts follow a narrower path that returns original wording with a source.
- **Quantity.** Archive calculations replay the operation and check scoped row membership, denominators, missing values and units. A structured record or case-specific quantity must come from the bound field. Registered conversions include FLEX gas fractions and LUCI spread-rate cells. FM² recomputes the specified distribution or reads the signed register. Historical dates and IDs identify evidence and carry no measurement claim.
- **Scope.** The check distinguishes empirical results, team proposals, registered predictions, model projections and unavailable outcomes. A registered lunar forecast can yield a model probability even though the observed fraction of successful lunar burns is undefined in this release. Missing evidence can leave the reply unscored.
- **Disclosure and corrections.** Open the citation for the locator, original, hash where available, applicable checks and a copyable citation. Some links have only a source locator. The Referee’s public error history contains release examples and retains superseded entries. The “Report an error” action opens a draft containing the release and check categories. The visitor chooses whether to publish the draft and what to add. The ordinary chat transcript is tab-local.

The evidence score multiplies a difficulty base, the applicable interpretation factor and the number of gravity, oxygen and pressure fields matched. The environmental factor is 0.35, 0.55, 0.75 or 1 for zero through three matches. A failed quantity or unsupported scope suppresses the score. The interface shows the factors and reasons. A low score commonly reflects lack of environmental matching even for correctly quoted history.

## Measured release behavior

| Evaluation | First or historical result | Current result | What was scored |
| --- | --- | --- | --- |
| Independently labeled ten-way routing, first 60 | 51/60 | 60/60 after inspecting the nine errors | Intended destination only. The replay used exposed questions. |
| Second independently written routing suite, 60 | 51/60 on the then-frozen router | 60/60 on the current router after exposure | New wording initially fell below the 54/60 target. |
| Third independently written routing suite, 60 | 50/60 using the previous router | **54/60 on the frozen new candidate**, its first use of these questions | The candidate met the 54/60 routing threshold on this set. Six intents still failed. |
| Legacy 100 open-ended research questions | 78/100 | 43/100 after gating | Recorded local Qwen proposals, same strict content, citation and scope rubric. |
| Legacy 24-question open-ended follow-up | 14/24 | 14/24 after gating | Historical follow-up proposals rescored for the wording actually returned by the gate. |
| Separate quantitative archive suites | 33/40 original calculator, 22/24 first acceptance UI | 40/40 and 24/24 release browser replays | Visible answer, source, numerical result, denominator or correct withholding. Both suites had been exposed before release. |

The first implementation of the stronger prose gate passed 18/100 and 4/24. It frequently withheld answerable, source-backed prose or offered one generic excerpt. The release added checked source facets, direct NASA mission extracts and deterministic field reads. Even after these changes, the development answers included 27 withheld replies and 27 quote-only replies. A source-backed passage can still miss the actual question. The original 100 and 24 rows preserve both the historic proposed answer and the gated text. The current result above is a replay of saved model proposals through today's gate, without a new model inference.

**Calibration missed the acceptance target.** On the separate legacy 24, the 14 low-scored replies averaged 0.267 and 10 passed the strict rubric. The single medium reply scored 0.55 and passed. Nine replies had no score, including three appropriate abstentions. Refitting one logistic intercept on the 100 development outcomes also missed the ten-percentage-point tolerance on the 24. For the refitted medium group, five of six passed against a 0.646 mean. For the low group, six of nine passed against a 0.458 mean. Treat the factors as an explanation of evidence coverage. They do not establish the probability that a scientific answer is correct.

[Recorded 124-answer calibration](../dist/evidence-calibration.json) · [First routing score](../dist/master-route-first.json) · [Exposed routing replay](../dist/master-route-replay.json) · [Second independent routing score](../dist/master-route-generalization.json) · [Third independent routing score](../dist/master-route-third.json) · [40 archive questions](../dist/master-science-40.json) · [24 archive questions](../dist/master-science-24.json)

### What people saw when the route was wrong

For each of the nine first-bank errors, nine second-bank errors and six third-bank errors, a signed-out Chromium browser opened a new chat and submitted the exact original question. The old bank used its SHA-verified original classifier. The second bank used its SHA-verified previous release classifier. The third bank used the exact promoted candidate. All three ran the current downstream evidence gate and offline evidence. A reviewer read all 24 rendered replies. A numerical measurement, comparison, estimate, probability or simulation result counted as a quantitative assertion. Citation markers, question examples and a correctly identified specimen number did not.

**Zero of these 24 replies supplied a quantitative result.** Twenty withheld the answer or asked for clarification. Four delivered off-task qualitative content. In I09 chat suggested a detector test instead of comparing the two specified runs. I47 returned the observed Nomex result without checking the submitted quotation. B11 described the Saffire specimen without comparing BASS-II. B12 quoted cool-flame behavior without comparing fields in the two FLEX runs. All six third-bank misses withheld the requested finding or asked for clarification, including a CFI-G comparison that incorrectly requested an exact quotation. These observations cover this finite set of routing failures and the specific signed-out browser path.

[First two sets, 18 replies and fingerprints](../dist/master-route-error-answers.json) · [Third set, six replies and fingerprints](../dist/master-route-third-answers.json)

## Reproduce

Run from the repository root after building the site. The review-generation step takes locally downloaded source files and an installed matching Ollama Gemma digest. Reproducing published scores and inspecting the installed evidence require neither an API key nor a model download.

```sh
node --test tests/evidence-desk.test.cjs tests/referee-deck.test.cjs tests/science-chat.test.cjs tests/compass-coverage.test.cjs
node scripts/calibrate_evidence.cjs
node tests/master_evidence_browser.cjs
node scripts/replay_master_route_errors.cjs
node scripts/replay_master_route_errors.cjs --third
```

Chrome and Playwright are required for browser tests. Set `CHROMIUM_EXECUTABLE` when Chrome is installed in a different directory. Set `FIRST_FIRE_QA_DIST` to test an alternate built bundle. The two previous classifiers are preserved in `tests/chat/snapshots/intent-v1.js.gz` and `intent-v2.js.gz`. Each transcript run checks the classifier fingerprint against its original scored bank.
