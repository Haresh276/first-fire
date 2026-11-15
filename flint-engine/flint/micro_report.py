"""Reproduce FLINT's freefall modules (FLEX droplets, CFI-G ignition, scenario atlas):
    python -m flint.micro_report [outdir]"""
from __future__ import annotations

import json
import sys
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from . import droplet as D
from . import ignition as IG
from . import atlas as A

plt.rcParams.update({"font.size": 10, "axes.spines.top": False, "axes.spines.right": False})
DIL = {"N2": "#1f3a5f", "CO2": "#c0392b", "He": "#e6a23c"}


def diluent(d):
    return "CO2" if d["CO2"] > 0 else ("He" if d["He"] > 0 else "N2")


def main(outdir: str = "micro_out") -> dict:
    out = Path(outdir); (out / "fig").mkdir(parents=True, exist_ok=True)
    rows = D.load()
    R = {"flex_rows": len(rows)}
    R["burning_rate"] = D.burning_rate_validation(rows)
    R["extinction"] = D.extinction_validation(rows)
    # transfer error of the burning-rate theory, split by diluent and pressure
    split = {}
    for f in D.FUELS:
        Rf = [d for d in rows if d["fuel"] == f and np.isfinite(d["K_obs"]) and d["K_obs"] > 0]
        kap = D.fit_kappa([d for d in Rf if D.air_like(d)])
        for grp, cond in (("CO2", lambda d: d["CO2"] > 0), ("He", lambda d: d["He"] > 0),
                          ("O2/N2 at 0.7 atm", lambda d: d["CO2"] == 0 and d["He"] == 0 and d["P"] < 12),
                          ("O2/N2 at 1 atm (training)", lambda d: D.air_like(d))):
            G = [kap * d["K_th"] / d["K_obs"] - 1 for d in Rf if cond(d)]
            split[f"{f} | {grp}"] = {"n": len(G), "mean_bias_pct": 100 * float(np.mean(G)) if G else None,
                                     "mape_pct": 100 * float(np.mean(np.abs(G))) if G else None}
    R["burning_rate_transfer_by_group"] = split
    models = {f: D.fit_extinction(rows, f) for f in D.FUELS}
    R["limiting_O2"] = {f: {f"{agent}_{x}": D.limiting_O2(models[f], 3.0, 14.7, **({"CO2_pct": x} if agent == "CO2" else {"He_pct": x}))
                            for agent in ("CO2", "He") for x in (0, 15, 30)} for f in D.FUELS}
    # near-limit check: runs whose flame died at >= 95 % of its starting size
    near = []
    for d in rows:
        if d["outcome"] == "Extinction" and np.isfinite(d["de"]) and d["de"] / d["d0"] >= 0.95:
            near.append({"fuel": d["fuel"], "O2": d["O2"], "CO2": d["CO2"], "He": d["He"], "P": d["P"],
                         "observed_ratio": d["de"] / d["d0"],
                         "model_ratio": float(np.exp(models[d["fuel"]].ln_de(d["d0"], d["Tf"], d["alpha"])) / d["d0"])})
    R["near_limit_runs"] = near
    R["near_limit_model_ratio_median"] = float(np.median([x["model_ratio"] for x in near])) if near else None
    ig = IG.load()
    R["cfig"] = IG.validate(ig)
    at = A.build(out)
    R["atlas_summary"] = at["summary"]

    # figures
    fig, axs = plt.subplots(1, 2, figsize=(9.4, 4.0))
    for ax, f in zip(axs, D.FUELS):
        kap = R["burning_rate"][f]["kappa_air"]
        for dil in DIL:
            S = [d for d in rows if d["fuel"] == f and np.isfinite(d["K_obs"]) and d["K_obs"] > 0 and diluent(d) == dil]
            ax.scatter([d["K_obs"] for d in S], [kap * d["K_th"] for d in S], s=14, color=DIL[dil], label=f"{dil} balance" if dil != "N2" else "O2/N2", alpha=0.8)
        ax.plot([0, 1.6], [0, 1.6], color="0.6", lw=1)
        ax.set_xlim(0, 1.2); ax.set_ylim(0, 1.2); ax.set_xlabel("Measured burning rate K (mm$^2$/s)"); ax.set_ylabel("FLINT")
        ax.set_title(f"{f}: d$^2$-law fitted on ordinary air runs only", fontsize=9)
    axs[0].legend(frameon=False, fontsize=7)
    fig.suptitle("FLEX on the ISS (PSI-69): burning rates in CO$_2$, helium and pressure it was not fitted on", fontsize=9.5)
    fig.tight_layout(); fig.savefig(out / "fig" / "flint_flex_rate.png", dpi=200); plt.close(fig)

    fig, axs = plt.subplots(1, 2, figsize=(9.4, 4.0))
    for ax, f in zip(axs, D.FUELS):
        for dil in DIL:
            S = [d for d in rows if d["fuel"] == f and d["outcome"] == "Extinction" and np.isfinite(d["de"]) and d["de"] > 0 and diluent(d) == dil]
            ax.scatter([d["de"] for d in S], [np.exp(models[f].ln_de(d["d0"], d["Tf"], d["alpha"])) for d in S], s=14, color=DIL[dil], alpha=0.8,
                       label=f"{dil} balance" if dil != "N2" else "O2/N2")
        ax.plot([0, 5], [0, 5], color="0.6", lw=1); ax.set_xlim(0, 4.8); ax.set_ylim(0, 4.8)
        ax.set_xlabel("Measured extinction diameter (mm)"); ax.set_ylabel("FLINT (fit on all runs)")
        ax.set_title(f"{f}: cross-validated error {R['extinction'][f]['cv_mae_mm_model']:.2f} mm", fontsize=9)
    axs[0].legend(frameon=False, fontsize=7)
    fig.suptitle("FLEX: the droplet size at which the flame dies", fontsize=9.5)
    fig.tight_layout(); fig.savefig(out / "fig" / "flint_flex_extinction.png", dpi=200); plt.close(fig)

    fig, ax = plt.subplots(figsize=(6.6, 4.0))
    xs = np.linspace(0, 40, 21)
    for f, ls in zip(D.FUELS, ("-", "--")):
        ax.plot(xs, [D.limiting_O2(models[f], 3.0, 14.7, CO2_pct=x) for x in xs], ls, color=DIL["CO2"], label=f"{f} + CO$_2$")
        ax.plot(xs, [D.limiting_O2(models[f], 3.0, 14.7, He_pct=x) for x in xs], ls, color=DIL["He"], label=f"{f} + helium")
    ax.set_xlabel("Agent replacing nitrogen (% of the atmosphere)"); ax.set_ylabel("Oxygen below which a 3 mm\ndroplet flame dies (%)")
    ax.set_title("Suppressants for droplet fires in freefall (FLINT fitted to FLEX)", fontsize=9.5)
    ax.legend(frameon=False, fontsize=7.5)
    fig.tight_layout(); fig.savefig(out / "fig" / "flint_flex_suppression.png", dpi=200); plt.close(fig)

    S = at["solids"]
    gravs = ["orbit", "moon", "mars", "earth"]
    atms = [a for a, _, _ in A.ATMOS]
    fig, axs = plt.subplots(1, 4, figsize=(11.5, 3.6), sharey=True)
    for ax, key in zip(axs, A.SOLIDS.values()):
        M = np.full((len(atms), len(gravs)), np.nan)
        for i, a in enumerate(atms):
            for j, g in enumerate(gravs):
                vent = "nominal 10 cm/s" if g == "orbit" else "fans off"
                r = [x for x in S if x["fuel"] == key and x["atmosphere"] == a and x["gravity"] == g and x["ventilation"] == vent][0]
                M[i, j] = r.get("margin_pts", np.nan)
        im = ax.imshow(M, cmap="RdBu_r", vmin=-15, vmax=15, aspect="auto")
        for i in range(len(atms)):
            for j in range(len(gravs)):
                ax.text(j, i, f"{M[i, j]:+.0f}", ha="center", va="center", fontsize=7.5,
                        color="white" if abs(M[i, j]) > 8 else "black")
        ax.set_xticks(range(len(gravs))); ax.set_xticklabels(["orbit*", "Moon", "Mars", "Earth"], fontsize=8)
        ax.set_title(key, fontsize=9)
    axs[0].set_yticks(range(len(atms))); axs[0].set_yticklabels([a.split(" (")[0] for a in atms], fontsize=7.5)
    fig.colorbar(im, ax=axs, shrink=0.8, label="Oxygen above the limit (points)")
    fig.suptitle("Where each material keeps burning: fans off, except orbit* with 10 cm/s ventilation (FLINT; most cells are extrapolations)", fontsize=9)
    fig.savefig(out / "fig" / "flint_atlas.png", dpi=200, bbox_inches="tight"); plt.close(fig)

    def clean(o):
        if isinstance(o, dict):
            return {str(k): clean(v) for k, v in o.items()}
        if isinstance(o, (list, tuple)):
            return [clean(x) for x in o]
        if isinstance(o, (np.floating, np.integer)):
            return o.item()
        return o
    json.dump(clean(R), open(out / "micro_results.json", "w"), indent=1)
    return R


if __name__ == "__main__":
    main(*(sys.argv[1:2] or ["micro_out"]))
