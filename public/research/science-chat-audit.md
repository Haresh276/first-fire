# Testing the archive calculator and the public chat

[Inspect the questions and answers in the benchmark notebook](#archive-audit).

A contributor evaluating the calculator separately from its implementer sealed 40 prompts and expected outputs before evaluating this edition. On the first run, **33/40 (82.5%) passed**. This is a project-run test of the supported archive questions. It is neither an external certification nor a human comparison with search.

| Task | Passed | What the check required |
| --- | ---: | --- |
| Answerable questions | 24/31 | Reproduce the CSV reference value, unit and count and return a source locator; for the grouped question, return both fuel groups and their values. |
| Questions requiring a withheld value | 9/9 | Do not compute a result for an unsupported inference, absent outcome or invented premise. Declining to handle the query also counts at the calculator boundary. |
| All | 33/40 | Each question counts once. No partial credit. |

The reference values came from an independent read of the frozen normalized NASA table. The prompts include counts, grouped comparisons, unit conversion and follow-ups that narrow a previous question. Reproduce the run with `python3 scripts/build.py` and `node scripts/evaluate_science_chat.cjs`. The output JSON records the prompt, any prior turn, expected and actual results, source identifiers, pass flag and input hashes. The calculator and its 40-question inputs have separate SHA-256 fingerprints in that file.

## Where it declined an answerable question

| IDs | Request | What the data contain |
| --- | --- | --- |
| S04, S06, S07 | Membership phrased as “belong to,” “does PSI-69 contain,” or “records use Teflon” | 109 SAME-R records, 117 FLEX heptane rows, 18 SAME-R Teflon rows. |
| S09, S10 | Counts for inverse and normal flames in CFI-G | 154 inverse and 179 normal records. |
| S27, S28 | FLEX durations above one minute; methanol droplets above 4 mm | Zero durations above the time limit; ten rows above the diameter limit. |

These seven were refusals, not incorrect numerical values. A correct zero is scientifically different from an unrecognized filter. Do not treat a refusal as zero observations. This exposed set is now suitable for regression tests; gains on it would need an additional unseen question set to establish generalization.

## What a judge actually saw

We entered the same prompts in the public-mode interface in an offline Chrome browser, starting a fresh conversation for each item and sending its stipulated follow-up when present. On 38 of 40 items the displayed answer came from the calculator and matched its recorded answer. Two were handled by ordinary chat. S37 correctly declined to invent a result. S36 returned a description of the planned lunar burns rather than explaining why an observed success fraction could not be calculated. No lunar success was asserted, but the answer did not resolve the question. Applying the stricter requirement that the visible response answer or explicitly abstain gives **32/40** for this first interface replay. The browser transcript preserves that original failure.

After this replay, the chat was changed to explain that the four burns have zero documented outcomes in this release, so an observed success fraction is undefined. The original replay and score above are preserved. The corrected behavior is a regression check on an exposed issue.

The earlier 100-question and 24-question evaluations cover different questions and a model-backed service. Do not add those scores to this one. None measures how quickly or correctly researchers using FIRST FIRE reach decisions compared with researchers using ordinary search.

[All 40 calculator results](../science-chat-holdout.json) · [First browser replay: exact displayed answers](../science-chat-browser-audit.json) · [Original chat benchmark](#benchmark) · [Study protocol](evaluation.md)

## A second test after repairing the chat interface

The updated interface passed all 40 exposed questions, including the seven missed phrasings and the lunar-outcome question. A second evaluator sealed 24 additional questions with reference values computed from the CSV. The revised interface passed **22/24 (91.7%)** on its first attempt. That included all eight requests involving unsupported entities, units, conditions or inference and both requests about observed FM² outcomes. It answered 12 of 14 archive calculation questions correctly. The sample focuses on the revised question handling.

- **A01** asked how many records belong to the FLEX study. The extra word “study” led to a refusal. The archive contains 274 FLEX observations.
- **A14** first requested the count of heptane records in FLEX, then asked how many of those had a reported burn duration. The answer broadened the selection to the full archive and returned 604. The correct answer is 112. The cited rows did exist, which makes checking the selection just as important as checking the source.

The new prompts, reasons for failure and original displayed replies are available in the [benchmark notebook](#archive-audit). [40-question replay](../science-chat-regression.json) · [First attempt on the new 24](../science-chat-acceptance.json)

The release now resolves follow-up references against the rows returned in the preceding answer. It asks for the study or group when the reference cannot be resolved. It also recognizes “the FLEX study.” Replaying the same questions produced **24/24**, including 274 FLEX records for A01 and 112 heptane runs with burn durations for A14. The first-attempt result remains 22/24. [Release replay and displayed answers](../science-chat-acceptance-replay.json)
