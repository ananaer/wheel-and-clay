/* 原创音景《木与光》：低音区柔钢琴、木质泛音与缓起弦垫。跑轮只改变轻敲与转盘声。 */
export const SCORE = Object.freeze({ bpm: 58, beats: 48, title: ['木与光', 'Wood & Light'] });
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const hz = note => 440 * 2 ** ((note - 69) / 12);

// 同一套 PCM 同时用于页面播放和离线试听，避免验收音频与实际成品不一致。
export function renderMusic(sampleRate = 32000) {
  const beat = 60 / SCORE.bpm, length = Math.round(SCORE.beats * beat * sampleRate);
  const dry = [new Float32Array(length), new Float32Array(length)];
  function note(midi, startBeat, seconds, gain, pan, pad = false) {
    const frequency = hz(midi), start = Math.round(startBeat * beat * sampleRate);
    const count = Math.round(seconds * sampleRate);
    const left = Math.cos((pan + 1) * Math.PI / 4), right = Math.sin((pan + 1) * Math.PI / 4);
    for (let i = 0; i < count; i++) {
      const t = i / sampleRate, end = Math.min(1, (seconds - t) / (pad ? 2.4 : .25));
      const attack = 1 - Math.exp(-t / (pad ? 1.6 : .036));
      const decay = Math.exp(-t / (pad ? 10 : 2.0));
      const phase = 2 * Math.PI * frequency * t;
      const tone = pad
        ? Math.sin(phase) + .25 * Math.sin(phase * 1.0011) + .065 * Math.sin(phase * 2)
        : Math.sin(phase) + .14 * Math.exp(-t * 1.3) * Math.sin(phase * 2.002) + .032 * Math.exp(-t * 2.4) * Math.sin(phase * 3.006);
      const value = tone * attack * decay * end * end * gain;
      const at = (start + i) % length;
      dry[0][at] += value * left; dry[1][at] += value * right;
    }
  }
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
  let peak = 0;
  for (const channel of channels) for (const value of channel) peak = Math.max(peak, Math.abs(value));
  const scale = peak > 0 ? .42 / peak : 1;
  for (const channel of channels) for (let i=0;i<length;i++) channel[i] *= scale;
  return { sampleRate, channels, duration: length / sampleRate };
}

export function renderTap(sampleRate = 32000) {
  const data = new Float32Array(Math.round(sampleRate * .22));
  for (let i=0;i<data.length;i++) {
    const t=i/sampleRate, envelope=(1-Math.exp(-t/.0025))*Math.exp(-t*37)*(1-t/.22);
    data[i]=envelope*(Math.sin(t*2*Math.PI*190)+.32*Math.sin(t*2*Math.PI*487)+.08*Math.sin(t*2*Math.PI*936))*.55;
  }
  return data;
}

export function createSoundscape({onChange=()=>{}}={}) {
  let context, master, music, wheel, wheelGain, analyser, meterData, timer, suspendTimer, nextBeat=0, beatIndex=0;
  let on=false, starting=false, volume=.36, wheelEnabled=true, activity=0, error=false, intent=0, disposed=false;
  let startPromise=null, cancelResume=null;
  const cachedBuffers = new Map();
  const playing=()=>on&&context?.state==='running'&&!disposed;
  function changed(){onChange({on:playing(),starting,volume,wheelEnabled,error,contextState:context?.state||'uninitialized'});}
  function buffer(data) {
    const result=context.createBuffer(data.channels.length,data.channels[0].length,data.sampleRate);
    data.channels.forEach((channel,i)=>result.copyToChannel(channel,i)); return result;
  }
  function initialize(){
    if(context&&context.state!=='closed')return;
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio)throw Error('Audio unavailable');
    context=new Audio();music=null;wheel=null;wheelGain=null;cachedBuffers.clear();
    master=context.createGain();master.gain.value=0;analyser=context.createAnalyser();analyser.fftSize=1024;meterData=new Float32Array(1024);master.connect(analyser);analyser.connect(context.destination);
    const ownedContext=context;
    context.addEventListener('statechange',()=>{
      if(disposed||context!==ownedContext)return;
      if(context.state!=='running'){clearInterval(timer);timer=null;}
      else if(on){beginSchedule();updateLevels();}
      changed();
    });
  }
  function build(){
    if(music)return;
    music=context.createBufferSource();music.buffer=buffer(renderMusic());music.loop=true;music.connect(master);music.start();
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
    const now=context.currentTime, beat=60/SCORE.bpm;
    if(nextBeat<now-.5)nextBeat=now+.04;
    while(nextBeat<now+.14){
      if(wheelEnabled&&activity>.5&&beatIndex%(activity>=30?2:4)===0){
        const tap=context.createBufferSource(),gain=context.createGain();tap.buffer=cachedBuffers.get('tap');
        gain.gain.value=activity>=30?.045:.028;tap.connect(gain);gain.connect(master);
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
        build();on=true;nextBeat=context.currentTime+.1;updateLevels();beginSchedule();return true;
      }catch(e){if(request!==intent)return false;on=false;error=true;updateLevels();throw e;}
      finally{if(request===intent){starting=false;startPromise=null;changed();}}
    })();
    return startPromise;
  }
  return {
    get contextState(){return context?.state||'uninitialized';},get level(){if(!analyser||context.state!=='running')return 0;analyser.getFloatTimeDomainData(meterData);let sum=0;for(const value of meterData)sum+=value*value;return Math.sqrt(sum/meterData.length);},
    get on(){return playing();},get starting(){return starting;},get volume(){return volume;},get wheelEnabled(){return wheelEnabled;},
    start,
    stop(){
      intent++;on=false;starting=false;cancelResume?.();startPromise=null;clearInterval(timer);timer=null;updateLevels();clearTimeout(suspendTimer);
      if(context&&context.state!=='closed')suspendTimer=setTimeout(()=>{if(!on&&!starting)context.suspend().catch(()=>{});},400);
      changed();
    },
    setVolume(value){volume=clamp(Number(value)||0,0,1);updateLevels();changed();},
    setWheelEnabled(value){wheelEnabled=!!value;updateLevels();changed();},
    update(rpm){const next=clamp(Number(rpm)||0,0,120);if(Math.abs(next-activity)<.1&&next!==0)return;activity=next;updateLevels();},
    dispose(){intent++;on=false;starting=false;disposed=true;cancelResume?.();startPromise=null;clearInterval(timer);timer=null;clearTimeout(suspendTimer);context?.close().catch(()=>{});}
  };
}
