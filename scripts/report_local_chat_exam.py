"""Join sealed grades to saved model outputs and calculate paired counts and reliability.

Inputs for one series: run directory with previous/current/selector.jsonl and key.json,
question-bank directory with rubric.json, grades.json and questions.json, plus a
configuration defining labels, methodology, comparator rate and the source-prediction key.
The entry point writes one JSON report suitable for either report panel.
"""
import argparse
import json
import math
from collections import Counter
from pathlib import Path


def read(path):
    return json.loads(path.read_text())


def mean(values):
    return sum(values)/len(values)


def interval(k,n):
    if not n:return None
    z=1.95996398454
    center=k/n+z*z/(2*n)
    half=z*math.sqrt(k/n*(1-k/n)/n+z*z/(4*n*n))
    return [max(0,(center-half)/(1+z*z/n)),min(1,(center+half)/(1+z*z/n))]


def summarize(runs,bank,config):
    questions=read(bank/'questions.json')['questions']
    refs={r['id']:r['expected'] for r in read(bank/'rubric.json')['rubrics']}
    labels=read(runs/'key.json')
    grades={tuple(labels[g['ticket']]):g for g in read(bank/'grades.json')}
    records={k:{r['id']:r for r in map(json.loads,(runs/(k+'.jsonl')).read_text().splitlines())} for k in ('previous','current','selector')}
    expected={q['id'] for q in questions}
    assert len(expected)==100 and all(set(v)==expected for v in records.values()) and len(grades)==300
    result=[]
    for q in questions:
        key=q['id'];record=records['current'][key];cal=record['turn']['verification']['calibration']
        p=cal.get(config.get('probabilityKey','probability'))
        if p is None and 'probabilitySource' in config:
            p=read(runs/config['probabilitySource'])[key]
        if type(p) not in (float,int) or not 0<=p<=1:raise ValueError('Missing pregrade probability for '+key)
        row={'id':key,'level':q['level'],'question':q['message'],'reference':refs[key],'probability':p,'showPercentage':cal.get('showPercentage',True)}
        for track in records:
            prediction=records[track][key];g=grades[track,key]
            row[track]={'answer':prediction['displayed'],'citations':prediction.get('turn',prediction)['sources'],
                        'pass':g['passed'],'code':g['code'],'reason':g['reason']}
        result.append(row)
    levels=[]
    for v in ['All']+list(dict.fromkeys(q['level'] for q in questions)):
        group=[r for r in result if v=='All' or r['level']==v]
        levels.append(dict(label=v,n=len(group),**{k:sum(r[k]['pass'] for r in group) for k in records}))
    diffs=[int(x['current']['pass'])-int(x['previous']['pass']) for x in result]
    gains=diffs.count(1); losses=diffs.count(-1);discordant=gains+losses
    pairedP=min(1,2*sum(math.comb(discordant,i) for i in range(min(gains,losses)+1))/2**discordant) if discordant else 1
    probs=[r['probability'] for r in result];truth=[int(r['current']['pass']) for r in result]
    rate=config['trainingRate']
    brier=mean([(p-y)**2 for p,y in zip(probs,truth)])
    constant=mean([(rate-y)**2 for y in truth])
    bands=[]
    for lo,hi,tag in [(0,.5,'Below 50%'),(.5,.8,'50% to below 80%'),(.8,1.01,'80% and above')]:
        b=[r for r in result if lo<=r['probability']<hi];n=len(b);k=sum(r['current']['pass'] for r in b)
        bands.append(dict(label=tag,n=n,passed=k,accuracy=k/n if n else None,meanProbability=mean([r['probability'] for r in b]) if b else None,accuracy95=interval(k,n)))
    ece=sum(b['n']/100*abs(b['accuracy']-b['meanProbability']) for b in bands if b['n'])
    maximum=max(abs(b['accuracy']-b['meanProbability']) for b in bands if b['n'])
    logloss=-mean([math.log(max(1e-15,p if y else 1-p)) for p,y in zip(probs,truth)])
    paired=f"{gains} questions improved and {losses} regressed when compared on the same prompts. Both versions passed {sum(r['current']['pass'] and r['previous']['pass'] for r in result)}."
    text=f"Mean predicted chance of a strict pass was {mean(probs):.1%}. Observed accuracy was {mean(truth):.1%}. Brier score was {brier:.3f}, versus {constant:.3f} for the constant {rate:.1%} training-rate prediction. The average absolute gap, weighted across the three bands, was {ece*100:.1f} percentage points. The largest band gap was {maximum*100:.1f} points."
    return dict(labels=config['labels'],overview=config['overview'],method=config['method'],levels=levels,rows=result,paired=paired,reliability=bands,calibrationText=text,
        stats=dict(gains=gains,losses=losses,exactPairedP=pairedP,brier=brier,logloss=logloss,constantBrier=constant,meanProbability=mean(probs),accuracy=mean(truth),accuracy95=interval(sum(truth),len(truth)),ece=ece,maxGap=maximum,errors=dict(Counter(r['current']['code'] for r in result))))


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ('runs','bank','configuration','out'):p.add_argument(name,type=Path)
    a=p.parse_args();a.out.write_text(json.dumps(summarize(a.runs,a.bank,read(a.configuration)),ensure_ascii=False,indent=2)+'\n')
