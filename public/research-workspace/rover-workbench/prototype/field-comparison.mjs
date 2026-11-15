// Independently collected observations and model telemetry remain distinct through comparison.
const required = ['elapsedS', 'xM', 'zM'];
const optional = 'batteryWh';
const rowLimit = 50000;
const byteLimit = 5_000_000;

function fail(message) { throw new RangeError(message); }

function numberCell(text, key, line) {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) fail('Line ' + line + ': invalid ' + key);
  const n = Number(text);
  if (!Number.isFinite(n)) fail('Line ' + line + ': nonfinite ' + key);
  return n;
}

// A single-line numeric telemetry format. Optional quoting is accepted around individual cells.
function csvLine(line, lineNumber) {
  const fields = [];
  let i = 0;
  while (i <= line.length) {
    let value = '';
    if (line[i] === '"') {
      i++;
      let closed = false;
      while (i < line.length) {
        if (line[i] !== '"') { value += line[i++]; continue; }
        if (line[i+1] === '"') { value += '"'; i += 2; continue; }
        i++; closed = true; break;
      }
      if (!closed || (i < line.length && line[i] !== ',')) fail('Invalid CSV quote on line ' + lineNumber);
    } else {
      const comma = line.indexOf(',', i);
      const end = comma === -1 ? line.length : comma;
      value = line.slice(i, end);
      if (value.includes('"')) fail('Invalid CSV quote on line ' + lineNumber);
      i = end;
    }
    fields.push(value.trim());
    if (i === line.length) break;
    i++;
  }
  return fields;
}

function checkSeries(rows, label, limit = rowLimit) {
  if (!Array.isArray(rows) || rows.length < 2 || rows.length > limit) fail(label + ' needs 2–' + limit + ' samples');
  let last = -Infinity;
  for (let i = 0; i < rows.length; i++) {
    const s = rows[i];
    if (!s || !required.every(k => Number.isFinite(s[k]))) fail(label + ' has missing or nonfinite time/position at row ' + (i + 1));
    if (s.elapsedS <= last) fail(label + ' times must be strictly increasing, including at row ' + (i + 1));
    if (s.batteryWh != null && (!Number.isFinite(s.batteryWh) || s.batteryWh < 0)) fail(label + ' has invalid stored battery Wh');
    last = s.elapsedS;
  }
}

export function parseFieldCsv(text) {
  if (typeof text !== 'string' || text.length > byteLimit) fail('CSV must be text of at most 5 MB');
  const lines = text.replace(/^\uFEFF/, '').trimEnd().split(/\r?\n/);
  if (lines.length < 3 || lines.length > rowLimit + 1) fail('CSV needs a header and 2–50000 sample rows');
  const keys = csvLine(lines[0], 1);
  if (keys.length > 100 || keys.some(k => !k) || new Set(keys).size !== keys.length) fail('Empty, duplicate or excessive CSV headers');
  if (!required.every(key => keys.includes(key))) fail('CSV requires elapsedS,xM,zM with optional batteryWh');
  const rows = lines.slice(1).map((line, i) => {
    const cells = csvLine(line, i + 2);
    if (cells.length !== keys.length) fail('Line ' + (i + 2) + ' has the wrong number of columns');
    const s = {};
    for (const key of required) s[key] = numberCell(cells[keys.indexOf(key)], key, i + 2);
    const b = cells[keys.indexOf(optional)];
    s.batteryWh = b == null || b === '' ? null : numberCell(b, optional, i + 2);
    return s;
  });
  checkSeries(rows, 'Observed CSV');
  return rows;
}

function maxInterval(rows) {
  let largest = 0;
  for (let i = 1; i < rows.length; i++) largest = Math.max(largest, rows[i].elapsedS - rows[i-1].elapsedS);
  return largest;
}

const fields = ['xM', 'zM', 'batteryWh'];
function interpolate(a, b, t) {
  if (t === 0) return a;
  if (t === 1) return b;
  const s = {};
  for (const k of fields) s[k] = a[k] == null || b[k] == null ? null : a[k] + t * (b[k] - a[k]);
  return s;
}

function rms(values) {
  if (!values.length) return null;
  let scale = 0;
  for (const v of values) scale = Math.max(scale, Math.abs(v));
  if (scale === 0) return 0;
  let sum = 0;
  for (const v of values) sum += (v / scale) ** 2;
  return scale * Math.sqrt(sum / values.length);
}

export function compareFieldTrack(simulated, observed, { clockOffsetS = 0, maxGapS = null } = {}) {
  checkSeries(simulated, 'Simulated track', 100001);
  checkSeries(observed, 'Observed track');
  if (!Number.isFinite(clockOffsetS)) fail('Clock offset must be finite seconds');
  if (maxGapS != null && (!Number.isFinite(maxGapS) || maxGapS <= 0)) fail('Maximum interpolation gap must be positive seconds');
  const sim0 = simulated[0], obs0 = observed[0];
  const simEndS = simulated.at(-1).elapsedS - sim0.elapsedS;
  const obsEndS = observed.at(-1).elapsedS - obs0.elapsedS + clockOffsetS;
  const overlapStartS = Math.max(0, clockOffsetS), overlapEndS = Math.min(simEndS, obsEndS);
  if (overlapEndS <= overlapStartS) fail('No positive-duration time overlap');
  let index = 0, outside = 0, acrossGap = 0, batteryAnchor = null, positionAnchor = null;
  const rows = [];
  for (let i = 0; i < observed.length; i++) {
    const o = observed[i];
    const t = o.elapsedS - obs0.elapsedS + clockOffsetS;
    if (t < 0 || t > simEndS) { outside++; continue; }
    while (index + 1 < simulated.length && simulated[index+1].elapsedS - sim0.elapsedS <= t) index++;
    const a = simulated[index], b = simulated[index+1] ?? a;
    const at = a.elapsedS - sim0.elapsedS, delta = b.elapsedS - a.elapsedS;
    if (t > at && maxGapS != null && delta > maxGapS) { acrossGap++; continue; }
    const s = interpolate(a, b, delta === 0 ? 0 : (t - at) / delta);
    if (!positionAnchor) positionAnchor = { timeS:t, observedRow:i+1,
      observedXM:o.xM, observedZM:o.zM, simulatedXM:s.xM, simulatedZM:s.zM };
    const simX = s.xM - positionAnchor.simulatedXM, simZ = s.zM - positionAnchor.simulatedZM;
    const obsX = o.xM - positionAnchor.observedXM, obsZ = o.zM - positionAnchor.observedZM;
    const dx = simX - obsX, dz = simZ - obsZ;
    if (s.batteryWh != null && o.batteryWh != null && !batteryAnchor) {
      batteryAnchor = { sim: s.batteryWh, obs: o.batteryWh, timeS: t };
    }
    const simChange = !batteryAnchor || s.batteryWh == null ? null : s.batteryWh - batteryAnchor.sim;
    const obsChange = !batteryAnchor || o.batteryWh == null ? null : o.batteryWh - batteryAnchor.obs;
    const db = simChange == null || obsChange == null ? null : simChange - obsChange;
    const row = { observedRow: i+1, timeS: t, observedXRelM: obsX, observedZRelM: obsZ,
      simulatedXRelM: simX, simulatedZRelM: simZ, errorXM: dx, errorZM: dz, horizontalErrorM: Math.hypot(dx, dz),
      observedBatteryChangeWh: obsChange, simulatedBatteryChangeWh: simChange, batteryChangeErrorWh: db,
      absoluteBatteryChangeErrorWh: db == null ? null : Math.abs(db) };
    if (!Object.values(row).every(value => value === null || Number.isFinite(value))) fail('Input magnitude exceeds a finite comparison range');
    rows.push(row);
  }
  if (rows.length < 2) fail('Fewer than two observed samples are comparable in the time overlap');
  const batteryValues = rows.map(r => r.batteryChangeErrorWh).filter(v => v !== null);
  return { rows, observedCount: observed.length, simulatedCount: simulated.length, matchedCount: rows.length,
    coveragePct: 100 * rows.length / observed.length, outsideTimeCount: outside, interpolationGapCount: acrossGap,
    largestObservedGapS: maxInterval(observed), largestSimulatedGapS: maxInterval(simulated), clockOffsetS, maxGapS, positionAnchor,
    overlapStartS, overlapEndS, firstMatchedS: rows[0].timeS, lastMatchedS: rows.at(-1).timeS,
    horizontalRmseM: rms(rows.map(r => r.horizontalErrorM)), batteryChangeRmseWh: batteryValues.length > 1 ? rms(batteryValues) : null,
    batteryMatchedCount: batteryValues.length, batteryAnchorTimeS: batteryAnchor?.timeS ?? null };
}

const escapeText = value => '"' + String(value).replace(/"/g, '""') + '"';
export function fieldResultCsv(result, provenance) {
  const keys = Object.keys(result.rows[0]);
  const metaKeys = ['source','clock','frame','simulation','clockOffsetS','maxGapS','positionAnchorTimeS','positionAnchorObservedRow',
    'observedAnchorXM','observedAnchorZM','simulatedAnchorXM','simulatedAnchorZM','batteryAnchorTimeS'];
  const anchor = result.positionAnchor;
  const meta = { ...provenance, clockOffsetS: result.clockOffsetS, maxGapS: result.maxGapS,
    positionAnchorTimeS:anchor.timeS, positionAnchorObservedRow:anchor.observedRow, observedAnchorXM:anchor.observedXM,
    observedAnchorZM:anchor.observedZM, simulatedAnchorXM:anchor.simulatedXM, simulatedAnchorZM:anchor.simulatedZM,
    batteryAnchorTimeS:result.batteryAnchorTimeS };
  // Protect user-entered labels in spreadsheet viewers. Numeric result cells remain numeric.
  const fixed = metaKeys.map(k => {
    const v = meta[k] ?? '';
    return typeof v === 'string' && /^[\s]*[=+@-]/.test(v) ? escapeText("'" + v) : escapeText(v);
  });
  return [[...metaKeys, ...keys].join(','), ...result.rows.map(row =>
    [...fixed, ...keys.map(k => row[k] ?? '')].join(','))].join('\n') + '\n';
}

function element(tag, text) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  return node;
}

function inputField(name, type = 'text') {
  const label = element('label', name);
  const input = element('input');
  input.type = type;
  label.append(input);
  return { label, input };
}

export function mountFieldComparison(root, { getTraverse }) {
  const section = element('section');
  section.className = 'field-comparison';
  const file = inputField('Observed trial CSV', 'file');
  file.input.accept = '.csv,text/csv';
  const source = inputField('Observation source or trial identifier');
  const clock = inputField('Clock and common start event');
  const frame = inputField('Shared +X / +Z axes and frame description');
  const offset = inputField('Observed start time relative to simulation start (s)', 'number');
  offset.input.value = '0'; offset.input.step = 'any';
  const gap = inputField('Maximum simulated interpolation gap (s, optional)', 'number');
  gap.input.step = 'any';
  const compare = element('button', 'Compare observed trial with current drive');
  const save = element('button', 'Download comparison CSV');
  compare.type = save.type = 'button';
  save.disabled = compare.disabled = true;
  const message = element('p', 'Load a local trial CSV and record its source, clock and coordinate frame.');
  message.setAttribute('role', 'status');
  const details = element('div');
  const intro = element('p', 'Use independently observed elapsedS, xM, zM and optional batteryWh. Both tracks use the first matched time as the position origin. Axes must already correspond. Only simulation values are interpolated. Errors are simulation minus observation.');
  const controls = element('div');
  controls.className = 'field-comparison-controls';
  controls.append(file.label, source.label, clock.label, frame.label, offset.label, gap.label);
  section.append(element('h3','Independent field trial'), intro, controls, compare, save, message, details);
  root.append(section);
  let observed = null, saved = null, readId = 0;
  function invalidate() {
    saved = null; save.disabled = true; details.replaceChildren();
    compare.disabled = !observed;
  }
  file.input.onchange = async () => {
    const token = ++readId, f = file.input.files[0];
    observed = null; invalidate();
    if (!f) { message.textContent = 'No observation file selected.'; return; }
    try {
      if (f.size > byteLimit) fail('CSV exceeds 5 MB');
      const data = parseFieldCsv(await f.text());
      if (token !== readId) return;
      observed = data; compare.disabled = false;
      if (!source.input.value.trim()) source.input.value = f.name;
      message.textContent = data.length + ' user-supplied observations loaded. Compare after choosing a recorded drive.';
    } catch (e) { if (token === readId) message.textContent = e.message; }
  };
  for (const x of [source,clock,frame,offset,gap]) x.input.oninput = () => {
    invalidate(); message.textContent = 'Comparison settings changed. Run the comparison to apply them.';
  };
  compare.onclick = () => {
    invalidate();
    try {
      const snap = getTraverse();
      if (!snap?.track || !snap.state || snap.state.elapsedS <= 0) fail('Record or replay a simulated drive before comparing');
      const meta = { source:source.input.value.trim(), clock:clock.input.value.trim(), frame:frame.input.value.trim(),
        simulation:(snap.config?.world ?? 'unspecified world') + ' / ' + (snap.routePreset ?? 'custom route') + ' / ' + snap.state.elapsedS.toFixed(3) + ' s' };
      if (!meta.source || !meta.clock || !meta.frame) fail('Record an observation source, clock reference and matching axes');
      const result = compareFieldTrack(snap.track, observed, { clockOffsetS:offset.input.valueAsNumber,
        maxGapS:gap.input.value.trim() === '' ? null : gap.input.valueAsNumber });
      const f = v => Number(v.toFixed(4)).toLocaleString('en',{maximumFractionDigits:4});
      message.textContent = 'Horizontal position RMSE ' + f(result.horizontalRmseM) + ' m. ' +
        (result.batteryChangeRmseWh == null ? 'Battery-change RMSE unavailable.' : 'Battery-change RMSE ' + f(result.batteryChangeRmseWh) + ' Wh.');
      details.append(element('p', result.matchedCount + '/' + result.observedCount + ' observed rows matched (' + f(result.coveragePct) +
        '%). Compared from ' + f(result.firstMatchedS) + ' to ' + f(result.lastMatchedS) + ' s. ' +
        result.outsideTimeCount + ' outside simulated time. ' + result.interpolationGapCount + ' excluded across a simulated gap. ' +
        'Largest intervals: observed ' + f(result.largestObservedGapS) + ' s, simulated ' + f(result.largestSimulatedGapS) +
        ' s. Battery-change samples: ' + result.batteryMatchedCount +
        (result.batteryAnchorTimeS == null ? '.' : ', referenced to the first matched charge at ' + f(result.batteryAnchorTimeS) + ' s.')));
      details.append(element('p','Position alignment starts at matched observation ' + result.positionAnchor.observedRow +
        ' at ' + f(result.positionAnchor.timeS) + ' s. Its displacement error is zero by construction. Earlier position offsets are unavailable.'));
      details.append(element('p','Observed: ' + meta.source + '. Simulated: ' + meta.simulation + '. Clock: ' + meta.clock + '. Axes: ' + meta.frame + '.'));
      const table = element('table'), head = table.createTHead().insertRow();
      for (const col of ['Time (s)','X error (m)','Z error (m)','Horizontal error (m)','Battery change error (Wh)']) head.append(element('th', col));
      const body = table.createTBody();
      for (const row of result.rows.slice(0, 8)) {
        const tr = body.insertRow();
        for (const key of ['timeS','errorXM','errorZM','horizontalErrorM','batteryChangeErrorWh']) tr.insertCell().textContent = row[key] == null ? '—' : f(row[key]);
      }
      details.append(table, element('p','First ' + Math.min(8,result.matchedCount) + ' matched samples shown. CSV includes all signed and absolute differences.'));
      saved = { result, meta }; save.disabled = false;
    } catch (e) { message.textContent = e.message; }
  };
  save.onclick = () => {
    if (!saved) return;
    const url = URL.createObjectURL(new Blob([fieldResultCsv(saved.result, saved.meta)], {type:'text/csv'}));
    const a = element('a'); a.href = url; a.download = 'first-fire-field-comparison.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };
  // The retained comparison is a captured run. Changing or animating a drive does no interpolation here.
  return { update() {} };
}
