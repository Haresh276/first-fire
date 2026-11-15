"""Gas properties and thermochemistry.

Everything here is standard textbook physics with stated sources:
  * Sensible enthalpies: NIST-JANAF Thermochemical Tables (Chase, 1998), H(T) - H(298.15 K).
  * Heats of combustion, when a material has no measured value: Huggett's
    oxygen-consumption constant, 13.1 MJ per kg of O2 consumed (Huggett, Fire and
    Materials 4, 1980), which is within about 5 % for most organic polymers.
  * Flame temperature: the Burke-Schumann flame-sheet temperature of a diffusion
    flame, i.e. the adiabatic temperature of fuel vapour and ambient gas mixed in
    stoichiometric proportion. No dissociation (stated limit of the engine).
"""
from __future__ import annotations

from dataclasses import dataclass, field
import numpy as np
from scipy.interpolate import PchipInterpolator
from scipy.optimize import brentq

R = 8.314462618          # J / (mol K)
SIGMA = 5.670374419e-8   # W / (m^2 K^4)
G0 = 9.80665             # m / s^2
PSIA = 6894.757          # Pa per psi
HUGGETT = 13.1e6         # J per kg O2 consumed

GRAVITY = {"orbit": 0.0, "moon": 0.1654, "mars": 0.3794, "earth": 1.0}

MW = {"N2": 28.014, "O2": 31.998, "CO2": 44.009, "H2O": 18.015, "Ar": 39.948, "He": 4.0026}

_T = np.array([298.15, 500.0, 1000.0, 1500.0, 2000.0, 2500.0, 3000.0, 3500.0])
_H = {  # kJ/mol, NIST-JANAF
    "N2":  [0.0, 5.912, 21.463, 38.405, 56.137, 74.305, 92.715, 111.27],
    "O2":  [0.0, 6.088, 22.707, 40.600, 59.175, 78.375, 98.013, 118.06],
    "CO2": [0.0, 8.305, 33.397, 61.705, 91.439, 121.926, 152.862, 184.0],
    "H2O": [0.0, 6.922, 26.000, 48.151, 72.689, 98.964, 126.549, 154.9],
    "Ar":  [0.0, 4.197, 14.590, 24.983, 35.376, 45.770, 56.163, 66.556],
    "He":  [0.0, 4.197, 14.590, 24.983, 35.376, 45.770, 56.163, 66.556],   # monatomic, as Ar
}
_HI = {k: PchipInterpolator(_T, np.array(v) * 1e3, extrapolate=True) for k, v in _H.items()}


def h_sens(species: str, T: float) -> float:
    """Sensible enthalpy H(T) - H(298.15) in J/mol."""
    return float(_HI[species](T))


def cp_species(species: str, T: float) -> float:
    """Molar heat capacity in J/(mol K)."""
    return float(_HI[species].derivative()(T))


@dataclass
class Atmosphere:
    """A well-mixed gas: total pressure in Pa, mole fractions, temperature in K.

    Nitrogen is the balance gas unless given."""
    P: float
    X_O2: float
    X_CO2: float = 0.0
    X_H2O: float = 0.0
    X_Ar: float = 0.0
    T: float = 298.15
    X_He: float = 0.0

    @property
    def X_N2(self) -> float:
        return 1.0 - self.X_O2 - self.X_CO2 - self.X_H2O - self.X_Ar - self.X_He

    def X(self) -> dict:
        return {"O2": self.X_O2, "N2": self.X_N2, "CO2": self.X_CO2,
                "H2O": self.X_H2O, "Ar": self.X_Ar, "He": self.X_He}

    @property
    def W(self) -> float:
        """Mean molar mass, kg/mol."""
        return sum(x * MW[s] for s, x in self.X().items()) / 1000.0

    @property
    def Y_O2(self) -> float:
        return self.X_O2 * MW["O2"] / 1000.0 / self.W

    @property
    def pO2_kPa(self) -> float:
        return self.P * self.X_O2 / 1000.0

    @classmethod
    def psia(cls, p_psia: float, X_O2: float, **kw) -> "Atmosphere":
        return cls(P=p_psia * PSIA, X_O2=X_O2, **kw)


# --- transport properties ---------------------------------------------------
# Species conductivities, W/(m K): power laws through handbook values at 300 and 1000 K.
_K_SPECIES = {"N2": (0.0260, 0.76), "O2": (0.0266, 0.80), "CO2": (0.0166, 1.17),
              "H2O": (0.0181, 1.40), "Ar": (0.0177, 0.73), "He": (0.155, 0.69)}


def k_mix(atm: "Atmosphere", T: float) -> float:
    """Mixture conductivity: mean of the mole-weighted arithmetic and harmonic averages."""
    xs = {s: x for s, x in atm.X().items() if x > 0}
    ks = {s: _K_SPECIES[s][0] * (T / 300.0) ** _K_SPECIES[s][1] for s in xs}
    return 0.5 * (sum(xs[s] * ks[s] for s in xs) + 1.0 / sum(xs[s] / ks[s] for s in xs))


# --- transport properties of O2/N2-like mixtures (air correlations) ----------
def k_gas(T: float) -> float:
    """Thermal conductivity, W/(m K). Power-law fit to air, about 5 % from 300 to 1500 K."""
    return 0.0263 * (T / 300.0) ** 0.80


def mu_gas(T: float) -> float:
    """Dynamic viscosity, Pa s (air power law)."""
    return 1.846e-5 * (T / 300.0) ** 0.70


def cp_mass(atm: Atmosphere, T: float) -> float:
    """Specific heat of the mixture at T, J/(kg K)."""
    return sum(x * cp_species(s, T) for s, x in atm.X().items() if x > 0) / atm.W


def rho_gas(atm: Atmosphere, T: float) -> float:
    return atm.P * atm.W / (R * T)


def alpha_gas(atm: Atmosphere, T: float) -> float:
    return k_gas(T) / (rho_gas(atm, T) * cp_mass(atm, T))


# --- fuels -------------------------------------------------------------------
@dataclass
class Fuel:
    """A fuel given as an empirical formula per repeat unit, C_c H_h O_o N_n."""
    C: float
    H: float
    O: float = 0.0
    N: float = 0.0
    Hc: float | None = None      # J/kg, lower heating value; Huggett if None
    cp_vap: float = 1800.0       # J/(kg K), fuel vapour, only for the small sensible term

    @property
    def MW(self) -> float:
        return 12.011 * self.C + 1.008 * self.H + 15.999 * self.O + 14.007 * self.N

    @property
    def nu_O2(self) -> float:
        """mol O2 per mol of repeat unit for complete combustion."""
        return self.C + self.H / 4.0 - self.O / 2.0

    @property
    def r(self) -> float:
        """Stoichiometric O2-to-fuel mass ratio."""
        return self.nu_O2 * MW["O2"] / self.MW

    @property
    def heat_of_combustion(self) -> float:
        return self.Hc if self.Hc is not None else HUGGETT * self.r

    def products_per_mol(self) -> dict:
        return {"CO2": self.C, "H2O": self.H / 2.0, "N2": self.N / 2.0}


def flame_temperature(fuel: Fuel, atm: Atmosphere, T_fuel: float = 600.0) -> float:
    """Burke-Schumann flame-sheet temperature (K) of fuel vapour at T_fuel burning in atm.

    Per mol of fuel repeat unit, nu_O2 / X_O2 mol of ambient gas reach the flame sheet."""
    if atm.X_O2 <= 0:
        return atm.T
    n_amb = fuel.nu_O2 / atm.X_O2
    prod = fuel.products_per_mol()
    X = atm.X()
    nprod = {s: prod.get(s, 0.0) + n_amb * X[s] for s in ("CO2", "H2O", "N2", "Ar", "He")}
    q = fuel.heat_of_combustion * fuel.MW / 1000.0                    # J per mol fuel
    q += fuel.cp_vap * fuel.MW / 1000.0 * (T_fuel - 298.15)            # vapour sensible heat
    q += n_amb * sum(x * h_sens(s, atm.T) for s, x in X.items() if x > 0)

    def f(T):
        return sum(n * h_sens(s, T) for s, n in nprod.items() if n > 0) - q
    return brentq(f, 298.15, 9000.0)


def equivalent_O2_in_N2(fuel: Fuel, atm: Atmosphere, T_fuel: float = 600.0) -> float:
    """Oxygen mole fraction in a pure O2/N2 mixture that gives the same flame temperature
    as `atm` (which may contain CO2 and H2O). Used to correct a sealed-chamber reading."""
    Tf = flame_temperature(fuel, atm, T_fuel)
    g = lambda x: flame_temperature(fuel, Atmosphere(atm.P, x, T=atm.T), T_fuel) - Tf
    return brentq(g, 0.02, 0.80)
