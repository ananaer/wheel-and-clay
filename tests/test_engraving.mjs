import assert from 'node:assert/strict';
import {createEngravingSequence} from '../engraving.js';
let total=0;const check=(name,fn)=>{fn();total++;console.log('PASS '+name);};
const near=(actual,expected,epsilon=1e-10)=>assert.ok(Math.abs(actual-expected)<=epsilon,`${actual} != ${expected}`);
function advance(sequence,seconds,rpm=18,dt=.01){
 let time=0;
 while(time<seconds-1e-12){const step=Math.min(dt,seconds-time);sequence.step({dt:step,rpm});time+=step;}
 return sequence.snapshot();
}

check('初始对正状态无刻痕和发光，按标准转速完成后保留图案并释放展示转角',()=>{
 const sequence=createEngravingSequence(),initial=sequence.snapshot();
 assert.deepEqual(initial,{phase:'align',progress:0,active:false,rotation:.35-.04*Math.PI*2});
 const scanning=advance(sequence,.28+.9);assert.equal(scanning.phase,'scan');near(scanning.progress,.5);assert.equal(scanning.active,true);
 const hold=advance(sequence,.9+.2);assert.equal(hold.phase,'hold');assert.equal(hold.progress,1);assert.equal(hold.active,false);assert.equal(hold.rotation,initial.rotation);
 const done=advance(sequence,.46);assert.deepEqual(done,{phase:'complete',progress:1,active:false,rotation:null});
});
check('扫描随动力快慢推进，低速不设置虚假下限，高速有上限',()=>{
 const slow=createEngravingSequence({alignDuration:0}),fast=createEngravingSequence({alignDuration:0}),verySlow=createEngravingSequence({alignDuration:0});
 near(advance(slow,.9,9).progress,.25);near(advance(fast,.9,36).progress,1);
 near(advance(verySlow,.1,.018).progress,.1*.001/1.8);
 const bounded=createEngravingSequence({alignDuration:0});near(bounded.step({dt:.1,rpm:1e8}).progress,.25/1.8);
});
check('暂停冻结扫描进度和对正姿态，恢复从原位置继续',()=>{
 const sequence=createEngravingSequence();sequence.reset(2.7);
 const aligning=sequence.step({dt:.1,rpm:18});assert.equal(aligning.phase,'align');
 assert.deepEqual(sequence.step({dt:.1,rpm:18,powered:false}),aligning);
 advance(sequence,.4);const scanning=sequence.snapshot();assert.equal(scanning.active,true);
 const paused=sequence.step({dt:.1,rpm:18,powered:false});near(paused.progress,scanning.progress);near(paused.rotation,scanning.rotation);assert.equal(paused.active,false);
 assert.deepEqual(sequence.step({dt:.1,rpm:0}),paused);
 const resumed=sequence.step({dt:.1,rpm:18});near(resumed.progress,scanning.progress+.1/1.8);assert.equal(resumed.active,true);
});
check('未知或非法转速不消耗时间，也不能发光',()=>{
 const sequence=createEngravingSequence({alignDuration:0});sequence.step({dt:.1,rpm:18});const before=sequence.snapshot();
 for(const rpm of [0,-1,NaN,Infinity,-Infinity,null,undefined,'18']){
  const state=sequence.step({dt:.1,rpm});assert.equal(state.phase,before.phase);near(state.progress,before.progress);assert.equal(state.rotation,before.rotation);assert.equal(state.active,false);
 }
 const state=sequence.step({dt:.1,rpm:18,powered:false});near(state.progress,before.progress);assert.equal(state.active,false);
});
check('非法或非正帧时长冻结，超长帧最多推进0.1秒',()=>{
 const sequence=createEngravingSequence({alignDuration:0});sequence.step({dt:.1,rpm:18});const before=sequence.snapshot();
 for(const dt of [0,-.1,NaN,Infinity,null,undefined,'0.1']){
  const state=sequence.step({dt,rpm:18});near(state.progress,before.progress);assert.equal(state.active,false);
 }
 const after=sequence.step({dt:100,rpm:18});near(after.progress,before.progress+.1/1.8);
});
check('阶段边界保留本帧余量，不因不同帧率改变完成进度',()=>{
 const a=createEngravingSequence(),b=createEngravingSequence();
 const first=advance(a,1.23,27,.016),second=advance(b,1.23,27,.07);
 assert.equal(first.phase,second.phase);near(first.progress,second.progress);near(first.rotation,second.rotation);
 const zero=createEngravingSequence({alignDuration:0,scanDuration:.05,holdDuration:0});assert.deepEqual(zero.step({dt:.1,rpm:18}),{phase:'complete',progress:1,active:false,rotation:null});
});
check('完成后不会自行循环，停止动力也不会擦掉刻痕',()=>{
 const sequence=createEngravingSequence();advance(sequence,3);
 const done=sequence.snapshot();for(const input of [{dt:.1,rpm:18},{dt:.1,rpm:0},{dt:.1,rpm:30,powered:false},{}])assert.deepEqual(sequence.step(input),done);
});
check('重播沿最短弧平滑对正，不瞬间归零或倒转整圈',()=>{
 const target=.1,sequence=createEngravingSequence({targetAngle:target});
 const start=2*Math.PI-.1;assert.equal(sequence.reset(start).rotation,start);
 const middle=advance(sequence,.14);near(middle.rotation,2*Math.PI);assert.equal(middle.progress,0);
 const aligned=advance(sequence,.14);near(aligned.rotation,2*Math.PI+.1);
 sequence.reset(4*Math.PI+.3);const backward=advance(sequence,.28);near(backward.rotation,4*Math.PI+.1);
 const reset=sequence.reset(NaN);assert.equal(reset.rotation,target);assert.equal(reset.progress,0);assert.equal(reset.active,false);
});
check('减少动态效果直接得到完整无光图案，不要求有动力',()=>{
 const sequence=createEngravingSequence();assert.deepEqual(sequence.step({reducedMotion:true,powered:false,rpm:0,dt:0}),{phase:'complete',progress:1,active:false,rotation:null});
 assert.equal(sequence.step({dt:.1,rpm:18,reducedMotion:false}).phase,'complete');
});
check('返回快照与API冻结且相互独立，外部不能改内部时序',()=>{
 const sequence=createEngravingSequence(),old=sequence.snapshot(),next=sequence.step({dt:.1,rpm:18});
 assert.ok(Object.isFrozen(sequence));assert.ok(Object.isFrozen(old));assert.ok(Object.isFrozen(next));assert.notEqual(old,next);
 assert.throws(()=>{old.progress=.9;},TypeError);assert.equal(old.progress,0);assert.equal(sequence.snapshot().phase,'align');
});
check('无效配置恢复安全默认，不产生NaN或卡住阶段循环',()=>{
 const sequence=createEngravingSequence({alignDuration:NaN,scanDuration:0,holdDuration:-1,targetAngle:Infinity});
 const done=advance(sequence,3);assert.deepEqual(done,{phase:'complete',progress:1,active:false,rotation:null});
});
console.log(`RESULT ${total}/${total}`);
