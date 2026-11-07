/* 首页是器物与材质预览，摄影机缓慢移动；它不伪造跑轮动力。 */
export function createHome({root,lang=()=> 'zh',createStudio,onEnter=()=>{}}={}){
 if(!root)throw new Error('Home root is required');
 const homeWords={
  eyebrow:['一人一鼠，共同创作','A SMALL COLLABORATION'],
  title:['把脚步，\n留成器物。','Little steps.\nLasting things.'],
  lead:['真实仓鼠决定节奏。\n你用双手，留下形状。','A real hamster sets the rhythm.\nYou give the clay its shape.'],
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
  caption:['16 种釉色，4 种表面工艺。\n这一件，由你决定。','16 colours. 4 surface finishes.\nThe next piece is yours.']
 };
 const homePresets=[{id:'jade',glaze:'jade',surface:'flow',colour:'#286e61',accent:'#aac8a0'},
  {id:'ivory',glaze:'ivory',surface:'speckle',colour:'#ddd5bd',accent:'#ad9270'},
  {id:'coral',glaze:'coral',surface:'glossy',colour:'#c9604c',accent:'#efbf8b'}];
 const getLang=()=>typeof lang==='function'?lang():lang;
 const homeT=key=>homeWords[key][getLang()==='en'?1:0];
 const node=(tag,className,key)=>{const n=document.createElement(tag);if(className)n.className=className;if(key)n.dataset.homeText=key;return n;};
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
 const art=node('div','home-art'),artLabel=node('div','home-art-label'),index=node('span','home-art-index');index.textContent='01';
 const artName=node('span','home-art-name','preview');artLabel.append(index,artName);
 const canvas=node('canvas','home-canvas');canvas.id='home-scene';canvas.tabIndex=-1;canvas.setAttribute('role','img');
 const fallback=node('div','home-preview-fallback'),silhouette=node('div','home-silhouette'),fallbackText=node('p','home-fallback-text','previewLoading');
 silhouette.setAttribute('aria-hidden','true');fallback.append(silhouette,fallbackText);
 const materialRail=node('div','home-material-rail'),swatches=node('div','home-swatches'),caption=node('p','home-material-caption','caption');
 swatches.setAttribute('role','group');
 let preset=homePresets[0],preview=null,enabled=true,inView=false,disposed=false,elapsed=0,lastSignal={state:'unknown'},initialFrame=0;
 const buttons=homePresets.map(item=>{const b=node('button','home-swatch');b.type='button';b.dataset.homeGlaze=item.id;b.style.setProperty('--sample',item.colour);b.style.setProperty('--sample-accent',item.accent);const dot=node('span','home-swatch-dot');dot.setAttribute('aria-hidden','true');const name=node('span','home-swatch-name',item.id);b.append(dot,name);b.addEventListener('click',()=>{preset=item;applyPreset();render();});swatches.append(b);return b;});
 materialRail.append(swatches,caption);art.append(artLabel,canvas,fallback,materialRail);
 const foot=node('div','home-foot'),sequence=node('div','home-sequence');
 for(const [i,key] of ['rhythm','touch','keep'].entries()){const part=node('span','home-sequence-part'),number=node('small');number.textContent=String(i+1).padStart(2,'0');const word=node('span','',key);part.append(number,word);sequence.append(part);}
 const down=node('button','home-scroll');down.type='button';down.id='home-scroll';const downText=node('span','','scroll'),arrow=node('span','home-down-arrow');arrow.setAttribute('aria-hidden','true');arrow.textContent='↓';down.append(downText,arrow);foot.append(sequence,down);
 shell.append(copy,art,foot);root.replaceChildren(shell);
 const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
 function applyPreset(){preview?.setGlaze(preset.glaze);preview?.setSurface(preset.surface);preview?.setFinish(.66);root.style.setProperty('--home-glaze',preset.colour);root.style.setProperty('--home-accent',preset.accent);}
 function presentationView(){preview?.setPresentationView?.(motion.matches ? .36 : .36+Math.sin(elapsed*.085)*.22,.18+(motion.matches?0:Math.sin(elapsed*.065)*.014));}
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
  if(show)initializePreview();
  preview?.setVisible(show);
 }
 const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{inView=entries.some(entry=>entry.isIntersecting);syncVisibility();},{rootMargin:'80px 0px',threshold:0}):null;
 if(observer)observer.observe(root);else{inView=true;initialFrame=requestAnimationFrame(syncVisibility);}
 function visibilityChanged(){syncVisibility();}
 function motionChanged(){presentationView();}
 document.addEventListener('visibilitychange',visibilityChanged);motion.addEventListener?.('change',motionChanged);
 canvas.addEventListener('webglcontextlost',()=>{root.dataset.preview='unavailable';fallbackText.dataset.homeText='previewUnavailable';preview?.setVisible(false);render();});
 practice.addEventListener('click',()=>onEnter('sim'));live.addEventListener('click',()=>onEnter('live'));down.addEventListener('click',()=>onEnter());
 function render(){
  root.querySelectorAll('[data-home-text]').forEach(e=>e.textContent=homeT(e.dataset.homeText));
  canvas.setAttribute('aria-label',homeT('previewLabel'));swatches.setAttribute('aria-label',homeT('glazeLabel'));down.setAttribute('aria-label',homeT('scrollLabel'));
  for(const b of buttons){b.setAttribute('aria-pressed',String(b.dataset.homeGlaze===preset.id));b.setAttribute('aria-label',homeT(b.dataset.homeGlaze));}
  signal.textContent=homeT(lastSignal.state==='running'?'signalRun':lastSignal.state==='idle'?'signalRest':lastSignal.state==='preview'?'signalPreview':'signalUnknown');signal.dataset.state=lastSignal.state;
  root.dataset.homeLang=getLang()==='en'?'en':'zh';
 }
 render();applyPreset();
 return {
  render,setLang(value){lang=value;render();},
  setVisible(value){enabled=!!value;syncVisibility();},
  setSignal(value={}){const next=['running','idle','preview'].includes(value.state)?value.state:'unknown';if(next!==lastSignal.state){lastSignal={state:next};render();}},
  dispose(){disposed=true;cancelAnimationFrame(initialFrame);observer?.disconnect();document.removeEventListener('visibilitychange',visibilityChanged);motion.removeEventListener?.('change',motionChanged);preview?.dispose();}
 };
}
