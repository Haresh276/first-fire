"""FLINT: flammability limits in nonterrestrial gravity.

A reduced-order engine for the oxygen limits of thin solids at any gravity, pressure and
atmosphere, calibrated on NASA data, with a sealed-chamber simulator for FM2-style burns.
Team Code Blooded, NASA Space Apps Challenge 2026. MIT licence.
"""
__version__ = "1.1.0"

from .thermo import Atmosphere, Fuel, flame_temperature, equivalent_O2_in_N2, GRAVITY, PSIA
from .materials import LIBRARY, Material
from .limits import LimitModel, Buoyancy
from .calibrate import validate, fit_ckl, fit_Ch
from .chamber import Chamber, Sample, BurnTable, simulate, posterior, Observation, expected_information, cabin_fire
