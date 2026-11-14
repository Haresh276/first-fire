# Research chat after evidence checks

The saved Qwen responses from FIRST FIRE v2.1 were replayed through the browser gate and FM² calculator with the default reading level. The original model received the frozen dialogue histories. Each replay consumed the current question and its archived response. The original scoring code assessed the displayed answer and citations. No new retrieval or language-model inference was timed in this run.

The original run passed 78/100 on the full rubric. After checking and displaying the evidence, 77/100 passed. These questions were used during development. A replay exposed off-target answers about FLEX droplet size and imaging, and developers corrected them before recording these results. Performance on new questions and against ordinary search requires separate testing.

## What passed

The rubric scored required content and absence of contradictions on 100 answers (80 passed), expected answer behavior on 100 (99 passed), and citation coverage on 92 (81 passed). A strict pass requires every applicable check. The published rubric accepts limited responses for some questions.

## What the reader receives


| Group | Strict passes | Questions |
|---|---:|---:|
| Attributed archival note | 67 | 84 |
| Independent review passed | 3 | 4 |
| Verified quotation only | 1 | 1 |
| FM² model calculation | 1 | 1 |
| Abstention | 5 | 10 |


An attributed note reproduces a stored research note or normalized row. A source locator lets a reader inspect it. A checked interpretation also has a matched quotation, an independent judgment for that exact claim, and any applicable quantitative checks. A quotation-only reply supplies authenticated words when the proposed interpretation could not clear every check. An abstention withholds an unsupported answer.

## Scores by question difficulty


| Group | Strict passes | Questions |
|---|---:|---:|
| beginner | 19 | 20 |
| intermediate | 20 | 20 |
| advanced | 14 | 20 |
| complex | 11 | 20 |
| challenge | 13 | 20 |


## An answer-level failure

Question Q002 asks which LUCI fabric flame lasted longer. The checked sentence reports that extinction came earlier at Earth gravity. It preserves the meaning of the record, but the frozen content check expects the words “longer” or “later” with “lunar” or “partial”. Q090 asks for an invented material-level count. The gate withholds the figure. The rubric also requires a source-backed contrast, so the uncited abstention misses that item. These answer-level scores measure wording, coverage and behavior together.

## Reproduce the replay

Build the release with `python3 scripts/build.py`, then run `node scripts/replay_referee.cjs`. The per-question output includes displayed text, sources, individual scoring results, and SHA-256 fingerprints of the frozen inputs, scoring code and gate.

[Download all 100 replayed answers and scores](referee-replay.json)
