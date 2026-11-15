"""Replay two FIRST FIRE source audits. Standard-library Python 3.9+.

python3 reproduce.py --raw path/to/data/raw --out path/to/output
Inputs are the original NASA CSVs, their PSI manifest, and the reduced NASA
file-list snapshot (psi-core-file-census.json.gz) from the offline distribution.
"""
import argparse
import csv
import gzip
import hashlib
import json
import re
from collections import Counter, defaultdict
from decimal import Decimal
from pathlib import Path
from urllib.parse import urlencode


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def table_rows(raw, table):
    path = raw / table["local_file"]
    if sha(path) != table["sha256"]:
        raise ValueError(f"{path.name} differs from the NASA manifest")
    with path.open(encoding="utf-8-sig", newline="") as source:
        for n, row in enumerate(csv.DictReader(source), 2):
            if any(value.strip() for value in row.values()):
                yield n, row


def flight_folders(snapshot):
    study = next(study for study in snapshot["investigations"] if study["accession"] == "PSI-101")
    entries = {r[0]: r for r in study["file_tree"] + study["release_additions"]}
    folders = defaultdict(list)
    for path, version, size, category, subcategory in entries.values():
        match = re.fullmatch(r"Reduced Gravity/([^/]+)/Run (\d+)", subcategory)
        if match:
            material = {"Cotton Lamp wick": "Lampwick"}.get(match[1], match[1])
            name = Path(path).name
            query = urlencode({"file": name, "version": version, "studyVersion": study["study_version"]})
            url = f"https://psi.nasa.gov/geode-py/ws/studies/PSI-101/download?{query}"
            folders[material, int(match[2])].append((category != "Analyzed Data", name, url, subcategory))
    return {key: sorted(items)[0] for key, items in folders.items()}


def smoke_crosswalk(raw, study, folders):
    table = study["tables"][0]
    records = list(table_rows(raw, table))
    groups = defaultdict(list)
    materials = defaultdict(set)
    for n, row in records:
        match = re.fullmatch(r"(\d+)(a?)", row["SAME Test #"].strip())
        if not match:
            raise ValueError(f"Unrecognized SAME-R test label at source row {n}")
        key = (row["Sample Type"], int(match[1]))
        groups[key].append((n, row, match[2]))
        materials[key[1]].add(key[0])

    output = []
    for (material, number), group in groups.items():
        folder = folders.get((material, number))
        dates = {row["Date"] for _, row, _ in group}
        for n, row, suffix in group:
            flags = []
            if len(materials[number]) > 1:
                flags.append("numeric label used for multiple materials")
            if len(dates) > 1:
                flags.append("base and suffixed observations have different dates")
            if not folder:
                flags.append("no matching material and number in reduced-gravity run folders")
            output.append({
                "record_id": f"PSI-101:1:{n}", "csv_row": n, "material": material,
                "raw_test_label": row["SAME Test #"], "numeric_label": number,
                "label_form": "a-suffixed observation" if suffix else "unsuffixed observation",
                "source_description": row["Description"], "source_date": row["Date"],
                "net_aging_s_raw": row["Net aging time (sec)"],
                "same_material_group_rows": "|".join(str(member[0]) for member in group),
                "catalogue_run_folder": folder[3] if folder else "",
                "example_catalogue_file": folder[2] if folder else "",
                "mapping_flags": " | ".join(flags), "source_table": table["download_url"],
            })
    only_folders = sorted(set(folders) - set(groups))
    only_table = sorted(set(groups) - set(folders))
    return sorted(output, key=lambda row: row["csv_row"]), {
        "source_observations": len(output),
        "label_forms": dict(Counter(row["label_form"] for row in output)),
        "distinct_numeric_labels": len(materials), "material_number_groups": len(groups),
        "number_collisions": {number: sorted(names) for number, names in materials.items() if len(names) > 1},
        "table_material_groups_by_material": dict(Counter(material for material, _ in groups)),
        "distinct_catalogue_material_number_folders": len(folders),
        "matched_material_number_groups": len(set(groups) & set(folders)),
        "groups_missing_catalogue_folder": only_table,
        "catalogue_groups_missing_table_rows": [
            {"material": mat, "number": num, "example_file": folders[mat, num][2]} for mat, num in only_folders
        ],
        "published_completed_test_points": 66,
        "published_scope": "NASA's PSI-101 Approach section counts completed SAME-R flight test points, 16 July to 9 September 2010. Post-flight ground tests are described separately.",
        "published_source": "https://psi.nasa.gov/physci/repo/data/investigations/PSI-101",
        "boundary": "A folder confirms a material/number catalogue association. The source does not list the mission's completion decision per observation. A repeat or reburn remains a distinct numbered group. Row numbers count the CSV header as row 1.",
    }


def oxygen_audit(raw, study):
    populations, above = {}, {}
    false_matches = []
    for index, table in enumerate(study["tables"], 1):
        inverse = table["file_name"].endswith("Inverse Flames.csv")
        field = "XO2" if inverse else " XO2 before test"
        location = "burner_stream" if inverse else "initial_chamber"
        populations[location], above[location] = 0, 0
        for n, row in table_rows(raw, table):
            populations[location] += 1
            if Decimal(row[field]) < Decimal("0.34"):
                continue
            above[location] += 1
            if inverse:
                false_matches.append({
                    "record_id": f"PSI-159:{index}:{n}", "csv_row": n, "test_id": row["Test"].strip(),
                    "fuel": row["Fuel"], "oxygen_field": field, "oxygen_location": location,
                    "raw_o2_mole_fraction": row[field], "burner_o2_pct": str(100 * Decimal(row[field])),
                    "raw_initial_chamber_fuel_fraction": row["Xf  before test"],
                    "source_table": table["download_url"],
                })
    return false_matches, {
        "predicate": "Keep all nonempty CFI-G rows, across all fuels and ignition outcomes. Normal flames: Decimal(row[' XO2 before test']) >= Decimal('0.34') (column F, initial chamber). Inverse flames: Decimal(row['XO2']) >= Decimal('0.34') (column H, burner stream).",
        "nonempty_attempts": sum(populations.values()), "by_location": populations, "above_or_equal": above,
        "naively_pooled": sum(above.values()), "extra_burner_only_matches": len(false_matches),
        "boundary": "A burner-stream oxygen value cannot establish ambient cabin oxygen. The corrected result identifies source chamber conditions in gas-flame tests; it is not a validated habitat material comparison.",
    }


def save_csv(path, rows):
    with path.open("w", newline="", encoding="utf-8") as target:
        writer = csv.DictWriter(target, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw", required=True, type=Path)
    parser.add_argument("--out", type=Path, default=Path.cwd())
    args = parser.parse_args()
    manifest = json.loads((args.raw / "psi-manifest.json").read_text(encoding="utf-8"))
    studies = {i["accession"]: i for i in manifest["investigations"]}
    census = args.raw / "psi-core-file-census.json.gz"
    with gzip.open(census, "rt", encoding="utf-8") as source:
        files = json.load(source)
    smoke, smoke_summary = smoke_crosswalk(args.raw, studies["PSI-101"], flight_folders(files))
    oxygen, oxygen_summary = oxygen_audit(args.raw, studies["PSI-159"])
    summary = {
        "schema": "first-fire.source-crosswalk.v1", "same_r": smoke_summary, "cfi_g": oxygen_summary,
        "source_tables": [table for key in ("PSI-101", "PSI-159") for table in studies[key]["tables"]],
        "psi_file_list_endpoint": files["file_list_endpoint"], "file_census_sha256": sha(census),
    }
    args.out.mkdir(parents=True, exist_ok=True)
    save_csv(args.out / "same-r-observations.csv", smoke)
    save_csv(args.out / "cfi-g-burner-matches.csv", oxygen)
    (args.out / "summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
