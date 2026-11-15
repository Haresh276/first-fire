"""Regenerate the offline, two-fuel constant-pressure equilibrium table with Cantera 3.2."""
import argparse
import hashlib
import itertools
import re
import json
from pathlib import Path
import cantera as ct
ROOT = Path(__file__).resolve().parents[1]
OX = [10, 15, 20, 25, 30, 35, 40]
PRESS = [30, 45, 60, 80, 95, 110]
FUELS = {'cellulose': (6, 5, 6, 162.141, 15.2), 'polyethylene': (1, 1, 1.5, 14.027, 43.4)}
OFF_GRID = [(12.2, 35.1), (17.7, 49.7), (22.4, 74.4), (27.8, 88.1), (37.9, 102.3)]
INERT_SOURCES = {
    'gri30.yaml': '06650b1e0ee0012f6903d5328b1bb218cb6007d07f8ebe375d18f24811039345',
    'nasa_gas.yaml': '4de6199d65d2d3db782e30573720c723130953707336add59713b02d8667e4db',
}
gas = ct.Solution('gri30.yaml')


def calculate(fuel, x, p, phase=gas, diluent='N2', precision=5):
    carbon, water, oxygen, molar_mass, net_mj_kg = FUELS[fuel]
    ballast = oxygen*(100/x-1)
    mixture = {'CO2': carbon, 'H2O': water, diluent: ballast}
    phase.TPX = 300, p*1000, mixture
    # Per kmol of original fuel unit; products include all the ballast gas.
    kg_products = sum(count*phase.molecular_weights[phase.species_index(species)] for species, count in mixture.items())
    target_h = phase.enthalpy_mass + molar_mass*net_mj_kg*1e6/kg_products
    phase.HP = target_h, p*1000
    phase.equilibrate('HP', solver='gibbs', rtol=1e-10)
    if abs(phase.enthalpy_mass-target_h)>max(abs(target_h),1)*1e-6:
        raise ArithmeticError('Equilibrium enthalpy check failed')
    return round(phase.T, precision)


def interpolate(grid, x, p):
    i = next(i for i in range(len(OX)-1) if OX[i]<=x<=OX[i+1])
    j = next(j for j in range(len(PRESS)-1) if PRESS[j]<=p<=PRESS[j+1])
    a, b = (x-OX[i])/(OX[i+1]-OX[i]), (p-PRESS[j])/(PRESS[j+1]-PRESS[j])
    return sum(grid[i+di][j+dj]*(a if di else 1-a)*(b if dj else 1-b) for di,dj in itertools.product([0,1], repeat=2))


def main():
    grids={fuel:[[calculate(fuel,x,p) for p in PRESS] for x in OX] for fuel in FUELS}
    checks=[]
    for fuel in FUELS:
        for x,p in OFF_GRID:
            reference=calculate(fuel,x,p)
            prediction=interpolate(grids[fuel],x,p)
            checks.append(dict(fuel=fuel,oxygen_pct=x,pressure_kpa=p,reference_k=reference,
                               interpolated_k=round(prediction,5),relative_percent=abs(prediction-reference)*100/reference))
    source=next(Path(d)/'gri30.yaml' for d in ct.get_data_directories() if (Path(d)/'gri30.yaml').is_file())
    gas.TPX=600, 101325, {'O2':.21,'N2':.79}
    out=dict(cantera=ct.__version__,mechanism='gri30.yaml',mechanism_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
             oxygen=OX,pressure=PRESS,kelvin=grids,spot_checks=checks,air_conductivity_600K_W_mK=gas.thermal_conductivity)
    target=ROOT/'site/master-physics-data.js'
    target.write_text('/* Generated offline by scripts/build_master_equilibrium.py */\nglobalThis.FFMasterEquilibrium='+json.dumps(out,separators=(',',':'))+';\n')
    print(len(FUELS)*len(OX)*len(PRESS),'nodes;',len(checks),'off-grid checks; max percent error',max(c['relative_percent'] for c in checks))

def embedded_json(path, variable):
    """Read a literal JSON declaration, without executing application code."""
    text = path.read_text()
    match = re.search(r'\bconst\s+' + re.escape(variable) + r'\s*=\s*', text)
    if match is None:
        raise ValueError(f'{variable} declaration missing in {path}')
    return json.JSONDecoder().raw_decode(text, match.end())[0]


def verify_inert(report_path=None):
    if ct.__version__ != '3.2.0':
        raise RuntimeError(f'Use cantera==3.2.0 for this reproduction (found {ct.__version__}).')
    for filename, expected in INERT_SOURCES.items():
        source = next(Path(d)/filename for d in ct.get_data_directories() if (Path(d)/filename).is_file())
        if hashlib.sha256(source.read_bytes()).hexdigest() != expected:
            raise ValueError(f'Thermochemical input checksum differs: {filename}')

    helium = next(s for s in ct.Species.list_from_file('nasa_gas.yaml') if s.name == 'He')
    phase = ct.Solution(thermo='ideal-gas', species=[*gas.species(), helium])
    grids, checks, reference_rows = {}, [], []
    for label, species in [('He', 'He'), ('Ar', 'AR')]:
        grids[label] = {}
        for fuel in FUELS:
            grid = [[calculate(fuel, x, p, phase, species, 3) for p in PRESS] for x in OX]
            grids[label][fuel] = grid
            for x, p in OFF_GRID:
                exact = calculate(fuel, x, p, phase, species, 3)
                interpolated = interpolate(grid, x, p)
                reference_rows.append([label, fuel, x, p, exact])
                checks.append({
                    'diluent': label, 'fuel': fuel, 'oxygen_pct': x, 'pressure_kpa': p,
                    'direct_kelvin': exact, 'interpolated_kelvin': round(interpolated, 5),
                    'relative_percent': abs(exact-interpolated)*100/exact,
                })
    worst = max(checks, key=lambda c: c['relative_percent'])
    report = {
        'cantera': ct.__version__, 'source_sha256': INERT_SOURCES, 'oxygen_pct': OX,
        'pressure_kpa': PRESS, 'kelvin': grids, 'checks': checks, 'worst': worst,
        'acceptance_percent': 2,
    }
    if report_path:
        report_path.write_text(json.dumps(report, indent=2)+'\n')
    shipped = embedded_json(ROOT/'site/master-materials.js', 'inertEquilibrium')
    if grids != shipped:
        raise ValueError('Recomputed He/Ar nodes differ from the shipped 0.001 K tables.')
    frozen = embedded_json(ROOT/'tests/master-materials.test.cjs', 'references')
    if reference_rows != frozen:
        raise ValueError('Direct off-grid equilibria differ from the published test fixtures.')
    if worst['relative_percent'] >= report['acceptance_percent']:
        raise ValueError(f"Off-grid acceptance exceeded: {worst['relative_percent']:.5f}%")
    print(f"168 He/Ar nodes matched; {len(checks)} independent off-grid checks matched; "
          f"maximum interpolation error {worst['relative_percent']:.5f}% (<2%).")


if __name__=='__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check-inert', action='store_true',
                        help='Verify the published helium/argon grids and 20 off-grid test references.')
    parser.add_argument('--inert-report', type=Path, metavar='JSON',
                        help='Also export the recomputed helium/argon nodes and all check values.')
    args = parser.parse_args()
    if args.check_inert or args.inert_report:
        verify_inert(args.inert_report)
    else:
        main()
