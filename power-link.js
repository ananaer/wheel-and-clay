/* 两个小轮以各自真实角速度运动；详细读数按需展开，不抢作品的舞台。 */
let powerLinkSerial=0;
export function createPowerLink({root,lang=()=> 'en',inputId,outputId}={}){
 const id=`wheel-link-${++powerLinkSerial}`;
 const labels={wheel:['你的陶轮','YOUR WHEEL'],details:['查看动力传动','View wheel transmission'],
  input:['仓鼠跑轮','Hamster wheel'],output:['陶轮','Pottery wheel'],unit:['转 / 分','RPM'],
  live:['实时动力','Live power'],sim:['模拟动力 · 非实时','Simulated · not live'],rest:['跑轮休息中','Wheel at rest'],
  unknown:['等待信号','Awaiting signal'],buffer:['动力缓冲中','Power reserve'],seconds:['秒','s'],
  title:['它的动力，你的节奏。','His energy. Your rhythm.'],
  note:['跑轮经过柔和减速，留给双手塑形的时间。','A gentler transmission gives your hands time to shape.'],
  bufferNote:['短暂零速或断连，保留最近一次动力，最多 90 秒。','Brief zero readings or interruptions retain the last power for up to 90 seconds.']};
 const t=k=>labels[k][lang()==='zh'?0:1],q=s=>root.querySelector(s);
 root.classList.add('power-link');
 root.innerHTML=`<button type="button" class="power-link-trigger" aria-expanded="false" aria-controls="${id}">
  <span class="power-mechanism" aria-hidden="true"><svg viewBox="0 0 190 65" fill="none">
   <defs><linearGradient id="${id}-metal" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#d4c49b"/><stop offset=".45" stop-color="#5a5547"/><stop offset="1" stop-color="#aaa083"/></linearGradient></defs>
   <path class="power-belt" d="M32 13 145 5A23 23 0 0 1 145 51L32 43A15 15 0 0 1 32 13Z"/>
   <path class="power-flow" pathLength="100" d="M32 13 145 5A23 23 0 0 1 145 51L32 43A15 15 0 0 1 32 13Z"/>
   <circle cx="32" cy="28" r="15" fill="#131617" stroke="url(#${id}-metal)"/>
   <circle cx="32" cy="28" r="11.5" stroke="#77705a" stroke-width=".6"/>
   <g class="power-input-rotor"><path d="M32 14v4m0 20v4M18 28h4m20 0h4" stroke="#b7a67e" stroke-width="1"/><circle cx="32" cy="13" r="2" fill="#efca78"/></g>
   <image href="./brand-research/official/squeekchain-hamster-mark.svg" x="23" y="22" width="18" height="13"/>
   <circle cx="145" cy="28" r="23" fill="#151d1e" stroke="url(#${id}-metal)"/>
   <circle cx="145" cy="28" r="19" stroke="#618880" stroke-width=".7"/>
   <circle cx="145" cy="28" r="14" stroke="#51716c" stroke-width=".5"/>
   <g class="power-output-rotor"><path d="M145 8v5m0 30v5M125 28h5m30 0h5" stroke="#9ebfb2" stroke-width="1"/><circle cx="145" cy="8" r="2.2" fill="#c6ded0"/><path d="M145 18v20m-10-10h20" stroke="#799b8f" stroke-width=".5"/></g>
   <circle cx="145" cy="28" r="2.5" fill="#b4c8b9"/>
  </svg><span class="power-link-legend"><span>Squeektoshi</span><span class="power-wheel-name"></span></span></span>
  <span class="power-link-copy"><span class="power-link-status"></span><span class="power-link-hint">↗</span></span>
 </button><div class="power-link-popover" id="${id}" hidden><p class="power-link-title"></p>
 <div class="power-link-facts"><div><span class="power-input-name"></span><strong class="power-raw" ${inputId?`id="${inputId}"`:''}>—</strong><small class="power-unit"></small></div><span class="power-fact-arrow" aria-hidden="true">→</span><div><span class="power-output-name"></span><strong class="power-actual" ${outputId?`id="${outputId}"`:''}>—</strong><small class="power-unit"></small></div></div>
 <p class="power-link-note"></p><p class="power-buffer-note" hidden></p></div>`;
 const button=q('button'),panel=q('.power-link-popover'),inputRotor=q('.power-input-rotor'),outputRotor=q('.power-output-rotor'),flow=q('.power-flow');
 let inputAngle=0,outputAngle=0,elapsed=0,last={},actual=0;
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 function close(){panel.hidden=true;button.setAttribute('aria-expanded','false');}
 function focusOut(event){if(event.relatedTarget&&!root.contains(event.relatedTarget))close();}
 function outside(event){if(!root.contains(event.target))close();}
 function escape(event){if(event.key==='Escape'&&!panel.hidden&&root.contains(event.target)){close();button.focus();}}
 button.addEventListener('click',()=>{panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));render(last,actual);});
 root.addEventListener('focusout',focusOut);document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
 function render(signal={},speed=actual){
  last=signal;actual=speed;
  const sourceState=signal.sourceState??signal.state??'unknown',raw=signal.sourceRpm===undefined?signal.rpm:signal.sourceRpm;
  const buffering=!!signal.buffering,unknown=sourceState==='unknown'||signal.state==='unknown'||(buffering&&sourceState==='running');
  root.dataset.state=buffering?'buffering':unknown?'unknown':sourceState==='idle'?'idle':'running';root.dataset.mode=signal.mode||'live';
  button.setAttribute('aria-label',t('details'));q('.power-wheel-name').textContent=t('wheel');q('.power-link-title').textContent=t('title');
  q('.power-input-name').textContent=t('input');q('.power-output-name').textContent=t('output');q('.power-link-note').textContent=t('note');
  for(const unit of root.querySelectorAll('.power-unit'))unit.textContent=t('unit');
  q('.power-raw').textContent=unknown||!Number.isFinite(raw)?'—':raw.toFixed(1);
  q('.power-actual').textContent=signal.state==='unknown'?'—':Math.max(0,speed).toFixed(1);
  q('.power-link-status').textContent=buffering?`${t('buffer')} · ${Math.ceil((signal.bufferRemainingMs||0)/1000)}${t('seconds')}`:signal.mode==='sim'?t('sim'):unknown?t('unknown'):sourceState==='idle'?t('rest'):t('live');
  q('.power-buffer-note').hidden=!buffering;q('.power-buffer-note').textContent=t('bufferNote');
  root.dataset.sensorRpm=Number.isFinite(raw)?String(raw):'';root.dataset.outputRpm=String(speed);
 }
 function tick(dt,speed){
  actual=speed;const raw=last.sourceRpm===undefined?last.rpm:last.sourceRpm;
  const input=Number.isFinite(raw)&&((last.sourceState??last.state)==='running')&&last.state!=='unknown'&&!last.buffering?raw:0;
  const delta=Math.max(0,Math.min(.1,dt||0));
  if(!reduced.matches){
   inputAngle=(inputAngle+input*6*delta)%360;outputAngle=(outputAngle+Math.max(0,speed)*6*delta)%360;
   inputRotor.setAttribute('transform',`rotate(${inputAngle.toFixed(3)} 32 28)`);outputRotor.setAttribute('transform',`rotate(${outputAngle.toFixed(3)} 145 28)`);
   flow.style.strokeDashoffset=String(-inputAngle/3.6);
  }
  root.dataset.inputAngle=inputAngle.toFixed(3);root.dataset.outputAngle=outputAngle.toFixed(3);root.dataset.outputRpm=String(speed);
  elapsed+=delta;if(elapsed>=.25){elapsed%=.25;q('.power-actual').textContent=last.state==='unknown'?'—':Math.max(0,speed).toFixed(1);}
 }
 render();
 return {render,tick,close,dispose(){root.removeEventListener('focusout',focusOut);document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);}};
}
