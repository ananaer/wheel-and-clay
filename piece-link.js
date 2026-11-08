import {GLAZES,FINISHES} from './glazes.js';
import {getCompanion} from './companions.js';

// 链接只携带器形与工艺，不携带本机ID、图片、成绩、账号或硬件证明。
// 二进制白名单避免自由文本/HTML，固定长度在解码前限制输入。
export const PIECE_SITE='https://wheel-and-clay.shop/';
const PIECE_FORMS=['vase','column','bowl'],PIECE_COMPANIONS=[null,'8889','8890','8891'];
const PIECE_COUNT=129,PIECE_BYTES=270,PIECE_PAYLOAD_LENGTH=360;
export function cleanPieceRecord(record){
 if(!record||!Array.isArray(record.profile)||record.profile.length!==PIECE_COUNT||!record.profile.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=.24&&v<=1.23))return null;
 if(!PIECE_FORMS.includes(record.form)||!GLAZES.some(g=>g.id===record.glaze)||!FINISHES.some(s=>s.id===(record.surface??'glossy')))return null;
 const finish=record.finish??.72;if(typeof finish!=='number'||!Number.isFinite(finish)||finish<0||finish>1)return null;
 const hadSim=record.hadSim===true||record.order?.hadSim===true?true:record.hadSim===false?false:null;
 return {profile:record.profile.map(v=>Math.round(v*10000)/10000),form:record.form,glaze:record.glaze,surface:record.surface??'glossy',finish:Math.round(finish*1000)/1000,hadSim,companionId:getCompanion(record.companionId)?.id||null};
}
export function encodePiece(record){
 const p=cleanPieceRecord(record);if(!p)return null;
 const bytes=new Uint8Array(PIECE_BYTES),view=new DataView(bytes.buffer);
 bytes.set([87,67,1,PIECE_FORMS.indexOf(p.form),GLAZES.findIndex(g=>g.id===p.glaze),FINISHES.findIndex(s=>s.id===p.surface),p.hadSim===true?1:p.hadSim===false?2:0,PIECE_COMPANIONS.indexOf(p.companionId)]);
 view.setUint16(8,Math.round(p.finish*1000)); // 10–11 保留为零，未知扩展拒绝。
 p.profile.forEach((v,i)=>view.setUint16(12+i*2,Math.round(v*10000)));
 return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_');
}
export function decodePiece(payload){
 if(typeof payload!=='string'||payload.length!==PIECE_PAYLOAD_LENGTH||!/^[A-Za-z0-9_-]+$/.test(payload))return null;
 try{
  const raw=atob(payload.replace(/-/g,'+').replace(/_/g,'/'));
  if(raw.length!==PIECE_BYTES)return null;
  const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0)),view=new DataView(bytes.buffer);
  if(bytes[0]!==87||bytes[1]!==67||bytes[2]!==1||bytes[3]>=PIECE_FORMS.length||bytes[4]>=GLAZES.length||bytes[5]>=FINISHES.length||bytes[6]>2||bytes[7]>=PIECE_COMPANIONS.length||bytes[10]!==0||bytes[11]!==0)return null;
  return cleanPieceRecord({profile:Array.from({length:PIECE_COUNT},(_,i)=>view.getUint16(12+i*2)/10000),form:PIECE_FORMS[bytes[3]],glaze:GLAZES[bytes[4]].id,surface:FINISHES[bytes[5]].id,finish:view.getUint16(8)/1000,hadSim:bytes[6]===1?true:bytes[6]===2?false:null,companionId:PIECE_COMPANIONS[bytes[7]]});
 }catch{return null;}
}
export function readPieceHash(hash){return typeof hash==='string'&&hash.startsWith('#piece=')?decodePiece(hash.slice(7)):null;}
export function buildPieceUrl(record,lang='en'){
 const payload=encodePiece(record);if(!payload)return PIECE_SITE;
 return PIECE_SITE+'?lang='+(lang==='zh'?'zh':'en')+'#piece='+payload;
}

const pieceWords={
 kicker:['来自 Squeekchain 工坊','FROM THE SQUEEKCHAIN WORKSHOP'],title:['一圈一圈。\n独此一件。','Little steps.\nOne of a kind.'],
 subtitle:['有人与 Squeektoshi 一起，留下了这件陶器。','Someone made this with Squeektoshi. Now it’s your turn.'],
 sim:['模拟共创','MADE IN SIMULATION'],live:['创作者标记：实时模式','MAKER LABEL · LIVE MODE'],unknown:['来源未记录','SOURCE NOT RECORDED'],
 finish:['釉面','FINISH'],muse:['配色灵感','PALETTE MUSE'],explore:['拖动旋转 · 方向键也可查看','Drag to explore · arrow keys work too'],
 canvas:['分享的三维陶器，只读。拖动或使用方向键旋转查看。','Shared pottery, read-only. Drag or use arrow keys to orbit.'],
 make:['开始我的创作 ↗','MAKE YOURS ↗'],reset:['复位视角','Reset view'],loading:['正在展出这件作品…','Unwrapping this piece…'],
 badTitle:['链接不完整。','This link is incomplete.'],badBody:['这件作品暂时无法打开。可以请创作者重新复制作品链接。','Ask its maker to copy the piece link again.'],
 graphicTitle:['需要图形加速。','A little graphics power, please.'],graphicBody:['请在支持 WebGL 的浏览器中打开，或开启硬件加速后重试。','Open this in a WebGL-compatible browser with graphics acceleration enabled.']
};
export function createPieceView({root,lang=()=> 'en',createStudio,onMakeYours}={}){
 if(!root)throw new TypeError('Shared piece view needs a root');
 const doc=root.ownerDocument,label=key=>pieceWords[key][lang()==='zh'?0:1];
 let record=null,scene=null,shown=false,loading=false,failed=false,drag=null,renderRevision=0,pendingInit=false,disposed=false;
 const intro=doc.createElement('div');intro.className='piece-intro';
 const kicker=doc.createElement('p'),title=doc.createElement('h1'),description=doc.createElement('p'),badge=doc.createElement('span'),details=doc.createElement('p'),make=doc.createElement('button');
 kicker.className='piece-kicker';title.id='shared-piece-title';title.tabIndex=-1;description.className='piece-description';badge.className='piece-source';details.className='piece-material';make.type='button';make.className='piece-make';make.id='shared-make-yours';
 intro.append(kicker,title,description,badge,details,make);
 const stage=doc.createElement('div');stage.className='piece-stage';const canvas=doc.createElement('canvas');canvas.id='shared-piece-canvas';canvas.tabIndex=0;canvas.setAttribute('role','img');
 const status=doc.createElement('p');status.className='piece-view-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const bottom=doc.createElement('div');bottom.className='piece-view-controls';const hint=doc.createElement('span'),reset=doc.createElement('button');reset.type='button';reset.id='shared-reset-view';bottom.append(hint,reset);stage.append(canvas,status,bottom);root.append(intro,stage);
 root.setAttribute('aria-labelledby',title.id);
 function render(){
  kicker.textContent=label('kicker');title.textContent=label(!record?'badTitle':failed?'graphicTitle':'title');description.textContent=label(!record?'badBody':failed?'graphicBody':'subtitle');make.textContent=label('make');badge.textContent=label(record?.hadSim===true?'sim':record?.hadSim===false?'live':'unknown');badge.hidden=!record;
  const choice=record&&GLAZES.find(g=>g.id===record.glaze),finish=record&&FINISHES.find(s=>s.id===record.surface),idx=lang()==='zh'?0:1;
  details.textContent=record?[choice.name[idx],finish.name[idx],record.companionId?label('muse')+' · Squeek #'+record.companionId:''].filter(Boolean).join('  /  '):'';
  canvas.setAttribute('aria-label',label('canvas'));canvas.hidden=!record||failed;hint.textContent=label('explore');reset.textContent=label('reset');bottom.hidden=!record||failed;status.textContent=loading?label('loading'):'';status.hidden=!loading;
  root.dataset.pieceState=!record?'invalid':failed?'unavailable':loading?'loading':'ready';
 }
 function show(hash){
  if(disposed)return;renderRevision++;record=readPieceHash(hash);failed=false;loading=!!record;scene?.setVisible(false);render();
  if(record)queueRender();
 }
 function queueRender(){
  if(disposed||pendingInit)return;pendingInit=true;
  requestAnimationFrame(()=>{
   pendingInit=false;if(disposed||!shown||!record)return;
   try{
    if(!scene)scene=createStudio(canvas,{presentationOnly:true,animatedPreview:true,heroLighting:true,heroPlatform:true,background:'#101114',sealUrl:'./brand-research/official/squeekchain-hamster-mark.svg'});
    scene.setProfile(record.profile,record.form);scene.setPhase('glaze');scene.setGlaze(record.glaze);scene.setSurface(record.surface);scene.setFinish(record.finish);scene.setPresentationRotation(.0);scene.setRpm(0);scene.resetView();scene.setVisible(shown&&!doc.hidden);loading=false;render();
   }catch{scene?.dispose();scene=null;failed=true;loading=false;render();}
  });
 }
 function setVisible(value){if(disposed)return;shown=!!value;scene?.setVisible(shown&&!doc.hidden&&!loading);if(!shown)drag=null;else if(record&&loading)queueRender();}
 function down(event){if(!scene||event.button!==0||event.isPrimary===false)return;event.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(event.pointerId);drag={id:event.pointerId,x:event.clientX,y:event.clientY};}
 function move(event){if(!drag||drag.id!==event.pointerId)return;scene.orbitView(-(event.clientX-drag.x)*.006,(event.clientY-drag.y)*.004);drag.x=event.clientX;drag.y=event.clientY;}
 function up(event){if(!drag||drag.id!==event.pointerId)return;if(canvas.hasPointerCapture(drag.id))canvas.releasePointerCapture(drag.id);drag=null;}
 function key(event){if(!scene||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();scene.orbitView(event.key==='ArrowLeft'?-.09:event.key==='ArrowRight'?.09:0,event.key==='ArrowUp'?.05:event.key==='ArrowDown'?-.05:0);}
 canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('lostpointercapture',()=>{drag=null;});canvas.addEventListener('keydown',key);reset.addEventListener('click',()=>scene?.resetView());make.addEventListener('click',()=>onMakeYours?.());
 render();return {show,render,setVisible,dispose(){disposed=true;shown=false;record=null;renderRevision++;scene?.dispose();scene=null;}};
}
