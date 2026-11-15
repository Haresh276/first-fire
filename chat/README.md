# Local research chat

## Choose a model

| Mode | Ollama tag | What it does |
| --- | --- | --- |
| Research synthesis | `qwen3.8:27b` | Writes an answer using retrieved NASA records and project documents. It can compare records and request calculations that FIRST FIRE evaluates independently. |
| Compact selection | `qwen3:0.6b` | Selects existing attributed passages. The application displays their archived text. This is the smaller installation and the setup script’s default. |
| Alternate selection | `gemma3:1b` | Uses the same structured passage-selection interface with a different local model. |

These modes use a pinned local BGE encoder. The engine also accepts `qwen3.6:35b-a3b` for research synthesis. The archived synthesis benchmark used that model. The separate hosted-workspace interface looks for `qwen3.8:27b` when run on loopback. The judge-facing static site uses its browser archive and research tools. Running the Python service on your own machine enables the installed Ollama model.

## Start the service

Install Python 3.11 or 3.12 and start Ollama. The terminal command `OLLAMA_NO_CLOUD=1 ollama serve` starts Ollama locally if the app is not already running. [Ollama installer](https://ollama.com/download)

For research synthesis, run these commands from the project directory.

```sh
python3.12 scripts/setup_chat.py --model qwen3.8:27b
python3 scripts/build.py
.chat-venv/bin/python -m chat.server --model qwen3.8:27b
```

To serve the account-enabled release’s research interface locally, pass `--site-root public` to the server and open `/research-workspace/#home`. The Python service supports research chat and static pages. The Vercel Function handles account sign-in on the hosted release.

For compact selection, substitute `qwen3:0.6b` in the setup and server commands. On Windows use `.chat-venv\Scripts\python.exe` for the server. Initial setup downloads the dependencies, BGE weights and the requested Ollama model. The larger model requires considerably more storage and memory. For an existing installation, use `--offline --model <tag>` with the setup script to check the installed files.

Open [research chat](http://127.0.0.1:8765/#chat) and inspect [service health](http://127.0.0.1:8765/api/health) to confirm the active mode and exact model digest. The server binds to loopback and calls Ollama on port 11434. When no model is specified, the service prefers the installed research model and falls back to the installed compact Qwen model. An explicit `--model` argument or `FIRST_FIRE_CHAT_MODEL` selects that tag. Use `--port 8770` if the dashboard port is occupied.

## How answers are produced

The research path retrieves source-table rows, original column labels and units, affected study passages and project protocols. The transformer receives up to 15 passages and returns short blocks of prose, source numbers and arithmetic expressions. A request may use conditional inputs supplied by the researcher. Each number used in a calculation must come from the question, the cited evidence or a small set of mathematical constants. The restricted expression evaluator supports arithmetic, bounded powers, square roots, absolute values and the standard normal CDF. The server may request one correction when a response fails validation. A second failed validation produces an abstention.

The browser compares each citation’s identity, URL and locator with the released registry, replays the arithmetic and checks that the displayed text matches the returned blocks. Source matching establishes provenance. A researcher still needs to judge whether the sources support the interpretation, whether a field represents the requested physical quantity and whether two experiments can be compared.

The compact mode uses BGE embeddings, lexical retrieval and exact identifiers to find candidates. Qwen or Gemma selects passages with structured output. The browser verifies their complete text against its registry. Curated Apollo incident lookups and the built-in numerical tools can produce answers independently of the compact model. In synthesis mode, natural-language questions can return to the transformer when an automatic tool selection needs more information. The status and usage fields identify which path actually answered.

## API and reproduction

`GET /api/health` returns readiness, model tag and digest, active mode, encoder revision and release fingerprints.

`POST /api/chat` accepts a `message` of 1–2,000 characters and optional `history` with up to 12 user or assistant messages, each with `content` of up to 4,000 characters. The answer includes `status`, `answer`, `citations`, `retrieved`, `method`, `model_digest`, `usage` and `elapsed_ms`. A successful synthesized response includes a `synthesis_receipt` containing the source IDs and per-block arithmetic trees. Selected passages carry a `passage_receipt`. Deterministic guards can return an evidence limit with no generation tokens.

Malformed input yields HTTP 400, an unsupported content type 415, and a mismatched host or origin 403. If the selected local model is unavailable, an inference request returns 503. The server keeps no prompt log. The browser retains its own conversation history.

Use `python3 -m unittest discover -s tests -p 'chat*test.py'` for local protocol and synthesis checks. Reproducing a benchmark also requires the archived question bank, code, corpus, model digest, scoring rule and documented answer path. Earlier benchmarks used different model and gate versions. [Original baseline instructions](versions/README.md)

The local providers use structured outputs and the pinned BGE encoder. Model weights are separate installations subject to their respective licenses. A Grok API provider remains planned. [BGE model card](https://huggingface.co/BAAI/bge-small-en-v1.5) · [Ollama structured output specification](https://docs.ollama.com/capabilities/structured-outputs)

## Reproduce the fresh evaluations

The [results browser](../site/fresh-chat-benchmark.html) shows the question, expected answer, citations and specific reason for each verdict. On a built site open `dist/fresh-chat-benchmark.html`. Download its audit ZIP and extract the nested archive for the series you want to inspect.

For this benchmark route, start the service with `--model qwen3.6:35b-a3b` and install Chromium. Capture new answers using the questions-only file:

```sh
node scripts/run_local_chat_exam.cjs questions.json new-visible.jsonl http://127.0.0.1:8765
.chat-venv/bin/python scripts/run_synthesis_exam.py questions.json new-visible.jsonl new-synthesis.jsonl
```

The second command uses the stronger model. It keeps actual model responses from the browser run and sends every remaining prompt through the same local synthesis configuration. Set `CHROMIUM_EXECUTABLE` for a custom Chromium installation. Historical transcript files retain the full model digest, evidence fingerprints and the serving JavaScript hashes. A rerun after a model or evidence change is a new result. The released questions are now public and can be used for regression testing.

### Evidence edition used for the blind benchmark

Both local modes and the offline chat search the evidence edition frozen on 15 November 2026. The [indexed research review](../research/review.md) is retained to reproduce that run. The [current research review](../research/current/review.md), served at `#report/review` and `research/review.md` on the dashboard, includes the subsequent ICES clarification. Figure 13 and the single-material figures give different lunar limits for some materials. The [FLINT comparison](../site/flint.html#validation) reports both readings and excludes cotton. The separately [timestamped FLINT v2](../site/forecast-register.html#fm2-v2) estimates conditional burn lengths. A question about that newer forecast should be checked against its own signed record.

The current field guide keeps every word on the eleven indexed pages. Four of those pages add the ICES source note. To regenerate the archived guide passages, use the PDF at commit `a55546f` and install `pypdf` in the environment running the extraction.

```sh
git show a55546f:site/first-fire-field-guide.pdf > /tmp/first-fire-nov15-guide.pdf
python3 scripts/extract_chat_guide.py --guide /tmp/first-fire-nov15-guide.pdf
```
