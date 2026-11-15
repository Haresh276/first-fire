# FIRST FIRE chat: 100 questions on local transformers

A real local instruction model selects zero to three indexed passages; the server validates the selections and attaches the stored text and source locators. The scientific answer text is extractive. The model is not asked to invent an explanation, simulate an experiment, or remember NASA figures from training. The comparison below isolates two questions: does the archive help the same small model, and does generator choice matter with the same archive?

## Retest after the Apollo 1 correction (version 2.1)

The local chat again passed **78 of 100** full-rubric checks and **14 of 24** on the separate suite. All 124 requests completed; the same individual questions passed and failed as in version 2.0. The benchmark page shows the actual version 2.1 answers. The frozen questions do not cover the Apollo 1 accident, so these scores describe performance on the research collection and do not measure the incident fix.

Separate browser regressions exercised the reported Apollo question and its NASA citations, the ignition and crew follow-ups, an explicit switch to Apollo 13, and a request about the unindexed Mir fire. They also verified that Retry preserves the earlier answer in History and that these interactions work online with the local service and offline from the downloaded files. The source project contains both new runs under `research/chat-runs/incident-v21` and `research/chat-runs/holdout-v21`.

## Recorded result for version 2.0

**The revised local Qwen chat passed 78/100 strict checks on the original suite, versus 74/100 before the fix. On a fresh 24-question test it passed 14/24, versus 12/24 for the original system.** The second test is the stronger indicator of how the changes transfer. Neither result warrants relying on the model for unreviewed scientific conclusions.

| Strict passes, evaluated version | Beginner | Intermediate | Advanced | Complex | Challenge |
| --- | ---: | ---: | ---: | ---: | ---: |
| Revised Qwen, out of 20 per band | 20 | 20 | 14 | 13 | 11 |

On the original 100, v2 passed **84/100** content checks, returned all required citation groups with locators on **83/92**, and retrieved all expected sources in the top three on **85/92**. It passed seven of nine fixed-history questions. Median latency was 0.40 seconds (95th percentile 0.67 seconds) in this run, including the eight questions handled by guards instead of generative selection. On 92 turns the local transformer selected evidence. Runs overlapped in time and differed in guard frequency; do not infer a speedup from these numbers.

**What changed:** the new version checks the topic, missing data, proposed spaceflight results and safety/measurement requests before accepting model selections. It can qualify a partially covered comparison. It retries malformed selections once and withholds an answer if parsing still fails. The corpus and retriever stayed the same. It no longer offers a combustion paper as the answer to Q097’s hockey question; on Q100 it now declines the missing trace, though its refusal is generic. Handling of the deliberately unanswerable items improved from 1/12 to 8/12 at the disposition stage, with only 5/12 passing the *entire* rubric. Citation coverage fell by one item. This is a retest after builders learned about the original failure categories.

### Independent check on new questions

Another evaluator froze 24 new prompts (8 direct, 8 scope/comparison, 8 intentionally unanswerable), kept them out of the builders’ hands, and ran both frozen versions. Suite fingerprint: `e81b031beeea8b196b20efbbb5d549200e744a101cd3337f2556d7d27f372bd6`. These are new prompts over the same case material, not a new scientific domain.

| Full-rubric passes | Original Qwen | Revised Qwen |
| --- | ---: | ---: |
| Direct answers (8) | 8 | 7 |
| Scope/comparison (8) | 4 | 4 |
| Intentionally unanswerable (8) | 0 | 3 |
| **All 24** | **12** | **14** |

Both versions passed content checks on 17/24. V2 corrected three full-rubric failures but lost one previously correct archive-count answer to an unnecessary refusal. It returned every expected citation group on 13/17 (v1: 14/17) and marked only 4/8 unknowns limited or abstained. One residual failure involved a nonexistent material approval; others involved a supposed audio attachment and an incomplete cross-case answer. A citation can point to a real passage without answering the question. Read it and check that it applies. The full project contains the unedited questions, responses and score sheets for both versions.

## First runs, before error-driven changes

The first 100-question suite and rubric were frozen **before the engine saw them** (SHA-256 `de7d1c8f0bd722f59475a3c30785929ef9e6b060e94c657e5edd44a214dd4afd`). A separate evaluator authored the questions using the public material; the engine was not trained on their answers. Context for nine follow-ups was fixed equally for every model. Of 100 questions, 62 asked for direct answers, 26 called for an evidence boundary, and 12 deliberately asked for something unanswerable or tried to induce an unsupported claim. This is a local software benchmark, not a human blind study.

| System | Full rubric /100 | Content /100 | Required citations /92 | All expected sources in first 3 /92 | Median · p95 latency |
| --- | ---: | ---: | ---: | ---: | --- |
| Closed-book Qwen3 0.6B | 5 | 10 | Not available | Not available | 0.21 · 0.43 s (99 valid returns) |
| BGE + source selection, Gemma 3 1B | 46 | 63 | 69 | 85 | 0.76 · 0.90 s |
| BGE + source selection, Qwen3 0.6B | **74** | **82** | **84** | **85** | 0.69 · 0.84 s |

The bare model received the same prompts and previous turns, no archive, and a schema for an answer and status. One result could not be parsed; it counted as a failure. It had no mechanism to emit registered source cards, so **content** is the meaningful comparison to the grounded system (10 to 82). That improvement measures the combined retrieval, curation, rendering and model policy. With identical retrieval, grounded Qwen beat grounded Gemma by 28 full-rubric answers. Both grounded trials completed all 100 HTTP requests; simultaneous local inference makes the wall-clock times indicative, not isolated hardware benchmarks.

| Difficulty (20 each) | Closed-book Qwen | Grounded Gemma | Grounded Qwen |
| --- | ---: | ---: | ---: |
| Beginner | 0 | 14 | 20 |
| Intermediate | 0 | 11 | 20 |
| Advanced | 0 | 7 | 14 |
| Complex | 0 | 7 | 13 |
| Challenge | 5 | 7 | 7 |

These are full-rubric counts. “Challenge” combines context turns and deliberately unanswerable/hostile prompts; an evidence-backed refusal can earn full credit. The closed-book system scoring zero across several bands also reflects the required citations. The grounded Qwen system passed six of nine fixed-history follow-ups. Its gate accepted the appropriate handling on only **one of twelve** deliberately unanswerable items.

## What broke

- **Unrelated words looked relevant.** On Q097, a question about scoring an ice-hockey goal retrieved the FM² forecast’s scoring convention. Qwen labelled a sourced combustion paragraph “answered.” A link to real NASA work did not answer the question.
- **An absent input became a reason to quote something else.** Q100 requested the time of a temperature spike in a trace nobody supplied. The engine returned a FLEX passage about missing imaging. It did not fabricate a timestamp, but it still presented an unrelated answer.
- **Retrieving one case was easier than answering both sides of a comparison.** Qwen missed information on multi-case Q067, Q076 and Q077. The same retriever surfaced at least one target in the first three on 89/92 source-bearing prompts, but all required sources on 85/92. Citation presence was checked independently of retrieval; neither metric guarantees a useful conclusion.
- **Conversation worked on some ordinary corrections.** On Q026, asking what Saffire-II’s 140 seconds timed produced the assembly duration, named the burning PMMA, and preserved the narrower observation about Nomex. This is the practical difference between retrieving the right experiment and answering the right research question.

## How scores are computed

For direct or boundary questions, the frozen status rule accepts either “answered” or “limited”; for intentionally unanswerable questions it accepts “limited” or “abstained.” Thus the disposition column is a permissive check, not an assessment that the prose actually communicates uncertainty. The strict count requires all prewritten content checks, no flagged contradiction, an allowed disposition and every required source group at a recognized URL and locator. Eight cases require no citation and are excluded from that denominator. Content-only removes source and status requirements. The retrieval metric uses the raw ranked source trace from before the selector. A guard can abstain before calling the generator: in Qwen's first run the model selected passages on 99 questions and the instruction guard handled one. Record IDs, full outputs, status, citation locators, timings and scores are in each run directory.

Automated scoring is approximate. The frozen reference prose itself matches all of its wording checks on **88/100** items; some concise references omit a detail the rubric requires or use a pronoun or equivalent wording. Thus a failure can be lexical, and a pass can hide an irrelevant passage or extra unsupported claim. Do not interpret 74 as 74 expert-verified scientific answers. The suite is public now: any subsequent retest estimates regression behavior, not fresh generalization. The human comparison with ordinary search is a separate, unrun experiment. In an independent AI-assisted reading of every fifth first-run Qwen answer (20 in total), the reader judged 17 adequate, one partial and two irrelevant. The automated content check passed two undeserving answers and failed one adequate paraphrase in this sample. On the same 20 revised answers the reader found 17 adequate and three partial; the two irrelevant answers became generic declines. This is an audit of the scorer, not human adjudication.

## Reproduce or inspect

In the distribution, `tests/chat/questions.json` holds every input, fixed history and reference; `scripts/benchmark_chat.py` implements the frozen scorer. `research/chat-runs/` contains all model responses, health records and score tables. See the project README for startup. Run `python3 scripts/benchmark_chat.py --url http://127.0.0.1:8765/api/chat --out /tmp/first-fire-new-run` against a running local server. Use a fresh output directory. For the closed-book control run `python3 scripts/model_trials/bare_chat.py --model qwen3:0.6b --out /tmp/first-fire-closed.jsonl` before passing it to the scorer with `--responses`. No paid API is involved.
