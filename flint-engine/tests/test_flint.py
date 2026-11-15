"""Run with:  python -m pytest -q"""
import numpy as np
import pytest

from flint.thermo import Atmosphere, flame_temperature, equivalent_O2_in_N2, h_sens, PSIA
from flint.materials import LIBRARY, PMMA_FUEL, ARAMID_FUEL
from flint.limits import LimitModel, Buoyancy, P_REF
from flint.calibrate import validate, fit_ckl
from flint.chamber import (Chamber, Sample, BurnTable, composition, readings, areal_density_for_drop,
                           posterior, Observation, outcomes_for, simulate)


def test_janaf_nodes():
    assert h_sens("N2", 1000.0) == pytest.approx(21463.0, rel=1e-9)
    assert h_sens("CO2", 298.15) == pytest.approx(0.0, abs=1e-9)


def test_huggett_heats_of_combustion():
    # Literature lower heating values: PMMA ~24.9, cellulose ~16 MJ/kg
    assert PMMA_FUEL.heat_of_combustion / 1e6 == pytest.approx(24.9, rel=0.03)
    assert LIBRARY["CELLULOSE"].fuel.heat_of_combustion / 1e6 == pytest.approx(16.0, rel=0.05)


def test_flame_temperature_rises_with_oxygen():
    T = [flame_temperature(PMMA_FUEL, Atmosphere.psia(8.2, x), 618) for x in (0.12, 0.16, 0.21, 0.30)]
    assert all(np.diff(T) > 0)
    assert 1600 < T[0] < 1800 and 2300 < T[2] < 2500


def test_equivalent_oxygen_is_identity_without_products():
    a = Atmosphere.psia(8.2, 0.26)
    assert equivalent_O2_in_N2(ARAMID_FUEL, a, 650) == pytest.approx(0.26, abs=1e-4)


def test_vitiation_lowers_equivalent_oxygen():
    a = Atmosphere.psia(8.2, 0.26, X_CO2=0.06, X_H2O=0.02)
    assert equivalent_O2_in_N2(ARAMID_FUEL, a, 650) < 0.255


def test_branches_behave():
    m = LimitModel(LIBRARY["PC"], lnK=11.0, Ch=4.2)
    us = np.geomspace(0.05, 2.0, 12)
    ckl = [m.loc_ckl(P_REF, u) for u in us]
    htl = [m.loc_htl(P_REF, u) for u in us]
    assert all(np.diff(ckl) > 0)          # more flow -> harder to stay lit (blow-off)
    assert all(np.diff(htl) < 0)          # less flow -> harder to stay lit (quenching)
    assert m.loc(P_REF, 0.2) == pytest.approx(max(m.loc_ckl(P_REF, 0.2), m.loc_htl(P_REF, 0.2)))


def test_lower_pressure_raises_blowoff_limit():
    m = LimitModel(LIBRARY["PMMA"], lnK=8.9, Ch=4.2)
    assert m.loc_ckl(8.2 * PSIA, 1.0) < m.loc_ckl(5.0 * PSIA, 1.0)


def test_calibration_fits_1g_data():
    for k in ("PMMA", "P213", "PC", "NOMEX"):
        _, rms = fit_ckl(k, Buoyancy())
        assert rms < 0.008


def test_leave_one_out_regression():
    v = validate(Buoyancy())
    assert v.loo_mae == pytest.approx(0.0142, abs=0.002)


def test_oxygen_atoms_conserved():
    ch = Chamber()
    s = Sample(ARAMID_FUEL, 0.094)
    m0, m1 = composition(ch, s, 0.33, 0.0), composition(ch, s, 0.33, 0.12)
    nf = s.areal_density * s.width * 0.12 / (ARAMID_FUEL.MW / 1000)
    O = lambda m: 2 * m["O2"] + 2 * m["CO2"] + m["H2O"]
    assert O(m1) == pytest.approx(O(m0) + ARAMID_FUEL.O * nf, rel=1e-12)


def test_fm2_drop_and_v1_reference_lengths():
    ch = Chamber()
    s = Sample(ARAMID_FUEL, areal_density_for_drop(ch, ARAMID_FUEL))
    assert 0.33 - readings(ch, s, 0.33, s.height)["O2_wet"] == pytest.approx(0.08, abs=1e-6)
    # oxygen-only bookkeeping reproduces the locked forecast's reference lengths (17.5 and 7.5 cm)
    assert 100 * BurnTable(ch, s, 0.33, vitiation=False).length(0.26)[0] == pytest.approx(17.5, abs=0.3)
    assert 100 * BurnTable(ch, s, 0.29, vitiation=False).length(0.26)[0] == pytest.approx(7.5, abs=0.3)


def test_posterior_without_data_is_prior_and_recovers_truth():
    ch = Chamber()
    s = Sample(ARAMID_FUEL, areal_density_for_drop(ch, ARAMID_FUEL))
    p0 = posterior(ch, s, [], 0.26, 0.015)
    assert p0["mean"] == pytest.approx(0.26, abs=1e-4) and p0["sd"] == pytest.approx(0.015, abs=2e-4)
    p = posterior(ch, s, outcomes_for(ch, s, 0.245), 0.26, 0.015)
    assert abs(p["q50"] - 0.245) < 0.003 and not p["inconsistent"]


def test_impossible_outcomes_are_flagged():
    ch = Chamber()
    s = Sample(ARAMID_FUEL, areal_density_for_drop(ch, ARAMID_FUEL))
    p = posterior(ch, s, [Observation(0.33, 12.0), Observation(0.29, outcome="none")], 0.26, 0.015)
    assert p["inconsistent"]


def test_chamber_cools_back_down():
    ch = Chamber()
    s = Sample(ARAMID_FUEL, areal_density_for_drop(ch, ARAMID_FUEL))
    r = simulate(ch, s, 0.29, 0.26)
    assert r["T"][-1] - ch.T0 < 1.0 and r["summary"]["burned_cm"] == pytest.approx(6.4, abs=0.2)


# --- pressurized rover fire case (acceptance values quoted in the rover document) ---
def test_rover_acceptance_values():
    from flint.rover import Rover, default_inventory, calibrated_models, assess, flood_dose, vent_pressure, atmosphere_trade
    models = calibrated_models()
    rv = Rover(items=default_inventory())
    a = {x["material"]: x for x in assess(models, rv)}
    assert a["NOMEX"]["loc_fans_off"] == pytest.approx(0.264, abs=0.001)
    assert a["PMMA"]["loc_fans_on"] == pytest.approx(0.134, abs=0.001)
    assert a["PMMA"]["loc_fans_off"] == pytest.approx(0.129, abs=0.001)
    nomex = [i for i in rv.items if i.material == "NOMEX"][0]
    assert flood_dose(models, rv, nomex, "CO2")["kg"] == pytest.approx(3.8, abs=0.1)
    assert flood_dose(models, rv, nomex, "N2")["kg"] == pytest.approx(5.1, abs=0.1)
    assert vent_pressure(models, rv, nomex)["P_psia"] == pytest.approx(4.0, abs=0.1)
    earth = [t for t in atmosphere_trade(models, rv) if t["P_psia"] == 14.7][0]
    assert earth["items_that_burn"] == 3


# --- freefall modules -----------------------------------------------------------------
def test_flex_rows_and_theory_trends():
    from flint import droplet as D
    rows = D.load()
    assert len(rows) == 273                                   # one FLEX row has no pressure
    th = lambda o2, **kw: D.theory(D.FUELS["Methanol"], D.atmosphere(o2, 14.7, **kw))["K_mm2_s"]
    assert th(30) > th(21) > th(15)                           # more oxygen, faster burning
    assert th(21, He_pct=30) > th(21)                         # helium conducts heat better


def test_flex_validation_regressions():
    from flint import droplet as D
    rows = D.load()
    br = D.burning_rate_validation(rows)
    assert br["Methanol"]["cv_mape_physics"] < br["Methanol"]["cv_mape_mean"]
    ex = D.extinction_validation(rows)
    for f in ("Methanol", "Heptane"):
        assert ex[f]["cv_mae_mm_model"] < ex[f]["cv_mae_mm_fixed_ratio"] < ex[f]["cv_mae_mm_constant"]
    m = D.fit_extinction(rows, "Heptane")
    assert D.limiting_O2(m, 3.0, 14.7) == pytest.approx(14.1, abs=0.2)


def test_cfig_loads_and_reports_no_skill_for_normal_flames():
    from flint import ignition as IG
    rows = IG.load()
    assert len(rows) == 333
    v = IG.validate(rows)
    assert v["normal"]["loo_brier"] >= v["normal"]["base_brier"] - 0.005   # honest negative result


def test_atlas_counts_and_labels():
    from flint import atlas as A
    S, Dr = A.solids(), A.droplets()
    assert len(S) == 320 and len(Dr) == 30
    assert all(r["validity"] == "not modelled" for r in S if r["gravity"] == "orbit" and r["ventilation"] == "fans off")
