const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy;const t=d?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/d):0;return distance(p,{x:a.x+t*dx,y:a.y+t*dy});}

// Checkpoints must be crossed in order; reaching only the endpoint cannot tie a loop.
export class TraceGesture{
  constructor(points,tolerance=.18){this.points=points;this.tolerance=tolerance;this.index=1;this.last=points[0];this.length=0;this.error=0;this.weight=0;this.reference=points.slice(1).reduce((s,p,i)=>s+distance(p,points[i]),0);}
  move(p){const moved=distance(p,this.last);let deviation=Infinity;for(let i=1;i<this.points.length;i++)deviation=Math.min(deviation,segmentDistance(p,this.points[i-1],this.points[i]));this.length+=moved;this.error+=deviation*moved;this.weight+=moved;let passed=0;
    while(this.index<this.points.length&&segmentDistance(this.points[this.index],this.last,p)<=this.tolerance){this.index++;passed++;}
    this.last={...p};return passed;
  }
  get progress(){return (this.index-1)/(this.points.length-1);}
  get complete(){return this.index===this.points.length&&distance(this.last,this.points.at(-1))<this.tolerance*1.8;}
  get quality(){return clamp(1-(this.error/Math.max(.001,this.weight))*.95-Math.max(0,this.length/this.reference-1.2)*.16,.15,1);}
}
export class PullHold{
  constructor(){this.ratio=0;this.held=0;this.overheld=0;this.slipped=false;}
  move(ratio){this.ratio=clamp(ratio,0,1.35);if(this.ratio<.65||this.ratio>.82)this.held=0;if(this.ratio<=1.02)this.overheld=0;}
  tick(dt){if(this.ratio>=.65&&this.ratio<=.82)this.held+=dt;else this.held=0;if(this.ratio>1.02)this.overheld+=dt;else this.overheld=0;if(this.overheld>.25)this.slipped=true;}
  get ready(){return !this.slipped&&this.held>=.8&&this.ratio>=.65&&this.ratio<=.82;}
  get quality(){return clamp(1-Math.abs(this.ratio-.735)*1.8,.1,1);}
}
export class EarBalance{
  constructor(){this.left=0;this.right=0;}
  move(side,ratio){this[side]=clamp(ratio,0,1.3);}
  get difference(){return Math.abs(this.left-this.right);}
  get ready(){return this.left>=.82&&this.right>=.82&&this.left<=1.1&&this.right<=1.1&&this.difference<.13;}
  get quality(){return clamp(1-this.difference*1.2-(Math.abs(this.left-1)+Math.abs(this.right-1))*.45,.1,1);}
}
