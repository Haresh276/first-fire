# How the repair transferred to fresh questions

The second local Qwen system passed 14 of 24 questions on an undisclosed follow-up. The original system passed 12. The two versions returned the same 17 content passes. Three questions newly met the full rubric and one newly failed. The other twenty kept their original strict result. All requests completed successfully.

| Frozen criterion | Original system | Revised system |
|---|---:|---:|
| Full rubric, all questions | 12/24 | 14/24 |
| Answer content | 17/24 | 17/24 |
| Required sources with locators | 14/17 | 13/17 |
| Appropriate declared behavior | 16/24 | 19/24 |
| Any target document in first three candidates | 16/17 | 16/17 |
| Full rubric on eight ordinary answerable questions | 8/8 | 7/8 |
| Full rubric on eight scope/comparison questions | 4/8 | 4/8 |
| Full rubric on eight intentionally unavailable or inappropriate requests | 0/8 | 3/8 |
| Correctly bounded/abstained status on those eight requests | 0/8 | 4/8 |

The repair newly declined a missing calibration sheet (H05), a request for a model-service credential (H14) and a temperature measurement for an unseen panel (H18). It also declined a legitimate question about why the project has twenty source files and nineteen investigations (H16). On H24 it flagged the response as limited but quoted unrelated droplet evidence instead of identifying the missing information for the proposed angled fixture.

The revised system still returned combustion passages for a fabricated approval document (H03) and a supposed audio recording (H17). H06 asked why a burner-stream oxygen value and an FM² chamber value need different labels. Its answer covered the inverse gas experiment and omitted the planned lunar chamber setting. H22 illustrates the limit of automatic marking as well: answering with “shared-threshold model” conveys a connection, while the rubric additionally seeks an explicit statement about dependent predictions.

Eight questions requested unavailable information, so each one changes that subset’s result by 12.5 percentage points. The developer knew which broad problems the original 100 questions had exposed. A separate author withheld this follow-up from the developer and froze its texts and grading rules before either version answered it. These are targeted checks against the same corpus, written by an evaluator familiar with it. Both servers used the same model weights and corpus. The follow-up ran alongside another evaluation on the same device, so the recorded latencies should not be compared as a controlled speed test.

The raw responses, ranked candidates, references and every scoring decision are available for the [original system](holdout-v1-qwen/results.json) and [revised system](holdout-v2-qwen/results.json). The [frozen follow-up questions](../../tests/chat/holdout.json) have SHA-256 `e81b031beeea8b196b20efbbb5d549200e744a101cd3337f2556d7d27f372bd6`.
