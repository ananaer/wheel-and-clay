import assert from 'node:assert/strict';
import {createEngravingSequence} from '../engraving.js';
let total=0;const check=(name,fn)=>{fn();total++;console.log('PASS '+name);};
const TAU=Math.PI*2,OMEGA=18/60*TAU;
const near=(actual,expected,epsilon=1e-9)=>assert.ok(Math.abs(actual-expected)<=epsilon,`${actual} != ${expected}`);
function advance(sequence,seconds,rpm=18,dt=.01){
 let time=0;while(time<seconds-1e-12){const frame=Math.min(dt,seconds-time);sequence.step({dt:frame,rpm});time+=frame;}return sequence.snapshot();
}
check('已正面静止时直接扫描，完成后保留图案与数值朝向',()=>{
 const sequence=createEngravingSequence(),initial=sequence.snapshot();
 assert.equal(initial.phase,'align');assert.equal(initial.progress,0);assert.equal(initial.angularVelocity,0);
 const scanning=advance(sequence,.9);assert.equal(scanning.phase,'scan');near(scanning.progress,.5);
 const hold=advance(sequence,1.1);assert.equal(hold.phase,'hold');assert.equal(hold.progress,1);near(hold.rotation,initial.rotation);
 const done=advance(sequence,.45);assert.equal(done.phase,'complete');assert.equal(done.progress,1);assert.equal(done.active,false);assert.ok(Number.isFinite(done.rotation));near(done.angularVelocity,0);
});
check('扫描随动力推进，极低速不伪造下限，高速有加工上限',()=>{
 near(advance(createEngravingSequence(),.9,9).progress,.25);near(advance(createEngravingSequence(),.9,36).progress,1);
 near(advance(createEngravingSequence(),.1,.018).progress,.1*.001/1.8);
 near(createEngravingSequence().step({dt:.1,rpm:1e8}).progress,.25/1.8);
});
check('扫描暂停立即熄光，原处恢复，不追补丢失时间',()=>{
 const sequence=createEngravingSequence(),before=advance(sequence,.8);
 const paused=sequence.step({dt:.1,rpm:18,powered:false});near(paused.progress,before.progress);near(paused.rotation,before.rotation);assert.equal(paused.active,false);
 for(let index=0;index<100;index++)near(sequence.step({dt:1,rpm:0}).progress,before.progress);
 near(sequence.step({dt:.1,rpm:18}).progress,before.progress+.1/1.8);
});
check('未知或非法速度不能加工或发光',()=>{
 const sequence=createEngravingSequence(),before=advance(sequence,.3);
 for(const rpm of [0,-1,NaN,Infinity,-Infinity,null,undefined,'18']){
  const state=sequence.step({dt:.1,rpm});near(state.progress,before.progress);near(state.rotation,before.rotation);assert.equal(state.active,false);
 }
});
check('非法时长冻结且长帧最多消费0.1秒',()=>{
 const sequence=createEngravingSequence(),before=advance(sequence,.3);
 for(const dt of [0,-.1,NaN,Infinity,null,undefined,'0.1'])near(sequence.step({dt,rpm:18}).progress,before.progress);
 near(sequence.step({dt:100,rpm:18}).progress,before.progress+.1/1.8);
});
check('任意起始朝向都向前定位，速度不超过入场速度，减速与静止边界连续',()=>{
 for(const start of [-20,-.1,.3,1.7,2.7,7,12.7,38.781]){
  const sequence=createEngravingSequence(),initial=sequence.reset(start,OMEGA);near(initial.rotation,start);
  let previous=initial,previousV=OMEGA,scanned=false;
  for(let index=0;index<1000;index++){
   const state=sequence.step({dt:1/120,rpm:18}),v=(state.rotation-previous.rotation)*120;
   assert.ok(v>=-1e-8,'轮盘不能倒转');assert.ok(v<=OMEGA+1e-8,'对正不能突然冲刺');
   assert.ok(Math.abs(v-previousV)<.04,'对正角速度不能跨帧跳变');
   if(state.phase==='scan'){near(Math.sin(state.rotation-(.35-.04*TAU)),0);assert.ok(v<.003);scanned=true;break;}
   previous=state;previousV=v;
  }
  assert.ok(scanned,'必须能到达前方印章朝向');
 }
});
check('完成后从零平滑恢复真实输入速度，期间更改RPM仍生效',()=>{
 const sequence=createEngravingSequence();advance(sequence,2.45);
 const before=sequence.snapshot(),first=sequence.step({dt:1/60,rpm:18});assert.ok(first.rotation>before.rotation);assert.ok(first.angularVelocity<.06);
 const settled=advance(sequence,5);near(settled.angularVelocity,OMEGA,.001);
 const faster=advance(sequence,5,36);near(faster.angularVelocity,OMEGA*2,.001);
 const stopped=advance(sequence,6,0);assert.ok(stopped.angularVelocity<.001);assert.equal(stopped.progress,1);assert.equal(stopped.active,false);
});
check('阶段余量在24/60/144FPS下给出相同角度和加工进度',()=>{
 for(const seconds of [.4,1.3,3.1,4.9,7]){
  const states=[24,60,144].map(fps=>{const sequence=createEngravingSequence();sequence.reset(2.7,OMEGA);return advance(sequence,seconds,18,1/fps);});
  for(const state of states.slice(1)){const first=states[0];assert.equal(state.phase,first.phase);near(state.progress,first.progress);near(state.rotation,first.rotation);near(state.angularVelocity,first.angularVelocity);}
 }
});
check('减少动态效果固定完整图案，撤销偏好后不自动重播或起转',()=>{
 const sequence=createEngravingSequence();sequence.reset(7,OMEGA);const state=sequence.step({reducedMotion:true,powered:false,rpm:0,dt:0});
 assert.equal(state.phase,'complete');assert.equal(state.progress,1);assert.equal(state.angularVelocity,0);assert.equal(state.rotation,7);
 assert.deepEqual(sequence.step({dt:.1,rpm:18}),state);
});
check('配置与快照异常不会污染内部时序',()=>{
 const sequence=createEngravingSequence({alignDuration:NaN,scanDuration:0,holdDuration:-1,targetAngle:Infinity});
 const old=sequence.snapshot();assert.ok(Object.isFrozen(sequence));assert.ok(Object.isFrozen(old));assert.throws(()=>{old.progress=.9;},TypeError);
 assert.equal(advance(sequence,3).phase,'complete');assert.equal(old.phase,'align');assert.ok(Number.isFinite(sequence.reset(NaN).rotation));
});
console.log(`RESULT ${total}/${total}`);
