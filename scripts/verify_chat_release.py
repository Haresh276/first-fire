"""Validate published chat figures against sealed question files, transcripts and blind grades."""
import hashlib
import io
import json
from zipfile import ZipFile


def verify_chat_release(dist):
    prefix='window.FFFreshChat='
    raw=(dist/'fresh-chat-results.js').read_text()
    if not raw.startswith(prefix) or not raw.endswith(';\n'):
        raise ValueError('Missing machine-readable fresh benchmark')
    reports=json.loads(raw[len(prefix):-2])
    with ZipFile(dist/'fresh-chat-audit.zip') as bundle:
        for series,report in reports.items():
            with ZipFile(io.BytesIO(bundle.read('audit-'+series+'.zip'))) as audit:
                for line in audit.read('SHA256SUMS').decode().splitlines():
                    digest,name=line.split('  ',1)
                    assert hashlib.sha256(audit.read(name)).hexdigest()==digest,name
                seal=json.loads(audit.read('seal.json'))
                for name in ('questions.json','rubric.json'):
                    assert hashlib.sha256(audit.read(name)).hexdigest()==seal['files'][name],name
                labels=json.loads(audit.read('runs/key.json'))
                grades={tuple(labels[g['ticket']]):g for g in json.loads(audit.read('grades.json'))}
                rows=report['rows']
                questions={q['id']:q for q in json.loads(audit.read('questions.json'))['questions']}
                assert set(questions)=={r['id'] for r in rows} and len(questions)==len(rows)==100
                assert len(grades)==300
                for track in ('current','previous','selector'):
                    predictions={r['id']:r for r in map(json.loads,audit.read('runs/'+track+'.jsonl').decode().splitlines())}
                    assert set(predictions)==set(questions)
                    for r in rows:
                        key=r['id'];q=questions[key];prediction=predictions[key];grade=grades[track,key]
                        assert r['question']==q['message'] and r['level']==q['level']
                        assert r[track]['answer']==prediction['displayed']
                        assert r[track]['citations']==prediction.get('turn',prediction)['sources']
                        assert r[track]['pass']==grade['passed'] and r[track]['reason']==grade['reason']
                        if track=='current':
                            assert r['probability']==prediction['turn']['verification']['calibration']['probability']
                        if track=='selector' and series=='B':
                            assert prediction['usage']['inferences'] and prediction['model_digest']
                    for level in report['levels']:
                        sliced=[r for r in rows if level['label']=='All' or r['level']==level['label']]
                        assert (level['n'],level[track])==(len(sliced),sum(r[track]['pass'] for r in sliced))
                assert abs(report['stats']['brier']-sum((r['probability']-r['current']['pass'])**2 for r in rows)/100)<1e-9
                assert report==json.loads(audit.read('report.json'))
    print('Verified both fresh 100-question chat evaluations against the blinded judgments and actual model responses.')


if __name__=='__main__':
    import sys
    from pathlib import Path
    verify_chat_release(Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parents[1]/'dist')
