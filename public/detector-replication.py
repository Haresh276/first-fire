"""Replay the FIRST FIRE SAME-R out-of-block comparison with Python 3.10+.

python detector-replication.py
python detector-replication.py --raw ../data/raw --cache ./workbooks --download
The second form additionally needs xlrd==2.0.2. Obtain the original study,
analysis plan and result JSON beside this script, or use the offline edition.
"""
import argparse
import csv
import gzip
import hashlib
import io
import json
import math
import statistics as stats
from collections import Counter
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

HERE = Path(__file__).resolve().parent
MODELS = ('heater', 'material_mean', 'pooled_mean', 'pooled_median')
TRAINING = range(73, 87)
SHEET = 'Original (cut and paste)'
COLUMNS = ['Time', 'TestNumber', 'HeatingInProgress', 'ISSDetectorScatterMeasurement(Volts)', 'ISSDetectorSelfTest']
TABLE = 'PSI-101-experimental.csv'
CENSUS = 'psi-core-file-census.json.gz'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def load(filename):
    return json.loads((HERE / filename).read_text(encoding='utf8'))


def training_model(plan):
    raw = (HERE / 'detector-study.json').read_bytes()
    digest = sha(raw)
    if digest != plan['frozen_model']['training_sha256']:
        raise ValueError('Original training report fingerprint changed.')
    rows = json.loads(raw)['runs']
    if [r['number'] for r in rows] != list(TRAINING):
        raise ValueError('Expected the 14 original base runs.')
    response = [r['peak_drop_v'] for r in rows]
    slope, intercept = stats.linear_regression([r['heater_ratio'] for r in rows], response)
    materials = sorted({r['material'] for r in rows})
    model = dict(training_sha256=digest, slope_v_per_ratio=slope, intercept_v=intercept,
                 pooled_mean_v=stats.mean(response), pooled_median_v=stats.median(response),
                 material_means_v={m: stats.mean(r['peak_drop_v'] for r in rows if r['material'] == m) for m in materials})
    # Tiny platform differences in floating-point regression are immaterial at the release's precision.
    frozen = plan['frozen_model']
    for key in ('slope_v_per_ratio','intercept_v','pooled_mean_v','pooled_median_v'):
        if not math.isclose(model[key],frozen[key],rel_tol=1e-12):
            raise ValueError('Frozen coefficients disagree with the training rows.')
    if model['material_means_v'] != frozen['material_means_v']:
        raise ValueError('Frozen material means disagree with training rows.')
    return frozen


def predictions(model, material, ratio):
    return {'heater': round(max(0.0,model['intercept_v'] + ratio*model['slope_v_per_ratio']),9),
            'material_mean': model['material_means_v'][material], 'pooled_mean':model['pooled_mean_v'],
            'pooled_median':model['pooled_median_v']}


def nasa_url(filename, version):
    return 'https://psi.nasa.gov/geode-py/ws/studies/PSI-101/download?' + urlencode(
        {'file':filename,'version':version,'studyVersion':4})


def candidates(raw, plan):
    table = (raw/TABLE).read_bytes()
    census = (raw/CENSUS).read_bytes()
    inputs = {TABLE:sha(table),CENSUS:sha(census)}
    expected = load('detector-study.json')['table']['sha256']
    if inputs[TABLE] != expected:
        raise ValueError('Unexpected NASA condition table revision.')
    rows = list(csv.DictReader(io.StringIO(table.decode('utf-8-sig'))))
    ids = Counter(row['SAME Test #'] for row in rows)
    tree = next(s for s in json.loads(gzip.decompress(census))['investigations'] if s['accession']=='PSI-101')
    if tree['study_version'] != 4:
        raise ValueError('Expected PSI-101 v4.')
    result = []
    for address, condition in enumerate(rows,2):
        label = condition['SAME Test #']
        if not label.isdigit() or int(label) in TRAINING:
            continue
        if any(condition[key] != value for key,value in plan['conditions'].items()):
            continue
        material = condition['Sample Type']
        run = dict(number=int(label), material=material, table_row=address, date=condition['Date'],
                   heater_ratio=float(condition['Rt/R0']), description=condition['Description'])
        # Keep both ambiguous condition rows in the ledger.
        if ids[label] > 1:
            run['excluded'] = 'Base ID has conflicting material assignments in the condition table.'
        else:
            matches = [entry for entry in tree['file_tree'] if entry[3]=='Analyzed Data'
                       and entry[4].startswith('Reduced Gravity/') and entry[4].endswith('/Run '+label.zfill(3))
                       and material.lower() in entry[4].lower().replace('cotton lamp wick','lampwick')
                       and entry[0].lower().endswith('_run'+label+'.xls')]
            if len(matches) != 1:
                run['excluded'] = f'{len(matches)} matching analyzed base-run workbooks in the file census.'
            else:
                path,version,size,_,folder = matches[0]
                name = Path(path).name
                run.update(filename=name, file_version=version, bytes=size, folder=folder, url=nasa_url(name,version))
        result.append(run)
    return inputs, sorted(result,key=lambda r:(r['number'],r['table_row']))


class OpticalWindowError(ValueError):
    """A run has insufficient native measurements under the frozen optical rule."""


def extract(content, number):
    import xlrd
    book = xlrd.open_workbook(file_contents=content, on_demand=True)
    try:
        if SHEET not in book.sheet_names():
            raise OpticalWindowError('Original telemetry worksheet missing.')
        sh = book.sheet_by_name(SHEET)
        header = sh.row_values(0)
        if any(h not in header for h in COLUMNS):
            raise OpticalWindowError('A required telemetry channel is missing.')
        indexes = [header.index(h) for h in COLUMNS]
        if indexes != [1,3,17,22,92]:
            raise ValueError('Unexpected native column addresses.')
        timeline = []
        for idx in range(1,sh.nrows):
            t,test,heater,optical,self_test = [sh.cell_value(idx,j) for j in indexes]
            if test == number:
                timeline.append((idx+1,t,heater,optical,self_test))
        start = next((r for r in timeline if r[2]==1),None)
        if start is None:
            raise OpticalWindowError('Heater onset missing in the matched test records.')
        pre = [r for r in timeline if start[1]-30 <= r[1] < start[1]]
        trace = [r for r in timeline if start[1] <= r[1] <= start[1]+300]
        if not pre or not trace:
            raise OpticalWindowError('Preheat or response window has no measurements.')
        if any(r[4] != 0 or not isinstance(r[3],(float,int)) or not math.isfinite(r[3]) for r in pre+trace):
            raise OpticalWindowError('Invalid voltage or active self-test in the target window.')
        times = sorted({r[1] for r in pre+trace})
        span = [int(times[0]-start[1]),int(times[-1]-start[1])]
        gap = max(b-a for a,b in zip(times,times[1:]))
        if span[0]>-29 or span[1]<299 or gap>2:
            raise OpticalWindowError(f'Optical coverage {span[0]} to {span[1]} s, largest gap {gap:g} s.')
        peak = min(trace,key=lambda r:r[3])
        base = stats.median(r[3] for r in pre)
        return dict(heater_start_row=start[0],preheat_rows=[pre[0][0],pre[-1][0]],
                    baseline_n=len(pre),trace_n=len(trace),baseline_v=base,peak_row=peak[0],minimum_v=peak[3],
                    peak_time_s=int(peak[1]-start[1]),observed_drop_v=round(base-peak[3],9))
    finally:
        book.release_resources()


def score(rows, model):
    if not rows: return {'n':0,'mae_v':{}}
    errors = {m:[] for m in MODELS}
    for row in rows:
        predicted = predictions(model,row['material'],row['heater_ratio'])
        for key in MODELS:
            errors[key].append(abs(predicted[key]-row['observed_drop_v']))
    return {'n':len(rows),'mae_v':{m:round(stats.mean(values),9) for m,values in errors.items()}}


def summarize(ledger, model):
    all_rows = [row for row in ledger if 'observed_drop_v' in row]
    primary = [row for row in all_rows if not row.get('overlap')]
    materials = sorted({row['material'] for row in primary})
    grouped = {m:score([row for row in primary if row['material']==m],model) for m in materials}
    return dict(primary=score(primary,model),by_material=grouped,
                earlier=score([row for row in primary if row['number']<TRAINING.start],model),
                later=score([row for row in primary if row['number']>=TRAINING.stop],model),
                equal_material_mae_v={k: round(stats.mean(v['mae_v'][k] for v in grouped.values()),9) for k in MODELS},
                including_overlap=score(all_rows,model))


def rebuild(raw, cache, plan, model, download, pinned):
    inputs, ledger = candidates(raw, plan)
    cache.mkdir(exist_ok=True,parents=True)
    for row in ledger:
        if 'excluded' in row: continue
        number = row['number']
        path = cache/f'run-{number}.xls'
        if not path.exists() and download:
            with urlopen(row['url'],timeout=90) as resp: content=resp.read()
        else: content=path.read_bytes()
        fingerprint = sha(content)
        if len(content) != row['bytes'] or (pinned and pinned.get(number)!=fingerprint):
            raise ValueError(f'Unexpected workbook bytes for run {number}.')
        if not path.exists(): path.write_bytes(content)
        row['sha256'] = fingerprint
        try: row.update(extract(content, number))
        except OpticalWindowError as error:
            row['excluded']=str(error)
            continue
        row['predicted_v'] = predictions(model,row['material'],row['heater_ratio'])
        if str(number) in plan['primary_exclusions']:
            row['overlap'] = plan['primary_exclusions'][str(number)]
    return dict(version=1, plan_sha256=sha((HERE/'detector-replication-plan.json').read_bytes()),
                inputs=inputs, source='NASA SAME-R / PSI-101 v4', worksheet=SHEET,
                columns=dict(time='B',test='D',heater='R',optical='W',self_test='CO'),
                ledger=ledger,results=summarize(ledger,model))


def verify(report, plan, model):
    if report['plan_sha256']!=sha((HERE/'detector-replication-plan.json').read_bytes()):
        raise ValueError('Analysis plan fingerprint changed.')
    for row in report['ledger']:
        if 'observed_drop_v' in row:
            observed=round(row['baseline_v']-row['minimum_v'],9)
            expected=predictions(model,row['material'],row['heater_ratio'])
            if row['observed_drop_v'] != observed or row['predicted_v'] != expected:
                raise ValueError(f"Optical drop or forecast mismatch for run {row['number']}.")
            if row.get('overlap') != plan['primary_exclusions'].get(str(row['number'])):
                raise ValueError('Primary inclusion differs from the plan.')
    if report['results'] != summarize(report['ledger'],model): raise ValueError('Score mismatch.')


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--raw',type=Path,help='Folder holding the original table and file census.')
    parser.add_argument('--cache',type=Path,help='Folder for original Excel workbooks.')
    parser.add_argument('--download',action='store_true',help='Retrieve missing public NASA workbooks.')
    parser.add_argument('--build',action='store_true',help='Create results from original bytes.')
    args=parser.parse_args()
    if bool(args.raw) != bool(args.cache) or (args.download or args.build) and not args.raw:
        parser.error('Use --raw and --cache together for source checks.')
    plan=load('detector-replication-plan.json')
    model=training_model(plan)
    output=HERE/'detector-replication.json'
    result=json.loads(output.read_bytes()) if not args.build else None
    if args.raw:
        pins={r['number']:r['sha256'] for r in result['ledger'] if 'sha256' in r} if result else {}
        rebuilt=rebuild(args.raw,args.cache,plan,model,args.download,pins)
        if result is not None and result != rebuilt: raise ValueError('Source replay differs from release.')
        result=rebuilt
    verify(result,plan,model)
    if args.build: output.write_text(json.dumps(result,indent=2,ensure_ascii=False,allow_nan=False)+'\n',encoding='utf8')
    print(json.dumps(result['results'],indent=2))
