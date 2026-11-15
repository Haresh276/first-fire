"""Train recurrent weights on entire simulator runs. Requires CPU PyTorch and a Node runtime."""
import json
import os
from pathlib import Path
import subprocess
import numpy as np
import torch
from torch import nn

ROOT=Path(__file__).resolve().parents[1]
SEED=4071
torch.manual_seed(SEED)
torch.set_num_threads(2)
torch.use_deterministic_algorithms(True)
runs=json.loads(subprocess.check_output([os.environ.get('NODE','node'), str(ROOT/'scripts/master_surrogate_data.cjs')]))
times=torch.arange(1,61,dtype=torch.float32).view(1,60,1)/60


def batch(rows):
    x=torch.tensor([r['inputs'] for r in rows])[:,None,:].expand(-1,60,-1)
    seq=torch.cat([x,times.expand(len(rows),-1,-1)],2)
    return seq, torch.tensor([r['drop'] for r in rows]),torch.tensor([r['initial']-r['cutoff'] for r in rows])[:,None]


class Candidate(nn.Module):
    def __init__(self,liquid):
        super().__init__()
        self.liquid=liquid
        if liquid:
            self.gates=nn.Linear(6+24,48)
        else:
            self.vanilla=nn.RNN(6,24,batch_first=True)
        self.out=nn.Linear(24,1)
    def forward(self,x):
        if self.liquid:
            h=x.new_zeros(x.size(0),24)
            seq=[]
            for inp in x.unbind(1):
                proposal,rate=self.gates(torch.cat((inp,h),1)).chunk(2,1)
                f=torch.exp(-torch.nn.functional.softplus(rate)*2)
                h=f*h+(1-f)*torch.tanh(proposal)
                seq.append(h)
            hidden=torch.stack(seq,1)
        else:
            hidden,_=self.vanilla(x)
        return self.out(hidden).squeeze(-1)


def stats(error):
    arr=np.abs(error)
    return dict(mae_pp=float(arr.mean()),p95_pp=float(np.quantile(arr,.95)),worst_pp=float(arr.max()))


def train(liquid):
    torch.manual_seed(SEED)
    model=Candidate(liquid)
    train_x,train_y,_=batch(runs['train'])
    val_x,val_y,val_cap=batch(runs['validation'])
    test_x,test_y,test_cap=batch(runs['test'])
    opt=torch.optim.Adam(model.parameters(),lr=.005)
    best=float('inf')
    for epoch in range(45):
        model.train()
        rng=torch.Generator().manual_seed(SEED+epoch)
        for ix in torch.randperm(len(train_x),generator=rng).split(64):
            err=model(train_x[ix])-train_y[ix]
            opt.zero_grad();(err.square().mean()).backward();torch.nn.utils.clip_grad_norm_(model.parameters(),5);opt.step()
        with torch.no_grad():
            vm=torch.minimum(model(val_x).clamp_min(0),val_cap*torch.ones_like(val_y))
            metric=(vm-val_y).abs().mean().item()
        if metric<best:
            best=metric;best_epoch=epoch+1
            weights={k:v.detach().clone() for k,v in model.state_dict().items()}
    model.load_state_dict(weights)
    with torch.no_grad():
        pred=torch.minimum(model(test_x).clamp_min(0),test_cap*torch.ones_like(test_y))
    return {**stats((pred-test_y).numpy()),'training_parameters':sum(p.numel() for p in model.parameters()),'selected_epoch':best_epoch,'validation_mae_pp':best}


def table_prediction(r):
    # Bin stoichiometric oxygen consumption relative to initial total gas. On each side of the cutoff,
    # the exact oxygen curve is smooth. Store the table before a cutoff and clamp the interpolated value afterwards.
    # One input axis is the initial oxygen fraction, one the consumed fraction, one the two known fuel chemistries.
    x=np.clip(r['initial']/100,.21,.37)
    xgrid=np.linspace(.21,.37,17)
    amounts=np.linspace(0,.30,37)
    frac=np.minimum(r['maxFraction'],r['rateFraction']*np.arange(2,121,2))
    # For accepted cases cutoff >=15%; values above .30 consumed fraction necessarily stop.
    d=5/6 if r['fuel']=='cellulose' else .5/1.5
    grid=100*(xgrid[:,None]-amounts[None,:])/(1+d*amounts[None,:])
    values=[np.interp(x,xgrid,[np.interp(u,amounts,row) for row in grid]) for u in frac]
    return r['initial']-np.maximum(r['cutoff'],values)


def main():
    table=np.array([table_prediction(r)-r['drop'] for r in runs['test']])
    arr=np.array([r['inputs'] for r in runs['train']]);curves=np.array([r['drop'] for r in runs['train']])
    nearest=[]
    for r in runs['test']:
        ix=np.argsort(((arr-r['inputs'])**2).sum(1))[:4]
        weight=1/(np.linalg.norm(arr[ix]-r['inputs'],axis=1)+1e-12)**2
        pred=np.clip(np.average(curves[ix],axis=0,weights=weight),0,r['initial']-r['cutoff'])
        nearest.append(pred-r['drop'])
    liquid=train(True);plain=train(False);baseline=stats(table)
    result=dict(seed=SEED,torch=torch.__version__,partitions={k:len(v) for k,v in runs.items()},run_seeds={'train':664118,'validation':286021,'test':920372},steps_per_run=60,interval_s=2,
                liquid=liquid,plain_rnn=plain,structured_lookup=baseline,nearest_curves=stats(nearest),
                table_shape=[2,17,37],decision='retain' if liquid['mae_pp']<baseline['mae_pp'] else 'drop',
                gate='Liquid held-out MAE must be strictly below the stoichiometry-informed lookup MAE.')
    print(json.dumps(result,indent=2))
    (ROOT/'data/master-physics/surrogate.json').write_text(json.dumps(result,indent=2)+'\n')
    (ROOT/'site/master-surrogate-data.js').write_text('/* Generated by scripts/train_master_surrogate.py */\nglobalThis.FFMasterSurrogate='+json.dumps(result,separators=(',',':'))+';\n')

if __name__=='__main__':
    main()
