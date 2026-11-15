"""Reproduce every FLINT number and figure:  python -m flint.report [outdir]"""
from __future__ import annotations

import json
import sys
import time
from dataclasses import replace
from pathlib import Path

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from . import __version__
from .thermo import GRAVITY, PSIA, Atmosphere, Fuel, equivalent_O2_in_N2
from .limits import Buoyancy, LimitModel
from .materials import LIBRARY, ARAMID_FUEL, CELLULOSE_FUEL, PMMA_FUEL
from .calibrate import validate, closure_grid, fit_ckl, fit_Ch, P_ICES
from .data import ICES, ICES_FIGURE_NOTES, FM2
from .chamber import (Chamber, Sample, BurnTable, simulate, readings, flame_O2, areal_density_for_drop,
                      Observation, posterior, expected_information, cabin_fire)

COL = {"PMMA": "#c0392b", "P213": "#27864a", "PC": "#e67e22", "NOMEX": "#2c6fbb"}
NAME = {"PMMA": "PMMA", "P213": "P213 tape", "PC": "Polycarbonate", "NOMEX": "Nomex Velcro"}
plt.rcParams.update({"font.size": 10, "axes.spines.top": False, "axes.spines.right": False, "figure.dpi": 150})


def vitiation_correction(fuel: Fuel, X0: float, X_read: float, T_fuel: float = 650.0, P: float = 101325.0) -> dict:
    """Chamber burned from X0 (O2 in N2) until the wet O2 reading fell to X_read.
    Returns the CO2/H2O present and the flame-equivalent O2 in pure N2."""
    from scipy.optimize import brentq
    n0 = 1.0
    def state(nf):
        mol = {"O2": X0 - fuel.nu_O2 * nf, "N2": 1 - X0 + fuel.N / 2 * nf, "CO2": fuel.C * nf, "H2O": fuel.H / 2 * nf}
        nt = sum(mol.values())
        return mol, nt
    nf = brentq(lambda f: state(f)[0]["O2"] / state(f)[1] - X_read, 0.0, X0 / fuel.nu_O2)
    mol, nt = state(nf)
    atm = Atmosphere(P=P, X_O2=mol["O2"] / nt, X_CO2=mol["CO2"] / nt, X_H2O=mol["H2O"] / nt)
    return {"X_read": X_read, "CO2": atm.X_CO2, "H2O": atm.X_H2O, "flame_equivalent_O2": equivalent_O2_in_N2(fuel, atm, T_fuel)}


def main(outdir: str = "flint_out", n_mc: int = 120, seed: int = 7) -> dict:
    t0 = time.time()
    out = Path(outdir)
    (out / "fig").mkdir(parents=True, exist_ok=True)
    R: dict = {"version": __version__, "data_notes": ICES_FIGURE_NOTES}
    buoy = Buoyancy()

    # 1. calibration + leave-one-out validation (primary: default closure, Fig. 13 data)
    v = validate(buoy)
    um, ua, ue = (buoy.u_eff(0.0, GRAVITY[b]) for b in ("moon", "mars", "earth"))
    models = {k: replace(m, Ch=v.Ch_all) for k, m in v.models.items()}
    R["closure"] = {"u1g_m_s": buoy.u1g, "n": buoy.n, "m": buoy.m, "u_moon_cm_s": 100 * um,
                    "u_mars_cm_s": 100 * ua, "u_earth_quiescent_cm_s": 100 * ue}
    R["calibration"] = {k: {"lnK": m.lnK, "E_kJ_mol": m.Ea / 1e3, "wstf_rms": v.ckl_rms[k]} for k, m in v.models.items()}
    R["Ch_all"] = v.Ch_all
    pts60 = {k: ICES[k]["wstf"][0][1] for k in ICES}
    R["lunar"] = {}
    for k, (p, o, Ch, br) in v.loo.items():
        R["lunar"][k] = {"observed": o, "flint_loo": p, "loo_error": p - o, "Ch_used": Ch, "branch": br,
                         "flint_ckl_only": v.ckl_only[k], "straight_line_u0": v.linear[k],
                         "one_g_60cms": pts60[k]}
    errs = {
        "FLINT leave-one-out": [R["lunar"][k]["loo_error"] for k in ICES],
        "FLINT blow-off branch only (no lunar data)": [R["lunar"][k]["flint_ckl_only"] - R["lunar"][k]["observed"] for k in ICES],
        "Straight line to zero flow (Table 2 method, best fit)": [R["lunar"][k]["straight_line_u0"] - R["lunar"][k]["observed"] for k in ICES],
        "No correction (1-g limit at 60 cm/s)": [R["lunar"][k]["one_g_60cms"] - R["lunar"][k]["observed"] for k in ICES],
    }
    def direction_ok(errname):
        ok = 0
        for k in ICES:
            pred = {"FLINT leave-one-out": R["lunar"][k]["flint_loo"],
                    "FLINT blow-off branch only (no lunar data)": R["lunar"][k]["flint_ckl_only"],
                    "Straight line to zero flow (Table 2 method, best fit)": R["lunar"][k]["straight_line_u0"],
                    "No correction (1-g limit at 60 cm/s)": R["lunar"][k]["one_g_60cms"]}[errname]
            ok += np.sign(pred - pts60[k]) == np.sign(R["lunar"][k]["observed"] - pts60[k])
        return int(ok)
    R["methods"] = {name: {"mae_pts": 100 * float(np.mean(np.abs(e))), "max_pts": 100 * float(np.max(np.abs(e))),
                           "direction_correct_of_4": direction_ok(name)} for name, e in errs.items()}
    v_alt = validate(buoy, use_alt=True)
    R["lunar_alt_dataset_loo_mae_pts"] = 100 * v_alt.loo_mae
    R["closure_grid"] = []
    for b in closure_grid():
        vv = validate(b)
        R["closure_grid"].append({"n": b.n, "u1g": b.u1g, "m": b.m, "loo_mae_pts": 100 * vv.loo_mae,
                                  "loo_max_pts": 100 * vv.loo_max})

    # 2. predictions across gravity
    R["gravity"] = {}
    gs = np.geomspace(0.005, 1.0, 60)
    for k, m in models.items():
        u_star, x_star = m.minimum(P_ICES)
        g_star = (u_star / buoy.u1g) ** (1 / buoy.n) if u_star < buoy.u1g else None
        R["gravity"][k] = {"moon": m.loc(P_ICES, um), "mars": m.loc(P_ICES, ua), "earth_quiescent": m.loc(P_ICES, ue),
                           "orbit_10cms": m.loc(P_ICES, 0.10), "u_star_cm_s": 100 * u_star, "loc_min": x_star,
                           "g_star": g_star, "branch_moon": m.branch(P_ICES, um), "branch_mars": m.branch(P_ICES, ua)}

    # 3. uncertainty: closures x data sets x digitization noise
    rng = np.random.default_rng(seed)
    grid = closure_grid()
    mc = {k: {"moon": [], "mars": []} for k in ICES}
    import copy
    from . import data as D
    base = copy.deepcopy(D.ICES)
    for i in range(n_mc):
        b = grid[rng.integers(len(grid))]
        use_alt = bool(rng.integers(2))
        for k in base:
            D.ICES[k]["wstf"] = [(u * (1 + 0.03 * rng.standard_normal()), x + 0.003 * rng.standard_normal()) for u, x in base[k]["wstf"]]
            D.ICES[k]["lunar"] = base[k]["lunar"] + 0.003 * rng.standard_normal()
            D.ICES[k]["lunar_alt"] = base[k]["lunar_alt"] + 0.003 * rng.standard_normal()
        try:
            vv = validate(b, use_alt=use_alt)
        except Exception:
            continue
        mm = {k: replace(m, Ch=vv.Ch_all) for k, m in vv.models.items()}
        for k in ICES:
            mc[k]["moon"].append(mm[k].loc(P_ICES, b.u_eff(0, GRAVITY["moon"])))
            mc[k]["mars"].append(mm[k].loc(P_ICES, b.u_eff(0, GRAVITY["mars"])))
    for k in base:
        D.ICES[k].update(base[k])
    R["mc"] = {k: {s: {"q10": float(np.nanpercentile(v_[s], 10)), "q50": float(np.nanpercentile(v_[s], 50)),
                       "q90": float(np.nanpercentile(v_[s], 90)), "n": int(np.isfinite(v_[s]).sum())}
                   for s in ("moon", "mars")} for k, v_ in mc.items()}
    R["mc_n"] = n_mc

    # 4. FM2
    ch = Chamber()
    fm = {}
    for fname, fuel in (("aramid-like", ARAMID_FUEL), ("cellulosic", CELLULOSE_FUEL), ("polyester-like", Fuel(C=10, H=8, O=4))):
        sig = areal_density_for_drop(ch, fuel)
        s = Sample(fuel, sig)
        rows = []
        for X0 in FM2["O2_starts"]:
            tv, tn = BurnTable(ch, s, X0, True), BurnTable(ch, s, X0, False)
            rows.append({"X0": X0, "len_vit_L26": float(100 * tv.length(0.26)[0]), "len_novit_L26": float(100 * tn.length(0.26)[0]),
                         "len_vit_L25": float(100 * tv.length(0.25)[0]), "len_vit_L24": float(100 * tv.length(0.24)[0]),
                         "full_strip": readings(ch, s, X0, s.height), "full_strip_flame_O2": flame_O2(ch, s, X0, s.height)})
        fm[fname] = {"areal_density_g_m2": 1000 * sig, "strip_mass_g": 1000 * s.mass, "rows": rows}
    s = Sample(ARAMID_FUEL, areal_density_for_drop(ch, ARAMID_FUEL))
    sim = {X0: simulate(ch, s, X0, 0.26) for X0 in FM2["O2_starts"]}
    fm["sim_aramid_L26"] = {str(X0): r["summary"] for X0, r in sim.items()}
    # sensitivity of the pressure rise to wall cooling
    fm["pressure_rise_psia"] = {f"h={h}": simulate(Chamber(h_wall=h), s, 0.33, 0.26)["summary"]["P_peak_psia"] - 8.2
                                for h in (2.0, 5.0, 10.0)}
    # Bayesian: prior = locked forecast v1 (mu 26 %, sd 1.5 points), then four hypothetical outcome sets
    prior = posterior(ch, s, [], 0.26, 0.015)
    from .chamber import outcomes_for
    scen = {}
    for label, Lt in (("as expected", 0.26), ("more flammable", 0.235), ("less flammable", 0.285)):
        obs = outcomes_for(ch, s, Lt)
        desc = ", ".join("none" if o.outcome == "none" else ("whole strip" if o.outcome == "full" else f"{o.burned_cm:.1f} cm") for o in obs)
        scen[f"{label} (true limit {Lt*100:.1f} %: {desc})"] = obs
    fm["bayes"] = {"prior": {k: prior[k] for k in ("q10", "q50", "q90", "sd")}}
    for name, obs in scen.items():
        p = posterior(ch, s, obs, 0.26, 0.015)
        best = max(((x, expected_information(ch, s, x, p)) for x in np.arange(0.22, 0.375, 0.005)), key=lambda t: t[1])
        fm["bayes"][name] = {**{k: p[k] for k in ("q10", "q50", "q90", "sd")}, "best_next_X0": float(best[0]), "best_next_bits": best[1],
                             "info_each_burn_bits": [expected_information(ch, s, o.X0, prior) for o in obs]}
    info_prior = [(float(x), expected_information(ch, s, x, prior)) for x in np.arange(0.22, 0.375, 0.005)]
    fm["info_prior"] = info_prior
    R["fm2"] = fm

    # 5. vitiation corrections for published sealed-chamber readings
    R["vitiation"] = {
        "LUCI PMMA rod, 20 % to 14.3 % reading (1 atm)": vitiation_correction(PMMA_FUEL, 0.20, 0.143, 618),
        "FM2 aramid-like, 33 % start, extinction reading 27 %": vitiation_correction(ARAMID_FUEL, 0.33, 0.27, 650, 8.2 * PSIA),
    }

    # 6. cabin scenarios: 12 m3 cabin, 1 m2 cotton-like panel 0.2 kg/m2, limit 0.15 (assumed)
    cab = {}
    for name, P, X in (("Earth air 14.7 psia, 21 %", 14.7, 0.21), ("Shuttle EVA 10.2 psia, 26.5 %", 10.2, 0.265),
                       ("Exploration 8.2 psia, 34 %", 8.2, 0.34)):
        r = cabin_fire(CELLULOSE_FUEL, 0.2, L=0.15, V=12.0, P0=P * PSIA, X0=X, v_up_ref=3e-3, excess_ref=0.06)
        cab[name] = r["summary"]
        cab[name]["_series"] = r
    R["cabin"] = {k: {kk: vv for kk, vv in v_.items() if kk != "_series"} for k, v_ in cab.items()}

    # ---------------- figures ----------------
    us = np.geomspace(0.02, 3.0, 160)
    fig, ax = plt.subplots(figsize=(7.2, 4.4))
    for k, m in models.items():
        ax.plot(us * 100, m.u_curve(P_ICES, us), color=COL[k], lw=2, label=NAME[k])
        pts = np.array(ICES[k]["wstf"])
        ax.plot([buoy.u_eff(u / 100, 1) * 100 for u in pts[:, 0]], pts[:, 1], "D", color=COL[k], ms=5)
        ax.plot(um * 100, ICES[k]["lunar"], "v", color=COL[k], ms=8, mec="k", mew=0.6)
    for x, lab in ((um, "Moon"), (ua, "Mars"), (ue, "Earth, still air")):
        ax.axvline(x * 100, color="0.6", ls=":", lw=1)
        ax.text(x * 100 * 1.03, 0.335, lab, fontsize=8, color="0.35")
    ax.set_xscale("log"); ax.set_ylim(0.08, 0.36); ax.set_xlim(2, 300)
    ax.set_xlabel("Effective flow speed seen by the flame (cm/s)"); ax.set_ylabel("Limiting O$_2$ mole fraction")
    ax.set_title("FLINT limit curves at 8.2 psia, with NASA data (ICES-2025-392)", fontsize=10)
    ax.legend(frameon=False, fontsize=8, loc="upper left")
    ax.text(2.2, 0.085, "Diamonds: 1-g WSTF limits (fit).  Triangles: lunar-g limits (validation).", fontsize=7.5, color="0.3")
    fig.tight_layout(); fig.savefig(out / "fig" / "flint_ucurves.png", dpi=200); plt.close(fig)

    fig, ax = plt.subplots(figsize=(7.2, 4.0))
    for k, m in models.items():
        ax.plot(gs, [m.loc(P_ICES, buoy.u_eff(0, g)) for g in gs], color=COL[k], lw=2, label=NAME[k])
    for g, lab in ((GRAVITY["moon"], "Moon"), (GRAVITY["mars"], "Mars"), (1.0, "Earth")):
        ax.axvline(g, color="0.6", ls=":", lw=1); ax.text(g * 1.04, 0.335, lab, fontsize=8, color="0.35")
    ax.set_xscale("log"); ax.set_ylim(0.08, 0.36)
    ax.set_xlabel("Gravity (fraction of Earth's), no forced flow"); ax.set_ylabel("Limiting O$_2$ mole fraction")
    ax.set_title("Where each material is most flammable (FLINT, 8.2 psia)", fontsize=10)
    ax.legend(frameon=False, fontsize=8)
    fig.tight_layout(); fig.savefig(out / "fig" / "flint_gravity.png", dpi=200); plt.close(fig)

    fig, ax = plt.subplots(figsize=(5.2, 4.6))
    marks = {"FLINT leave-one-out": ("o", "#1f3a5f"), "Straight line to zero flow (Table 2 method, best fit)": ("s", "#999999"),
             "No correction (1-g limit at 60 cm/s)": ("^", "#d9a441")}
    for name, (mk, c) in marks.items():
        key = {"FLINT leave-one-out": "flint_loo", "Straight line to zero flow (Table 2 method, best fit)": "straight_line_u0",
               "No correction (1-g limit at 60 cm/s)": "one_g_60cms"}[name]
        ax.scatter([R["lunar"][k]["observed"] for k in ICES], [R["lunar"][k][key] for k in ICES], marker=mk, color=c,
                   s=46, label=f"{name.split(' (')[0]}: MAE {R['methods'][name]['mae_pts']:.1f} pts", zorder=3)
    for k in ICES:
        ax.annotate(NAME[k], (R["lunar"][k]["observed"], R["lunar"][k]["flint_loo"]), fontsize=7, xytext=(4, -10), textcoords="offset points")
    ax.plot([0.1, 0.3], [0.1, 0.3], color="0.7", lw=1)
    ax.set_xlim(0.11, 0.29); ax.set_ylim(0.11, 0.29)
    ax.set_xlabel("Measured lunar-g limit (O$_2$ fraction)"); ax.set_ylabel("Predicted")
    ax.set_title("Predicting lunar-g limits from 1-g tests", fontsize=10)
    ax.legend(frameon=False, fontsize=7, loc="upper left")
    fig.tight_layout(); fig.savefig(out / "fig" / "flint_validation.png", dpi=200); plt.close(fig)

    fig, ax = plt.subplots(figsize=(7.0, 4.0))
    Ls = np.linspace(0.20, 0.38, 200)
    for X0, c in zip(FM2["O2_starts"], ("#1f3a5f", "#2c6fbb", "#7fb3e6", "#c0392b")):
        ax.plot(Ls * 100, 100 * BurnTable(ch, s, X0, True).length(Ls), color=c, lw=2, label=f"Start {X0*100:.0f} %")
        ax.plot(Ls * 100, 100 * BurnTable(ch, s, X0, False).length(Ls), color=c, lw=1, ls="--")
    ax.axvspan(24, 26, color="0.9", zorder=0); ax.text(24.2, 21.2, "NASA's expected\nlunar limit", fontsize=7.5, color="0.35")
    ax.set_xlabel("Fabric's oxygen limit L (%, in nitrogen)"); ax.set_ylabel("Burned length (cm)"); ax.set_ylim(-0.5, 23)
    ax.set_title("FM$^2$: burned length against the limit. Solid: FLINT with vitiation; dashed: oxygen only", fontsize=9)
    ax.legend(frameon=False, fontsize=8)
    fig.tight_layout(); fig.savefig(out / "fig" / "flint_fm2_lengths.png", dpi=200); plt.close(fig)

    fig, axs = plt.subplots(1, 3, figsize=(9.6, 3.2))
    for X0, c in zip(FM2["O2_starts"][:3], ("#1f3a5f", "#2c6fbb", "#7fb3e6")):
        r = sim[X0]
        axs[0].plot(r["t"] / 60, r["O2_wet"] * 100, color=c, label=f"{X0*100:.0f} %")
        axs[1].plot(r["t"] / 60, r["CO2_wet"] * 100, color=c)
        axs[2].plot(r["t"] / 60, r["P"] / PSIA, color=c)
    axs[0].axhline(26, color="0.6", ls=":"); axs[0].set_ylabel("O$_2$ reading (%)"); axs[1].set_ylabel("CO$_2$ (%)"); axs[2].set_ylabel("Pressure (psia)")
    for a in axs: a.set_xlabel("Minutes")
    axs[0].legend(frameon=False, fontsize=7)
    fig.suptitle("FM$^2$ chamber, simulated (limit 26 %; spread 1 mm/s at 30 % O$_2$ and wall cooling 5 W/m$^2$K assumed)", fontsize=9)
    fig.tight_layout(); fig.savefig(out / "fig" / "flint_fm2_traces.png", dpi=200); plt.close(fig)

    fig, axs = plt.subplots(1, 2, figsize=(9.4, 3.4))
    axs[0].plot(prior["grid"] * 100, prior["pdf"] / 100, color="0.6", lw=1.5, label="Before FM$^2$ (forecast v1)")
    for (name, obs), c in zip(scen.items(), ("#1f3a5f", "#c0392b", "#27864a")):
        p = posterior(ch, s, obs, 0.26, 0.015)
        axs[0].plot(p["grid"] * 100, p["pdf"] / 100, color=c, lw=2, label=name.split(" (")[0])
    axs[0].set_xlim(20, 31); axs[0].set_xlabel("Oxygen limit L (%)"); axs[0].set_ylabel("Probability density")
    axs[0].legend(frameon=False, fontsize=7); axs[0].set_title("What FM$^2$'s four burns would teach", fontsize=9)
    xi = np.array(info_prior)
    axs[1].plot(xi[:, 0] * 100, xi[:, 1], color="#1f3a5f", lw=2)
    axs[1].set_xlabel("Starting O$_2$ of one burn (%)"); axs[1].set_ylabel("Expected information (bits)")
    axs[1].set_title("Choosing a burn: information about L", fontsize=9)
    fig.tight_layout(); fig.savefig(out / "fig" / "flint_fm2_bayes.png", dpi=200); plt.close(fig)

    fig, axs = plt.subplots(1, 3, figsize=(9.6, 3.2))
    for (name, rr), c in zip(cab.items(), ("#999999", "#d9a441", "#c0392b")):
        r = rr["_series"]
        axs[0].plot(r["t"] / 60, r["hrr"] / 1e3, color=c, label=name)
        axs[1].plot(r["t"] / 60, r["CO2"] * 100, color=c)
        axs[2].plot(r["t"] / 60, r["T"] - 298.15, color=c)
    axs[0].set_ylabel("Heat release (kW)"); axs[1].set_ylabel("CO$_2$ (%)"); axs[2].set_ylabel("Gas temperature rise (K)")
    for a in axs: a.set_xlabel("Minutes")
    axs[0].legend(frameon=False, fontsize=6.5)
    fig.suptitle("12 m$^3$ cabin, 1 m$^2$ cotton-like panel lit at the bottom (scenario; spread rates assumed)", fontsize=9)
    fig.tight_layout(); fig.savefig(out / "fig" / "flint_cabin.png", dpi=200); plt.close(fig)

    R["runtime_s"] = time.time() - t0
    def clean(o):
        if isinstance(o, dict):
            return {str(k): clean(v_) for k, v_ in o.items() if not str(k).startswith("_")}
        if isinstance(o, (list, tuple)):
            return [clean(x) for x in o]
        if isinstance(o, (np.floating, np.integer)):
            return o.item()
        if isinstance(o, np.ndarray):
            return o.tolist()
        return o
    json.dump(clean(R), open(out / "results.json", "w"), indent=1)
    return R


if __name__ == "__main__":
    main(*(sys.argv[1:2] or ["flint_out"]))
