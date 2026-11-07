import assert from 'node:assert/strict';
import {Worker as NodeWorker} from 'node:worker_threads';
import {createSoundscape, renderMusic, renderTap, TRACKS, SCORE} from '../audio.js';
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

check('四首曲目有独立稳定标识、双语名称和不同配器描述',()=>{
 assert.equal(TRACKS.length,4);assert.equal(new Set(TRACKS.map(t=>t.id)).size,4);assert.equal(SCORE.id,'wood-light');
 for(const spec of TRACKS){assert.ok(spec.title.every(Boolean));assert.ok(spec.mood.every(Boolean));assert.ok(spec.bpm>=40&&spec.bpm<=70);assert.ok(Object.isFrozen(spec));}
});
const variants=TRACKS.map(spec=>renderMusic(12000,spec.id));
check('四首曲目有实质音频、温和响度和安全动态余量',()=>{
 for(const music of variants){let energy=0,peak=0;for(const c of music.channels)for(const value of c){assert.ok(Number.isFinite(value));energy+=value*value;peak=Math.max(peak,Math.abs(value));}
  const rms=Math.sqrt(energy/(music.channels[0].length*2));assert.ok(peak<=.421&&peak>.1);assert.ok(rms>.02&&rms<=.106);assert.ok(music.duration>=35&&music.duration<=60);
 }
});
check('曲目音符与纹理确实不同，不是同一PCM改播放速度',()=>{
 for(let a=0;a<variants.length;a++)for(let b=a+1;b<variants.length;b++){
  const x=variants[a].channels[0],y=variants[b].channels[0];let sumX=0,sumY=0,dot=0;
  for(let i=0;i<Math.min(x.length,y.length);i+=11){sumX+=x[i]*x[i];sumY+=y[i]*y[i];dot+=x[i]*y[i];}
  assert.ok(Math.abs(dot/Math.sqrt(sumX*sumY))<.4,`${TRACKS[a].id}/${TRACKS[b].id}过于相似`);
 }
});
check('各曲循环接缝不超过邻近音频的自然变化',()=>{
 for(const music of variants)for(const c of music.channels){let largest=0;for(let i=1;i<2048;i++)largest=Math.max(largest,Math.abs(c[i]-c[i-1]),Math.abs(c.at(-i)-c.at(-i-1)));assert.ok(Math.abs(c[0]-c.at(-1))<=largest*1.25);}
});

// 可控 AudioContext 只模拟浏览器权限/生命周期，不替代真实浏览器音频验收。
class FakeAudioContext {
 static nextResume=null;
 static instances=[];
 constructor(){this.state='suspended';this.currentTime=0;this.destination={};this.listeners=[];this.resumeCalls=0;this.sourceCount=0;this.sources=[];this.gains=[];this.behaviour=FakeAudioContext.nextResume;FakeAudioContext.nextResume=null;FakeAudioContext.instances.push(this);}
 addEventListener(type,listener){if(type==='statechange')this.listeners.push(listener);}
 transition(next){this.state=next;for(const listener of this.listeners)listener();}
 resume(){this.resumeCalls++;if(this.behaviour)return this.behaviour(this);this.transition('running');return Promise.resolve();}
 suspend(){this.transition('suspended');return Promise.resolve();}
 close(){this.transition('closed');return Promise.resolve();}
 createGain(){const gain={gain:{value:0,targets:[],setTargetAtTime(value,time,constant){this.value=value;this.targets.push({value,time,constant});}},connect(){},disconnect(){this.disconnected=true;}};this.gains.push(gain);return gain;}
 createAnalyser(){return {fftSize:0,connect(){},getFloatTimeDomainData(values){values.fill(.015);}};}
 createBuffer(channels,length,sampleRate){return {numberOfChannels:channels,length,sampleRate,copyToChannel(){}};}
 createBufferSource(){this.sourceCount++;const source={playbackRate:{setTargetAtTime(){}},connect(node){this.output=node;},disconnect(){this.disconnected=true;},start(){this.started=true;},stop(at=0){this.stoppedAt=at;if(at<=0)this.onended?.();}};this.sources.push(source);return source;}
}
// 用 Node 的原生线程执行相同 Blob 源码，证明合成确实在独立线程且可被销毁。
class ThreadWorker {
 constructor(url){
  this.stopped=false;
  this.ready=fetch(url).then(response=>response.text()).then(source=>{
   if(this.stopped)return;
   this.thread=new NodeWorker(`const {parentPort}=require('node:worker_threads');global.postMessage=(data,transfer)=>parentPort.postMessage(data,transfer);global.onmessage=null;${source};parentPort.on('message',data=>onmessage({data}));`,{eval:true});
   this.thread.on('message',data=>this.onmessage?.({data}));this.thread.on('error',error=>this.onerror?.(error));
  }).catch(error=>this.onerror?.(error));
 }
 postMessage(data){this.ready.then(()=>{if(!this.stopped)this.thread?.postMessage(data);});}
 terminate(){this.stopped=true;this.thread?.terminate();}
}
class ControlledWorker {
 static instances=[];
 constructor(){this.requests=[];this.stopped=false;ControlledWorker.instances.push(this);}
 postMessage(data){this.requests.push(data);}
 complete(id){const request=this.requests.find(item=>item.trackId===id);assert.ok(request);this.onmessage?.({data:{id:request.id,audio:{sampleRate:32000,channels:[new Float32Array(32),new Float32Array(32)],trackId:id}}});}
 terminate(){this.stopped=true;}
}
const nextTask=()=>new Promise(resolve=>setTimeout(resolve,0));
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
 await checkAsync('选曲不初始化音频或绕过用户播放授权',async()=>{
  const before=FakeAudioContext.instances.length,states=[],sound=createSoundscape({onChange:s=>states.push(s)});
  assert.equal(sound.trackId,'wood-light');assert.equal(sound.setTrack('rain-window'),true);assert.equal(sound.trackId,'rain-window');assert.equal(states.at(-1).trackId,'rain-window');assert.equal(sound.on,false);assert.equal(FakeAudioContext.instances.length,before);
  assert.equal(sound.setTrack('missing-track'),false);assert.equal(sound.trackId,'rain-window');sound.dispose();
 });
 await checkAsync('播放中切歌使用交叉淡入淡出，同曲选择不重建声源',async()=>{
  const sound=createSoundscape();await sound.start();const ctx=FakeAudioContext.instances.at(-1),old=ctx.sources[0];ctx.currentTime=10;
  assert.equal(sound.setTrack('seed-song'),true);assert.equal(sound.on,true);assert.equal(sound.trackId,'seed-song');assert.equal(ctx.sourceCount,3);
  const next=ctx.sources.at(-1);assert.equal(old.stoppedAt,10.9);assert.equal(old.output.gain.targets.at(-1).value,0);assert.equal(next.output.gain.targets.at(-1).value,1);assert.ok(next.output.gain.targets.at(-1).constant>0);
  sound.setTrack('seed-song');assert.equal(ctx.sourceCount,3);sound.dispose();assert.equal(ctx.state,'closed');assert.ok(old.disconnected);
 });
 await checkAsync('暂停换曲保持暂停，重开时不重复创建当前声源',async()=>{
  const sound=createSoundscape();await sound.start();sound.stop();assert.equal(sound.on,false);sound.setTrack('moon-nest');assert.equal(sound.on,false);
  const ctx=FakeAudioContext.instances.at(-1),count=ctx.sourceCount;await sound.start();assert.equal(sound.on,true);assert.equal(sound.trackId,'moon-nest');assert.equal(ctx.sourceCount,count);sound.dispose();
 });
 await checkAsync('权限等待期间换曲以最新选择启动，快速切换后可安全暂停销毁',async()=>{
  let grant;FakeAudioContext.nextResume=ctx=>new Promise(resolve=>grant=()=>{ctx.transition('running');resolve();});
  const sound=createSoundscape(),start=sound.start();sound.setTrack('rain-window');sound.setTrack('seed-song');grant();await start;
  assert.equal(sound.trackId,'seed-song');assert.equal(sound.on,true);
  for(const id of ['moon-nest','rain-window','wood-light','seed-song'])assert.equal(sound.setTrack(id),true);
  assert.equal(sound.trackId,'seed-song');sound.stop();assert.equal(sound.on,false);sound.dispose();
  const ctx=FakeAudioContext.instances.at(-1);assert.equal(ctx.state,'closed');assert.ok(ctx.sources.every(source=>source.stoppedAt!==undefined));assert.equal(sound.setTrack('wood-light'),false);
 });
 await checkAsync('真实 Worker 合成不阻塞准备态，缓存选曲无需再次合成',async()=>{
  const sound=createSoundscape({WorkerCtor:ThreadWorker});
  try{
   const pending=sound.start();await nextTask();assert.equal(sound.starting,true);assert.equal(sound.on,false);
   assert.equal(await pending,true);assert.equal(sound.on,true);
   const change=sound.setTrackAsync('rain-window');assert.equal(sound.preparingTrackId,'rain-window');assert.equal(sound.trackId,'wood-light');
   await nextTask();assert.equal(sound.preparingTrackId,'rain-window');assert.equal(sound.on,true);
   assert.equal(await change,true);assert.equal(sound.trackId,'rain-window');assert.equal(sound.preparingTrackId,null);
   assert.equal(await sound.setTrackAsync('wood-light'),true);
  }finally{sound.dispose();}
 });
 await checkAsync('异步快速切曲只采用最新选择，准备期间暂停不会自启',async()=>{
  const sound=createSoundscape({WorkerCtor:ControlledWorker});
  try{
   const start=sound.start();await nextTask();const worker=ControlledWorker.instances.at(-1);worker.complete('wood-light');await start;
   const first=sound.setTrackAsync('rain-window'),second=sound.setTrackAsync('seed-song');
   assert.equal(sound.preparingTrackId,'seed-song');assert.equal(sound.trackId,'wood-light');sound.stop();
   worker.complete('seed-song');assert.equal(await second,true);assert.equal(sound.trackId,'seed-song');assert.equal(sound.on,false);
   worker.complete('rain-window');assert.equal(await first,false);assert.equal(sound.trackId,'seed-song');assert.equal(sound.preparingTrackId,null);
  }finally{sound.dispose();}
 });
 await checkAsync('合成期间销毁会结束 Worker，晚到 PCM 不创建声源',async()=>{
  const sound=createSoundscape({WorkerCtor:ControlledWorker}),pending=sound.start();await nextTask();
  const worker=ControlledWorker.instances.at(-1),ctx=FakeAudioContext.instances.at(-1);sound.dispose();
  assert.equal(await pending,false);assert.equal(worker.stopped,true);worker.complete('wood-light');assert.equal(ctx.sourceCount,0);assert.equal(sound.on,false);assert.equal(await sound.setTrackAsync('rain-window'),false);
 });
 await checkAsync('不支持 Worker 的浏览器仍可异步准备并切曲',async()=>{
  const sound=createSoundscape({WorkerCtor:null});
  try{await sound.start();const pending=sound.setTrackAsync('moon-nest');assert.equal(sound.preparingTrackId,'moon-nest');assert.equal(await pending,true);assert.equal(sound.trackId,'moon-nest');assert.equal(sound.on,true);}finally{sound.dispose();}
 });
}finally{if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;}
console.log(`RESULT ${passed}/26`);
