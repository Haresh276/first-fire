// Ideal low-speed surface mobility sizing. All functions are deterministic and use SI units.
import { lolaHeightAt, lolaContains } from './lola-grid.mjs';

const terrains = ['flat', 'grade', 'rolling', 'lola'];
const gravities = { Moon: 1.62, Mars: 3.71, Earth: 9.80665, Orbit: 0 };
const bounds = {
  massKg: [0.01, 100000], speedMps: [0.01, 8], turnRateRadS: [0.01, 2],
  trackWidthM: [0.05, 10], wheelRadiusM: [0.01, 2], rollingResistance: [0, 1],
  friction: [0, 2], efficiency: [0.01, 1], slipFraction: [0, 0.95],
  reservePct: [0, 100], hotelW: [0, 30000], solarW: [0, 160000],
  capacityWh: [0, 200000], initialWh: [0, 200000]
};
const coordLimit = 1000000;
const stopStatuses = ['traction limit', 'battery reserve', 'orbital free fall', 'map boundary'];
const statuses = ['ready', 'driving', 'idle', 'route complete', 'time limit', ...stopStatuses];

function range(value, low, high, label) {
  if (!Number.isFinite(value) || value < low || value > high) {
    throw new RangeError(label + ' must be finite and between ' + low + ' and ' + high);
  }
  return value;
}

function checkConfig(c) {
  if (!Object.hasOwn(gravities, c.world) || !terrains.includes(c.terrain)) throw new RangeError('Unknown world or terrain');
  if (c.world !== 'Moon' && c.terrain === 'lola') throw new RangeError('LOLA is a lunar map');
  for (const [key, [lo, hi]] of Object.entries(bounds)) range(c[key], lo, hi, key);
  if (c.initialWh > c.capacityWh) throw new RangeError('initialWh exceeds capacityWh');
  return c;
}

export function makeTraverseConfig(scenario, result, overrides = {}) {
  for (const key of Object.keys(overrides)) {
    if (key !== 'terrain' && !Object.hasOwn(bounds, key)) throw new RangeError('Unknown traverse override ' + key);
  }
  const c = scenario.conditions;
  return checkConfig({
    world: c.world, terrain: 'flat', massKg: result.mobility.massKg, speedMps: 1,
    turnRateRadS: 0.35, trackWidthM: 1.8, wheelRadiusM: 0.25, rollingResistance: 0.05,
    friction: 0.5, efficiency: 0.75, slipFraction: 0.05, reservePct: 10,
    hotelW: c.loadW, solarW: result.power.generationW,
    capacityWh: c.capacityWh, initialWh: c.capacityWh * c.startPct / 100, ...overrides
  });
}

export function heightAt(xM, zM, terrain) {
  if (!Number.isFinite(xM) || !Number.isFinite(zM)) throw new RangeError('Terrain coordinates must be finite');
  if (terrain === 'flat') return 0;
  if (terrain === 'grade') return 0.1 * zM;
  if (terrain === 'rolling') return 2 * Math.sin(xM / 16) + 3 * Math.sin(zM / 22);
  if (terrain === 'lola') return lolaHeightAt(xM, zM);
  throw new RangeError('Unknown terrain');
}

function terrainPose(x, z, heading, terrain) {
  // A centred stencil estimates the slope visible at rover scale. At map limits use the available side.
  const e = 0.25;
  const inside = (a, b) => terrain !== 'lola' || lolaContains(a, b);
  const xLo = inside(x - e, z) ? x - e : x;
  const xHi = inside(x + e, z) ? x + e : x;
  const zLo = inside(x, z - e) ? z - e : z;
  const zHi = inside(x, z + e) ? z + e : z;
  const hx = (heightAt(xHi, z, terrain) - heightAt(xLo, z, terrain)) / (xHi - xLo);
  const hz = (heightAt(x, zHi, terrain) - heightAt(x, zLo, terrain)) / (zHi - zLo);
  const forwardGrade = hx * Math.sin(heading) + hz * Math.cos(heading);
  const rightGrade = hx * Math.cos(heading) - hz * Math.sin(heading);
  return { yM: heightAt(x, z, terrain), pitchRad: Math.atan(forwardGrade),
    rollRad: Math.atan(rightGrade), slopeRad: Math.atan(Math.hypot(hx, hz)) };
}

function angle(rad) {
  return Math.atan2(Math.sin(rad), Math.cos(rad));
}

function checkPoint(point, terrain) {
  range(point.xM, -coordLimit, coordLimit, 'xM');
  range(point.zM, -coordLimit, coordLimit, 'zM');
  if (terrain === 'lola' && !lolaContains(point.xM, point.zM)) throw new RangeError('Waypoint or start outside LOLA coverage');
}

export function createTraverse(c, start = {}) {
  checkConfig(c);
  const xM = start.xM ?? 0;
  const zM = start.zM ?? 0;
  const headingRad = angle(range(start.headingRad ?? 0, -1e6, 1e6, 'headingRad'));
  checkPoint({ xM, zM }, c.terrain);
  return { xM, zM, headingRad, ...terrainPose(xM, zM, headingRad, c.terrain),
    wheelAngleRad: 0, leftWheelAngleRad: 0, rightWheelAngleRad: 0, speedMps: 0, steer: 0,
    distanceM: 0, elapsedS: 0, batteryWh: c.initialWh, driveWh: 0,
    hotelWh: 0, solarWh: 0, curtailedWh: 0, status: 'ready' };
}

function stopped(s, status) {
  return { ...s, speedMps: 0, steer: 0, status };
}

function microstep(s, throttle, steer, dt, c) {
  const speed = c.speedMps * throttle * (1 - c.slipFraction);
  const yawRate = c.turnRateRadS * steer;
  const midpointHeading = s.headingRad + yawRate * dt / 2;
  const { pitchRad, slopeRad } = terrainPose(s.xM, s.zM, midpointHeading, c.terrain);
  const weight = c.massKg * gravities[c.world];
  const normal = weight * Math.cos(slopeRad);
  const rollingForce = c.rollingResistance * normal;
  const alongGravity = weight * Math.sin(pitchRad);
  // Resolve gravity along the direction of travel and the orthogonal tangent-plane direction.
  const lateralGravity = Math.sqrt(Math.max(0, (weight * Math.sin(slopeRad)) ** 2 - alongGravity ** 2));
  const longitudinal = alongGravity + Math.sign(speed) * rollingForce;
  const turning = Math.abs(yawRate) > 0 ? rollingForce : 0;
  if ((speed !== 0 || yawRate !== 0) && Math.hypot(longitudinal, lateralGravity) + turning > c.friction * normal + 1e-9) {
    return stopped(s, 'traction limit');
  }
  const wheelSurfaceSpeed = speed / (1 - c.slipFraction);
  const translationW = Math.max(0, longitudinal * wheelSurfaceSpeed);
  const turnW = turning * Math.abs(yawRate) * c.trackWidthM / 2;
  const driveW = (translationW + turnW) / c.efficiency;
  const netDrawW = c.hotelW + driveW - c.solarW;
  const reserveWh = c.capacityWh * c.reservePct / 100;
  const availableWh = Math.max(0, s.batteryWh - reserveWh);
  const availableS = netDrawW > 0 ? availableWh * 3600 / netDrawW : Infinity;
  const seconds = Math.min(dt, availableS);
  if (seconds === 0) return stopped(s, 'battery reserve');

  const yaw = yawRate * seconds;
  const heading = angle(s.headingRad + yaw);
  const horizontal = speed * seconds * Math.cos(pitchRad);
  const halfYaw = yaw / 2;
  const chord = Math.abs(halfYaw) < 1e-9 ? horizontal : horizontal * Math.sin(halfYaw) / halfYaw;
  const xM = s.xM + chord * Math.sin(s.headingRad + halfYaw);
  const zM = s.zM + chord * Math.cos(s.headingRad + halfYaw);
  if (Math.abs(xM) > coordLimit || Math.abs(zM) > coordLimit ||
      (c.terrain === 'lola' && !lolaContains(xM, zM))) return stopped(s, 'map boundary');

  const h = seconds / 3600;
  const unconstrainedWh = s.batteryWh - netDrawW * h;
  const centerRotation = wheelSurfaceSpeed * seconds / c.wheelRadiusM;
  const differentialRotation = yaw * c.trackWidthM / (2 * c.wheelRadiusM);
  const exhausted = netDrawW > 0 && availableS <= dt + 1e-10;
  return { xM, zM, headingRad: heading, ...terrainPose(xM, zM, heading, c.terrain),
    wheelAngleRad: s.wheelAngleRad + centerRotation,
    leftWheelAngleRad: s.leftWheelAngleRad + centerRotation + differentialRotation,
    rightWheelAngleRad: s.rightWheelAngleRad + centerRotation - differentialRotation,
    speedMps: exhausted ? 0 : speed, steer: exhausted ? 0 : steer,
    distanceM: s.distanceM + Math.abs(speed) * seconds, elapsedS: s.elapsedS + seconds,
    batteryWh: Math.min(c.capacityWh, Math.max(0, unconstrainedWh)),
    driveWh: s.driveWh + driveW * h, hotelWh: s.hotelWh + c.hotelW * h,
    solarWh: s.solarWh + c.solarW * h, curtailedWh: s.curtailedWh + Math.max(0, unconstrainedWh - c.capacityWh),
    status: exhausted ? 'battery reserve' : speed === 0 && yawRate === 0 ? 'idle' : 'driving' };
}

function checkState(s, c) {
  checkPoint(s, c.terrain);
  for (const key of ['yM', 'headingRad', 'pitchRad', 'rollRad', 'slopeRad', 'wheelAngleRad', 'leftWheelAngleRad',
    'rightWheelAngleRad', 'speedMps', 'steer', 'distanceM', 'elapsedS', 'batteryWh', 'driveWh', 'hotelWh', 'solarWh', 'curtailedWh']) {
    if (!Number.isFinite(s[key])) throw new RangeError('Nonfinite state field ' + key);
  }
  for (const key of ['distanceM','elapsedS','driveWh','hotelWh','solarWh','curtailedWh']) {
    if (s[key] < 0) throw new RangeError('Negative state field ' + key);
  }
  range(s.batteryWh, 0, c.capacityWh, 'batteryWh');
  if (!statuses.includes(s.status)) throw new RangeError('Unknown traverse state status');
}

export function stepTraverse(s, command, dtS, c) {
  checkConfig(c);
  checkState(s, c);
  range(dtS, 0, 2, 'dtS');
  const throttle = range(command.throttle, -1, 1, 'throttle');
  const steer = range(command.steer, -1, 1, 'steer');
  if (c.world === 'Orbit') return stopped(s, 'orbital free fall');
  if (dtS === 0) return { ...s };
  // Equal bounded substeps keep the slope and turn integration stable on nonplanar terrain.
  const steps = Math.ceil(dtS / 0.25);
  let next = s;
  for (let i = 0; i < steps; i++) {
    next = microstep(next, throttle, steer, dtS / steps, c);
    if (stopStatuses.includes(next.status)) break;
  }
  return next;
}

export function runRoute(c, waypoints, options = {}) {
  checkConfig(c);
  if (!Array.isArray(waypoints) || !waypoints.length || waypoints.length > 64) throw new RangeError('Route requires 1–64 waypoints');
  for (const point of waypoints) checkPoint(point, c.terrain);
  const dt = range(options.dtS ?? 0.5, 0.05, 2, 'route dtS');
  const limit = range(options.maxTimeS ?? 3600, 0, 86400, 'maxTimeS');
  const tolerance = range(options.toleranceM ?? 0.15, 0.01, 5, 'toleranceM');
  if (Math.ceil(limit / dt) > 100000) throw new RangeError('Route exceeds the 100000-step telemetry limit');
  let state = createTraverse(c, options.start);
  const track = [state];
  let reached = 0;
  let status = 'time limit';
  while (reached < waypoints.length) {
    const goal = waypoints[reached];
    const dx = goal.xM - state.xM;
    const dz = goal.zM - state.zM;
    const distance = Math.hypot(dx, dz);
    if (distance <= tolerance) { reached++; continue; }
    if (state.elapsedS >= limit - 1e-9) break;
    const timestep = Math.min(dt, limit - state.elapsedS);
    const turn = angle(Math.atan2(dx, dz) - state.headingRad);
    let throttle = 0;
    let steer = 0;
    if (Math.abs(turn) > 1e-5) {
      steer = Math.sign(turn) * Math.min(1, Math.abs(turn) / (timestep * c.turnRateRadS));
    } else {
      const planarSpeed = c.speedMps * (1 - c.slipFraction) * Math.cos(state.pitchRad);
      throttle = Math.min(1, distance / (timestep * planarSpeed));
    }
    const next = stepTraverse(state, { throttle, steer }, timestep, c);
    if (next.elapsedS > state.elapsedS) track.push(next);
    state = next;
    if (stopStatuses.includes(state.status)) {
      while (reached < waypoints.length &&
        Math.hypot(waypoints[reached].xM - state.xM, waypoints[reached].zM - state.zM) <= tolerance) reached++;
      status = state.status;
      break;
    }
  }
  if (reached === waypoints.length) status = 'route complete';
  state = stopped(state, status);
  track[track.length - 1] = state;
  return { state, track, waypointsReached: reached, status };
}
