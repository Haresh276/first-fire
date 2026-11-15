import {rows} from '../terrain/lola-samples.mjs';

export function lolaContains(xM,zM) {
  return Number.isFinite(xM) && Number.isFinite(zM) && Math.abs(xM)<=2560 && Math.abs(zM)<=2560;
}

// Clamp only for camera rendering at the map edge. Traverse motion checks lolaContains.
export function lolaHeightAt(xM,zM) {
  const col=Math.max(0,Math.min(64,32+xM/80));
  const row=Math.max(0,Math.min(64,32-zM/80));
  const i=Math.min(63,Math.floor(col)), j=Math.min(63,Math.floor(row));
  const u=col-i,v=row-j;
  const top=rows[j][i]*(1-u)+rows[j][i+1]*u;
  const bottom=rows[j+1][i]*(1-u)+rows[j+1][i+1]*u;
  return .5*(top*(1-v)+bottom*v-rows[32][32]);
}
