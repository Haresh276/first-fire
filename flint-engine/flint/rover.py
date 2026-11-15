"""The pressurized-rover fire case. NASA's FM2 slides (PDF p25): "HLS, Lunar habitat and
pressurized rover will nominally use 8.2 psia / 34% O2", with control bands up to 37 % O2.

The pressurized-rover fire case: what a crew rover is for in this challenge.

The challenge asks for the investigations most relevant to crew habitats, "including
pressurized rovers". A rover is the hardest habitat: a small cabin (about 13 m3 for the
JAXA/Toyota Lunar Cruiser concept), a low-pressure, high-oxygen atmosphere so the crew
can go outside quickly, partial gravity, and no fire brigade. This module answers the
questions a rover designer must answer, using FLINT's physics:

  1. Which items in the cabin can burn, at this gravity, pressure, oxygen and fan speed?
  2. Which cabin atmosphere trades EVA readiness against fire margin best?
  3. If an item ignites, how fast does the cabin change (heat, CO2, pressure)?
  4. What stops it: fans off, a CO2 or N2 flood (how much?), or venting the cabin (to what
     pressure?), and what does each response do to the crew?

Pressure scaling (Da ~ P^2, h ~ P^1/2, u_b ~ P^-1/3) is FLINT's physics but is validated
only at 8.2 psia. Every result outside 8.2 psia is labelled as a model extrapolation.
"""
from __future__ import annotations

from dataclasses import dataclass, field, replace
import numpy as np
from scipy.optimize import brentq

from .thermo import Atmosphere, PSIA, GRAVITY, R, MW, equivalent_O2_in_N2
from .limits import LimitModel, Buoyancy, P_REF
from .materials import LIBRARY
from .calibrate import fit_ckl, validate
from .chamber import cabin_fire

SUIT_KPA = 29.6            # suit pressure used for the pre-breathe ratio (B17)
HYPOXIA_PO2_KPA = 16.0     # below about this oxygen partial pressure an unsuited crew is impaired
CO2_CREW_LIMIT = 0.04      # 4 % CO2: unsuited crew must mask up well before this


@dataclass
class PBuoyancy(Buoyancy):
    """Buoyant velocity with the pressure dependence of (g * alpha)^(1/3): alpha ~ 1/P."""
    n_p: float = 1.0 / 3.0

    def u_eff_P(self, u_forced: float, g: float, P: float) -> float:
        ub = self.u_b(g) * (P_REF / P) ** self.n_p
        return float((max(u_forced, 0.0) ** self.m + ub ** self.m) ** (1.0 / self.m))


@dataclass
class CabinItem:
    name: str
    material: str              # key into LIBRARY / calibrated models
    area_m2: float
    areal_density: float       # kg/m2
    where: str = ""


@dataclass
class Rover:
    name: str = "Lunar pressurized rover (13 m3, the size of the JAXA/Toyota Lunar Cruiser concept)"
    volume_m3: float = 13.0
    P_psia: float = 8.2
    X_O2: float = 0.34
    gravity: str = "moon"
    fan_m_s: float = 0.10
    crew: int = 2
    items: list = field(default_factory=list)


def default_inventory() -> list:
    """Items made of the five materials NASA tested at lunar gravity (ICES-2025-392).
    Areas and areal densities are illustrative assumptions, stated here."""
    return [
        CabinItem("Window and display cover (PMMA, 3 mm)", "PMMA", 0.6, 3.57, "forward cabin"),
        CabinItem("Cable-bundle and stowage tape (P213)", "P213", 0.3, 0.40, "lockers"),
        CabinItem("Equipment housings (polycarbonate, 2 mm)", "PC", 1.2, 2.40, "racks"),
        CabinItem("Hook-and-loop fasteners (Nomex Velcro)", "NOMEX", 0.8, 0.45, "walls"),
    ]


def calibrated_models(buoy: Buoyancy | None = None) -> dict:
    buoy = buoy or Buoyancy()
    v = validate(buoy)
    return {k: replace(m, Ch=v.Ch_all) for k, m in v.models.items()}


def item_loc(models: dict, item: CabinItem, rover: Rover, P_psia: float | None = None,
             fan: float | None = None, buoy: PBuoyancy | None = None) -> float:
    buoy = buoy or PBuoyancy()
    P = (rover.P_psia if P_psia is None else P_psia) * PSIA
    u = buoy.u_eff_P(rover.fan_m_s if fan is None else fan, GRAVITY[rover.gravity], P)
    return models[item.material].loc(P, u)


def assess(models: dict, rover: Rover) -> list:
    """Per item: limit with fans on and off, margin, and which way it would die."""
    buoy = PBuoyancy()
    out = []
    P = rover.P_psia * PSIA
    for it in rover.items:
        on = item_loc(models, it, rover, buoy=buoy)
        off = item_loc(models, it, rover, fan=0.0, buoy=buoy)
        u_off = buoy.u_eff_P(0.0, GRAVITY[rover.gravity], P)
        out.append({"item": it.name, "material": it.material, "loc_fans_on": on, "loc_fans_off": off,
                    "margin_fans_off_pts": 100 * (rover.X_O2 - off), "burns_fans_off": rover.X_O2 > off,
                    "branch_fans_off": models[it.material].branch(P, u_off)})
    return out


ATMOSPHERES = [
    ("Earth sea level", 14.7, 0.21), ("Shuttle EVA preparation", 10.2, 0.265),
    ("NASA exploration atmosphere", 8.2, 0.34), ("Upper control band", 8.2, 0.37), ("Exploration, lower oxygen", 8.2, 0.30),
    ("Low pressure, 30 % oxygen", 7.0, 0.30),
]


def atmosphere_trade(models: dict, rover: Rover) -> list:
    rows = []
    for name, P, X in ATMOSPHERES:
        r = replace(rover, P_psia=P, X_O2=X)
        a = assess(models, r)
        pN2 = P * PSIA * (1 - X) / 1000.0
        rows.append({"atmosphere": name, "P_psia": P, "X_O2": X, "pO2_kPa": P * PSIA * X / 1000.0,
                     "prebreathe_ratio": pN2 / SUIT_KPA,
                     "items_that_burn": sum(x["burns_fans_off"] for x in a), "of": len(a),
                     "smallest_margin_pts": min(x["margin_fans_off_pts"] for x in a),
                     "margins": {x["material"]: x["margin_fans_off_pts"] for x in a},
                     "validated_pressure": abs(P - 8.2) < 1e-9})
    return rows


def _cabin_moles(rover: Rover) -> float:
    return rover.P_psia * PSIA * rover.volume_m3 / (R * 298.15)


def flood_dose(models: dict, rover: Rover, item: CabinItem, agent: str = "CO2", margin: float = 0.01) -> dict:
    """Agent (kg) to add, at fixed volume, until the item's flame-equivalent oxygen is `margin`
    below its limit with fans off. Returns the dose and what the crew would then breathe."""
    mat = LIBRARY[item.material]
    n0 = _cabin_moles(rover)
    nO2 = n0 * rover.X_O2
    buoy = PBuoyancy()

    def state(n_add):
        nt = n0 + n_add
        P = rover.P_psia * PSIA * nt / n0
        if agent == "CO2":
            atm = Atmosphere(P=P, X_O2=nO2 / nt, X_CO2=n_add / nt)
        else:   # N2 adds to the balance gas
            atm = Atmosphere(P=P, X_O2=nO2 / nt)
        return atm

    def gap(n_add):
        atm = state(n_add)
        u = buoy.u_eff_P(0.0, GRAVITY[rover.gravity], atm.P)
        L = models[item.material].loc(atm.P, u)
        x_eq = equivalent_O2_in_N2(mat.fuel, atm, mat.Tp) if agent == "CO2" else atm.X_O2
        return x_eq - (L - margin)

    if gap(0.0) <= 0:
        return {"agent": agent, "needed": False, "kg": 0.0}
    hi = n0 * 0.05
    while gap(hi) > 0 and hi < n0 * 50:
        hi *= 2
    if gap(hi) > 0:
        return {"agent": agent, "needed": True, "kg": np.inf}
    n_add = brentq(gap, 0.0, hi, xtol=1e-6)
    atm = state(n_add)
    kg = n_add * MW[agent] / 1000.0
    return {"agent": agent, "needed": True, "kg": kg, "final_P_psia": atm.P / PSIA, "final_O2": atm.X_O2,
            "final_CO2": atm.X_CO2, "pO2_kPa": atm.P * atm.X_O2 / 1000.0,
            "crew_must_mask": (atm.X_CO2 > CO2_CREW_LIMIT) if agent == "CO2" else (atm.P * atm.X_O2 / 1000.0 < HYPOXIA_PO2_KPA)}


def vent_pressure(models: dict, rover: Rover, item: CabinItem, margin: float = 0.01) -> dict:
    """Cabin pressure (psia) to vent to, at constant composition, before the item's limit rises
    above the cabin oxygen (fans off). Model extrapolation below 8.2 psia."""
    buoy = PBuoyancy()

    def gap(Ppsia):
        P = Ppsia * PSIA
        u = buoy.u_eff_P(0.0, GRAVITY[rover.gravity], P)
        L = models[item.material].loc(P, u)
        return (L - margin) - rover.X_O2 if np.isfinite(L) else 1.0
    if gap(rover.P_psia) >= 0:
        return {"needed": False, "P_psia": rover.P_psia}
    lo = 0.2
    if gap(lo) < 0:
        return {"needed": True, "P_psia": None}
    P = brentq(gap, lo, rover.P_psia, xtol=1e-4)
    return {"needed": True, "P_psia": P, "pO2_kPa": P * PSIA * rover.X_O2 / 1000.0,
            "crew_must_be_suited": P * PSIA * rover.X_O2 / 1000.0 < HYPOXIA_PO2_KPA}


def fire_timeline(models: dict, rover: Rover, item: CabinItem, v_up_ref: float = 3e-3) -> dict:
    """Panel fire from the item, using its limit with fans off. Spread rate is an assumption."""
    L = item_loc(models, item, rover, fan=0.0)
    mat = LIBRARY[item.material]
    side = float(np.sqrt(item.area_m2))
    r = cabin_fire(mat.fuel, item.areal_density, L=L, V=rover.volume_m3, P0=rover.P_psia * PSIA,
                   X0=rover.X_O2, panel_w=side, panel_h=side, v_up_ref=v_up_ref, t_max=900.0)
    return {**r["summary"], "limit_used": L}


def rover_case(models: dict | None = None, rover: Rover | None = None) -> dict:
    models = models or calibrated_models()
    rover = rover or Rover(items=default_inventory())
    res = {"rover": {"name": rover.name, "volume_m3": rover.volume_m3, "P_psia": rover.P_psia,
                     "X_O2": rover.X_O2, "gravity": rover.gravity, "fan_m_s": rover.fan_m_s, "crew": rover.crew},
           "items": assess(models, rover), "trade": atmosphere_trade(models, rover), "responses": []}
    for it in rover.items:
        res["responses"].append({"item": it.name, "material": it.material,
                                 "co2": flood_dose(models, rover, it, "CO2"),
                                 "n2": flood_dose(models, rover, it, "N2"),
                                 "vent": vent_pressure(models, rover, it),
                                 "timeline": fire_timeline(models, rover, it)})
    return res
