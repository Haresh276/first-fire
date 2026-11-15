"""Extract searchable teaching sections from the FIRST FIRE field guide shipped with the site."""
import argparse
import hashlib
import json
import re
from pathlib import Path
from pypdf import PdfReader

root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--guide', type=Path, default=root/'site/first-fire-field-guide.pdf',
                    help="PDF of the frozen November 15 evidence edition (see chat/README.md)")
guide=parser.parse_args().guide
if hashlib.sha256(guide.read_bytes()).hexdigest() != '824379564920f0f81ab4a7da2f998a44452e9c2cbd94e8f6d615a133d4d34575':
    parser.error('This PDF differs from the benchmark edition. See chat/README.md to extract its pinned source.')
reader=PdfReader(guide)
docs=[]
# The field guide begins with a release-correction page, followed by master pages 15–38.
# Evaluation tables, answer banks and project targets have no role in the evidence index.
for offset,original in enumerate([*range(15,39),*range(96,101)],1):
    if original not in {16,17,18,19,25,26,96,97,98,99,100}:
        continue
    page=reader.pages[offset]
    text=page.extract_text() or ''
    fragments=[re.sub(r'\s+',' ',v).strip() for v in re.split(r'\n\s*\n',text)]
    clean=' '.join(part for part in fragments if part)
    clean=re.sub(r'FIRST FIRE\s*[|·—–-]\s*(?:Master Document[^|]*\|)?','',clean)
    # Index separate paragraph-sized windows, keeping complete sentences together.
    parts=re.split(r'(?<=[.!?])\s+(?=[A-Z“])',clean)
    groups=['']
    for part in parts:
        if len(groups[-1])+len(part)>1300 and groups[-1]:groups.append('')
        groups[-1]=(groups[-1]+' '+part).strip()
    for n,chunk in enumerate(groups,1):
        if len(chunk)<60:continue
        docs.append(dict(id=f'guide:{original}:{n}',title='FIRST FIRE science field guide',url=f'first-fire-field-guide.pdf#page={offset+1}',locator=f'Field guide PDF page {offset+1}, master page {original}',text=chunk,hints='classroom combustion science terms and definitions'))
out=root/'data/chat-guide-passages.json'
out.write_text(json.dumps(dict(sourceSHA256=hashlib.sha256(guide.read_bytes()).hexdigest(),passages=docs),ensure_ascii=False,separators=(',',':'))+'\n')
print(len(docs),'teaching passages')
