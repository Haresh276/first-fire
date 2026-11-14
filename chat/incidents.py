"""Resolve questions about sourced mission incidents separately from experiment search."""
import re

from .corpus import read
from .retrieval import norm

RECORDS = read("incidents.json")


def matching_records(question):
    return [record for record in RECORDS["records"] if re.search(record["match"], question)]


def is_followup(question):
    if re.search(RECORDS["reference"], question):
        return True
    return re.fullmatch(RECORDS["followup"], question) and any(
        re.search(pattern, question) for pattern in RECORDS["intents"].values())


def previous_records(history):
    # Only look back through a contiguous chain of incident follow-ups.
    for message in reversed(history):
        if message["role"] != "user":
            continue
        question = norm(message["content"]).strip()
        matches = matching_records(question)
        if re.search(RECORDS["research"], question):
            break
        if matches:
            other_names = question
            for record in matches:
                other_names = re.sub(record["match"], " ", other_names)
            return [] if re.search(RECORDS["unknown_named"], other_names) else matches
        if re.search(RECORDS["unknown_named"], question) or not is_followup(question):
            break
    return []


def scoped_reply(question, history):
    """Return (status, text, citations) or None for ordinary experiment retrieval."""
    q = norm(question).strip()
    matches = matching_records(q)
    remaining = q
    for record in matches:
        remaining = re.sub("(?:" + record["match"] + ")(?:[’']s)?", " ", remaining).strip()
    if re.search(RECORDS["research"], q):
        if matches:
            return "abstained", RECORDS["messages"]["mixed"], []
        return None
    if re.search(RECORDS["unknown_named"], remaining):
        return "abstained", RECORDS["messages"]["unknown"], []
    compare_prior = matches and re.search(RECORDS["compare_reference"], q)
    if compare_prior:
        previous = previous_records(history)
        matches = previous + [r for r in matches if r not in previous]
    if not matches and is_followup(q):
        matches = previous_records(history)
    if not matches:
        if re.search(RECORDS["unknown"], q):
            kind = "ambiguous" if re.search(r"\bapollo\b", q) else "unknown"
            return "abstained", RECORDS["messages"][kind], []
        return None

    intent_text = re.sub(r"\s+", " ", remaining).strip()
    facets = [key for key, pattern in RECORDS["intents"].items() if re.search(pattern, intent_text)]
    if not facets and len(matches) > 1 and (compare_prior or re.search(RECORDS["compare"], q)):
        facets = ["comparison"]
    if not facets and (re.fullmatch(RECORDS["overview"], remaining) or compare_prior):
        facets = ["overview"]
    paragraphs, citations = [], []
    for record in matches:
        if not facets or any(facet not in record["facts"] for facet in facets):
            return "abstained", RECORDS["messages"]["unsupported"].format(name=record["name"]), []
        for facet in facets:
            for fact in record["facts"][facet]:
                source = RECORDS["sources"][fact["source"]]
                if source not in citations:
                    citations.append(source)
                line = f"{fact['text']} [{citations.index(source) + 1}]"
                if line not in paragraphs:
                    paragraphs.append(line)
    return "answered", "\n\n".join(paragraphs), citations
