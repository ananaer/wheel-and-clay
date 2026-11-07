/* 首页只消费产品统一信号。按钮向应用发请求，不在这里生成模拟或实时数据。 */
export function createHome({root,lang=()=> 'zh',createStudio,onEnter=()=>{},onModeChange=()=>{},onSimChange=()=>{}}={}){
 if(!root)throw new Error('Home root is required');
 const words={
  eyebrow:['Squeektoshi · 全厂唯一动力师','Squeektoshi · Chief of power'],
  title:['一只仓鼠。','One hamster.'],titleAccent:['整间工坊。','A whole studio.'],
  lead:['它决定什么时候开工。\n你决定这块泥变成什么。','He decides when the studio runs.\nYou decide what the clay becomes.'],
  sourceLabel:['选择动力来源','Choose the power source'],live:['实时','Live'],sim:['模拟','Simulate'],
  simulationLabel:['控制模拟动力','Control simulated power'],run:['跑动','Run'],rest:['休息','Rest'],
  simSignal:['模拟动力 · 不代表真实仓鼠状态','Simulated power · not the real hamster'],
  liveRunning:['实时已连接 · 跑轮正在转动','Live connection · the wheel is moving'],
  liveIdle:['实时已连接 · 跑轮暂时静止','Live connection · the wheel is at rest'],
  unknown:['等待实时信号 · 动力暂不可用','Waiting for live data · power unavailable'],
  simUnknown:['模拟动力尚未就绪','Simulation is not ready yet'],
  enter:['开始共创','Start creating together'],
  markLabel:['Squeekchain 官方仓鼠标志与动力轮盘','Official Squeekchain hamster mark and power wheel'],
  simRpm:['模拟轮速','Simulated speed'],liveRpm:['实测轮速','Measured speed'],rpmUnit:['转 / 分','RPM'],
  workshopRunning:['工坊开工中','The studio is running'],workshopIdle:['工坊休息中','The studio is resting'],workshopUnknown:['等待跑轮信号','Waiting for wheel data'],workshopCoasting:['陶轮正在减速','Pottery wheel coasting'],
  piece:['你的器物','Your piece'],pieceLabel:['由跑轮动力驱动的陶器','A pottery piece driven by wheel power'],
  loading:['陶器正在就位','Preparing your piece'],unavailable:['陶器暂时无法显示','The piece could not be displayed'],
  runningStory:['轮子一转，泥土有了主意。','A little movement. A new idea in clay.'],
  idleStory:['轮子停了。工坊跟着歇一会。','The wheel rests. So does the studio.'],
  unknownStory:['信号未确认，陶轮先停一会。','No confirmed signal. The pottery wheel waits.'],
  power:['仓鼠动力','Hamster power'],work:['链上工作','Onchain work'],simWork:['模拟工作','Simulated work'],result:['你的器物','Your piece'],
  community:['Squeekchain 社区作品','Made by the Squeekchain community'],
  liveRecord:['链上区块','Onchain block'],simRecord:['不催仓鼠，随时练习。','No deadlines. Take your time.'],waitingRecord:['等待真实工作记录','Waiting for the work record'],
  observed:['采样时间','Sample time'],accepted:['有效工作','Accepted work']
 };
 const getLang=()=>typeof lang==='function'?lang():lang,t=key=>words[key][getLang()==='en'?1:0],listeners=[];
 const listen=(target,type,handler,options)=>{target.addEventListener?.(type,handler,options);listeners.push(()=>target.removeEventListener?.(type,handler,options));};
 const put=(element,value)=>{const text=String(value);if(element.textContent!==text)element.textContent=text;};
 root.classList.add('home-intro');root.setAttribute('aria-labelledby','home-title');
 root.innerHTML=`<div class="home-shell">
  <div class="home-main">
   <div class="home-copy">
    <img class="home-wordmark" src="./brand-research/official/squeekchain-wordmark.svg" alt="Squeekchain" width="1116" height="498">
    <p class="home-eyebrow" data-home-text="eyebrow"></p>
    <h1 class="home-title" id="home-title" tabindex="-1"><span data-home-text="title"></span><em data-home-text="titleAccent"></em></h1>
    <p class="home-lead" data-home-text="lead"></p>
    <div class="home-power-controls">
     <div class="home-modes" role="group"><button type="button" data-home-mode="live" aria-pressed="true"><span class="home-mode-led" aria-hidden="true"></span><span data-home-text="live"></span></button><button type="button" data-home-mode="sim" aria-pressed="false" data-home-text="sim"></button></div>
     <div class="home-sim-controls" role="group" hidden><button type="button" data-home-sim="steady" aria-pressed="false"><span class="home-control-dot" aria-hidden="true"></span><span data-home-text="run"></span></button><button type="button" data-home-sim="rest" aria-pressed="false"><span class="home-control-dot" aria-hidden="true"></span><span data-home-text="rest"></span></button></div>
     <p class="home-signal" id="home-live-signal" role="status" aria-live="polite"></p>
    </div>
    <button type="button" class="home-enter" id="home-enter"><span data-home-text="enter"></span><span aria-hidden="true">↗</span></button>
   </div>
   <div class="home-art">
    <div class="home-scene-grid" aria-hidden="true"></div>
    <div class="home-source" role="img">
     <span class="home-axis" aria-hidden="true"></span><span class="home-axis home-axis-bottom" aria-hidden="true"></span>
     <div class="home-dial-ticks" aria-hidden="true"></div><div class="home-rotor" aria-hidden="true"></div>
     <div class="home-inner-disc"><span class="home-hamster" aria-hidden="true"></span></div>
     <div class="home-source-label"><span class="home-rpm-label"></span><div><strong class="home-rpm">—</strong> <small data-home-text="rpmUnit"></small></div></div>
    </div>
    <svg class="home-conduit" viewBox="0 0 330 150" aria-hidden="true"><path d="M0 0V60Q0 77 18 77H230Q250 77 250 97V140H330"/><path class="home-live-path" d="M0 0V60Q0 77 18 77H230Q250 77 250 97V140H330"/></svg>
    <div class="home-motor-caption"><span class="home-status-led" aria-hidden="true"></span><span class="home-motor-state"></span></div>
    <div class="home-workpiece">
     <canvas class="home-canvas" id="home-scene" role="img"></canvas>
     <div class="home-preview-fallback"><p class="home-fallback-text" data-home-text="loading"></p></div>
    </div>
   </div>
   <p class="home-story"></p>
  </div>
  <div class="home-foot">
   <a class="home-community" href="https://docs.squeekchain.com/" target="_blank" rel="noopener noreferrer" data-home-text="community"></a>
   <div class="home-sequence"><span data-home-text="power"></span><i aria-hidden="true"></i><span class="home-work-label"></span><i aria-hidden="true"></i><span data-home-text="result"></span></div>
   <span class="home-chain-record"></span>
  </div>
 </div>`;
 const $=selector=>root.querySelector(selector);
 const canvas=$('.home-canvas'),art=$('.home-art'),rotor=$('.home-rotor'),signal=$('.home-signal'),rpmLabel=$('.home-rpm'),rpmCaption=$('.home-rpm-label'),motorState=$('.home-motor-state'),story=$('.home-story'),simControls=$('.home-sim-controls'),chainRecord=$('.home-chain-record'),fallbackText=$('.home-fallback-text');
 const modeButtons=[...root.querySelectorAll('[data-home-mode]')],simButtons=[...root.querySelectorAll('[data-home-sim]')],textNodes=[...root.querySelectorAll('[data-home-text]')];
 let preview=null,enabled=true,inView=false,disposed=false,angle=0,initialFrame=0,lastMotion='stopped',motionUiElapsed=.25,lastSignalStep=-1;
 let lastSignal={state:'unknown',mode:'live',rpm:null,workUnits:null,block:null,observedAt:null};
 let piece={profile:null,form:'vase',glaze:'ink',surface:'glossy',finish:.82},profileInput=null;
 const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
 const number=value=>typeof value==='number'&&Number.isFinite(value)?value:null;
 const recordValue=value=>(typeof value==='number'&&Number.isFinite(value)&&value>=0)||(typeof value==='string'&&/^\d+$/.test(value))?String(value):null;
 const setAttribute=(element,key,value)=>{const text=String(value);if(element.getAttribute(key)!==text)element.setAttribute(key,text);};
 function motorCaption(speed=preview?.rpm||0){return lastSignal.state==='unknown'?'workshopUnknown':lastSignal.state==='idle'&&speed>=.15?'workshopCoasting':lastSignal.state==='running'?'workshopRunning':'workshopIdle';}
 function onTick(rpm,dt){
  if(disposed||!enabled||!inView||document.hidden)return;
  const speed=Number.isFinite(rpm)?Math.max(0,rpm):0;
  const delta=Math.min(.1,Math.max(0,dt||0));
  angle=(angle+speed*6*delta)%360;
  if(!motion.matches)rotor.style.transform=`rotate(${angle}deg)`;
  // 唯一逐帧 DOM 写入是合成层的转角；动力亮度与状态每秒最多更新四次。
  motionUiElapsed+=delta;if(motionUiElapsed<.25)return;motionUiElapsed%=.25;
  const signalStep=Math.round(Math.min(1,speed/10)*20);
  if(signalStep!==lastSignalStep){lastSignalStep=signalStep;root.style.setProperty('--home-signal',String(signalStep/20));}
  const nextMotion=speed<.015?'stopped':lastSignal.state==='running'?'moving':'coasting';
  if(nextMotion!==lastMotion){lastMotion=nextMotion;root.dataset.motion=nextMotion;}
  put(motorState,t(motorCaption(speed)));
 }
 function applyPiece(all=false,previous={}){
  if(!preview)return;
  if(all||piece.profile!==previous.profile||piece.form!==previous.form){const profile=piece.profile||window.Pottery?.orderProfile?.('pear');if(profile)preview.setProfile(profile,piece.form);}
  if(all||piece.glaze!==previous.glaze)preview.setGlaze(piece.glaze);
  if(all||piece.surface!==previous.surface)preview.setSurface(piece.surface);
  if(all||piece.finish!==previous.finish)preview.setFinish(piece.finish);
 }
 function initializePreview(){
  if(preview||disposed||root.dataset.preview==='unavailable')return;
  const bounds=canvas.getBoundingClientRect();if(bounds.width<2||bounds.height<2)return;
  try{
   preview=createStudio(canvas,{animatedPreview:true,transparentBackground:true,presentationEntrance:true,heroLighting:true,background:'#101114',sealUrl:'./brand-research/official/squeekchain-hamster-mark.svg',onTick,onReady(){root.dataset.preview='ready';}});
   preview.setPhase('glaze');preview.setRpm(lastSignal.state==='running'?lastSignal.rpm||0:0);applyPiece(true);preview.setPresentationView?.(.42,.16);
  }catch(error){root.dataset.preview='unavailable';fallbackText.dataset.homeText='unavailable';put(fallbackText,t('unavailable'));}
 }
 function syncVisibility(){
  const show=enabled&&inView&&!document.hidden&&!disposed&&root.dataset.preview!=='unavailable';
  root.dataset.motionActive=String(show);if(show)initializePreview();preview?.setVisible(show);
 }
 const header=root.ownerDocument.querySelector('.header'),visibilityTargets=[canvas,$('.home-source')],visibleParts=new Map();
 let observer=null,headerInset=-1;
 function observeVisibleCanvas(){
  const inset=Math.ceil(header?.getBoundingClientRect().height||84);
  if(typeof IntersectionObserver!=='function'){
   inView=visibilityTargets.some(target=>{const bounds=target.getBoundingClientRect();return bounds.bottom>inset&&bounds.top<window.innerHeight&&bounds.right>0&&bounds.left<window.innerWidth;});syncVisibility();return;
  }
  if(observer&&inset===headerInset)return;
  observer?.disconnect();headerInset=inset;visibleParts.clear();
  // 只观察两处真正运动的画面，扣除 sticky header；任一可见时保留同源动画。
  observer=new IntersectionObserver(entries=>{for(const entry of entries)visibleParts.set(entry.target,entry.isIntersecting&&entry.intersectionRatio>0);inView=[...visibleParts.values()].some(Boolean);syncVisibility();},{rootMargin:`-${inset}px 0px 0px 0px`,threshold:[0,.001]});
  for(const target of visibilityTargets)observer.observe(target);
 }
 observeVisibleCanvas();
 const sizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(()=>{observeVisibleCanvas();if(enabled&&inView&&!document.hidden)syncVisibility();}):null;sizeObserver?.observe(canvas);if(header)sizeObserver?.observe(header);
 if(typeof IntersectionObserver!=='function')listen(window,'scroll',observeVisibleCanvas,{passive:true});
 listen(document,'visibilitychange',syncVisibility);
 listen(motion,'change',()=>{root.dataset.reducedMotion=String(motion.matches);if(motion.matches)rotor.style.transform='none';});
 listen(canvas,'webglcontextlost',()=>{root.dataset.preview='unavailable';fallbackText.dataset.homeText='unavailable';preview?.setVisible(false);put(fallbackText,t('unavailable'));});
 for(const button of modeButtons)listen(button,'click',()=>onModeChange(button.dataset.homeMode));
 for(const button of simButtons)listen(button,'click',()=>{if(lastSignal.mode==='sim')onSimChange(button.dataset.homeSim);});
 listen($('#home-enter'),'click',()=>onEnter());
 function renderSignal(){
  const simulated=lastSignal.mode==='sim',state=lastSignal.state,unknown=state==='unknown';
  setAttribute(root,'data-power-mode',lastSignal.mode);setAttribute(root,'data-wheel-state',state);if(simControls.hidden===simulated)simControls.hidden=!simulated;
  for(const button of modeButtons)setAttribute(button,'aria-pressed',button.dataset.homeMode===lastSignal.mode);
  for(const button of simButtons)setAttribute(button,'aria-pressed',simulated&&(button.dataset.homeSim==='rest'?state==='idle':state==='running'));
  put(signal,t(simulated?(unknown?'simUnknown':'simSignal'):state==='running'?'liveRunning':state==='idle'?'liveIdle':'unknown'));setAttribute(signal,'data-state',state);
  put(rpmCaption,t(simulated?'simRpm':'liveRpm'));
  put(rpmLabel,unknown?'—':lastSignal.rpm>0&&lastSignal.rpm<.1?'<0.1':(lastSignal.rpm||0).toFixed(1).padStart(4,'0'));
  put(motorState,t(motorCaption()));
  put(story,t(state==='running'?'runningStory':state==='idle'?'idleStory':'unknownStory'));
  put($('.home-work-label'),t(simulated?'simWork':'work'));
  put(chainRecord,simulated?t('simRecord'):unknown||lastSignal.block===null?t('waitingRecord'):`${t('liveRecord')} #${lastSignal.block}`);
  const stamp=lastSignal.observedAt;
  setAttribute(signal,'title',!simulated&&stamp!==null?`${t('observed')} · ${new Intl.DateTimeFormat(getLang()==='en'?'en-GB':'zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(stamp)} UTC+8`:'');
  setAttribute(chainRecord,'title',!simulated&&!unknown&&lastSignal.workUnits!==null?`${t('accepted')} · ${lastSignal.workUnits}`:'');
  setAttribute(root,'data-observed-at',stamp??'');setAttribute(root,'data-work-units',lastSignal.workUnits??'');setAttribute(root,'data-block',lastSignal.block??'');
 }
 function render(){
  for(const element of textNodes)put(element,t(element.dataset.homeText));
  root.dataset.homeLang=getLang()==='en'?'en':'zh';root.lang=getLang()==='en'?'en':'zh-CN';root.dataset.reducedMotion=String(motion.matches);
  $('.home-modes').setAttribute('aria-label',t('sourceLabel'));simControls.setAttribute('aria-label',t('simulationLabel'));$('.home-source').setAttribute('aria-label',t('markLabel'));canvas.setAttribute('aria-label',t('pieceLabel'));
  renderSignal();
 }
 render();
 return {
  render,setLang(value){lang=value;render();},
  setVisible(value){const next=!!value;if(enabled===next)return;enabled=next;syncVisibility();},
  setSignal(value={}){
   let state=['running','idle'].includes(value.state)?value.state:'unknown';const mode=value.mode==='sim'?'sim':'live';
   if(state==='running'&&number(value.rpm)===null)state='unknown';
   const rpm=state==='unknown'?null:state==='idle'?0:Math.max(0,value.rpm);
   let observedAt=number(value.observedAt)??(typeof value.observedAt==='string'&&Number.isFinite(Date.parse(value.observedAt))?Date.parse(value.observedAt):null);
   if(observedAt!==null&&Math.abs(observedAt)>8.64e15)observedAt=null;
   lastSignal={state,mode,rpm,workUnits:recordValue(value.workUnits),block:recordValue(value.block),observedAt};
   preview?.setRpm(state==='running'?rpm:0);renderSignal();
  },
  setPiece(value={}){
   const previous=piece,next={...piece};
   if(value.profile!==profileInput&&Array.isArray(value.profile)&&value.profile.length>1&&value.profile.every(Number.isFinite)){profileInput=value.profile;next.profile=value.profile.slice();}
   for(const key of ['form','glaze','surface'])if(typeof value[key]==='string'&&value[key])next[key]=value[key];
   if(number(value.finish)!==null)next.finish=Math.max(0,Math.min(1,value.finish));
   piece=next;applyPiece(false,previous);
  },
  dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(initialFrame);observer?.disconnect();sizeObserver?.disconnect();listeners.splice(0).forEach(remove=>remove());preview?.dispose();}
 };
}
