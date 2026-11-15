"""Build the judge's static report and offline atlas from the official FLINT JSON/CSV."""
import csv
import json
import math
import shutil
from html import escape
from pathlib import Path
from string import Template

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'site'
PUBLIC = SITE / 'flint'
RESULT = ROOT / 'flint-engine/results'
CORE = 'flint/results/core/results.json'
MICRO = 'flint/results/micro/micro_results.json'


def read_json(path):
    return json.loads(path.read_text())


def rows(path):
    with path.open(newline='', encoding='utf-8') as stream:
        return list(csv.DictReader(stream))


def text(s):
    return escape(str(s), quote=True)


def number(n, digits=1):
    return f'{n:.{digits}f}'


def percent(n, digits=1):
    return number(100 * n, digits) + '%'


def table(caption, headings, data, source, field):
    head = ''.join(f'<th scope="col">{text(h)}</th>' for h in headings)
    body = ''.join('<tr>' + ''.join(f'<td>{text(v)}</td>' for v in row) + '</tr>' for row in data)
    return (f'<div class="scroll" tabindex="0" role="region" aria-label="{text(caption)}"><table>'
            f'<caption>{text(caption)}</caption><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>'
            f'<p class="source">Source · <a href="{text(source)}">{text(Path(source).name)} → {text(field)}</a></p>')


def figure(folder, stem, description, lazy=True):
    filename = f'flint/results/{folder}/{stem}.png'
    return (f'<figure><a href="{filename}" aria-label="Enlarge figure: {text(description)}"><img '
            f'src="{filename}" alt="{text(description)}" {"loading=lazy" if lazy else ""}></a>'
            f'<figcaption>{text(description)} <a href="{filename}">Enlarge</a></figcaption></figure>')


def options(values, selected=None, include_all=True):
    prefix = '<option value="">All</option>' if include_all else ''
    return prefix + ''.join(f'<option value="{text(key)}"{" selected" if key == selected else ""}>'
                            f'{text(value)}</option>' for key, value in values)


ATLAS_FIELDS = {
    'P_psia': ('Pressure', 'psia'), 'O2': ('Cabin oxygen mole fraction', ''),
    'flow_cm_s': ('Effective flow', 'cm/s'), 'limit': ('Solid oxygen limit (mole fraction)', ''),
    'margin_pts': ('Oxygen above the limit', 'percentage points'), 'branch': ('Limiting branch', ''),
    'co2_kg_per_m3': ('Carbon dioxide to suppress · Model extrapolation (pressure changes)', 'kg/m³'),
    'n2_kg_per_m3': ('Nitrogen to suppress · Model extrapolation (pressure changes)', 'kg/m³'),
    'vent_psia': ('Vent pressure · Model extrapolation (pressure changes)', 'psia'), 'burns': ('Burns under the model', ''),
    'd0_mm': ('Starting diameter', 'mm'), 'K_mm2_s': ('Burning rate', 'mm²/s'),
    'd_ext_mm': ('Extinction diameter', 'mm'), 'burn_time_s': ('Burn time', 's'),
    'limiting_O2_pct': ('Droplet oxygen limit', '%'), 'note': ('Validity note', ''),
}


def atlas_markup():
    data = []
    for family in ('solids', 'droplets'):
        source = f'atlas_{family}.csv'
        for line, row in enumerate(rows(RESULT/'micro'/source), 2):
            data.append((source, line, row))
    filters = [('family','Fuel family'), ('gravity','Gravity'), ('atmosphere','Atmosphere'),
               ('fuel','Fuel'), ('ventilation','Ventilation'), ('validity','Validity')]
    control = ''
    for key, label in filters:
        values = sorted({row[key] for _, _, row in data if row.get(key)})
        control += f'<label>{label}<select data-filter="{key}">{options((v, v) for v in values)}</select></label>'
    cards = []
    for source, line, row in data:
        attrs = ' '.join(f'data-{key}="{text(row.get(key,""))}"' for key,_ in filters)
        context = f"{row['gravity'].title()} · {row['atmosphere']}"
        condition = row.get('ventilation') or f"Starting diameter {row['d0_mm']} mm"
        details = ''.join(f'<div><dt>{text(label)}</dt><dd>{text(row[k])} {text(unit)}</dd></div>'
                          for k,(label,unit) in ATLAS_FIELDS.items() if row.get(k))
        validity = row['validity']
        answer = ('Limit ' + percent(float(row['limit']), 2) + ' O₂' if row.get('limit') else
                  'Limit ' + number(float(row['limiting_O2_pct']), 2) + '% O₂' if row.get('limiting_O2_pct') else
                  'No oxygen limit')
        cards.append(f'<details class="scenario" {attrs}><summary>'
                     f'<span class="scenario-name">{text(row["fuel"])} <small>{text(context)} · {text(condition)}</small></span>'
                     f'<span class="scenario-value">{text(answer)}</span>'
                     f'<span class="validity {text(validity.replace(" ","-"))}">{text(validity)}</span>'
                     f'</summary><dl>{details}</dl><p class="source">Source · <a href="flint/results/micro/{source}">'
                     f'{source}, row {line}</a> (header is row 1)</p></details>')
    return dict(atlas_controls=control, atlas_rows='\n'.join(cards), atlas_total=len(data))


def build():
    core = read_json(RESULT/'core/results.json')
    micro = read_json(RESULT/'micro/micro_results.json')
    rover = read_json(RESULT/'rover/rover_case.json')
    extra = read_json(PUBLIC/'closure-sensitivity.json')
    labels = extra['material_labels']
    fm = core['fm2']
    pressure = extra['pressure_psia']
    values = dict(pressure=pressure, source_core=CORE, source_micro=MICRO)
    values.update(atlas_markup())
    values.update(
        lunar_figure=figure('core/fig','flint_ucurves',
                       'Each material has a flow speed at which it burns at the lowest oxygen level.', False),
        validation=table('Lunar oxygen limits with one material held out',
                         ['Material','Measured O₂','FLINT O₂','Limiting branch','Error (points)'],
                         [(labels[k],percent(r['observed']),percent(r['flint_loo']),r['branch'],
                           f"{r['loo_error']*100:+.1f}") for k,r in core['lunar'].items()], CORE,'lunar'),
        methods=table('Predictions against digitized lunar observations',
                      ['Method','Mean absolute error (O₂ points)','Worst error (O₂ points)'],
                      [(k,number(r['mae_pts']),number(r['max_pts'])) for k,r in core['methods'].items()], CORE,'methods'),
        errors=number(core['methods']['FLINT leave-one-out']['mae_pts']),
        alternative=number(core['lunar_alt_dataset_loo_mae_pts']),
        alt_straight=number(extra['alternate_straight_line_mae_pts']),
        f4=''.join(f'<li>{text(note)}</li>' for note in core['data_notes']),
        validation_figure=figure('core/fig','flint_validation','Held-out predictions against the lunar measurements.'),
        gravity_figure=figure('core/fig','flint_gravity','Predicted limiting oxygen as gravity changes.'),
        gravity_error=number(100 * math.sqrt(sum(r['loo_error']**2 for r in core['lunar'].values())/len(core['lunar']))),
        orbit_fan=next(k for k in core['gravity']['PMMA'] if k.startswith('orbit_')).split('_')[1].replace('cms',' cm/s'),
    )
    gravity_rows = []
    for k,r in core['gravity'].items():
        cells = [labels[k]]
        for world in ('moon', 'mars'):
            span = extra['ranges'][k][world]
            cells.append(f"{percent(r[world])} ({percent(min(span))}–{percent(max(span))})")
        cells += [percent(r['earth_quiescent']), percent(r['orbit_10cms']), number(r['g_star'],2)+' g']
        gravity_rows.append(cells)
    values['gravity'] = table('Predicted oxygen limits by gravity',
                ['Material','Moon · fit','Mars · prediction','Earth · prediction','Orbit · extrapolated','Lowest limit near'],
                gravity_rows,CORE,'gravity; ranges in closure-sensitivity.json')
    values['standins'] = table('Three candidate fabrics for the same planned strip',
        ['Fabric stand-in','Implied areal density (g/m²)','Strip mass (g)'],
        [(k,number(r['areal_density_g_m2'],0),number(r['strip_mass_g'],2))
        for k,r in fm.items() if isinstance(r,dict) and 'strip_mass_g' in r], CORE,'fm2')
    runs = fm['aramid-like']['rows']
    limits = sorted(k for k in runs[0] if k.startswith('len_vit_L'))
    oxygen_only = next(k for k in runs[0] if k.startswith('len_novit_L'))
    values['fm_lengths'] = table('Predicted burned length (cm) · aramid-like fabric',
        ['Starting O₂',*[f'Limit {k.rsplit("L",1)[1]}%' for k in limits],
         f'Oxygen only · limit {oxygen_only.rsplit("L",1)[1]}%'],
        [(percent(r['X0'],0),*[number(r[k]) for k in [*limits,oxygen_only]]) for r in runs],
        CORE,'fm2 → aramid-like → rows')
    values['reader'] = table('Fabric limit inferred from synthetic burn outcomes',
        ['Simulated limit and observations','Lower estimate (10th percentile)','Upper estimate (90th percentile)'],
        [(key,percent(r['q10']),percent(r['q90'])) for key,r in fm['bayes'].items()],CORE,'fm2 → bayes')
    sim = list(fm['sim_aramid_L26'].values())
    values['sensor'] = table('Reading the sensors at the end of each simulated burn',
        ['Starting O₂','Burned (cm)','Wet O₂','Dry O₂','Flame-equivalent O₂'],
        [(percent(r['X0'],0),number(r['burned_cm']),percent(r['final_O2_wet']),percent(r['final_O2_dry']),
          percent(r['final_flame_O2'])) for r in sim],CORE,'fm2 → sim_aramid_L26')
    values['chamber_figures'] = ''.join(figure('core/fig',name,desc) for name,desc in [
        ('flint_fm2_lengths','Burn lengths change with the assumed fabric limit and with accumulated combustion products.'),
        ('flint_fm2_bayes','Information about the unknown fabric limit depends on the starting oxygen.'),
        ('flint_fm2_traces','Predicted chamber oxygen, carbon dioxide and pressure through the burns.'),
        ('flint_cabin','Cabin panel-fire scenarios under different assumed atmospheres.')])
    values['rover_figures'] = figure('rover','rover_trade','Cabin atmosphere changes the margin for each item.') + figure(
        'rover','rover_timeline','Modelled heat release and carbon dioxide after ignition; spread rates are assumed.')
    values['flex_n'] = micro['flex_rows']
    transfer = micro['burning_rate_transfer_by_group']
    values['helium_bias'] = number(transfer['Methanol | He']['mean_bias_pct'],0)
    values['heptane_scatter'] = number(transfer['Heptane | O2/N2 at 1 atm (training)']['mape_pct'],0)
    fuels = list(micro['burning_rate'])
    baselines = [('cv_mape_physics','FLINT burning-rate error'),('cv_mape_mean','Constant-rate baseline'),
                 ('cv_mape_linear5','Linear regression baseline')]
    validation_rows = [[label,*[number(micro['burning_rate'][f][k])+'%' for f in fuels]] for k,label in baselines]
    for gas in ('CO2','He'):
        group = [transfer[f'{f} | {gas}'] for f in fuels]
        validation_rows.append([f'Transfer to {gas.replace("CO2","CO₂")} (bias / absolute error)',
                                *[f"{r['mean_bias_pct']:+.0f}% / {r['mape_pct']:.0f}% (n={r['n']})" for r in group]])
    for k,label in [('cv_mae_mm_model','FLINT extinction-diameter error'),('cv_mae_mm_fixed_ratio','Fixed-ratio baseline'),
                    ('cv_mae_mm_constant','Constant-diameter baseline')]:
        validation_rows.append([label,*[f"{micro['extinction'][f][k]:.2f} mm (n={micro['extinction'][f]['n']})" for f in fuels]])
    values['flex_validation'] = table('FLEX cross-validation and atmosphere-transfer tests',['Test',*fuels],
                            validation_rows,MICRO,'burning_rate, extinction, burning_rate_transfer_by_group')
    suppression = micro['limiting_O2']
    mixtures = []
    for key in suppression[fuels[0]]:
        gas, dose = key.split('_')
        if int(dose) == 0 and mixtures:
            continue
        label = 'O₂ in nitrogen' if int(dose) == 0 else f'{dose}% '+('CO₂' if gas=='CO2' else 'helium')+' replacing nitrogen'
        mixtures.append([label,*[number(suppression[f][key])+'%' for f in fuels]])
    case = extra['suppressant_case']
    values['suppressants'] = table(f"Oxygen below which a hot droplet flame dies · {case['diameter_mm']:g} mm, {case['pressure_psia']:g} psia",
                                    ['Atmosphere',*[f+' limiting O₂' for f in fuels]],mixtures,MICRO,'limiting_O2')
    values['flex_figures'] = ''.join(figure('micro/fig',k,s) for k,s in [
        ('flint_flex_rate','FLEX measurements versus predicted burning rates after fitting in oxygen and nitrogen.'),
        ('flint_flex_extinction','Predicted and observed diameters at extinction for methanol and heptane.'),
        ('flint_flex_suppression','Carbon dioxide raises the oxygen limit for both fuels; helium lowers it for heptane.')])
    values['cfig'] = table('Hot ignition on the ISS · lower Brier score is better',
        ['Configuration','Hot ignitions / runs','FLINT Brier','Base-rate Brier','FLINT accuracy','Base accuracy'],
        [(k.title(),f"{r['hot_ignitions']} / {r['n']}",number(r['loo_brier'],3),number(r['base_brier'],3),
          percent(r['loo_accuracy'],0),percent(r['base_accuracy'],0)) for k,r in micro['cfig'].items()],MICRO,'cfig')
    values['atlas_figure'] = figure('micro/fig','flint_atlas','Oxygen above or below each material’s limit across the atlas atmospheres.')
    values.update(micro['atlas_summary'])
    values['material_options'] = options(labels.items(),'PC',False)
    solids = rows(RESULT/'micro/atlas_solids.csv')
    gravities = list(dict.fromkeys(r['gravity'] for r in solids))
    values['gravity_options'] = options(((g,g.title()) for g in gravities),'moon',False)
    pressures = sorted({r['P_psia'] for r in rover['trade']})
    values['pressure_options'] = options(((str(p),f'{p:g} psia') for p in pressures),str(pressure),False)
    values['fan_options'] = options(((v, 'Fans off' if v == '0' else v+' cm/s') for v in
            dict.fromkeys('0' if r['ventilation']=='fans off' else r['ventilation'].split()[1] for r in solids)), '0', False)
    psi = {r['accession']:r['url'] for r in read_json(ROOT/'data/investigations.json')}
    for key in ('69','159','25','26','98','99','100'):
        values['psi'+key] = psi['PSI-'+key]
    values['n_provenance'] = len(rows(PUBLIC/'psi-pack-comparison.csv'))
    shutil.copytree(RESULT, PUBLIC/'results', dirs_exist_ok=True)
    output = Template((ROOT/'scripts/flint_page/template.html').read_text()).substitute(values)
    (SITE/'flint.html').write_text(output, encoding='utf-8')


if __name__ == '__main__':
    build()
