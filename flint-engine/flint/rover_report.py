"""Reproduce the pressurized-rover fire case:  python -m flint.rover_report [outdir]"""
from __future__ import annotations
import json, sys
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from .rover import Rover, default_inventory, calibrated_models, rover_case, item_loc
from .chamber import cabin_fire
from .materials import LIBRARY
from .thermo import PSIA

COL = {"PMMA": "#c0392b", "P213": "#27864a", "PC": "#e67e22", "NOMEX": "#2c6fbb"}
NAME = {"PMMA": "PMMA cover", "P213": "P213 tape", "PC": "Polycarbonate housing", "NOMEX": "Nomex Velcro"}


def main(outdir: str = "rover_out") -> dict:
    out = Path(outdir); out.mkdir(parents=True, exist_ok=True)
    models = calibrated_models()
    rv = Rover(items=default_inventory())
    res = rover_case(models, rv)
    sens = {}
    for it in rv.items:
        L = item_loc(models, it, rv, fan=0.0); mat = LIBRARY[it.material]; side = float(np.sqrt(it.area_m2))
        sens[it.material] = {f: cabin_fire(mat.fuel, it.areal_density, L=L, V=rv.volume_m3, P0=rv.P_psia * PSIA,
                                           X0=rv.X_O2, panel_w=side, panel_h=side, v_up_ref=3e-3 * f,
                                           m_flux_ref=0.010 * f, t_max=900)["summary"]["t_hrr_10kW_s"]
                             for f in (0.5, 1.0, 2.0)}
    res["timeline_sensitivity_t10kW"] = sens
    json.dump(res, open(out / "rover_case.json", "w"), indent=1, default=float)
    tr = res["trade"]
    fig, ax = plt.subplots(figsize=(9.2, 4.3)); x = np.arange(len(tr)); w = 0.2
    for i, k in enumerate(["PMMA", "P213", "PC", "NOMEX"]):
        ax.bar(x + (i - 1.5) * w, [t["margins"][k] for t in tr], w, color=COL[k], label=NAME[k])
    ax.axhline(0, color="k", lw=0.8)
    ax.set_xticks(x)
    ax.set_xticklabels([f"{t['atmosphere']}\n{t['P_psia']} psia, {t['X_O2']*100:.1f} % O$_2$\npre-breathe ratio {t['prebreathe_ratio']:.2f}" for t in tr], fontsize=7)
    ax.set_ylabel("Oxygen above the limit (points)\n> 0: it keeps burning")
    ax.set_title("Lunar rover cabin, fans off: which items keep burning in each atmosphere (FLINT)", fontsize=10)
    ax.legend(frameon=False, fontsize=8, ncol=2)
    fig.tight_layout(); fig.savefig(out / "rover_trade.png", dpi=200); plt.close(fig)
    fig, axs = plt.subplots(1, 2, figsize=(9.6, 3.4))
    for it in rv.items:
        L = item_loc(models, it, rv, fan=0.0); mat = LIBRARY[it.material]; side = float(np.sqrt(it.area_m2))
        r = cabin_fire(mat.fuel, it.areal_density, L=L, V=rv.volume_m3, P0=rv.P_psia * PSIA, X0=rv.X_O2,
                       panel_w=side, panel_h=side, v_up_ref=3e-3, t_max=300)
        axs[0].plot(r["t"], r["hrr"] / 1e3, color=COL[it.material], label=NAME[it.material])
        axs[1].plot(r["t"], r["CO2"] * 100, color=COL[it.material])
    axs[0].set_xlim(0, 180); axs[0].set_ylim(0, 60); axs[0].set_xlabel("Seconds after ignition"); axs[0].set_ylabel("Heat release (kW)")
    axs[1].set_xlim(0, 300); axs[1].set_xlabel("Seconds after ignition"); axs[1].set_ylabel("Cabin CO$_2$ (%)")
    axs[0].legend(frameon=False, fontsize=7)
    fig.tight_layout(); fig.savefig(out / "rover_timeline.png", dpi=200); plt.close(fig)
    return res


if __name__ == "__main__":
    main(*(sys.argv[1:2] or ["rover_out"]))
