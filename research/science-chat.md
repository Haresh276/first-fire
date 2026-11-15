# Ask a quantitative question of the archive

Research chat can calculate counts, percentages, means, medians, extrema and ranges from FIRST FIRE’s 1,058 normalized observations. Results include the number of usable measurements, source tables and a downloadable calculation. It works in a public browser, on a local server and from the downloaded offline dashboard. [Open research chat](#chat)

## A worked comparison

Ask **“Compare mean burn duration for methanol and heptane in FLEX.”** The mean was **13.5104 seconds** for the 156 methanol rows with a duration and **7.9382 seconds** for the 112 heptane rows with a duration. One of the 157 methanol rows and five of the 117 heptane rows had no numerical duration. The experiment varied other conditions, so those averages alone cannot establish the effect of switching fuels. NASA flags some recorded durations as approximate. [Try the comparison](#chat?q=Compare%20mean%20burn%20duration%20for%20methanol%20and%20heptane%20in%20FLEX.) · [NASA FLEX original data](https://doi.org/10.60555/mbq8-0451)

To examine a subset, ask **“How many FLEX heptane rows have a reported burn duration?”** Then ask **“What about methanol?”** The second question changes the material and retains the investigation and its requirement for a reported duration. Download the calculation beneath the reply to inspect all 156 source row identifiers. The URL opens with an editable question. Press Send to run it.

| Research question | Result and interpretation |
| --- | --- |
| Which percentage of the FLEX rows lack absolute pressure? | “What fraction of FLEX observations have missing absolute pressure?” returns 1 of 274 rows, or 0.365%. The original log has a zero reading during an active burn. The normalized record excludes it from pressure calculations and preserves the reported source value. |
| How many inverse CFI-G records have burner oxygen above 50%? | “Count inverse CFI-G rows with recorded burner oxygen above 50%.” returns 80. The gas entered the burner. Asking for initial ambient oxygen above the same threshold finds zero eligible inverse rows in this archive. That zero describes the filter and its data coverage. |
| Can I compare a source observation with its unnormalized notes? | The calculator reads the normalized observation table. The Atlas also contains flow checks, repeated settings, notes and other row types. Choose the appropriate denominator before comparing counts. |

[CFI-G original tables](https://doi.org/10.60555/cyt1-kh64) · [Browse original source rows](#atlas)

## What a receipt contains

The parser produces a statistic, measurement, requested groups and typed filter predicates. A browser function selects rows satisfying all those conditions and performs arithmetic directly on the published numbers. A linked citation identifies the original NASA experimental table. The JSON download includes the parsed query, matched row IDs, missing-value counts, original row numbers, recorded input values and versioned table hashes. A percentage retains the qualifying count and its full denominator. Follow-up downloads replay the calculation with its earlier conversation context.

An unquoted short material name matches an exact normalized material label. For longer specimens, put the source label in double quotation marks. Ambient starting oxygen, final ambient oxygen and burner oxygen have distinct fields. A Saffire oxygen range or approximate condition can be preserved in its own field even when no initial scalar is available. Numeric filters convert recognized written units into the units of the normalized table. Summaries display pressure in psia, duration in seconds, diameter in millimeters and oxygen by volume in percent. A change of output units can be calculated from the downloadable numbers.

Each row contributes equal weight. A repeated observation, smoke preparation or paired burn can have a different scientific meaning from an independent physical experiment. These question types do not estimate causal effects, an operational risk probability or sampling uncertainty. Source rows whose requested measurement is missing contribute to the coverage count and are excluded from its numerical mean, median or range.

## Verification

The original 100-question chat benchmark measures a broader question set and includes local-transformer outputs. The archive calculator uses reproducible browser arithmetic when it recognizes a supported question. Five development test groups exercise composition, missing data, conversion, adversarial requests and follow-up scope. Browser tests checked the same questions on an HTTP server with an available model service and an offline file URL. Both produced matching source links, downloaded receipts and notebook events. [Original 100-question benchmark](#benchmark) · [Previous replay with the Referee](referee-replay.md)

An independent reviewer froze 40 new prompts and expected answers before the calculator was evaluated. The reviewer used the normalized CSV to establish reference values. **33 of 40 passed on the first attempt (82.5%)**. The calculator answered 24 of 31 answerable questions correctly and declined the other seven. All nine requests that required withholding a numerical answer passed. The seven missed questions included conversational phrasing about Teflon and experiment membership, “normal flame” and “inverse-flame,” and a threshold written as “one minute.” These are limitations in interpreting queries. The comparison used the frozen engine and measured its behavior directly. It does not measure whether a person using FIRST FIRE outperforms a person using ordinary search. [Independent evaluation and failure analysis](science-chat-audit.md) · [All 40 questions, expected results and recorded outputs](../dist/science-chat-holdout.json)

The revised public chat passed 40/40 on the exposed questions, then 22/24 on a new, separately sealed set. One failure widened a heptane follow-up to the full archive. The [benchmark notebook](#archive-audit) includes the actual displayed answers and expected values.
