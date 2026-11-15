// Rebuild the three workbench goals from the archived Mars 2020 sol 15 LineString.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const archive = {
  name: 'M20_Traverse_Path_tosol2022',
  whole: '6ddd0ece913d75b45d105946082f95ed84e68f4718b68d32a4421dc30877e7e6',
  feature: 'cb233a675fb31af4d941f4effad9800304d1a1ba15ed5eb87c7647543724fa88'
};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const rad = Math.PI / 180;
const radiusM = 3389500;
const toleranceM = 0.15;

function offsetToSegment(p, a, b) {
  const dx = b.xM - a.xM, dz = b.zM - a.zM;
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.xM - a.xM) * dx + (p.zM - a.zM) * dz) / len2));
  return Math.hypot(p.xM - a.xM - t * dx, p.zM - a.zM - t * dz);
}

function simplify(points) {
  const first = points[0], last = points.at(-1);
  let split = 0, largest = toleranceM;
  for (let i = 1; i < points.length - 1; i++) {
    const distance = offsetToSegment(points[i], first, last);
    if (distance > largest) { largest = distance; split = i; }
  }
  if (!split) return [first, last];
  const left = simplify(points.slice(0, split + 1));
  const right = simplify(points.slice(split));
  return left.slice(0, -1).concat(right);
}

export function makeJezeroRoute(bytes) {
  if (hash(bytes) !== archive.feature) throw new Error('Archived sol 15 feature SHA-256 mismatch');
  const raw = JSON.parse(bytes);
  const p = raw.properties;
  const coords = raw.geometry.coordinates;
  if (raw.geometry.type !== 'LineString' || !coords.every(row => row.length === 3 && row.every(Number.isFinite))) {
    throw new Error('Expected longitude, latitude and elevation at each station');
  }
  const [lon0, lat0] = coords[0];
  const eastScale = radiusM * rad * Math.cos(lat0 * rad);
  const northScale = radiusM * rad;
  const local = coords.map(([lon, lat]) => ({ xM: (lon - lon0) * eastScale, zM: (lat - lat0) * northScale }));
  const waypoints = simplify(local).slice(1).map(({ xM, zM }) => ({
    xM: Number(xM.toFixed(4)), zM: Number(zM.toFixed(4))
  }));
  return {
    id: 'perseverance-sol15', mission: 'Mars 2020', sol: p.sol, fromRMC: p.fromRMC, toRMC: p.toRMC,
    cataloguedLengthM: p.length, inputCoordinates: coords.length, originLonLat: [lon0, lat0],
    frame: 'Local equirectangular metres. +X east and +Z north. Assumed Mars radius 3389500 m.',
    simplificationToleranceM: toleranceM,
    sourceUrl: 'https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json',
    missionMapUrl: 'https://science.nasa.gov/mission/mars-2020-perseverance/location-map/',
    upstreamSnapshotName: archive.name, upstreamSha256: archive.whole, featureSha256: archive.feature,
    limits: 'Flight horizontal path reference only. Source elevations are retained in the GeoJSON. The replay uses a flat surface and the hypothetical vehicle, speed, control and power model.',
    waypoints
  };
}

export function verifyJezeroUpstream(bytes, featureBytes) {
  if (hash(bytes) !== archive.whole) throw new Error('The full Mars 2020 snapshot does not match the recorded SHA-256');
  const all = JSON.parse(bytes);
  if (all.name !== archive.name || all.type !== 'FeatureCollection') throw new Error('Unexpected Mars 2020 snapshot');
  const matching = all.features.filter(({ properties: p }) => p.sol === 15 && p.fromRMC === '3_110' && p.toRMC === '3_386');
  const raw = JSON.parse(featureBytes);
  if (matching.length !== 1 || JSON.stringify(matching[0]) !== JSON.stringify(raw)) throw new Error('Sol 15 feature mismatch');
  makeJezeroRoute(featureBytes);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  const feature = await readFile(new URL('perseverance-sol15.geojson', import.meta.url));
  if (args.length === 2 && args[0] === '--verify-upstream') {
    verifyJezeroUpstream(await readFile(args[1]), feature);
    console.log('Verified full snapshot and its sol 15 feature.');
  } else if (!args.length || (args.length === 2 && args[0] === '--out')) {
    const serialized = JSON.stringify(makeJezeroRoute(feature), null, 2) + '\n';
    if (args.length) await writeFile(args[1], serialized);
    else process.stdout.write(serialized);
  } else {
    throw new Error('Usage: node extract-jezero.mjs [--out FILE | --verify-upstream FULL-SNAPSHOT]');
  }
}
