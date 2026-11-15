"""The scenario atlas: every combination of gravity, cabin atmosphere, ventilation and fuel that
FLINT can speak to, each with its validity label.

Solids (PMMA, P213 tape, polycarbonate, Nomex Velcro): oxygen limit, margin, branch, and the
CO2 dose, N2 dose and vent pressure that would stop a fire (per m3 of cabin, so any vehicle
size can use them). Droplets (methanol, heptane; orbit only, where FLEX flew): burning rate,
burn time, extinction size and limiting oxygen.

Validity labels:
  validated   inside the range of the data FLINT was tested on
  extrapolated  FLINT's physics outside that range (say so when quoting the number)
  not modelled  FLINT cannot answer; the label names the evidence to use instead
"""
from __future__ import annotations

import csv
from dataclasses import replace
from pathlib import Path
import numpy as np

from .thermo import PSIA, GRAVITY
from .rover import (Rover, CabinItem, calibrated_models, PBuoyancy, flood_dose, vent_pressure)
from . import droplet as D

ATMOS = [("Earth-like (ISS, Gaganyaan, Orion)", 14.7, 0.21), ("Shuttle EVA preparation", 10.2, 0.265),
         ("Exploration nominal (lander, habitat, rover)", 8.2, 0.34), ("Exploration upper band", 8.2, 0.37),
         ("Exploration, 30 % O2", 8.2, 0.30)]
VENT = [("fans off", 0.0), ("gentle 5 cm/s", 0.05), ("nominal 10 cm/s", 0.10), ("strong 20 cm/s", 0.20)]
SOLIDS = {"PMMA": "PMMA sheet", "P213": "P213 tape", "PC": "Polycarbonate", "NOMEX": "Nomex Velcro"}


def solids(models: dict | None = None) -> list:
    models = models or calibrated_models()
    buoy = PBuoyancy()
    rows = []
    for gname, g in GRAVITY.items():
        for aname, P, X in ATMOS:
            for vname, u in VENT:
                for key, label in SOLIDS.items():
                    row = {"family": "solid", "gravity": gname, "atmosphere": aname, "P_psia": P, "O2": X,
                           "ventilation": vname, "fuel": label}
                    if g == 0 and u == 0:
                        row.update({"validity": "not modelled",
                                    "note": "Quiescent orbit: oxygen arrives by diffusion only, outside FLINT. Evidence: BASS, BASS-II, Saffire (PSI-25, -26, -98 to -100)."})
                        rows.append(row); continue
                    Pa = P * PSIA
                    ueff = buoy.u_eff_P(u, g, Pa)
                    L = models[key].loc(Pa, ueff)
                    item = CabinItem(label, key, 1.0, 1.0)
                    rv = Rover(volume_m3=1.0, P_psia=P, X_O2=X, gravity=gname, fan_m_s=u, items=[item])
                    burns = bool(np.isfinite(L) and X > L)
                    co2 = flood_dose(models, rv, item, "CO2") if burns and u == 0 else None
                    n2 = flood_dose(models, rv, item, "N2") if burns and u == 0 else None
                    vent = vent_pressure(models, rv, item) if burns and u == 0 else None
                    validated = abs(P - 8.2) < 1e-9 and g > 0 and u == 0
                    row.update({"flow_cm_s": 100 * ueff, "limit": L, "margin_pts": 100 * (X - L) if np.isfinite(L) else np.nan,
                                "burns": burns, "branch": models[key].branch(Pa, ueff),
                                "co2_kg_per_m3": (co2 or {}).get("kg"), "n2_kg_per_m3": (n2 or {}).get("kg"),
                                "vent_psia": (vent or {}).get("P_psia"),
                                "validity": "validated" if validated else "extrapolated",
                                "note": "" if validated else ("Orbit: FLINT's constants come from flames spreading with the flow; opposed-flow limits are higher (Takahashi, in ICES Fig. 13)." if g == 0 else
                                                             "Outside 8.2 psia or with fans on: FLINT physics, not tested.")})
                    rows.append(row)
    return rows


def droplets() -> list:
    rows_data = D.load()
    models = {f: D.fit_extinction(rows_data, f) for f in D.FUELS}
    kap = {f: D.fit_kappa([d for d in rows_data if d["fuel"] == f and np.isfinite(d["K_obs"]) and d["K_obs"] > 0]) for f in D.FUELS}
    out = []
    for aname, P, X in ATMOS:
        for f in D.FUELS:
            for d0 in (2.0, 3.0, 4.0):
                atm = D.atmosphere(100 * X, P)
                th = D.theory(D.FUELS[f], atm)
                K = kap[f] * th["K_mm2_s"]
                de = models[f].predict(d0, atm)
                burns = de < d0
                inside = 10.0 <= P <= 15.0 and 0.12 <= X <= 0.34
                out.append({"family": "droplet", "gravity": "orbit", "atmosphere": aname, "P_psia": P, "O2": X,
                            "fuel": f, "d0_mm": d0, "K_mm2_s": K, "d_ext_mm": min(de, d0), "burns": burns,
                            "burn_time_s": (d0 ** 2 - min(de, d0) ** 2) / K if burns else 0.0,
                            "limiting_O2_pct": D.limiting_O2(models[f], d0, P),
                            "validity": "validated" if inside else "extrapolated",
                            "note": "FLEX flew at 0.7-3 atm, 12-34 % O2; droplets on the Moon or Mars are not modelled (buoyancy)."})
    return out


def build(outdir: str | Path) -> dict:
    out = Path(outdir); out.mkdir(parents=True, exist_ok=True)
    S, Dr = solids(), droplets()
    for name, rows in (("atlas_solids.csv", S), ("atlas_droplets.csv", Dr)):
        keys = sorted({k for r in rows for k in r}, key=lambda k: list(rows[0]).index(k) if k in rows[0] else 99)
        with open(out / name, "w", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=keys); w.writeheader()
            for r in rows:
                w.writerow({k: (round(v, 4) if isinstance(v, float) else v) for k, v in r.items()})
    summary = {"solid_scenarios": len(S), "droplet_scenarios": len(Dr),
               "validated": sum(r["validity"] == "validated" for r in S + Dr),
               "extrapolated": sum(r["validity"] == "extrapolated" for r in S + Dr),
               "not_modelled": sum(r["validity"] == "not modelled" for r in S + Dr)}
    return {"summary": summary, "solids": S, "droplets": Dr}
