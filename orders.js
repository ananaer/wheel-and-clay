/* 器形题库与三种本机玩法；真实与模拟来源永久随作品保留。 */
export function createOrders(hooks){
 const P=window.Pottery,$=id=>document.getElementById(id);
 const put=(id,value)=>{if($(id).textContent!==String(value))$(id).textContent=value;};
 const catalog=[
  ['cup','easy'],['beaker','easy'],['flare','easy'],
  ['vase','medium'],['jar','medium'],['pear','medium'],
  ['spindle','advanced'],['gourd','advanced'],['tulip','advanced']
 ];
 const words={
  notReady:['转盘尚未就绪，请返回工作台查看。','The wheel is not ready. Return to Studio to check.'],
  open:['去挑战工坊 ↗','Explore commissions ↗'],chapter:['挑战工坊 · 九种器形','THE COMMISSION SHELF · NINE FORMS'],choose:['今天，做一件什么？','What will you make today?'],
  rules:['选一件器形，找一种节奏。','Choose a form. Find your rhythm.'],
  cup:['弧线杯','Curved cup'],beaker:['折线杯','Angled beaker'],flare:['喇叭瓶','Flared vase'],vase:['束口瓶','Narrow-neck vase'],jar:['圆腹罐','Round jar'],pear:['梨形瓶','Pear vase'],spindle:['纺锤瓶','Spindle vase'],gourd:['葫芦瓶','Double gourd'],tulip:['花口瓶','Tulip vase'],
  cupTip:['轻收杯壁，留住微张的口沿。','Taper the wall; leave a gently open rim.'],beakerTip:['上段外放，下段保持直线。','Open the upper wall; keep the lower part straight.'],flareTip:['先收腰，再慢慢打开瓶口。','Narrow the waist, then open the mouth.'],vaseTip:['圆腹、细颈、小翻口。','Round belly, slender neck, a small lip.'],jarTip:['先做饱满的腹部，再收口。','Build a full belly, then narrow the rim.'],pearTip:['重心下移，肩部缓缓收拢。','Keep the fullness low and taper the shoulder.'],spindleTip:['最宽处在中段，两端收细。','Keep the widest point in the middle.'],gourdTip:['上下两个圆腹，中间收腰。','Shape two bellies with a narrow waist.'],tulipTip:['细颈与花口，试试小指腹。','Use a fine touch for the neck and flower-like rim.'],
  easy:['入门','FIRST STEPS'],medium:['进阶','CURVES'],advanced:['精修','FINE WORK'],
  playLabel:['选择玩法','Choose a mode'],study:['临摹练习','Open practice'],turns:['20 圈订单','Twenty turns'],burst:['一跑定形','One run only'],repair:['修坯委托','Rescue a pot'],
  studyShort:['不限圈，慢慢找到手感。','No turn limit. Take your time.'],turnsShort:['用有限的转动，接近目标。','A small budget. Make every turn count.'],burstShort:['它一停稳，这件就定形。','When it stops, your shape is set.'],repairShort:['修好一处，护住其余。限 12 圈。','Fix the flaw. Protect the rest. 12 turns.'],
  studyRule:['没有圈数上限。跑轮停了就休息，满意时交付。','No turn limit. Rest when the wheel rests; deliver when you are ready.'],
  turnsRule:['20 圈陶轮转动用完自动定形。仓鼠跑得越快，可操作的时间越短；停稳后暂停消耗。','The shape sets after 20 pottery-wheel turns. A faster hamster leaves less time; a resting wheel spends no turns.'],
  burstRule:['等它开跑。首次停跑并停稳后自动定形，也可提前交付；断线只会暂停。','Wait for a run. Its first settled stop sets your shape, or deliver early. Lost signals only pause the round.'],
  repairRule:['从受损陶坯开始，用 12 圈陶轮转动修复一处。轮廓达 85%、完好区保留 90% 视为修复成功；可提前交付，停稳暂停。','Repair a damaged pot in 12 pottery-wheel turns. Success needs 85% shape match and 90% intact area kept. You may deliver early; rest pauses the wheel.'],
  replaceKicker:['开始新挑战','A new commission'],replaceTitle:['先安放这一件。','Keep this moment.'],replaceBody:['工作台上还有未收藏的作品。开始新挑战会替换它。','There is an uncollected piece on your wheel. Starting a new commission replaces it.'],continuePiece:['继续当前作品','Continue this piece'],replacePiece:['放弃并开始','Discard & start'],finishFirst:['先完成当前挑战','Finish my current challenge first'],close:['关闭','Close'],
  start:['开始这件 ↗','Start this piece ↗'],unsaved:['新一局会替换当前陶坯。','A new round replaces the piece on your wheel.'],keepFirst:['先收藏当前作品','Keep my current piece first'],
  remaining:['剩余陶轮圈','Pottery turns left'],spent:['已用陶轮圈','Pottery turns used'],unit:['圈','turns'],match:['轮廓吻合','Shape match'],exit:['返回自由创作','Back to free creation'],
  running:['按住轻推，朝金色轮廓慢慢成形。','Hold a gentle pull toward the gold outline.'],sprinting:['转盘正在加速，试着减轻施力。','The wheel is speeding up. Use a lighter touch.'],waiting:['等仓鼠开工。停稳期间不消耗圈数。','Waiting for the hamster. No turns spent at rest.'],
  coasting:['跑轮停了，陶轮正慢慢停稳。','The wheel stopped. The clay is coasting.'],unknown:['信号未知，本局暂停计数与塑形。','Signal unknown. Shaping and the turn count are paused.'],finished:['器形已定，挑选釉色后收藏。','Shape set. Choose a glaze, then keep it.'],
  studyTitle:['随它转。\n慢慢做。','Follow the wheel.\nTake your time.'],turnsTitle:['20 圈。\n一件订单。','Twenty turns.\nOne commission.'],burstTitle:['这一跑。\n就这一件。','One run.\nOne chance.'],repairTitle:['修好一处。\n守住其余。','Rescue a pot.\nKeep its character.'],
  burstRun:['这一跑结束前，你也可以提前交付。','You can deliver before this run ends.'],burstWait:['等第一次跑动；开局静止不会结算。','Waiting for the first run. Rest at the start does not end it.'],burstCoast:['这一跑停下了，陶轮停稳就定形。','This run has stopped. The shape sets when the clay comes to rest.'],
  repairWall:['杯壁','wall'],repairRim:['口沿','rim'],repairBelly:['腹部','belly'],repairWaist:['束腰','waist'],repairNeck:['瓶颈','neck'],
  repairProgress:['损伤修复','Flaw repaired'],repairPreserved:['完好区保留','Intact area kept'],repairReady:['可交付','Ready to deliver'],repairProtect:['轻一点，保护完好部位','Ease off. Protect the intact area'],repairGoal:['修复：','Rescue: '],repairSuccess:['修复成功。','Pot rescued.'],repairRetry:['再修一次。','Try another rescue.'],repairExhausted:['12 圈已经用完。','All 12 turns are spent.'],repairThreshold:['达标线：轮廓 85% · 完好区 90%。','Goal: 85% shape match · 90% intact area kept.'],
  goal:['目标：','Target: '],submit:['交付器形 ↗','Set this shape ↗'],practice:['模拟练习','SIMULATED PRACTICE'],live:['实时数据局','LIVE-DATA ROUND'],
  practiceNote:['当前使用模拟跑轮；切换“停跑”可练习应对。','Using simulated activity. Try Rest to practise a stop.'],liveNote:['真实跑轮已连接；仓鼠决定何时开工。','The real wheel is connected. The hamster decides when work begins.'],signalNote:['实时信号尚未就绪。可先等待，或切换模拟练习。','Live data is not ready. You can wait or choose Simulation.'],
  pausedHint:['信号未知 · 本局已暂停','Signal unknown · round paused'],waitingHint:['转盘停稳 · 等仓鼠开工','Wheel at rest · waiting for the hamster'],
  used:['消耗动力','Turns used'],stops:['中途停跑','Stops along the way'],order:['目标器形','Commission'],decorate:['去施釉 ↗','Choose a glaze ↗'],again:['换一份题目','Choose another'],scoring:['成绩随作品保存在本机；模拟与实时分别标注。','Results stay with your piece on this device, labelled as simulation or live data.'],
  doneTitle:['这件，定形了。','Your shape is set.'],emptyTitle:['本局还没有加工','No shaping this round.'],exhausted:['20 圈已经用完。接下来，为它挑一层釉。','All 20 turns are spent. Choose a glaze for your piece.'],delivered:['你选择了在这里定形。接下来可以施釉。','You chose to set this shape. It is ready for glaze.'],settled:['仓鼠这一跑结束了。它留下的最后一点动力，决定了这件器形。','This run has ended. The last of its momentum set the shape of this piece.'],empty:['没有加工笔触，本局不计完成度。','No shaping strokes were made, so this round has no match score.']
 };
 const t=key=>words[key]?.[hooks.lang()==='zh'?0:1]||key;
 let selected='cup',play='turns',state=null,lastLang='';
 // 新挑战只有在明确选择后才替换未收藏作品；取消与 Esc 均保留原作。
 const replaceDialog=document.createElement('dialog');replaceDialog.id='challenge-replace-dialog';replaceDialog.className='confirm-dialog';replaceDialog.setAttribute('aria-labelledby','challenge-replace-title');replaceDialog.setAttribute('aria-describedby','challenge-replace-body');
 const replaceTop=document.createElement('div');replaceTop.className='dialog-top';
 const replaceKicker=document.createElement('span'),replaceClose=document.createElement('button');replaceClose.type='button';replaceClose.className='close-button';replaceClose.textContent='×';
 const replaceTitle=document.createElement('h2');replaceTitle.id='challenge-replace-title';
 const replaceBody=document.createElement('p');replaceBody.id='challenge-replace-body';
 const replaceActions=document.createElement('div');replaceActions.className='confirm-actions';
 const continuePiece=document.createElement('button');continuePiece.type='button';continuePiece.className='primary-button';continuePiece.id='challenge-continue';continuePiece.autofocus=true;
 const discardPiece=document.createElement('button');discardPiece.type='button';discardPiece.className='secondary-button';discardPiece.id='challenge-discard';
 const keepPiece=document.createElement('button');keepPiece.type='button';keepPiece.className='text-button';keepPiece.id='challenge-keep-first';
 replaceTop.append(replaceKicker,replaceClose);replaceActions.append(continuePiece,discardPiece);replaceDialog.append(replaceTop,replaceTitle,replaceBody,replaceActions,keepPiece);document.body.append(replaceDialog);
 replaceClose.addEventListener('click',()=>replaceDialog.close());
 continuePiece.addEventListener('click',()=>{replaceDialog.close();hooks.navigate('studio');$('scene').focus({preventScroll:true});});
 discardPiece.addEventListener('click',()=>{replaceDialog.close();startSelected();});
 keepPiece.addEventListener('click',()=>{replaceDialog.close();keepCurrent();});
 function repairCue(commission){const region=t('repair'+commission.region[0].toUpperCase()+commission.region.slice(1));return hooks.lang()==='zh'?region+(commission.direction==='narrow'?'鼓起，向内轻收。':'内陷，向外轻放。'):(commission.direction==='narrow'?'Bulging ':'Pinched ')+region+(commission.direction==='narrow'?'. Press gently inward.':'. Pull gently outward.');}
 function repairSummary(metrics){return `${t('repairProgress')} ${metrics.repair}% · ${t('repairPreserved')} ${metrics.preservation}%`;}

 const optionRoot=document.querySelector('.order-options');optionRoot.replaceChildren();
 for(const [id,level] of catalog){
  const button=document.createElement('button');button.dataset.order=id;button.type='button';
  const number=document.createElement('span');number.className='order-number';number.textContent=String(catalog.findIndex(row=>row[0]===id)+1).padStart(2,'0');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 100 130');svg.setAttribute('aria-hidden','true');
  const path=document.createElementNS('http://www.w3.org/2000/svg','path'),points=P.orderProfile(id).map((r,i)=>[r*30,115-i/(P.COUNT-1)*100]);
  path.setAttribute('d','M'+points.map(([r,y])=>`${50-r},${y}`).join('L')+'L'+points.slice().reverse().map(([r,y])=>`${50+r},${y}`).join('L')+'Z');svg.append(path);
  const text=document.createElement('span');text.className='order-card-copy';const title=document.createElement('strong'),small=document.createElement('small');title.dataset.orderI18n=id;small.dataset.orderI18n=level;text.append(title,small);
  button.append(number,svg,text);button.addEventListener('click',()=>{selected=id;render();});optionRoot.append(button);
 }
 function open(){if($('order-result').open)$('order-result').close();render();hooks.navigate('orders');}
 function begin(){
  if(!hooks.ready())return;
  if(hooks.dirty()){render();if(!replaceDialog.open)replaceDialog.showModal();return;}
  startSelected();
 }
 function startSelected(){
  if(!hooks.ready())return;
  if($('order-result').open)$('order-result').close();
  const repair=play==='repair'?P.repairCommission(selected):null;
  state={id:selected,play,target:repair?repair.target:P.orderProfile(selected),repair,used:0,edited:false,stops:0,lastSignal:null,armed:false,idleSeconds:0,hadSim:hooks.mode()==='sim',status:'running',startedAt:Date.now(),result:null};
  hooks.begin(state.target,repair?.initial,repair);hooks.navigate('studio');render();$('scene').focus({preventScroll:true});
 }
 function finish(reason='delivered'){
  if(!state||state.status!=='running')return;state.status='finished';state.hadSim ||= hooks.mode()==='sim';
  state.result={id:state.id,play:state.play,score:state.edited?P.similarity(hooks.profile(),state.target):0,used:state.used,stops:state.stops,hadSim:state.hadSim,reason,edited:state.edited,startedAt:state.startedAt,endedAt:Date.now()};
  if(state.repair){const metrics=P.repairMetrics(hooks.profile(),state.repair,state.edited);Object.assign(state.result,{repairProgress:metrics.repair,preservation:metrics.preservation,success:metrics.success});}
  hooks.finish();render();$('order-result').showModal();
 }
 function tick(rpm,dt){
  if(!state||state.status!=='running')return;
  state=P.advanceRound(state,rpm,dt,hooks.signal().state);state.hadSim ||= hooks.mode()==='sim';
  if(state.reason)finish(state.reason);
 }
 function keepCurrent(){hooks.navigate('studio');if(state?.status==='running')finish();else hooks.save();}
 function render(){
  replaceKicker.textContent=t('replaceKicker');replaceTitle.textContent=t('replaceTitle');replaceBody.textContent=t('replaceBody');replaceClose.setAttribute('aria-label',t('close'));continuePiece.textContent=t('continuePiece');discardPiece.textContent=t('replacePiece');keepPiece.textContent=t(state?.status==='running'?'finishFirst':'keepFirst');discardPiece.disabled=!hooks.ready();
  if(lastLang!==hooks.lang()){lastLang=hooks.lang();document.querySelectorAll('[data-order-i18n]').forEach(e=>e.textContent=t(e.dataset.orderI18n));}
  document.querySelectorAll('[data-order]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.order===selected)));
  document.querySelectorAll('[data-play]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.play===play)));
  put('order-rules',t(play+'Rule'));put('selected-order-name',t(selected));put('selected-order-tip',play==='repair'?repairCue(P.repairCommission(selected)):t(selected+'Tip'));
  document.body.dataset.challenge=state?state.status:'free';$('open-order').disabled=!hooks.ready();$('start-order').disabled=!hooks.ready();$('order-hud').hidden=!state;document.querySelector('.intro-actions').hidden=!!state;$('new').hidden=!!state;
  $('order-unsaved').hidden=!hooks.dirty();$('order-keep-first').hidden=!hooks.dirty();put('order-keep-first',t(state?.status==='running'?'finishFirst':'keepFirst'));put('order-start-source',t(!hooks.ready()?'notReady':hooks.mode()==='sim'?'practiceNote':hooks.signal().state==='unknown'?'signalNote':'liveNote'));
  const heading=state?t(state.play+'Title'):hooks.headline(),lead=state?t(state.play==='repair'?'repairGoal':'goal')+t(state.id):hooks.lead();
  if(document.querySelector('.intro h1').textContent!==heading)document.querySelector('.intro h1').textContent=heading;
  if(document.querySelector('.intro .lead').textContent!==lead)document.querySelector('.intro .lead').textContent=lead;
  if($('repair-metrics'))$('repair-metrics').hidden=!state?.repair;
  if(!state)return;
  const sample=hooks.signal(),running=state.status==='running',limited=state.play==='turns'||state.play==='repair',budget=state.play==='repair'?12:20;
  const metrics=state.repair?P.repairMetrics(hooks.profile(),state.repair,state.edited):null;
  put('order-count-label',t(limited?'remaining':'spent'));put('order-remaining',(limited?Math.max(0,budget-state.used):state.used).toFixed(1));put('order-match',P.similarity(hooks.profile(),state.target)+'%');$('order-progress').hidden=!limited;$('order-progress').max=budget;$('order-progress').value=budget-state.used;$('order-progress').setAttribute('aria-label',t('remaining'));
  if(metrics&&$('repair-metrics'))put('repair-metrics',repairSummary(metrics)+(metrics.success?' · '+t('repairReady'):''));
  let hint=!running?'finished':sample.state==='unknown'?'unknown':sample.state==='idle'?(hooks.rpm()>=.5?'coasting':'waiting'):hooks.rpm()>=23?'sprinting':'running';
  if(running&&sample.state!=='unknown'&&state.play==='burst')hint=!state.armed?'burstWait':sample.state==='idle'?'burstCoast':'burstRun';
  const repairHint=running&&metrics&&sample.state==='running'?(metrics.preservation<90?t('repairProtect'):repairCue(state.repair)):null;
  put('order-state',repairHint||t(hint));
  if(running&&sample.state==='unknown')put('stage-hint',t('pausedHint'));
  else if(running&&sample.state==='idle'&&hooks.rpm()<.5)put('stage-hint',t('waitingHint'));
  if(running){put('save',t('submit'));$('save').disabled=!state.edited;}
  if(state.result){
   const r=state.result,isRepair=r.play==='repair';
   put('result-source',t(r.hadSim?'practice':'live')+' · '+t(r.play));put('result-title',t(isRepair?(r.success?'repairSuccess':'repairRetry'):r.edited?'doneTitle':'emptyTitle'));put('result-score',r.score);
   put('result-note',isRepair?repairSummary({repair:r.repairProgress,preservation:r.preservation})+(hooks.lang()==='zh'?'。 ':'. ')+t(r.edited?'repairThreshold':'empty'):t(r.edited?r.reason:'empty'));
   put('result-turns',r.used.toFixed(1)+(r.play==='turns'?' / 20':isRepair?' / 12':''));put('result-stops',r.stops);put('result-order',t(r.id));
  }
 }
 document.querySelectorAll('[data-play]').forEach(b=>b.addEventListener('click',()=>{play=b.dataset.play;render();}));
 $('open-order').addEventListener('click',open);$('start-order').addEventListener('click',begin);
 $('order-keep-first').addEventListener('click',keepCurrent);
 $('exit-order').addEventListener('click',()=>{state=null;hooks.exit();render();});
 $('result-keep').addEventListener('click',()=>{$('order-result').close();$('save').focus({preventScroll:true});});
 $('result-again').addEventListener('click',open);
 const validRecord=r=>r&&catalog.some(([id])=>id===r.id);
 return {open,begin,finish,tick,render,markSourceMode(){if(state&&hooks.mode()==='sim')state.hadSim=true;},markEdited(){if(state?.status==='running')state.edited=true;},get active(){return !!state;},get running(){return state?.status==='running';},get canSculpt(){return !state||state.status==='running';},get result(){return state?.result||null;},clear(){state=null;hooks.exit();render();},name(record){return validRecord(record)?t(record.id):'';},caption(record,includeName=true){return validRecord(record)&&Number.isFinite(record.score)&&Number.isFinite(record.used)?`${includeName?t(record.id)+' · ':''}${record.score}% · ${record.used.toFixed(1)}${!record.play||record.play==='turns'?' / 20':record.play==='repair'?' / 12':''} ${t('unit')} · ${t(record.play||'turns')}${record.play==='repair'?' · '+t(record.success?'repairSuccess':'repairRetry'):''}`:'';}};
}
