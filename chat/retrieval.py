"""BGE transformer search combined with lexical evidence and instrument identifiers."""
import math
import re
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass
from functools import lru_cache

from .corpus import Passage, corpus, fundamentals

REVISION = "5c38ec7c405ec4b44b94cc5a9bb96e735b38267a"
ENCODER = "BAAI/bge-small-en-v1.5"
STOP = set("a an the this that they these those it of did do is are am does what which where how why with why or as at in for can you your by to on i me my its if there be was were from have has and us tell about please would explain happened research nasa".split())
TOPIC_TERMS={
    "sibal": r"\b(sibal|luci|parabola)\b", "saffire":r"\b(saffire[ -]?(ii|2)|nomex ht90|2-7)\b",
    "flex":r"\b(flex|heptane|c\d{2}h\d{3}|droplet)\b","cfig":r"\b(cfi[ -]?g|21202|21088|inverse flame)\b",
    "same":r"\b(same-r|same experiment|smoke|teflon|kapton|aerosol)\b","ices":r"\b(ices|p213|wstf|polycarbonate|velcro)\b",
    "fm2":r"\b(fm[ -]?2|synergy pro|brier)\b","acrylic":r"\b(ribbed|saffire[ -]?v|pmma rods?|acrylic rods?)\b"
}


def norm(text):
    return unicodedata.normalize("NFKD",text).lower().replace("₂","2").replace("–","-").replace("−","-")


def terms(text):
    return [t for t in re.findall(r"[a-z0-9]+", norm(text)) if t not in STOP]


def topics(query):
    q=norm(query)
    return [topic for topic, pattern in TOPIC_TERMS.items() if re.search(pattern,q) or topic=="same" and "SAME" in query]


REFERENCE = re.compile(
    r"\b(?:it|its|those|these|that|they|them|there|same test|this one|and what|"
    r"the second|the first|the other|earlier|follow.?up)\b"
)
# Elliptical follow-ups can name a part or measurement without using a pronoun.
RESEARCH_DETAIL = re.compile(
    r"\b(?:upstream|downstream|fabric|sample|specimen|material|pressure|oxygen|"
    r"airflow|flow|duration|temperature|speed|rate|uncertainty|measurement|"
    r"burn length|spread|extinction|ignition|next test|test next|evidence)\b"
)


def context_question(question, history):
    if topics(question):
        return question
    prior = next((m["content"] for m in reversed(history) if m["role"] == "user"), "")
    q = norm(question)
    refers = REFERENCE.search(q) or (len(terms(q)) <= 8 and RESEARCH_DETAIL.search(q))
    if prior and refers:
        return prior[-500:] + " " + question
    return question


class Encoder:
    def __init__(self):
        import os
        os.environ.setdefault("HF_HUB_OFFLINE","1")
        os.environ.setdefault("TOKENIZERS_PARALLELISM","false")
        import torch
        from transformers import AutoModel, AutoTokenizer
        self.torch=torch
        torch.set_num_threads(min(4,torch.get_num_threads()))
        self.tokenizer=AutoTokenizer.from_pretrained(ENCODER,revision=REVISION,local_files_only=True)
        self.model=AutoModel.from_pretrained(ENCODER,revision=REVISION,local_files_only=True).eval()

    def encode(self,texts):
        torch=self.torch
        with torch.inference_mode():
            inputs=self.tokenizer(texts,return_tensors="pt",padding=True,truncation=True,max_length=256)
            cls=self.model(**inputs).last_hidden_state[:,0]
            return torch.nn.functional.normalize(cls,dim=1).numpy()


@dataclass
class Hit:
    passage: Passage
    score: float
    semantic: float
    lexical: float


def row_doc(r):
    known={"PSI-69":"flex","PSI-99":"saffire","PSI-101":"same","PSI-159":"cfig"}
    pairs=[("material","material"),("instrument_id","instrument ID"),("o2_initial_pct","initial ambient O₂ (%)"),
           ("o2_final_pct","final ambient O₂ (%)"),("o2_burner_pct","burner-stream O₂ (%)"),
           ("fuel_ambient_initial_pct","initial ambient fuel (%)"),("reported_pressure","source pressure"),
           ("reported_pressure_unit","source pressure unit"),("flow_cm_s","flow (cm/s)"),
           ("burn_time_s","recorded burn duration (s)"),("oxygen_flow_mg_s","oxygen flow (mg/s)"),
           ("hot_ignition","hot ignition"),("termination_code","termination code"),("outcome","reported outcome"),
           ("initial_diameter_mm","initial droplet diameter (mm)"),("visible_extinction_diameter_mm","visible-extinction diameter (mm)")]
    text="; ".join(f"{label}: {r[field]}" for field,label in pairs if r.get(field))
    identifier=r['record_id']
    return Passage(known.get(r['accession'],r['accession'].lower())+":"+identifier,
        f"NASA PSI · {r['accession']} · test {r['test_id']}",r["source_url"],
        f"{r['source_file'].split('/')[-1]}, CSV row {r['source_row']} (header = 1); {identifier}",
        f"{r['accession']} test {r['test_id']}, {r['gravity_regime']}. {text}. {r['quality_notes']}")


class Index:
    def __init__(self):
        import numpy as np
        self.docs,self.rows=corpus()
        self.docs.extend(fundamentals())
        self.encoder=Encoder()
        self.vecs=np.concatenate([self.encoder.encode([d.index_text() for d in self.docs[i:i+12]])
                                  for i in range(0,len(self.docs),12)])
        self.count=[Counter(terms(d.index_text())) for d in self.docs]
        self.df=Counter(w for doc in self.count for w in doc)
        self.avg=sum(c.total() for c in self.count)/len(self.docs)
        self.identifiers=defaultdict(list)
        for row in self.rows:
            for key in {row["test_id"],row["record_id"],row["instrument_id"]}:
                key=norm(key).strip()
                if key and any(ch.isdigit() for ch in key) and (len(key)>2 or not key.isdigit()):
                    self.identifiers[key].append(row)

    def raw_hits(self,query):
        rows={}
        q=norm(query)
        for identifier, entries in self.identifiers.items():
            if identifier.isdigit():
                pattern=r"\b(?:flex|test|run|sample)[ #-]*"+re.escape(identifier)+r"\b"
            else:
                pattern=r"(?<![a-z0-9])"+re.escape(identifier).replace(r"\ ",r"[ -]?")+r"(?![a-z0-9])"
            if re.search(pattern,q):
                # Ambiguous repeated source test IDs require evidence of the investigation.
                if len(entries)>6:
                    continue
                for row in entries:
                    rows[row["record_id"]]=row
        return [row_doc(r) for r in list(rows.values())[:3]]

    def retrieve(self,question,history=()):
        q=context_question(question, history)
        selected_topics=topics(q)
        score_vec=self.vecs @ self.encoder.encode(["Represent this sentence for searching relevant passages: "+q])[0]
        words=set(terms(q))
        hits=[]
        for doc, counts, sem in zip(self.docs,self.count,score_vec):
            total=counts.total()
            bm=sum(math.log(1+(len(self.docs)-self.df[w]+0.5)/(self.df[w]+0.5))*counts[w]*2.2/
                   (counts[w]+1.2*(.25+.75*total/self.avg)) for w in words if counts[w])
            lexical=1-math.exp(-bm/12)
            score=.65*float(sem)+.35*lexical+(.14 if doc.topic in selected_topics else 0)
            hits.append(Hit(doc,score,float(sem),lexical))
        hits.sort(key=lambda h:h.score,reverse=True)
        raw=self.raw_hits(q)
        for doc in reversed(raw):
            hits.insert(1,Hit(doc,.96,0,1))
        # Include both sides of a named cross-case comparison even if one dominates the query.
        chosen=hits[:6]
        for t in selected_topics:
            if not any(x.passage.topic==t for x in chosen):
                other=next((x for x in hits if x.passage.topic==t),None)
                if other: chosen.append(other)
        return chosen[:8],q
