"""Build source-addressable records for multi-step questions from the shipped NASA tables."""
import csv
import io
import json
import math
import re
from collections import Counter
from functools import lru_cache
from .corpus import Passage, ROOT, read
from .retrieval import Hit, context_question, norm, terms


def clean(value):
    return ' '.join(str(value or '').split())


def normalize_id(text):
    return re.sub(r'[^a-z0-9]', '', norm(text))


def csv_records(path):
    data = (ROOT / path).read_bytes()
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = data.decode("cp1252")
    return list(csv.reader(io.StringIO(text)))


@lru_cache(maxsize=1)
def table_data():
    rows = {}
    with (ROOT / 'data/tests.csv').open(encoding='utf-8', newline='') as handle:
        for row in csv.DictReader(handle):
            rows[(row['source_file'], int(row['source_row']))] = row
    records = []
    for study in read('investigations.json'):
        for table_number, table in enumerate(study['tables'], 1):
            grid = csv_records(table['file'])
            headers = [clean(h) for h in grid[0]]
            for row_number, cells in enumerate(grid[1:], 2):
                populated = [(col, clean(value)) for col, value in zip(headers, cells) if col and clean(value)]
                if not populated:
                    continue
                identifiers = {v for k,v in populated if k.lower() in {
                    'test','test #','flex test #','flex identifier','as run test #','same test #','flex number','sample number','sample #'}}
                row = rows.get((table['file'], row_number), {})
                identifiers.update(row[k] for k in ('test_id','instrument_id','record_id') if row.get(k))
                reported = '; '.join(f'{k}: {v}' for k,v in populated)
                missing = [col for col,v in zip(headers,cells) if col and not clean(v)]
                if missing:
                    reported += '. Empty cells: ' + ', '.join(missing)
                if row.get('quality_notes'):
                    reported += '. Release quality note: ' + row['quality_notes']
                # Use the original named columns including units. Some source headers use abbreviations.
                text = f"{study['name']} ({study['accession']}), original CSV row {row_number}. " + reported
                doc = Passage(f"cells:{study['accession']}:{table_number}:{row_number}",
                              'NASA PSI · '+study['name']+' · '+study['accession'], table['url'],
                              f"{table['file'].split('/')[-1]}, CSV row {row_number} (header = 1)", text)
                records.append((study['accession'], study['name'], identifiers, doc))
    return records


def compact(obj):
    if isinstance(obj,dict):
        return '; '.join(f"{key.replace('_',' ')} = {compact(value)}" for key,value in obj.items())
    if isinstance(obj,list):
        return ', '.join(compact(value) for value in obj)
    return str(obj)


@lru_cache(maxsize=1)
def method_records():
    docs=[]
    forecast=read('forecast.json')
    mission=forecast['mission']; source=next(s for s in forecast['sources'] if s['id']==mission['source_id'])
    design={key:mission[key] for key in ('material','pressure_psia','pressure_tolerance_psi','gravity_earth_g','balance_gas','initial_oxygen_pct','nasa_expected_loc_pct','burn_direction')}
    docs.append(Passage('fm2:chamber-design',source['title'],source['url'],source['locator'], 'Planned FM² chamber settings. '+compact(design)+'. Gas percentages describe the starting mixture.'))
    registration=json.loads((ROOT/'site/forecast-lock/fm2-v1.json').read_text())
    geometry=registration['design']
    docs.append(Passage('fm2:source-geometry',source['title'],source['url'],geometry['locator'],
        f"NASA's FM² chamber design calls for a {geometry['length_cm']} cm vertical {geometry['material']} fabric specimen in a {geometry['chamber_litres']} litre chamber, with {geometry['orientation']}. The {geometry['gas']} atmosphere starts at {geometry['pressure_psia']} psia, with tolerance {geometry['pressure_tolerance_psi']} psi.",
        'planned lunar fabric burn specimen strip dimensions length bottom wire igniter direction chamber pressure'))
    for material in ('fm2','pmma'):
        f=f'site/forecast-lock/{material}-v1.json'
        reg=json.loads((ROOT/f).read_text())
        for key,val in reg.items():
            if key not in ('basis','design','model','predictions','trials','resolution','primary_score','secondary_length_evaluation','scoring','event','source'):continue
            values=[val] if not isinstance(val,list) else val
            for i,v in enumerate(values,1):
                text=compact(v)
                docs.append(Passage(f'{material}:protocol:{key}:{i}', 'FIRST FIRE · '+material.upper()+' frozen forecast protocol',
                                    'forecast-lock/'+material+'-v1.json', key+(f' · item {i}' if isinstance(val,list) else ''),
                                    f'{material.upper()} forecast registration, {key.replace("_"," ")}. {text}', 'scoring rule probability eligibility unresolved observation Brier null ignition'))
    # Index project methods with their precise local section/line. Keep evaluation questions and model answers out.
    for name in ('evaluation','review','data','forecast','video-measurement','transport-fit','advanced-methods','intake','device-and-reader','master-physics','world-model'):
        p=ROOT/'research'/(name+'.md');section=title='';code=False
        for i,line in enumerate(p.read_text().splitlines(),1):
            if line.startswith('```'):code=not code
            if code or not line.strip():continue
            if line.startswith('#'):
                section=line.lstrip('#').strip()
                if line.startswith('# '):title=section
                continue
            if line.startswith(('|','    ','!')):continue
            cleanline=re.sub(r'\[([^\]]+)\]\([^)]*\)',r'\1',line).replace('**','').strip(' #-*')
            if 42<=len(cleanline)<=2600:
                docs.append(Passage(f'notes:{name}:{i}', 'FIRST FIRE · '+title, '#report/'+name, f'{section}, line {i}', cleanline, section))
    for block in read('chat-guide-passages.json')['passages']:
        docs.append(Passage(**block))
    return docs


def extended_registry():
    return [record[3] for record in table_data()] + method_records()


def study_patterns():
    patterns={}
    for study in read('investigations.json'):
        key=study['accession']; name=study['name']
        alias=re.escape(name.lower()).replace(r'\-', '[- ]?')
        map_alias={'PSI-39':r'liquid cfi|(?<![-\w])cfi(?![- ]?g\b)', 'PSI-159':r'cfi[- ]?g|gaseous cool flame',
                   'PSI-69':r'flex(?![- ]?2\b)', 'PSI-68':r'flex[- ]?2','PSI-101':r'same[- ]?(?:r|reflight)\b',
                   'PSI-102':r'same experiment|original same','PSI-98':r'saffire[- ]?(?:i|1)\b','PSI-99':r'saffire[- ]?(?:ii|2)\b',
                   'PSI-100':r'saffire[- ]?(?:iii|3)\b','PSI-26':r'bass(?![- ]?(?:ii|2)\b)','PSI-25':r'bass[- ]?(?:ii|2)\b'}
        patterns[key]=re.compile(r'\b(?:'+key.lower().replace('-','[- ]?')+'|'+map_alias.get(key,alias)+r')\b')
    return patterns


class ResearchIndex:
    def __init__(self):
        self.patterns=study_patterns()
        self.study_rows={}
        self.identifiers={}
        for study,name,ids,doc in table_data():
            self.study_rows.setdefault(study,[]).append(doc)
            for id_ in ids:
                term=normalize_id(id_)
                if term and any(ch.isdigit() for ch in term):
                    self.identifiers.setdefault(term,[]).append((study,doc))
        self.notes=method_records()
        self.words=[Counter(terms(d.hints+' '+d.title+' '+d.text)) for d in self.notes]
        self.df=Counter(k for row in self.words for k in row)
        self.semantic_vectors=None

    def find(self, index, question, history):
        hits,query=index.retrieve(question,history)
        q=norm(query)
        studies={s for s,p in self.patterns.items() if p.search(q)}
        tokens=re.findall(r'[a-z0-9]+',q)
        candidates=set(tokens)
        for n in (2,3,4):
            candidates.update(''.join(tokens[i:i+n]) for i in range(len(tokens)-n+1))
        # Numeric ranges and IDs can look alike. Require a named study for bare numbers,
        # and require an explicit row index for pure numbers in the absence of a study.
        named={}
        for token in sorted(candidates,key=lambda s:(-len(s),s)):
            if len(token)>60 or token.isdigit() and not studies and not re.search(r'(?:run|test|sample)\s*#?\s*'+re.escape(token)+r'\b',q):continue
            entries=[item for item in self.identifiers.get(token,()) if not studies or item[0] in studies]
            if not entries or len(entries)>8:continue
            if token.isdigit() and not re.search(r'\b'+re.escape(token)+r'\b(?!\s*(?:%|cm|mm|s\b|kpa|psia|bar|g\b))',q):continue
            if len({s for s,d in entries})>1 and not studies:continue
            for s,doc in entries:named[doc.id]=doc
        for m in re.finditer(r'\b(?:csv |source )?rows?\s*#?\s*(\d+)\b',q):
            for s in studies:
                for doc in self.study_rows[s]:
                    if doc.id.endswith(':'+m[1]):named[doc.id]=doc
        terms_q=set(terms(query))
        import numpy as np
        if self.semantic_vectors is None:
            self.semantic_vectors=np.concatenate([index.encoder.encode([d.index_text() for d in self.notes[i:i+12]]) for i in range(0,len(self.notes),12)])
        vector=index.encoder.encode(["Represent this sentence for searching relevant passages: "+query])[0]
        similarity=self.semantic_vectors @ vector
        scored=[]
        for doc,counts,semantic in zip(self.notes,self.words,similarity):
            bm=sum(math.log(1+len(self.notes)/(1+self.df[w]))*min(2,counts[w]) for w in terms_q if w in counts)
            if doc.id.startswith('fm2:') and re.search(r'fm[- ]?2|synergy|lunar.*(?:chamber|burn)',q):bm+=10
            if doc.id.startswith('pmma:') and re.search(r'acrylic.*(?:register|forecast)|pmma.*(?:register|forecast)',q):bm+=10
            scored.append((.65*float(semantic)+.35*(1-math.exp(-bm/24)),doc))
        scored.sort(key=lambda pair:pair[0],reverse=True)
        best=list(named.values())[:8]+[h.passage for h in hits[:5]]+[d for _,d in scored[:6]]+[h.passage for h in hits[5:]]
        # Additional raw headers and values for questions about a named table's columns.
        if not named and len(studies)==1 and re.search(r'\b(?:column|field|unit|missing|recorded|record[s]?|row)\b',q):
            best+=self.study_rows.get(next(iter(studies)),[])[:1]
        selected=[]; seen=set()
        for doc in best:
            if doc.id in seen or doc.text in seen:continue
            seen.update((doc.id,doc.text));selected.append(Hit(doc,1/(1+len(selected)),0,0))
        return selected[:18],query
