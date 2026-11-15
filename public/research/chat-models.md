# Selecting the FIRST FIRE chat transformer

**Decision:** Use a compact local instruction transformer to select evidence, keep the original wording and source locators under application control, and measure the whole conversation. The relevant objective is to answer the research question with the right scope, or say why the archive cannot answer it. A generic vendor reasoning score does not measure that task.

## Candidate review

| Candidate | Why consider it | Decision for this iteration |
| --- | --- | --- |
| [Qwen3 0.6B](https://huggingface.co/Qwen/Qwen3-0.6B) | A small instruction model with a non-thinking mode appropriate for short evidence selections. | Tested locally alongside Gemma on matched development probes. Provisional first choice based on that result; see the separate 100-question system test. |
| [Gemma 3 1B](https://deepmind.google/models/gemma/gemma-3/) | Small, text-only decoder; the 1B configuration has a 32k context window. Already available on the test Mac. | Second local candidate with the same development prompts. The nominal context window is not the context used in our run. [Google technical report](https://arxiv.org/abs/2503.19786) |
| [Qwen3.5 2B](https://huggingface.co/Qwen/Qwen3.5-2B) | A larger, locally runnable model with image and text input; a candidate for a later experiment reading figures. | Reviewed, not benchmarked. Do not mix interpretation of a figure with retrieval of a verified figure caption. |
| [SmolLM3 3B](https://huggingface.co/HuggingFaceTB/SmolLM3-3B) | An open-weight, Apache-2.0 instruction model with a larger parameter budget; useful as a stronger text-only challenger. | Reviewed, not benchmarked. Compare later with the identical corpus, latency budget and independent questions. |
| [BGE-small-en-v1.5](https://huggingface.co/BAAI/bge-small-en-v1.5) | A 384-dimensional English encoder for finding passages; it does not generate answers. Exact identifiers and numerals still need lexical matching. | Retrieval candidate for the local service. The browser-only archive also has a separate Model2Vec index; neither embedding model is a chat generator. |

The shortlist favors ordinary local machines, traceability and fast repeated tests. It is not a claim that a 0.6B model beats all current open models. We did not benchmark large medical specializations, vision models on pictures, or a hosted frontier model.

## A development comparison independent of the scientific test

On this Apple silicon Mac, we sent twelve fictional, non-combustion records with three possible answers to each generator. Each got the identical record, options and a JSON-constrained choice, temperature 0, seed 13, context 2,048 and a 32-token output cap; Qwen's thinking mode was disabled. No candidate received the expected choice. The probes cover negation, unavailable conditions, observation windows, orientation, arithmetic, scope and a hostile instruction inside a record. The source and both exact model digests are saved with the run.

| Generator | Correct choices | Median end-to-end time |
| --- | ---: | ---: |
| Qwen3 0.6B | 10 / 12 | 0.087 s |
| Gemma 3 1B | 5 / 12 | 0.117 s |

These twelve questions were development data used for selection; the measurement includes requests to an already running local Ollama service. It does not estimate free-form chat latency, prove statistical superiority, or resolve the 100-question test. Exact prompts and outputs are available in the complete project at `research/chat-runs/model-selection.json`; reproduce with `python3 scripts/model_trials/select_local.py`. [Ollama chat API](https://docs.ollama.com/api/chat) · [Structured output specifications](https://docs.ollama.com/capabilities/structured-outputs).

## Moving to Grok without changing the meaning of an answer

1. Keep the browser on the FIRST FIRE API. The browser sends the question and bounded conversation history; the service owns retrieval, policy, the answer contract and citations. Give local and future cloud providers the same ranked, immutable passages and the same schema. No model-generated URL becomes an authoritative source; the server resolves selected evidence IDs against the archived record.
2. For a future Grok adapter, configure the server-side model identifier after checking the [xAI model list](https://docs.x.ai/developers/rest-api-reference/inference/models). Use a server-side credential and the [Responses API](https://docs.x.ai/developers/model-capabilities/text/generate-text), explicit limits and a supported [structured output](https://docs.x.ai/developers/model-capabilities/text/structured-outputs). Do not silently switch a local session to a cloud endpoint after a timeout. Leave external search, file uploads and code execution disabled for an apples-to-apples comparison. Data sent to this optional provider would include the user's question, relevant dialogue and selected published passages; the current local path sends none of that to xAI.
3. Decide whether the experiment is testing **evidence selection** or **free writing**. For a provider-only comparison keep the same evidence-selection output and rendering. If a second Grok experiment permits synthesis, require an evidence ID for each claim; reject unattributed numbers, invented references and unsafe transfer. A JSON schema guarantees structure, not factual correctness. Preserve separate results for these two conditions.
4. Freeze the corpus, rubric and model versions. Rerun the same public 100 as a regression test and use a **new unseen set** for the promotion decision. Compare content and citation checks per question, unjustified answers on unknowns, multi-turn failures, latency, cost and failure modes; verify disputed cases blind to provider. Before routing real traffic, require no critical false flight outcomes or safety approvals on independently reviewed challenges, an improvement in fully supported answers with no hidden denominator changes, and a predeclared cost and latency budget. A no-call dry run is not a Grok benchmark.

The simulator will be a different tool with a versioned input/output schema. Chat retrieves and explains research today; a later solver would return model assumptions, predictions and validation status. See the physics design in Sources & methods.
