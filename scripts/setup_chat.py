#!/usr/bin/env python3
"""Prepare a local Python environment, BGE encoder and one FIRST FIRE chat model.

Run with Python 3.11 or 3.12. The optional --offline mode only checks a ready
installation and never contacts a package registry or model hub.
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import venv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REVISION = "5c38ec7c405ec4b44b94cc5a9bb96e735b38267a"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--offline", action="store_true", help="verify the local environment and encoder")
    parser.add_argument("--model", choices=("qwen3:0.6b", "qwen3.6:35b-a3b", "gemma3:1b"), default="qwen3:0.6b",
                        help="qwen3:0.6b installs the compact passage selector; qwen3.6:35b-a3b enables source-linked synthesis and arithmetic")
    args = parser.parse_args()
    envdir = ROOT / ".chat-venv"
    python = envdir / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if not python.is_file():
        if args.offline:
            parser.exit(1, "Missing .chat-venv. Run setup first.\n")
        if sys.version_info[:2] not in {(3,11), (3,12)}:
            parser.exit(2, "Use Python 3.11 or 3.12 to create the tested environment.\n")
        venv.EnvBuilder(with_pip=True).create(envdir)
    if not args.offline:
        subprocess.run([str(python), "-m", "pip", "install", "-r", str(ROOT/"chat"/"requirements.txt")], check=True)
    # Only data/tokenizer and safetensors weights are downloaded. No remote model code.
    subprocess.run([str(python), "-c",
        "from transformers import AutoTokenizer, AutoModel; import sys; "
        "p='BAAI/bge-small-en-v1.5'; kw={'revision':sys.argv[1],'local_files_only':sys.argv[2]=='1','trust_remote_code':False}; "
        "AutoTokenizer.from_pretrained(p,**kw); AutoModel.from_pretrained(p,use_safetensors=True,**kw); "
        "print('BGE encoder and tokenizer ready.')", REVISION, "1" if args.offline else "0"], check=True)
    ollama = shutil.which("ollama")
    if not ollama:
        parser.exit(1, "Install Ollama from https://ollama.com/download and start it, then rerun setup.\n")
    if args.offline:
        subprocess.run([ollama, "show", args.model], check=True, stdout=subprocess.DEVNULL)
    else:
        subprocess.run([ollama, "pull", args.model], check=True)
    print(f"From {ROOT}, run {python} -m chat.server --model {args.model}")
    print("Open http://127.0.0.1:8765/#chat")

if __name__ == "__main__":
    main()
