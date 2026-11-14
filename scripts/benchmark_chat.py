#!/usr/bin/env python3
"""Run or rescore the frozen FIRST FIRE chat benchmark. Python standard library."""
import argparse
import csv
import hashlib
import json
import re
import statistics
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import unquote, urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SUITE = ROOT / 'tests/chat/questions.json'
DIFFICULTIES = ['beginner', 'intermediate', 'advanced', 'complex', 'challenge']
TRUSTED_HOSTS = {
    'psi.nasa.gov', 'ntrs.nasa.gov', 'www.nasa.gov', 'nasa.gov',
    'standards.nasa.gov', 'doi.org', 'dx.doi.org', 'escholarship.org',
    'api.drum.lib.umd.edu', 'drum.lib.umd.edu', 'pmc.ncbi.nlm.nih.gov',
    'www.nist.gov', 'www.hou.usra.edu', 'hou.usra.edu', 'www.nature.com',
    'pmc.ncbi.nlm.nih.gov', 'www.ncbi.nlm.nih.gov', 'nvlpubs.nist.gov',
}
VALID_STATUS = {'answered', 'limited', 'abstained'}
EXPECTED_STATUS = {'answer': {'answered', 'limited'}, 'boundary': {'answered', 'limited'}, 'unanswerable': {'limited', 'abstained'}}


def load_suite(path=None):
    path = Path(path or DEFAULT_SUITE)
    raw = path.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    receipt = path.with_suffix('.sha256')
    if not receipt.is_file() or receipt.read_text().split()[0] != digest:
        raise ValueError('Suite hash mismatch. Use the frozen question set and its matching receipt.')
    suite = json.loads(raw)
    questions = suite['questions']
    if len(questions) != 100 or len({q['id'] for q in questions}) != 100:
        raise ValueError('Expected 100 unique question IDs.')
    for q in questions:
        for pattern in q['required_claim_patterns'] + q['contradiction_patterns']:
            re.compile(pattern, re.IGNORECASE)
        if any(s not in suite['sources'] for group in q['expected_evidence'] for s in group):
            raise ValueError('Unknown reference code in ' + q['id'])
    return suite


def normalize(text):
    text = unicodedata.normalize('NFKC', str(text))
    for a, b in {'–': '-', '—': '-', '−': '-', '’': "'", '‘': "'", '“': '"', '”': '"'}.items():
        text = text.replace(a, b)
    return ' '.join(text.split())


def endpoint_locator(ref):
    return normalize(' '.join([str(ref.get('locator', '')), unquote(urlsplit(ref.get('url') or '').fragment)]))


def source_matches(source, ref, require_locator):
    if not isinstance(ref, dict):
        return False
    raw = ref.get('url')
    if not isinstance(raw, str):
        return False
    url = urlsplit(raw)
    if url.netloc:
        if url.scheme not in {'https', 'http'}:
            return False
        if url.hostname not in TRUSTED_HOSTS:
            return False
    elif url.scheme or raw.startswith('//'):
        return False
    # Ignore query text: an unrelated URL pointing *to* a source in a query is not a citation.
    path = unquote(url.path + ('#' + url.fragment if url.fragment else '')).lower()
    if not any(s.lower() in path for s in source['url_fragments']):
        return False
    if not require_locator:
        return True
    locator = endpoint_locator(ref)
    if not ref.get('title') or not locator:
        return False
    return not source['locator_regex'] or bool(re.search(source['locator_regex'], locator, re.I))


def match_groups(groups, refs, sources, require_locator):
    return [
        any(source_matches(sources[s], ref, require_locator) for s in group for ref in refs)
        for group in groups
    ]


def score(question, response, sources=None):
    """Return independent machine-checkable criteria. A missing retrieval trace yields None."""
    if sources is None:
        sources = load_suite()['sources']
    answer = response.get('answer', '')
    text = normalize(answer)
    refs = response.get('citations') or []
    trace = response.get('retrieved')
    if not isinstance(refs, list):
        refs = []
    groups = question['expected_evidence']
    claims = [bool(re.search(p, text, re.I)) for p in question['required_claim_patterns']]
    violations = [p for p in question['contradiction_patterns'] if re.search(p, text, re.I)]
    content = bool(text) and all(claims) and not violations
    status = response.get('status')
    behavior = status in EXPECTED_STATUS[question['expected_behavior']]
    located = match_groups(groups, refs, sources, True)
    cited = all(located) if groups else None
    # An unknown may be explained using relevant evidence, but does not *require* a citation
    # except where its frozen rubric explicitly calls for an actual contrast or result.
    route = {}
    for k in (1, 3, 5):
        hits = match_groups(groups, trace[:k], sources, False) if groups and isinstance(trace, list) else None
        route['retrieval_any_at_' + str(k)] = any(hits) if hits is not None else None
        route['retrieval_all_at_' + str(k)] = all(hits) if hits is not None else None
    return dict(
        answer_content_pass=content, claim_checks=claims,
        failed_claim_patterns=[p for p, hit in zip(question['required_claim_patterns'], claims) if not hit],
        contradiction_patterns_matched=violations, behavior_pass=behavior, citation_pass=cited,
        required_evidence_groups=groups, citation_groups_matched=located,
        strict_pass=bool(content and behavior and cited is not False), **route,
    )


def summarize(rows, key):
    passed = sum(row['scores'][key] is True for row in rows)
    eligible = sum(row['scores'][key] is not None for row in rows)
    return {'passed': passed, 'eligible': eligible, 'percent': round(100 * passed / eligible, 1) if eligible else None}


def metrics(rows):
    by = {name: summarize(rows, name) for name in (
        'answer_content_pass', 'strict_pass', 'behavior_pass', 'citation_pass',
        'retrieval_any_at_1', 'retrieval_any_at_3', 'retrieval_all_at_3', 'retrieval_all_at_5')}
    by['transport_errors'] = sum(bool(r.get('error')) for r in rows)
    by['count'] = len(rows)
    times = sorted(r['latency_ms'] for r in rows if not r.get('error') and r.get('latency_ms') is not None)
    by['latency_ms'] = {
        'n': len(times), 'median': round(statistics.median(times), 1) if times else None,
        'p95_nearest_rank': round(times[max(0, (95 * len(times) + 99) // 100 - 1)], 1) if times else None,
    }
    return by


def collect(url, question, timeout):
    payload = {'message': question['message'], 'history': question['history']}
    request = Request(url, json.dumps(payload).encode(), {'Content-Type': 'application/json'})
    started = time.perf_counter()
    record = {'id': question['id']}
    try:
        with urlopen(request, timeout=timeout) as connection:
            response = json.load(connection)
        if not isinstance(response, dict) or not isinstance(response.get('answer'), str):
            raise ValueError('Missing response.answer string')
        record['response'] = response
    except (OSError, ValueError, HTTPError) as exc:
        detail = exc.read(4000).decode(errors='replace') if isinstance(exc, HTTPError) else str(exc)
        record.update(response={}, error=type(exc).__name__ + ': ' + detail)
    record['latency_ms'] = round((time.perf_counter() - started) * 1000, 2)
    return record


def load_responses(path):
    lines = [json.loads(line) for line in Path(path).read_text().splitlines() if line.strip()]
    if len(lines) != len({r['id'] for r in lines}):
        raise ValueError('Duplicate response ID in ' + str(path))
    return {r['id']: r for r in lines}


def write_results(rows, out, suite_file, endpoint, started):
    difficulty = {x: metrics([r for r in rows if r['difficulty'] == x]) for x in DIFFICULTIES}
    behaviors = {x: metrics([r for r in rows if r['expected_behavior'] == x]) for x in EXPECTED_STATUS}
    multi = [r for r in rows if r['history']]
    summary = {
        'suite': 'first-fire-chat-100-v1', 'suite_sha256': hashlib.sha256(suite_file.read_bytes()).hexdigest(),
        'scorer_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), 'endpoint': endpoint,
        'started_utc': started, 'finished_utc': datetime.now(timezone.utc).isoformat(),
        'overall': metrics(rows), 'difficulty': difficulty, 'expected_behavior': behaviors, 'fixed_history': metrics(multi),
        'failed_strict_ids': [r['id'] for r in rows if not r['scores']['strict_pass']],
    }
    (out/'results.json').write_text(json.dumps({'summary': summary, 'rows': rows}, indent=2, ensure_ascii=False) + '\n')
    (out/'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
    def val(d, k):
        v = d[k]
        return f"{v['passed']}/{v['eligible']}" if v['eligible'] else '—'
    header = ['Group', 'Exact rubric pass', 'Content checks', 'Citation groups', 'Any target @1', 'All targets @3']
    def line(label, d):
        return [label] + [val(d, k) for k in ('strict_pass','answer_content_pass','citation_pass','retrieval_any_at_1','retrieval_all_at_3')]
    table = [header, ['---'] * len(header), line('All', summary['overall'])]
    table.extend(line(k.title(), v) for k, v in difficulty.items())
    table.extend(line(k.title(), v) for k, v in behaviors.items())
    table.append(line('Fixed history', summary['fixed_history']))
    md = ['# FIRST FIRE chat benchmark', '', 'Each row in the linked result file contains the entire answer, reference, evidence, grading decisions and timing.', '',
          *['| '+' | '.join(row)+' |' for row in table], '',
          f"Median response time was {summary['overall']['latency_ms']['median']} ms. The nearest-rank 95th percentile was {summary['overall']['latency_ms']['p95_nearest_rank']} ms. Timing includes the request, local retrieval and generation when applicable.",
          '', 'The strict count requires all expected content checks, no flagged contradiction, an accepted response status and every required source group with a locator. The content check uses prewritten regular expressions. Inspect the raw answers for equivalent wording, omissions and unsupported additional claims. The seven research cases are public. No human preference, global model quality or independent generalization was measured.',
          '', '[All answers and decisions](results.json) · [Machine-readable summary](summary.json) · [Question-by-question CSV](scores.csv)']
    (out/'report.md').write_text('\n'.join(md)+'\n')
    with (out/'scores.csv').open('w',newline='') as dest:
        writer=csv.writer(dest)
        writer.writerow(['id','difficulty','prompt','expected_behavior','status','answer_content_pass','citation_pass','strict_pass','any_at_1','all_at_3','latency_ms','reference','answer','missing_claims','contradictions'])
        for r in rows:
            s=r['scores']; response=r.get('response',{})
            writer.writerow([r['id'],r['difficulty'],r['message'],r['expected_behavior'],response.get('status'),s['answer_content_pass'],s['citation_pass'],s['strict_pass'],s['retrieval_any_at_1'],s['retrieval_all_at_3'],r.get('latency_ms'),r['reference_answer'],response.get('answer',''),json.dumps(s['failed_claim_patterns']),json.dumps(s['contradiction_patterns_matched'])])
    return summary


def main():
    p=argparse.ArgumentParser(description=__doc__)
    source=p.add_mutually_exclusive_group(required=True)
    source.add_argument('--url',help='Chat POST endpoint. The default project server uses http://127.0.0.1:8765/api/chat')
    source.add_argument('--responses',type=Path,help='Previously recorded endpoint JSONL. Refer to tests/chat/README.md.')
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--suite',type=Path,default=DEFAULT_SUITE)
    p.add_argument('--timeout',type=int,default=120)
    p.add_argument('--resume',action='store_true',help='Resume a partial run only with matching suite and endpoint.')
    args=p.parse_args()
    suite=load_suite(args.suite)
    args.out.mkdir(parents=True,exist_ok=True)
    stored=args.out/'responses.jsonl'
    meta=args.out/'request-config.json'
    conf={'suite':hashlib.sha256(args.suite.read_bytes()).hexdigest(),'url':args.url}
    if args.responses:
        data=load_responses(args.responses)
        if set(data)!={q['id'] for q in suite['questions']}:
            raise ValueError('Need exactly one response for every question, including explicit error records.')
    else:
        if stored.exists() and (not args.resume or not meta.exists() or json.loads(meta.read_text())!=conf):
            raise ValueError('Existing run found. Use a new --out directory or --resume for the identical endpoint and suite.')
        data=load_responses(stored) if stored.exists() else {}
        meta.write_text(json.dumps(conf,indent=2)+'\n')
    started=datetime.now(timezone.utc).isoformat()
    rows=[]
    for i,q in enumerate(suite['questions'],1):
        if q['id'] not in data:
            record=collect(args.url,q,args.timeout)
            with stored.open('a') as dest: dest.write(json.dumps(record,ensure_ascii=False)+'\n')
            if i%10==0:print(f'{i}/100 responses recorded',flush=True)
        else:
            record=data[q['id']]
        response=record.get('response',{})
        row=dict(q,**{k:v for k,v in record.items() if k!='id'})
        row['scores']=score(q,response,suite['sources'])
        rows.append(row)
    summary=write_results(rows,args.out,args.suite,args.url or 'stored responses',started)
    print(json.dumps(summary['overall'],indent=2))


if __name__=='__main__':
    main()
