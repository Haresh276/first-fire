"""Pack offline FDS traces and compare with a declared, well-mixed methane mole balance.

Run with --fds /path/to/fds to regenerate all reference CSVs. Without that argument, independently
recompute the comparison and integrity manifest from the archived decks, solver files and metadata.
"""
import argparse
import csv
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT=Path(__file__).resolve().parents[1]
CASES=ROOT/'data/master-physics/fds'
TOLERANCE_PP=.25
SPECS=[('ff_low',12.5,16),('ff_high',25.,16),('ff_high_refined',25.,24)]
RELEASE='https://github.com/firemodels/fds/releases/tag/FDS-6.11.1'
SOURCE_URL='https://codeload.github.com/firemodels/fds/tar.gz/refs/tags/FDS-6.11.1'
SOURCE_SHA='f0a3493ea5f77b18ee5aae065ffb5c3677ae5cc0e1479b5aac22872b472dc417'


def archive_output(chid,folder):
    output=(folder/(chid+'.out')).read_text()
    if 'STOP: FDS completed successfully (CHID: '+chid+')' not in output:
        raise RuntimeError('Incomplete FDS case '+chid)
    lines=[l.strip() for l in output.splitlines() if any(s in l for s in ('Revision         :','Revision Date    :','Background Pressure (Pa)','Ambient Temperature (C)','STOP: FDS completed successfully'))]
    (CASES/(chid+'_run.txt')).write_text('\n'.join(lines)+'\n')
    for suffix in ['_devc.csv','_hrr.csv']:
        shutil.copyfile(folder/(chid+suffix),CASES/(chid+suffix))


def ramp_integral(t):
    if t<=2:return t*t/4
    if t<=20:return t-1
    if t<=22:return 19+(t-20)-(t-20)**2/4
    return 20


def rows(file):
    with file.open() as f:
        next(f)
        return [{k:float(v) for k,v in row.items()} for row in csv.DictReader(f)]


def compare(chid,peak,resolution):
    deck=CASES/(chid+'.fds');frames=rows(CASES/(chid+'_devc.csv'))
    hrr=rows(CASES/(chid+'_hrr.csv'))
    assert len(frames)==len(hrr) and len(frames)>=40 and frames[0]['Time']==0 and frames[-1]['Time']==45
    n0=101325*8/(8.31446261815324*300)
    x0=frames[0]['room_O2']
    trace=[]
    for obs,heat in zip(frames,hrr):
        time=obs['Time']
        if abs(heat['Time']-time)>1e-5:raise ValueError('Unsynchronized device and heat release outputs')
        # Inputs alone determine consumed methane: kJ divided by kJ/kg then by kg/mol.
        extent=peak*ramp_integral(time)/(50000*.016043)
        balance=100*(x0*n0-2*extent)/(n0+extent)
        measured=100*obs['room_O2']
        trace.append(dict(time_s=time,fds_oxygen_pct=measured,balance_oxygen_pct=balance,error_pp=balance-measured,
                          fds_HRR_kW=heat['HRR']))
    peak_error=max(abs(p['error_pp']) for p in trace)
    sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
    return dict(case=chid,peak_kw=peak,resolution=resolution,mesh_cell_m=2/resolution,deck=deck.read_text(),max_abs_pp=peak_error,
                rmse_pp=math.sqrt(sum(p['error_pp']**2 for p in trace)/len(trace)),hold_constant_max_pp=max(abs(p['fds_oxygen_pct']-100*x0) for p in trace),
                initial_oxygen_pct=100*x0,pass_=peak_error<=TOLERANCE_PP,trace=trace,
                hashes={p.name:sha(p) for p in [deck]+[CASES/(chid+s) for s in ['_devc.csv','_hrr.csv','_run.txt']]})


def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--fds',type=Path);args=ap.parse_args()
    if args.fds:
        binary=args.fds.resolve()
        for chid,_,_ in SPECS:
            with tempfile.TemporaryDirectory() as tmp:
                work=Path(tmp);shutil.copyfile(CASES/(chid+'.fds'),work/(chid+'.fds'))
                proc=subprocess.run([str(binary),chid+'.fds'],cwd=work,env={**os.environ,'OMP_NUM_THREADS':'1'},stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
                if proc.returncode:raise RuntimeError(proc.stdout[-2000:])
                archive_output(chid,work)
    cases=[compare(*s) for s in SPECS]
    for c in cases:
        c['pass']=c.pop('pass_')
        print(c['case'],len(c['trace']),c['max_abs_pp'],c['trace'][-1])
    out=dict(release='FDS 6.11.1',source=RELEASE,source_tarball=SOURCE_URL,source_tarball_sha256=SOURCE_SHA,
             tolerance_pp=TOLERANCE_PP,method='Prescribed methane source; well-mixed room mole balance versus FDS volume-mean oxygen. Errors are percentage points.',cases=cases)
    (ROOT/'site/master-fds-data.js').write_text('/* Output from actual NIST FDS 6.11.1 runs; see scripts/check_master_fds.py */\nglobalThis.FFMasterFDS='+json.dumps(out,separators=(',',':'))+';\n')

if __name__=='__main__':main()
