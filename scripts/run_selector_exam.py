"""Run the installed Qwen passage selector on every prompt, including those the UI routes to tools."""
import argparse
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from chat.engine import Engine, NO_EVIDENCE


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bank", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    engine = Engine()
    health = engine.health()
    if not health["ready"]:
        raise RuntimeError("Local model unavailable")
    bank = args.bank.read_bytes()
    meta = {"health": health, "bank_sha256": hashlib.sha256(bank).hexdigest(),
            "track": "forced passage selection without UI calculations, scope guards or postprocessing"}
    receipt = Path(str(args.output) + ".meta.json")
    if receipt.exists():
        if json.loads(receipt.read_text()) != meta:
            raise ValueError("Cannot resume with different model, code or questions")
    elif args.output.exists():
        raise ValueError("Missing run receipt")
    else:
        receipt.write_text(json.dumps(meta, indent=2) + "\n")
    done = {json.loads(line)["id"] for line in args.output.read_text().splitlines()} if args.output.exists() else set()
    with args.output.open("a") as stream:
        for q in json.loads(bank)["questions"]:
            if q["id"] in done:
                continue
            hits, query = engine.index.retrieve(q["message"], q.get("history", []))
            passages = [hit.passage for hit in hits]
            status, indices, usage = engine.provider.select(query, passages)
            selected = [passages[i] for i in indices] if status != "abstained" else []
            display = "\n\n".join(f"{p.text} [{i}]" for i, p in enumerate(selected, 1)) or NO_EVIDENCE
            row = {"id": q["id"], "question": q["message"], "level": q.get("level", q.get("difficulty")),
                   "status": status, "displayed": display, "sources": [p.cite() for p in selected],
                   "candidates": [p.id for p in passages], "usage": usage}
            stream.write(json.dumps(row, ensure_ascii=False) + "\n")
            stream.flush()


if __name__ == "__main__":
    main()
