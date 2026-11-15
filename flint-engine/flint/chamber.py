"""Sealed-chamber burns (FM2) and cabin fires: forward simulation, inversion, Bayes.

Physics: a well-mixed closed volume. Burning a mass m of fuel CcHhOoNn removes
nu_O2 * m / MW mol of O2 and adds c mol CO2, h/2 mol H2O and n/2 mol N2 per mol.
Mole fractions depend only on the burned mass, so the burned length at extinction
follows from composition alone. Temperature and pressure follow an energy balance
with wall cooling; they need the spread rate, which FLINT takes as an input.

Extinction test: the flame dies when the chamber's flame-equivalent oxygen falls to
the material's limit L, where "flame-equivalent" means the O2 fraction in pure N2
that gives the same flame temperature (thermo.equivalent_O2_in_N2). CO2 and H2O
carry more heat than N2, so a vitiated chamber quenches the flame at a higher
measured O2 than a fresh one.
"""
from __future__ import annotations

from dataclasses import dataclass, field
import numpy as np
from scipy.optimize import brentq
from scipy.stats import norm

from .thermo import Atmosphere, Fuel, R, PSIA, equivalent_O2_in_N2, cp_species


@dataclass
class Chamber:
    V: float = 14.4e-3                 # m3 (FM2 slides p5)
    P0: float = 8.2 * PSIA             # Pa (FM2 slides p9)
    T0: float = 298.15                 # K
    A_wall: float = 0.36               # m2, assumed: a near-cube of 14.4 L
    h_wall: float = 5.0                # W/(m2 K), assumed, range 2-10
    chi_r: float = 0.3                 # fraction of heat radiated straight to the walls, assumed

    @property
    def n0(self) -> float:
        return self.P0 * self.V / (R * self.T0)


@dataclass
class Sample:
    fuel: Fuel
    areal_density: float               # kg/m2
    width: float = 0.02                # m (FM2: 2 cm exposed)
    height: float = 0.20               # m (FM2: 20 cm)
    T_fuel: float = 650.0              # K, pyrolysis temperature used for the flame temperature
    v_ref: float = 1.0e-3              # m/s spread rate at x_ref, assumed
    x_ref: float = 0.30
    v_exp: float = 1.0

    @property
    def mass(self) -> float:
        return self.areal_density * self.width * self.height


def composition(ch: Chamber, s: Sample, X0: float, burned: float) -> dict:
    """Moles of each species after burning `burned` metres of the strip."""
    n = ch.n0
    mol = {"O2": n * X0, "N2": n * (1 - X0), "CO2": 0.0, "H2O": 0.0}
    nf = s.areal_density * s.width * burned / (s.fuel.MW / 1000.0)
    mol["O2"] -= s.fuel.nu_O2 * nf
    mol["CO2"] += s.fuel.C * nf
    mol["H2O"] += s.fuel.H / 2 * nf
    mol["N2"] += s.fuel.N / 2 * nf
    return mol


def atmosphere_of(ch: Chamber, mol: dict, T: float | None = None) -> Atmosphere:
    nt = sum(mol.values())
    T = ch.T0 if T is None else T
    return Atmosphere(P=nt * R * T / ch.V, X_O2=mol["O2"] / nt, X_CO2=mol["CO2"] / nt,
                      X_H2O=mol["H2O"] / nt, T=ch.T0)


def readings(ch: Chamber, s: Sample, X0: float, burned: float) -> dict:
    mol = composition(ch, s, X0, burned)
    nt = sum(mol.values())
    dry = nt - mol["H2O"]
    return {"O2_wet": mol["O2"] / nt, "O2_dry": mol["O2"] / dry, "CO2_wet": mol["CO2"] / nt,
            "H2O_wet": mol["H2O"] / nt, "n_total": nt}


def flame_O2(ch: Chamber, s: Sample, X0: float, burned: float) -> float:
    mol = composition(ch, s, X0, burned)
    return equivalent_O2_in_N2(s.fuel, atmosphere_of(ch, mol), s.T_fuel)


def areal_density_for_drop(ch: Chamber, fuel: Fuel, drop: float = 0.08, X0: float = 0.33,
                           width: float = 0.02, height: float = 0.20) -> float:
    """Areal density (kg/m2) at which a whole strip lowers the wet O2 reading by `drop`."""
    def f(sig):
        s = Sample(fuel, sig, width, height)
        return X0 - readings(ch, s, X0, height)["O2_wet"] - drop
    return brentq(f, 1e-4, 5.0)


class BurnTable:
    """Fast lookup of flame-equivalent O2 against burned length for one start condition."""

    def __init__(self, ch: Chamber, s: Sample, X0: float, vitiation: bool = True, npts: int = 81):
        self.ch, self.s, self.X0 = ch, s, X0
        self.l = np.linspace(0.0, s.height, npts)
        if vitiation:
            self.xeq = np.array([flame_O2(ch, s, X0, li) for li in self.l])
        else:
            self.xeq = np.array([readings(ch, s, X0, li)["O2_wet"] for li in self.l])

    def length(self, L: float | np.ndarray) -> np.ndarray:
        """Burned length (m) for limit(s) L. 0 = no sustained spread, height = burns out."""
        L = np.atleast_1d(L).astype(float)
        out = np.interp(-L, -self.xeq, self.l)          # xeq decreases with burned length
        out = np.where(L >= self.xeq[0], 0.0, out)
        out = np.where(L <= self.xeq[-1], self.s.height, out)
        return out


def simulate(ch: Chamber, s: Sample, X0: float, L: float, dt: float = 0.2, t_max: float = 3600.0,
             vitiation: bool = True) -> dict:
    """Time-resolved burn: flame position, gas temperature, pressure, readings."""
    table = BurnTable(ch, s, X0, vitiation)
    l_end = float(table.length(L)[0])
    t, l, T = 0.0, 0.0, ch.T0
    out = {k: [] for k in ("t", "l", "T", "P", "O2_wet", "CO2_wet", "hrr")}
    Q = s.fuel.heat_of_combustion
    while t < t_max:
        x_eq = float(np.interp(l, table.l, table.xeq))
        burning = l < l_end - 1e-9 and x_eq > L
        v = s.v_ref * max((x_eq - L) / (s.x_ref - L), 0.0) ** s.v_exp if burning else 0.0
        v = max(v, 0.02 * s.v_ref) if burning else 0.0       # floor: near-limit flames creep, not stall
        dl = min(v * dt, max(l_end - l, 0.0))
        mdot = s.areal_density * s.width * dl / dt
        mol = composition(ch, s, X0, l + dl)
        nt = sum(mol.values())
        cv = sum(n * (cp_species(k, T) - R) for k, n in mol.items())
        hrr = mdot * Q
        T += dt * ((1 - ch.chi_r) * hrr - ch.h_wall * ch.A_wall * (T - ch.T0)) / cv
        l += dl
        rd = readings(ch, s, X0, l)
        for k, val in (("t", t), ("l", l), ("T", T), ("P", nt * R * T / ch.V), ("O2_wet", rd["O2_wet"]),
                       ("CO2_wet", rd["CO2_wet"]), ("hrr", hrr)):
            out[k].append(val)
        t += dt
        if not burning and T - ch.T0 < 0.5:
            break
    res = {k: np.array(v) for k, v in out.items()}
    res["summary"] = {
        "X0": X0, "L": L, "burned_cm": 100 * l_end, "burned_out": l_end >= s.height - 1e-9,
        "spread": l_end > 0, "duration_s": float(res["t"][np.argmax(res["l"] >= l_end - 1e-9)]) if l_end > 0 else 0.0,
        "T_peak_K": float(res["T"].max()), "P_peak_psia": float(res["P"].max() / PSIA),
        **{f"final_{k}": v for k, v in readings(ch, s, X0, l_end).items() if k != "n_total"},
        "final_flame_O2": float(np.interp(l_end, table.l, table.xeq)),
    }
    return res


# --- Bayesian inversion ------------------------------------------------------
@dataclass
class Observation:
    X0: float
    burned_cm: float | None = None      # measured burned length; None if not measured
    outcome: str = "partial"            # "none" (no sustained spread), "partial", "full"
    sd_cm: float = 1.0                  # measurement sd of the burned length


def posterior(ch: Chamber, s: Sample, obs: list[Observation], prior_mu: float = 0.26, prior_sd: float = 0.015,
              grid: np.ndarray | None = None, vitiation: bool = True) -> dict:
    """Posterior over the limit L (flame-equivalent O2 in N2) given FM2-style outcomes."""
    grid = np.linspace(0.15, 0.40, 1001) if grid is None else grid
    logp = norm.logpdf(grid, prior_mu, prior_sd)
    for o in obs:
        tab = BurnTable(ch, s, o.X0, vitiation)
        l = 100 * tab.length(grid)
        if o.outcome == "none":
            logp += np.where(grid >= o.X0 - 1e-9, 0.0, -np.inf)
        elif o.outcome == "full":
            logp += np.where(l >= 100 * s.height - 1e-9, 0.0, -np.inf)
        else:
            logp += norm.logpdf(o.burned_cm, l, o.sd_cm)
    if not np.isfinite(logp).any():
        return {"inconsistent": True, "grid": grid, "pdf": np.zeros_like(grid), "mean": np.nan,
                "q10": np.nan, "q50": np.nan, "q90": np.nan, "sd": np.nan}
    p = np.exp(logp - np.nanmax(logp))
    p /= np.trapezoid(p, grid)
    i_map = int(np.nanargmax(logp))
    worst = 0.0
    for o in obs:
        if o.outcome == "partial":
            lm = float(100 * BurnTable(ch, s, o.X0, vitiation).length(grid[i_map])[0])
            worst = max(worst, abs(o.burned_cm - lm) / o.sd_cm)
    cdf = np.cumsum(p) * (grid[1] - grid[0])
    q = lambda a: float(np.interp(a, cdf, grid))
    return {"inconsistent": worst > 3.0, "worst_residual_sd": worst, "grid": grid, "pdf": p, "mean": float(np.trapezoid(grid * p, grid)), "q10": q(0.1), "q50": q(0.5),
            "q90": q(0.9), "sd": float(np.sqrt(np.trapezoid((grid - np.trapezoid(grid * p, grid)) ** 2 * p, grid)))}


def expected_information(ch: Chamber, s: Sample, X0_new: float, post: dict, sd_cm: float = 1.0,
                         vitiation: bool = True, n_l: int = 121) -> float:
    """Expected reduction in entropy (bits) of L from one more burn starting at X0_new."""
    grid, p = post["grid"], post["pdf"] * (post["grid"][1] - post["grid"][0])
    p = p / p.sum()
    l = 100 * BurnTable(ch, s, X0_new, vitiation).length(grid)
    H0 = -np.sum(p[p > 0] * np.log2(p[p > 0]))
    ys = np.linspace(-3, 100 * s.height + 3, n_l)
    lik = norm.pdf(ys[:, None], l[None, :], sd_cm)
    lik[0, :] += (l <= 0)          # no-spread outcome as a point mass
    lik[-1, :] += (l >= 100 * s.height - 1e-9)
    py = lik @ p
    post_y = lik * p[None, :] / np.maximum(py[:, None], 1e-300)
    Hy = -np.sum(np.where(post_y > 0, post_y * np.log2(np.maximum(post_y, 1e-300)), 0.0), axis=1)
    py = py / py.sum()
    return float(H0 - np.sum(py * Hy))


# --- cabin fire --------------------------------------------------------------
def cabin_fire(fuel: Fuel, areal_density: float, L: float, V: float = 12.0, P0: float = 8.2 * PSIA,
               X0: float = 0.34, panel_w: float = 1.0, panel_h: float = 1.0, v_up_ref: float = 3e-3,
               v_lat_ratio: float = 0.3, excess_ref: float = 0.06, m_flux_ref: float = 0.010,
               vent_m3s: float = 0.0, h_wall: float = 5.0, A_wall: float | None = None, chi_r: float = 0.3,
               dt: float = 0.5, t_max: float = 900.0) -> dict:
    """A panel lit at its bottom centre. The flame front grows as a half-ellipse (upward and
    sideways spread); every patch it reaches burns at a mass flux until its fuel is used up.
    Spread rates and burning flux are assumed inputs, scaled with the oxygen in excess of the
    limit L: v = v_up_ref * (X - L) / excess_ref, m'' = m_flux_ref * (X - L) / excess_ref."""
    T0 = 298.15
    A_wall = 6 * V ** (2 / 3) if A_wall is None else A_wall
    n0 = P0 * V / (R * T0)
    mol = {"O2": n0 * X0, "N2": n0 * (1 - X0), "CO2": 0.0, "H2O": 0.0}
    fresh = dict(mol)
    a = b = 0.0
    T, t, area_prev = T0, 0.0, 0.0
    patches = []                      # [remaining kg] for each ignited ring of panel
    out = {k: [] for k in ("t", "hrr", "O2", "CO2", "T", "P", "area")}
    Q = fuel.heat_of_combustion
    while t < t_max:
        nt = sum(mol.values())
        x = mol["O2"] / nt
        f = max((x - L) / excess_ref, 0.0)
        v = v_up_ref * f
        a = min(a + v * dt, panel_h)
        b = min(b + v_lat_ratio * v * dt, panel_w / 2)
        area = 0.5 * np.pi * a * b
        dA = max(area - area_prev, 0.0)
        area_prev = area
        if dA > 0:
            patches.append([areal_density * dA, dA])
        burn = 0.0
        flux = m_flux_ref * f
        for p_ in patches:
            if p_[0] > 0:
                m = min(p_[0], flux * p_[1] * dt)
                p_[0] -= m
                burn += m
        nf = burn / (fuel.MW / 1000.0)
        mol["O2"] -= fuel.nu_O2 * nf
        mol["CO2"] += fuel.C * nf
        mol["H2O"] += fuel.H / 2 * nf
        mol["N2"] += fuel.N / 2 * nf
        if vent_m3s > 0:   # exchange with fresh cabin air at constant pressure
            frac = min(vent_m3s * dt / V, 1.0)
            ntot = sum(mol.values())
            for k in mol:
                mol[k] += frac * (fresh[k] / n0 * ntot - mol[k])
        cv = sum(n * (cp_species(k, T) - R) for k, n in mol.items())
        hrr = burn * Q / dt
        T += dt * ((1 - chi_r) * hrr - h_wall * A_wall * (T - T0)) / cv
        nt = sum(mol.values())
        for k, val in (("t", t), ("hrr", hrr), ("O2", mol["O2"] / nt), ("CO2", mol["CO2"] / nt), ("T", T),
                       ("P", nt * R * T / V), ("area", area)):
            out[k].append(val)
        t += dt
    res = {k: np.array(v) for k, v in out.items()}

    def first(cond):
        idx = np.argmax(cond)
        return float(res["t"][idx]) if cond.any() else None
    res["summary"] = {
        "t_hrr_1kW_s": first(res["hrr"] >= 1e3), "t_hrr_10kW_s": first(res["hrr"] >= 1e4),
        "t_CO2_1pct_s": first(res["CO2"] >= 0.01), "t_dT_10K_s": first(res["T"] - T0 >= 10),
        "peak_hrr_kW": float(res["hrr"].max() / 1e3), "final_O2": float(res["O2"][-1]),
        "final_CO2": float(res["CO2"][-1]), "peak_T_rise_K": float(res["T"].max() - T0),
        "peak_dP_kPa": float((res["P"].max() - P0) / 1e3),
    }
    return res


def outcomes_for(ch: Chamber, s: Sample, L_true: float, starts=(0.37, 0.33, 0.29, 0.25), sd_cm: float = 1.0) -> list:
    """FM2-style observations that a fabric with limit L_true would produce (lengths to 0.1 cm)."""
    obs = []
    for X0 in starts:
        l = float(100 * BurnTable(ch, s, X0).length(L_true)[0])
        kind = "none" if l <= 0 else ("full" if l >= 100 * s.height - 1e-6 else "partial")
        obs.append(Observation(X0, round(l, 1) if kind == "partial" else None, kind, sd_cm))
    return obs
