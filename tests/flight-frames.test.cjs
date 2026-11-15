const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const {measure,checkSequence,bandContour}=require('../site/flight-frames-ui.js');
const site=path.join(__dirname,'../site');
const baseline=JSON.parse(fs.readFileSync(path.join(site,'front-example.json')));
const clone=()=>structuredClone(baseline);
function inputs(d,i=0) {
  return {images:d.frames.slice(i,i+2).map(f=>({id:f.id,width:f.width,height:f.height,computedSha256:f.sha256})),
    points:[{x:400,y:700},{x:412,y:695}]};
}
test('all five native NASA image files and archive identifiers agree with the manifest',()=>{
  checkSequence(baseline);
  for(const f of baseline.frames){
    const bytes=fs.readFileSync(path.join(site,f.file));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),f.sha256);
    assert.equal(bytes.length,f.bytes);
    assert.equal(f.timeSeconds,(f.acquisitionCount-baseline.clock.firstCount)/baseline.clock.framesPerSecond);
  }
});
test('signed pixel components and camera interval come from the matching frame pair',()=>{
  const d=clone(),{points,images}=inputs(d);
  const r=measure(d,0,points,images);
  assert.deepEqual(r.pixels,{dx:12,dy:-5,distance:13});assert.equal(r.seconds,59/30);
  assert.equal(r.pixelsPerSecond,13/(59/30));assert.equal(r.millimetres,null);assert.equal(r.millimetresPerSecond,null);
  assert.equal(r.frames[1].member,d.frames[1].member);assert.equal(r.frames[0].verification,'decoded bytes match manifest SHA-256');
  assert.equal(r.calibration.sha256,d.calibration.sha256);
});
test('never translate filenames, unverified metadata, unknown registration or an unlocated scalar into mm/s',()=>{
  const d=clone(),{points,images}=inputs(d);
  d.clock.status='unverified';d.calibration.mmPerPixel=.1;
  let r=measure(d,0,points,images);assert.equal(r.seconds,null);assert.equal(r.millimetres,null);
  d.calibration.status='verified';d.calibration.locator='';
  r=measure(d,0,points,images);assert.equal(r.millimetres,null);
  d.clock.status='verified';d.calibration.locator='test-only registered scale';d.calibration.regionPx={xMin:0,xMax:399,yMin:0,yMax:800};
  assert.equal(measure(d,0,points,images).millimetres,null);
  d.calibration.regionPx.xMax=500;r=measure(d,0,points,images);assert.equal(r.millimetres.distance,1.3);assert.equal(r.millimetresPerSecond,1.3/(59/30));
  d.frames[1].timeSeconds=0;r=measure(d,0,points,images);assert.equal(r.seconds,null);assert.equal(r.millimetresPerSecond,null);
});
test('reject out-of-bounds and stale points, mismatched views or dimensions and altered bytes',()=>{
  const d=clone(),{points,images}=inputs(d);
  const run=()=>measure(d,0,points,images);
  points[0].x=d.frames[0].width;assert.throws(run,/inside/);points[0].x=0;
  images[0].id='another';assert.throws(run,/another frame/);images[0].id=d.frames[0].id;
  images[0].width+=1;assert.throws(run,/dimensions/);images[0].width-=1;
  d.frames[1].camera='different';assert.throws(run,/camera/);delete d.frames[1].camera;
  images[0].computedSha256='a'.repeat(64);assert.throws(run,/checksum/);
  images[0].computedSha256=null;assert.match(run().frames[0].verification,/manifest SHA-256 only/);
  d.frames[0].file='flight-frames/../data/raw';assert.throws(run,/unsafe/);
});
test('rightmost qualifying pixel uses a horizontal profile averaged over the selected rows',()=>{
  const width=12,height=4,data=new Uint8ClampedArray(width*height*4);
  for(const y of [1,2])for(const [x,signal] of [[4,12],[5,24],[6,12],[9,4]])data[4*(y*width+x)]=signal;
  const conf={nativeX:[2,9],nativeY:[1,2],boxcarWidthPx:1,fractionOfFramePeak:.5};
  assert.equal(bandContour({width,height,data},conf),6);
  conf.boxcarWidthPx=3;assert.equal(bandContour({width,height,data},conf),6);
  data.fill(0);assert.throws(()=>bandContour({width,height,data},conf),/positive/);
});
