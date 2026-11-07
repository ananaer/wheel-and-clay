import {createEngravingSequence} from './engraving.js';

// 首页制作只消费主场景提供的时间和动力，不创建 RAF、计时器或页面节点。
const CRAFT_PHASES=['clay','shape','glaze','engrave','complete'];
const CRAFT_DURATIONS=[.4,3.2,1.7,.28+1.8+.65];
const CRAFT_TOTAL=CRAFT_DURATIONS.reduce((sum,value)=>sum+value,0);
const craftClamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
const craftSmooth=value=>{const t=craftClamp(value);return t*t*(3-2*t);};
const CRAFT_ANCHORS=[[0,.56],[.05,.59],[.14,.72],[.28,.96],[.43,1.04],[.55,1.02],[.64,.92],[.72,.69],[.8,.44],[.88,.41],[.94,.48],[1,.62]];

// 保形三次插值：宽腹完整承接金印，肩部收向细颈，口沿在最后一道工序翻开。
function craftFinishedProfile(count){
 const secants=CRAFT_ANCHORS.slice(1).map((point,index)=>(point[1]-CRAFT_ANCHORS[index][1])/(point[0]-CRAFT_ANCHORS[index][0]));
 const slopes=CRAFT_ANCHORS.map((point,index)=>{
  if(index===0)return secants[0];
  if(index===CRAFT_ANCHORS.length-1)return secants.at(-1);
  const before=secants[index-1],after=secants[index];
  if(before*after<=0)return 0;
  const previousWidth=point[0]-CRAFT_ANCHORS[index-1][0],nextWidth=CRAFT_ANCHORS[index+1][0]-point[0];
  const w1=2*nextWidth+previousWidth,w2=nextWidth+2*previousWidth;
  return (w1+w2)/(w1/before+w2/after);
 });
 return Object.freeze(Array.from({length:count},(_,index)=>{
  const y=index/(count-1);let segment=0;
  while(segment<CRAFT_ANCHORS.length-2&&CRAFT_ANCHORS[segment+1][0]<y)segment++;
  const a=CRAFT_ANCHORS[segment],b=CRAFT_ANCHORS[segment+1],width=b[0]-a[0],u=(y-a[0])/width,u2=u*u,u3=u2*u;
  return craftClamp((2*u3-3*u2+1)*a[1]+(u3-2*u2+u)*width*slopes[segment]+(-2*u3+3*u2)*b[1]+(u3-u2)*width*slopes[segment+1],.24,1.23);
 }));
}

export function createCraftDemo({count=129}={}){
 const size=Number.isInteger(count)&&count>=2&&count<=1025?count:129;
 const clay=Object.freeze(Array.from({length:size},(_,index)=>.56+.035*Math.sin(Math.PI*index/(size-1))));
 const finished=craftFinishedProfile(size),engraving=createEngravingSequence();
 let phaseIndex=0,phaseElapsed=0,engraveElapsed=0,lastAngle=0,profile=clay,laserActive=false;
 let engravingState=engraving.snapshot(),lastShapeProgress=-1;

 function updateProfile(){
  if(phaseIndex===0){profile=clay;lastShapeProgress=-1;return;}
  if(phaseIndex>=2){profile=finished;return;}
  const progress=phaseElapsed/CRAFT_DURATIONS[1];
  if(progress===lastShapeProgress)return;
  lastShapeProgress=progress;
  // 形变带从下腹逐步上移；尚未触及的颈、口保持原坯，避免整件均匀缩放。
  profile=progress===0?clay:Object.freeze(clay.map((radius,index)=>{
   const y=index/(size-1),local=craftSmooth((progress-.72*y)/.28);
   return craftClamp(radius+(finished[index]-radius)*local,.24,1.23);
  }));
 }

 function snapshot(){
  const phaseProgress=phaseIndex===4?1:phaseIndex===3?craftClamp(engraveElapsed/CRAFT_DURATIONS[3]):craftClamp(phaseElapsed/CRAFT_DURATIONS[phaseIndex]);
  const completed=CRAFT_DURATIONS.slice(0,phaseIndex).reduce((sum,value)=>sum+value,0);
  return Object.freeze({
   phase:CRAFT_PHASES[phaseIndex],phaseProgress,
   progress:phaseIndex===4?1:craftClamp((completed+phaseProgress*CRAFT_DURATIONS[phaseIndex])/CRAFT_TOTAL),
   profile,heightScale:phaseIndex===0?.72:phaseIndex>=2?1:.72+.28*craftSmooth(phaseProgress),
   glazeProgress:phaseIndex<2?0:phaseIndex===2?craftSmooth(phaseProgress):1,
   laserProgress:phaseIndex<3?0:phaseIndex===3?engravingState.progress:1,
   laserActive,rotation:phaseIndex===3?engravingState.rotation:null,
   toolHeight:phaseIndex===1?craftClamp((phaseProgress-.14)/.72,.04,.98):null
  });
 }

 function reset(currentAngle=0){
  phaseIndex=0;phaseElapsed=0;engraveElapsed=0;lastShapeProgress=-1;profile=clay;laserActive=false;
  lastAngle=Number.isFinite(currentAngle)?currentAngle:0;
  engravingState=engraving.reset(lastAngle);
  return snapshot();
 }

 // 仅记录刻印的名义工时来绘制总进度；真正的朝向、印记与激光由原刻印器控制。
 function advanceEngravingClock(seconds,rate){
  let remaining=seconds;
  for(const [end,speed] of [[.28,1],[.28+1.8,rate],[CRAFT_DURATIONS[3],1]]){
   if(remaining<=0||engraveElapsed>=end)continue;
   const used=Math.min(remaining,(end-engraveElapsed)/speed);
   engraveElapsed=Math.min(end,engraveElapsed+used*speed);remaining-=used;
  }
 }

 function step({dt,rpm,powered=true,reducedMotion=false,currentAngle}={}){
  laserActive=false;
  if(Number.isFinite(currentAngle))lastAngle=currentAngle;
  if(reducedMotion){
   phaseIndex=4;phaseElapsed=0;engraveElapsed=CRAFT_DURATIONS[3];profile=finished;
   engravingState=engraving.step({reducedMotion:true});
   return snapshot();
  }
  if(phaseIndex===4||!powered||!Number.isFinite(rpm)||rpm<=0||!Number.isFinite(dt)||dt<=0)return snapshot();
  let remaining=Math.min(dt,.1);
  const rate=Math.min(rpm/18,2.5);
  // 边界保留本帧余量；不同帧率走过相同工时应得到相同器形和印记。
  while(remaining>0&&phaseIndex<3){
   const duration=CRAFT_DURATIONS[phaseIndex],used=Math.min(remaining,Math.max(0,duration-phaseElapsed)/rate);
   phaseElapsed=Math.min(duration,phaseElapsed+used*rate);remaining-=used;
   if(phaseElapsed>=duration-1e-12){
    phaseIndex++;phaseElapsed=0;
    if(phaseIndex===3){engraveElapsed=0;engravingState=engraving.reset(lastAngle);}
   }
  }
  if(phaseIndex===3&&remaining>0){
   engravingState=engraving.step({dt:remaining,rpm,powered:true});
   advanceEngravingClock(remaining,rate);laserActive=engravingState.active;
   if(engravingState.phase==='complete'){phaseIndex=4;phaseElapsed=0;engraveElapsed=CRAFT_DURATIONS[3];laserActive=false;}
  }
  updateProfile();return snapshot();
 }

 return Object.freeze({reset,step,snapshot});
}
