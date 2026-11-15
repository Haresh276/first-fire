"""Emit the prospective v2 deposit on stdout. Never overwrite a sealed record."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def record():
    path = ROOT / "flint-engine/results/core/results.json"
    report = json.loads(path.read_bytes())
    old = ROOT / "site/forecast-lock/fm2-v1.json"
    v1 = json.loads(old.read_bytes())
    runs = report["fm2"]["sim_aramid_L26"]
    limits = {run["L"] for run in runs.values()}
    assert len(limits) == 1
    predictions = []
    for previous, run in zip(v1["predictions"], sorted(runs.values(), key=lambda r: -r["X0"]), strict=True):
        start = round(run["X0"] * 100, 8)
        assert start == previous["starting_o2_pct"]
        predictions.append({"burn": previous["burn"], "starting_o2_pct": start,
                            "conditional_burn_length_cm": round(run["burned_cm"], 1)})
    return {
        "id": "FIRST-FIRE-FM2-v2-physics", "team": v1["team"],
        "status": "Prospective conditional model forecast; no measured outcome.",
        "design": v1["design"], "fuel_chemistry_assumption": "aramid-like",
        "assumed_flame_equivalent_limit_o2_pct": round(limits.pop() * 100, 8),
        "model": "FLINT 1.1 sealed chamber with combustion products. Each burn starts in fresh gas.",
        "predictions": predictions, "reported_length_precision_cm": 0.1,
        "probabilities": "See sealed v1; no revision to binary probabilities or comparator.",
        "resolution": v1["resolution"], "length_scoring": v1["secondary_length_evaluation"],
        "comparison": "Report v1 and v2 side by side for the same qualifying official lengths. Do not select the better forecast after seeing outcomes.",
        "provenance": {"file": path.relative_to(ROOT).as_posix(), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                       "selector": "fm2.sim_aramid_L26[*].{X0,L,burned_cm}", "v1_sha256": hashlib.sha256(old.read_bytes()).hexdigest()}
    }


if __name__ == "__main__":
    print(json.dumps(record(), ensure_ascii=False, indent=2))
