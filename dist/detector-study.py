"""Reproduce the FIRST FIRE flight detector study with Python 3.10+.

Offline: python detector-study.py --verify detector-study.json
Raw NASA check: pip install xlrd==2.0.2, then use --verify detector-study.json
--cache ./workbooks --download. An existing cache can be checked without network.
To rebuild from the FIRST FIRE source tree: --build --cache ./workbooks
"""
import argparse
import csv
import gzip
import hashlib
import io
import json
import math
import statistics as stats
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

HERE = Path(__file__).resolve().parent
RUNS = range(73, 87)
SHEET = "Original (cut and paste)"
HEADER = ["Time", "TestNumber", "HeatingInProgress", "ISSDetectorScatterMeasurement(Volts)", "ISSDetectorSelfTest"]
MODELS = ["heater", "median", "mean"]
CUT = 2.0


def digest(data):
    return hashlib.sha256(data).hexdigest()


def url(name):
    return "https://psi.nasa.gov/geode-py/ws/studies/PSI-101/download?" + urlencode(
        {"file": name, "version": 1, "studyVersion": 4})


def source_bytes(path, source, download):
    if not path.exists() and download:
        if not source["url"].startswith("https://psi.nasa.gov/geode-py/ws/studies/PSI-101/download?"):
            raise ValueError("Expected a NASA PSI-101 source")
        with urlopen(source["url"], timeout=60) as response:
            data = response.read()
        if digest(data) != source["sha256"]:
            raise ValueError(f"NASA bytes differ from the release for {path.name}")
        path.write_bytes(data)
    data = path.read_bytes()
    if digest(data) != source["sha256"]:
        raise ValueError(f"Unexpected SHA-256 for {path.name}")
    return data


def table_conditions(data, number):
    rows = csv.DictReader(io.StringIO(data.decode("utf-8-sig")))
    matches = [(i, row) for i, row in enumerate(rows, 2) if row["SAME Test #"] == str(number)]
    if len(matches) != 1:
        raise ValueError(f"Cannot join base test {number} to one conditions row")
    i, row = matches[0]
    if [row[k] for k in ["Inlet velocity (cm/s)", "Duration (sec)", "Primary aging time (sec)", "Primary mixing time (sec)"]] != ["8.1", "60", "11", "8"]:
        raise ValueError(f"Different experimental setup in {number}")
    return dict(table_row=i, material=row["Sample Type"], date=row["Date"], heater_ratio=float(row["Rt/R0"]))


def extract(data, number):
    import xlrd
    workbook = xlrd.open_workbook(file_contents=data, on_demand=True)
    try:
        sheet = workbook.sheet_by_name(SHEET)
        cols = [sheet.row_values(0).index(field) for field in HEADER]
        if cols != [1, 3, 17, 22, 92]:
            raise ValueError("Unexpected workbook columns")
        rows = [(i+1, *(sheet.cell_value(i, c) for c in cols)) for i in range(1, sheet.nrows)
                if sheet.cell_value(i, cols[1]) == number]
        start = next(r for r in rows if r[3] == 1)
        pre = [r for r in rows if -30 <= r[1]-start[1] < 0]
        trace = [r for r in rows if 0 <= r[1]-start[1] <= 300]
        if not pre or not trace or any(r[5] != 0 or not math.isfinite(r[4]) for r in pre+trace):
            raise ValueError(f"Missing or self-test data in {number}")
        # Keep native records, including records which carry the same whole-second timestamp.
        times = sorted({r[1] for r in pre+trace})
        if times[0] > start[1]-29 or times[-1] < start[1]+299 or max(b-a for a,b in zip(times,times[1:])) > 2:
            raise ValueError(f"Incomplete optical window in {number}")
        peak = min(trace, key=lambda r:r[4])
        base = stats.median(r[4] for r in pre)
        return dict(heater_start_row=start[0], baseline_rows=[pre[0][0], pre[-1][0]],
                    baseline_n=len(pre), trace_n=len(trace), peak_row=peak[0], seconds_to_peak=int(peak[1]-start[1]),
                    baseline_v=base, minimum_raw_v=peak[4], peak_drop_v=round(base-peak[4],9))
    finally:
        workbook.release_resources()


def evaluate(runs, holdout):
    results = []
    for case in runs:
        training = [r for r in runs if r[holdout] != case[holdout]]
        features = [r["heater_ratio"] for r in training]
        target = [r["peak_drop_v"] for r in training]
        slope, intercept = stats.linear_regression(features, target)
        predicted = dict(heater=max(0,intercept+slope*case["heater_ratio"]), median=stats.median(target), mean=stats.mean(target))
        results.append(dict(number=case["number"], material=case["material"], training_ids=[r["number"] for r in training],
                            measured=case["peak_drop_v"], predicted={m:round(v,9) for m,v in predicted.items()}))

    def summarize(group):
        errors = {m:[abs(r["predicted"][m]-r["measured"]) for r in group] for m in MODELS}
        positive = [r for r in group if r["measured"] >= CUT]
        under = sum(r["predicted"]["heater"] < CUT for r in positive)
        false_above = sum(r["predicted"]["heater"] >= CUT and r["measured"] < CUT for r in group)
        return dict(n=len(group), mae={m:round(stats.mean(e),9) for m,e in errors.items()},
                    heater_error_range=[round(min(errors["heater"]),9),round(max(errors["heater"]),9)],
                    below_cut=sum(r["measured"]<CUT for r in group), false_below=under, false_above=false_above)
    groups = {material:summarize([r for r in results if r["material"]==material])
              for material in sorted({r["material"] for r in results})}
    return dict(overall=summarize(results),by_material=groups,predictions=results)


def make_results(runs):
    return {key:evaluate(runs,key) for key in ("number","material")}


def browser_data(study):
    # A classic script can load from an unpacked offline release as well as via HTTP.
    needed = ("number", "url", "heater_ratio", "peak_row")
    result = {key:study["folds"]["material"][key] for key in ("by_material", "predictions")}
    return dict(runs=[{k:r[k] for k in needed} for r in study["runs"]], fold=result)


def build(cache):
    raw = HERE.parent/"data/raw"
    table = (raw/"PSI-101-experimental.csv").read_bytes()
    census = json.loads(gzip.decompress((raw/"psi-core-file-census.json.gz").read_bytes()))
    entries = next(x for x in census["investigations"] if x["accession"]=="PSI-101")["file_tree"]
    rows = []
    for number in RUNS:
        match = [r for r in entries if r[0].lower().endswith(f"_run{number}.xls") and r[4].startswith("Reduced Gravity/")]
        if len(match) != 1: raise ValueError(f"Ambiguous workbook for run {number}")
        entry = match[0]
        name = Path(entry[0]).name
        data = (cache/f"first-fire-same-{number}.xls").read_bytes()
        conditions = table_conditions(table,number)
        if len(data)!=entry[2] or entry[1]!=1 or conditions["material"].lower() not in entry[4].lower().replace("cotton lamp wick","lampwick"):
            raise ValueError(f"File size, version or material mismatch in run {number}")
        rows.append(dict(number=number,**conditions,filename=name,url=url(name),sha256=digest(data),**extract(data,number)))
    return dict(study="NASA SAME-R / PSI-101 v4",doi="10.60555/2np7-jv14",worksheet=SHEET,
                columns=HEADER,table=dict(url=url("PSI-101_Experimental table_SAME-R.csv"),sha256=digest(table)),
                cut_volts=CUT,runs=rows,folds=make_results(rows))


if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    mode=parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--build",action="store_true")
    mode.add_argument("--verify",type=Path)
    parser.add_argument("--cache",type=Path)
    parser.add_argument("--download",action="store_true")
    args=parser.parse_args()
    if args.build:
        if not args.cache: parser.error("--build needs --cache")
        data=build(args.cache)
        (HERE/"detector-study.json").write_text(json.dumps(data,indent=2,allow_nan=False)+"\n")
        payload=json.dumps(browser_data(data),separators=(",",":"),allow_nan=False)
        (HERE/"detector-study-data.js").write_text("window.FFDetectorStudy="+payload+";\n")
    else:
        data=json.loads(args.verify.read_text())
        if [r["number"] for r in data["runs"]]!=list(RUNS) or data["folds"]!=make_results(data["runs"]):
            raise ValueError("Run list or held-out results differ")
        if args.download and not args.cache: parser.error("--download needs --cache")
        if args.cache:
            args.cache.mkdir(exist_ok=True,parents=True)
            source_table=source_bytes(args.cache/"PSI-101-experimental.csv",data["table"],args.download)
            for row in data["runs"]:
                number=row["number"]
                raw=source_bytes(args.cache/f"first-fire-same-{number}.xls",row,args.download)
                found={**table_conditions(source_table,number),**extract(raw,number)}
                if any(row[k]!=v for k,v in found.items()):raise ValueError(f"Run {number} differs")
    for fold, result in data["folds"].items():
        print(f"Held out by {fold}: {result['overall']}")
