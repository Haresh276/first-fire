"""Droplet flames in freefall, calibrated and tested on NASA's FLEX experiment (PSI-69).

FLEX (Flame Extinguishment Experiment) burned 274 free-floating methanol and heptane
droplets on the ISS in oxygen, nitrogen, carbon dioxide and helium mixtures at 0.7 to
3 atm. It was flown to learn how fire suppressants work in microgravity. In freefall a
droplet flame is a sphere, the textbook case of combustion theory.

Two models:

  * Burning rate (quasi-steady d^2-law, Godsave/Spalding):
        K = 8 k / (rho_l cp) * ln(1 + B),   B = [cp (T_inf - T_b) + Y_O2 * Q / r] / L_v
    with k and cp of the actual gas mixture (helium conducts heat six times better than
    nitrogen) and one correction factor per fuel, fitted on ordinary O2/N2 runs at 1 atm.

  * Extinction diameter (physics-shaped regression): a flame dies when its chemistry can
    no longer keep up, so ln d_ext is regressed on 1000/T_f (flame temperature in the actual
    atmosphere), the gas diffusivity and the initial size. The diluent's effect enters only
    through T_f and diffusivity, so the same fit covers CO2, He and N2.

Both are tested on runs they were not fitted on (10-fold cross-validation and a
transfer test from air-like runs to diluted and off-pressure runs).
"""
from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path
import numpy as np
from scipy.optimize import brentq

from .thermo import Atmosphere, Fuel, PSIA, flame_temperature, k_mix, cp_mass, rho_gas

DATA = Path(__file__).parent / "datasets" / "flex_psi69.csv"


@dataclass
class LiquidFuel:
    name: str
    fuel: Fuel
    rho_l: float      # kg/m3 at 298 K
    Lv: float         # J/kg at the boiling point
    Tb: float         # K, normal boiling point


FUELS = {   # standard handbook values (K-level)
    "Methanol": LiquidFuel("Methanol", Fuel(C=1, H=4, O=1, Hc=19.9e6), rho_l=791.0, Lv=1.10e6, Tb=337.8),
    "Heptane": LiquidFuel("Heptane", Fuel(C=7, H=16, Hc=44.6e6), rho_l=684.0, Lv=0.317e6, Tb=371.6),
}


def atmosphere(O2_pct: float, P_psia: float, CO2_pct: float = 0.0, He_pct: float = 0.0) -> Atmosphere:
    return Atmosphere(P=P_psia * PSIA, X_O2=O2_pct / 100, X_CO2=CO2_pct / 100, X_He=He_pct / 100)


def theory(lf: LiquidFuel, atm: Atmosphere) -> dict:
    Tf = flame_temperature(lf.fuel, atm, lf.Tb)
    Tm = 0.5 * (lf.Tb + Tf)
    k, cp = k_mix(atm, Tm), cp_mass(atm, Tm)
    B = (cp * (atm.T - lf.Tb) + atm.Y_O2 * lf.fuel.heat_of_combustion / lf.fuel.r) / lf.Lv
    K = 8 * k / (lf.rho_l * cp) * np.log1p(B)
    alpha = k / (rho_gas(atm, Tm) * cp)
    return {"K_mm2_s": K * 1e6, "B": B, "Tf": Tf, "alpha": alpha}


def load() -> list:
    rows = []
    for r in csv.DictReader(open(DATA)):
        g = lambda k: float(r[k]) if r[k].strip() else np.nan
        d = {"id": r["record_id"], "fuel": r["material"], "outcome": r["outcome"], "O2": g("o2_initial_pct"),
             "P": g("pressure_psia"), "CO2": g("co2_initial_pct"), "He": g("helium_initial_pct"),
             "d0": g("initial_diameter_mm"), "de": g("visible_extinction_diameter_mm"), "tb": g("burn_time_s")}
        if not np.isfinite(d["P"]) or d["P"] <= 0 or d["fuel"] not in FUELS:
            continue
        th = theory(FUELS[d["fuel"]], atmosphere(d["O2"], d["P"], d["CO2"], d["He"]))
        d.update({"K_th": th["K_mm2_s"], "Tf": th["Tf"], "alpha": th["alpha"], "B": th["B"]})
        if d["outcome"] == "Extinction" and np.isfinite(d["de"]) and np.isfinite(d["tb"]) and d["tb"] > 0 and np.isfinite(d["d0"]):
            d["K_obs"] = (d["d0"] ** 2 - d["de"] ** 2) / d["tb"]
        elif d["outcome"] == "Completion" and np.isfinite(d["tb"]) and d["tb"] > 0 and np.isfinite(d["d0"]):
            d["K_obs"] = d["d0"] ** 2 / d["tb"]
        else:
            d["K_obs"] = np.nan
        rows.append(d)
    return rows


def air_like(d: dict) -> bool:
    return d["CO2"] == 0 and d["He"] == 0 and abs(d["P"] - 14.7) < 0.6


# --- burning rate -------------------------------------------------------------
def fit_kappa(rows: list) -> float:
    """Least-squares factor in log space: K_obs = kappa * K_theory."""
    r = np.array([np.log(d["K_obs"] / d["K_th"]) for d in rows])
    return float(np.exp(np.mean(r)))


def burning_rate_validation(rows: list, folds: int = 10, seed: int = 3) -> dict:
    out = {}
    rng = np.random.default_rng(seed)
    for fuel in FUELS:
        R = [d for d in rows if d["fuel"] == fuel and np.isfinite(d["K_obs"]) and d["K_obs"] > 0]
        idx = rng.permutation(len(R))
        err_phys, err_mean, err_lin = [], [], []
        for f in range(folds):
            test = [R[i] for i in idx[f::folds]]
            train = [R[i] for i in idx if i not in set(idx[f::folds])]
            kap = fit_kappa(train)
            mu = np.mean([d["K_obs"] for d in train])
            Xtr = np.array([[1, d["O2"], d["CO2"], d["He"], d["P"]] for d in train])
            ytr = np.array([d["K_obs"] for d in train])
            beta = np.linalg.lstsq(Xtr, ytr, rcond=None)[0]
            for d in test:
                err_phys.append(kap * d["K_th"] / d["K_obs"] - 1)
                err_mean.append(mu / d["K_obs"] - 1)
                err_lin.append(np.dot([1, d["O2"], d["CO2"], d["He"], d["P"]], beta) / d["K_obs"] - 1)
        # transfer: fit on air-like runs only, predict every other run
        air = [d for d in R if air_like(d)]
        other = [d for d in R if not air_like(d)]
        kap_air = fit_kappa(air)
        tr = [kap_air * d["K_th"] / d["K_obs"] - 1 for d in other]
        mean_air = np.mean([d["K_obs"] for d in air])
        tr_mean = [mean_air / d["K_obs"] - 1 for d in other]
        out[fuel] = {"n": len(R), "kappa_all": fit_kappa(R), "cv_mape_physics": 100 * np.mean(np.abs(err_phys)),
                     "cv_mape_mean": 100 * np.mean(np.abs(err_mean)), "cv_mape_linear5": 100 * np.mean(np.abs(err_lin)),
                     "transfer_n_train": len(air), "transfer_n_test": len(other), "kappa_air": kap_air,
                     "transfer_mape_physics": 100 * np.mean(np.abs(tr)), "transfer_mape_mean": 100 * np.mean(np.abs(tr_mean)),
                     "K_obs_median": float(np.median([d["K_obs"] for d in R]))}
    return out


# --- extinction diameter --------------------------------------------------------
def _features(d: dict) -> list:
    return [1.0, np.log(d["d0"]), 1000.0 / d["Tf"], np.log(d["alpha"] / 2.0e-4)]


@dataclass
class ExtinctionModel:
    fuel: str
    beta: np.ndarray
    sigma: float

    def ln_de(self, d0: float, Tf: float, alpha: float) -> float:
        return float(np.dot(self.beta, [1.0, np.log(d0), 1000.0 / Tf, np.log(alpha / 2.0e-4)]))

    def predict(self, d0_mm: float, atm: Atmosphere) -> float:
        th = theory(FUELS[self.fuel], atm)
        return float(np.exp(self.ln_de(d0_mm, th["Tf"], th["alpha"])))


def fit_extinction(rows: list, fuel: str) -> ExtinctionModel:
    R = [d for d in rows if d["fuel"] == fuel and d["outcome"] == "Extinction" and np.isfinite(d["de"])
         and d["de"] > 0 and np.isfinite(d["d0"])]
    X = np.array([_features(d) for d in R]); y = np.log([d["de"] for d in R])
    beta = np.linalg.lstsq(X, y, rcond=None)[0]
    return ExtinctionModel(fuel, beta, float(np.std(y - X @ beta, ddof=X.shape[1])))


def extinction_validation(rows: list, folds: int = 10, seed: int = 5) -> dict:
    out = {}
    rng = np.random.default_rng(seed)
    for fuel in FUELS:
        R = [d for d in rows if d["fuel"] == fuel and d["outcome"] == "Extinction" and np.isfinite(d["de"])
             and d["de"] > 0 and np.isfinite(d["d0"])]
        idx = rng.permutation(len(R))
        e_m, e_ratio, e_const = [], [], []
        for f in range(folds):
            te = set(idx[f::folds].tolist())
            train = [R[i] for i in range(len(R)) if i not in te]
            test = [R[i] for i in te]
            m = fit_extinction(train, fuel)
            ratio = np.exp(np.mean([np.log(d["de"] / d["d0"]) for d in train]))
            const = np.exp(np.mean([np.log(d["de"]) for d in train]))
            for d in test:
                e_m.append(np.exp(m.ln_de(d["d0"], d["Tf"], d["alpha"])) - d["de"])
                e_ratio.append(ratio * d["d0"] - d["de"])
                e_const.append(const - d["de"])
        mfull = fit_extinction(rows, fuel)
        out[fuel] = {"n": len(R), "cv_mae_mm_model": float(np.mean(np.abs(e_m))),
                     "cv_mae_mm_fixed_ratio": float(np.mean(np.abs(e_ratio))),
                     "cv_mae_mm_constant": float(np.mean(np.abs(e_const))),
                     "beta": mfull.beta.tolist(), "sigma_ln": mfull.sigma,
                     "E_eff_kJ_mol": float(2 * 8.314 * mfull.beta[2])}
    return out


# --- suppression: how much agent stops a droplet flame -----------------------------
def limit_dose(model: ExtinctionModel, d0_mm: float = 3.0, P_psia: float = 14.7, O2_pct: float = 21.0,
               agent: str = "CO2") -> float:
    """Percent of agent (replacing nitrogen; for 'N2' the oxygen is lowered instead) at which the
    flame of a d0 droplet is predicted to die at ignition (d_ext = d0)."""
    def gap(x):
        if agent == "CO2":
            atm = atmosphere(O2_pct, P_psia, CO2_pct=x)
        elif agent == "He":
            atm = atmosphere(O2_pct, P_psia, He_pct=x)
        else:   # nitrogen: dilute the oxygen itself
            atm = atmosphere(O2_pct - x, P_psia)
        return model.predict(d0_mm, atm) - d0_mm
    hi = 78.0 if agent != "N2" else O2_pct - 3.0
    if gap(0.0) >= 0:
        return 0.0
    if gap(hi) < 0:
        return np.nan
    return float(brentq(gap, 0.0, hi, xtol=1e-3))


def limiting_O2(model: ExtinctionModel, d0_mm: float = 3.0, P_psia: float = 14.7, CO2_pct: float = 0.0,
                He_pct: float = 0.0) -> float:
    """Oxygen (percent) below which a d0 droplet flame is predicted to die at ignition (d_ext = d0),
    with a fixed fraction of CO2 or helium replacing nitrogen."""
    def gap(o2):
        return model.predict(d0_mm, atmosphere(o2, P_psia, CO2_pct, He_pct)) - d0_mm
    lo, hi = 4.0, 60.0
    if gap(hi) > 0:
        return np.nan
    if gap(lo) < 0:
        return lo
    return float(brentq(gap, lo, hi, xtol=1e-3))
