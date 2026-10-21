import * as THREE from './assets/three.module.js';
import {TraceGesture,PullHold,EarBalance} from './gesture-engine.js';
import {createMerchandise} from './merchandise.js';

const $ = id => document.getElementById(id);
const V = (x,y,z=0.65) => new THREE.Vector3(x,y,z);
const sceneHost = $('scene'), workspace = document.querySelector('.workspace');
const isMobile = () => innerWidth <= 900;
const bagInfo = {
  black: { name:'經典黑垃圾袋', caption:'01 — 經典黑垃圾袋', sub:'厚實袋身，一整週的垃圾都裝得下。', color:0x0d100e, roughness:.43, clearcoat:.4 },
  blue: { name:'臺北專用袋', caption:'02 — 臺北專用袋', sub:'隨袋徵收，分類好再打包。', color:0x087cac, roughness:.38, clearcoat:.4 },
  linen: { name:'透明垃圾袋', caption:'03 — 透明垃圾袋・章東西', sub:'透明袋身，裝了什麼一眼就看到。', color:0xaebeb2, roughness:.38, clearcoat:.4 },
  pineapple: { name:'鳳梨(?)', caption:'04 — 鳳梨(?)・誰出的主意?', sub:'金黃鱗紋袋身配綠葉冠，綁上飄帶旺起來。', color:0xf6cf6e, roughness:.5, clearcoat:.25 }
};
const ribbonInfo = {
  orange: { file:'assets/ribbon.png', plain:0xe67d42, sheen:'#f7d4ae' },
  blue: { file:'assets/ribbon-blue.png', plain:0x0b5aa3, sheen:'#cfe0f2' }
};
const steps = [
  {name:'交叉穿帶', hint:'左帶跨過右帶，再從下方穿出',text:'按住左帶端，從右帶上方交叉，依序穿過 1 → 2 → 3，從結下穿出再放開。',kind:'trace',from:V(-.95,2.1,.9),to:V(.7,3.3,.9),side:0,gates:[V(-.48,2.5,.9),V(.15,2.88,.9),V(.7,3.3,.9)]},
  {name:'控力收緊', hint:'保持 65–82% 張力，穩住 0.8 秒',text:'把剛穿出的帶端往右上拉，在綠色張力區停留 0.8 秒把結收緊；過拉會滑脫。',kind:'hold',from:V(.7,3.3,.9),to:V(1.38,3.62,.9),side:1},
  {name:'折出左耳', hint:'捏住帶子中段往上折，不能直接跳到終點',text:'捏住左帶中段，沿弧線往上折回結心，折出左耳。',kind:'trace',from:V(-.6,2.3,.9),to:V(-.33,3.35,.9),side:0,gates:[V(-1.2,2.98,.9),V(-1.03,3.45,.9),V(-.63,3.57,.9),V(-.33,3.35,.9)]},
  {name:'繞圈穿結', hint:'繞過左耳根部，再從結下穿出',text:'捏住右帶中段，繞過左耳根部一圈，再從結下的洞穿出，拉成右耳。',kind:'trace',from:V(.62,2.3,.9),to:V(-.28,2.88,.9),side:1,gates:[V(.99,3.23,.9),V(.59,3.65,.9),V(-.04,3.57,.9),V(-.4,3.25,.9),V(-.28,2.88,.9)]},
  {name:'雙耳平衡', hint:'分別拉開兩耳，找到左右平衡',text:'分別把左右耳拉進虛線圈。兩邊都到位，且差距小於 13%，才能收結。',kind:'balance',from:V(.4,3.22,.9),to:V(1.0,3.28,.9),side:1}
];
let state={phase:0,bag:'black',ribbon:'orange',step:0,preview:5,qualities:[],left:50,right:50,tension:70};
let renderer, scene, camera, model, ribbonGroup, bagMaterial, topMaterial, cityPrint, merchandise, crown, pineappleSkin, clock;
let rotation=-.12, targetRotation=-.12, targetZoom=7.8, autoRotate=false;
let drag=null, orbit=null, stepProgress=0;
let handle=null, target=null, path=null, previewTimer=null, toastTimer=null;
let ribbonTexture, ribbonTextures={}, ribbonMaterial=null, knotMaterial=null, audioCtx=null, audioNodes=[];
let frameCount=0;
let mechanic=null, markers=[], balanceHandles=[], grips=new Map(), gameLast=0, shake=0;
const run={mode:'practice',time:90,elapsed:0,combo:0,maxCombo:0,slips:0,assists:0,earQuality:1,holdQuality:1,expired:false};

function noiseTexture(size,kind='stone') {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d'),image=ctx.createImageData(size,size);
  let seed=39127; const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4;
    let n=kind==='linen'?180+20*Math.sin(x*Math.PI/2)*Math.sin(y*Math.PI/2)+(rand()-.5)*25: 194+(rand()-.5)*28+4*Math.sin(x*.08+y*.02);
    if(kind==='plastic') n=145+(rand()-.5)*18;
    image.data[i]=image.data[i+1]=image.data[i+2]=n;image.data[i+3]=255;
  }
  ctx.putImageData(image,0,0);
  const t=new THREE.CanvasTexture(canvas);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(kind==='linen'?8:3,kind==='linen'?8:3);return t;
}

function environment() {
  const faces=[];
  for(let i=0;i<6;i++){
    const c=document.createElement('canvas');c.width=c.height=128;const cx=c.getContext('2d');
    cx.fillStyle=['#c8c9bd','#9c9c8b','#f5f4e9','#a4a18d','#d6d6cb','#e7e5d8'][i];cx.fillRect(0,0,128,128);
    if(i===0||i===4){cx.fillStyle='#fffff8';cx.fillRect(12,13,30,95);cx.fillRect(48,13,30,95);}
    faces.push(c);
  }
  const t=new THREE.CubeTexture(faces);t.needsUpdate=true;return t;
}

function initScene(){
  try {renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});}
  catch(e){$('webgl-error').hidden=false;$('start').disabled=true;console.error(e);return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.17;
  sceneHost.prepend(renderer.domElement);scene=new THREE.Scene();scene.background=new THREE.Color('#eeece5');
  scene.fog=new THREE.Fog('#eeece5',14,35);scene.environment=environment();
  camera=new THREE.PerspectiveCamera(33,1,.1,70);clock=new THREE.Clock();
  scene.add(new THREE.HemisphereLight(0xfff9e7,0x797e66,2.3));
  const sun=new THREE.DirectionalLight(0xfff4df,3.4);sun.position.set(-4,7,5);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-6;sun.shadow.camera.right=6;sun.shadow.camera.top=7;sun.shadow.camera.bottom=-5;sun.shadow.normalBias=.02;sun.shadow.bias=-.0003;sun.shadow.radius=5;scene.add(sun);
  const fill=new THREE.DirectionalLight(0xe8f0e7,1.8);fill.position.set(4,3,-2);scene.add(fill);
  const stone=noiseTexture(256);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(150,150),new THREE.MeshStandardMaterial({color:0xe1e0d4,roughness:1,bumpMap:stone,bumpScale:.018}));floor.rotation.x=-Math.PI/2;floor.position.y=-.18;floor.receiveShadow=true;scene.add(floor);
  const plinth=new THREE.Mesh(new THREE.CylinderGeometry(1.8,1.83,.22,96),new THREE.MeshStandardMaterial({color:0xc8c9b8,roughness:.96,map:stone,bumpMap:stone,bumpScale:.02}));plinth.position.y=-.035;plinth.receiveShadow=true;plinth.castShadow=true;scene.add(plinth);
  // A quiet ceramic vessel and a single dried branch keep the working space grounded.
  const vaseShape=[new THREE.Vector2(0,0),new THREE.Vector2(.18,0),new THREE.Vector2(.29,.15),new THREE.Vector2(.25,.47),new THREE.Vector2(.1,.63),new THREE.Vector2(.095,.69),new THREE.Vector2(.07,.69),new THREE.Vector2(.07,.62),new THREE.Vector2(.18,.43),new THREE.Vector2(.19,.15),new THREE.Vector2(0,.1)];
  const vase=new THREE.Mesh(new THREE.LatheGeometry(vaseShape,40),new THREE.MeshStandardMaterial({color:0xacae96,roughness:1,bumpMap:stone,bumpScale:.02}));vase.position.set(2.6,-.18,-2.2);vase.castShadow=true;scene.add(vase);
  const twigMat=new THREE.MeshStandardMaterial({color:0x77765e,roughness:1});
  const addTwig=(points,r=.008)=>{const mesh=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),20,r,5,false),twigMat);mesh.position.copy(vase.position);scene.add(mesh);};
  addTwig([V(0,.6,0),V(.05,1.1,0),V(-.08,1.6,.02),V(.1,2.05,.04)]);
  addTwig([V(-.04,1.4,.02),V(-.25,1.58,.04),V(-.36,1.89,.02)],.005);
  addTwig([V(0,1.8,.04),V(.32,1.92,.04),V(.45,2.17,0)],.005);
  for(let i=0;i<5;i++){const leaf=new THREE.Mesh(new THREE.SphereGeometry(.05,8,6),new THREE.MeshStandardMaterial({color:0x99967c,roughness:1}));leaf.scale.set(.38,1.3,.1);leaf.position.set(2.68+i*.057,1.55+i*.06,-2.15);leaf.rotation.z=-.8;scene.add(leaf);}
  model=new THREE.Group();scene.add(model);
  bagMaterial=new THREE.MeshPhysicalMaterial({color:0x0d100e,roughness:.43,metalness:0,clearcoat:.4,clearcoatRoughness:.3,envMapIntensity:.85,bumpMap:noiseTexture(256,'plastic'),bumpScale:.006,side:THREE.DoubleSide});
  topMaterial=bagMaterial.clone();
  const body=new THREE.Mesh(bagGeometry(false),bagMaterial);body.castShadow=true;body.receiveShadow=true;model.add(body);
  const mouth=new THREE.Mesh(bagGeometry(true),topMaterial);mouth.castShadow=true;mouth.receiveShadow=true;model.add(mouth);
  const seam=new THREE.Mesh(new THREE.TorusGeometry(1.08,.012,5,100),bagMaterial);seam.rotation.x=Math.PI/2;seam.scale.y=.94;seam.position.y=.12;model.add(seam);
  const bottom=new THREE.Mesh(new THREE.CylinderGeometry(1.08,1.06,.06,100),bagMaterial);bottom.scale.z=.94;bottom.position.y=.105;bottom.receiveShadow=true;model.add(bottom);
  cityPrint=createCityPrint();cityPrint.visible=false;model.add(cityPrint);
  crown=createCrown();crown.visible=false;model.add(crown);
  merchandise=createMerchandise(y=>bagRadius((y-.1)/3.02*3.12));model.add(merchandise);
  loadRibbon(state.ribbon);
  drawRibbon();resize();window.addEventListener('resize',resize);
  renderer.domElement.addEventListener('pointerdown',orbitStart);
  renderer.domElement.addEventListener('pointermove',orbitMove);
  renderer.domElement.addEventListener('pointerup',orbitEnd);
  renderer.domElement.addEventListener('pointercancel',orbitEnd);
  renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();targetZoom=THREE.MathUtils.clamp(targetZoom+e.deltaY*.005,6,11);},{passive:false});
  renderer.domElement.addEventListener('touchmove',e=>{if(e.touches.length===2){e.preventDefault();const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);if(orbit?.pinch)targetZoom=THREE.MathUtils.clamp(targetZoom+(orbit.pinch-d)*.014,6,11);if(orbit)orbit.pinch=d;}},{passive:false});
  animate();
}

function bagRadius(y){
  const profile=[[0,1.08],[.12,1.3],[.35,1.43],[.8,1.49],[1.3,1.47],[1.8,1.36],[2.2,1.16],[2.55,.82],[2.85,.38],[3.04,.17],[3.12,.15]];
  for(let i=1;i<profile.length;i++)if(y<=profile[i][0]){const a=profile[i-1],b=profile[i];let t=THREE.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1);t=t*t*(3-2*t);return a[1]+(b[1]-a[1])*t;}
  return .15;
}
function onBagSurface(point){
  const p=point.clone();
  if(p.y<2.95){const r=bagRadius((p.y-.1)/3.02*3.12);const z=Math.sqrt(Math.max(0,r*r-p.x*p.x))*.94+.10;p.z=Math.max(p.z,z);}
  else if(p.z>.2&&p.y>=3.1&&p.y<3.85){const v=THREE.MathUtils.clamp((p.y-3.1)/.65,0,1),r=.15+Math.pow(v,.85)*.72;p.z=Math.max(p.z,Math.sqrt(Math.max(0,r*r-p.x*p.x))*.88+.07);}
  return p;
}
function bagGeometry(top){
  const nx=160,ny=top?52:120,positions=[],uvs=[],indices=[];
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
    let v=j/ny,a=i/nx*Math.PI*2,y,r;
    if(top){y=3.1+v*.65;r=.15+Math.pow(v,.85)*.72;const fold=(Math.sin(a*13+v*1.6)*.17+Math.sin(a*21-v*2)*.08)*v;r*=1+fold;y+=v*v*(.07*Math.sin(a*7)+.04*Math.cos(a*13));}
    else{y=.1+v*3.02;r=bagRadius(v*3.12);const neck=Math.pow(v,4),crease=q=>Math.pow(Math.abs(Math.sin(q)),.55)-.7;const wrinkle=crease(a*19+v*11+Math.sin(a*5))*.028+Math.sin(a*37-v*17)*.006+crease(a*10+v*22)*.028;r+=wrinkle*(.65+neck*2.1)+Math.sin(a*13+v*2)*.038*(.3+neck);r+=Math.sin(a*5+v*5)*.04*Math.sin(Math.PI*v);y+=Math.sin(a*11+v*26)*.01*Math.sin(Math.PI*v);}
    positions.push(Math.cos(a)*r,y,Math.sin(a)*r*(top?.88:.94));uvs.push(i/nx,j/ny);
    if(j<ny&&i<nx){const k=j*(nx+1)+i;indices.push(k,k+1,k+nx+1,k+1,k+nx+2,k+nx+1);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

function createCityPrint(){
  const c=document.createElement('canvas');c.width=1024;c.height=512;const ctx=c.getContext('2d');
  ctx.strokeStyle='#095148';ctx.fillStyle='#095148';ctx.lineWidth=7;ctx.strokeRect(23,23,978,466);ctx.strokeRect(37,37,950,438);
  ctx.textAlign='center';ctx.font='bold 68px "Noto Sans TC",sans-serif';ctx.fillText('臺北市專用垃圾袋',512,125);
  ctx.font='bold 112px sans-serif';ctx.fillText('120',325,282);ctx.font='bold 49px "Noto Sans TC",sans-serif';ctx.fillText('公升袋',677,267);
  ctx.font='30px "Noto Sans TC",sans-serif';ctx.fillText('城市日常  /  垃圾分類，袋口繫緊',512,390);
  ctx.font='20px sans-serif';ctx.fillText('3D 遊戲示意・非實體袋標示',512,446);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
  const g=new THREE.PlaneGeometry(1.94,.96,48,24),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i)+1.12;const r=bagRadius((y-.1)/3.02*3.12);p.setXYZ(i,x,y,Math.sqrt(Math.max(0,r*r-x*x))*.94+.07);}
  g.computeVertexNormals();return new THREE.Mesh(g,new THREE.MeshStandardMaterial({map:texture,transparent:true,roughness:.6,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));
}

// Pineapple skin: golden diamond scales, each with a brown eye, wrapped round the bag body.
function pineappleTexture(){
  const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d'),s=64;
  ctx.fillStyle='#c98a24';ctx.fillRect(0,0,256,256);
  for(let row=-1;row<=4;row++)for(let col=-1;col<=4;col++){
    const x=col*s+(row%2?s/2:0),y=row*s/2+s/4;
    const g=ctx.createRadialGradient(x,y-4,2,x,y,s*.5);g.addColorStop(0,'#f4cb52');g.addColorStop(.7,'#dfa634');g.addColorStop(1,'#a9701c');
    ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x,y-s/4+2);ctx.lineTo(x+s/2-3,y);ctx.lineTo(x,y+s/4-2);ctx.lineTo(x-s/2+3,y);ctx.closePath();ctx.fill();
    ctx.fillStyle='#6b4a1d';ctx.beginPath();ctx.ellipse(x,y+2,5,3.5,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#8c5c19';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(x-6,y-4);ctx.lineTo(x,y+1);ctx.lineTo(x+6,y-4);ctx.stroke();
  }
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(6,5);return t;
}
// Spiky leaf crown sprouting from the gathered neck above the bow.
function createCrown(){
  const g=new THREE.Group(),mats=[0x3f6f2a,0x56873a,0x2f5a22].map(color=>new THREE.MeshStandardMaterial({color,roughness:.62,side:THREE.DoubleSide}));
  const leaf=new THREE.ConeGeometry(.085,1,4,1);leaf.translate(0,.5,0);
  for(let ring=0;ring<3;ring++)for(let i=0;i<9-ring*2;i++){
    const phi=(i+ring*.5)/(9-ring*2)*Math.PI*2,m=new THREE.Mesh(leaf,mats[(i+ring)%3]);
    m.scale.set(1,.95-ring*.18+(i%2)*.1,.32);m.rotation.set(0,phi,0,'YXZ');m.rotateX(.78-ring*.3);
    m.position.set(Math.sin(phi)*.12,3.62+ring*.06,Math.cos(phi)*.12);m.castShadow=true;g.add(m);
  }
  return g;
}

// Ribbon: the bow is two continuous strands, A (starts on the left) and B (starts on the right).
// Each strand keeps a fixed set of control points that spring toward the pose of the current step,
// so a loop is a bight of the same ribbon: knot -> ear -> back through the knot -> one cut tail.
const RIB_N=20, RIB_ROWS=150, RIB_COLS=8, KNOT=V(0,3.08,.30);
const strands={};let ribbonClock=0, ribbonLast=0, ribbonSnap=true, previewT=0;
const smooth=(a,b,x)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
function polyLength(points){let l=0;for(let i=1;i<points.length;i++)l+=points[i].distanceTo(points[i-1]);return l;}
// The part of a polyline from its start up to fraction f of its length.
function polyPrefix(points,f){
  const out=[points[0].clone()];let left=polyLength(points)*THREE.MathUtils.clamp(f,0,1);
  for(let i=1;i<points.length&&left>0;i++){const d=points[i].distanceTo(points[i-1]);if(d>=left){out.push(points[i-1].clone().lerp(points[i],left/d));break;}out.push(points[i].clone());left-=d;}
  return out;
}
function resample(points){
  const clean=[points[0]];for(const p of points.slice(1))if(p.distanceTo(clean.at(-1))>.015)clean.push(p);
  if(clean.length<2)return Array.from({length:RIB_N},()=>clean[0].clone());
  if(clean.length===2){const m=clean[0].clone().lerp(clean[1],.5);m.y-=.05;m.z+=.08;clean.splice(1,0,m);}
  return new THREE.CatmullRomCurve3(clean,false,'centripetal').getSpacedPoints(RIB_N-1);
}
// Composite the chosen ribbon's print onto an ivory satin base; textures are cached per ribbon.
function loadRibbon(key){
  if(ribbonTextures[key])return applyRibbon(key);
  new THREE.TextureLoader().load(ribbonInfo[key].file,texture=>{
    const c=document.createElement('canvas');c.width=texture.image.width;c.height=texture.image.height;const ctx=c.getContext('2d');ctx.fillStyle='#fff9e9';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(texture.image,0,0);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();t.wrapT=THREE.RepeatWrapping;ribbonTextures[key]=t;
    if(state.ribbon===key)applyRibbon(key);
  },undefined,()=>{if(state.ribbon===key){ribbonTexture=null;applyRibbon(key);}toast('紋理載入失敗，暫以素色飄帶練習。');});
}
function applyRibbon(key){
  ribbonTexture=ribbonTextures[key]||null;
  if(ribbonMaterial){ribbonMaterial.map=ribbonTexture;ribbonMaterial.color.setHex(ribbonTexture?0xfff9ee:ribbonInfo[key].plain);ribbonMaterial.sheenColor.set(ribbonInfo[key].sheen);ribbonMaterial.needsUpdate=true;}
  drawRibbon();
}
function selectRibbon(key){
  state.ribbon=key;loadRibbon(key);fabricSound();
  document.querySelectorAll('.ribbon-option').forEach(b=>{const active=b.dataset.ribbon===key;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
}
function ensureRibbonMaterial(){
  const info=ribbonInfo[state.ribbon];
  if(!ribbonMaterial)ribbonMaterial=new THREE.MeshPhysicalMaterial({map:ribbonTexture||null,color:ribbonTexture?0xfff9ee:info.plain,side:THREE.DoubleSide,roughness:.58,metalness:.03,clearcoat:.13,sheen:.7,sheenColor:new THREE.Color(info.sheen),sheenRoughness:.5});
  return ribbonMaterial;
}
function makeStrand(name,opts){
  const count=(RIB_ROWS+1)*(RIB_COLS+1),indices=[];
  for(let i=0;i<RIB_ROWS;i++)for(let j=0;j<RIB_COLS;j++){const k=i*(RIB_COLS+1)+j;indices.push(k,k+1,k+RIB_COLS+1,k+1,k+RIB_COLS+2,k+RIB_COLS+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(count*3),3));g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(count*2),2));g.setIndex(indices);
  const mesh=new THREE.Mesh(g,ensureRibbonMaterial());mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;ribbonGroup.add(mesh);
  strands[name]={mesh,opts,pos:Array.from({length:RIB_N},()=>KNOT.clone()),vel:Array.from({length:RIB_N},()=>new THREE.Vector3()),presence:0};
}
const tmpSide=new THREE.Vector3(),tmpNormal=new THREE.Vector3(),tmpFace=new THREE.Vector3();
function shapeStrip(s,points){
  const {width,offset,twist=0,notch=false,pinch=true}=s.opts;
  s.mesh.visible=s.presence>.03;if(!s.mesh.visible)return;
  const curve=new THREE.CatmullRomCurve3(points.map(onBagSurface),false,'centripetal'),len=Math.max(.02,curve.getLength());
  const pos=s.mesh.geometry.attributes.position,uv=s.mesh.geometry.attributes.uv;
  for(let i=0;i<=RIB_ROWS;i++){
    const t=i/RIB_ROWS,c=curve.getPointAt(t),tan=curve.getTangentAt(t);
    // Face the bag (or the viewer); ears roll about their length so they read as cupped satin.
    tmpFace.set(c.x*.45,.12,1).normalize();tmpSide.crossVectors(tan,tmpFace);if(tmpSide.lengthSq()<1e-4)tmpSide.set(1,0,0);tmpSide.normalize();
    const ear=smooth(.02,.2,c.y-KNOT.y)*Math.sign(c.x||1)*.5;
    tmpSide.applyAxisAngle(tan,Math.sin(t*Math.PI*2)*twist+ear);tmpNormal.crossVectors(tmpSide,tan).normalize();
    // The ribbon gathers wherever it passes through the knot.
    const gather=pinch?.34+.66*smooth(.03,.24,c.distanceTo(KNOT)):1;
    const w=width*s.presence*gather*(.9+.1*Math.sin(t*len*1.3));
    for(let j=0;j<=RIB_COLS;j++){
      const sn=j/RIB_COLS-.5;let q=c;
      // Dovetail-cut tail end: the centre of the last few rows is pulled back along the strip.
      if(notch){const depth=(.5-Math.abs(sn))*2*width*.5,tt=Math.min(t,1-depth/len);if(tt<t)q=curve.getPointAt(Math.max(0,tt));}
      const p=q.clone().addScaledVector(tmpSide,sn*w);
      p.addScaledVector(tmpNormal,Math.cos(sn*Math.PI*2)*.016*(w/.3)+Math.sin(t*len*8-ribbonClock*1.6+sn*3)*.005);
      p.z=Math.max(p.z,onBagSurface(p).z+.004);
      const k=i*(RIB_COLS+1)+j;pos.setXYZ(k,p.x,p.y,p.z);uv.setXY(k,j/RIB_COLS,offset+t*len/5.4);
    }
  }
  pos.needsUpdate=uv.needsUpdate=true;s.mesh.geometry.computeVertexNormals();
}
// An ear of the finished bow, as a closed path that starts and ends in the knot.
function earShape(sign,size){
  const g=V(size,.72+.28*size,1);
  return [V(-.36,-.11,.22),V(-.84,-.04,.17),V(-1.0,.24,.07),V(-.74,.48,-.02),V(-.32,.33,.02)].map(o=>V(KNOT.x+sign*-o.x*g.x,KNOT.y+o.y*g.y,KNOT.z+o.z));
}
function ribbonPose(){
  const P=state.phase===1?previewProgress():state.phase===2?state.step+(state.step<5?stepProgress:0):5;
  const s=Math.min(5,Math.floor(P)),f=s>=5?1:P-s,play=state.phase===2;
  const dragging=play&&drag&&state.step===s?drag.world:null;
  const tight=s>=5?state.tension/100:.72,bend=(1-tight)*.14;
  const K=KNOT,Kl=V(-.07,3.05,.44),Kr=V(.07,3.05,.44);
  // A hanging tail; it hangs shorter while ribbon is being drawn up into an ear.
  const tail=(sign,L,lift=0)=>{const end=V(sign<0?-.52:.65,3.07-1.47*L+lift,.8);return [V(sign*.07,3.0,.5),V(sign*.26,2.78,.64),V(sign*(.39+bend),Math.max(2.33,end.y+.45),.8),V(end.x,end.y+.17,end.z+.04),end];};
  // The path a finger traced so far: start, the gates already passed, then the finger itself.
  const traced=step=>{const pts=[step.from,...step.gates];
    if(dragging)return [...pts.slice(0,mechanic.index),dragging];
    return play?[step.from]:polyPrefix(pts,f);};
  // A bight: out of the knot along the traced path to the fold, back into the knot, then the tail.
  const bight=(path,sign)=>{const tip=path.at(-1),back=tip.clone().lerp(K,.5);back.x+=sign*.08;back.z=Math.max(back.z,.5);
    return [K,...path,back,K,...tail(sign,1,Math.min(.5,polyLength([K,...path])*.22))];};
  const sizeOf=side=>play&&s===4&&mechanic instanceof EarBalance?.65+.42*mechanic[side]:s===4?.65+.4*f:.88+.17*tight;
  let A,B,wrap=0;
  if(s===0){
    // Left end crosses over the right strand and tucks under it, following the finger.
    const path=dragging?[steps[0].from,...steps[0].gates.slice(0,mechanic.index-1),dragging]:play?[steps[0].from]:polyPrefix([steps[0].from,...steps[0].gates],f);
    A=[Kl,V(-.3,2.75,.62),...path];if(path.length===1)A=[Kl,V(-.45,2.6,.7),path[0]];
    B=[Kr,V(.38,2.62,.72),V(.87,2.33,.8)];
  }else if(s===1){
    // Half knot: A came out on top to the right, B swapped under to the left; pulling A closes it.
    const end=dragging||(play?steps[1].from:steps[1].from.clone().lerp(steps[1].to,f*.735));
    const r=dragging?THREE.MathUtils.clamp(mechanic.ratio/.735,0,1.3):play?0:f;
    const close=p=>p.clone().lerp(K,.55*Math.min(1,r));
    A=[Kl,close(V(.04,2.9,.68)),close(V(.2,2.98,.52)),close(V(.42,3.18,.56)),end];
    B=[Kr,close(V(-.06,2.94,.56)),V(-.36,2.68,.76),V(-.62,2.42,.8),V(-.85,2.25-.12*Math.min(1,r),.8)];
    wrap=smooth(.2,1,r);
  }else{
    wrap=1;
    // B, now on the left, is folded up into the left ear.
    B=s===2?bight(traced(steps[2]),-1):[K,...earShape(-1,s>=3?sizeOf('left'):.82),K,...tail(-1,s>=5?state.left/50:1)];
    if(s===2&&play&&!dragging)B=[K,...tail(-1,1)];
    // A wraps round the left ear's root and is pushed through as the right ear.
    if(s<3)A=[K,...tail(1,1)];
    else A=s===3?bight(traced(steps[3]),1):[K,...earShape(1,sizeOf('right')),K,...tail(1,s>=5?state.right/50:1)];
    if(s===3&&play&&!dragging)A=[K,...tail(1,1)];
  }
  const center=[V(-.095,3.24,.42),V(-.08,3.1,.62),V(.04,2.97,.57),V(.105,3.1,.4),V(.04,3.23,.31)].map(p=>K.clone().lerp(p,.75+.25*wrap));
  return {A,B,center,wrap,s,dragA:dragging&&(s===0||s===1||s===3),dragB:dragging&&s===2};
}
function previewProgress(){
  if(previewT>=11)return 5;const step=Math.floor(previewT/2.2);return step+smooth(.08,.82,previewT/2.2-step);
}
function springStrand(s,target,on,dt,{flutter=0,phase=0,grab=false}={}){
  s.presence+=(on-s.presence)*(1-Math.exp(-dt*(on?6:9)));
  const pts=resample(target);
  pts.forEach((p,i)=>{
    // Only the hanging tails sway; ears and the knot stay put.
    const a=smooth(.1,.9,KNOT.y-p.y)*Math.pow(i/(RIB_N-1),.8)*flutter;
    if(a){p.x+=Math.sin(ribbonClock*1.7+i*.45+phase)*.03*a;p.z+=Math.cos(ribbonClock*1.25+i*.4+phase)*.02*a;p.y+=Math.sin(ribbonClock*2.1+i*.7+phase)*.01*a;}
    if(ribbonSnap){s.pos[i].copy(p);s.vel[i].set(0,0,0);return;}
    // Slightly under-damped springs give the satin a soft follow-through.
    const k=grab?380:150,c=2*Math.sqrt(k)*.72;
    for(let h=0,steps=Math.ceil(dt/(1/120)),sub=dt/steps;h<steps;h++){s.vel[i].addScaledVector(p.clone().sub(s.pos[i]),k*sub).multiplyScalar(Math.exp(-c*sub));s.pos[i].addScaledVector(s.vel[i],sub);}
  });
  if(ribbonSnap)s.presence=on;
  shapeStrip(s,s.pos);
}
function updateRibbon(dt){
  if(!ribbonGroup)return;ribbonClock+=dt;
  if(state.phase===1){previewT+=dt;if(previewT>13.6)previewT=0;const n=Math.min(4,Math.floor(previewProgress()));if(n!==state.preview){state.preview=n;renderLesson(n);}}
  const pose=ribbonPose(),breath=1+.012*Math.sin(ribbonClock*1.4),breathe=pts=>pose.s>=4?pts.map(p=>p.y>KNOT.y?KNOT.clone().lerp(p,breath):p):pts;
  springStrand(strands.A,breathe(pose.A),1,dt,{flutter:pose.dragA?.3:1,phase:0,grab:pose.dragA});
  springStrand(strands.B,breathe(pose.B),1,dt,{flutter:pose.dragB?.3:1,phase:2.1,grab:pose.dragB});
  springStrand(strands.center,pose.center,pose.wrap,dt);
  ribbonSnap=false;
}
function drawRibbon(){
  if(!model||ribbonGroup)return;
  ribbonGroup=new THREE.Group();model.add(ribbonGroup);
  // A complete band wraps around the gathered neck, including its hidden rear surface.
  const ringPts=[];for(let i=0;i<=48;i++){const a=i/48*Math.PI*2;ringPts.push(V(Math.cos(a)*.19,3.07+Math.sin(a*3)*.015,Math.sin(a)*.14));}
  makeStrand('A',{width:.36,offset:.31,twist:.08,notch:true});makeStrand('B',{width:.36,offset:.12,twist:-.08,notch:true});
  // A short, visibly folded strip makes the printed centre of the knot.
  makeStrand('center',{width:.2,offset:.45,twist:.1,pinch:false});
  // The neck band never moves, so it is shaped once.
  const band=new THREE.Mesh(new THREE.BufferGeometry(),ensureRibbonMaterial());makeStaticBand(band,ringPts,.22,.28,.15);band.castShadow=true;ribbonGroup.add(band);
  updateRibbon(0);
}
function makeStaticBand(mesh,points,width,offset,twist){
  const curve=new THREE.CatmullRomCurve3(points.map(onBagSurface)),n=120,m=6,positions=[],uvs=[],indices=[],len=curve.getLength();
  for(let i=0;i<=n;i++){const t=i/n,c=curve.getPointAt(t),tan=curve.getTangentAt(t);const side=V(0,1,0);side.applyAxisAngle(tan,Math.sin(t*Math.PI*2)*twist);
    for(let j=0;j<=m;j++){const s=j/m-.5,p=c.clone().addScaledVector(side,s*width);p.z=Math.max(p.z,onBagSurface(p).z);positions.push(p.x,p.y,p.z);uvs.push(j/m,offset+t*len/5.4);if(i<n&&j<m){const k=i*(m+1)+j;indices.push(k,k+1,k+m+1,k+1,k+m+2,k+m+1);}}}
  mesh.geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));mesh.geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));mesh.geometry.setIndex(indices);mesh.geometry.computeVertexNormals();
}

function resize(){
  if(!renderer)return;const r=sceneHost.getBoundingClientRect();renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();
}
function animate(){
  requestAnimationFrame(animate);if(!renderer)return;const elapsed=clock.getElapsedTime();const dt=gameLast?elapsed-gameLast:0;gameLast=elapsed;tickGame(dt);
  if(autoRotate&&!drag)targetRotation+=.003;
  rotation+=(targetRotation-rotation)*.08;model.rotation.y=rotation;
  model.position.y=Math.sin(elapsed*.65)*.006;
  model.rotation.z=Math.sin(elapsed*35)*shake*.018;shake=Math.max(0,shake-dt*2);
  updateRibbon(Math.min(.05,ribbonLast?elapsed-ribbonLast:0));ribbonLast=elapsed;
  camera.position.set(0,3.25,targetZoom);camera.lookAt(isMobile()?0:-.13,1.95,0);camera.updateMatrixWorld();
  renderer.render(scene,camera);updateHandlePositions();frameCount++;
  window.__ribbonQA={phase:state.phase,step:state.step,bag:state.bag,qualities:[...state.qualities],frames:frameCount,objects:renderer.info.render.calls};
}
function orbitStart(e){if(state.phase===2&&state.step<5)return;orbit={x:e.clientX,rotation:targetRotation,pointer:e.pointerId};renderer.domElement.setPointerCapture(e.pointerId);autoRotate=false;$('rotate').classList.remove('active');}
function orbitMove(e){if(orbit&&e.pointerId===orbit.pointer)targetRotation=orbit.rotation+(e.clientX-orbit.x)*.007;}
function orbitEnd(e){orbit=null;}
function resetView(){autoRotate=false;$('rotate').classList.remove('active');targetRotation=state.phase===2&&state.step<5?0:-.12;targetZoom=isMobile()?8.0:7.8;}

function setPhase(phase){
  state.phase=phase;clearInterval(previewTimer);previewTimer=null;
  $('play-hud').hidden=phase!==2||state.step>=5;
  $('rotate').disabled=phase===2&&state.step<5;$('reset-view').disabled=phase===2&&state.step<5;
  $('intro').hidden=phase!==0;$('lesson').hidden=!(phase===1||phase===2);$('results').hidden=phase!==3;
  $('scene-caption').hidden=phase!==0;$('instruction').hidden=phase!==2||state.step>=5;
  $('adjust').hidden=!(phase===2&&state.step===5);
  workspace.className='workspace'+(phase===1?' teaching':phase===2?' playing'+(state.step===5?' adjusting':''):phase===3?' finished':'');
  document.querySelectorAll('.journey li').forEach(li=>{const n=+li.dataset.phase;li.classList.toggle('active',n===phase);li.classList.toggle('done',n<phase);});
  $('scene-hint').textContent=phase===2&&state.step<5?'按住帶端圓點，拖向虛線圓圈':'拖曳旋轉 · 滾輪縮放';
  if(phase!==2)clearHandles();resetView();drawRibbon();requestAnimationFrame(resize);
}
function selectBag(key){
  state.bag=key;const b=bagInfo[key];bagMaterial.color.setHex(b.color);bagMaterial.roughness=b.roughness;bagMaterial.clearcoat=b.clearcoat;
  bagMaterial.bumpMap=noiseTexture(256,'plastic');bagMaterial.bumpScale=.006;bagMaterial.transparent=key==='linen';bagMaterial.opacity=key==='linen'?.36:1;bagMaterial.depthWrite=key!=='linen';bagMaterial.needsUpdate=true;
  topMaterial.copy(bagMaterial);
  const pine=key==='pineapple';if(pine&&!pineappleSkin)pineappleSkin=pineappleTexture();
  bagMaterial.map=pine?pineappleSkin:null;bagMaterial.bumpMap=pine?pineappleSkin:bagMaterial.bumpMap;bagMaterial.bumpScale=pine?.02:.006;bagMaterial.needsUpdate=true;
  topMaterial.copy(bagMaterial);
  if(key==='linen')topMaterial.opacity=.55;
  if(pine){topMaterial.map=null;topMaterial.color.setHex(0x4d7d30);}
  crown.visible=pine;
  cityPrint.visible=key==='blue';
  merchandise.visible=key==='linen';model.traverse(c=>{if(c.isMesh&&(c.material===bagMaterial||c.material===topMaterial))c.castShadow=key!=='linen';});
  document.querySelectorAll('.bag-option').forEach(b=>{const active=b.dataset.bag===key;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
  $('bag-caption').textContent=b.caption;$('bag-sub').textContent=b.sub;fabricSound();
}
function renderLesson(current=-1){
  $('lesson-list').innerHTML=steps.map((s,i)=>`<li class="${i===current?'current ':''}${i<current?'complete':''}"><span class="step-no">${i<current?'✓':String(i+1).padStart(2,'0')}</span><div class="step-text">${s.name}<small>${s.hint}</small></div></li>`).join('');
}
function teach(){
  setPhase(1);state.preview=0;state.step=0;$('lesson-eyebrow').textContent='VOYAGE · 五站航程';$('lesson-title').innerHTML='五站航程，<br>一袋打包好。';$('lesson-copy').innerHTML='從交叉到蝴蝶結，一站一站解鎖，<br>讓卡卡的袋口順起來。';
  renderLesson(0);$('lesson-bottom').innerHTML='<div class="mode-picker"><button id="mode-practice" data-mode="practice">自由練習<small>不限時，慢慢找手感</small></button><button id="mode-challenge" data-mode="challenge">順手挑戰<small>90 秒 · 連段 · 不卡關</small></button></div><button id="begin" class="primary-button">準備好了，開始打包 <span>↗</span></button><p class="start-note">拖曳穿點 → 穩住拉力 → 雙耳平衡</p>';
  const choose=mode=>{run.mode=mode;document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('chosen',b.dataset.mode===mode);b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});};choose(run.mode);$('mode-practice').onclick=()=>choose('practice');$('mode-challenge').onclick=()=>choose('challenge');$('begin').onclick=begin;
  previewT=0;
}
function begin(){
  gameLast=0;
  Object.assign(run,{time:90,elapsed:0,combo:0,maxCombo:0,slips:0,assists:0,earQuality:1,holdQuality:1,expired:false});
  state.step=0;state.qualities=[];state.left=50;state.right=50;state.tension=72;
  ['left-length','right-length'].forEach(id=>$(id).value=50);$('tension').value=72;syncAdjust();setPhase(2);setStep();
}
function setStep(){
  stepProgress=0;renderLesson(state.step);$('rotate').disabled=state.step<5;$('reset-view').disabled=state.step<5;
  $('lesson-eyebrow').textContent=run.mode==='challenge'?'90 SECOND FLOW CHALLENGE':'FOLLOW THE FLOW';
  $('lesson-title').innerHTML=state.step===5?'袋口綁好了，<br>出門前順一下。':'穿、繞、拉，<br>一站一站解鎖。';
  $('lesson-copy').innerHTML='路徑順、力道穩、兩耳平衡，<br>這袋垃圾就能順順出門。';
  $('play-hud').hidden=state.step>=5;
  if(state.step<5){
    const step=steps[state.step];$('instruction').hidden=false;$('instruction-number').textContent=String(state.step+1).padStart(2,'0');$('instruction-title').textContent=step.name;$('instruction-copy').textContent=step.text;
    $('lesson-bottom').innerHTML='<div class="step-brief"><span>手感目標</span><strong>'+step.hint+'</strong><p id="step-feedback">'+step.text+'</p></div><button id="assist" class="assist-button">輔助完成本步 · 手感以 55% 計分 ↗</button>';
    $('assist').onclick=assistStep;createHandles();
  }else{
    clearHandles();$('instruction').hidden=true;$('adjust').hidden=false;workspace.classList.add('adjusting');
    $('left-length').value=state.left;$('right-length').value=state.right;$('tension').value=state.tension;syncAdjust();
    $('lesson-bottom').innerHTML='<div class="run-summary"><strong>FLOW ×'+run.maxCombo+'</strong><span>'+formatTime(run.elapsed)+' · 滑脫 '+run.slips+' 次</span></div><p class="intro-copy">蝴蝶結完成。<br>轉一圈看看，再整理垂帶和結心張力。</p>';resize();
  }
  drawRibbon();updateHud();
}
function clearHandles(){ $('handles').replaceChildren();handle=target=path=null;markers=[];balanceHandles=[];grips.clear();drag=null; }
function feedback(message){if($('step-feedback'))$('step-feedback').textContent=message;}
function flashFlow(amount=1){run.combo+=amount;run.maxCombo=Math.max(run.combo,run.maxCombo);$('flow-combo').classList.remove('pop');void $('flow-combo').offsetWidth;$('flow-combo').classList.add('pop');fabricSound();}
function retryStep(message,count=true){if(count){run.slips++;run.combo=0;shake=1;}feedback(message);toast(message);stepProgress=0;createHandles();drawRibbon();updateHud();}
function assistStep(){run.assists++;if(state.step===1){run.holdQuality=.55;state.tension=72;}if(state.step===4)run.earQuality=.55;completeStep(.55,true);}
function makeHandle(point,label){const button=document.createElement('button');button.className='drag-handle';button.textContent='↗';button.dataset.label=label;button.setAttribute('aria-label',label+'，可拖曳；Enter 使用輔助完成');button.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();assistStep();}};$('handles').append(button);return button;}
function createHandles(){
  clearHandles();const step=steps[state.step];
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('drag-path');path=document.createElementNS(svg.namespaceURI,'path');svg.append(path);$('handles').append(svg);
  if(step.kind==='balance'){
    mechanic=new EarBalance();
    for(const side of ['left','right']){
      const sign=side==='left'?-1:1,from=V(sign*.4,3.22,.9),to=V(sign,3.28,.9);
      const ring=document.createElement('div');ring.className='drop-target';ring.dataset.label=side==='left'?'左耳到位':'右耳到位';ring.textContent='+';$('handles').append(ring);
      const button=makeHandle(from,side==='left'?'左耳':'右耳');balanceHandles.push({side,from,to,ring,button});
      button.setAttribute('aria-label',(side==='left'?'左耳':'右耳')+'，拖曳或左右方向鍵調整');
      button.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const outward=(side==='left'&&e.key==='ArrowLeft')||(side==='right'&&e.key==='ArrowRight');mechanic.move(side,mechanic[side]+(outward?.1:-.1));stepProgress=(mechanic.left+mechanic.right)/2*.95;drawRibbon();updateHud();}else if(e.key==='Enter'&&mechanic.ready){e.preventDefault();$('seal-knot').click();}};
      button.onpointerdown=e=>{e.preventDefault();button.setPointerCapture(e.pointerId);grips.set(e.pointerId,side);targetRotation=rotation=0;};
      button.onpointermove=e=>{if(grips.get(e.pointerId)!==side)return;const p=pointerWorld(e,.9),axis=to.clone().sub(from),ratio=p.clone().sub(from).dot(axis)/axis.lengthSq();mechanic.move(side,ratio);stepProgress=(mechanic.left+mechanic.right)/2*.95;button.classList.toggle('ready',mechanic[side]>=.82&&mechanic[side]<=1.1);drawRibbon();updateHud();};
      button.onpointerup=e=>{grips.delete(e.pointerId);if(mechanic.ready){feedback('兩耳平衡了。按「收好這個結」完成。');fabricSound();}else feedback(mechanic[side]>1.1?'這邊拉得太遠了，往內收一點。':'這耳先保持，再調整另一耳。');updateHud();};
      button.onpointercancel=e=>grips.delete(e.pointerId);
    }
    const seal=document.createElement('button');seal.id='seal-knot';seal.className='primary-button seal-knot';seal.disabled=true;seal.innerHTML='收好這個結 <span>↗</span>';$('handles').append(seal);
    seal.onclick=()=>{if(!mechanic.ready)return;run.earQuality=mechanic.quality;state.left=50+Math.round((mechanic.left-mechanic.right)*18);state.right=100-state.left;flashFlow();completeStep(mechanic.quality);};
    return;
  }
  mechanic=step.kind==='hold'?new PullHold():new TraceGesture([step.from,...step.gates],run.mode==='challenge'?.17:.22);
  if(step.kind==='trace')step.gates.slice(0,-1).forEach((p,i)=>{const el=document.createElement('div');el.className='thread-gate';el.textContent=String(i+1);el.dataset.order=String(i+1);$('handles').append(el);markers.push({el,p,index:i+1});});
  target=document.createElement('div');target.className='drop-target';target.dataset.label=step.kind==='hold'?'穩住，再放手':'按順序，最後到這裡';target.textContent=step.kind==='trace'?String(step.gates.length):'握';$('handles').append(target);
  handle=makeHandle(step.from,state.step>=2?(step.side===0?'左帶中段':'右帶中段'):step.side===0?'左側帶端':'右側帶端');
  if(step.kind==='trace'){
    handle.setAttribute('aria-label',(step.side===0?'左側':'右側')+'帶端，拖曳或方向鍵穿點，Enter 放手');
    handle.onkeydown=e=>{
      const directions={ArrowLeft:[-.12,0],ArrowRight:[.12,0],ArrowUp:[0,.12],ArrowDown:[0,-.12]};
      if(directions[e.key]){e.preventDefault();const [x,y]=directions[e.key];if(!drag)drag={world:step.from.clone(),pointer:'keyboard'};drag.world.x=THREE.MathUtils.clamp(drag.world.x+x,-2,2);drag.world.y=THREE.MathUtils.clamp(drag.world.y+y,1,4.6);const passed=mechanic.move(drag.world);if(passed)flashFlow(passed);stepProgress=mechanic.progress*.98;handle.classList.toggle('ready',mechanic.complete);drawRibbon();updateHud();}
      else if(e.key==='Enter'&&drag?.pointer==='keyboard'){e.preventDefault();drag=null;if(mechanic.complete)completeStep(mechanic.quality);else retryStep('還有節點沒穿過，重新找一下路徑。');}
    };
  }
  if(step.kind==='hold')handle.onkeydown=e=>{
    if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();mechanic.move(mechanic.ratio+(e.key==='ArrowRight'?.05:-.05));drag={world:step.from.clone().lerp(step.to,mechanic.ratio),pointer:'keyboard'};stepProgress=Math.min(.98,mechanic.ratio);state.tension=Math.round(mechanic.ratio*100);drawRibbon();updateHud();}
    else if(e.key==='Enter'&&drag?.pointer==='keyboard'){e.preventDefault();drag=null;if(mechanic.ready){run.holdQuality=mechanic.quality;flashFlow();completeStep(mechanic.quality);}else retryStep('尚未穩住 0.8 秒，放輕力道再試。');}
  };
  if(step.kind==='hold')handle.setAttribute('aria-label','右側帶端，拖曳或左右方向鍵控力，穩住後 Enter 放手');
  handle.onpointerdown=e=>{e.preventDefault();handle.setPointerCapture(e.pointerId);drag={world:step.from.clone(),last:step.from.clone(),pointer:e.pointerId};targetRotation=rotation=0;fabricSound();};
  handle.onpointermove=e=>{
    if(!drag||drag.pointer!==e.pointerId)return;const p=pointerWorld(e,step.to.z);drag.world.copy(p);
    if(step.kind==='trace'){const passed=mechanic.move(p);if(passed){flashFlow(passed);feedback('穿過 '+(mechanic.index-1)+' / '+step.gates.length+' 個節點，繼續順著走。');}stepProgress=mechanic.progress*.98;handle.classList.toggle('ready',mechanic.complete);}
    else{const axis=step.to.clone().sub(step.from),ratio=p.clone().sub(step.from).dot(axis)/axis.lengthSq();mechanic.move(ratio);stepProgress=Math.min(.98,mechanic.ratio);state.tension=Math.round(mechanic.ratio*100);}
    drawRibbon();updateHud();
  };
  handle.onpointerup=e=>{
    if(!drag||drag.pointer!==e.pointerId)return;drag=null;
    if(step.kind==='trace'){
      if(mechanic.complete){completeStep(mechanic.quality);}else retryStep('帶端滑開了。從第 1 個節點重新順著走。');
    }else if(mechanic.ready){run.holdQuality=mechanic.quality;flashFlow();completeStep(mechanic.quality);}
    else retryStep('還沒穩住。拉進綠色區，保持 0.8 秒再放開。');
  };
  handle.onpointercancel=()=>{drag=null;retryStep('手勢已取消，再試一次。',false);};
}
function updateHud(){
  if(state.phase!==2||state.step>=5)return;const step=steps[state.step];
  $('run-mode').textContent=run.mode==='challenge'?'順手挑戰':'自由練習';$('run-time').textContent=formatTime(run.mode==='challenge'?run.time:run.elapsed);$('run-time').classList.toggle('urgent',run.mode==='challenge'&&run.time<20);
  $('flow-combo').textContent='FLOW ×'+run.combo;$('slip-count').textContent='滑脫 '+run.slips;
  const band=$('skill-zone');let value=0;
  if(step.kind==='trace'){value=mechanic.progress;$('skill-label').textContent='穿帶進度';$('skill-value').textContent=(mechanic.index-1)+' / '+step.gates.length;band.hidden=true;}
  else if(step.kind==='hold'){value=Math.min(1,mechanic.ratio);$('skill-label').textContent='拉力・綠區穩住 0.8 秒';$('skill-value').textContent=Math.round(mechanic.ratio*100)+'% · '+Math.min(.8,mechanic.held).toFixed(1)+'s';band.hidden=false;band.style.left='65%';band.style.width='17%';if(handle)handle.classList.toggle('ready',mechanic.ready);if(mechanic.ready)feedback('力道剛好，現在放開。');}
  else{value=Math.min(1,mechanic.difference*2);$('skill-label').textContent='雙耳差距・越小越平衡';$('skill-value').textContent=Math.round(mechanic.difference*100)+'%';band.hidden=false;band.style.left='0';band.style.width='26%';$('seal-knot').disabled=!mechanic.ready;feedback(mechanic.ready?'兩耳平衡。現在可以收結。':'左耳 '+Math.round(mechanic.left*100)+'% ／ 右耳 '+Math.round(mechanic.right*100)+'%，兩邊都拉到 82–110%。');}
  $('skill-fill').style.width=(value*100)+'%';$('skill-meter').classList.toggle('overpull',step.kind==='hold'&&mechanic.ratio>.95);
}
function formatTime(seconds){const n=Math.max(0,Math.floor(seconds));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
function tickGame(dt){
  if(state.phase!==2||state.step>=5)return;
  if(document.hidden||document.querySelector('dialog[open]')||run.expired){if(drag)drag.holdTickAt=0;return;}
  run.elapsed+=dt;if(run.mode==='challenge'){run.time=Math.max(0,run.time-dt);if(run.time===0){run.expired=true;drag=null;grips.clear();$('timeout-dialog').showModal();return;}}
  if(steps[state.step].kind==='hold'&&drag){const now=performance.now();mechanic.tick(drag.holdTickAt?(now-drag.holdTickAt)/1000:0);drag.holdTickAt=now;if(mechanic.slipped){drag=null;retryStep('拉得太猛，底結滑脫了。放輕力道再試。');return;}}
  updateHud();
}
function pointerWorld(e,z){const r=renderer.domElement.getBoundingClientRect();const p=new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);const ray=new THREE.Raycaster();ray.setFromCamera(p,camera);const point=new THREE.Vector3();ray.ray.intersectPlane(new THREE.Plane(V(0,0,1),-z),point);point.x=THREE.MathUtils.clamp(point.x,-2,2);point.y=THREE.MathUtils.clamp(point.y,1,4.6);return point;}
function screenPoint(p){const w=workspace.getBoundingClientRect(),r=renderer.domElement.getBoundingClientRect();const n=onBagSurface(p).applyMatrix4(model.matrixWorld).project(camera);return{x:(n.x+1)/2*r.width+r.left-w.left,y:(1-n.y)/2*r.height+r.top-w.top};}
function updateHandlePositions(){
  if(state.phase!==2||state.step>=5)return;const step=steps[state.step];
  const position=(el,p)=>{const q=screenPoint(p);el.style.left=q.x+'px';el.style.top=q.y+'px';return q;};
  if(step.kind==='balance'){
    const segments=[];for(const h of balanceHandles){const p=h.from.clone().lerp(h.to,mechanic[h.side]);const a=position(h.button,p),b=position(h.ring,h.to);segments.push(`M ${a.x} ${a.y} L ${b.x} ${b.y}`);}
    path.setAttribute('d',segments.join(' '));return;
  }
  if(!handle)return;const a=position(handle,drag?drag.world:step.from),dest=step.kind==='hold'?step.from.clone().lerp(step.to,.735):step.to,b=position(target,dest);
  if(step.kind==='trace'){
    const nodes=[step.from,...step.gates].map(screenPoint);path.setAttribute('d',nodes.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' '));
    markers.forEach(m=>{position(m.el,m.p);m.el.classList.toggle('passed',m.index<mechanic.index);m.el.classList.toggle('next',m.index===mechanic.index);});target.classList.toggle('next',mechanic.index===step.gates.length);
  }else path.setAttribute('d',`M ${screenPoint(step.from).x} ${screenPoint(step.from).y} L ${b.x} ${b.y}`);
}
function completeStep(quality,assist=false){
  if(state.phase!==2||state.step>=5)return;state.qualities.push(quality);state.step++;fabricSound();clearHandles();toast(assist?'輔助完成。這一步的手感以 55% 計分。':quality>=.9?'順！這一站解鎖了。':'完成，前往下一站。');setStep();
}
function syncAdjust(){
  state.left=+$('left-length').value;state.right=+$('right-length').value;state.tension=+$('tension').value;
  $('left-value').textContent=state.left+' cm';$('right-value').textContent=state.right+' cm';$('tension-value').textContent=state.tension+'%';if(state.step>=5)drawRibbon();
}
function finish(){
  const precision=Math.max(0,state.qualities.reduce((a,b)=>a+b,0)/Math.max(1,state.qualities.length)-run.slips*.025);
  const symmetry=Math.max(0,1-Math.abs(state.left-state.right)/40);
  const proportion=Math.max(0,1-Math.abs((state.left+state.right)/2-50)/30);
  const tension=Math.max(0,1-Math.abs(state.tension-72)/60);
  const metrics=[['穿帶手感',precision,40],['雙耳平衡',run.earQuality,20],['垂帶整理',(symmetry+proportion)/2,20],['收結張力',(run.holdQuality+tension)/2,20]];
  const total=metrics.reduce((s,m)=>s+Math.round(m[1]*m[2]),0);
  setPhase(3);$('total-score').textContent=total;$('score-seal').textContent=total>=90?'順起來了':total>=75?'快要順了':'還有點卡';
  const suggestions=[];if(symmetry<.85)suggestions.push('讓兩側垂帶更接近一些');if(tension<.85)suggestions.push(state.tension>72?'放鬆一點結心':'再收緊一點結心');if(proportion<.85)suggestions.push('讓垂帶長度回到約 50 cm');if(precision<.85)suggestions.push('沿節點平順穿帶，減少滑脫');
  $('score-message').textContent=suggestions.length?suggestions.join('，')+'。再綁一袋，會更順。':'雙耳平衡、垂帶整齊。這袋垃圾打包好了，臺北又順了一點。';
  $('score-details').innerHTML=metrics.map(m=>`<div class="metric"><span>${m[0]}</span><small>${Math.round(m[1]*m[2])} / ${m[2]}</small><div class="metric-bar"><i style="width:${m[1]*100}%"></i></div></div>`).join('');
  let best=total;const key='current-v3-'+run.mode+(run.assists?'-assisted':'');try{best=Math.max(total,+(localStorage.getItem(key)||0));localStorage.setItem(key,best);}catch(e){}
  $('run-result').innerHTML='<span>'+formatTime(run.elapsed)+' 用時</span><span>最高 FLOW ×'+run.maxCombo+'</span><span>滑脫 '+run.slips+' 次</span><span>輔助 '+run.assists+' 步</span>';
  $('best-score').textContent=`${run.mode==='challenge'?'順手挑戰':'自由練習'}${run.assists?'・輔助紀錄':''} · 本機最佳 ${best} 分`;fabricSound(true);
}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3100);}
function fabricSound(chime=false){if(!audioCtx)return;const now=audioCtx.currentTime;if(chime){[440,554.37,659.25].forEach((freq,i)=>{const osc=audioCtx.createOscillator(),g=audioCtx.createGain();osc.type='sine';osc.frequency.value=freq;g.gain.setValueAtTime(0,now+i*.18);g.gain.linearRampToValueAtTime(.04,now+i*.18+.04);g.gain.exponentialRampToValueAtTime(.001,now+i*.18+1.7);osc.connect(g).connect(audioCtx.destination);osc.start(now+i*.18);osc.stop(now+i*.18+1.8);});}else{const buffer=audioCtx.createBuffer(1,audioCtx.sampleRate*.15,audioCtx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()-.5)*.025*(1-i/data.length);const source=audioCtx.createBufferSource();source.buffer=buffer;const filter=audioCtx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1800;source.connect(filter).connect(audioCtx.destination);source.start();}}
async function toggleSound(){
  if(audioCtx){await audioCtx.close();audioCtx=null;audioNodes=[];$('sound').setAttribute('aria-label','開啟環境音');$('sound').title='開啟環境音';$('sound').style.color='';toast('環境音已關閉');return;}
  try{audioCtx=new(window.AudioContext||window.webkitAudioContext)();await audioCtx.resume();const buffer=audioCtx.createBuffer(1,audioCtx.sampleRate*3,audioCtx.sampleRate),data=buffer.getChannelData(0);let last=0;for(let i=0;i<data.length;i++){last=(last+(Math.random()*2-1)*.02)/1.02;data[i]=last*.18;}const source=audioCtx.createBufferSource();source.buffer=buffer;source.loop=true;const gain=audioCtx.createGain();gain.gain.value=.12;source.connect(gain).connect(audioCtx.destination);source.start();audioNodes.push(source,gain);$('sound').setAttribute('aria-label','關閉環境音');$('sound').title='關閉環境音';$('sound').style.color='#b64b32';toast('環境音已開啟 · 微風與布料聲');}catch(e){audioCtx=null;toast('此瀏覽器暫時無法播放環境音。');}
}
function saveImage(){
  const c=document.createElement('canvas');c.width=1200;c.height=1400;const ctx=c.getContext('2d');ctx.fillStyle='#eeece5';ctx.fillRect(0,0,1200,1400);
  const source=renderer.domElement;const scale=Math.min(1200/source.width,1130/source.height);ctx.drawImage(source,(1200-source.width*scale)/2,35,source.width*scale,source.height*scale);
  ctx.fillStyle='#657159';ctx.font='40px "Noto Serif TC", serif';ctx.textAlign='center';ctx.fillText('打包垃圾，讓臺北順起來',600,1230);ctx.font='23px "Noto Sans TC", sans-serif';ctx.fillText(`${bagInfo[state.bag].name}  /  ${$('total-score').textContent} 分`,600,1290);ctx.fillStyle='#969d8a';ctx.font='17px sans-serif';ctx.fillText('洋流飄帶練習室 · 非官方創作',600,1340);
  c.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='洋流-我的飄帶作品.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('作品已匯出為 PNG。');});
}

document.querySelectorAll('.bag-option').forEach(b=>b.onclick=()=>selectBag(b.dataset.bag));
document.querySelectorAll('.ribbon-option').forEach(b=>b.onclick=()=>selectRibbon(b.dataset.ribbon));
$('start').onclick=teach;$('back').onclick=()=>setPhase(0);$('again').onclick=()=>setPhase(0);
$('finish').onclick=finish;$('save-image').onclick=saveImage;$('reset-view').onclick=resetView;
$('rotate').onclick=()=>{autoRotate=!autoRotate;$('rotate').classList.toggle('active',autoRotate);};
$('demo').onclick=()=>{if(drag||grips.size)return;retryStep('這一步重新開始。',run.mode==='challenge');};
['left-length','right-length','tension'].forEach(id=>$(id).addEventListener('input',syncAdjust));
$('sound').onclick=toggleSound;$('help').onclick=()=>$('help-dialog').showModal();document.querySelectorAll('.close,.close-help').forEach(b=>b.onclick=()=>$('help-dialog').close());
$('help-dialog').onclick=e=>{if(e.target===$('help-dialog')){const r=$('help-dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('help-dialog').close();}};
document.addEventListener('visibilitychange',()=>{gameLast=0;if(drag)drag.holdTickAt=0;if(audioCtx)document.hidden?audioCtx.suspend():audioCtx.resume();});
initScene();

$('inspiration').onclick=()=>$('inspiration-dialog').showModal();document.querySelectorAll('.close-inspiration').forEach(b=>b.onclick=()=>$('inspiration-dialog').close());
$('retry-challenge').onclick=()=>{$('timeout-dialog').close();begin();};
$('continue-practice').onclick=()=>{$('timeout-dialog').close();run.mode='practice';run.expired=false;setStep();};
$('timeout-dialog').addEventListener('cancel',e=>e.preventDefault());
