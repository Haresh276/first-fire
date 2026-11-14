"""Rebuild FIRST FIRE's observation table and investigation catalogue offline. Python 3.9+."""
import argparse
import csv
import hashlib
import io
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
FIELDNAMES = """accession test_id record_id source_row material phase gravity_g gravity_regime o2_initial_pct o2_final_pct o2_burner_pct o2_low_pct o2_high_pct o2_qualifier pressure_psia flow_cm_s burn_time_s outcome source_file doi quality_notes observation_type source_url instrument_id fuel_ambient_initial_pct oxygen_flow_mg_s hot_ignition termination_code initial_diameter_mm visible_extinction_diameter_mm direction material_detail fan_display air_display test_date test_time nitrogen_initial_pct co2_initial_pct helium_initial_pct smoke_heating_s smoke_aging_s reported_pressure reported_pressure_unit""".split()
ATM_PSIA = 14.6959487755
INFO = {
    10: ("Flame Design", "Flame physics", "Varies gas composition, pressure and flow to study soot in normal and inverse flames.", "Two raw test tables. The PSI license field is empty. See the dataset for reuse terms."),
    20: ("BRE", "Prevention", "Uses a gas burner to emulate different solid fuels in quiet surroundings.", "Raw table groups several oxygen levels and ignitions into each day."),
    21: ("CLD Flame", "Flame physics", "Examines the structure and stability of gas diffusion flames across fuel dilution levels.", "Raw table summarizes test days and ranges."),
    22: ("E-FIELD Flames", "Flame physics", "Applies electric fields to change flame flow and shape in microgravity.", "Raw table summarizes test days. Electrical forcing supplies an analogy to gravity."),
    23: ("s-Flame", "Flame physics", "Studies transport and chemical reactions in spherical diffusion flames.", "Raw table summarizes test days and gas mixtures."),
    25: ("BASS-II", "Prevention", "Examines ignition, spread and extinction of solids in low-speed forced flow.", "Initial and final oxygen are distinct. Table records fan and air displays without a velocity calibration or sustained-burning outcome."),
    26: ("BASS", "Prevention", "Examines solid fuels of different shapes and thicknesses in forced flow.", "One maintenance row excluded. Repeated as-run numbers distinguished by their planned-test numbers."),
    39: ("CFI", "Detection", "Studies cool flames in liquid hydrocarbon droplets as pressure and dilution vary.", "Eight exact repeated records removed. Composition and pressure are available; a cool-flame outcome per row is unavailable."),
    68: ("FLEX-2", "Suppression", "Extends droplet experiments to fuel mixtures and weak imposed convection.", "Raw CSV gives ranges and candidate levels by fuel. Individual realized combinations are unavailable in this table."),
    69: ("FLEX", "Suppression", "Measures droplet burning and visible extinction in controlled oxygen and diluent mixtures.", "Visible extinction, disruption and completion remain separate. Consult the experiment report for post-visible behavior."),
    98: ("Saffire-I", "Prevention", "Examines large cotton-fiberglass fabric in concurrent and opposed airflow in an uncrewed Cygnus vehicle.", "Two burns used the same specimen. Excludes camera and pre-flow records."),
    99: ("Saffire-II", "Prevention", "Compares spacecraft materials and flame spread directions in an uncrewed cargo vehicle.", "Nine sample records. Oxygen is derived from carbon dioxide production and the initial ISS measurement."),
    100: ("Saffire-III", "Prevention", "Studies concurrent and opposed flow around large cotton-fiberglass fabric at 30 cm/s.", "The experimental CSV omits pressure, oxygen and endpoint."),
    101: ("SAME-R", "Detection", "Varies material heating, smoke transport and aging to characterize aerosols for detection.", "Inlet velocity refers to the smoke source. Rows include aged observations. Test 57 is listed for two materials."),
    102: ("SAME", "Detection", "Studies aerosol growth from heated spacecraft materials under different flow and aging conditions.", "Raw table lists settings and grouped materials. It supplies no alarm times or individual alarm trials."),
    106: ("SLICE", "Flame physics", "Examines the structure, stability and liftoff of a gas diffusion flame.", "Raw table groups fuels and calibration work by test day."),
    107: ("SPICE", "Flame physics", "Varies fuel and air delivery around gas jets to study their onset of soot emission.", "Settings can repeat within one ignition. The raw table is available without promoting rows to separate burns."),
    115: ("SAME smoke modeling", "Detection", "Uses smoke measurements to model aerosol transport and growth under different gravity conditions.", "Ground simulation using SAME data. PSI lists no experimental CSV for this record."),
    159: ("CFI-G", "Flame physics", "Studies normal and inverse gas diffusion flames with a spherical burner.", "Normal oxygen is in the chamber. Inverse oxygen is in the burner stream. Ignition and termination are separate fields.")
}


def number(value, units="", factor=1):
    text = str(value).strip()
    if units and text.endswith(units):
        text = text[:-len(units)].strip()
    if not re.fullmatch(r"[-+]?(?:\d+(?:\.\d*)?|\.\d+)", text):
        return ""
    result = float(text) * factor
    return f"{result:.8f}".rstrip("0").rstrip(".") if result else "0"


def note(record, message):
    if message:
        record["quality_notes"] = " ".join(filter(None, [record.get("quality_notes"), message]))


def parse(n, r, table_index):
    rec = {}
    if n == 25:
        rec.update(test_id=r[1], material=r[5], phase="solid", o2_initial_pct=number(r[11]),
                   o2_final_pct=number(r[12]), fan_display=r[7], air_display=r[8], test_date=r[2], co2_initial_pct=number(r[13]))
        note(rec, "Fan and air values are instrument displays; velocity and sustained-burning endpoint unreported.")
        if rec["o2_final_pct"] and abs(float(r[11]) - float(r[12])) > 5:
            note(rec, "Large reported initial/final O₂ difference. Check flight records before use.")
    elif n == 26 and r[2].strip():
        rec.update(test_id=f"{r[2]} / {r[3]}", material=r[5], phase="solid", test_date=r[0])
        note(rec, "ID gives as-run / planned number. Preserve source material wording.")
    elif n == 39:
        rec.update(test_id=r[0], instrument_id=r[3], material=r[9], phase="liquid",
                   o2_initial_pct=number(r[5], factor=100), pressure_psia=number(r[4], "atm", ATM_PSIA),
                   test_date=r[1], reported_pressure=number(r[4], "atm"), reported_pressure_unit="atm",
                   nitrogen_initial_pct=number(r[6], factor=100), helium_initial_pct=number(r[7], factor=100))
    elif n == 69:
        rec.update(test_id=r[0], instrument_id=r[1], material=r[4], phase="liquid",
                   initial_diameter_mm=number(r[10]), visible_extinction_diameter_mm=number(r[11]),
                   o2_initial_pct=number(r[6], factor=100),
                   pressure_psia=number(r[5], factor=ATM_PSIA / 760) if float(r[5]) > 0 else "",
                   burn_time_s=number(r[13].lstrip("~")), outcome=r[14], test_date=r[2], test_time=r[3],
                   reported_pressure=r[5], reported_pressure_unit="mmHg",
                   nitrogen_initial_pct=number(r[7], factor=100), co2_initial_pct=number(r[8], factor=100),
                   helium_initial_pct=number(r[9], factor=100))
        if float(r[5]) <= 0:
            note(rec, "Source pressure is zero with active burning; omitted from quantitative comparisons.")
        if r[13].startswith("~"):
            note(rec, "Source marks the burn duration approximate.")
        if r[14] == "Extinction":
            note(rec, "This table alone cannot establish when all chemical heat release ended.")
    elif n in (98, 99, 100):
        if not re.fullmatch(r"2-[1-9]" if n == 99 else r"S[12]", r[0].strip()):
            return None
        rec.update(test_id=r[0], material=r[1], phase="solid", material_detail=(" × ".join(r[2:5]) + (" cm" if n == 98 else "")),
                   flow_cm_s=number(r[5], "cm/s"), direction=r[6 if n == 100 else 10].strip())
        if n != 100:
            oxygen = r[6].strip()
            endpoints = re.split(r"\s+(?:-|to)\s+", oxygen)
            if len(endpoints) > 1:
                vals = sorted(float(v) for v in endpoints)
                rec.update(o2_low_pct=number(vals[0]), o2_high_pct=number(vals[-1]), o2_qualifier="reported interval")
            else:
                # These values describe a burn condition, not a calibrated initial sample.
                pct = number(oxygen.lstrip("~"))
                rec.update(o2_low_pct=pct, o2_high_pct=pct, o2_qualifier="approximate reported condition")
            rec["burn_time_s"] = number(r[9], "s")
            if r[9].strip().lower() == "insignificant":
                note(rec, "Source describes burn time as insignificant; no numeric duration.")
        if n == 98:
            note(rec, "S2 used the remaining material from S1. Flow was stopped at 420 s in S1.")
        if n == 99:
            note(rec, "O₂ derived from CO₂ production and initial ISS oxygen; see CSV Note 1.")
            if not r[1]:
                note(rec, "Source material field blank.")
    elif n == 101:
        rec.update(test_id=r[1], material=r[0], phase="aerosol", flow_cm_s=number(r[4]),
                   observation_type="smoke observation", material_detail=r[2], test_date=r[3],
                   smoke_heating_s=number(r[6]), smoke_aging_s=number(r[9]))
        note(rec, "Inlet velocity at the smoke source. This observation supplies no detector alarm time.")
    elif n == 159:
        inverse = table_index == 2
        rec.update(test_id=r[3].strip(), material=r[2], phase="gas",
                   direction="inverse" if inverse else "normal",
                   reported_pressure=r[6 if inverse else 7], reported_pressure_unit="bar (approximate)",
                   pressure_psia=number(r[6 if inverse else 7], factor=100/101.325 * ATM_PSIA),
                   burn_time_s=number(r[14]), hot_ignition=r[13].strip().lower(),
                   termination_code=r[15].strip(), outcome=f"Hot ignition: {r[13].strip().lower()}")
        if inverse:
            rec.update(o2_burner_pct=number(r[7], factor=100), fuel_ambient_initial_pct=number(r[4], factor=100),
                       oxygen_flow_mg_s=number(r[9]))
            note(rec, "Inverse burner feeds oxidizer into gaseous fuel and diluent. Pressure is approximate.")
        else:
            rec.update(o2_initial_pct=number(r[5], factor=100), o2_final_pct=number(r[6], factor=100))
            note(rec, "Normal burner feeds gaseous fuel into oxidizing chamber. Pressure is approximate.")
    else:
        return None
    if rec.get("o2_initial_pct") and not rec.get("o2_qualifier"):
        rec.update(o2_qualifier="initial ambient", o2_low_pct=rec["o2_initial_pct"], o2_high_pct=rec["o2_initial_pct"])
    return rec


def render(raw):
    manifest = json.loads((raw / "psi-manifest.json").read_text(encoding="utf-8"))
    records, catalogue = [], []
    for m in manifest["investigations"]:
        acc, doi = m["accession"], m["doi"]
        n = int(acc[4:])
        name, category, summary, coverage = INFO[n]
        landing = f"https://psi.nasa.gov/physci/repo/data/investigations/{acc}"
        selected = 0
        for table_index, t in enumerate(m["tables"], 1):
            file = raw / t["local_file"]
            data = file.read_bytes()
            if hashlib.sha256(data).hexdigest() != t["sha256"] or len(data) != t["file_size"]:
                raise ValueError(f"Raw file does not match its NASA snapshot manifest: {file}")
            try:
                source = data.decode("utf-8-sig")
            except UnicodeDecodeError:
                source = data.decode("cp1252")
            reader = csv.reader(io.StringIO(source))
            header = next(reader)
            seen = set()
            for row, cells in enumerate(reader, 2):
                if not any(c.strip() for c in cells):
                    continue
                if len(header) != len(cells):
                    raise ValueError(f"Column count changed in {file}, row {row}")
                if n == 39 and tuple(cells) in seen:
                    continue
                seen.add(tuple(cells))
                rec = parse(n, cells, table_index)
                if rec is None:
                    continue
                rec.update(accession=acc, doi=doi, source_file="data/raw/" + file.name,
                           source_url=t["download_url"], source_row=row, record_id=f"{acc}:{table_index}:{row}",
                           gravity_g="0", gravity_regime="orbital microgravity (nominal g)",
                           observation_type=rec.get("observation_type", "test record"))
                records.append(rec)
                selected += 1
        platform = "Cygnus after ISS departure" if n in (98, 99, 100) else (
            "Ground simulation" if n == 115 else m["flightProgram"])
        catalogue.append(dict(accession=acc, name=name, title=m["title"], category=category, summary=summary,
                              doi=doi, url=landing, rows=selected, coverage=coverage, platform=platform,
                              hardware=m["experimentHardware"], license=m["licenseIdentifier"] or None,
                              version=m["version"], metadata_url=m["metadata_url"],
                              tables=[dict(file="data/raw/" + t["local_file"], url=t["download_url"],
                                           name=t["file_name"], sha256=t["sha256"]) for t in m["tables"]]))
    ids = {r["record_id"] for r in records}
    if len(ids) != len(records):
        raise ValueError("Observation key collision")
    out = io.StringIO(newline="")
    writer = csv.DictWriter(out, fieldnames=FIELDNAMES, lineterminator="\n")
    writer.writeheader()
    writer.writerows(records)
    return {"tests.csv": out.getvalue(), "investigations.json": json.dumps(catalogue, indent=2, ensure_ascii=False) + "\n"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="check source hashes and committed generated bytes")
    args = parser.parse_args()
    outputs = render(RAW)
    for filename, contents in outputs.items():
        path = ROOT / "data" / filename
        if args.check:
            if not path.exists() or path.read_bytes() != contents.encode():
                raise SystemExit(f"Generated file differs: {filename}")
        else:
            path.write_bytes(contents.encode())
    print("Verified NASA source hashes and derived tables." if args.check else "Built tests.csv and investigations.json.")


if __name__ == "__main__":
    main()
