import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDestinations,searchDestinations,resolveDestination} from './finder.mjs';
import {driveFields} from './workbench.mjs';
const json=name=>JSON.parse(readFileSync(new URL('../'+name,import.meta.url)));
const catalog=json('parts.json'),schema=json('scenario.schema.json');
const partNames=Object.fromEntries(catalog.parts.map(p=>[p.slot,p.slot]));
const items=buildDestinations({catalog,schema,partNames,driveFields,metricGroups:[['air','Cabin atmosphere',[['initialO2KPa','Oxygen partial pressure','kPa']]]]});

test('every catalog part and condition has a unique address, independent of the current scenario',()=>{
  assert.equal(new Set(items.map(i=>i.path)).size,items.length);
  for(const p of catalog.parts) assert.equal(resolveDestination(items,'#assembly/part/'+p.id).item.part,p);
  for(const key of Object.keys(schema.properties.conditions.properties)) assert.equal(resolveDestination(items,'#conditions/'+key).item.target,'#field-'+key);
  for(const key of Object.keys(driveFields)) assert.equal(resolveDestination(items,'#workbench/drive/'+key).item.target,'#drive-'+key);
});
test('search ranks exact names above related controls and can match across number, unit, source and scope',()=>{
  assert.equal(searchDestinations(items,'OPEN CREW DECK')[0].path,'assembly/part/open-deck');
  assert.equal(searchDestinations(items,'Cútaway view')[0].path,'workbench/layer/cutaway');
  assert.ok(searchDestinations(items,'oxygen kpa').some(i=>i.path==='results/air'));
  assert.ok(searchDestinations(items,'JAXA habitat').some(i=>i.path==='assembly/part/mobile-hab'));
  assert.ok(searchDestinations(items,'jezero persev').some(i=>i.path==='workbench/route-plan'));
  assert.deepEqual(searchDestinations(items,'xyzxyzxyz'),[]);
});
test('fresh links resolve deterministically and shared searches survive URL encoding',()=>{
  for(const path of ['review/sources','assembly','workbench/route-plan','workbench/cabin-test','workbench/field-comparison']) {
    const route=resolveDestination(items,'#'+path);assert.equal(route.item.path,path);assert.equal(route.view,path.split('/')[0]);
  }
  assert.deepEqual(resolveDestination(items,'#find?q=Solar+power+%26+drive'),{view:'workbench',query:'Solar power & drive'});
  assert.equal(resolveDestination(items,'#find').query,'');
  for(const hash of ['','#__proto__','#%zz'])assert.equal(resolveDestination(items,hash).view,'workbench');
  assert.equal(resolveDestination(items,'#assembly/nonexistent').item,undefined);
});
