'use strict';

(() => {
  const archive = window.FFDetectorTelemetry;
  const byId = id => document.getElementById(id);
  const text = (id, value) => { byId(id).textContent = value; };
  const grouped = value => value.toLocaleString('en-US');
  const predictions = new Map();
  const names = {on:'Yes, during part or all of the run', off:'No, it stayed off', unsure:'I need the power readings'};
  const initial = Number(new URLSearchParams(window.location.search).get('run'));
  if (archive.runs.some(run => run.number === initial)) byId('run').value = String(initial);

  function calculate(run) {
    const start = run.records.find(row => row[2] === 1);
    const baselineRows = run.records.filter(row => row[1] >= start[1] - 30 && row[1] < start[1]);
    const sorted = baselineRows.map(row => row[3]).sort((a,b) => a-b);
    const middle = Math.floor(sorted.length / 2);
    const baseline = sorted.length % 2 ? sorted[middle] : (sorted[middle-1] + sorted[middle]) / 2;
    const trace = run.records.filter(row => row[1] >= start[1] && row[1] <= start[1]+300);
    const peak = trace.reduce((lowest, row) => row[3] < lowest[3] ? row : lowest);
    const power = run.records.filter(row => row[4] === 1);
    const alarm = run.records.filter(row => row[5] === 1);
    return {start, baselineRows, baseline, trace, peak, power, alarm};
  }

  const xmlns = 'http://www.w3.org/2000/svg';
  function shape(name, attributes, content) {
    const element = document.createElementNS(xmlns, name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    if (content !== undefined) element.textContent = content;
    return element;
  }

  function renderPlot(run, data) {
    const svg = byId('plot');
    svg.replaceChildren();
    const series = data.trace.map(row => [row[1]-data.start[1], data.baseline-row[3]]);
    const scale = run.number === 92 ? 0.5 : 0.25;
    const top = Math.ceil(Math.max(...series.map(point => point[1]))/scale)*scale;
    const low = Math.min(-0.04, ...series.map(point => point[1]));
    const x = time => 53 + time/300*543;
    const y = value => 167 - (value-low)/(top-low)*152;
    svg.append(shape('title', {id:'plot-title'}, 'Run '+run.number+' ISS scatter-voltage change'),
      shape('desc', {id:'plot-desc'}, 'Baseline minus recorded volts, from heater start through 300 seconds. Maximum '+(data.baseline-data.peak[3]).toFixed(6)+' volts at '+(data.peak[1]-data.start[1])+' seconds. Inspect individual samples with the slider below.'));
    for (let tick=0; tick<=top; tick+=scale) {
      svg.append(shape('line',{x1:x(0),x2:x(300),y1:y(tick),y2:y(tick),stroke:'#bdcdc8','stroke-width':0.9}),
        shape('text',{x:44,y:y(tick)+4,'text-anchor':'end','font-size':13,fill:'#455e63'},String(tick)+' V'));
    }
    for (let time=0;time<=300;time+=60) svg.append(shape('text',{x:x(time),y:188,'text-anchor':'middle','font-size':13,fill:'#455e63'},time));
    svg.append(shape('text',{x:322,y:210,'text-anchor':'middle','font-size':14,fill:'#455e63'},'Seconds after heater start'));
    const path = series.map(([time,value],i) => (i ? 'L' : 'M')+x(time).toFixed(2)+' '+y(value).toFixed(2)).join(' ');
    svg.append(shape('path',{d:path,fill:'none',stroke:'#046957','stroke-width':2.4,'stroke-linejoin':'round'}));
    const marker = shape('circle',{r:4.3,fill:'#983c1c',stroke:'#fff','stroke-width':1.5});
    svg.append(marker);
    const slider = byId('sample');
    slider.max = String(series.length-1);
    slider.value = String(data.trace.indexOf(data.peak));
    function showSample() {
      const i = Number(slider.value);
      const row = data.trace[i], [time,drop] = series[i];
      marker.setAttribute('cx',x(time));
      marker.setAttribute('cy',y(drop));
      const summary = time+' s after heater start. W'+row[0]+' = '+row[3].toFixed(6)+' V. Drop = '+drop.toFixed(6)+' V. BK'+row[0]+' power = '+row[4]+'. CN'+row[0]+' alarm = '+row[5]+'.';
      text('reading',summary);
      slider.setAttribute('aria-valuetext',summary);
    }
    slider.oninput = showSample;
    showSample();
  }

  function renderRepeats() {
    const body=byId('repeats');
    let count=0;
    for (const run of archive.runs.filter(item=>item.number!==92)) {
      const data=calculate(run), row=document.createElement('tr');
      const values=[run.number,(data.baseline-data.peak[3]).toFixed(6),data.peak[1]-data.start[1],
        grouped(data.power.length)+' / '+grouped(run.records.length)];
      values.forEach((value,i)=>{
        const cell=document.createElement(i===0?'th':'td');
        if(i===0) cell.scope='row';
        cell.textContent=value; row.append(cell);
      });
      body.append(row); count+=run.records.length;
    }
    text('repeat-note','The Shuttle power and alarm flags are zero across all '+grouped(count)+' matching rows. These are repeated measurements within three runs. Net aging times were 32, 33 and 36 seconds. Run 75 was recorded without the P-Trak instrument.');
  }

  function selectedRun() {
    return archive.runs.find(run => String(run.number) === byId('run').value);
  }

  function renderCase(moveFocus=false) {
    const run = selectedRun(), conditions = run.conditions;
    const call = predictions.get(run.number);
    text('condition-note', run.number===92 ? 'Comparison run with a different heater setting.' :
      'Runs 75, 85 and 93 share nominal inlet speed, heater setting and heating duration. Their net aging times differ.');
    const conditionsList = byId('conditions');
    conditionsList.replaceChildren();
    const fields = [
      ['Inlet speed', conditions['Inlet velocity (cm/s)']+' cm/s'],
      ['Heater resistance ratio Rt/R0', conditions['Rt/R0']],
      ['Heating duration', conditions['Duration (sec)']+' s'],
      ['Net aging time', conditions['Net aging time (sec)']+' s']
    ];
    for (const [label,value] of fields) {
      const row=document.createElement('div'), term=document.createElement('dt'), detail=document.createElement('dd');
      term.textContent=label; detail.textContent=value; row.append(term,detail); conditionsList.append(row);
    }
    byId('prediction').reset();
    byId('prediction').hidden = !!call;
    byId('prompt').hidden = !!call;
    byId('review').hidden = !call;
    byId('result').hidden = !call;
    byId('receipt').open = false;
    byId('family').open = false;
    text('download-status','');
    if (!call) return;
    const data = calculate(run), total=run.records.length;
    const powered = data.power.length>0;
    const basis = call === 'unsure' ? 'The power flag resolves your question.' :
      ((call === 'on') === powered ? 'The recorded power flag supports your prediction.' : 'The recorded power flag differs from your prediction.');
    text('call-note',names[call]+'. '+basis);
    text('finding',powered ? 'The Shuttle power flag turned on.' : 'The Shuttle power flag stayed off.');
    text('explanation',powered ?
      'Run 92 had powered records. The alarm flag stayed zero throughout. This comparison confirms that the power channel changes state. The changed heater setting limits comparison of detector sensitivity.' :
      'The ISS optical signal changed. On the separate Shuttle instrument, power and alarm flags stayed zero in every row tagged with this run. A zero alarm while unpowered cannot establish how a powered detector would have responded.');
    text('power-n',grouped(data.power.length)+' / '+grouped(total));
    text('alarm-n',grouped(data.alarm.length)+' / '+grouped(total));
    text('peak','Maximum drop '+(data.baseline-data.peak[3]).toFixed(6)+' V at '+(data.peak[1]-data.start[1])+' s, from workbook cell W'+data.peak[0]+'. This is a change in voltage. Alarm thresholds require separate calibration.');
    text('method','NASA condition-table row '+run.conditionRow+' describes this run as “'+conditions.Description+'”. Worksheet “'+archive.worksheet+'”, column D = '+run.number+'. Heating first registered in R'+data.start[0]+' at source time '+data.start[1]+' (B'+data.start[0]+'). Baseline '+data.baseline.toFixed(6)+' V uses '+data.baselineRows.length+' pre-heating readings. The trace uses '+data.trace.length+' readings in the next 0–300 s. Power and alarm totals above use all matching rows. The source clock includes repeated timestamps and gaps.');
    byId('book').href=run.url;
    byId('table').href=archive.tableUrl;
    text('sha',run.sha256);
    renderPlot(run,data);
    if(moveFocus) byId('finding').focus();
  }

  byId('prediction').addEventListener('submit',event => {
    event.preventDefault();
    const form = byId('prediction');
    const input = form.querySelector('input[name=call]:checked');
    if (!input) {
      const radio=form.querySelector('input[name=call]');
      radio.required=true; radio.reportValidity(); return;
    }
    predictions.set(selectedRun().number,input.value); renderCase(true);
  });
  byId('run').addEventListener('change',() => renderCase());
  byId('retry').addEventListener('click',() => {
    predictions.delete(selectedRun().number); renderCase();
    byId('prediction').querySelector('input[name=call]').focus();
  });

  byId('download').addEventListener('click',() => {
    const run=selectedRun(), data=calculate(run);
    const record={
      case:'SAME-R Kapton detector state', run:run.number, prediction:names[predictions.get(run.number)],
      doi:archive.doi, study_revision:archive.studyVersion, file_revision:archive.fileVersion, worksheet:archive.worksheet,
      source_workbook:{file:run.filename,url:run.url,sha256:run.sha256},
      source_conditions:{url:archive.tableUrl,sha256:archive.tableSha256,row:run.conditionRow,values:run.conditions},
      selection:{column:'D (TestNumber)',value:run.number}, cells:{time:'B',heating_flag:'R',iss_scatter_V:'W',sts_power:'BK',sts_alarm:'CN'},
      processing:{time_origin:'First matching record with HeatingInProgress = 1',start_row:data.start[0],start_source_time_s:data.start[1],
        baseline:'Median of ISS scatter voltages from -30 s inclusive to 0 s exclusive',baseline_V:data.baseline,
        baseline_samples:data.baselineRows.length,trace:'Baseline minus measured ISS scatter voltage, elapsed time 0–300 s inclusive',
        maximum_drop_V:Number((data.baseline-data.peak[3]).toFixed(6)),peak_elapsed_s:data.peak[1]-data.start[1],peak_cell:'W'+data.peak[0]},
      matching_records:run.records.length,sts_power_on_records:data.power.length,sts_alarm_on_records:data.alarm.length,
      interpretation:byId('explanation').textContent, raw_columns:archive.columns,raw_matching_records:run.records
    };
    const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)+'\n'],{type:'application/json'}));
    const link=document.createElement('a');link.download='first-fire-same-r-kapton-'+run.number+'.json';link.href=url;
    document.body.append(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    text('download-status','Evidence record prepared for run '+run.number+'.');
  });
  renderRepeats();
  renderCase();
})();
