"""Verify the quotes against five pinned NASA HTML downloads, then write the offline receipts.
Usage: python3 scripts/build_mission_receipts.py PATH_TO_HTML
Local filenames use the source ID with ':' changed to '-'. Download URLs are in data/incidents.json.
"""
import argparse
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
class Visible(HTMLParser):
    def __init__(self):
        super().__init__()
        self.words = []
    def handle_data(self, value):
        self.words.append(value)

def clean(value):
    return ' '.join(value.split())

QUOTES = [
    ('apollo1:mission','overview setting','On Jan. 27, 1967, tragedy struck on the launch pad at Cape Kennedy during a preflight test for Apollo 204 (AS-204).'),
    ('apollo1:mission','overview crew','Astronauts Virgil Grissom, Edward White and Roger Chaffee lost their lives when a fire swept through the command module.'),
    ('apollo1:board','cause comparison','No single ignition source of the fire was conclusively identified.'),
    ('apollo1:board','cause comparison','The most probable initiator was an electrical arc in the sector between -Y and +Z spacecraft axes.'),
    ('apollo1:board','atmosphere','The test was conducted with a 16.7 pounds per square inch absolute, 100-percent oxygen atmosphere.'),
    ('apollo1:board','escape','With a slightly higher pressure inside the Command Module than outside, opening the inner hatch is impossible'),
    ('apollo1:aftermath','changes','the new outward-opening unified hatch'),
    ('apollo13:mission','crew','astronauts Jim Lovell, Fred Haise, and Jack Swigert'),
    ('apollo13:incident','overview cause setting comparison','a fault in the electrical system of one of the Service Module’s oxygen tanks produced an explosion that caused both oxygen tanks to fail'),
    ('apollo13:incident','overview escape','The crew shut down the Command Module and used the Lunar Module as a “lifeboat” during the return trip to Earth.')
]
def main(folder):
    sources=json.loads((ROOT/'data/incidents.json').read_text())['sources']
    result=[]
    for key,facets,quote in QUOTES:
        path=folder/(key.replace(':','-')+'.html')
        raw=path.read_bytes()
        html=Visible()
        html.feed(raw.decode('utf-8'))
        content=clean(' '.join(html.words))
        if clean(quote) not in content:
            raise ValueError('Missing exact NASA wording: '+quote)
        binding=key+'\n'+quote
        result.append(dict(source=sources[key],facets=facets.split(),quote=quote,
                           documentSHA256=hashlib.sha256(raw).hexdigest(),
                           quoteSHA256=hashlib.sha256(binding.encode()).hexdigest()))
    dest=ROOT/'site/mission-receipts.js'
    dest.write_text('globalThis.FFMissionReceipts='+json.dumps(result,ensure_ascii=False,indent=2)+';\n')
if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('folder',type=Path)
    main(parser.parse_args().folder)
