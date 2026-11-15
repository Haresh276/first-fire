"""Calibration and validation data, with provenance.

Values were digitized by FLINT's authors from the published figures; they are not
NASA's tabulated numbers. Reading uncertainty is about +/-0.003 mole fraction and
+/-3 % in flow speed. Where a marker in ICES Fig. 13 is hidden behind another, the
value is taken from the single-material figure that matches Fig. 13.
"""

# ICES-2025-392 (Urban et al. 2025), 8.2 psia (56.5 kPa), upward (concurrent) burning.
#  wstf : 1-g limit points from the WSTF high-flow duct, (forced flow cm/s, O2 mole fraction)
#  lunar: lunar-g limit from the GRC 5.2 s drop tower centrifuge (flow not known)
#  lunar_alt: the same quantity read from the single-material figure
ICES = {
    "PMMA": {
        "wstf": [(60.5, 0.154), (80.0, 0.178), (104.0, 0.180), (143.6, 0.179)],
        "lunar": 0.131, "lunar_alt": 0.130,
        "src": "Fig. 13 (red); lunar_alt from Fig. 8",
    },
    "P213": {
        "wstf": [(60.5, 0.150), (80.2, 0.162), (100.3, 0.166), (144.0, 0.178)],
        "lunar": 0.137, "lunar_alt": 0.135,
        "src": "Fig. 13 (green); 144 cm/s point and lunar_alt from Fig. 7",
    },
    "PC": {
        "wstf": [(60.5, 0.196), (80.0, 0.212), (100.9, 0.220), (144.8, 0.232)],
        "lunar": 0.201, "lunar_alt": 0.210,
        "src": "Fig. 13 (orange); lunar_alt from Fig. 11",
    },
    "NOMEX": {
        "wstf": [(60.5, 0.210), (80.0, 0.213), (100.9, 0.212), (145.3, 0.212)],
        "lunar": 0.256, "lunar_alt": 0.240,
        "src": "Fig. 13 (blue); 80 cm/s point and lunar_alt from Fig. 12",
    },
}
ICES_PRESSURE_PSIA = 8.2

# ICES Table 2 (p11): best-fit and one-tailed 95 % slopes of LOC against forced flow, 1/(cm/s)
ICES_TABLE2 = {
    "PMMA": (0.00022, 0.00056, 1.9), "PC": (0.00040, 0.00065, 2.3),
    "NOMEX": (0.000016, 0.000090, 0.32), "P213": (0.00030, 0.00040, 1.4),
    "BEEFY_T_FLAMING": (0.00017, 0.00023, 0.82), "BEEFY_T_SMOLDER": (0.00034, 0.00050, 1.8),
}

# Consistency findings from reading ICES-2025-392 (reported, not corrected):
ICES_FIGURE_NOTES = [
    "Fig. 7 (captioned 0.8 mm PMMA) matches the P213 points of Fig. 13 and the P213 slope of Table 2.",
    "Fig. 8 (captioned P-213) has a slope near 0.00017 per cm/s, the Table 2 value for flaming Beefy-T.",
    "Figs. 9 and 10 (Beefy-T flaming and smoulder) show identical points.",
    "Lunar limits differ between Fig. 13 and the single-material figures: PC 0.201 vs 0.210; Nomex Velcro 0.256 vs 0.240.",
]

# Spread rates in lunar gravity, for checks (mm/s)
SPREAD = {
    "SIBAL_down_air_1atm_lunar": [(0.86, "aircraft, FM2 slides PDF p22"), (1.1, "centrifuge drop, FM2 slides PDF p22"),
                                   (0.92, "LUCI flight, ASGSR 2025 slides")],
    "SIBAL_down_air_1atm_1g": [(1.5, "LUCI 1-g comparison, ASGSR 2025 slides")],
}

# FM2 (Ferkul, Kralik, Liao, Johnston; LPSC 2026 slides)
FM2 = {
    "volume_L": 14.4, "pressure_psia": 8.2, "pressure_tol_psia": 0.3,
    "O2_starts": [0.37, 0.33, 0.29, 0.25], "sample_w_cm": 2.0, "sample_h_cm": 20.0,
    "expected_LOC_range": (0.24, 0.26), "expected_O2_drop_full_sample": 0.08,
    "refresh_between_burns": True, "upward": True,
    "src": "LPSC 2026 slides, PDF pages 5, 6, 10, 14",
}
