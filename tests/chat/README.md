# FIRST FIRE chat evaluation

The suite contains 100 distinct prompts in five 20-question bands. An evaluator who could see the existing case materials wrote the prompts, human-readable reference answers, source groups, numerical checks, alternative phrasing and contradiction rules before accessing any chat responses. Developers received the suite hash before the models were evaluated. This is an authored regression benchmark with public scientific cases.

| Band | What it tests |
| --- | --- |
| Beginner | Recognizing a sample, finding a basic observation, reading a number. |
| Intermediate | Keeping the correct material, sensor, unit and experimental compartment attached to a result. |
| Advanced | Explaining an inference, selecting a measurement and recognizing an unsupported transfer. |
| Complex | Integrating more than one result or paper, distinguishing a measurement from an extrapolation and proposing controls. |
| Challenge | Eight fixed-history follow-ups followed by twelve intentionally unanswerable or hostile prompts. One unanswerable prompt also has history. |

The suite has 62 direct questions, 26 where the strongest answer must describe an evidence boundary, and 12 requests where the requested factual result is unavailable or disclosure is inappropriate. Prompt Q088 says “independent teaching distribution” to distinguish the guide's assumed distribution from NASA’s qualitative expectation. The four burn probabilities share a single uncertain threshold.

## Run the comparison

From the project directory, start the local chat server, then run the frozen suite against its normal POST endpoint. Questions are submitted sequentially. The client sends only the question and its history. There are nine fixed history fixtures, each of which contains an earlier user message and a short, authored assistant turn. The current user question is the only scored turn. This design tests reference resolution and topic switches with controlled context. A later turn does not inherit a tested model’s earlier errors.

```sh
python3 scripts/benchmark_chat.py --url http://127.0.0.1:8765/api/chat --out /tmp/first-fire-chat-run
```

Each returned response is appended to responses.jsonl. Lost connections and other errors count as failed answers. An interrupted local run can be resumed with the same URL, suite and output directory by adding `--resume`. Preserve the server version, provider, model file or digest, decoding settings, retrieval settings, service versions and machine details with the result. The client’s resume guard checks the URL and suite hash. The operator must also ensure the serving model and corpus stayed identical.

A saved response file can be scored independently.

```sh
python3 scripts/benchmark_chat.py --responses path/to/answers.jsonl --out /tmp/first-fire-chat-scores
```

The saved format has exactly one line per frozen question, with an ID, a response object and optional latency_ms. Include an explicit error and an empty response object for failed requests. An answer from an independent model can be scored for content even when it has no retrieval trace. A missing trace is omitted from retrieval denominators.

```json
{"id":"Q001","response":{"answer":"…","status":"answered","citations":[{"id":"…","title":"…","url":"…","locator":"…"}],"retrieved":[{"id":"…","title":"…","url":"…","locator":"…"}]},"latency_ms":123}
```

Each output directory includes the machine-readable summary and raw question, response, evidence, answer reference, failed expression and grading decisions in results.json. The CSV is suitable for review in a spreadsheet. History and reported latencies are retained. The checker reads source URLs locally from the recorded response. It never fetches URLs supplied by the tested model.

## Read the score

* **Content** requires a nonempty answer satisfying all required concept/number patterns and no predeclared contradiction. Unicode superscripts/subscripts, dash and quotation variants are normalized before comparison. Common units and alternative forms appear explicitly in the question’s rubric.
* **Behavior** checks the declared API status. An answer or qualified answer is allowed for direct findings and interpretation questions. An unanswerable request must yield “limited” or “abstained”. Content is checked separately, so refusing every question yields little credit.
* **Citations** require a source URL from the frozen evidence group, a title and a locator. An alternative primary source in an “or” group is acceptable. When multiple groups are present, each must be cited. The FLEX-155 and FLEX-120 report passages and the parabolic observations also require a matching figure, run or page in the locator. In other cases, the checker confirms a relevant document and presence of a locator. A human must judge whether the cited passage supports every clause.
* **Retrieval** uses the ordered candidates returned by the retrieval stage before final selection. “Any at 1” records whether the first candidate matched a target document. “All at 3” asks whether every required source group appeared within three candidates. Retrieval uses document-level source identity. Many prompts target specific sections of the same report and do not stress document-level retrieval.
* **Strict pass** requires passing content, behavior and all applicable citation checks. When no primary source is needed for an unrelated request, declining it with the appropriate status can receive full credit. The mandatory-citation denominator covers only prompts with declared target sources.
* **Latency** measures end-to-end wall time for each successful request, including local retrieval and model inference. The report gives a median and a nearest-rank 95th percentile. Different serving hardware, concurrent processes, inference caches or model warm-up will change throughput.

## Limits and a check on the grader

A second reader can inspect the question, gold wording, prompt history, every source link, actual answer and rules that fired. Rule checks can miss a scientifically adequate paraphrase, fail to catch a wrong association, or give credit to an answer that contains correct words alongside unrelated claims. Applying the frozen checks to the concise reference answers themselves yields **88/100**. Q036, for example, names polycarbonate in the question and uses “the lunar limit” in its correct reference. The checker asks for the material name again. Q075’s human reference mentions “diagnostic signals” while its machine rubric looks for a particular diagnostic. An answer’s matching score therefore measures literal rubric compliance. Read sampled answers alongside it to estimate how well compliance captures helpfulness. No expert panel independently adjudicated the entire suite.

The strict score combines the provider, retrieval index, abstention policy, answer construction, and citations in this application. A bare local model sees no project evidence, so its content checks answer a different question. The public 18-question search-only benchmark measures another task. None of these scores substitutes for the separate timed comparison with human researchers using ordinary search.

The question file’s SHA-256 receipt is in questions.sha256. Results include both this digest and the scorer source digest. Neither is an externally registered timestamp.

## Fresh follow-up after the first benchmark

A follow-up suite in holdout.json uses fresh questions on the same public evidence base. It contains eight answerable facts, eight scope or comparison questions and eight unavailable or inappropriate requests. The questions and criteria were frozen by the benchmark author before either version answered them. The engine developer received aggregate failure categories from the original run and did not receive the follow-up prompts. The author knew those failure categories. This design measures transfer to new phrasing and cases deliberately chosen to probe those weaknesses. It is an internal holdout with shared source material.

```sh
python3 scripts/benchmark_chat_holdout.py --url http://127.0.0.1:8765/api/chat --out /tmp/first-fire-chat-followup
```

Use a separate output directory for each frozen serving version. Every run stores the raw responses, source criteria, per-question scores, model and engine identity, and source-corpus hash. The holdout runner imports the same scoring functions as the 100-question suite. See research/chat-runs/holdout-comparison.md for the paired results. Keep fresh-user testing separate from both authored suites.
