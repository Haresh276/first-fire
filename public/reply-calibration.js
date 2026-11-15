/* Release-two probability of full-answer rubric success. Only matched local deployments are eligible. */
(() => {
  'use strict';
  const stop=new Set('a an the this that these those and or but as of in on to with into by from is be are been were was did do does has have had how which what when where why for it its my our their would can may please tell give experiment study test question'.split(' '));
  const names=['verifiedSynthesis','checkedQuantity','withheld','termCoverage','identifierCoverage','missingRequestedCalculation','relationalQuestion','explicitRefutation','attributedSynthesisBlocks'];
  const clean=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[‐–—−]/g,'-');
  const terms=s=>new Set((clean(s).match(/[a-z0-9]+/g)||[]).filter(t=>!stop.has(t)).map(t=>t.length>4?t.replace(/s$/,''):t));
  function family(turn) {
    if(turn.status==='abstained'||['withheld','archive-clarification','input-needed'].includes(turn.evidenceKind))return 'withheld';
    if(turn.evidenceKind==='grounded-synthesis')return 'synthesis';
    if(['tool-calculation','archive-calculation','calculation','archive-row','lunar-outcome'].includes(turn.evidenceKind))return 'structured';
    return 'other';
  }
  function features(question,turn) {
    const q=clean(question),answer=clean(turn.answer),route=family(turn);
    const verified=turn.evidenceKind==='grounded-synthesis'&&turn.verification?.checks?.quote?.state==='pass';
    const blocks=verified?(turn.synthesisReceipt?.blocks||[]):[];
    const arithmetic=blocks.some(b=>b.calculations?.length>0)||['calculation','tool-calculation','archive-calculation'].includes(turn.evidenceKind)&&turn.verification?.checks?.quantity?.state==='pass';
    const qTerms=terms(q),aTerms=terms(answer);
    const share=(set,fn,fallback)=>set.size?[...set].filter(fn).length/set.size:fallback;
    const ids=new Set((q.match(/\b(?:flex|psi|saffire)[ -]\d+[a-z]?\b|\b(?:[a-z]{1,8}\d+[a-z0-9]*|\d+(?:[a-z][a-z0-9]*)|\d{5,})\b/g)||[]).filter(t=>!/^(?:co2|o2|fm2|fm²|h2o|cm2|cm3)$/.test(t)));
    const cited=clean([answer,...(turn.sources||[]).map(s=>[s.id,s.title,s.locator].join(' '))].join(' ')).replace(/[ -]/g,'');
    const calc=/\b(?:by how much|how much (?:longer|greater|lower|higher|faster|shorter)|calculate|compute|recompute|subtract|divide|ratio|percentage change|difference in|diameter difference|per gram|per second|squared error)\b/.test(q);
    const relation=/\b(?:both|whereas|compared?|versus|difference|distinguish|causal|transfer|isolate|two|counterfactual|and (?:why|which|what|how))\b/.test(q)||(q.match(/\?/g)||[]).length>1;
    const bounded=/\b(?:can|could|may|assume|prove|confirm|claim|certif\w*|infer|establish|insist|must|enough|guarantee)\b/.test(q);
    const explained=/\b(?:not|cannot|can't|no|unreported|unavailable|unknown|unresolved)\b/.test(answer)&&/\b(?:because|since|requires?|need(?:s|ed)?|only|instead|measured|reported|observed|assuming|depends?|records?)\b/.test(answer);
    return [Number(verified),Number(arithmetic),Number(route==='withheld'),share(qTerms,t=>aTerms.has(t),0),share(ids,t=>cited.includes(t.replace(/[ -]/g,'')),1),Number(calc&&!arithmetic),Number(relation),Number(bounded&&explained),blocks.length?blocks.filter(b=>b.refs?.length).length/blocks.length:0];
  }
  const sigmoid=v=>1/(1+Math.exp(-Math.max(-30,Math.min(30,v))));
  const band=p=>p<.5?0:p<.8?1:2;
  function probability(question,turn,fit,bank='semantic'){
    const x=features(question,turn);
    const linear=fit.intercepts[bank]+fit.weights.reduce((sum,w,i)=>sum+w*(x[i]-fit.centers[i]),0);
    return Number(sigmoid(linear).toFixed(6));
  }
  function predict(question,turn,fit,environment) {
    const common={model:fit?.version||null,event:'full-reply-rubric-pass',route:family(turn)};
    const compatible=fit?.features?.join('|')===names.join('|')&&fit?.weights?.length===names.length&&fit?.centers?.length===names.length;
    if(!fit?.ready||!compatible||environment?.local!==true||!environment?.digest||environment.digest!==fit.modelDigest||environment.engine!==fit.engineSHA256||environment.corpus!==fit.corpusSHA256||environment.research!==fit.researchSHA256||environment.encoder!==fit.encoderRevision){
      return {...common,probability:null,showPercentage:false,reason:environment?.local?'unvalidated-model':'archive-only'};
    }
    const p=probability(question,turn,fit);
    const eligible=(fit.familyCounts[common.route]||0)>=12&&fit.publishBands[band(p)]===true;
    return {...common,probability:p,showPercentage:eligible,reason:eligible?'validated-band':'insufficient-calibration-data'};
  }
  const api={names,features,family,sigmoid,band,probability,predict};
  if(typeof module!=='undefined')module.exports=api;
  globalThis.FFReplyCalibration=api;
})();
