# Device and reader implementation

The investigation desk and chat share one tier and one explanation level. Open **Reading preferences → This device** in chat or **This device** in the investigation workspace. The first view reads local capability hints. Opening a résumé requests its local parser. The optional language model starts only after an explicit download action.

## Device tiers

| Mode | Automatic choice | What changes |
|---|---|---|
| Lite | Data saving, slow/metered link, reported memory at most 2 GB, or at most two logical cores | Keyword retrieval, stored evidence, 2D/tabular readouts. A 431,361-byte dictionary-coded archive reproduces every field and raw table cell from the 1,584,544-byte bundle. Neither embeddings nor language-model weights are fetched. |
| Standard | Ordinary or unavailable capability hints | Hybrid semantic and keyword retrieval. The first search loads 3,128,397 bytes of row-wise quantized Potion vectors. A separate click enables the optional Referee on a supported HTTP(S) origin. |
| Pro | At least 8 GB reported memory, working WebGPU adapter, at least 350 MB free site storage | Full research views and the option to download the local evidence selector. Overriding the tier never creates a GPU or triggers a model download. |

The panel reports `navigator.deviceMemory`, `hardwareConcurrency`, connection hints, `navigator.storage.estimate()` and an actual `navigator.gpu.requestAdapter()` result with `maxStorageBufferBindingSize`. Missing memory defaults to Standard. The 350 MB threshold is a project allowance for roughly 215 MB of downloads and cache overhead. Browser memory and storage estimates are coarse. See the [WebGPU specification](https://www.w3.org/TR/webgpu/#dom-gpu-requestadapter), [Storage Standard](https://storage.spec.whatwg.org/#dom-storagemanager-estimate) and [Device Memory specification](https://www.w3.org/TR/device-memory/).

## Chat and local evidence selection

The 360-million-parameter SmolLM2 model uses four-bit weights with WebGPU through WebLLM 0.2.88. On Pro, select **Download and enable on-device selector**. WebLLM loads the 6.8 MB public runtime, model configuration, tokenizer, compiled GPU program and approximately 206 MB of weights and tokenizer files. Model and WASM URLs are pinned by revision. Browsers may evict cached weights. The local data path runs on HTTPS or localhost. Standalone `file://` pages retain the archive and private document reader. [WebLLM](https://github.com/mlc-ai/web-llm) · [SmolLM2 weights](https://huggingface.co/mlc-ai/SmolLM2-360M-Instruct-q4f32_1-MLC/tree/1e6b2ca3684e2bc8a6d39eb36e8d6cd51eb12bda)

The browser reconstructs candidate passages against the archive and their source locators. On the archived-reading answer path, WebLLM selects the lead passage from up to six verified texts. Only a single offered letter is accepted. The app retains the original passage text, supporting conditions and sources. A failed or unavailable selection preserves the verified archive ordering. Deterministic calculations, scope guards and registered proof checks retain their own answer paths. **Disable on-device selector** unloads the engine. Future Grok evaluation remains a separate server-side candidate.

## Private reading preferences

The chooser accepts PDFs with text, Office Open XML `.docx`, `.txt` and `.md`. The local PDF.js 5.6.205 parser extracts page text from bytes with scripting/evaluation, font fetching, WASM and network range reads disabled. The DOCX reader inflates only `word/document.xml` using JSZip 3.10.1 and extracts text nodes. The file limit is 8 MB, with up to 30 PDF pages or 2 MB of uncompressed Word XML. Locked or image-only PDFs require a readable text copy. [PDF.js API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html) · [JSZip](https://github.com/Stuk/jszip/tree/v3.10.1)

A local keyword rule suggests **Start here**, **UG** or **PG**, explains its educational cues and prioritizes an example in medicine, engineering or data. The person can override both fields. Broad résumés and unfamiliar degree labels may need correction. Only the selected level enters the tab’s investigation settings. The example field lives in page memory. Raw text, document bytes, names and emails are excluded from prompts, storage and exports. Documents are never uploaded.

## Acceptance measurements

- Four actual PDFs, four deflated DOCXs, a TXT and a Markdown résumé produced the expected level **10/10** and discipline **10/10**. Synthetic English samples contain explicit educational cues. Canary strings were absent from outbound request URLs, headers and bodies and from browser session/local storage. No outside model or library was requested at upload.
- Ten first-turn questions covering counts, incidents, checked claims, lunar forecasting and refusal produced identical displayed answers in Lite, Standard and Pro before the optional selector was enabled. Tests independently assert the expected result and whether a semantic weight file was requested.
- Chromium 157.0.8103.51 on one workstation chose the expected tier for three supplied hardware profiles. First visible investigation action on a local offline file was 332–336 ms for a 360 px Lite viewport with 4× CPU throttling, 91–92 ms for Standard and 91–94 ms for Pro. These are two cold browser-context examples for each tier, with no network latency. Three physically distinct devices and a low-end phone’s network remain field acceptance work.
- On an actual WebGPU adapter, Chromium 157 loaded WebLLM 0.2.88 and all seven pinned SmolLM2 weight shards. The selector returned the supported Nomex passage for the Saffire-II question after a lexical relevance filter and constrained answer format. Unconstrained trial responses included an irrelevant passage and abstention. This checks one end-to-end example. The public download timed out during testing, so the browser replay used locally cached, SHA-256-verified weights and the pinned compiled model. Cold public download time remains unmeasured.
- Run `node --test tests/reader-device.test.cjs tests/awareness.test.cjs` and `node tests/reader_device_browser.cjs`. The browser test accepts `FIRST_FIRE_QA_URL` and `CHROMIUM_EXECUTABLE`. For opt-in hardware verification set `FIRST_FIRE_DOWNLOAD_MODEL=yes` and run `node tests/webgpu_smoke.cjs` against localhost or HTTPS.
