# Local research chat

Open **http://127.0.0.1:8765/#chat** while the FIRST FIRE service is running. The browser and the service communicate on the same origin. The static file version of the dashboard links to the local service.

## First run

Install [Ollama](https://ollama.com/download) and Python 3.12. Start Ollama from its application or in a terminal with `OLLAMA_NO_CLOUD=1 ollama serve`. The service uses the local Ollama port 11434. From the FIRST FIRE project directory:

```sh
python3.12 scripts/setup_chat.py
.chat-venv/bin/python -m chat.server
```

The initial setup installs Python packages, the pinned BGE encoder and the selected local instruction model. Allow time for these downloads. On Windows, use `.chat-venv\Scripts\python.exe` for the server command. For subsequent runs, start Ollama and the local server. Both models run on this device. The service reads the existing built dashboard in `dist/`. When rebuilding from source, run `python3 scripts/build.py` before launching. Inspect the model identities and readiness at `/api/health`. If a port is occupied, use `--port 8770` and open that port in the browser.

For the alternate generator, run `python3.12 scripts/setup_chat.py --model gemma3:1b` and launch `.chat-venv/bin/python -m chat.server --model gemma3:1b`. Use `--offline` on the setup command to verify already-installed cached models without downloading. The BGE weights are pinned to commit `5c38ec7c405ec4b44b94cc5a9bb96e735b38267a`. Ollama model tags may be updated over time. The health response and benchmark manifest record the specific local model digest, so compare it before reproducing a result. Qwen's evaluated digest is `7df6b6e09427a769808717c0a93cadc4ae99ed4eb8bf5ca557c90846becea435`. Gemma's is `8648f39daa8fbf5b18c7b4e6a8fb4990c692751d49917417b8842ca5758e7ffc`.

## Answer generation and citations

The chat searches 85 source-linked passages plus the 1,058 locally archived observation rows. BGE transforms a question and each indexed passage into a contextual embedding using its BERT transformer, CLS pooling and L2 normalization. A BM25 score rewards exact words and material identifiers. Known investigation names provide an additional small ranking signal. Run identifiers also look up archived PSI records directly. An ambiguous general query about an arbitrary CSV field has more limited coverage than a lookup by run ID. Check the source row through Data explorer for numeric work.

The instruction transformer chooses between zero and three evidence passages from a short ranked set through Ollama's JSON schema mode. The server validates every selection and presents the actual passage text and source locator in the selected order. The text includes curated research summaries and proposed tests. It can therefore be relevant yet still fail to answer the full question. Selecting an inappropriate true statement remains a major failure mode. A genuine research conclusion needs verification against the linked records. The shipped v2 first checks task scope, data availability and requests for unsupported measurements or flight certification. The `method` field records guard decisions. Questions that pass these checks reach the local instruction transformer. A scope rule can reject a valid paraphrase or miss a new kind of unsupported request. A biomedical, arbitrary open-domain or unmeasured numerical question extends outside the collection.

Named mission-incident questions take a separate path. The service and the standalone dashboard read the same source-linked Apollo 1 and Apollo 13 records in `data/incidents.json`. A direct lookup can answer an incident overview, a documented detail, or a question that distinguishes the two missions. Each paragraph cites its source. Unsupported details and unrecognized incidents receive an evidence-limit response. These curated answers use no model tokens and have an empty `retrieved` list. The v2 benchmark predates the incident records.

Only preceding user messages help resolve a short follow-up. A figure mentioned in a previous answer is a reading aid, and the chat must retrieve the underlying source again. The service neither sends chat to other hosts nor writes prompts to a server-side history file. External publisher links open only when the reader follows them.

## API

`GET /api/health` reports the model and digest, BGE revision, corpus and engine fingerprints, number of rows and passages, and whether the configured model exists in local Ollama.

`POST /api/chat` accepts an object with `message` of 1–2,000 characters and optional `history` of up to 12 records with roles `user` or `assistant` and text `content` of up to 4,000 characters. It returns `answer`, `status` (answered, limited or abstained), `citations` with their source and locator, raw ranked `retrieved` candidates, provider/model identity, usage and wall time. Empty or invalid input returns HTTP 400. Wrong content type returns 415. A host or origin mismatch returns 403. When the selector produces invalid structured output twice, the server abstains. Unavailable Ollama returns 503. Server-side errors do not become a purported source-supported answer.

The initial benchmark uses the v1 implementation. To reproduce it, see [the baseline archive instructions](versions/README.md).

The current selector interface in `engine.py` accepts a question and a list of retrieved passages. A future Grok adapter would implement the same schema and passage-ID validation server-side. It will require an explicit hosted-mode configuration, an API key supplied by the operator, and a fresh evaluation against this frozen suite. No physics calculation is executed by the language model.

## Sources and licenses

The retrieval implementation follows the [BGE model card](https://huggingface.co/BAAI/bge-small-en-v1.5). Model selection uses [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs). Official model cards describe [Qwen3-0.6B](https://huggingface.co/Qwen/Qwen3-0.6B) and [Gemma 3 1B instruction-tuned](https://huggingface.co/google/gemma-3-1b-it). The release ships application code and the evaluation evidence. BGE, Qwen and Gemma weights remain separate installations under their respective model licenses.

A successful HTTP response means the evidence selection process ran. A checked citation ID establishes where the displayed text came from. It does not validate that the passage fully answers the question. During development, a vague question about a Moon probe and an unspecified plot returned FM² planning information. Supplying the mission, run, figure and physical quantity makes an ambiguity of this kind visible to the researcher.
