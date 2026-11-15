import * as T from './vendor/three.module.min.js';
import {engineeringOverlay} from './overlays.mjs';

const colors = {
  ceramic: 0xe3e5dc, silver: 0xb6c2c2, white: 0xf5f2df, graphite: 0x313b40,
  shadow: 0x17232d, rubber: 0x333536, steel: 0x7b878b, glass: 0x24475c,
  blue: 0x2c5484, cell: 0x293d69, bus: 0x91a3bb, brass: 0xc6a96a,
  foil: 0xd7ae56, orange: 0xd46c39, teal: 0x669d9b, red: 0xad5144,
  fabric: 0xdfcba9, green: 0x697c62, lens: 0x3e7286, lamp: 0xffe6aa
};
const V = (a) => new T.Vector3(...a);
const vY = new T.Vector3(0,1,0);

function tools(group, materials) {
  function put(geometry,color,x=0,y=0,z=0) {
    if (!materials.has(color)) {
      const metal=['silver','steel','brass','foil','bus','graphite'].includes(color);
      const m=new T.MeshStandardMaterial({color:colors[color],metalness:metal?0.48:0.12,
        roughness:['glass','lens','cell'].includes(color)?0.23:metal?0.53:0.76,
        side:T.DoubleSide});
      m.userData.finish=color;
      if(color==='glass'){
        m.roughness=.40;m.metalness=.19;m.emissive.setHex(0x182e3a);
      }
      if(color==='lamp') m.emissive.setHex(0xd69840).multiplyScalar(0.26);
      m.userData.baseColor=m.color.clone();
      m.userData.baseGlow=m.emissive.clone();
      materials.set(color,m);
    }
    const mesh=new T.Mesh(geometry,materials.get(color));
    mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
  }
  const box=(x,y,z,w,h,d,col)=>put(new T.BoxGeometry(w,h,d),col,x,y,z);
  function bar(a,b,r,col,n=8) {
    const start=V(a),end=V(b),axis=end.clone().sub(start);
    const mesh=put(new T.CylinderGeometry(r,r,axis.length(),n),col);
    mesh.position.copy(start).lerp(end,0.5);mesh.quaternion.setFromUnitVectors(vY,axis.normalize());return mesh;
  }
  function cyl(x,y,z,r,h,col,axis='y',n=20) {
    const mesh=put(new T.CylinderGeometry(r,r,h,n),col,x,y,z);
    if(axis==='x')mesh.rotation.z=Math.PI/2;
    if(axis==='z')mesh.rotation.x=Math.PI/2;
    return mesh;
  }
  function ring(x,y,z,r,t,col,axis='x',n=30) {
    const mesh=put(new T.TorusGeometry(r,t,7,n),col,x,y,z);
    if(axis==='x')mesh.rotation.y=Math.PI/2;
    if(axis==='y')mesh.rotation.x=Math.PI/2;
    return mesh;
  }
  function plate(points,col) {
    const g=new T.BufferGeometry(),positions=[];
    for (let i=1;i<points.length-1;i++) positions.push(...points[0],...points[i],...points[i+1]);
    g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeVertexNormals();return put(g,col);
  }
  function inset(points,ratio,col) {
    const center=points.map(V).reduce((a,b)=>a.add(b),new T.Vector3()).multiplyScalar(1/points.length);
    return plate(points.map(p=>V(p).lerp(center,ratio).toArray()),col);
  }
  function trim(points,r,col) {
    for(let i=0;i<points.length;i++) bar(points[i],points[(i+1)%points.length],r,col);
  }
  return {box,bar,cyl,ring,plate,inset,trim,put};
}

// Merge rigid pieces by finish so a wheel with thirty grousers has only a few draw calls.
function batch(group) {
  const byMaterial=new Map();
  for(const mesh of [...group.children]){
    if(!mesh.isMesh)continue;
    if(!byMaterial.has(mesh.material))byMaterial.set(mesh.material,[]);
    byMaterial.get(mesh.material).push(mesh);
  }
  for(const [material,meshes] of byMaterial){
    if(meshes.length===1)continue;
    const positions=[], normals=[];
    for(const mesh of meshes){
      mesh.updateMatrix();
      const geometry=mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrix);
      for(const value of geometry.attributes.position.array)positions.push(value);
      for(const value of geometry.attributes.normal.array)normals.push(value);
      mesh.geometry.dispose();geometry.dispose();group.remove(mesh);
    }
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
    const mesh=new T.Mesh(g,material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
}
function chair(d,x,y,z) {
  const {box,bar}=d;
  box(x,y,z,0.42,0.11,0.43,'graphite');
  const back=box(x,y+0.25,z-0.21,0.42,0.52,0.095,'graphite');back.rotation.x=-0.13;
  box(x,y+0.54,z-0.245,0.26,0.15,0.09,'shadow');
  bar([x,y-0.27,z],[x,y,z],0.055,'steel');
  for(const sign of [-1,1])bar([x+sign*.19,y+.07,z-.17],[x+sign*.19,y+.37,z-.21],.021,'fabric');
}

function buildCabin(d,id,cover,makeTools){
  const {box,bar,cyl,plate,trim}=d;
  const half=id==='research-pod'?0.77:0.92, floor=1.06;
  const zRear=id==='research-pod'?-0.89:-1.18, roof=id==='research-pod'?2.26:2.50;
  const f=1.12, roofFront=.60;
  box(0,floor,0,2*half,.12,2.45,'silver');
  if(id==='open-deck'){
    for(const side of [-1,1]){
      chair(d,side*.43,1.47,.34);
      for(const z of [-.99,.03,.96])bar([side*.93,1.08,z],[side*.93,1.53,z],.037,'silver');
      bar([side*.93,1.54,-1.07],[side*.93,1.54,1.04],.04,'orange');
      box(side*.42,1.2,-.73,.64,.21,.48,'steel');
    }
    box(0,1.55,.91,.46,.34,.12,'graphite');box(0,1.59,.845,.32,.15,.014,'lens');
    return;
  }
  // Fixed lower sill and cabin walls. Glazing and roof form the removable service shell.
  const shell=makeTools(cover), low=1.61;
  // Hollow chassis tub keeps the occupied floor and internal hardware visible in section.
  const bodyDepth=f-zRear,mid=(f+zRear)/2;
  for(const side of [-1,1])box(side*(half-.032),1.32,mid,.064,.47,bodyDepth,'ceramic');
  box(0,1.32,f-.033,half*2,.47,.066,'ceramic');
  box(0,1.32,zRear+.033,half*2,.47,.066,'ceramic');
  for(const x of [-.7,-.1,.55])box(x,1.127,-.13,.022,.012,1.93,'graphite');
  box(0,1.1,.02,half*2+.05,.10,f-zRear+.04,'graphite');
  for(const side of [-1,1]){
    const x=side*half;
    const sidePoints=[[x,low,zRear],[x,roof-.20,zRear],[x,roof,zRear+.24],[x,roof,roofFront],[x,1.69,f],[x,low,f]];
    shell.plate(sidePoints,'white');
    const wx=x+side*.014;
    const windows=id==='research-pod'?
      [[[-.48,1.79],[-.46,roof-.14],[.39,roof-.14],[.58,1.79]]]:
      [[[-.89,1.76],[-.86,2.27],[-.23,2.32],[-.23,1.75]],[[-.12,1.74],[-.12,2.33],[.50,2.33],[.86,1.76]]];
    for(const shape of windows){
      const window=shape.map(([z,y])=>[wx,y,z]);
      shell.plate(window,'glass');shell.trim(window,.027,'graphite');
    }
    // Grab rails, panel seams and fasteners.
    bar([x+side*.055,1.54,zRear+.16],[x+side*.055,1.54,.82],.022,'orange');
    for(const z of [zRear+.18,-.3,.38,.81])cyl(x+side*.008,1.2,z,.018,.023,'steel','x',8);
    chair(d,side*.41,1.48,.25);
    box(side*.54,1.37,-.69,.38,.45,.36,'steel');
    const outside=x+side*.018;
    // Service covers with seams, latches and a narrow reflective band.
    box(outside,1.31,-.45,.035,.29,.67,'silver');
    box(outside+side*.02,1.30,-.45,.012,.24,.62,'ceramic');
    for(const z of [-.66,-.24])box(outside+side*.031,1.39,z,.020,.032,.075,'graphite');
    for(let i=0;i<4;i++)box(outside+side*.017,1.30,.26+i*.115,.022,.055,.065,'orange');

  }
  shell.box(0,roof-.035,(zRear+.2+roofFront)/2,2*half,.095,roofFront-zRear-.2,'ceramic');
  shell.plate([[-half,roof-.2,zRear],[-half,roof,zRear+.24],[half,roof,zRear+.24],[half,roof-.2,zRear]],'ceramic');
  shell.box(0,(low+roof-.2)/2,zRear,half*2,roof-.2-low,.085,'ceramic');
  const wind=[[-half,low,f],[half,low,f],[half,roof,roofFront],[-half,roof,roofFront]];
  shell.plate(wind,'white');
  for(const side of [-1,1]){
    const xs=[side*.055,side*(half-.08)];
    const front=xs.map(x=>[x,1.76,f-(1.76-low)*(f-roofFront)/(roof-low)+.018]);
    const top=xs.map(x=>[x,roof-.12,roofFront+.12*(f-roofFront)/(roof-low)+.018]);
    const pane=[front[0],front[1],top[1],top[0]];
    shell.plate(pane,'glass');shell.trim(pane,.027,'graphite');
    box(side*.68,1.48,f+.048,.31,.12,.055,'graphite');box(side*.68,1.49,f+.08,.215,.056,.014,'lamp');
  }
  for(let i=0;i<10;i++)box(-.25+i*.055,1.26,f+.009,.025,.082,.022,'steel');
  for(const side of [-1,1]){
    const x=side*.68;
    bar([x-.19,1.41,f+.086],[x+.19,1.41,f+.086],.012,'steel');
    bar([x+.19,1.41,f+.086],[x+.19,1.56,f+.086],.012,'steel');
  }
  box(0,1.52,.79,1.4,.17,.33,'shadow');
  for(const x of [-.43,.13])box(x,1.62,.79,.34,.025,.17,'lens');
  if(id==='research-pod'){
    for(const z of [-.58,.26]) {
      shell.bar([-half,roof+.045,z],[half,roof+.045,z],.043,'teal');
      for(const side of [-1,1])shell.bar([side*(half+.025),1.66,z],[side*(half+.025),roof,z],.032,'teal');
    }
  }
}
function buildChassis(d,id) {
  const {box,bar}=d,bench=id==='bench-frame',length=bench?1.5:1.76;
  box(0,.84,0,2.12,.14,length*2,'silver');
  for(const x of [-.85,.85]){
    bar([x,.63,-length],[x,.63,length],.081,bench?'teal':'graphite');
    for(const z of [-length,-.5,.50,length])bar([x,.63,z],[x,.88,z],.054,'steel');
    const steps=bench?3:5;
    for(let i=0;i<steps;i++){
      const z=-length+(i*2*length/steps),n=z+2*length/steps;
      bar([x,.63,z],[x,.85,n],.039,bench?'steel':'brass');
    }
  }
  for(const z of [-length,0,length])bar([-.98,.66,z],[.98,.66,z],.055,'steel');
  for(const s of [-1,1])bar([s*.8,.83,length+.04],[s*.66,1.00,length+.17],.04,'orange');
  bar([-.66,.99,length+.17],[.66,.99,length+.17],.041,'orange');
  box(0,.93,-1.28,1.46,.16,.58,'foil');
}

function makeWheels(d,id,group,makeTools,dimensions){
  const {count,width,length}=dimensions;
  const wheelRadius=.47;
  const pivots=[];
  const {bar,cyl}=d;
  const perSide=Math.floor(count/2);
  const frontZ=count%2===1?1.08:1.37;
  const mounts=[];
  for(const side of [-1,1]){
    for(let i=0;i<perSide;i++){
      const z=perSide===1?(count===3?-.54:0):(-1.37+(frontZ+1.37)*i/(perSide-1));
      mounts.push({side,x:side*1.21*width,z:z*length});
    }
    cyl(side*.95*width,.82,0,.15,.14,'steel','x');
  }
  if(count%2===1)mounts.push({side:1,x:0,z:(count===3?1.15:1.85)*length});
  for(const {side,x,z} of mounts){
      const anchor=x===0?0:side*.85*width;
      bar([anchor,.84,z*.64],[x,.49,z],.062,'steel');
      bar([anchor*.96,.74,z*.54],[x,.47,z],.043,'graphite');
      const steer=new T.Group(),spin=new T.Group();steer.position.set(x,wheelRadius,z);
      steer.add(spin);group.add(steer);
      const b=makeTools(spin);
      const rim=id==='mesh-set', grouser=id==='grouser-set', highway=id==='four-wheel';
      b.cyl(0,0,0,rim?.433:.454,.32,rim?'steel':highway?'rubber':'graphite','x',32);
      for(const dx of [-.146,.146]) b.ring(dx,0,0,.414,.033,'steel');
      const outer=side*.177;
      if(rim){
        for(let j=0;j<16;j++){
          const n=j*Math.PI/8,m=n+.20;
          b.bar([-.16,.447*Math.cos(n),.447*Math.sin(n)],[.16,.447*Math.cos(m),.447*Math.sin(m)],.014,'silver',5);
          b.bar([-.16,.447*Math.cos(m),.447*Math.sin(m)],[.16,.447*Math.cos(n),.447*Math.sin(n)],.012,'silver',5);
        }
      } else {
        const treads=grouser?12:highway?20:25;
        for(let j=0;j<treads;j++){
          const a=j*2*Math.PI/treads;
          const y=wheelRadius*Math.cos(a),z1=wheelRadius*Math.sin(a);
          if(highway||grouser){
            const lug=b.box(0,y,z1,.35,grouser?.054:.034,grouser?.084:.066,grouser?'brass':'shadow');
            lug.rotation.x=a;
          } else {
            const prev=a-.070;
            for(const end of [-.15,.15]) b.bar([0,y,z1],[end,wheelRadius*Math.cos(prev),wheelRadius*Math.sin(prev)],.018,'steel',5);
          }
        }
      }
      b.cyl(outer,0,0,.257,.04,'shadow','x');
      const spokes=rim?10:grouser?5:6;
      for(let j=0;j<spokes;j++){
        const a=j*Math.PI*2/spokes;
        b.bar([outer,0,0],[outer,.265*Math.cos(a),.265*Math.sin(a)],.027,'silver');
        b.cyl(outer+side*.03,.207*Math.cos(a),.207*Math.sin(a),.023,.022,'brass','x',7);
      }
      b.cyl(outer+side*.032,0,0,.112,.049,'silver','x');b.cyl(outer+side*.065,0,0,.061,.03,'orange','x');
      batch(spin);pivots.push({steer,spin,z,center:x===0});
  }
  return pivots;
}

function panel(d,x,y,z,w,depth) {
  // A shallow pitch exposes the module face while keeping both arrays rigid on the rear rack.
  const pitch=.21,c=Math.cos(pitch),s=Math.sin(pitch);
  function cell(dx,dy,dz,dw,dh,dd,color){
    const mesh=d.box(x+dx,y+c*dy-s*dz,z+s*dy+c*dz,dw,dh,dd,color);
    mesh.rotation.x=pitch;
  }
  cell(0,0,0,w,.065,depth,'silver');
  cell(0,.045,0,w-.055,.022,depth-.055,'cell');
  for(let col=1;col<6;col++)cell(w*(col/6-.5),.058,0,.011,.006,depth-.055,'bus');
  for(let row=1;row<10;row++)cell(0,.059,depth*(row/10-.5),w-.055,.006,.011,'bus');
}
function services(slot,id,d,cabin) {
  const {box,cyl,ring,bar,plate}=d;
  const roof=cabin==='open-deck'?1.93:cabin==='research-pod'?2.34:2.57;
  if(slot==='power'){
    box(0,1.03,-1.48,1.48,.33,.50,'graphite');
    for(const side of [-1,1]){
      box(side*.38,1.09,-1.52,.58,.26,.46,'steel');
      box(side*.38,1.235,-1.48,.41,.02,.22,'foil');
      box(side*.60,1.19,-1.76,.10,.07,.08,'orange');
    }
    if(id==='solar-pack'){
      const h=roof+.22;
      for(const side of [-1,1]){
        bar([side*.76,1.21,-1.58],[side*.76,h-.05,-1.10],.042,'graphite');
        bar([side*.63,roof-.05,-.62],[side*.92,h,-.54],.043,'steel');
        panel(d,side*.62,h,-.51,1.15,1.30);
      }
    }
  }
  if(slot==='thermal') {
    box(-1.00,1.74,-.23,.10,.74,1.46,'graphite');
    for(let n=0;n<12;n++)box(-1.075,1.74,-.86+n*.115,.08,.63,.062,'silver');
    for(const z of [-.86,.36])bar([-1.12,1.43,z],[-1.12,2.055,z],.02,'brass');
    if(id==='shade'){
      const shade=box(-1.25,2.14,-.22,.51,.042,1.61,'white');shade.rotation.z=-.12;
      for(const z of [-.77,.32])bar([-1.0,1.84,z],[-1.45,2.12,z],.018,'steel');
    }
  }
  if(slot==='lifeSupport'){
    if(id==='scrubber'){
      box(.58,1.71,-.85,.42,.45,.45,'teal');
      for(let n=0;n<6;n++)box(.58,1.58+.055*n,-.609,.32,.021,.025,'graphite');
      bar([.43,1.91,-.8],[.43,2.04,-.8],.034,'silver');
      bar([.43,2.04,-.8],[.76,2.04,-.8],.034,'silver');
    }else{
      for(const x of [.48,.73]){
        cyl(x,1.74,-.8,.103,.48,'teal');cyl(x,1.99,-.8,.043,.08,'brass');
        for(const y of [1.59,1.86])ring(x,y,-.8,.104,.012,'shadow','y');
      }
    }
  }
  if(slot==='access'){
    if(id==='lock'){
      const rear=cabin==='research-pod'?-.96:-1.24;
      cyl(0,1.79,rear,.47,.20,'graphite','z',32);cyl(0,1.79,rear-.13,.40,.07,'ceramic','z',32);
      ring(0,1.79,rear-.17,.32,.035,'steel','z');
      cyl(0,1.79,rear-.195,.09,.04,'orange','z');
      for(const side of [-1,1])bar([side*.54,1.36,rear-.12],[side*.54,1.99,rear-.12],.026,'brass');
    }else{
      for(const x of [-.36,.36]){
        box(x,1.72,-1.26,.47,.72,.20,'steel');ring(x,1.77,-1.38,.197,.04,'teal','z');
        box(x,1.49,-1.41,.22,.18,.13,'white');
      }
    }
  }
  if(slot==='detection' && id==='sample'){
    box(-.44,1.96,-.12,.17,.115,.15,'white');
    cyl(-.44,1.895,-.12,.053,.04,'graphite');
    bar([-.44,1.99,-.12],[-.44,2.08,-.12],.015,'steel');
    bar([-.44,2.08,-.12],[-.77,2.08,-.12],.015,'steel');
  }
  if(slot==='suppression' && id==='mist'){
    cyl(-.63,1.67,-.71,.118,.41,'red');
    ring(-.63,1.64,-.71,.12,.016,'steel','y');
    cyl(-.63,1.9,-.71,.046,.11,'brass');bar([-.68,1.956,-.71],[-.55,1.956,-.71],.022,'graphite');
    bar([-.55,1.956,-.71],[-.48,1.88,-.74],.016,'graphite');
  }
  if(slot==='material'){
    box(.61,1.6,-.29,.47,.053,.31,'graphite');
    if(id==='cellulose'){
      for(let n=0;n<3;n++)box(.61+n*.009,1.637+n*.012,-.29,.31,.011,.22,'fabric');
    }else if(id==='pe'){
      box(.61,1.65,-.29,.35,.055,.19,'white');box(.61,1.684,-.29,.27,.01,.11,'teal');
    }else {
      for(let n=0;n<4;n++)box(.61,1.64+n*.013,-.29,.34,.012,.22,n%2?'brass':'graphite');
    }
  }
  if(slot==='payload'){
    const x=.76,z=1.42;
    if(id==='apxs'){
      const joints=[[x,1.01,z],[1.12,1.32,1.59],[1.27,1.02,2.06],[1.17,.83,2.23]];
      for(let i=1;i<joints.length;i++)bar(joints[i-1],joints[i],i<3?.075:.052,i%2?'brass':'silver');
      for(const j of joints)cyl(...j,.106,.15,'steel','x');
      cyl(1.17,.82,2.27,.102,.18,'graphite','z');ring(1.17,.82,2.365,.077,.013,'silver','z');
    }else if(id==='cargo'){
      box(.16,1.14,1.49,.99,.46,.45,'green');box(.16,1.39,1.49,1,.05,.48,'steel');
      for(const dx of [-.31,.31])box(.16+dx,1.2,1.73,.056,.30,.023,'foil');
    }else if(id==='met-suite'){
      cyl(x,1.96,z,.042,1.85,'silver');cyl(x,2.78,z,.10,.16,'white');
      for(const side of [-1,1]) {
        bar([x,2.47,z],[x+side*.34,2.42,z],.028,'steel');
        cyl(x+side*.34,2.43,z,.066,.11,'foil');
      }
      cyl(x,1.1,z,.18,.19,'graphite');
    }else if(id==='nav-camera'){
      cyl(x,1.64,z,.072,1.25,'silver');box(x,2.27,z,.78,.22,.21,'ceramic');
      for(const side of [-1,1]) {
        cyl(x+side*.25,2.28,z+.12,.084,.085,'graphite','z');cyl(x+side*.25,2.28,z+.17,.056,.018,'lens','z');
      }
    }else if(id==='drill'){
      box(x,1.48,z,.28,.9,.28,'foil');cyl(x,1.03,z,.094,.68,'graphite');
      for(let i=0;i<7;i++)ring(x,.78+i*.057,z,.095,.019,'silver','y',16);
      cyl(x,1.95,z,.135,.09,'steel');
    }else{
      box(x,1.27,z,.55,.55,.46,'ceramic');cyl(x,1.58,z,.15,.12,'graphite');
      bar([x,1.25,z+.23],[x,1.01,z+.55],.082,'steel');
      plate([[x-.14,.98,z+.48],[x+.14,.98,z+.48],[x+.21,.91,z+.78],[x-.21,.91,z+.78]],'foil');
    }
  }
}

function nameplates(group,cabin) {
  if(cabin==='open-deck')return;
  const image=document.createElement('canvas');image.width=512;image.height=112;
  const ctx=image.getContext('2d');
  ctx.fillStyle='#df733f';ctx.fillRect(3,27,12,55);
  ctx.fillStyle='#263b3e';ctx.font='700 48px Arial';ctx.fillText('FIRST FIRE',32,62);
  ctx.fillStyle='#667679';ctx.font='500 20px Arial';ctx.fillText('MOBILE RESEARCH LABORATORY',34,93);
  const tex=new T.CanvasTexture(image);tex.colorSpace=T.SRGBColorSpace;
  const mat=new T.MeshBasicMaterial({map:tex,transparent:true,alphaTest:.025,depthWrite:false});
  const width=cabin==='research-pod'?.77:.92;
  for(const side of [-1,1]){
    const tag=new T.Mesh(new T.PlaneGeometry(.70,.154),mat);
    tag.rotation.y=side*Math.PI/2;tag.position.set(side*(width+.043),1.28,-.47);
    tag.userData.decal=true;group.add(tag);
  }
}

const explodedOffsets={
  cabin:[0,1.24,0],chassis:[0,0,0],wheels:[0,-.11,0],power:[0,1.47,-1.41],
  thermal:[-.99,.07,0],lifeSupport:[1.15,.51,-.57],access:[0,.05,-1.35],
  detection:[-.58,1.43,.20],suppression:[-.79,.45,-.58],material:[1.24,.53,.44],payload:[.34,.06,.89]
};
// Nominal geometry is schematic. Scale the contact geometry to the stated drive
// dimensions within display limits; the numeric mobility model retains the original inputs.
export function displayDimensions(count,requestedRadius=.47,requestedTrack=2.42) {
  const radius=T.MathUtils.clamp(requestedRadius,.15,.95),scale=radius/.47;
  const width=T.MathUtils.clamp(requestedTrack/(2.42*scale),.68,1.75);
  const length=Math.max(1,(Math.floor(count/2)-1)*1.02/2.74);
  const track=width*scale*2.42;
  return {count,scale,width,length,radius,track,
    limited:Math.abs(radius-requestedRadius)>1e-7||Math.abs(track-requestedTrack)>1e-7};
}
export function buildHardware(parts,dimensions){
  const root=new T.Group(),slots={},mats={},cover=new T.Group();
  let pivots=[];
  for(const [slot,id] of Object.entries(parts)){
    const group=new T.Group(),materials=new Map();
    group.userData.slot=slot;root.add(group);slots[slot]=group;mats[slot]=materials;
    if(slot!=='wheels')group.scale.set(dimensions.width,1,dimensions.length);
    const makeTools=g=>tools(g,materials),d=makeTools(group);
    if(slot==='cabin'){group.add(cover);buildCabin(d,id,cover,makeTools);batch(cover);}
    else if(slot==='chassis')buildChassis(d,id);
    else if(slot==='wheels')pivots=makeWheels(d,id,group,makeTools,dimensions);
    else services(slot,id,d,parts.cabin);
    batch(group);
    if(slot==='cabin')nameplates(group,id);
  }
  // Double-sided window plates are thin decals on the shell. Keep them out of the
  // shadow pass to avoid self-shadow stripes across the laminated surface.
  root.traverse(mesh=>{
    if(mesh.material?.userData.finish==='glass'){mesh.castShadow=false;mesh.receiveShadow=false;}
  });
  root.scale.setScalar(dimensions.scale);
  const tracer=new T.Group();tracer.userData.nonPick=true;root.add(tracer);
  tracer.scale.set(dimensions.width,1,dimensions.length);
  const overlay=engineeringOverlay(root,slots,parts,dimensions);
  const zones={};
  for(const [name,z,color] of [['crew space',.44,0x69dae6],['equipment bay',-.59,0xe99759]]){
    const material=new T.MeshBasicMaterial({color,transparent:true,opacity:0,depthWrite:false,side:T.FrontSide});
    const mesh=new T.Mesh(new T.BoxGeometry(1.6,.88,.86),material);
    mesh.position.set(0,1.83,z);mesh.renderOrder=3;zones[name]=mesh;tracer.add(mesh);
  }
  let previousMode,previousSlot;
  function update(pose,view,scenario){
    const mode=view.mode||'exterior',selected=view.selectedSlot;
    if(mode!==previousMode){
      for(const [slot,g] of Object.entries(slots))g.position.set(...(mode==='exploded'?explodedOffsets[slot]:[0,0,0]));
      cover.visible=mode!=='cutaway';
      if(mode==='exploded' && parts.cabin!=='open-deck')cover.position.y=.39;else cover.position.y=0;
      previousMode=mode;
    }
    if(selected!==previousSlot){
      for(const [slot,materials] of Object.entries(mats))for(const m of materials.values()){
        m.color.copy(m.userData.baseColor);m.emissive.copy(m.userData.baseGlow);
        if(selected===slot){m.color.lerp(new T.Color(0xffbb65),.32);m.emissive.setHex(0x724515);}
      }
      previousSlot=selected;
    }
    const steer=pose.steerRad ?? 0;
    for(const p of pivots){
      p.steer.rotation.y=p.z>0?steer:p.z<0?-steer*.38:0;
      const a=p.center?pose.wheelAngleRad:p.steer.position.x>0?pose.rightWheelAngleRad:pose.leftWheelAngleRad;
      p.spin.rotation.x=a??pose.wheelAngleRad??0;
    }
    tracer.visible=parts.cabin!=='open-deck' && mode==='cutaway' && Boolean(view.tracer);
    if(tracer.visible)for(const [name,mesh] of Object.entries(zones)){
      const source=name===view.tracer.sourceZone;
      mesh.material.color.setHex(source?0xf3a963:0x72dce8);
      mesh.material.opacity=.37*Math.min(1,Math.max(0,(source?view.tracer.sourceFraction:view.tracer.remoteFraction)||0));
    }
    return overlay.update(scenario,view);
  }
  return {root,update,wheelCount:pivots.length};
}
