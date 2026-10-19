import {readFileSync} from 'node:fs';
import * as THREE from './dist/assets/three.module.js';
const source=readFileSync(new URL('./dist/app.js',import.meta.url),'utf8');
const fn=source.slice(source.indexOf('function bagRadius(')>=0?source.indexOf('function bagRadius('):source.indexOf('function bagGeometry(top){'),source.indexOf('\nfunction createCityPrint('));
const create=new Function('THREE',fn+';return bagGeometry;')(THREE);
const g=create(false);g.computeBoundingBox();const b=g.boundingBox.getSize(new THREE.Vector3());
const ratio=b.z/b.x, aspect=b.y/b.x;
console.log(JSON.stringify({width:+b.x.toFixed(3),depth:+b.z.toFixed(3),height:+b.y.toFixed(3),depthToWidth:+ratio.toFixed(3),heightToWidth:+aspect.toFixed(3)}));
if(ratio<.85 || aspect>1.15) {console.error('FAIL: 垃圾袋側面太扁或袋身過窄');process.exitCode=1;}
else console.log('PASS: 垃圾袋具有飽滿厚度與寬袋身');

