"""Build the browser's copy of the same attributed passages as the offline service."""
import json
from .corpus import corpus, fundamentals
from .retrieval import row_doc

VERSION = "ff-passages-1"
SCOPE_NOTES = {
    "partial": "The selected sources cover only part of the requested comparison.",
    "unresolved": "The cited evidence leaves the requested conclusion unresolved.",
    "general": "The evidence applies to the reported tests. A general claim needs additional data.",
}


def compiled_registry():
    passages, rows = corpus()
    documents = {}
    for passage in [*passages, *fundamentals(), *(row_doc(row) for row in rows)]:
        if passage.id in documents:
            raise ValueError("Repeated passage ID " + passage.id)
        documents[passage.id] = {"title": passage.title, "url": passage.url,
                                 "locator": passage.locator, "text": passage.text}
    return {"version": VERSION, "docs": documents, "scopeNotes": SCOPE_NOTES}


def write_registry(path):
    payload = json.dumps(compiled_registry(), ensure_ascii=False, separators=(",", ":"))
    path.write_text("window.FFChatPassages=" + payload + ";\n", encoding="utf-8")
