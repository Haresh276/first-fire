"""Calibration and validation against ICES-2025-392.

Protocol (fixed before looking at the lunar results' agreement):
  1. Blow-off branch: for each material, fit the single constant lnK to its four 1-g
     WSTF limit points. Activation energy from ICES Table 1. No lunar data used.
  2. Quenching branch: one constant Ch shared by all materials.
  3. Validation: leave one material out. Fit Ch to the other materials' lunar limits,
     predict the held-out material's lunar limit. Repeat for every material.
"""
from __future__ import annotations

from dataclasses import dataclass, field, replace
import numpy as np
from scipy.optimize import minimize_scalar, minimize

from .thermo import PSIA, GRAVITY
from .limits import LimitModel, Buoyancy
from .materials import LIBRARY
from .data import ICES, ICES_PRESSURE_PSIA

P_ICES = ICES_PRESSURE_PSIA * PSIA


def fit_ckl(key: str, buoy: Buoyancy, fit_E: bool = False, data: dict = ICES) -> tuple[LimitModel, float]:
    """Fit lnK (and optionally E) to the 1-g WSTF points. Returns model and RMS residual."""
    mat = LIBRARY[key]
    pts = data[key]["wstf"]
    us = [buoy.u_eff(u / 100.0, 1.0) for u, _ in pts]
    xs = np.array([x for _, x in pts])

    def sse(lnK, E=None):
        m = LimitModel(mat, lnK=lnK, E=E)
        pred = np.array([m.loc_ckl(P_ICES, u) for u in us])
        return float(np.sum((pred - xs) ** 2)) if np.all(np.isfinite(pred)) else 1e3

    def best_lnK(E=None):
        m0 = LimitModel(mat, E=E)
        ks = [m0.lnK_for_point(P_ICES, u, x) for u, x in zip(us, xs)]
        r = minimize_scalar(lambda k: sse(k, E), bounds=(min(ks) - 2, max(ks) + 2), method="bounded",
                            options={"xatol": 1e-7})
        return float(r.x), float(r.fun)

    lnK, _ = best_lnK()
    model = LimitModel(mat, lnK=lnK)
    if fit_E:
        def obj(Ek):
            return best_lnK(Ek * 1e3)[1]
        r = minimize_scalar(obj, bounds=(20.0, 600.0), method="bounded", options={"xatol": 0.05})
        E = float(r.x) * 1e3
        model = LimitModel(mat, lnK=best_lnK(E)[0], E=E)
    rms = np.sqrt(sse(model.lnK, model.E) / len(xs))
    return model, float(rms)


def with_Ch(models: dict, Ch: float) -> dict:
    return {k: replace(m, Ch=Ch) for k, m in models.items()}


def lunar_predictions(models: dict, buoy: Buoyancy, P: float = P_ICES) -> dict:
    u = buoy.u_eff(0.0, GRAVITY["moon"])
    return {k: m.loc(P, u) for k, m in models.items()}


def fit_Ch(models: dict, keys: list, buoy: Buoyancy, data: dict = ICES, field_: str = "lunar") -> float:
    u = buoy.u_eff(0.0, GRAVITY["moon"])

    def sse(logC):
        tot = 0.0
        for k in keys:
            m = replace(models[k], Ch=np.exp(logC))
            p = m.loc(P_ICES, u)
            tot += (p - data[k][field_]) ** 2 if np.isfinite(p) else 1.0
        return tot
    grid = np.linspace(np.log(0.3), np.log(60.0), 161)       # the objective is not unimodal
    vals = [sse(g) for g in grid]
    i = int(np.argmin(vals))
    lo, hi = grid[max(i - 1, 0)], grid[min(i + 1, len(grid) - 1)]
    r = minimize_scalar(sse, bounds=(lo, hi), method="bounded", options={"xatol": 1e-7})
    return float(np.exp(r.x))


@dataclass
class Validation:
    buoy: Buoyancy
    fit_E: bool
    dataset: str
    ckl_rms: dict = field(default_factory=dict)
    models: dict = field(default_factory=dict)
    Ch_all: float = np.nan
    loo: dict = field(default_factory=dict)          # key -> (pred, obs, Ch used, branch)
    ckl_only: dict = field(default_factory=dict)     # key -> CKL prediction at lunar u (no lunar data)
    linear: dict = field(default_factory=dict)       # key -> straight-line extrapolation to u = 0

    @property
    def loo_mae(self) -> float:
        return float(np.mean([abs(p - o) for p, o, *_ in self.loo.values()]))

    @property
    def loo_max(self) -> float:
        return float(np.max([abs(p - o) for p, o, *_ in self.loo.values()]))


def validate(buoy: Buoyancy = Buoyancy(), fit_E: bool = False, use_alt: bool = False) -> Validation:
    field_ = "lunar_alt" if use_alt else "lunar"
    v = Validation(buoy=buoy, fit_E=fit_E, dataset="single-material figures" if use_alt else "Fig. 13")
    keys = list(ICES)
    for k in keys:
        v.models[k], v.ckl_rms[k] = fit_ckl(k, buoy, fit_E)
    u_moon = buoy.u_eff(0.0, GRAVITY["moon"])
    for k in keys:
        v.ckl_only[k] = v.models[k].loc_ckl(P_ICES, u_moon)
        pts = np.array(ICES[k]["wstf"])
        slope, icpt = np.polyfit(pts[:, 0], pts[:, 1], 1)
        v.linear[k] = float(icpt)
    v.Ch_all = fit_Ch(v.models, keys, buoy, field_=field_)
    for k in keys:
        others = [j for j in keys if j != k]
        Ch = fit_Ch(v.models, others, buoy, field_=field_)
        m = replace(v.models[k], Ch=Ch)
        v.loo[k] = (m.loc(P_ICES, u_moon), ICES[k][field_], Ch, m.branch(P_ICES, u_moon))
    return v


def closure_grid() -> list[Buoyancy]:
    return [Buoyancy(u1g=u1g, n=n, m=m) for n in (1 / 3, 1 / 2) for u1g in (0.35, 0.20) for m in (1.5, 1.0)]
