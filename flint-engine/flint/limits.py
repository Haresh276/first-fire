"""Extinction limits of thin solids: the two-branch model used by NASA in ICES-2025-392.

The paper (Urban et al., after Fernandez-Pello 1995 and Thomsen et al. 2025) writes the
limiting oxygen concentration (LOC) as the larger of two limits:

  * Chemical kinetic limit (CKL, blow-off), its Eq. 5: the Damkohler number
        Da = (l_c / u) A0 exp(-Ea / R Tf) X_fuel^a X_O2^b (P / R T)^(a+b)
    falls to a critical value. FLINT lumps the unknown constants (l_c, A0, X_fuel,
    Da_cr) into one fitted constant K per material, exactly the parameter NASA fitted.

  * Heat transfer limit (HTL, quenching), its Eq. 8 without external or flame
    radiation (small near the quenching limit, as the paper notes):
        C1 (k rho cp u / x)^(1/2) (Tf - Tp) = Fs eps sigma (Tp^4 - T0^4)
    FLINT lumps C1 / sqrt(x) into one constant Ch shared by all materials.

What FLINT adds: a physical flame temperature Tf(O2, CO2, H2O) instead of a fixed one, so
both limits respond to the atmosphere; and an effective-velocity closure that turns any
gravity level and forced flow into the flow speed u seen by the flame.
"""
from __future__ import annotations

from dataclasses import dataclass
import numpy as np
from scipy.optimize import brentq

from .thermo import (Atmosphere, flame_temperature, k_gas, cp_mass, rho_gas, R, SIGMA, PSIA)
from .materials import Material

P_REF = 8.2 * PSIA     # pressure at which the ICES data were taken
T_REF = 1250.0         # reference temperature for gas properties, as in ICES (p9)
X_MIN, X_MAX = 0.03, 0.98

_TF_CACHE: dict = {}


def _tf_table(mat: Material):
    key = (mat.name, mat.Tp)
    if key not in _TF_CACHE:
        xs = np.linspace(0.02, 0.98, 481)
        _TF_CACHE[key] = (xs, np.array([flame_temperature(mat.fuel, Atmosphere(P=P_REF, X_O2=x), mat.Tp) for x in xs]))
    return _TF_CACHE[key]


@dataclass
class Buoyancy:
    """Effective flow speed seen by an upward-spreading flame.

    u_b(g) = u1g * (g / g_earth)^n is the buoyant velocity. n = 1/3 is the
    characteristic buoyant velocity (g alpha dT/T)^(1/3) of Fernandez-Pello and Hirano,
    also the g-to-flow mapping on the FM2 slides (p16); n = 1/2 follows from equating
    buoyant and forced boundary-layer thickness (Thomsen et al. 2021). u1g = 0.35 m/s
    is the 1-g estimate of Takahashi et al. (2020) used in ICES-2025-392.
    Forced and buoyant flow combine as u = (uF^m + ub^m)^(1/m); m = 3/2 corresponds to
    Churchill's (1977) rule for assisting mixed convection (Nu^3 = NuF^3 + NuN^3).
    """
    u1g: float = 0.35
    n: float = 1.0 / 3.0
    m: float = 1.5

    def u_b(self, g: float) -> float:
        return self.u1g * max(g, 0.0) ** self.n

    def u_eff(self, u_forced: float, g: float) -> float:
        ub = self.u_b(g)
        return float((max(u_forced, 0.0) ** self.m + ub ** self.m) ** (1.0 / self.m))


@dataclass
class LimitModel:
    """Calibrated two-branch model for one material."""
    mat: Material
    lnK: float = 0.0          # CKL constant (fitted per material)
    Ch: float = 5.0           # HTL constant (shared), m^-1/2
    nP: float = 2.0           # pressure exponent of Da, a + b in ICES Eq. 5
    E: float | None = None    # activation energy; defaults to the material's (ICES Table 1)

    @property
    def Ea(self) -> float:
        return self.mat.E if self.E is None else self.E

    # --- flame temperature (tabulated for dry O2/N2 at 298 K, exact otherwise) ---
    def Tf(self, atm: Atmosphere) -> float:
        if atm.X_CO2 == 0 and atm.X_H2O == 0 and atm.X_Ar == 0 and abs(atm.T - 298.15) < 1e-6:
            return float(np.interp(atm.X_O2, *_tf_table(self.mat)))
        return flame_temperature(self.mat.fuel, atm, self.mat.Tp)

    def lnK_for_point(self, P: float, u: float, x: float) -> float:
        """The lnK that puts the blow-off limit exactly at (u, x)."""
        a = Atmosphere(P=P, X_O2=x)
        return -(self.nP * np.log(P / P_REF) + np.log(x) - self.Ea / (R * self.Tf(a)) - np.log(u))

    # --- chemical kinetic limit -------------------------------------------
    def ln_da(self, atm: Atmosphere, u: float) -> float:
        return (self.lnK + self.nP * np.log(atm.P / P_REF) + np.log(atm.X_O2)
                - self.Ea / (R * self.Tf(atm)) - np.log(u))

    # --- heat transfer limit -----------------------------------------------
    def htl_residual(self, atm: Atmosphere, u: float) -> float:
        """Convective supply minus surface re-radiation, W/m2 (> 0 means a flame can live)."""
        h = self.Ch * np.sqrt(k_gas(T_REF) * rho_gas(atm, T_REF) * cp_mass(atm, T_REF) * u)
        return h * (self.Tf(atm) - self.mat.Tp) - self.mat.eps * SIGMA * (self.mat.Tp ** 4 - atm.T ** 4)

    # --- limits as oxygen mole fractions -------------------------------------
    def _solve(self, fun, P: float, u: float, extra: dict) -> float:
        g = lambda x: fun(Atmosphere(P=P, X_O2=x, **extra), u)
        lo, hi = g(X_MIN), g(X_MAX)
        if lo > 0:
            return X_MIN
        if hi < 0:
            return np.nan          # not flammable at any oxygen below X_MAX
        return brentq(g, X_MIN, X_MAX, xtol=1e-6)

    def loc_ckl(self, P: float, u: float, **extra) -> float:
        return self._solve(self.ln_da, P, u, extra)

    def loc_htl(self, P: float, u: float, **extra) -> float:
        return self._solve(self.htl_residual, P, u, extra)

    def loc(self, P: float, u: float, **extra) -> float:
        a, b = self.loc_ckl(P, u, **extra), self.loc_htl(P, u, **extra)
        if np.isnan(a) or np.isnan(b):
            return np.nan
        return max(a, b)

    def branch(self, P: float, u: float) -> str:
        return "quenching (HTL)" if self.loc_htl(P, u) > self.loc_ckl(P, u) else "blow-off (CKL)"

    def loc_at_gravity(self, g: float, P: float, buoy: Buoyancy, u_forced: float = 0.0) -> float:
        return self.loc(P, buoy.u_eff(u_forced, g))

    def u_curve(self, P: float, u: np.ndarray) -> np.ndarray:
        return np.array([self.loc(P, ui) for ui in u])

    def minimum(self, P: float, lo: float = 0.005, hi: float = 5.0) -> tuple[float, float]:
        """Flow speed (m/s) and O2 fraction at the bottom of the U-curve."""
        us = np.geomspace(lo, hi, 240)
        xs = self.u_curve(P, us)
        i = int(np.nanargmin(xs))
        return float(us[i]), float(xs[i])
