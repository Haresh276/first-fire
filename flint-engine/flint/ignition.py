"""Gas-leak ignition in freefall, from NASA's CFI-G experiment (PSI-159).

CFI-G (Cool Flames Investigation with Gases) lit 333 laminar gas jets on the ISS: ethane,
propane and butane (pure or diluted) flowing into oxygen-rich air ("normal" flames), and
oxygen flowing into fuel-laden air ("inverse" flames), at 0.5 to 3.3 atm. Each run records
whether a hot flame ignited.

Model: a logistic regression on two physical quantities, the stoichiometric flame-sheet
temperature of the two streams (FLINT thermochemistry) and ln(pressure). A leak hazard rule
comes out directly: the flame temperature above which hot ignition becomes likely.
Tested by leave-one-out against a base-rate baseline.
"""
from __future__ import annotations

import csv
from pathlib import Path
import numpy as np
from scipy.optimize import brentq

from .thermo import Fuel, h_sens, PSIA

DATA = Path(__file__).parent / "datasets" / "cfig_psi159.csv"
GASES = {"ethane": Fuel(C=2, H=6, Hc=47.5e6), "propane": Fuel(C=3, H=8, Hc=46.4e6), "butane": Fuel(C=4, H=10, Hc=45.7e6)}


def sheet_temperature(fuel: Fuel, x_fuel_stream: float, x_O2_stream: float, T0: float = 298.15) -> float:
    """Flame-sheet temperature of a fuel stream (fuel mole fraction x_fuel_stream in N2) meeting an
    oxidizer stream (O2 mole fraction x_O2_stream in N2) in stoichiometric proportion."""
    nu = fuel.nu_O2
    n_fs = 1.0 / x_fuel_stream                 # mol of fuel stream per mol fuel
    n_os = nu / x_O2_stream                    # mol of oxidizer stream per mol fuel
    N2 = n_fs * (1 - x_fuel_stream) + n_os * (1 - x_O2_stream)
    prod = {"CO2": fuel.C, "H2O": fuel.H / 2, "N2": N2}
    q = fuel.heat_of_combustion * fuel.MW / 1000.0
    return brentq(lambda T: sum(n * h_sens(s, T) for s, n in prod.items()) - q, T0, 9000.0)


def load() -> list:
    rows = []
    for r in csv.DictReader(open(DATA)):
        mat = r["material"].strip()
        frac = 1.0
        if "%" in mat:
            frac = float(mat.split("%")[0]) / 100.0
            mat = mat.split("%")[1].strip()
        if mat not in GASES or r["hot_ignition"] not in ("yes", "no", "flash"):
            continue
        P = float(r["pressure_psia"])
        if r["direction"] == "normal":
            x_f, x_o = frac, float(r["o2_initial_pct"]) / 100
        else:
            x_f, x_o = float(r["fuel_ambient_initial_pct"]) / 100, float(r["o2_burner_pct"]) / 100
        if not (0 < x_f <= 1 and 0 < x_o <= 1):
            continue
        Tf = sheet_temperature(GASES[mat], x_f, x_o)
        rows.append({"id": r["record_id"], "dir": r["direction"], "fuel": mat, "x_fuel": x_f, "x_O2": x_o,
                     "P": P, "Tf": Tf, "y": 1 if r["hot_ignition"] == "yes" else 0})
    return rows


def _X(R):
    return np.array([[1.0, (d["Tf"] - 2000.0) / 100.0, np.log(d["P"] / 14.7)] for d in R])


def fit_logistic(X: np.ndarray, y: np.ndarray, l2: float = 1e-3, iters: int = 60) -> np.ndarray:
    w = np.zeros(X.shape[1])
    for _ in range(iters):
        p = 1 / (1 + np.exp(-X @ w))
        g = X.T @ (p - y) + l2 * w
        H = X.T @ (X * (p * (1 - p))[:, None]) + l2 * np.eye(X.shape[1])
        step = np.linalg.solve(H, g)
        w -= step
        if np.max(np.abs(step)) < 1e-9:
            break
    return w


def validate(rows: list) -> dict:
    out = {}
    for direction in ("normal", "inverse"):
        R = [d for d in rows if d["dir"] == direction]
        X, y = _X(R), np.array([d["y"] for d in R], float)
        p_loo, p_base = np.zeros(len(R)), np.zeros(len(R))
        for i in range(len(R)):
            m = np.ones(len(R), bool); m[i] = False
            w = fit_logistic(X[m], y[m])
            p_loo[i] = 1 / (1 + np.exp(-X[i] @ w))
            p_base[i] = y[m].mean()
        w = fit_logistic(X, y)
        brier = lambda p: float(np.mean((p - y) ** 2))
        acc = lambda p: float(np.mean((p > 0.5) == (y > 0.5)))
        # flame temperature at which P(hot ignition) = 0.5, at 1 atm
        T50 = 2000.0 - 100.0 * w[0] / w[1] if w[1] != 0 else np.nan
        out[direction] = {"n": len(R), "hot_ignitions": int(y.sum()), "weights": w.tolist(),
                          "loo_brier": brier(p_loo), "base_brier": brier(p_base),
                          "loo_accuracy": acc(p_loo), "base_accuracy": float(max(y.mean(), 1 - y.mean())),
                          "T50_K_at_1atm": T50, "Tf_range": [float(min(d["Tf"] for d in R)), float(max(d["Tf"] for d in R))]}
    return out


def p_hot_ignition(w: np.ndarray, Tf: float, P_psia: float) -> float:
    return float(1 / (1 + np.exp(-(w[0] + w[1] * (Tf - 2000.0) / 100.0 + w[2] * np.log(P_psia / 14.7)))))
