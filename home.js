/* 首页是器物与材质预览，摄影机缓慢移动；它不伪造跑轮动力。 */
export function createHome({root,lang=()=> 'zh',createStudio,onEnter=()=>{}}={}){
 if(!root)throw new Error('Home root is required');
 const homeWords={
  eyebrow:['Squeekchain · 一鼠驱动','SQUEEKCHAIN · HAMSTER POWERED'],
  title:['把脚步，\n留成器物。','Little steps.\nLasting things.'],
  lead:['一只仓鼠，决定整个工坊的节奏。\n形状，留给你。','One real hamster sets the whole studio’s rhythm.\nThe shape is up to you.'],
  enter:['先练一件','Make a practice piece'],practice:['模拟动力 · 随时可玩','Simulation · always playable'],
  live:['跟着仓鼠做','Follow the live wheel'],
  signalPreview:['进入后连接真实跑轮','Connect to the live wheel when you enter'],signalUnknown:['等待实时跑轮信号','Waiting for a live wheel signal'],signalRest:['跑轮此刻静止 · 可以先练习','The wheel is resting · practise meanwhile'],signalRun:['跑轮此刻在动','The real wheel is moving'],
  preview:['器物与釉面预览','A STUDY IN FORM & GLAZE'],previewLabel:['陶器材质预览','Pottery material preview'],
  glazeLabel:['选择预览釉色','Choose a preview glaze'],
  jade:['翡翠流釉','Jade flow'],ivory:['象牙细斑','Speckled ivory'],coral:['珊瑚光釉','Coral gloss'],
  previewLoading:['光，慢慢落在陶器上。','Let the light settle.'],previewUnavailable:['器物预览需要图形加速。','The pottery preview needs graphics acceleration.'],
  rhythm:['它给节奏','His rhythm'],touch:['你给形状','Your touch'],keep:['留下一件','A piece to keep'],
  scroll:['向下，走进工作室','Scroll into the studio'],scrollLabel:['滚动到工作台，保留当前动力模式','Scroll to the studio, keeping the current power mode'],
  edition:['轮间 · 仓鼠陶艺工作室','WHEEL & CLAY · POTTERY STUDIO'],
  storyTitle:['整个工坊。\n就这一位动力师。','One small hamster.\nThe whole power station.'],
  powerBy:['动力师','POWERED BY'],shapeBy:['陶艺师','SHAPED BY'],you:['你','You'],
  footprint:['脚步','FOOTSTEPS'],verifiedWork:['有效工作','VALID WORK'],potteryWheel:['陶轮','POTTERY WHEEL'],
  culture:['一只仓鼠撑起一条链。顺便，开了间陶艺工坊。','One hamster. One chain. A pottery studio on the side.'],
  community:['Squeekchain 社区作品\n不催仓鼠。开工随缘。','A Squeekchain community creation\nNo deadlines. He is a hamster.'],
  signalSim:['模拟动力 · 仓鼠今天不加班','Simulated power · the hamster has the day off'],
  makerWaiting:['真实信号尚未确认','Live signal not confirmed'],makerRest:['已连接 · 跑轮静止','Connected · wheel at rest'],makerRun:['已连接 · 跑轮正在转动','Connected · wheel moving'],makerPreview:['进入后连接真实跑轮','Connect when you enter'],
  caption:['16 种釉色，4 种表面工艺。\n这一件，由你决定。','16 colours. 4 surface finishes.\nThe next piece is yours.']
 };
 const homePresets=[{id:'jade',glaze:'jade',surface:'flow',colour:'#286e61',accent:'#aac8a0'},
  {id:'ivory',glaze:'ivory',surface:'speckle',colour:'#ddd5bd',accent:'#ad9270'},
  {id:'coral',glaze:'coral',surface:'glossy',colour:'#c9604c',accent:'#efbf8b'}];
 const getLang=()=>typeof lang==='function'?lang():lang;
 const homeT=key=>homeWords[key][getLang()==='en'?1:0];
 const node=(tag,className,key)=>{const n=document.createElement(tag);if(className)n.className=className;if(key)n.dataset.homeText=key;return n;};
 const svgNode=(tag,attributes={})=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value] of Object.entries(attributes))n.setAttribute(key,String(value));return n;};
 function hamsterPortrait(className){
  const picture=svgNode('svg',{viewBox:'0 0 112 112',class:className,'aria-hidden':'true',fill:'none'});
  const lines=svgNode('g',{stroke:'currentColor','stroke-width':'1.25','stroke-linecap':'round','stroke-linejoin':'round'});
  for(const d of ['M29 35C15 31 14 16 24 14C35 11 39 23 38 27','M75 28C76 14 88 10 94 18C100 26 93 36 85 38','M32 32C42 22 68 21 79 33C91 45 94 66 82 79C72 91 38 91 26 79C14 65 20 44 32 32Z','M28 77C20 83 19 93 21 98M81 79C88 84 91 91 90 98','M25 56C32 51 39 54 42 62M69 62C73 54 82 53 87 58','M50 63Q56 68 62 63L56 61Z','M56 67V73M56 73Q50 79 45 72M56 73Q63 79 68 72','M38 66L17 63M38 70L14 71M74 66L95 63M74 70L98 73','M35 88L32 98M77 88L80 98','M28 20Q22 22 27 29M87 20Q93 25 86 30'])lines.append(svgNode('path',{d}));
  lines.append(svgNode('circle',{cx:41,cy:48,r:2,fill:'currentColor',stroke:'none'}),svgNode('circle',{cx:72,cy:48,r:2,fill:'currentColor',stroke:'none'}));
  picture.append(svgNode('circle',{cx:56,cy:56,r:53,stroke:'currentColor','stroke-width':'.6',opacity:'.38'}),lines);return picture;
 }
 const listeners=[];
 const listen=(target,type,handler,options)=>{target.addEventListener?.(type,handler,options);listeners.push(()=>target.removeEventListener?.(type,handler,options));};
 root.classList.add('home-intro');root.setAttribute('aria-labelledby','home-title');
 const shell=node('div','home-shell'),copy=node('div','home-copy'),eyebrow=node('p','home-eyebrow','eyebrow');
 const title=node('h1','home-title','title');title.id='home-title';title.tabIndex=-1;
 const lead=node('p','home-lead','lead');
 const actions=node('div','home-actions'),practice=node('button','home-enter','enter');practice.type='button';practice.id='home-enter';
 const practiceNote=node('span','home-practice-note','practice');
 const live=node('button','home-live','live');live.type='button';live.id='home-enter-live';
 const signal=node('p','home-signal');signal.id='home-live-signal';signal.setAttribute('role','status');
 const practiceGroup=node('div','home-practice');practiceGroup.append(practice,practiceNote);actions.append(practiceGroup,live,signal);
 copy.append(eyebrow,title,lead,actions);
 const artTrack=node('div','home-art-track'),art=node('div','home-art'),artLabel=node('div','home-art-label'),index=node('span','home-art-index');index.append(hamsterPortrait('home-hamster-mark'));
 const artName=node('span','home-art-name');artName.textContent='Squeektoshi';artLabel.append(index,artName);
 const canvas=node('canvas','home-canvas');canvas.id='home-scene';canvas.tabIndex=-1;canvas.setAttribute('role','img');
 const fallback=node('div','home-preview-fallback'),silhouette=node('div','home-silhouette'),fallbackText=node('p','home-fallback-text','previewLoading');
 silhouette.setAttribute('aria-hidden','true');fallback.append(silhouette,fallbackText);
 const materialRail=node('div','home-material-rail'),swatches=node('div','home-swatches'),caption=node('p','home-material-caption','caption');
 swatches.setAttribute('role','group');
 let preset=homePresets[0],preview=null,enabled=true,inView=false,disposed=false,elapsed=0,lastSignal={state:'unknown',mode:'live'},initialFrame=0,scrollFrame=0,sceneProgress=0;
 const buttons=homePresets.map(item=>{const b=node('button','home-swatch');b.type='button';b.dataset.homeGlaze=item.id;b.style.setProperty('--sample',item.colour);b.style.setProperty('--sample-accent',item.accent);const dot=node('span','home-swatch-dot');dot.setAttribute('aria-hidden','true');const name=node('span','home-swatch-name',item.id);b.append(dot,name);listen(b,'click',()=>{preset=item;applyPreset();render();});swatches.append(b);return b;});
 materialRail.append(swatches,caption);art.append(artLabel,canvas,fallback,materialRail);
 artTrack.append(art);
 const story=node('div','home-story'),storyTitle=node('h2','home-story-title','storyTitle'),makers=node('div','home-makers'),portrait=hamsterPortrait('home-hamster-portrait'),makerText=node('div','home-maker-text');
 const powerRole=node('span','home-maker-role','powerBy'),powerName=node('strong','home-maker-name');powerName.textContent='Squeektoshi';
 const artist=node('div','home-artist'),artistRole=node('span','home-maker-role','shapeBy'),artistName=node('strong','home-maker-name','you');artist.append(artistRole,artistName);
 const makerSignal=node('p','home-maker-signal');makerText.append(powerRole,powerName,artist);makers.append(portrait,makerText);
 const drive=node('div','home-drive');
 for(const [i,key] of ['footprint','verifiedWork','potteryWheel'].entries()){
  if(i){const link=svgNode('svg',{viewBox:'0 0 56 20',class:'home-chain-link','aria-hidden':'true',fill:'none'});for(let j=0;j<3;j++)link.append(svgNode('rect',{x:2+j*17,y:j===1?7:4,width:21,height:j===1?6:12,rx:j===1?3:6,stroke:'currentColor','stroke-width':j===1?'1.2':'1.5'}));drive.append(link);}
  const step=node('span','home-drive-step',key);drive.append(step);
 }
 const culture=node('p','home-culture','culture');story.append(storyTitle,makers,makerSignal,drive,culture);
 const foot=node('div','home-foot'),sequence=node('div','home-sequence');
 for(const [i,key] of ['rhythm','touch','keep'].entries()){const part=node('span','home-sequence-part'),number=node('small');number.textContent=String(i+1).padStart(2,'0');const word=node('span','',key);part.append(number,word);sequence.append(part);}
 const down=node('button','home-scroll');down.type='button';down.id='home-scroll';const downText=node('span','','scroll'),arrow=node('span','home-down-arrow');arrow.setAttribute('aria-hidden','true');arrow.textContent='↓';down.append(downText,arrow);
 const community=node('a','home-community','community');community.href='https://docs.squeekchain.com/';community.target='_blank';community.rel='noopener noreferrer';
 foot.append(sequence,community,down);shell.append(copy,artTrack,story,foot);root.replaceChildren(shell);
 const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
 // 位置由真实滚动反推，返回首页无需重播动画，也不会留下隐藏的标题。
 const clamp=value=>Math.max(0,Math.min(1,value));
 const ease=value=>{const t=clamp(value);return t*t*(3-2*t);};
 function paintScroll(progress=0,compact=window.innerWidth<=850){
  sceneProgress=progress;
  const retreat=ease(progress/.44),arrival=ease((progress-.28)/.36),approach=ease(progress/.9);
  root.style.setProperty('--home-copy-opacity',String(compact?1:1-retreat));
  root.style.setProperty('--home-copy-shift',`${(compact?0:-92*retreat).toFixed(2)}px`);
  root.style.setProperty('--home-copy-x',`${(compact?0:-34*retreat).toFixed(2)}px`);
  root.style.setProperty('--home-art-shift',`${(-28*approach).toFixed(2)}px`);
  root.style.setProperty('--home-art-x',`${(compact?0:-16*approach).toFixed(2)}%`);
  root.style.setProperty('--home-art-scale',String(1+approach*(compact ? .17 : .24)));
  root.style.setProperty('--home-story-opacity',String(compact?1:arrival));
  root.style.setProperty('--home-story-shift',`${(compact?0:42*(1-arrival)).toFixed(2)}px`);
  root.style.setProperty('--home-journey',String(progress));
  root.style.setProperty('--home-link-progress',String(ease((progress-.24)/.6)));
  root.dataset.chapter=progress>.76?'3':progress>.3?'2':'1';
  story.setAttribute('aria-hidden',String(!motion.matches&&!compact&&arrival<.05));
  presentationView();
 }
 function updateScroll(){
  scrollFrame=0;
  if(disposed)return;
  if(!enabled||motion.matches){paintScroll();return;}
  const bounds=root.getBoundingClientRect();
  const compact=window.innerWidth<=850;
  if(compact){
   const track=artTrack.getBoundingClientRect(),distance=Math.max(1,artTrack.offsetHeight-art.offsetHeight);
   paintScroll(clamp((art.getBoundingClientRect().top-track.top)/distance),true);
  }else{
   const distance=Math.max(window.innerHeight*.55,root.offsetHeight-shell.offsetHeight);
   paintScroll(clamp((shell.getBoundingClientRect().top-bounds.top)/distance),false);
  }
 }
 function scheduleScroll(){
  if(disposed||scrollFrame||!enabled||!inView||document.hidden)return;
  scrollFrame=requestAnimationFrame(updateScroll);
 }
 function cancelScroll(){cancelAnimationFrame(scrollFrame);scrollFrame=0;}
 function applyPreset(){preview?.setGlaze(preset.glaze);preview?.setSurface(preset.surface);preview?.setFinish(.66);root.style.setProperty('--home-glaze',preset.colour);root.style.setProperty('--home-accent',preset.accent);}
 function presentationView(){preview?.setPresentationView?.(motion.matches ? .36 : .36+Math.sin(elapsed*.085)*.1+sceneProgress*.58,.18+(motion.matches?0:Math.sin(elapsed*.065)*.008+sceneProgress*.3));}
 function initializePreview(){
  if(preview||disposed||root.dataset.preview==='unavailable')return;
  const b=canvas.getBoundingClientRect();if(b.width<2||b.height<2)return;
  try{
   preview=createStudio(canvas,{onReady(){root.dataset.preview='ready';},onTick(_rpm,dt){if(!motion.matches){elapsed+=dt;presentationView();}}});
   preview.setRpm(0);preview.setPhase('glaze');applyPreset();presentationView();
  }catch(error){root.dataset.preview='unavailable';fallbackText.dataset.homeText='previewUnavailable';render();}
 }
 function syncVisibility(){
  const show=enabled&&inView&&!document.hidden&&!disposed;
  if(show){initializePreview();scheduleScroll();}else cancelScroll();
  preview?.setVisible(show);
 }
 const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{inView=entries.some(entry=>entry.isIntersecting);syncVisibility();},{rootMargin:'80px 0px',threshold:0}):null;
 if(observer)observer.observe(root);else{inView=true;initialFrame=requestAnimationFrame(syncVisibility);}
 function visibilityChanged(){syncVisibility();}
 function motionChanged(){cancelScroll();paintScroll();presentationView();scheduleScroll();}
 listen(document,'visibilitychange',visibilityChanged);listen(motion,'change',motionChanged);
 listen(window,'scroll',scheduleScroll,{passive:true});listen(window,'resize',scheduleScroll,{passive:true});
 const sizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(scheduleScroll):null;sizeObserver?.observe(root);
 listen(canvas,'webglcontextlost',()=>{root.dataset.preview='unavailable';fallbackText.dataset.homeText='previewUnavailable';preview?.setVisible(false);render();});
 listen(practice,'click',()=>onEnter('sim'));listen(live,'click',()=>onEnter('live'));listen(down,'click',()=>onEnter());
 function render(){
  root.querySelectorAll('[data-home-text]').forEach(e=>e.textContent=homeT(e.dataset.homeText));
  canvas.setAttribute('aria-label',homeT('previewLabel'));swatches.setAttribute('aria-label',homeT('glazeLabel'));down.setAttribute('aria-label',homeT('scrollLabel'));
  for(const b of buttons){b.setAttribute('aria-pressed',String(b.dataset.homeGlaze===preset.id));b.setAttribute('aria-label',homeT(b.dataset.homeGlaze));}
  signal.textContent=homeT(lastSignal.state==='running'?'signalRun':lastSignal.state==='idle'?'signalRest':lastSignal.state==='preview'?'signalPreview':'signalUnknown');signal.dataset.state=lastSignal.state;
  const simulated=lastSignal.mode==='sim';
  if(simulated){signal.textContent=homeT('signalSim');signal.dataset.state='sim';}
  makerSignal.textContent=homeT(simulated?'signalSim':lastSignal.state==='running'?'makerRun':lastSignal.state==='idle'?'makerRest':lastSignal.state==='preview'?'makerPreview':'makerWaiting');
  root.dataset.powerMode=simulated?'sim':'live';root.dataset.wheelState=lastSignal.state;
  root.dataset.homeLang=getLang()==='en'?'en':'zh';
  scheduleScroll();
 }
 render();applyPreset();
 return {
  render,setLang(value){lang=value;render();},
  setVisible(value){enabled=!!value;if(!enabled)paintScroll();syncVisibility();},
  setSignal(value={}){const next=['running','idle','preview'].includes(value.state)?value.state:'unknown',mode=value.mode==='sim'?'sim':'live';if(next!==lastSignal.state||mode!==lastSignal.mode){lastSignal={state:next,mode};render();}},
  dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(initialFrame);cancelScroll();observer?.disconnect();sizeObserver?.disconnect();listeners.splice(0).forEach(remove=>remove());paintScroll();preview?.dispose();}
 };
}
