#!/usr/bin/env python3
"""Rebuild the illustrative FM2 forecast and score hypothetical outcomes (stdlib only)."""

import argparse
import json
import math
from pathlib import Path
from statistics import NormalDist

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "forecast.json"
AS_OF = "2026-11-14"
TARGETS = (37, 33, 29, 25)
BASELINE = (0.9, 0.9, 0.9, 0.1)
SOURCES = [
    {"id": "lpsc-slides", "title": "Ferkul et al., Material Flammability at Lunar and Martian Gravity (LPSC 2026)",
     "url": "https://ntrs.nasa.gov/api/citations/20260001966/downloads/Ferkul-Lunar%20and%20Planetary%20Science%20Conf%202026%20v2.pdf",
     "locator": "PDF pages 5, 6, 9–11, 14 (printed slides 4, 5, 8–10, 13)",
     "supports": "Expected 24–26% limit and qualitative outcomes; sample, pressure, oxygen, ignition, and diagnostics."},
    {"id": "lpsc-abstract", "title": "Ferkul et al., LPSC abstract 1799 (2026)",
     "url": "https://www.hou.usra.edu/meetings/lpsc2026/pdf/1799.pdf",
     "locator": "PDF pages 1–2, Combustion on the Moon",
     "supports": "Four planned samples, quiescent atmosphere, long-duration lunar gravity, and experimental context."},
    {"id": "glenn", "title": "NASA Glenn, Flammability of Materials on the Moon",
     "url": "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/flammability-of-materials-on-the-moon-fm2/",
     "locator": "Objectives; Approach and Hardware",
     "supports": "Purpose, individual samples, autonomous chamber, cameras and sensor observables."},
    {"id": "earlier-concept", "title": "Zayac et al., Flammability of Materials on the Moon (2024)",
     "url": "https://ntrs.nasa.gov/citations/20240015307", "locator": "Abstract",
     "supports": "Earlier prototype and CP-21 concept; its delivery description differs from the later slides."},
    {"id": "fy2027-plan", "title": "NASA FY 2027 Budget Estimates (April 2026)",
     "url": "https://www.nasa.gov/wp-content/uploads/2026/04/fiscal-year-2027-full-budget-request.pdf",
     "locator": "Science: Biological and Physical Sciences; planned FY 2027 activities",
     "supports": "The budget request plans lunar FM2 work for 2027. It does not establish a launch date or measured outcome."},
    {"id": "blue-ghost-3", "title": "Firefly, Blue Ghost and Elytra: Gruithuisen Domes",
     "url": "https://fireflyspace.com/missions/blue-ghost-elytra-gruithuisen-domes/",
     "locator": "Mission Summary and Our Payloads",
     "supports": "The provider targets this mission no earlier than 2028; its list of six NASA instruments does not include FM2."},
    {"id": "ices-2025", "title": "Olson et al., Solid Fuel Ignition Testing for Lunar Applications (2025)",
     "url": "https://ntrs.nasa.gov/api/citations/20250002114/downloads/ICES_2025-392-correctedcaptions.pdf",
     "locator": "PDF pages 9–11, results and Table 2",
     "supports": "Material dependence in short tests; does not establish a Synergy Pro flight threshold."},
    {"id": "guide", "title": "FIRST FIRE, Idea Book Part B (user-supplied)",
     "locator": "B8.3–B8.5, PDF pages 12–13", "url": None,
     "supports": "Worked assumptions, illustrative scoring baseline and entropy design exercise."}
]

def probability(oxygen_pct, mu_o2_pct, sigma_pp):
    if not all(math.isfinite(v) for v in (oxygen_pct, mu_o2_pct, sigma_pp)):
        raise ValueError("Model inputs must be finite")
    if not (0 <= oxygen_pct <= 100 and 0 <= mu_o2_pct <= 100 and sigma_pp > 0):
        raise ValueError("Oxygen percentages must be between 0 and 100; sigma must be positive")
    return 0.5 * math.erfc((mu_o2_pct - oxygen_pct) / (math.sqrt(2) * sigma_pp))


def entropy(probabilities):
    """Shannon entropy of the possible outcomes, in bits."""
    return -sum(p * math.log2(p) for p in probabilities if p > 0)


def ranked_design(mu, sigma):
    # Same latent material limit L across tests; successive outcomes are dependent.
    levels = [value / 2 for value in range(44, 61)]
    candidates = []
    pairs = []
    for i, x in enumerate(levels):
        p = probability(x, mu, sigma)
        candidates.append({"oxygen_pct": x, "p_sustain": p, "information_bits": entropy((p, 1-p))})
        for y in levels[i + 1:]:
            q = probability(y, mu, sigma)
            # Ordered pair (lower O2, higher O2): (yes, yes), (no, yes), (no, no).
            pairs.append({"oxygen_pct": [x, y], "joint_information_bits": entropy((p, q-p, 1-q)),
                          "outcome_probabilities": {"yes_yes": p, "no_yes": q-p, "no_no": 1-q}})
    best = max(candidates, key=lambda row: row["information_bits"])
    return {**best, "candidates": candidates, "best_fixed_pair": max(pairs, key=lambda row: row["joint_information_bits"]),
            "conditions": "Hypothetical repeat at the same material, orientation, gravity, pressure and protocol.",
            "criterion": "Maximize the information about one common deterministic oxygen threshold before observing new data.",
            "grid": "22–30% initial oxygen, spaced by 0.5 percentage points. This is an illustrative design range."}


def brier_report(predictions, outcomes):
    """Score resolved burns. Withhold a final mean whenever one is pending or void."""
    if len(predictions) != len(outcomes) or not predictions:
        raise ValueError("Expected a nonempty outcome vector matching forecast length")
    if any(not math.isfinite(p) or not 0 <= p <= 1 for p in predictions):
        raise ValueError("Each probability must be finite and between zero and one")
    if any(y not in ("yes", "no", "pending", "void") for y in outcomes):
        raise ValueError("Outcomes must be yes, no, pending, or void")
    errors = [(p - int(y == "yes"))**2 if y in ("yes", "no") else None
              for p, y in zip(predictions, outcomes)]
    settled = [e for e in errors if e is not None]
    mean = sum(settled)/len(settled) if settled else None
    return {"per_burn": errors, "n_resolved": len(settled), "n_total": len(errors),
            "resolved_mean": mean, "full_four_burn_score": mean if len(settled) == len(errors) else None}


def build(mu=26.0, sigma=1.5):
    probabilities = [probability(x, mu, sigma) for x in TARGETS]
    nasa = ["Expected to burn down to the oxygen limit."] * 3 + ["Ignition considered unlikely."]
    model = NormalDist(mu, sigma)
    unresolved = ["pending"] * len(TARGETS)
    examples = []
    for recent in ("no", "yes"):
        demo = ["yes", "yes", "yes", recent]
        examples.append({"outcomes": demo, "model": brier_report(probabilities, demo),
                         "encoded_baseline": brier_report(BASELINE, demo)})
    return {
        "schema_version": 1, "as_of": AS_OF, "status": "timestamped_reference" if (mu, sigma) == (26, 1.5) else "illustrative_scenario",
        "status_label": "Four planned burns · no verified lunar outcomes",
        "mission": {"investigation": "FM2", "material": "Synergy Pro Navy fabric",
                    "pressure_psia": 8.2, "pressure_tolerance_psi": 0.3, "gravity_earth_g": 0.165,
                    "balance_gas": "nitrogen", "initial_oxygen_pct": list(TARGETS),
                    "source_id": "lpsc-slides", "nasa_expected_loc_pct": [24,26],
                    "burn_direction": "upward in the cited concept", "verified_lunar_outcomes": 0,
                    "verified_launch_date": None,
                    "schedule": "NASA’s April 2026 FY 2027 budget request plans lunar FM2 work in 2027; no specific launch date verified.",
                    "vehicle": "The March 2026 concept names a SpaceX uncrewed demo. Earlier records differ."},
        "model": {"mu_o2_pct": mu, "sigma_pp": sigma,
                  "interval80_o2_pct": [model.inv_cdf(0.1), model.inv_cdf(0.9)],
                  "event": "Sustained sample flame spread after the igniter stops.",
                  "assumption": "One latent normal threshold shared across burns. Starting oxygen above that threshold is treated as sufficient for sustained spread.",
                  "parameter_basis": "The guide's worked example uses 26 and 1.5 percentage points. These are judgment inputs, not measurements or a fit.",
                  "source_id": "guide"},
        "burns": [{"id": i, "oxygen_pct": x, "p_sustain": p, "nasa_expectation": wording,
                   "baseline_p_sustain": b, "outcome": None}
                  for i, (x, p, wording, b) in enumerate(zip(TARGETS, probabilities, nasa, BASELINE), 1)],
        "sensitivity": [{"mu_o2_pct": m, "sigma_pp": s, "p_burn4": probability(25, m, s)}
                        for m in (24, 25, 26, 27) for s in (1, 1.5, 2)],
        "next_experiment": ranked_design(mu, sigma),
        "scoring": {"state": "unscored", "event": "Sustained spread after ignition power ends.",
                    "yes": "The official burn record reports self-sustained flame spread beyond the igniter-influenced region.",
                    "no": "A nominal ignition attempt produced no ignition, or the official record reports no such spread after power ended.",
                    "void": "Insufficient telemetry, changed material or geometry, invalid initial conditions, hardware fault, abort, or ambiguous classification.",
                    "pending": "No attributable official result available. Retain the source, test identifier, actual conditions, and outcome rationale for each resolution.",
                    "missing_policy": "Score only resolved tests on matched indices. Report coverage. A full four-burn score requires four resolved tests.",
                    "baseline_label": "The learner guide (B8.4, p. 13) uses a 90/10 illustrative comparator. NASA supplied qualitative directions only. The fixed v1 file specifies this comparator.",
                    "observed_model_score": brier_report(probabilities, unresolved),
                    "observed_baseline_score": brier_report(BASELINE, unresolved),
                    "hypothetical_examples": examples},
        "sources": SOURCES}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify the checked-in default JSON")
    parser.add_argument("--scenario", type=float, nargs=2, metavar=("MEAN_O2_PCT", "SD_PP"),
                        help="print an alternate model to stdout without changing the default")
    parser.add_argument("--score", nargs=4, choices=["yes","no","pending","void"], metavar="OUTCOME",
                        help="print a hypothetical matched-index score, leaving recorded outcomes unchanged")
    args = parser.parse_args()
    if args.check and (args.scenario or args.score):
        parser.error("--check only applies to the default artifact")
    try:
        data = build(*(args.scenario or (26.0, 1.5)))
    except ValueError as exc:
        parser.error(str(exc))
    if args.score:
        predictions = [burn["p_sustain"] for burn in data["burns"]]
        print(json.dumps({"mode": "hypothetical", "outcomes": args.score,
                          "model": brier_report(predictions, args.score),
                          "encoded_baseline": brier_report(BASELINE, args.score)}, indent=2))
        return
    serialized = json.dumps(data, ensure_ascii=False, allow_nan=False, indent=2) + "\n"
    if args.check:
        if not OUTPUT.is_file() or OUTPUT.read_text(encoding="utf-8") != serialized:
            parser.exit(1, "Forecast JSON differs from the default model. Rebuild with scripts/forecast.py\n")
        print("Forecast JSON matches the default model.")
    elif args.scenario:
        print(serialized, end="")
    else:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(serialized, encoding="utf-8")
        print("Wrote", OUTPUT)


if __name__ == "__main__":
    main()
