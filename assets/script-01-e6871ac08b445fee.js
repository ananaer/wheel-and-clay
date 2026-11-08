/* 陶坯规则：纯函数，可离线验收。转盘无动力时不能改形。 */
(function(root){
 'use strict';
 const COUNT=129, MIN=.24, MAX=1.23, HEIGHT=2.65;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 // 传感器保持原始 RPM；传动将高速跑轮转换为可操作的陶轮目标转速。
 // 低速 3:1，36 RPM 以上连续接入软上限；零速绝不添加最低动力。
 function potteryDrive(sensorRpm){
   if(typeof sensorRpm!=='number'||!Number.isFinite(sensorRpm)||sensorRpm<0)return null;
   return sensorRpm<=36?sensorRpm/3:12-16*Math.expm1(-(sensorRpm-36)/48);
 }
 function driveSignal(signal={}){
   const target=['running','idle'].includes(signal.state)?potteryDrive(signal.rpm):null;
   return target===null?{...signal,state:'unknown',rpm:null,potteryRpm:null}:{...signal,potteryRpm:target};
 }
 // LIVE 抗抖只管理游戏动力，不覆盖传感器状态。计时由调用方注入，SIM 不调用。
 function createLivePowerBuffer({holdMs=90000}={}){
   if(typeof holdMs!=='number'||!Number.isFinite(holdMs)||holdMs<=0)throw new RangeError('holdMs must be a positive finite duration');
   let heldRpm=null,lastPositiveObservedAt=null,latestKnownObservedAt=null,lastPositiveAt=null,badSince=null,lastNow=null;
   const stamp=value=>{
     if(typeof value==='number')return Number.isFinite(value)&&value>=0?value:null;
     if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(value))return null;
     const parsed=Date.parse(value);return Number.isFinite(parsed)&&parsed>=0?parsed:null;
   };
   function reset(){heldRpm=null;lastPositiveObservedAt=null;latestKnownObservedAt=null;lastPositiveAt=null;badSince=null;lastNow=null;}
   function update(normalizedSignal,nowMs){
     if(typeof nowMs!=='number'||!Number.isFinite(nowMs)||nowMs<0)throw new RangeError('nowMs must be a finite non-negative timestamp');
     const source=normalizedSignal&&typeof normalizedSignal==='object'?normalizedSignal:{};
     // 系统时间回拨不得增加正在进行的缓冲剩余时间。
     const now=lastNow===null?nowMs:Math.max(lastNow,nowMs);lastNow=now;
     const sourceState=source.state??'unknown',sourceRpm=source.rpm??null,observed=stamp(source.observedAt);
     const validRpm=typeof sourceRpm==='number'&&Number.isFinite(sourceRpm)&&sourceRpm>=0;
     const positive=sourceState==='running'&&validRpm&&sourceRpm>0&&observed!==null;
     const zero=(sourceState==='idle'||sourceState==='running')&&validRpm&&sourceRpm===0;
     const newer=positive&&(latestKnownObservedAt===null||observed>latestKnownObservedAt);
     // 已见到更新的有效零样本后，较旧的正样本也不能恢复；未知时间戳不可信，不抬高水位。
     if((positive||zero)&&observed!==null&&(latestKnownObservedAt===null||observed>latestKnownObservedAt))latestKnownObservedAt=observed;
     let powerState,powerRpm,buffering=false,bufferRemainingMs=0;
     if(newer){
       heldRpm=sourceRpm;lastPositiveObservedAt=observed;lastPositiveAt=now;badSince=null;
       powerState='running';powerRpm=heldRpm;
     }else if(positive&&observed===lastPositiveObservedAt&&badSince===null){
       // 同一新鲜样本在正常段可使用，但不更改上次接受值或续期时间。
       powerState='running';powerRpm=heldRpm;
     }else{
       if(heldRpm!==null){
         // 第一次零速/未知启动固定 episode；坏状态互换与旧正样本都不重启。
         if(badSince===null)badSince=now;
         bufferRemainingMs=Math.max(0,holdMs-(now-badSince));
       }
       buffering=heldRpm!==null&&bufferRemainingMs>0;
       powerState=buffering?'running':zero?'idle':'unknown';
       powerRpm=buffering?heldRpm:zero?0:null;
     }
     return Object.freeze({...source,sourceState,sourceRpm,sourceObservedAt:source.observedAt??null,sourceFreshnessAt:source.freshnessAt??null,
       powerState,powerRpm,buffering,bufferRemainingMs,bufferStartedAt:badSince,bufferExpiresAt:badSince===null?null:badSince+holdMs,
       lastPositiveObservedAt,latestKnownObservedAt,lastPositiveAt});
   }
   return Object.freeze({update,reset});
 }
 function simulatedWheelRpm(mode='steady',time=0){
   const now=Number.isFinite(time)?time:0;
   return mode==='steady'?60+Math.sin(now/2100)*1.8:mode==='sprint'?110+Math.sin(now/1300)*6:0;
 }
 function profile(kind='vase'){
   const anchors=kind==='bowl'?[[0,.59],[.1,.67],[.28,.83],[.5,1.02],[.75,1.12],[1,1.16]]:kind==='column'?[[0,.6],[.08,.69],[.4,.72],[.8,.69],[1,.7]]:[[0,.56],[.06,.66],[.22,.94],[.43,1.01],[.63,.81],[.78,.46],[.92,.38],[1,.47]];
   return fromAnchors(anchors);
 }
 function fromAnchors(anchors){
   const slopes=anchors.map((a,i)=>{const before=anchors[Math.max(0,i-1)],after=anchors[Math.min(anchors.length-1,i+1)];return (after[1]-before[1])/(after[0]-before[0]);});
   return Array.from({length:COUNT},(_,i)=>{const y=i/(COUNT-1);let j=0;while(j<anchors.length-2&&anchors[j+1][0]<y)j++;const a=anchors[j],b=anchors[j+1],width=b[0]-a[0],u=clamp((y-a[0])/width,0,1),u2=u*u,u3=u2*u;return clamp((2*u3-3*u2+1)*a[1]+(u3-2*u2+u)*width*slopes[j]+(-2*u3+3*u2)*b[1]+(u3-u2)*width*slopes[j+1],MIN,MAX);});
 }
 function sculpt(values,center,delta,radius,rpm){
   if(!Array.isArray(values)||values.length!==COUNT||!Number.isFinite(rpm)||rpm<.5)return values.slice();
   const power=clamp(rpm/16,.12,1.65),safeDelta=clamp(delta,-.12,.12)*power,spread=clamp(radius,.035,.3),c=clamp(center,0,1);
   return values.map((v,i)=>{const y=i/(COUNT-1),weight=Math.exp(-.5*((y-c)/spread)**2),foot=clamp(y/.085,0,1),room=clamp((safeDelta>0?MAX-v:v-MIN)/.38,0,1);return clamp(v+safeDelta*weight*foot*room,MIN,MAX);});
 }
 // 位移只决定施力，不直接增加半径。持续按住时按秒加工，松手没有待执行的形变。
 function touchTarget(offset,reach){
   if(!Number.isFinite(offset)||!Number.isFinite(reach)||reach<=0||Math.abs(offset)<=3)return 0;
   return Math.sign(offset)*clamp((Math.abs(offset)-3)/reach,0,1);
 }
 function stepTouch(current,target,dt){
   if(!Number.isFinite(current)||!Number.isFinite(target)||!Number.isFinite(dt)||dt<=0)return {pressure:0,delta:0};
   const seconds=clamp(dt,0,.1),goal=clamp(target,-1,1),start=clamp(current,-1,1),decay=Math.exp(-seconds/.12);
   // 积分而非每帧累加固定量，避免鼠标采样率或帧率决定手感。
   return {pressure:goal+(start-goal)*decay,delta:.065*(goal*seconds+(start-goal)*.12*(1-decay))};
 }
 function orderProfile(id='vase'){
   const designs={
    beaker:[[0,.6],[.15,.6],[.48,.62],[.78,.8],[1,.81]],
    flare:[[0,.6],[.18,.62],[.5,.53],[.72,.64],[1,1.04]],
    pear:[[0,.6],[.23,.98],[.43,.94],[.66,.63],[.86,.36],[1,.4]],
    spindle:[[0,.6],[.2,.65],[.48,.95],[.68,.72],[.88,.4],[1,.36]],
    gourd:[[0,.6],[.22,.98],[.43,.71],[.55,.44],[.75,.78],[.9,.52],[1,.32]],
    tulip:[[0,.6],[.22,.83],[.43,.82],[.68,.38],[.84,.4],[1,.76]]
   };
   const start=profile('column'),vase=profile('vase'),custom=designs[id]?fromAnchors(designs[id]):null;
   return start.map((v,i)=>{const y=i/(COUNT-1),target=custom?custom[i]:id==='cup'?.55+.22*y+.035*Math.sin(y*Math.PI*2):id==='jar'?.53+.49*Math.pow(Math.sin(y*Math.PI),.72):vase[i]*.88;const foot=clamp(y/.12,0,1);return clamp(v+(target-v)*foot*foot*(3-2*foot),MIN,MAX);});
 }
 function similarity(actual,target){if(!validProfile(actual)||!validProfile(target))return 0;const error=Math.sqrt(actual.reduce((sum,v,i)=>sum+(v-target[i])**2,0)/COUNT);return Math.round(clamp(1-error/.45,0,1)*100);}
 // 修坯从一件完整目标上的局部损伤开始；同一委托始终相同，不靠随机决定难度。
 function repairCommission(id='cup'){
   const damage={cup:[.57,.34,'wall'],beaker:[.48,.34,'wall'],flare:[.82,-.34,'rim'],vase:[.38,-.34,'belly'],jar:[.48,-.34,'belly'],pear:[.3,-.34,'belly'],spindle:[.48,-.34,'belly'],gourd:[.55,.34,'waist'],tulip:[.71,.34,'neck']};
   const [center,delta,region]=damage[id]||damage.cup,target=orderProfile(id),halfWidth=.23;
   const mask=target.map((_,i)=>Math.abs(i/(COUNT-1)-center)<halfWidth);
   const initial=target.map((v,i)=>{const d=Math.abs(i/(COUNT-1)-center);return d>=halfWidth?v:clamp(v+delta*Math.cos(d/halfWidth*Math.PI/2)**2,MIN,MAX);});
   return {id,target,initial,mask,center,halfWidth,brushRadius:.095,region,direction:delta>0?'narrow':'widen',budget:12};
 }
 function repairMetrics(actual,commission,edited=false){
   if(!commission||!validProfile(actual)||!validProfile(commission.initial)||!validProfile(commission.target)||!Array.isArray(commission.mask)||commission.mask.length!==COUNT)return {shape:0,repair:0,preservation:0,success:false};
   let originalError=0,error=0,intactError=0,intactCount=0;
   actual.forEach((v,i)=>{if(commission.mask[i]){originalError+=(commission.initial[i]-commission.target[i])**2;error+=(v-commission.target[i])**2;}else{intactError+=(v-commission.initial[i])**2;intactCount++;}});
   const shape=similarity(actual,commission.target),repair=Math.round(clamp(1-Math.sqrt(error/Math.max(originalError,1e-12)),0,1)*100);
   const preservation=Math.round(clamp(1-Math.sqrt(intactError/Math.max(1,intactCount))/.2,0,1)*100);
   const worked=edited&&changed(actual,commission.initial);
   return {shape,repair,preservation,success:worked&&shape>=85&&preservation>=90};
 }
 function spendTurns(used,rpm,dt,known=true,budget=20){if(!known||!Number.isFinite(rpm)||rpm<=0||!Number.isFinite(dt)||dt<=0)return used;return Math.min(budget,used+rpm/60*clamp(dt,0,.1));}
 // 停跑玩法必须先见到有效跑动；断线既不扣圈，也绝不当作仓鼠停跑。
 function advanceRound(state,rpm,dt,signal){
   const next={...state},known=signal==='running'||signal==='idle',seconds=Number.isFinite(dt)?clamp(dt,0,.1):0;
   if(!known){next.lastSignal=null;next.idleSeconds=0;return next;}
   if(state.lastSignal==='running'&&signal==='idle')next.stops++;
   next.lastSignal=signal;
   next.used=spendTurns(state.used,rpm,seconds,true,state.play==='turns'?20:state.play==='repair'?12:Infinity);
   next.armed=state.armed||(signal==='running'&&rpm>=.5);
   next.idleSeconds=signal==='idle'&&next.armed?(state.idleSeconds||0)+seconds:0;
   if(state.play==='turns'&&next.used>=20)next.reason='exhausted';
   if(state.play==='repair'&&next.used>=12)next.reason='repairExhausted';
   if(state.play==='burst'&&next.armed&&next.idleSeconds>=3&&Number.isFinite(rpm)&&rpm<.5)next.reason='settled';
   return next;
 }
 function validProfile(v){return Array.isArray(v)&&v.length===COUNT&&v.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=MIN&&n<=MAX);}
 function stepMotor(current,target,dt){return current+(Math.max(0,Math.min(90,target))-current)*(1-Math.exp(-Math.max(0,Math.min(.1,dt))/(target>current?.75:1.3)));}
 function changed(a,b){return a.some((v,i)=>Math.abs(v-b[i])>1e-5);}
 function history(initial,kind='vase'){let entries=[{values:initial.slice(),kind}],index=0;return {push(v,nextKind=entries[index].kind){if(!changed(entries[index].values,v)&&nextKind===entries[index].kind)return;entries=entries.slice(0,index+1);entries.push({values:v.slice(),kind:nextKind});if(entries.length>40)entries.shift();index=entries.length-1;},undo(){if(index>0)index--;return entries[index].values.slice();},redo(){if(index<entries.length-1)index++;return entries[index].values.slice();},get form(){return entries[index].kind;},get canUndo(){return index>0;},get canRedo(){return index<entries.length-1;}};}
 root.Pottery={COUNT,MIN,MAX,HEIGHT,clamp,potteryDrive,driveSignal,createLivePowerBuffer,simulatedWheelRpm,profile,sculpt,touchTarget,stepTouch,orderProfile,similarity,repairCommission,repairMetrics,spendTurns,advanceRound,validProfile,stepMotor,changed,history};
 if(typeof module!=='undefined')module.exports=root.Pottery;
})(typeof window!=='undefined'?window:globalThis);
