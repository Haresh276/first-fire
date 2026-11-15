"""Replay a four-workbook comparison from NASA PSI-101 v4.

Install xlrd==2.0.2, then run python replay_same.py --cache PATH.
Add --figure same-r-kapton.png to render the figure with matplotlib.
"""

import argparse
import hashlib
import json
import statistics
import urllib.parse
import urllib.request
from pathlib import Path

import xlrd


FLIGHTS = {
    75: ("2010_238_18", "5425dd10abfec38d6da32ca042f48a89c8056f7024b9ecb87ba7e415178f8259"),
    85: ("2010_242_12", "1f94817bc0544830a75b5f61d351efb99d4fa5a100353de1fe636a5c25572ec0"),
    93: ("2010_250_13", "34ee218a0cb5941fb32c270f2e1b9eac2ed772cc263e8d29d53a7aeb53b792e4"),
    92: ("2010_250_16", "8483b6080c4ea1a5cc20db412d319b6706373659466daf3cacfa4bba7b42b210"),
}
SHEET = "Original (cut and paste)"
SCATTER = "ISSDetectorScatterMeasurement(Volts)"


def fetch(run, cache):
    stamp, digest = FLIGHTS[run]
    name = f"PSI-101_Analyzed Data_{stamp}_kapton_run{run}.xls"
    query = urllib.parse.urlencode({"file": name, "version": 1, "studyVersion": 4})
    url = f"https://psi.nasa.gov/geode-py/ws/studies/PSI-101/download?{query}"
    path = cache / f"first-fire-same-{run}.xls"
    if path.exists():
        data = path.read_bytes()
    else:
        with urllib.request.urlopen(url, timeout=90) as response:
            data = response.read()
    if hashlib.sha256(data).hexdigest() != digest:
        raise ValueError(f"Unexpected SHA-256 for {name}. Check the source version.")
    if not path.exists():
        path.write_bytes(data)
    return data, url


def read_run(run, data, url):
    book = xlrd.open_workbook(file_contents=data, on_demand=True)
    sheet = book.sheet_by_name(SHEET)
    headers = sheet.row_values(0)
    rows = [dict(zip(headers, sheet.row_values(i)), excel_row=i + 1) for i in range(1, sheet.nrows)]
    book.release_resources()
    target = [r for r in rows if r["TestNumber"] == run]
    heater_start = next(r["Time"] for r in target if r["HeatingInProgress"] == 1)
    before = [r[SCATTER] for r in target if -30 <= r["Time"] - heater_start < 0]
    baseline = statistics.median(before)
    points = [(r["Time"] - heater_start, baseline - r[SCATTER], r["excel_row"])
              for r in target if 0 <= r["Time"] - heater_start <= 300]
    peak_time, peak, peak_row = max(points, key=lambda p: p[1])
    for channel in ("STSDetectorPower", "STSDetectorAlarm"):
        if any(r[channel] not in (0, 1) for r in target):
            raise ValueError(f"Unexpected value in {channel} in run {run}")
    result = {
        "run": run, "source": url, "sha256": FLIGHTS[run][1],
        "sheet": SHEET, "source_data_rows": len(rows), "test_number_rows": len(target),
        "sts_power_on_rows": sum(r["STSDetectorPower"] == 1 for r in target),
        "sts_alarm_on_rows": sum(r["STSDetectorAlarm"] == 1 for r in target),
        "baseline_samples": len(before), "median_baseline_V": baseline,
        "post_start_samples": len(points), "max_drop_from_baseline_V": round(peak, 6),
        "seconds_after_heater_start_at_max_drop": peak_time, "scatter_peak_cell": f"W{peak_row}",
    }
    return result, points


def plot(results, traces, output):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.ticker import MaxNLocator

    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 11, "text.color": "#172e37",
                         "axes.labelcolor": "#294752", "xtick.color": "#39545e", "ytick.color": "#39545e"})
    fig = plt.figure(figsize=(11, 6.3), facecolor="white")
    fig.text(.075, .93, "What could the smoke detectors see?", fontsize=23, weight="bold")
    fig.text(.075, .873, "Three Kapton smoke runs on the ISS, plus one run designated for the Shuttle detector.", fontsize=12)
    left, right = fig.subplots(1, 2, gridspec_kw={"width_ratios": [1.7, 1]})
    fig.subplots_adjust(left=.09, right=.96, top=.72, bottom=.26, wspace=.34)
    colors = {75: "#24699d", 85: "#ad4227", 93: "#247763"}
    styles = {75: "-", 85: "--", 93: "-."}
    for run, color in colors.items():
        points = traces[run]
        left.plot([p[0] for p in points], [p[1] for p in points], color=color,
                  lw=1.8, ls=styles[run], label=f"Run {run}")
    left.set_title("ISS light-scattering channel", loc="left", fontsize=13, fontweight="bold", pad=13)
    left.set(xlim=(0, 300), xlabel="Seconds after heater flag first turned on",
             ylabel="Drop from baseline (V)")
    left.yaxis.set_major_locator(MaxNLocator(6))
    left.legend(frameon=False, loc="upper left", ncol=3, fontsize=8, columnspacing=1)
    left.grid(axis="y", color="#dce4e7", lw=.7)
    right.set_title("Shuttle detector power", loc="left", fontsize=13, weight="bold", pad=13)
    for i, r in enumerate(results):
        fraction = r["sts_power_on_rows"] / r["test_number_rows"]
        right.barh(i, 1, height=.43, color="#e6ecee")
        right.barh(i, fraction, height=.43, color="#375766")
        right.text(.04, i, f'{r["sts_power_on_rows"]:,} / {r["test_number_rows"]:,}',
                   va="center", fontsize=10, color="white" if fraction > .5 else "#294752")
    right.set(yticks=range(4), yticklabels=["Run 75", "Run 85", "Run 93", "Run 92*"],
              xlim=(0, 1), xticks=[0, .5, 1], xticklabels=["0%", "50%", "100%"],
              xlabel="Share of run records with power on")
    right.invert_yaxis()
    for ax in (left, right):
        for edge in ("top", "right"):
            ax.spines[edge].set_visible(False)
        for edge in ("bottom", "left"):
            ax.spines[edge].set_color("#a4b5bb")
    fig.text(.075, .14, "Runs 75, 85 and 93 used the same nominal inlet speed, heater setting and heating duration.", fontsize=10)
    fig.text(.075, .102, "*Run 92 used a different heater setting. Power is a prerequisite for interpreting the alarm channel.", fontsize=10)
    fig.text(.075, .045, "NASA PSI-101 v4  ·  SAME-R original telemetry  ·  DOI 10.60555/2np7-jv14  ·  Analysis by FIRST FIRE", fontsize=9, color="#536971")
    fig.savefig(output, dpi=180, facecolor="white")
    plt.close(fig)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--figure", type=Path)
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    results, traces = [], {}
    for run in FLIGHTS:
        data, url = fetch(run, args.cache)
        result, traces[run] = read_run(run, data, url)
        results.append(result)
    print(json.dumps(results, indent=2))
    if args.figure:
        plot(results, traces, args.figure)


if __name__ == "__main__":
    main()
