# Rebuilding the static site

The `public/` directory and `vercel.json` at the top of this package are the deployable site. The root includes the judging pages. The chat and research tools live in `public/research-workspace/`.

For the account page, follow the [Google and GitHub sign-in setup](account-setup.md) to register callbacks, configure Vercel credentials and verify each provider.

After editing a workspace JavaScript module, the recovery registration, or the service-worker template, run the following commands from the package root with Python 3.11 or newer.

```sh
python3 source-tools/rebuild.py
python3 source-tools/rebuild.py --check
```

The build joins the workspace entry modules in dependency order, inserts the registration code into the workspace HTML, derives an integrity-bound recovery worker, and refreshes both SHA-256 manifests. The nested workspace and judging site each maintain their own manifest. Rebuilding requires only the files in this package.

To preview the homepage locally, run `python3 -m http.server --directory public` and visit `/research-workspace/`. Vercel applies the root redirect and route rules in `vercel.json` when this project is deployed.

## Run the research workspace with local model answers

The public research workspace answers from the bundled archive. To add responses from Qwen on your computer, start Ollama and run the following from the root of the complete FIRST FIRE repository with Python 3.11 or 3.12. The setup command installs Python dependencies, the pinned evidence encoder, and the selected model weights.

```sh
python3.12 scripts/setup_chat.py --model qwen3.8:27b
.chat-venv/bin/python -m chat.server --port 8778 --model qwen3.8:27b --site-root public
```

Open [the local research workspace](http://127.0.0.1:8778/research-workspace/#home). When the model is ready, the service retrieves project evidence and sends it with recent conversation turns to Ollama over loopback. The workspace identifies verified model responses and falls back to the archive when it cannot verify one. [Local chat setup and benchmark details](../chat/README.md)
