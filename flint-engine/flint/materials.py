"""Materials library. Every number carries its source.

ICES = Urban et al., "Solid Fuel Ignition Testing for Lunar Applications, Theory and
Experimental Results", ICES-2025-392, Table 1 (PDF page 9).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from .thermo import Fuel


@dataclass
class Material:
    name: str
    fuel: Fuel
    rho: float                 # solid density, kg/m3
    cs: float                  # solid specific heat, J/(kg K)
    eps: float                 # surface emissivity
    Tp: float                  # pyrolysis temperature, K
    E: float                   # gas-phase activation energy, J/mol (CKL branch)
    dHp: float = 1.35e6        # heat of pyrolysis, J/kg
    thickness_m: float | None = None
    areal_density: float | None = None   # kg/m2, for fabrics
    Hc_table1: float | None = None       # J/kg as printed in ICES Table 1 (not used, see note)
    sources: dict = field(default_factory=dict)
    notes: str = ""


PMMA_FUEL = Fuel(C=5, H=8, O=2)              # methyl methacrylate repeat unit
PC_FUEL = Fuel(C=16, H=14, O=3)              # bisphenol-A polycarbonate
ARAMID_FUEL = Fuel(C=14, H=10, O=2, N=2)     # poly(m-phenylene isophthalamide), Nomex
CELLULOSE_FUEL = Fuel(C=6, H=10, O=5)

_ICES = "ICES-2025-392 Table 1, p9"

LIBRARY = {
    "PMMA": Material(
        "PMMA", PMMA_FUEL, rho=1190, cs=1400, eps=0.9, Tp=618, E=125000, Hc_table1=60.2e6,
        sources={k: _ICES for k in ("rho", "cs", "eps", "Tp", "E", "dHp")} | {"formula": "standard"},
        notes="Thin cast sheet; the 0.8 mm thickness is stated in the caption of ICES Fig. 7."),
    "P213": Material(
        "P213 tape", PMMA_FUEL, rho=1190, cs=1400, eps=0.9, Tp=618, E=125000,
        sources={"all": "ICES-2025-392 groups P213 with PMMA (Fig. 13 caption, p10)"},
        notes="Fiberglass tape with an acrylic (PMMA) adhesive (ICES p8); modelled with PMMA properties, as NASA did."),
    "PC": Material(
        "Polycarbonate", PC_FUEL, rho=1200, cs=1150, eps=0.9, Tp=700, E=200000, Hc_table1=33.6e6,
        sources={k: _ICES for k in ("rho", "cs", "eps", "Tp", "E", "dHp")} | {"formula": "standard"}),
    "NOMEX": Material(
        "Nomex Velcro", ARAMID_FUEL, rho=1370, cs=1255, eps=0.9, Tp=750, E=408000, Hc_table1=44.1e6,
        sources={k: _ICES + " (Nomex column)" for k in ("rho", "cs", "eps", "Tp", "E", "dHp")} | {"formula": "standard"},
        notes="ICES Table 1 gives Nomex fibre properties; the tested article was a thicker Nomex Velcro."),
    "CELLULOSE": Material(
        "Cellulose (cotton, paper)", CELLULOSE_FUEL, rho=1500, cs=1300, eps=0.9, Tp=600, E=125000,
        sources={"all": "typical literature values (K-level), not from a NASA table"},
        notes="Generic charring fuel. Gas-phase flame only; char smoulder is outside the model."),
}

# Heats of combustion: FLINT uses Huggett's rule from the formula (see thermo.py).
# ICES Table 1 prints 60.2, 44.1 and 33.6 MJ/kg for PMMA, Nomex and PC; the standard
# lower heating values are near 25, 27 and 30 MJ/kg. Huggett gives 25.1, 27.3 and 29.7.
