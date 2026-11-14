"""Pin local chat passages and exact source locators for the public response gate."""
import json
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from chat.corpus import corpus, fundamentals

def build():
    docs,_=corpus()
    rows=[{**p.cite(),'text':p.text} for p in docs+fundamentals()]
    (ROOT/'site/referee-passages.js').write_text('globalThis.FFRefereePassages='+json.dumps(
        rows,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8')

if __name__=='__main__':
    build()
