import assert from 'node:assert/strict';
import {createCraftDemo} from '../craft-demo.js';
let total=0;const check=(name,fn)=>{fn();total++;console.log('PASS '+name);};
const near=(actual,expected,epsilon=1e-9)=>assert.ok(Math.abs(actual-expected)<=epsilon,`${actual} != ${expected}`);
const maxDifference=(a,b)=>Math.max(...a.map((value,index)=>Math.abs(value-b[index])));
function advance(sequence,seconds,{rpm=18,dt=.01,currentAngle=1.7}={}){
 let time=0;
 while(time<seconds-1e-12){const step=Math.min(dt,seconds-time);sequence.step({dt:step,rpm,currentAngle});time+=step;}
 return sequence.snapshot();
}

check('初始是素色简单陶坯，完整制作按顺序留在成品',()=>{
 const sequence=createCraftDemo(),initial=sequence.snapshot(),seen=[initial.phase];
 assert.equal(initial.phase,'clay');assert.equal(initial.profile.length,129);near(initial.heightScale,.72);
 assert.equal(initial.glazeProgress,0);assert.equal(initial.laserProgress,0);assert.equal(initial.laserActive,false);assert.equal(initial.rotation,0);
 assert.ok(Math.max(...initial.profile)-Math.min(...initial.profile)<.04);
 for(let i=0;i<1210;i++){
  const state=sequence.step({dt:.01,rpm:18,currentAngle:1.7});
  if(state.phase!==seen.at(-1))seen.push(state.phase);
 }
 assert.deepEqual(seen,['clay','shape','glaze','engrave','complete']);
 const done=sequence.snapshot();assert.equal(done.progress,1);assert.equal(done.phaseProgress,1);assert.equal(done.glazeProgress,1);assert.equal(done.laserProgress,1);assert.equal(done.laserActive,false);assert.ok(Number.isFinite(done.rotation));assert.equal(done.heightScale,1);
 const later=advance(sequence,10);assert.equal(later.phase,'complete');assert.equal(later.progress,1);assert.deepEqual(later.profile,done.profile);assert.ok(later.rotation>done.rotation);
});
check('腹部先扩、颈部后收、最后翻口，不是均匀改形',()=>{
 const sequence=createCraftDemo(),initial=sequence.snapshot().profile;
 const early=advance(sequence,.4+3.2*.3),belly=26,neck=109,rim=128;
 assert.ok(early.profile[belly]>initial[belly]+.1);near(early.profile[neck],initial[neck]);near(early.profile[rim],initial[rim]);
 assert.ok(early.toolHeight>.1&&early.toolHeight<.4);
 const late=advance(sequence,3.2*.5);assert.ok(late.profile[neck]<initial[neck]-.05);assert.ok(late.profile[neck]>.41);assert.ok(late.profile[rim]<.6);
 const finished=advance(sequence,3.2*.2);assert.equal(finished.phase,'glaze');near(finished.profile[rim],.62);near(finished.profile[0],.56);assert.equal(finished.toolHeight,null);
 for(let index=Math.ceil(.31*128);index<=Math.floor(.63*128);index++)assert.ok(finished.profile[index]>.9,'金印所在腹部必须连续宽阔');
 assert.ok(finished.profile[neck]<.44);assert.ok(finished.profile[55]>1);
});
check('塑形和上釉阶段没有提前印记，刻印只在釉面完成后开始',()=>{
 const sequence=createCraftDemo();
 const shape=advance(sequence,2);assert.equal(shape.phase,'shape');assert.equal(shape.glazeProgress,0);assert.equal(shape.laserProgress,0);
 const glaze=advance(sequence,2.4);assert.equal(glaze.phase,'glaze');assert.ok(glaze.glazeProgress>0&&glaze.glazeProgress<1);assert.equal(glaze.laserProgress,0);assert.equal(glaze.laserActive,false);
 const aligned=advance(sequence,.9);assert.equal(aligned.phase,'engrave');assert.equal(aligned.glazeProgress,1);near(aligned.laserProgress,0);assert.equal(aligned.laserActive,false);
 const scanning=advance(sequence,2.6);assert.ok(scanning.laserProgress>0);assert.equal(scanning.laserActive,true);
});
check('阶段边界的轮廓、高度和釉面连续，总进度单调',()=>{
 for(const boundary of [.4,3.6,5.3,7.67,9.47,10.12]){
  const sequence=createCraftDemo(),before=advance(sequence,boundary-1e-6),after=sequence.step({dt:2e-6,rpm:18,currentAngle:1.7});
  assert.ok(maxDifference(before.profile,after.profile)<1e-5);near(before.heightScale,after.heightScale,1e-5);near(before.glazeProgress,after.glazeProgress,1e-5);near(before.laserProgress,after.laserProgress,1e-5);near(before.progress,after.progress,1e-5);assert.ok(after.progress>=before.progress);
 }
});
check('刻印入口持续持有展示角，外部物理角不会覆盖当前姿态',()=>{
 const sequence=createCraftDemo();sequence.reset(-9);
 const before=advance(sequence,5.3-1e-5,{currentAngle:2.7});
 const entered=sequence.step({dt:1e-5,rpm:18,currentAngle:200});assert.equal(entered.phase,'engrave');
 assert.ok(entered.rotation>=before.rotation);assert.ok(entered.rotation-before.rotation<.00002);near(entered.angularVelocity,before.angularVelocity,1e-8);
 const aligning=sequence.step({dt:.01,rpm:18,currentAngle:-200});assert.ok(aligning.rotation>entered.rotation);assert.ok(aligning.rotation-entered.rotation<.019);
});
check('任一制作阶段停跑或未知动力均不加工，扫描立即熄光后可续刻',()=>{
 for(const seconds of [.2,1.6,4.2,8.1,9.6]){
  const sequence=createCraftDemo(),before=advance(sequence,seconds);
  for(const input of [{rpm:18,powered:false},{rpm:0},{rpm:null},{rpm:undefined},{rpm:NaN},{rpm:Infinity},{rpm:-1},{rpm:'18'}]){
   const paused=sequence.step({dt:.1,...input});assert.equal(paused.phase,before.phase);near(paused.progress,before.progress);near(paused.laserProgress,before.laserProgress);assert.deepEqual(paused.profile,before.profile);assert.ok(paused.rotation>=before.rotation);assert.equal(paused.laserActive,false);
  }
  const resumed=sequence.step({dt:.03,rpm:18});assert.ok(resumed.progress>before.progress);
  if(seconds===8.1){assert.equal(resumed.laserActive,true);near(resumed.laserProgress,before.laserProgress+.03/1.8);}
 }
});
check('没有动力的初始页面不会自行开始，也不在恢复后追补时间',()=>{
 const sequence=createCraftDemo(),initial=sequence.snapshot();
 for(let index=0;index<100;index++)assert.deepEqual(sequence.step({dt:10,rpm:0}),initial);
 near(sequence.step({dt:.1,rpm:18}).phaseProgress,.25);
});
check('非法帧时长不推进并熄光，超长帧最多消费0.1秒',()=>{
 const sequence=createCraftDemo(),before=advance(sequence,8);
 for(const dt of [0,-1,NaN,Infinity,null,undefined,'0.1']){
  const state=sequence.step({dt,rpm:18});near(state.progress,before.progress);near(state.laserProgress,before.laserProgress);assert.equal(state.laserActive,false);
 }
 near(sequence.step({dt:10,rpm:18}).laserProgress,before.laserProgress+.1/1.8);
});
check('低速不会虚设加工下限，高速有上限',()=>{
 const slow=createCraftDemo(),normal=createCraftDemo(),fast=createCraftDemo(),veryFast=createCraftDemo();
 near(advance(slow,2,{rpm:9}).progress,advance(normal,1).progress);
 near(advance(fast,1,{rpm:45}).progress,advance(veryFast,1,{rpm:1e8}).progress);
 const tiny=createCraftDemo();near(tiny.step({dt:.1,rpm:.018}).phaseProgress,.00025);
});
check('24/60/144 FPS 在形变和刻印阶段得到相同结果',()=>{
 for(const seconds of [1.23,3.6,4.57,5.43,6.23,8.2]){
  const states=[24,60,144].map(fps=>advance(createCraftDemo(),seconds,{rpm:23,dt:1/fps}));
  for(const state of states.slice(1)){
   const first=states[0];assert.equal(state.phase,first.phase);near(state.phaseProgress,first.phaseProgress);near(state.progress,first.progress);assert.ok(maxDifference(state.profile,first.profile)<1e-9);near(state.glazeProgress,first.glazeProgress);near(state.laserProgress,first.laserProgress);assert.equal(state.laserActive,first.laserActive);
   if(first.rotation===null)assert.equal(state.rotation,0);else near(state.rotation,first.rotation);
  }
 }
});
check('减少动态效果无需动力直接展示完整成品，取消后不自动重播',()=>{
 const sequence=createCraftDemo(),state=sequence.step({reducedMotion:true,powered:false,rpm:0,dt:0});
 assert.equal(state.phase,'complete');assert.equal(state.progress,1);assert.equal(state.heightScale,1);assert.equal(state.glazeProgress,1);assert.equal(state.laserProgress,1);assert.equal(state.laserActive,false);assert.equal(state.rotation,0);
 assert.deepEqual(sequence.step({dt:.1,rpm:18,reducedMotion:false}),state);
 const replay=sequence.reset(3);assert.equal(replay.phase,'clay');assert.equal(replay.progress,0);assert.equal(replay.laserProgress,0);assert.equal(replay.glazeProgress,0);assert.equal(replay.rotation,3);assert.ok(Math.max(...replay.profile)<.6);
});
check('快照和轮廓冻结且实例互不污染，旧轮廓不会随后形变',()=>{
 const sequence=createCraftDemo(),other=createCraftDemo(),initial=sequence.snapshot(),copy=initial.profile.slice();
 assert.ok(Object.isFrozen(sequence));assert.ok(Object.isFrozen(initial));assert.ok(Object.isFrozen(initial.profile));assert.notEqual(initial.profile,other.snapshot().profile);
 assert.throws(()=>{initial.profile[50]=9;},TypeError);assert.throws(()=>{initial.phase='complete';},TypeError);
 const next=advance(sequence,2);assert.notEqual(next.profile,initial.profile);assert.ok(Object.isFrozen(next.profile));assert.deepEqual(initial.profile,copy);assert.deepEqual(other.snapshot().profile,copy);
 const nextCopy=next.profile.slice();advance(sequence,2);assert.deepEqual(next.profile,nextCopy);
});
check('非法点数恢复129点；所有过程中半径和高度始终安全',()=>{
 for(const count of [0,1,-1,NaN,Infinity,2.5,'129',2000])assert.equal(createCraftDemo({count}).snapshot().profile.length,129);
 assert.equal(createCraftDemo({count:65}).snapshot().profile.length,65);
 const sequence=createCraftDemo();sequence.reset(NaN);
 for(let index=0;index<820;index++){
  const state=sequence.step({dt:.01,rpm:18,currentAngle:NaN});
  assert.ok(state.profile.every(value=>Number.isFinite(value)&&value>=.24&&value<=1.23));assert.ok(state.heightScale>=.72&&state.heightScale<=1);assert.ok(Number.isFinite(state.progress));
  assert.ok(state.rotation===null||Number.isFinite(state.rotation));assert.ok(state.toolHeight===null||Number.isFinite(state.toolHeight));
 }
});
check('完整制作与重播逐帧核验角速度：不倒转、不超速、阶段交接无加速尖峰',()=>{
 const sequence=createCraftDemo(),dt=1/60,limit=18/60*Math.PI*2;
 let previous=sequence.snapshot(),previousV=0,maxJump=0,stages=new Set();
 for(let index=0;index<1600;index++){
  if(index===1050){const replay=sequence.reset(previous.rotation,previous.angularVelocity);near(replay.rotation,previous.rotation);near(replay.angularVelocity,previous.angularVelocity);previous=replay;}
  const state=sequence.step({dt,rpm:18}),v=(state.rotation-previous.rotation)/dt;
  assert.ok(v>=-1e-8,'不能出现倒转帧');assert.ok(v<=limit+1e-8,'不得为对正提速');
  maxJump=Math.max(maxJump,Math.abs(v-previousV));assert.ok(Math.abs(v-previousV)<.065,'切换阶段的角速度必须连续');
  stages.add(state.phase);previous=state;previousV=v;
 }
 assert.equal(stages.size,5);assert.ok(maxJump>0,'测试必须覆盖实际起转和减速');
});
check('扫描静止时重播也从当前角和零速度重新起转',()=>{
 const sequence=createCraftDemo(),before=advance(sequence,8.2);assert.equal(before.engravingPhase,'scan');near(before.angularVelocity,0);
 const replay=sequence.reset(before.rotation,before.angularVelocity);near(replay.rotation,before.rotation);near(replay.angularVelocity,0);
 const first=sequence.step({dt:1/60,rpm:18});assert.ok(first.rotation>replay.rotation);assert.ok((first.rotation-replay.rotation)*60<.03);assert.ok(first.angularVelocity<.06);
});
check('完成后真实RPM改变仍驱动展示，停跑平滑停止，未知时不加工',()=>{
 const sequence=createCraftDemo();advance(sequence,16);
 const fast=advance(sequence,5,{rpm:36});near(fast.angularVelocity,36/60*Math.PI*2,.001);
 const start=sequence.snapshot(),first=sequence.step({dt:1/60,rpm:0,powered:false});assert.ok(first.rotation>start.rotation);assert.ok(first.angularVelocity<start.angularVelocity);
 const stopped=advance(sequence,7,{rpm:0});assert.ok(stopped.angularVelocity<.0001);assert.equal(stopped.phase,'complete');assert.equal(stopped.laserProgress,1);
 const initial=createCraftDemo();for(let index=0;index<100;index++)initial.step({dt:.1,rpm:null,powered:false});assert.equal(initial.snapshot().rotation,0);assert.equal(initial.snapshot().progress,0);
});
console.log(`RESULT ${total}/${total}`);
