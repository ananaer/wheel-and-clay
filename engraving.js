/* 展示旋转只消费同一马达的 RPM 与帧时长；刻印时减速定位，不倒转或瞬间交回转速。 */
const TAU=Math.PI*2;
const smooth=value=>value*value*(3-2*value);
export function advanceWheelRotation(rotation,angularVelocity,rpm,dt){
 const target=Number.isFinite(rpm)&&rpm>0?rpm/60*TAU:0;
 const decay=Math.exp(-dt/.55),difference=angularVelocity-target;
 return {rotation:rotation+target*dt+difference*.55*(1-decay),angularVelocity:target+difference*decay};
}

export function createEngravingSequence({alignDuration=.8,scanDuration=1.8,holdDuration=.65,targetAngle=.35-.04*TAU}={}){
 const brakeSeconds=Number.isFinite(alignDuration)&&alignDuration>=0?alignDuration:.8;
 const scanSeconds=Number.isFinite(scanDuration)&&scanDuration>0?scanDuration:1.8;
 const holdSeconds=Number.isFinite(holdDuration)&&holdDuration>=0?holdDuration:.65;
 const target=Number.isFinite(targetAngle)?targetAngle:.35-.04*TAU;
 let phase='align',progress=0,active=false,rotation=target,angularVelocity=0;
 let startAngle=target,endAngle=target,phaseElapsed=0,alignProgress=0,plan=null,reduced=false;
 const snapshot=()=>Object.freeze({phase,progress,active,rotation,angularVelocity,alignProgress,holdProgress:phase==='hold'?(holdSeconds>0?Math.min(1,phaseElapsed/holdSeconds):1):phase==='complete'?1:0});
 function reset(currentAngle=target,currentVelocity=18/60*TAU){
  rotation=startAngle=Number.isFinite(currentAngle)?currentAngle:target;
  angularVelocity=Number.isFinite(currentVelocity)?Math.max(0,currentVelocity):0;
  phase='align';phaseElapsed=0;progress=0;alignProgress=0;active=false;plan=null;reduced=false;
  return snapshot();
 }
 function planAlignment(rpm){
  const sourceVelocity=rpm/60*TAU;
  let distance=((target-startAngle)%TAU+TAU)%TAU;
  if(distance<1e-10)distance=0;
  if(distance===0&&angularVelocity===0){plan={duration:0};endAngle=startAngle;return;}
  const velocity=angularVelocity||sourceVelocity;
  const braking=velocity*brakeSeconds/2;
  // 只选择前方朝向，留足制动距离；绝不在不足一圈时靠提速或倒转赶到。
  while(distance<braking-1e-10)distance+=TAU;
  endAngle=startAngle+distance;
  plan={velocity,reference:sourceVelocity,coast:Math.max(0,(distance-braking)/velocity),brake:brakeSeconds};
  plan.duration=plan.coast+plan.brake;
 }
 function step({dt,rpm,powered=true,reducedMotion=false}={}){
  active=false;
  if(reducedMotion){phase='complete';progress=1;angularVelocity=0;alignProgress=1;reduced=true;return snapshot();}
  if(reduced||!Number.isFinite(dt)||dt<=0)return snapshot();
  const motorRpm=Number.isFinite(rpm)&&rpm>0?rpm:0;
  let remaining=Math.min(dt,.1);
  if(phase==='complete'){
   ({rotation,angularVelocity}=advanceWheelRotation(rotation,angularVelocity,motorRpm,remaining));return snapshot();
  }
  if(motorRpm<=0){angularVelocity=0;return snapshot();}
  const scanRate=Math.min(motorRpm/18,2.5);
  while(remaining>1e-12){
   if(phase==='align'){
    if(!plan)planAlignment(motorRpm);
    if(plan.duration>0){
     const rate=(motorRpm/60*TAU)/plan.reference;
     const used=Math.min(remaining,Math.max(0,plan.duration-phaseElapsed)/rate);
     phaseElapsed+=used*rate;remaining-=used;
     const coast=Math.min(phaseElapsed,plan.coast),u=plan.brake>0?Math.min(1,Math.max(0,(phaseElapsed-plan.coast)/plan.brake)):1;
     rotation=startAngle+plan.velocity*(coast+plan.brake*(u-u*u*u+.5*u*u*u*u));
     angularVelocity=plan.velocity*rate*(1-smooth(u));
     alignProgress=Math.min(1,phaseElapsed/plan.duration);
    }
    if(plan.duration===0||phaseElapsed>=plan.duration-1e-10){phase='scan';phaseElapsed=0;rotation=endAngle;angularVelocity=0;alignProgress=1;}
    else break;
   }else if(!powered){break;
   }else if(phase==='scan'){
    const used=Math.min(remaining,Math.max(0,scanSeconds-phaseElapsed)/scanRate);
    phaseElapsed+=used*scanRate;remaining-=used;progress=Math.min(1,phaseElapsed/scanSeconds);
    if(progress>=1-1e-12){phase='hold';phaseElapsed=0;progress=1;}
   }else if(phase==='hold'){
    const used=Math.min(remaining,Math.max(0,holdSeconds-phaseElapsed));
    phaseElapsed+=used;remaining-=used;
    if(phaseElapsed>=holdSeconds-1e-12){phase='complete';phaseElapsed=0;}
   }else{
    ({rotation,angularVelocity}=advanceWheelRotation(rotation,angularVelocity,motorRpm,remaining));remaining=0;
   }
  }
  active=powered&&phase==='scan'&&progress<1;
  return snapshot();
 }
 return Object.freeze({reset,step,snapshot});
}
