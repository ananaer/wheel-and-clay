import assert from 'node:assert/strict';
import {createSoundscape, renderMusic, renderTap} from '../audio.js';
import {activityEvidence} from '../activity.js';
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS '+name);}
const track=renderMusic(22050), length=track.channels[0].length;
check('音乐样本有实质能量且不含 NaN 或削波',()=>{let sum=0,peak=0;for(const c of track.channels)for(const v of c){assert.ok(Number.isFinite(v));peak=Math.max(peak,Math.abs(v));sum+=v*v;}assert.ok(peak<.85);assert.ok(Math.sqrt(sum/(length*2))>.02);});
check('循环边界无孤立的幅度跳变',()=>{for(const c of track.channels){let largest=0;for(let i=1;i<2048;i++)largest=Math.max(largest,Math.abs(c[i]-c[i-1]),Math.abs(c.at(-i)-c.at(-i-1)));assert.ok(Math.abs(c[0]-c.at(-1))<=largest*1.25);}});
check('敲击尾音淡到零且不削波',()=>{const tap=renderTap();assert.ok(Math.abs(tap[0])<1e-6);assert.ok(Math.abs(tap.at(-1))<1e-5);assert.ok(tap.every(v=>Number.isFinite(v)&&Math.abs(v)<1));});
const now=Date.parse('2026-11-07T10:00:30Z');
const fixture={generatedAt:'2026-11-07T10:00:19Z',records:{peakObservedRpmMilli:{occurredAt:'2026-11-07T05:09:45.041Z',value:'98316'}}};
check('保留官方峰值记录的精确时间和单位',()=>{assert.deepEqual(activityEvidence(fixture,now),{at:Date.parse('2026-11-07T05:09:45.041Z'),rpm:98.316});});
check('缺记录或零轮速不能声称发生过跑动',()=>{assert.equal(activityEvidence({},now),null);assert.equal(activityEvidence({...fixture,records:{peakObservedRpmMilli:{...fixture.records.peakObservedRpmMilli,value:'0'}}},now),null);});
check('过期统计、未来记录与无效数值不能当作证据',()=>{assert.equal(activityEvidence({...fixture,generatedAt:'2026-11-06T10:00:19Z'},now),null);for(const patch of [{occurredAt:'2026-11-08T10:00:00Z'},{value:'invalid'}])assert.equal(activityEvidence({...fixture,records:{peakObservedRpmMilli:{...fixture.records.peakObservedRpmMilli,...patch}}},now),null);});
check('低音区柔和音景保留足够循环长度与动态余量',()=>{
 let energy=0,changeEnergy=0;
 for(const c of track.channels)for(let i=0;i<c.length;i++){energy+=c[i]*c[i];if(i)changeEnergy+=(c[i]-c[i-1])**2;}
 const weightedFrequency=Math.sqrt(changeEnergy/energy)*track.sampleRate/(2*Math.PI);
 assert.ok(track.duration>45&&track.duration<70);
 assert.ok(weightedFrequency<400,'高频成分不应压过柔和的中低音');
 assert.ok(Math.sqrt(energy/(length*2))<.15);
});

// 可控 AudioContext 只模拟浏览器权限/生命周期，不替代真实浏览器音频验收。
class FakeAudioContext {
 static nextResume=null;
 static instances=[];
 constructor(){this.state='suspended';this.currentTime=0;this.destination={};this.listeners=[];this.resumeCalls=0;this.sourceCount=0;this.behaviour=FakeAudioContext.nextResume;FakeAudioContext.nextResume=null;FakeAudioContext.instances.push(this);}
 addEventListener(type,listener){if(type==='statechange')this.listeners.push(listener);}
 transition(next){this.state=next;for(const listener of this.listeners)listener();}
 resume(){this.resumeCalls++;if(this.behaviour)return this.behaviour(this);this.transition('running');return Promise.resolve();}
 suspend(){this.transition('suspended');return Promise.resolve();}
 close(){this.transition('closed');return Promise.resolve();}
 createGain(){return {gain:{value:0,setTargetAtTime(value){this.value=value;}},connect(){},disconnect(){}};}
 createAnalyser(){return {fftSize:0,connect(){},getFloatTimeDomainData(values){values.fill(.015);}};}
 createBuffer(channels,length,sampleRate){return {numberOfChannels:channels,length,sampleRate,copyToChannel(){}};}
 createBufferSource(){this.sourceCount++;return {playbackRate:{setTargetAtTime(){}},connect(){},disconnect(){},start(){}};}
}
const originalWindow=globalThis.window;globalThis.window={AudioContext:FakeAudioContext};
async function checkAsync(name,run){await run();passed++;console.log('PASS '+name);}
try{
 await checkAsync('无用户操作前未初始化音频且不会声称播放',async()=>{
  const before=FakeAudioContext.instances.length,changes=[];
  const sound=createSoundscape({onChange:value=>changes.push(value)});
  assert.equal(sound.on,false);assert.equal(sound.contextState,'uninitialized');assert.equal(sound.level,0);
  sound.setVolume(.2);assert.equal(changes.at(-1).on,false);assert.equal(FakeAudioContext.instances.length,before);sound.dispose();
 });
 await checkAsync('浏览器拒绝恢复时保持关闭且下一次可重试',async()=>{
  FakeAudioContext.nextResume=()=>Promise.reject(Error('NotAllowedError'));
  const sound=createSoundscape();await assert.rejects(sound.start(),/NotAllowedError/);
  assert.equal(sound.on,false);assert.equal(sound.starting,false);assert.equal(sound.level,0);
  FakeAudioContext.instances.at(-1).behaviour=null;assert.equal(await sound.start(),true);assert.equal(sound.on,true);sound.dispose();
 });
 await checkAsync('resume 已兑现但 Context 未运行时不假装播放',async()=>{
  FakeAudioContext.nextResume=()=>Promise.resolve();const sound=createSoundscape();
  await assert.rejects(sound.start(),/Audio not running/);assert.equal(sound.on,false);assert.equal(sound.starting,false);sound.dispose();
 });
 await checkAsync('系统暂停或中断立即反映关闭，恢复不重复创建音乐源',async()=>{
  const changes=[],sound=createSoundscape({onChange:value=>changes.push(value)});await sound.start();
  const ctx=FakeAudioContext.instances.at(-1),sources=ctx.sourceCount;
  ctx.transition('interrupted');assert.equal(sound.on,false);assert.equal(changes.at(-1).on,false);assert.equal(sound.level,0);
  await sound.start();assert.equal(sound.on,true);assert.equal(ctx.sourceCount,sources);sound.dispose();
 });
 await checkAsync('等待授权时暂停再开启，旧请求不能覆盖新状态',async()=>{
  let lateResume;FakeAudioContext.nextResume=()=>new Promise(resolve=>lateResume=resolve);
  const sound=createSoundscape(),old=sound.start(),ctx=FakeAudioContext.instances.at(-1);
  assert.equal(sound.starting,true);sound.stop();assert.equal(sound.starting,false);assert.equal(sound.on,false);
  ctx.behaviour=null;await sound.start();assert.equal(sound.on,true);
  lateResume();assert.equal(await old,false);assert.equal(sound.on,true);assert.equal(sound.starting,false);sound.dispose();
 });
 await checkAsync('并发启动复用一次恢复，暂停后的淡出定时器不打断重开',async()=>{
  let resolveResume;FakeAudioContext.nextResume=ctx=>new Promise(resolve=>resolveResume=()=>{ctx.transition('running');resolve();});
  const sound=createSoundscape(),first=sound.start(),second=sound.start(),ctx=FakeAudioContext.instances.at(-1);
  assert.equal(first,second);assert.equal(ctx.resumeCalls,1);resolveResume();await first;
  sound.stop();ctx.behaviour=null;await sound.start();await new Promise(resolve=>setTimeout(resolve,450));
  assert.equal(sound.on,true);assert.equal(ctx.state,'running');sound.dispose();
 });
 await checkAsync('未兑现的授权请求超时后可再次点击，不会永久卡在准备中',async()=>{
  FakeAudioContext.nextResume=()=>new Promise(()=>{});const sound=createSoundscape();
  await assert.rejects(sound.start(),/permission not granted/);assert.equal(sound.on,false);assert.equal(sound.starting,false);
  FakeAudioContext.instances.at(-1).behaviour=null;await sound.start();assert.equal(sound.on,true);sound.dispose();
 });
}finally{if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;}
console.log(`RESULT ${passed}/14`);
