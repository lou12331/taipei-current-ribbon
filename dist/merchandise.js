import * as THREE from './assets/three.module.js';

export function createMerchandise(radiusAtY){
  const group=new THREE.Group();group.name='packed-blurred-merchandise';
  const cloth=new THREE.MeshStandardMaterial({color:0xe4dfce,roughness:.87});
  const blue=new THREE.MeshStandardMaterial({color:0x278ead,roughness:.72});
  const yellow=new THREE.MeshStandardMaterial({color:0xd9bf45,roughness:.77});
  const ink=new THREE.MeshStandardMaterial({color:0x375364,roughness:.78});
  const label=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.83});
  const paper=new THREE.MeshStandardMaterial({color:0xf1eee4,roughness:.95,flatShading:true});
  const kraft=new THREE.MeshStandardMaterial({color:0xc9a678,roughness:.92});
  const bottle=new THREE.MeshPhysicalMaterial({color:0xbfe3ea,roughness:.18,metalness:0,clearcoat:.6});
  const cap=new THREE.MeshStandardMaterial({color:0x2d6f8f,roughness:.5});
  const tin=new THREE.MeshStandardMaterial({color:0xcfd3d0,roughness:.35,metalness:.7});
  new THREE.TextureLoader().load('assets/merch-mark-blurred.png',texture=>{texture.colorSpace=THREE.SRGBColorSpace;label.map=texture;label.needsUpdate=true;});
  const radius=radiusAtY||((y)=>Math.max(.25,1.5-Math.max(0,y-1.2)*.6));
  const mark=(host,w,h,z)=>{const p=new THREE.Mesh(new THREE.PlaneGeometry(w,h),label);p.position.z=z;host.add(p);};
  let seed=74139;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const pick=list=>list[Math.floor(random()*list.length)];

  // Campaign merchandise.
  function tote(color){const g=new THREE.Group();g.add(new THREE.Mesh(new THREE.BoxGeometry(.7,.78,.22,2,2,1),color));mark(g,.56,.55,.116);
    for(const z of [-.08,.08]){const loop=new THREE.Mesh(new THREE.TorusGeometry(.19,.027,7,28,Math.PI),color);loop.position.set(0,.39,z);g.add(loop);}return g;}
  function badge(color){const g=new THREE.Group(),b=new THREE.Mesh(new THREE.CylinderGeometry(.25,.25,.055,32),color);b.rotation.x=Math.PI/2;g.add(b);const face=new THREE.Mesh(new THREE.CircleGeometry(.235,32),label);face.position.z=.032;g.add(face);return g;}
  function hat(){const g=new THREE.Group();g.add(new THREE.Mesh(new THREE.SphereGeometry(.34,24,14,0,Math.PI*2,0,Math.PI/2),blue));const brim=new THREE.Mesh(new THREE.SphereGeometry(.36,20,10),blue);brim.scale.set(1,.08,.64);brim.position.set(0,0,.25);g.add(brim);mark(g,.23,.15,.315);return g;}
  function keychain(){const g=new THREE.Group(),ring=new THREE.Mesh(new THREE.TorusGeometry(.095,.015,7,25),ink);ring.position.y=.28;g.add(ring);g.add(new THREE.Mesh(new THREE.BoxGeometry(.33,.4,.065),yellow));mark(g,.29,.34,.036);return g;}
  function mug(){const g=new THREE.Group(),points=[new THREE.Vector2(.17,0),new THREE.Vector2(.19,.03),new THREE.Vector2(.21,.42),new THREE.Vector2(.188,.42),new THREE.Vector2(.165,.055),new THREE.Vector2(.01,.055),new THREE.Vector2(.01,0)];g.add(new THREE.Mesh(new THREE.LatheGeometry(points,28),cloth));const handle=new THREE.Mesh(new THREE.TorusGeometry(.13,.034,8,26),cloth);handle.position.set(.24,.23,0);g.add(handle);const print=new THREE.Group();print.position.y=.23;mark(print,.26,.22,.204);g.add(print);g.children.forEach(c=>c.position.y-=.21);return g;}
  function flyer(){const g=new THREE.Group(),sheet=new THREE.Mesh(new THREE.BoxGeometry(.46,.62,.02,4,4,1),paper),p=sheet.geometry.attributes.position;
    for(let i=0;i<p.count;i++)p.setZ(i,p.getZ(i)+Math.sin(p.getX(i)*7+p.getY(i)*3)*.025);sheet.geometry.computeVertexNormals();g.add(sheet);mark(g,.38,.4,.04);return g;}
  // Everyday rubbish packed in with it.
  function crumple(material){const geo=new THREE.IcosahedronGeometry(.2,1),p=geo.attributes.position,v=new THREE.Vector3();
    for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const n=.72+.42*Math.abs(Math.sin(v.x*17+v.y*11)*Math.cos(v.z*13-v.y*7));p.setXYZ(i,v.x*n,v.y*n*.9,v.z*n);}
    geo.computeVertexNormals();return new THREE.Mesh(geo,material);}
  function pet(){const g=new THREE.Group(),pts=[[0,-.3],[.11,-.3],[.12,-.26],[.12,.08],[.07,.2],[.045,.25],[.045,.29],[0,.29]].map(([x,y])=>new THREE.Vector2(x,y));
    g.add(new THREE.Mesh(new THREE.LatheGeometry(pts,20),bottle));const c=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.05,14),cap);c.position.y=.31;g.add(c);
    const wrap=new THREE.Mesh(new THREE.CylinderGeometry(.122,.122,.14,20,1,true),pick([blue,yellow,cloth]));wrap.position.y=-.08;g.add(wrap);g.rotation.z=Math.PI/2;const outer=new THREE.Group();outer.add(g);return outer;}
  function can(){const g=new THREE.Group(),body=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,.3,20),pick([blue,yellow,tin])),p=body.geometry.attributes.position;
    for(let i=0;i<p.count;i++){const y=p.getY(i);if(Math.abs(y)<.12){const k=1-.22*Math.max(0,Math.sin(Math.atan2(p.getZ(i),p.getX(i))*2+1));p.setX(i,p.getX(i)*k);p.setZ(i,p.getZ(i)*k);}}
    body.geometry.computeVertexNormals();g.add(body);const lid=new THREE.Mesh(new THREE.CylinderGeometry(.1,.11,.02,20),tin);lid.position.y=.16;g.add(lid);g.rotation.z=Math.PI/2*random();const outer=new THREE.Group();outer.add(g);return outer;}
  function carton(){const g=new THREE.Group(),box=new THREE.Mesh(new THREE.BoxGeometry(.42,.34,.3),kraft);g.add(box);const tape=new THREE.Mesh(new THREE.BoxGeometry(.43,.06,.31),pick([blue,yellow]));g.add(tape);return g;}

  const makers=[
    [()=>tote(pick([cloth,cloth,blue,yellow])),.62,6],[hat,.72,4],[()=>badge(random()>.5?yellow:blue),.95,5],[keychain,.95,3],[mug,.95,3],[flyer,.9,3],
    [()=>crumple(random()>.3?paper:kraft),1.1,5],[pet,1,4],[can,1.05,3],[carton,.9,3]
  ];
  const totalWeight=makers.reduce((s,m)=>s+m[2],0);
  const randomItem=()=>{let r=random()*totalWeight;for(const m of makers){r-=m[2];if(r<=0)return m;}return makers[0];};

  // Push an item outward along its yaw until any vertex would touch the bag skin.
  const vertex=new THREE.Vector3();
  function fit(item,phi,y,margin){
    item.position.set(0,0,0);item.updateMatrixWorld(true);const cloud=[];
    item.traverse(c=>{if(!c.isMesh)return;const p=c.geometry.attributes.position,step=Math.max(1,Math.floor(p.count/90));for(let i=0;i<p.count;i+=step){vertex.fromBufferAttribute(p,i).applyMatrix4(c.matrixWorld);cloud.push(vertex.x,vertex.y,vertex.z);}});
    const sx=Math.sin(phi),sz=Math.cos(phi);
    const inside=d=>{for(let i=0;i<cloud.length;i+=3){const py=y+cloud[i+1];if(py<.15)return false;const r=radius(py)-margin;if(r<=0)return false;const px=d*sx+cloud[i],pz=(d*sz+cloud[i+2])/.94;if(px*px+pz*pz>r*r)return false;}return true;};
    if(!inside(0))return null;
    let lo=0,hi=radius(y);for(let k=0;k<18;k++){const mid=(lo+hi)/2;if(inside(mid))lo=mid;else hi=mid;}
    return lo;
  }
  function place(make,phi,y,scale,margin=.07){
    for(let attempt=0;attempt<3;attempt++,scale*=.82){
      const item=make();item.scale.multiplyScalar(scale);
      item.rotation.set((random()-.5)*.5,phi+(random()-.5)*.55,(random()-.5)*.7,'YXZ');
      const d=fit(item,phi,y,margin);if(d===null)continue;
      item.position.set(Math.sin(phi)*d,y,Math.cos(phi)*d);
      item.traverse(c=>{if(c.isMesh){c.castShadow=true;c.receiveShadow=true;}});group.add(item);return item;
    }
    return null;
  }

  // Outer shell: rings of mixed merchandise and rubbish pressed against the plastic all the way round.
  let featureCount=0;
  for(let ring=0,y=.34;y<2.62;ring++,y+=.37){
    const r=radius(y),count=Math.max(3,Math.round(Math.PI*2*r*.97/(.5+(y>2.2?.06:0)))),shift=(ring%2?.5:0)+random()*.3;
    for(let i=0;i<count;i++){
      const phi=(i+shift)/count*Math.PI*2+(random()-.5)*.18,[make,base]=randomItem();
      if(place(make,phi,y+(random()-.5)*.1,base*(.82+random()*.26)*Math.min(1,r/1.1+.25)))featureCount++;
    }
  }
  // Heaped top just under the gathered neck.
  for(let i=0;i<6;i++){const [make,base]=randomItem();if(place(make,random()*Math.PI*2,2.66+random()*.12,base*.62,.05))featureCount++;}

  // Packed parcels fill the core behind the shell so no gap shows through the gaps between items.
  const buckets=[[],[],[]];
  for(let layer=0,y=.27;y<2.6;layer++,y+=.31){
    const r=radius(y+.15)-.5,offset=layer%2?.18:0;
    for(let x=-1.56+offset;x<=1.56;x+=.39)for(let z=-1.56;z<=1.56;z+=.39){
      if(x*x+z*z>r*r)continue;
      const tone=random(),bin=tone<.4?0:tone<.8?1:2;
      buckets[bin].push({x:x+(random()-.5)*.055,y:y+(random()-.5)*.04,z:z*.94+(random()-.5)*.055,sx:.36+random()*.09,sy:.29+random()*.045,sz:.35+random()*.08,rx:(random()-.5)*.48,ry:(random()-.5)*1.2,rz:(random()-.5)*.4});
    }
  }
  const shape=new THREE.Shape(),edge=.06;
  shape.moveTo(-.5+edge,-.5);shape.lineTo(.5-edge,-.5);shape.quadraticCurveTo(.5,-.5,.5,-.5+edge);shape.lineTo(.5,.5-edge);shape.quadraticCurveTo(.5,.5,.5-edge,.5);shape.lineTo(-.5+edge,.5);shape.quadraticCurveTo(-.5,.5,-.5,.5-edge);shape.lineTo(-.5,-.5+edge);shape.quadraticCurveTo(-.5,-.5,-.5+edge,-.5);
  const parcelGeometry=new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:1,curveSegments:2,steps:1});parcelGeometry.translate(0,0,-.5);
  const transform=new THREE.Object3D();let parcelCount=0;
  buckets.forEach((parcels,index)=>{
    if(!parcels.length)return;
    const mesh=new THREE.InstancedMesh(parcelGeometry,[cloth,blue,yellow][index],parcels.length);mesh.name='packed-parcels-'+index;mesh.castShadow=true;mesh.receiveShadow=true;
    parcels.forEach((p,i)=>{transform.position.set(p.x,p.y,p.z);transform.rotation.set(p.rx,p.ry,p.rz);transform.scale.set(p.sx,p.sy,p.sz);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);mesh.setColorAt(i,new THREE.Color().setScalar(.87+random()*.16));});
    mesh.instanceMatrix.needsUpdate=true;group.add(mesh);parcelCount+=parcels.length;
  });
  group.userData={parcelCount,featureCount,filledTo:2.82};group.visible=false;return group;
}
