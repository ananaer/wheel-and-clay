/* 首页刻印只消费观察到的动力与帧时长，不自行造时间、转速或帧循环。 */
export function createEngravingSequence({alignDuration=.28,scanDuration=1.8,holdDuration=.65,targetAngle=.35-.04*Math.PI*2}={}){
 const alignSeconds=Number.isFinite(alignDuration)&&alignDuration>=0?alignDuration:.28;
 const scanSeconds=Number.isFinite(scanDuration)&&scanDuration>0?scanDuration:1.8;
 const holdSeconds=Number.isFinite(holdDuration)&&holdDuration>=0?holdDuration:.65;
 const target=Number.isFinite(targetAngle)?targetAngle:.35-.04*Math.PI*2;
 let phase='align',progress=0,active=false,rotation=target;
 let startAngle=target,endAngle=target,phaseElapsed=0;
 const snapshot=()=>Object.freeze({phase,progress,active,rotation});
 function reset(currentAngle=target){
  startAngle=Number.isFinite(currentAngle)?currentAngle:target;
  // 选择最近的等价朝向；不先归一化当前角，避免回放瞬间跨越整圈。
  endAngle=startAngle+Math.atan2(Math.sin(target-startAngle),Math.cos(target-startAngle));
  phase='align';phaseElapsed=0;progress=0;active=false;rotation=startAngle;
  return snapshot();
 }
 function step({dt,rpm,powered=true,reducedMotion=false}={}){
  active=false;
  if(reducedMotion){phase='complete';progress=1;rotation=null;phaseElapsed=0;return snapshot();}
  if(phase==='complete'||!powered||!Number.isFinite(rpm)||rpm<=0||!Number.isFinite(dt)||dt<=0)return snapshot();
  let remaining=Math.min(dt,.1);
  const scanRate=Math.min(rpm/18,2.5);
  // 阶段边界把本帧剩余时间交给下一阶段，避免帧率改变总完成时间。
  while(remaining>0&&phase!=='complete'){
   if(phase==='align'){
    const used=Math.min(remaining,Math.max(0,alignSeconds-phaseElapsed));
    phaseElapsed+=used;remaining-=used;
    const u=alignSeconds>0?Math.min(1,phaseElapsed/alignSeconds):1;
    rotation=startAngle+(endAngle-startAngle)*u*u*(3-2*u);
    if(u>=1){phase='scan';phaseElapsed=0;rotation=endAngle;}
   }else if(phase==='scan'){
    const used=Math.min(remaining,Math.max(0,scanSeconds-phaseElapsed)/scanRate);
    phaseElapsed+=used*scanRate;remaining-=used;
    progress=Math.min(1,phaseElapsed/scanSeconds);
    if(progress>=1){phase='hold';phaseElapsed=0;progress=1;}
   }else{
    const used=Math.min(remaining,Math.max(0,holdSeconds-phaseElapsed));
    phaseElapsed+=used;remaining-=used;
    if(phaseElapsed>=holdSeconds){phase='complete';phaseElapsed=0;rotation=null;}
   }
  }
  active=phase==='scan'&&progress<1;
  return snapshot();
 }
 return Object.freeze({reset,step,snapshot});
}
