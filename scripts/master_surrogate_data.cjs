// Whole-run partitions and target curves from the existing exact sealed-strip solver.
const {defaults,trainingDomain,atTime,liquidInputs,chemistry}=require('../site/physics-lab');
let state=0;
const random=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};
function partition(count,seed){
  state=seed;
  return Array.from({length:count},()=>{
    const s={...defaults,fuel:random()<.5?'cellulose':'polyethylene'};
    for(const [key,[a,b]] of Object.entries(trainingDomain))s[key]=a+(b-a)*random();
    const c=chemistry(s.fuel),n0=s.pressure*1000*s.volume/(8.31446261815324*300);
    return {inputs:liquidInputs(s),initial:s.oxygen,cutoff:s.cutoff,fuel:s.fuel,
      maxFraction:s.length*s.density*c.oxygen/(n0*c.molarMass),
      rateFraction:s.speed*s.density*c.oxygen/(n0*c.molarMass),
      drop:Array.from({length:60},(_,i)=>s.oxygen-atTime(s,2*(i+1)).oxygen)};
  });
}
process.stdout.write(JSON.stringify({train:partition(640,664118),validation:partition(96,286021),test:partition(160,920372)}));
