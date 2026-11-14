# Recorded local model runs

These directories contain synthetic benchmark conversations only. They are not user chat logs.

| File or directory | Meaning |
| --- | --- |
| model-selection.json | Development choice task: 12 synthetic records per generator. |
| bare-qwen.jsonl, bare-qwen.meta.json | Closed-book Qwen. Each request contains only the frozen user prompt and fixed earlier turns. The model never sees the references. |
| grounded-qwen-v2/ | Revised service on the already-exposed 100 questions. Regression result. |
| holdout-v1-qwen/, holdout-v2-qwen/ | Original and revised service on the same separately frozen 24-question transfer set. |
| bare-qwen/ | Scorer output for the closed-book comparator. It has no citation or retrieval tool. Compare **content**, not strict source score, with the evidence-backed system. |
| grounded-qwen/, grounded-gemma/ | Paired, frozen first runs using the local service. health.json pins the model/corpus; responses.jsonl contains unedited API returns. summary.json, results.json and scores.csv show every rubric decision. |
 
The separately frozen 24-question outcomes are summarized in [the paired comparison](holdout-comparison.md). The [systematic v2 audit](grounded-qwen-v2/audit.md) looks at twenty answers in plain language.

The model weights themselves are not redistributed in the project ZIP. See chat/README.md to acquire them separately. Other local user prompts are never appended to these artifacts.
