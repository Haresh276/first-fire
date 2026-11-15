'use strict';
(function(){
  const detail=document.getElementById('study-detail'), select=document.getElementById('material');
  const data=window.FFDetectorStudy;
  if(!data){
    detail.textContent='Open the downloadable results file below to inspect the per-run values.';
    return;
  }
  const fold=data.fold;
  select.replaceChildren(...Object.keys(fold.by_material).map(material=>new Option(material,material)));
  select.disabled=false;
  function show(){
    const material=select.value, group=fold.by_material[material];
    const rows=fold.predictions.filter(row=>row.material===material);
    const paragraph=document.createElement('p');
    paragraph.textContent=group.below_cut+' of '+group.n+' measured peaks fell below 2 V. With this material held out, the heater model placed '+group.false_above+' measured-low runs above the line and '+group.false_below+' measured-high runs below it. Mean absolute error was '+group.mae.heater.toFixed(2)+' V. '+(group.n===1?'There is one observed error for this material.':'Absolute errors ranged from '+group.heater_error_range.map(v=>v.toFixed(2)+' V').join(' to ')+'.');
    const wrapper=document.createElement('div');
    wrapper.className='scroll';
    const table=document.createElement('table');
    table.className='repeat-table';
    table.innerHTML='<thead><tr><th scope="col">Flight run</th><th scope="col">Heater Rt/R0</th><th scope="col">Measured drop</th><th scope="col">Predicted drop</th><th scope="col">Pooled median</th><th scope="col">Peak cell</th></tr></thead>';
    table.createCaption().textContent='Predictions made with every '+material+' test withheld. The NASA workbook link opens the original data.';
    const body=table.createTBody();
    rows.forEach(row=>{
      const source=data.runs.find(s=>s.number===row.number), line=body.insertRow();
      const link=document.createElement('a');link.href=source.url;link.textContent='Run '+row.number;
      line.insertCell().append(link);
      for(const value of [source.heater_ratio,row.measured.toFixed(3)+' V',row.predicted.heater.toFixed(3)+' V',row.predicted.median.toFixed(3)+' V','W'+source.peak_row])line.insertCell().textContent=value;
    });
    wrapper.append(table);detail.replaceChildren(paragraph,wrapper);
  }
  select.onchange=show;show();
})();
