import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rows } from '../terrain/lola-samples.mjs';
import { makeJezeroRoute } from '../terrain/extract-jezero.mjs';
import { lolaContains, lolaHeightAt } from './lola-grid.mjs';

const bytes = path => readFileSync(new URL(path, import.meta.url));
const json = path => JSON.parse(bytes(path));
const digest = raw => createHash('sha256').update(raw).digest('hex');
const meta = json('../terrain/lola.json');
const route = json('../terrain/jezero-route.json');
const feature = bytes('../terrain/perseverance-sol15.geojson');
const parentDir = '../../../clps-prototype/data/terrain/';
const parentManifest = new URL(parentDir + 'dem-source-manifest.json', import.meta.url);

test('LOLA file hashes, raw signed pixel samples and scale agree with the PDS label', () => {
  assert.equal(digest(bytes('../terrain/lola-samples.mjs')), meta.fileSha256);
  assert.equal(digest(bytes('../terrain/ldem_80s_80m.lbl')), '107c7558cbf8832e4119d3c8c2b1b272623344275c85378a9b0e03c22876eb33');
  assert.match(bytes('../terrain/ldem_80s_80m.lbl').toString(), /SAMPLE_TYPE\s*= LSB_INTEGER/);
  assert.deepEqual(meta.centrePixelRowColumnZeroBased, [3610, 3800]);
  assert.equal(meta.gridSpacingM, 80);
  assert.equal(meta.metresPerDN, 0.5);
  assert.equal(rows.length, 65);
  assert.ok(rows.every(row => row.length === 65 && row.every(Number.isInteger)));
  const all = rows.flat();
  const packed = Buffer.alloc(all.length * 2);
  all.forEach((value, i) => packed.writeInt16LE(value, i * 2));
  assert.equal(digest(packed), '13bede5403bb9f7c17522105a0379766aa9c906dcf1e57d5d3bb14894e9853d6');
  assert.equal(rows[32][32] * 0.5, meta.centreElevationM);
  assert.deepEqual([Math.min(...all), Math.max(...all)], [-2247, -667]);
});

test('all 4,225 samples match the archived PDS source rows byte-for-byte when the project archive is present',
  { skip: existsSync(parentManifest) ? false : 'Parent project source band is outside this standalone copy' }, () => {
    const manifest = JSON.parse(readFileSync(parentManifest));
    const parent = bytes(parentDir + manifest.file);
    assert.equal(digest(parent), meta.parentBandSha256);
    assert.equal(parent.byteLength, manifest.bytes);
    for (let r = 0; r < 65; r++) {
      for (let c = 0; c < 65; c++) {
        const index = (3578 + r - manifest.row_start_zero_based) * manifest.columns + 3768 + c;
        assert.equal(rows[r][c], parent.readInt16LE(2 * index));
      }
    }
  });

test('LOLA centre, orientation and inclusive map edges agree with the raw signed grid', () => {
  assert.equal(lolaHeightAt(0, 0), 0);
  for (const [r, c] of [[0, 0], [0, 64], [64, 0], [64, 64], [31, 48], [53, 25]]) {
    const x = (c - 32) * 80, z = (32 - r) * 80;
    assert.ok(lolaContains(x, z));
    assert.equal(lolaHeightAt(x, z), rows[r][c] * 0.5 - meta.centreElevationM);
  }
  const gridMean = (rows[32][32] + rows[32][33] + rows[31][32] + rows[31][33]) / 4;
  assert.equal(lolaHeightAt(40, 40), 0.5 * gridMean - meta.centreElevationM);
  assert.ok(!lolaContains(0, 2560.01));
  assert.ok(!lolaContains(-2560.01, 0));
  assert.equal(lolaHeightAt(-2600, 0), lolaHeightAt(-2560, 0));
});

test('the archived NASA flight feature regenerates the exact serialized Mars route and origin', () => {
  assert.equal(digest(feature), route.featureSha256);
  assert.equal(route.upstreamSnapshotName, 'M20_Traverse_Path_tosol2022');
  assert.equal(route.upstreamSha256, '6ddd0ece913d75b45d105946082f95ed84e68f4718b68d32a4421dc30877e7e6');
  assert.deepEqual(Buffer.from(JSON.stringify(makeJezeroRoute(feature), null, 2) + '\n'), bytes('../terrain/jezero-route.json'));
  assert.throws(() => makeJezeroRoute(Buffer.concat([feature, Buffer.from('\n')])), /SHA-256/);
  const raw = JSON.parse(feature);
  assert.equal(raw.properties.sol, 15);
  assert.equal(raw.properties.fromRMC, '3_110');
  assert.equal(raw.properties.toRMC, '3_386');
  assert.equal(raw.geometry.coordinates.length, 47);
  assert.equal(route.cataloguedLengthM, 36.39);
  assert.deepEqual(route.originLonLat, raw.geometry.coordinates[0].slice(0, 2));
});

test('the simplified Mars polyline retains endpoints and all original projected points within rounding tolerance', () => {
  const coords = JSON.parse(feature).geometry.coordinates;
  const [lon0, lat0] = coords[0];
  const deg = Math.PI / 180, r = 3389500;
  const p = coords.map(([lon, lat]) => [(lon - lon0) * deg * r * Math.cos(lat0 * deg), (lat - lat0) * deg * r]);
  const kept = [[0, 0], ...route.waypoints.map(w => [w.xM, w.zM])];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const length = points => points.slice(1).reduce((sum, v, i) => sum + dist(v, points[i]), 0);
  assert.ok(dist(kept.at(-1), p.at(-1)) < 0.00008);
  assert.ok(Math.abs(length(p) - 36.321434232421005) < 1e-8);
  assert.ok(Math.abs(length(kept) - 36.30200055453824) < 1e-8);
  const sampleIndices = [0, 10, 30, 46];
  for (let j = 0; j < 3; j++) {
    const a = kept[j], b = kept[j+1], dx = b[0] - a[0], dz = b[1] - a[1];
    for (const [x, z] of p.slice(sampleIndices[j], sampleIndices[j+1] + 1)) {
      const fraction = Math.max(0, Math.min(1, ((x-a[0])*dx + (z-a[1])*dz)/(dx*dx + dz*dz)));
      assert.ok(dist([x,z], [a[0] + fraction*dx, a[1] + fraction*dz]) <= route.simplificationToleranceM + 0.00008);
    }
  }
});
