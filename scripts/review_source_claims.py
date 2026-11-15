"""Compile topic-specific, byte-bound source passages and independently reviewed claims.
Run with the project's pypdf and local Ollama Gemma 3 1B. Only publisher text and public
claims are sent to loopback. Do not pass visitor questions to this release step.
"""
import argparse
import hashlib
import json
from pathlib import Path
from functools import lru_cache

from urllib.request import Request, urlopen
from review_referee import MODEL, PROMPT
from verify_quotes import ROOT, EVIDENCE, extract, tokens

# ID, document, page/section, question facets, exact source excerpt, precise claim.
CARDS = [
 ('acrylic-name','acrylic-rods',57,'what does pmma mean|stand for|what (?:shape|material)|specimen shape|rod shape','black polymethylmethacrylate rods in microgravity','The BASS-II specimens were cylindrical rods of acrylic, polymethyl methacrylate (PMMA).'),
 ('acrylic-coverage','acrylic-rods',57,'21%|21 percent|near.*21|did not overlap|diameter.*missing|diameter.*lack','only the two largest diameter rods were tested at near 21 percent O2 by volume, with the highest O2 concentration tested for the 6.35-mm-diameter rods being approximately 19 percent by volume.','The 6.35 mm rod was tested in microgravity up to about 19% oxygen. Only the two larger rods were measured near 21% oxygen.'),
 ('acrylic-diameters','acrylic-rods',57,'17.5|all three|all.*thickness|all.*diameters','The only O2 concentration at which all three rod diameters employed in the microgravity experiments were tested was at approximately 17.5 percent O2 by volume.','All three rod diameters were tested together only near 17.5% oxygen in microgravity.'),
 ('acrylic-spread','acrylic-rods',58,'17.5|propagat|spread.*oxygen|lowest','in microgravity, flame spread was observed at O2 concentrations as low as 17.5 percent, in normal gravity, flame spread was not observed below 19 percent.','The study observed flame spread down to 17.5% oxygen in microgravity. Under normal gravity it did not observe spread below 19% oxygen.'),
 ('sibal-fabric','luci',16,'fabric|material|specimen|spreading over|burning over|what.*burn','SIBAL fabric (cotton-fiberglass blend) burning downward in Lunar-g','The LUCI specimen was SIBAL, a cotton-fiberglass fabric burning downward in simulated lunar gravity.'),
 ('sibal-dimensions','luci',4,'how big|size|dimensions|wide|width|length of.*strip','Fabric 5 cm wide x 30 cm long','The LUCI fabric was 5 cm wide and 30 cm long.'),
 ('sibal-base','luci',33,'base|quantitatively|spread fit','Partial- G (mm/s) 1-G (mm/s) Ratio Flame Base .9 1.5 .6 Flame Tip 1.1 2.8 .39','The LUCI fabric flame base advanced at 0.9 mm/s in partial gravity and 1.5 mm/s at Earth gravity.'),
 ('sibal-tip','luci',33,'tip|edge|quantitatively|spread fit','Partial- G (mm/s) 1-G (mm/s) Ratio Flame Base .9 1.5 .6 Flame Tip 1.1 2.8 .39','The LUCI fabric flame tip advanced at 1.1 mm/s in partial gravity and 2.8 mm/s at Earth gravity.'),
 ('sibal-extinction','luci',34,'longer|later|sooner|lifetime|extinction|remain.*visible','1-g extinction happens ~ 45 seconds sooner than partial-g extinction','The SIBAL flame lasted about 45 seconds longer in partial gravity than at Earth gravity.'),
 ('sibal-oxygen','luci',42,'atmospher|oxygen|attribute|confound','O2 concentration decreases from ~20% to ~18%.','Oxygen fell from about 20% to 18% during the partial-gravity SIBAL burn.'),
 ('saffire-blackening','saffire',25,'blacken|color|discol|damage|streak|soot','The first 1-cm of the fabric was significantly damaged, the first 5-cm was completely blackened, and the remainder had a black streak down its center.','About 1 cm of Nomex was significantly damaged and 5 cm was completely blackened. The rest had a black streak.'),
 ('saffire-soot','saffire',25,'blacken|soot|pyroly|color|discol','some of this discoloration may have been caused by deposition of soot from the PMMA flame on the fabric, and not necessarily pyrolysis of the fabric itself.','PMMA soot could have discolored the Nomex. Blackening alone cannot establish that the fabric burned.'),
 ('saffire-duration','saffire',25,'timed|what.*duration|consumed|burn.length','It took about two minutes for the PMMA to be consumed, all the while the flame plume was extending over and heating the base of the Nomex® fabric.','The PMMA was consumed in about two minutes while its plume heated the downstream Nomex.'),
 ('saffire-flow','saffire',29,'concurrent|chamber oxygen|ambient oxygen|airflow','2-7 PMMA & Nomex 5 cm 0.85 & 0.37 mm 5 & 24 cm 20 cm/s Concurrent ~ 22.1','The PMMA–Nomex specimen had concurrent flow of 20 cm/s and approximately 22.1% initial oxygen.'),
 ('flex-observation','flex_tp',189,'vapor|post.visible|diagnos|plateau|invisible|diameter history|after.*visible','The vaporization rate was high after the visible flame extinguished, and there was an eventual plateau late in the HiBMs Image Processing and Storage Unit (IPSU) recording time coincident with the formation of a large vapor cloud.','After visible extinction the droplet continued to vaporize rapidly. A late plateau coincided with a large vapor cloud; the report interpreted the post-visible behavior as cool-flame burning.'),
 ('flex-instrument','flex_tp',154,'instrument|ultraviolet|imaging|infrared|vapor cloud|124','The Low Light Level Ultra-Violet (LLUV) Image Processing and Storage Unit (IPSU) did not record any images during the burn.','The low-light-level ultraviolet imaging unit recorded no images. For this run the available data did not establish cool-flame burning.'),
 ('flex-gases','flex_tp',189,'gas fractions|composition|co2 fraction|initial gas','Free-floating heptane droplet burning in a 0.18/0.67/0.15 O2/N2/CO2, 1.0-atm ambient environment.','The initial heptane test atmosphere was 18% oxygen, 67% nitrogen and 15% carbon dioxide at 1.0 atm.'),
 ('same-iss','same-cdc',2,'principle|sort of detector|type of detector|technology|optical','smoke detectors use near-IR forward light scattering','The ISS detector uses near-infrared forward light scattering.'),
 ('same-generation','same-cdc',3,'produc|generat|how.*made|overheat.*material','smoke generated by overheated spacecraft materials with rigorously controlled sample temperature, flow field, and particle aging time.','Researchers generated smoke by overheating spacecraft materials and controlled temperature, flow and particle aging.'),
 ('same-shuttle','same-cdc',8,'shuttle|pump|intermittent|compar.*dataset','There is a much smaller data set for the Space Shuttle detector as it was only operated intermittently because its required flow rate (driven by an internal pump) consumed three liters per minute of aerosol making it impossible to do aging tests.','The Shuttle detector ran intermittently. Its pump consumed three liters of aerosol per minute, preventing comparable aging tests and leaving a smaller dataset.'),
 ('ices-pressure','ices',6,'pressure|psia|kpa','planned NASA lunar habitat pressure of 56.5 kPa (8.2 psia)','The lunar-habitat comparison used a nominal pressure of 56.5 kPa, or 8.2 psia.'),
 ('ices-endpoints','ices',6,'five.second|5.second|test 1|endpoint|drop tower|qualification','based on a 5 second extinction limit rather than the 15 cm (6 inch) burn limit in NASA Test 1','The short drop used a 5 second extinction endpoint. NASA Test 1 used a 15 cm burn-length endpoint.'),
 ('ices-tape','ices',9,'p213|tape|opposite|reference|materials|arrows','The lower extinction concentration for the lunar-g testing for PMMA, P213 and flaming Beefy-T suggest that the buoyant velocity is very low, but it does not correlate with the WSTF data.','The lunar-gravity oxygen extinction limit for P213 tape was below the extrapolated ground forced-flow result.'),
 ('ices-plastic','ices',11,'polycarbonate|velcro|opposite|reference|materials|arrows','For both of these materials, the lunar-g buoyant extinction is at substantially higher oxygen concentrations that the WSTF data.','The polycarbonate and Nomex Velcro lunar-gravity extinction levels were higher than the ground comparison levels.'),
 ('ices-slope','ices',10,'slope|confidence|velocity|buoyant air speed','To get a conservative estimate of the slope (and thus the compensation factor) we used the one- tailed 95 percent confidence interval.','The conservative slope used a one-tailed 95 percent confidence interval. It is an estimate from the forced-flow fit, not a direct measurement of lunar buoyant velocity.'),
 ('fm2-family','fm2',10,'fabric|textile|material|mount|sample name','Fabric sheets (Synergy Pro “Navy”) mounted between thin metal frames','The planned FM² specimens are sheets of Synergy Pro Navy fabric held in thin metal frames.'),
 ('fm2-pressure','fm2',10,'pressure|psia|kpa|uncertainty band|tolerance','8.2 psia (+/- 0.3 psi)','The planned chamber pressure is 8.2 psia with a tolerance of ±0.3 psi.'),
 ('fm2-start','fm2',5,'starting oxygen|concentrations|initial oxygen|starting atmosphere|oxygen percentage','1. Start at 37% should burn to threshold 2. Start at 33% should burn to threshold 3. Start at 29% should burn to threshold 4. Start at 25% not expected to ignite','The four planned starting oxygen concentrations are 37%, 33%, 29% and 25%. The design describes expectations for future tests.'),
 ('fm2-limit','fm2',5,'expect.*limit|expect.*threshold|limiting oxygen|expected.*range','expected Lunar LOC of 24-26%','The NASA concept expects a lunar limiting oxygen concentration of 24–26%.'),
 ('fm2-reset','fm2',10,'next burn|atmosphere.*next|vent|reset|between tests','Each of the four tests requires its own chamber initial atmosphere as follows with venting to vacuum between tests','The chamber vents to vacuum between tests and each burn receives its own starting atmosphere.'),
 ('fm2-consumption','fm2',14,'consumption|oxygen.*extinction|oxygen.*fall|oxygen.*decrease|oxygen.*scan','Expect oxygen concentration to decrease by up to 0.08 mol fraction in a test.','The design allows oxygen concentration to fall by up to 0.08 mole fraction during a test.'),
 ('cfig-direction','kimber',21,'normal|inverse|feed|supplied|burner|ambient|surrounding|chamber','normal flames, with the fuel flowing from the burner toward the oxidizer, and inverse flames, w ith the oxidizer flowing toward the fuel.','In the inverse configuration oxidizer flowed out of the burner toward the fuel. A burner oxygen concentration describes the feed stream.')
]
def sha(b): return hashlib.sha256(b).hexdigest()
def api(route,body=None):
    request=Request('http://127.0.0.1:11434'+route,json.dumps(body).encode() if body else None,{'Content-Type':'application/json'})
    with urlopen(request,timeout=120) as response:
        return json.load(response)
def main(dir):
    evidence=json.loads(EVIDENCE.read_text())
    extra=json.loads((ROOT/'data/evidence/source-claim-documents.json').read_text());evidence['documents'].update(extra)
    digest=next(m['digest'] for m in api('/api/tags')['models'] if m['name']==MODEL)
    @lru_cache(None)
    def page(key,n):
        src=evidence['documents'][key];b=(dir/src['filename']).read_bytes();assert sha(b)==src['sha256']
        return ' '.join(tokens(extract(b,src,{'section_id':'S'+str(n)} if src['format']=='html' else {'page':n})))
    dest=ROOT/'site/source-claim-reviews.js'
    old=json.loads(dest.read_text().split('=',1)[1].rstrip(';\n')) if dest.exists() else {}
    prior={c['binding']:c['verdict'] for c in old.get('cards',[]) if old.get('digest')==digest and old.get('promptSHA256')==sha(PROMPT.encode())}
    result=[]
    for id,key,n,facets,quote,claim in CARDS:
        src=evidence['documents'][key];original=page(key,n);quote=' '.join(tokens(quote));assert quote in original,(id,quote)
        body={'model':MODEL,'options':{'temperature':0,'seed':19,'num_ctx':8192,'num_predict':32},'keep_alive':'3m','stream':False,'format':{'type':'object','properties':{'verdict':{'type':'string','enum':['supported','contradicted','insufficient']}},'required':['verdict']},'messages':[{'role':'system','content':PROMPT},{'role':'user','content':json.dumps({'source':original,'claim':claim},ensure_ascii=False)}]}
        bound=json.dumps([id,src['sha256'],n,quote,claim],separators=(',',':'),ensure_ascii=False)
        verdict=prior.get(sha(bound.encode())) or json.loads(api('/api/chat',body)['message']['content'])['verdict']
        assert verdict in ('supported','contradicted','insufficient')
        result.append(dict(id=id,doc=key,location=n,facets=facets,quote=quote,claim=claim,binding=sha(bound.encode()),verdict=verdict))
        print(id,verdict,flush=True)
    out=dict(documents=extra,model=MODEL,digest=digest,promptSHA256=sha(PROMPT.encode()),cards=result)
    (ROOT/'site/source-claim-reviews.js').write_text('globalThis.FFSourceClaims='+json.dumps(out,ensure_ascii=False,indent=2)+';\n')
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('originals',type=Path);main(parser.parse_args().originals)
