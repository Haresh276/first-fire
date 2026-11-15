"""Rebuild or verify the SAME-R browser excerpt with xlrd 2.0.2.

Run python detector_source_check.py --cache DIR [--write]. Obtain the four
first-fire-same-<number>.xls files from the NASA links in detector.html.
"""

import argparse
import csv
import hashlib
import json
from pathlib import Path
from urllib.parse import urlencode

import xlrd

ROOT = Path(__file__).resolve().parents[1]
FILES = {
    75: ("2010_238_18", "5425dd10abfec38d6da32ca042f48a89c8056f7024b9ecb87ba7e415178f8259"),
    85: ("2010_242_12", "1f94817bc0544830a75b5f61d351efb99d4fa5a100353de1fe636a5c25572ec0"),
    93: ("2010_250_13", "34ee218a0cb5941fb32c270f2e1b9eac2ed772cc263e8d29d53a7aeb53b792e4"),
    92: ("2010_250_16", "8483b6080c4ea1a5cc20db412d319b6706373659466daf3cacfa4bba7b42b210"),
}
SHEET = "Original (cut and paste)"
FIELDS = ["Time", "HeatingInProgress", "ISSDetectorScatterMeasurement(Volts)", "STSDetectorPower", "STSDetectorAlarm"]


def source_url(filename):
    return "https://psi.nasa.gov/geode-py/ws/studies/PSI-101/download?" + urlencode(
        {"file": filename, "version": 1, "studyVersion": 4}
    )


def read_workbook(cache, number, condition_row, conditions):
    stamp, sha = FILES[number]
    filename = f"PSI-101_Analyzed Data_{stamp}_kapton_run{number}.xls"
    data = (cache / f"first-fire-same-{number}.xls").read_bytes()
    if hashlib.sha256(data).hexdigest() != sha:
        raise ValueError(f"Unexpected bytes for {filename}")
    workbook = xlrd.open_workbook(file_contents=data, on_demand=True)
    sheet = workbook.sheet_by_name(SHEET)
    headers = sheet.row_values(0)
    indexes = [headers.index(name) for name in FIELDS]
    assert indexes == [1, 17, 22, 62, 91] and headers.index("TestNumber") == 3
    records = []
    for i in range(1, sheet.nrows):
        row = sheet.row_values(i)
        if row[3] == number:
            time, heater, scatter, power, alarm = (row[k] for k in indexes)
            assert time.is_integer() and all(bit in (0, 1) for bit in (heater, power, alarm))
            records.append([i + 1, int(time), int(heater), scatter, int(power), int(alarm)])
    workbook.release_resources()
    return dict(number=number, filename=filename, sha256=sha, url=source_url(filename),
                conditionRow=condition_row, conditions=conditions, records=records)


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--cache", required=True, type=Path)
    cli.add_argument("--write", action="store_true")
    args = cli.parse_args()
    table = ROOT / "data/raw/PSI-101-experimental.csv"
    digest = "87164b7dc9168a4273c159f7a9f23699afbd06ad97b77974377e79b9bf8a3bef"
    assert hashlib.sha256(table.read_bytes()).hexdigest() == digest
    with table.open(newline="") as handle:
        lookup = {row["SAME Test #"]: (i, row) for i, row in enumerate(csv.DictReader(handle), 2)}
    source = dict(doi="10.60555/2np7-jv14", investigation="PSI-101", studyVersion=4, fileVersion=1,
                  worksheet=SHEET, tableUrl=source_url("PSI-101_Experimental table_SAME-R.csv"),
                  tableSha256=digest, columns=["Excel row", *FIELDS],
                  runs=[read_workbook(args.cache, n, *lookup[str(n)]) for n in FILES])
    output = ROOT / "site/detector-telemetry.js"
    encoded = "window.FFDetectorTelemetry=" + json.dumps(source, separators=(",", ":"), allow_nan=False) + ";\n"
    if args.write:
        output.write_text(encoded)
    elif not output.exists() or output.read_text() != encoded:
        raise SystemExit("Browser data differ from source extraction.")
    print("Verified", sum(len(run["records"]) for run in source["runs"]), "telemetry rows from four NASA workbooks.")


if __name__ == "__main__":
    main()
