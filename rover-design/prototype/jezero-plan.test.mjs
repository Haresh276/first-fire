import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {simulate,setEnvironment} from './model.mjs';
import {makeTraverseConfig,runRoute} from './traverse.mjs';

const read = file => JSON.parse(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
const plan=read('examples/jezero-sol15-plan.json');
const schema=read('scenario.schema.json');
const parts=read('parts.json');
const close=(a,b)=>assert.ok(Math.abs(a-b)<0.0006,`${a} differs from ${b}`);

test('the shareable Mars plan uses the archived waypoint reference and supported route format',()=>{
  const routeSchema=read('route-plan.schema.json');
  for(const key of routeSchema.required)assert.ok(Object.hasOwn(plan,key));
  assert.equal(plan.format,routeSchema.properties.format.const);
  assert.equal(plan.scenario.conditions.world,'Mars');
  assert.equal(plan.terrain,'flat');
  assert.equal(plan.preset,'jezero');
  assert.deepEqual(plan.waypoints,read('terrain/jezero-route.json').waypoints);
});

test('day and night Jezero runs reproduce the worked chapter with identical commanded mobility',()=>{
  const run=phase=>{
    const scenario=setEnvironment(plan.scenario,'Mars',phase);
    const inputs=makeTraverseConfig(scenario,simulate(scenario,parts,schema),{...plan.overrides,terrain:plan.terrain});
    const route=runRoute(inputs,plan.waypoints,{dtS:0.25,maxTimeS:3600});
    assert.equal(route.waypointsReached,3);
    assert.equal(route.state.status,'route complete');
    return route.state;
  };
  const day=run('day'),night=run('night');
  for(const state of [day,night]){
    close(state.elapsedS,40.5);close(state.distanceM,36.295);
    close(state.driveWh,4.421);close(state.hotelWh,5.625);
  }
  close(day.batteryWh,2992.485);close(night.batteryWh,2989.954);
  close(day.batteryWh-night.batteryWh,225*40.5/3600);
  close(day.solarWh,2.531);assert.equal(night.solarWh,0);
});
