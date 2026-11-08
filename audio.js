/* 四首原创程序音景；跑轮只改变轻敲与转盘声，不伪装为音乐节拍来源。 */
export const TRACKS = Object.freeze([
  {id:'wood-light',bpm:58,beats:48,title:['木与光','Wood & Light'],mood:['柔钢琴 · 木质泛音','Soft piano · wooden overtones']},
  {id:'rain-window',bpm:52,beats:32,title:['雨窗','Rain at the Window'],mood:['细雨 · 稀疏琴音','Soft rain · scattered keys']},
  {id:'seed-song',bpm:64,beats:48,title:['籽间','Between the Seeds'],mood:['暖木拨弦 · 慢拍','Warm plucked strings · easy rhythm']},
  {id:'moon-nest',bpm:42,beats:32,title:['月下小窝','Moonlit Nest'],mood:['低音弦垫 · 夜间留白','Low pads · room for quiet']}
].map(track=>Object.freeze({...track,title:Object.freeze(track.title),mood:Object.freeze(track.mood)})));
export const SCORE = TRACKS[0];
const scoreFor = id => TRACKS.find(track=>track.id===id);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const hz = note => 440 * 2 ** ((note - 69) / 12);

// 同一套 PCM 同时用于页面播放和离线试听，避免验收音频与实际成品不一致。
export function renderMusic(sampleRate = 32000, trackId = SCORE.id) {
  const score=scoreFor(trackId);if(!score)throw new RangeError('Unknown soundscape');
  const beat = 60 / score.bpm, length = Math.round(score.beats * beat * sampleRate);
  const dry = [new Float32Array(length), new Float32Array(length)];
  function note(midi, startBeat, seconds, gain, pan, pad = false, voice = 'piano') {
    const frequency = hz(midi), start = Math.round(startBeat * beat * sampleRate);
    const count = Math.round(seconds * sampleRate);
    const left = Math.cos((pan + 1) * Math.PI / 4), right = Math.sin((pan + 1) * Math.PI / 4);
    for (let i = 0; i < count; i++) {
      const t = i / sampleRate, end = Math.min(1, (seconds - t) / (pad ? 2.4 : .25));
      const attack = 1 - Math.exp(-t / (pad ? 1.6 : voice==='pluck' ? .012 : .036));
      const decay = Math.exp(-t / (pad ? 10 : voice==='pluck' ? .9 : 2.0));
      const phase = 2 * Math.PI * frequency * t;
      const tone = pad
        ? Math.sin(phase) + .25 * Math.sin(phase * 1.0011) + .065 * Math.sin(phase * 2)
        : voice==='pluck' ? Math.sin(phase)+.32*Math.exp(-t*1.6)*Math.sin(phase*2)+.12*Math.exp(-t*3.2)*Math.sin(phase*3)+.035*Math.exp(-t*6)*Math.sin(phase*5)
        : Math.sin(phase) + .14 * Math.exp(-t * 1.3) * Math.sin(phase * 2.002) + .032 * Math.exp(-t * 2.4) * Math.sin(phase * 3.006);
      const value = tone * attack * decay * end * end * gain;
      const at = (start + i) % length;
      dry[0][at] += value * left; dry[1][at] += value * right;
    }
  }
  if(trackId==='wood-light'){
  // 每句十二拍，旋律留出呼吸，不用鼓组、尖亮铃音或强拍催促手势。
  const chords = [[53, 57, 60, 64], [48, 55, 59, 64], [50, 57, 60, 65], [48, 55, 60, 62]];
  const phrases = [
    [[1,65],[5,64],[9.5,60]],
    [[2,64],[7,62],[10.5,59]],
    [[1,65],[5.5,64],[9,60]],
    [[2,62],[6.5,60],[10.5,55]]
  ];
  chords.forEach((chord, bar) => {
    chord.forEach((midi, i) => note(midi, bar * 12 + i * .045, 14.4, .029, (i - 1.5) * .24, true));
    phrases[bar].forEach(([time, midi], i) => note(midi, bar * 12 + time, 6.8, i ? .13 : .15, Math.sin(bar * 2 + i) * .28));
    note(chord[0] - 12, bar * 12 + .35, 9, .055, 0, true);
  });
  }else if(trackId==='rain-window'){
    // 雨声先做双层低通再取差，去掉白噪的刺耳高频；环形预热保持循环点连续。
    const noise=new Float32Array(length);let seed=73129;
    for(let i=0;i<length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;noise[i]=seed/2147483648-1;}
    for(let ch=0;ch<2;ch++){
      let fast=0,slow=0;const shift=ch*Math.round(sampleRate*.137);
      for(let i=-8192;i<length;i++){
        const value=noise[((i+shift)%length+length)%length];fast+=.055*(value-fast);slow+=.006*(value-slow);
        if(i>=0){const drift=.76+.18*Math.sin(i/length*Math.PI*4+ch*.6);dry[ch][i]+=(fast-slow)*drift*.3;}
      }
    }
    const rainChords=[[50,57,62],[48,55,60],[46,53,60],[48,55,62]];
    rainChords.forEach((chord,bar)=>{
      chord.forEach((midi,i)=>note(midi,bar*8+i*.12,11,.021,(i-1)*.4,true));
      note([62,60,65,57][bar],bar*8+2.8,5.2,.073,bar%2?.35:-.35);
    });
  }else if(trackId==='seed-song'){
    // 独立的六拍拨弦句：短木质起音、错开的低弦，不复用钢琴旋律。
    const roots=[48,53,55,50,48,53,55,48],patterns=[[0,7,12,16,12],[0,9,12,16,7],[0,7,14,19,14],[0,7,12,15,7]];
    roots.forEach((root,bar)=>{
      const pattern=patterns[bar%4];
      [0,.9,2.25,3.6,4.8].forEach((at,i)=>note(root+pattern[i],bar*6+at,3.2,i===0?.12:.085,Math.sin(bar+i)*.32,false,'pluck'));
      note(root-12,bar*6+.1,7,.045,0,true);
      if(bar%2===0)note(root+7,bar*6+3.1,8,.017,.2,true);
    });
  }else{
    // 夜间音景靠四个长和声呼吸，几乎不含重复节奏；低声部有独立旋律线。
    [[41,48,53,60],[43,50,57,62],[38,45,53,60],[41,48,55,60]].forEach((chord,bar)=>{
      chord.forEach((midi,i)=>note(midi,bar*8+i*.23,17,.038,(i-1.5)*.36,true));
      if(bar===0||bar===2)note(chord[3]+5,bar*8+5.5,7.5,.045,bar===0?-.4:.4);
    });
  }
  const channels = dry.map(channel => channel.slice());
  // 环形尾音让四句自然衔接；不使用有接缝的文件拼接。
  for (const [delay, level] of [[.27,.11],[.49,.085],[.83,.06],[1.31,.035],[1.89,.018]]) {
    const offset = Math.round(delay * sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      let low = 0;
      // 先用循环末尾预热滤波器，首尾延迟状态一致，避免循环点轻响。
      for(let i=length-128;i<length;i++)low += .17 * (dry[1-ch][(i-offset+length)%length]-low);
      for (let i = 0; i < length; i++) {
        low += .17 * (dry[1-ch][(i - offset + length) % length] - low);
        channels[ch][i] += low * level;
      }
    }
  }
  let peak = 0,energy=0;
  for (const channel of channels) for (const value of channel){peak=Math.max(peak,Math.abs(value));energy+=value*value;}
  const rms=Math.sqrt(energy/(length*2));
  const scale = peak > 0 ? Math.min(.42/peak,.105/Math.max(rms,1e-9)) : 1;
  for (const channel of channels) for (let i=0;i<length;i++) channel[i] *= scale;
  return { sampleRate, channels, duration: length / sampleRate, trackId:score.id };
}

export function renderTap(sampleRate = 32000) {
  const data = new Float32Array(Math.round(sampleRate * .22));
  for (let i=0;i<data.length;i++) {
    const t=i/sampleRate, envelope=(1-Math.exp(-t/.0025))*Math.exp(-t*37)*(1-t/.22);
    data[i]=envelope*(Math.sin(t*2*Math.PI*190)+.32*Math.sin(t*2*Math.PI*487)+.08*Math.sin(t*2*Math.PI*936))*.55;
  }
  return data;
}

export function createSoundscape({onChange=()=>{},WorkerCtor=globalThis.Worker}={}) {
  let context, master, music, musicGain, wheel, wheelGain, analyser, meterData, timer, suspendTimer, nextBeat=0, beatIndex=0;
  let on=false, starting=false, volume=.36, wheelEnabled=true, activity=0, error=false, intent=0, disposed=false;
  let startPromise=null, cancelResume=null, trackId=SCORE.id, preparingTrackId=null, trackIntent=0;
  let synthWorker=null, workerUrl=null, workerDisabled=false, renderSerial=0;
  const renderedTracks=new Map(),renderingTracks=new Map(),renderRequests=new Map();
  // Worker 内嵌以保持单文件交付；仅传输本项目自己生成的 PCM，不访问网络。
  function finishWorker(){
    synthWorker?.terminate();synthWorker=null;
    if(workerUrl){URL.revokeObjectURL(workerUrl);workerUrl=null;}
    for(const request of renderRequests.values()){clearTimeout(request.timeout);request.reject(Error('Audio worker unavailable'));}
    renderRequests.clear();
  }
  function worker(){
    if(synthWorker)return synthWorker;
    if(workerDisabled||typeof WorkerCtor!=='function')return null;
    try{
      const source=`const TRACKS=${JSON.stringify(TRACKS)};const SCORE=TRACKS[0];const scoreFor=${scoreFor.toString()};const hz=${hz.toString()};${renderMusic.toString()};onmessage=({data})=>{try{const audio=renderMusic(data.sampleRate,data.trackId);postMessage({id:data.id,audio},audio.channels.map(channel=>channel.buffer));}catch(error){postMessage({id:data.id,error:String(error)});}};`;
      workerUrl=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
      synthWorker=new WorkerCtor(workerUrl);
      synthWorker.onmessage=({data})=>{
        const request=renderRequests.get(data.id);if(!request)return;
        renderRequests.delete(data.id);clearTimeout(request.timeout);
        if(data.error)request.reject(Error(data.error));else request.resolve(data.audio);
      };
      synthWorker.onerror=()=>{workerDisabled=true;finishWorker();};
      return synthWorker;
    }catch{workerDisabled=true;finishWorker();return null;}
  }
  async function prepareTrack(value){
    if(disposed||!scoreFor(value))return false;
    if(renderedTracks.has(value))return true;
    if(renderingTracks.has(value))return renderingTracks.get(value);
    const promise=(async()=>{
      let data;
      try{
        const target=worker();if(!target)throw Error('Audio worker unavailable');
        data=await new Promise((resolve,reject)=>{
          const id=++renderSerial;
          const timeout=setTimeout(()=>{workerDisabled=true;finishWorker();},15000);
          renderRequests.set(id,{resolve,reject,timeout});
          try{target.postMessage({id,trackId:value,sampleRate:32000});}catch(error){clearTimeout(timeout);renderRequests.delete(id);reject(error);}
        });
      }catch{
        if(disposed)return false;
        // 旧浏览器保留可用性；先让出主线程，再执行有界的离线合成。
        await new Promise(resolve=>setTimeout(resolve,0));if(disposed)return false;
        data=renderMusic(32000,value);
      }
      if(disposed)return false;renderedTracks.set(value,data);return true;
    })();
    renderingTracks.set(value,promise);
    try{return await promise;}finally{if(renderingTracks.get(value)===promise)renderingTracks.delete(value);}
  }
  const retiringMusic=new Set();
  const cachedBuffers = new Map();
  const playing=()=>on&&context?.state==='running'&&!disposed;
  function changed(){onChange({on:playing(),starting,volume,wheelEnabled,error,contextState:context?.state||'uninitialized',trackId,preparingTrackId});}
  function buffer(data) {
    const result=context.createBuffer(data.channels.length,data.channels[0].length,data.sampleRate);
    data.channels.forEach((channel,i)=>result.copyToChannel(channel,i)); return result;
  }
  function initialize(){
    if(context&&context.state!=='closed')return;
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio)throw Error('Audio unavailable');
    context=new Audio();music=null;musicGain=null;wheel=null;wheelGain=null;cachedBuffers.clear();retiringMusic.clear();
    master=context.createGain();master.gain.value=0;analyser=context.createAnalyser();analyser.fftSize=1024;meterData=new Float32Array(1024);master.connect(analyser);analyser.connect(context.destination);
    const ownedContext=context;
    context.addEventListener('statechange',()=>{
      if(disposed||context!==ownedContext)return;
      if(context.state!=='running'){clearInterval(timer);timer=null;}
      else if(on){beginSchedule();updateLevels();}
      changed();
    });
  }
  function replaceMusic(crossfade=false){
    const old=music,oldGain=musicGain;
    const key='music:'+trackId;
    if(!cachedBuffers.has(key)){
      let data=renderedTracks.get(trackId);
      if(!data){data=renderMusic(32000,trackId);renderedTracks.set(trackId,data);}
      cachedBuffers.set(key,buffer(data));
    }
    const now=context.currentTime;
    const next=context.createBufferSource(),nextGain=context.createGain();
    next.buffer=cachedBuffers.get(key);next.loop=true;nextGain.gain.value=crossfade?0:1;
    next.connect(nextGain);nextGain.connect(master);next.start();music=next;musicGain=nextGain;
    if(crossfade)nextGain.gain.setTargetAtTime(1,now,.22);
    if(old){
      const retiring={source:old,gain:oldGain};retiringMusic.add(retiring);
      old.onended=()=>{old.disconnect();oldGain.disconnect();retiringMusic.delete(retiring);};
      oldGain.gain.setTargetAtTime(0,now,crossfade?.18:.01);old.stop(now+(crossfade?.9:.03));
    }
  }
  function build(){
    if(music)return;
    replaceMusic();
    const rate=32000,data=new Float32Array(rate*2);
    for(let i=0;i<data.length;i++){const t=i/rate;data[i]=(.7*Math.sin(t*2*Math.PI*38)+.12*Math.sin(t*2*Math.PI*76))*.12;}
    wheel=context.createBufferSource();wheel.buffer=buffer({sampleRate:rate,channels:[data]});wheel.loop=true;
    wheelGain=context.createGain();wheelGain.gain.value=0;wheel.connect(wheelGain);wheelGain.connect(master);wheel.start();
    cachedBuffers.set('tap',buffer({sampleRate:32000,channels:[renderTap()]}));
  }
  function updateLevels(){
    if(!master||context.state==='closed')return;
    const now=context.currentTime;
    master.gain.setTargetAtTime(playing()?volume*.62:0,now,playing()&&volume>0?.65:.055);
    wheelGain?.gain.setTargetAtTime(playing()&&wheelEnabled?Math.min(.12,activity*.004):0,now,.45);
    wheel?.playbackRate.setTargetAtTime(.8+Math.min(activity,70)*.012,now,.4);
  }
  function schedule(){
    if(!playing())return;
    const now=context.currentTime, beat=60/scoreFor(trackId).bpm;
    if(nextBeat<now-.5)nextBeat=now+.04;
    while(nextBeat<now+.14){
      if(wheelEnabled&&activity>.5&&beatIndex%(activity>=23?2:4)===0){
        const tap=context.createBufferSource(),gain=context.createGain();tap.buffer=cachedBuffers.get('tap');
        gain.gain.value=activity>=23?.045:.028;tap.connect(gain);gain.connect(master);
        tap.onended=()=>{tap.disconnect();gain.disconnect();};tap.start(nextBeat);
      }
      nextBeat+=beat;beatIndex++;
    }
  }
  function beginSchedule(){clearInterval(timer);timer=setInterval(schedule,50);schedule();}
  function resume(request){
    // 有些浏览器会让未获用户手势的 resume 永远 pending；允许明确取消或重新尝试。
    return new Promise((resolve,reject)=>{
      let settled=false;
      const finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timeout);if(cancelResume===cancel)cancelResume=null;fn(value);};
      const cancel=()=>finish(resolve,false);
      const timeout=setTimeout(()=>finish(reject,Error('Audio permission not granted')),2500);
      cancelResume=cancel;
      try{Promise.resolve(context.resume()).then(()=>finish(resolve,request===intent),error=>finish(reject,error));}
      catch(error){finish(reject,error);}
    });
  }
  function start(){
    if(disposed)return Promise.reject(Error('Audio has been disposed'));
    if(playing())return Promise.resolve(true);
    if(starting)return startPromise;
    const request=++intent;starting=true;on=false;error=false;clearTimeout(suspendTimer);changed();
    startPromise=(async()=>{
      try{
        initialize();if(!await resume(request)||request!==intent)return false;
        if(context.state!=='running')throw Error('Audio not running');
        // 准备期间允许选曲；只用最新选择启动，暂停/销毁不会被晚到结果唤醒。
        let readyTrack;
        do{readyTrack=trackId;if(!await prepareTrack(readyTrack)||request!==intent)return false;}while(readyTrack!==trackId);
        if(context.state!=='running')throw Error('Audio not running');
        build();on=true;nextBeat=context.currentTime+.1;updateLevels();beginSchedule();return true;
      }catch(e){if(request!==intent)return false;on=false;error=true;updateLevels();throw e;}
      finally{if(request===intent){starting=false;startPromise=null;changed();}}
    })();
    return startPromise;
  }
  return {
    get contextState(){return context?.state||'uninitialized';},get level(){if(!analyser||context.state!=='running')return 0;analyser.getFloatTimeDomainData(meterData);let sum=0;for(const value of meterData)sum+=value*value;return Math.sqrt(sum/meterData.length);},
    get on(){return playing();},get starting(){return starting;},get volume(){return volume;},get wheelEnabled(){return wheelEnabled;},get trackId(){return trackId;},get preparingTrackId(){return preparingTrackId;},
    start,
    stop(){
      intent++;on=false;starting=false;cancelResume?.();startPromise=null;clearInterval(timer);timer=null;updateLevels();clearTimeout(suspendTimer);
      if(context&&context.state!=='closed')suspendTimer=setTimeout(()=>{if(!on&&!starting)context.suspend().catch(()=>{});},400);
      changed();
    },
    prepareTrack,
    async setTrackAsync(value){
      if(disposed||!scoreFor(value))return false;
      const request=++trackIntent;
      // 未建立声源时只保存选择，仍由用户播放动作启动音频。
      if(!music||context?.state==='closed')return this.setTrack(value);
      preparingTrackId=value;changed();
      try{
        if(!await prepareTrack(value)||request!==trackIntent||disposed)return false;
        return this.setTrack(value);
      }catch{
        if(request===trackIntent&&!disposed){error=true;changed();}return false;
      }finally{
        if(request===trackIntent){preparingTrackId=null;changed();}
      }
    },
    setTrack(value){
      if(disposed||!scoreFor(value))return false;
      trackIntent++;preparingTrackId=null;
      if(value===trackId){changed();return true;}
      const previous=trackId;trackId=value;
      try{if(music&&context?.state!=='closed'){replaceMusic(playing());nextBeat=context.currentTime+.1;beatIndex=0;}}
      catch(e){trackId=previous;error=true;changed();return false;}
      error=false;changed();return true;
    },
    setVolume(value){volume=clamp(Number(value)||0,0,1);updateLevels();changed();},
    setWheelEnabled(value){wheelEnabled=!!value;updateLevels();changed();},
    update(rpm){const next=clamp(Number(rpm)||0,0,120);if(Math.abs(next-activity)<.1&&next!==0)return;activity=next;updateLevels();},
    dispose(){intent++;trackIntent++;preparingTrackId=null;finishWorker();renderedTracks.clear();on=false;starting=false;disposed=true;cancelResume?.();startPromise=null;clearInterval(timer);timer=null;clearTimeout(suspendTimer);for(const item of retiringMusic){try{item.source.stop();}catch{}item.source.disconnect();item.gain.disconnect();}retiringMusic.clear();try{music?.stop();wheel?.stop();}catch{}context?.close().catch(()=>{});}
  };
}
