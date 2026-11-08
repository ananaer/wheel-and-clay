import {GLAZES,FINISHES} from './glazes.js';
import {getCompanion} from './companions.js';
import {cleanKilnRecord} from './kiln-art.js';

// 分享链接可携带待核验的回合记录，不携带本机ID、图片、成绩、账号或链上所有权证明。
// 二进制白名单避免自由文本/HTML，固定长度在解码前限制输入。
export const PIECE_SITE='https://wheel-and-clay.shop/';
const PIECE_FORMS=['vase','column','bowl'],PIECE_COMPANIONS=[null,'8889','8890','8891'];
const PIECE_COUNT=129,PIECE_BYTES=270,PIECE_PAYLOAD_LENGTH=360;
export function cleanPieceRecord(record){
 if(!record||!Array.isArray(record.profile)||record.profile.length!==PIECE_COUNT||!record.profile.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=.24&&v<=1.23))return null;
 if(!PIECE_FORMS.includes(record.form)||!GLAZES.some(g=>g.id===record.glaze)||!FINISHES.some(s=>s.id===(record.surface??'glossy')))return null;
 const finish=record.finish??.72;if(typeof finish!=='number'||!Number.isFinite(finish)||finish<0||finish>1)return null;
 const hadSim=record.hadSim===true||record.order?.hadSim===true?true:record.hadSim===false?false:null;
 const kiln=record.kiln==null?null:cleanKilnRecord(record.kiln);if(record.kiln!=null&&!kiln)return null;
 return {profile:record.profile.map(v=>Math.round(v*10000)/10000),form:record.form,glaze:record.glaze,surface:record.surface??'glossy',finish:Math.round(finish*1000)/1000,hadSim,companionId:getCompanion(record.companionId)?.id||null,...(kiln?{kiln}:{})};
}
export function encodePiece(record){
 const p=cleanPieceRecord(record);if(!p)return null;
 const bytes=new Uint8Array(p.kiln?312:PIECE_BYTES),view=new DataView(bytes.buffer);
 bytes.set([87,67,p.kiln?2:1,PIECE_FORMS.indexOf(p.form),GLAZES.findIndex(g=>g.id===p.glaze),FINISHES.findIndex(s=>s.id===p.surface),p.hadSim===true?1:p.hadSim===false?2:0,PIECE_COMPANIONS.indexOf(p.companionId)]);
 view.setUint16(8,Math.round(p.finish*1000)); // 10–11 保留为零，未知扩展拒绝。
 p.profile.forEach((v,i)=>view.setUint16(12+i*2,Math.round(v*10000)));
 if(p.kiln){view.setBigUint64(270,BigInt(p.kiln.round));view.setUint16(278,Number(p.kiln.work));bytes.set(Uint8Array.from(p.kiln.dataHash.slice(2).match(/../g),v=>parseInt(v,16)),280);}
 return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_');
}
export function decodePiece(payload){
 if(typeof payload!=='string'||![PIECE_PAYLOAD_LENGTH,416].includes(payload.length)||!/^[A-Za-z0-9_-]+$/.test(payload))return null;
 try{
  const raw=atob(payload.replace(/-/g,'+').replace(/_/g,'/'));
  if(![PIECE_BYTES,312].includes(raw.length))return null;
  const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0)),view=new DataView(bytes.buffer);
  if(bytes[0]!==87||bytes[1]!==67||bytes[2]!== (raw.length===312?2:1)||bytes[3]>=PIECE_FORMS.length||bytes[4]>=GLAZES.length||bytes[5]>=FINISHES.length||bytes[6]>2||bytes[7]>=PIECE_COMPANIONS.length||bytes[10]!==0||bytes[11]!==0)return null;
  const kiln=bytes[2]===2?{version:1,chainId:'11155111',core:'0xfd6c166d4b8e2962e65746a13e5a0797cd4de0c4',round:view.getBigUint64(270).toString(),work:view.getUint16(278).toString(),dataHash:'0x'+Array.from(bytes.slice(280),v=>v.toString(16).padStart(2,'0')).join('')}:null;
  return cleanPieceRecord({profile:Array.from({length:PIECE_COUNT},(_,i)=>view.getUint16(12+i*2)/10000),form:PIECE_FORMS[bytes[3]],glaze:GLAZES[bytes[4]].id,surface:FINISHES[bytes[5]].id,finish:view.getUint16(8)/1000,hadSim:bytes[6]===1?true:bytes[6]===2?false:null,companionId:PIECE_COMPANIONS[bytes[7]],...(kiln?{kiln}:{})});
 }catch{return null;}
}
export function readPieceHash(hash){return typeof hash==='string'&&hash.startsWith('#piece=')?decodePiece(hash.slice(7)):null;}
export function buildPieceUrl(record,lang='en'){
 const payload=encodePiece(record);if(!payload)return PIECE_SITE;
 return PIECE_SITE+'?lang='+(lang==='zh'?'zh':'en')+'#piece='+payload;
}
const PIECE_EXPLORER='https://eth-sepolia.blockscout.com';
const publicAddress=value=>typeof value==='string'&&/^0x[0-9a-fA-F]{40}$/.test(value)&&!/^0x0{40}$/.test(value)?value.toLowerCase():null;
function tokenNumber(value){return typeof value==='string'&&/^[1-9][0-9]{0,77}$/.test(value)&&BigInt(value)<(1n<<256n)?value:null;}
// 显式选项是读链调用方的信任边界；分享载荷或 localStorage 的 nft 字段不具有验证能力。
// 此模块不请求链上数据，也不 import nft-client，避免读取器与设计 codec 循环依赖。
export function cleanVerifiedPieceNft(record,{verifiedNft=false}={}){
 if(verifiedNft!==true||!cleanPieceRecord(record)?.kiln)return null;
 const nft=record.nft,contract=publicAddress(nft?.contract),maker=publicAddress(record.maker),owner=publicAddress(nft?.owner),tokenId=tokenNumber(nft?.tokenId);
 return nft?.chainId==='11155111'&&contract&&maker&&owner&&tokenId?Object.freeze({chainId:'11155111',contract,maker,owner,tokenId}):null;
}
export function buildPieceShareUrl(record,lang='en',options={}){
 const nft=cleanVerifiedPieceNft(record,options);
 return nft?PIECE_SITE+'?lang='+(lang==='zh'?'zh':'en')+'&nft='+nft.tokenId:buildPieceUrl(record,lang);
}
// 合约只接收旧版270字节器形，链上回合必须由合约自己读取。
export function encodePieceDesign(record){const p=encodePiece({...record,kiln:null});if(!p)return null;return '0x'+Array.from(atob(p.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0).toString(16).padStart(2,'0')).join('');}
export function decodePieceDesign(hex){if(typeof hex!=='string'||!/^0x[0-9a-fA-F]{540}$/.test(hex))return null;return decodePiece(btoa(String.fromCharCode(...Uint8Array.from(hex.slice(2).match(/../g),v=>parseInt(v,16)))).replace(/\+/g,'-').replace(/\//g,'_'));}

const pieceWords={
 kicker:['来自 Squeekchain 工坊','FROM THE SQUEEKCHAIN WORKSHOP'],title:['一圈一圈。\n独此一件。','Little steps.\nOne of a kind.'],
 subtitle:['有人与 Squeektoshi 一起，留下了这件陶器。','Someone made this with Squeektoshi. Now it’s your turn.'],
 sim:['模拟共创','MADE IN SIMULATION'],live:['创作者标记：实时模式','MAKER LABEL · LIVE MODE'],unknown:['来源未记录','SOURCE NOT RECORDED'],
 finish:['釉面','FINISH'],muse:['配色灵感','PALETTE MUSE'],explore:['拖动旋转 · 方向键也可查看','Drag to explore · arrow keys work too'],
 canvas:['分享的三维陶器，只读。拖动或使用方向键旋转查看。','Shared pottery, read-only. Drag or use arrow keys to orbit.'],
 make:['开始我的创作 ↗','MAKE YOURS ↗'],reset:['复位视角','Reset view'],loading:['正在展出这件作品…','Unwrapping this piece…'],
 badTitle:['链接不完整。','This link is incomplete.'],badBody:['这件作品暂时无法打开。可以请创作者重新复制作品链接。','Ask its maker to copy the piece link again.'],
 graphicTitle:['需要图形加速。','A little graphics power, please.'],graphicBody:['请在支持 WebGL 的浏览器中打开，或开启硬件加速后重试。','Open this in a WebGL-compatible browser with graphics acceleration enabled.'],
 loadingTitle:['正在读取作品。','Reading this piece.'],loadingBody:['正在核对 Sepolia 上的作品与归属。','Checking the piece and its ownership on Sepolia.'],
 networkTitle:['作品暂时无法读取。','This piece is unavailable.'],networkBody:['链上数据尚未确认。请稍后重新打开链接。','The on-chain data could not be confirmed. Open this link again in a moment.'],
 kiln:['回合窑烧','ROUND-BASED KILN'],round:['回合','Round'],work:['工作量','Work'],verified:['Sepolia · 来源已核验','Sepolia · source verified'],unverified:['Sepolia · 分享记录，来源待核验','Sepolia · shared record, source unverified'],
 source:['查看来源合约 ↗','View source contract ↗'],maker:['创作者','Maker'],owner:['当前持有者','Current owner'],token:['查看链上 NFT ↗','View on-chain NFT ↗']
};
export function createPieceView({root,lang=()=> 'en',createStudio,onMakeYours}={}){
 if(!root)throw new TypeError('Shared piece view needs a root');
 const doc=root.ownerDocument,label=key=>pieceWords[key][lang()==='zh'?0:1];
 let record=null,nft=null,kilnVerified=false,scene=null,shown=false,loading=false,failed=false,loadError=false,drag=null,pendingInit=false,disposed=false;
 const intro=doc.createElement('div');intro.className='piece-intro';
 const kicker=doc.createElement('p'),title=doc.createElement('h1'),description=doc.createElement('p'),badge=doc.createElement('span'),details=doc.createElement('div'),make=doc.createElement('button');
 kicker.className='piece-kicker';title.id='shared-piece-title';title.tabIndex=-1;description.className='piece-description';badge.className='piece-source';details.className='piece-material';make.type='button';make.className='piece-make';make.id='shared-make-yours';
 intro.append(kicker,title,description,badge,details,make);
 const materials=doc.createElement('p'),provenance=doc.createElement('div'),kilnTitle=doc.createElement('p'),kilnState=doc.createElement('p'),sourceLink=doc.createElement('a'),ownership=doc.createElement('dl'),tokenLink=doc.createElement('a');
 materials.className='piece-material-line';provenance.className='piece-provenance';kilnTitle.className='piece-kiln-title';kilnState.className='piece-kiln-state';ownership.className='piece-ownership';
 const makerTerm=doc.createElement('dt'),makerLink=doc.createElement('a'),makerValue=doc.createElement('dd'),ownerTerm=doc.createElement('dt'),ownerLink=doc.createElement('a'),ownerValue=doc.createElement('dd');
 makerValue.append(makerLink);ownerValue.append(ownerLink);ownership.append(makerTerm,makerValue,ownerTerm,ownerValue);
 for(const link of [sourceLink,makerLink,ownerLink,tokenLink]){link.target='_blank';link.rel='noopener noreferrer';}
 provenance.append(kilnTitle,kilnState,sourceLink,ownership,tokenLink);details.append(materials,provenance);
 const stage=doc.createElement('div');stage.className='piece-stage';const canvas=doc.createElement('canvas');canvas.id='shared-piece-canvas';canvas.tabIndex=0;canvas.setAttribute('role','img');
 const status=doc.createElement('p');status.className='piece-view-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const bottom=doc.createElement('div');bottom.className='piece-view-controls';const hint=doc.createElement('span'),reset=doc.createElement('button');reset.type='button';reset.id='shared-reset-view';bottom.append(hint,reset);stage.append(canvas,status,bottom);root.append(intro,stage);
 root.setAttribute('aria-labelledby',title.id);
 function render(){
  const waiting=loading&&!record;
  kicker.textContent=nft?'SEPOLIA · NFT #'+nft.tokenId:label('kicker');title.textContent=label(waiting?'loadingTitle':loadError?'networkTitle':!record?'badTitle':failed?'graphicTitle':'title');description.textContent=label(waiting?'loadingBody':loadError?'networkBody':!record?'badBody':failed?'graphicBody':'subtitle');make.textContent=label('make');badge.textContent=label(record?.hadSim===true?'sim':record?.hadSim===false?'live':'unknown');badge.hidden=!record;
  const choice=record&&GLAZES.find(g=>g.id===record.glaze),finish=record&&FINISHES.find(s=>s.id===record.surface),idx=lang()==='zh'?0:1;
  materials.textContent=record?[choice.name[idx],finish.name[idx],record.companionId?label('muse')+' · Squeek #'+record.companionId:''].filter(Boolean).join('  /  '):'';
  const kiln=record?.kiln;details.hidden=!record;provenance.hidden=!kiln;
  kilnTitle.textContent=kiln?label('kiln')+' · '+label('round')+' '+kiln.round+' / '+label('work')+' '+kiln.work:'';kilnState.textContent=kiln?label(kilnVerified?'verified':'unverified'):'';
  sourceLink.textContent=label('source');if(kiln)sourceLink.href=PIECE_EXPLORER+'/address/'+kiln.core+'?tab=read_contract';else sourceLink.removeAttribute('href');
  ownership.hidden=tokenLink.hidden=!nft;makerTerm.textContent=label('maker');ownerTerm.textContent=label('owner');tokenLink.textContent=label('token');
  for(const [link,address] of [[makerLink,nft?.maker],[ownerLink,nft?.owner]]){link.textContent=address?address.slice(0,6)+'…'+address.slice(-4):'';if(address){link.href=PIECE_EXPLORER+'/address/'+address;link.title=address;link.setAttribute('aria-label',address);}else{link.removeAttribute('href');link.removeAttribute('title');link.removeAttribute('aria-label');}}
  if(nft)tokenLink.href=PIECE_EXPLORER+'/token/'+nft.contract+'/instance/'+nft.tokenId;else tokenLink.removeAttribute('href');
  canvas.setAttribute('aria-label',label('canvas'));canvas.hidden=!record||failed;hint.textContent=label('explore');reset.textContent=label('reset');bottom.hidden=!record||failed;status.textContent=loading?label('loading'):'';status.hidden=!loading;
  root.dataset.pieceState=loading?'loading':loadError?'error':!record?'invalid':failed?'unavailable':'ready';root.dataset.pieceNft=nft?nft.tokenId:'';root.dataset.kilnVerified=String(!!kiln&&kilnVerified);
 }
 function show(hash){
  return showRecord(readPieceHash(hash));
 }
 function showRecord(next,options={}){
  if(disposed)return false;record=cleanPieceRecord(next);nft=record?cleanVerifiedPieceNft(next,options):null;kilnVerified=!!record?.kiln&&(!!nft||options.verifiedKiln===true);failed=loadError=false;loading=!!record;drag=null;scene?.setVisible(false);render();if(record)queueRender();return !!record;
 }
 function showLoading(){if(disposed)return;record=nft=null;kilnVerified=failed=loadError=false;loading=true;drag=null;scene?.setVisible(false);render();}
 function showError(){if(disposed)return;record=nft=null;kilnVerified=failed=loading=false;loadError=true;drag=null;scene?.setVisible(false);render();}
 function queueRender(){
  if(disposed||pendingInit)return;pendingInit=true;
  requestAnimationFrame(()=>{
   pendingInit=false;if(disposed||!shown||!record)return;
   try{
    if(!scene)scene=createStudio(canvas,{presentationOnly:true,animatedPreview:true,heroLighting:true,heroPlatform:true,background:'#101114',sealUrl:'./brand-research/official/squeekchain-hamster-mark.svg'});
    scene.setProfile(record.profile,record.form);scene.setPhase('glaze');scene.setGlaze(record.glaze);scene.setSurface(record.surface);scene.setFinish(record.finish);scene.setKiln?.(record.kiln||null);scene.setKilnReveal?.(1);scene.setPresentationRotation(.0);scene.setRpm(0);scene.resetView();scene.setVisible(shown&&!doc.hidden);loading=false;render();
   }catch{scene?.dispose();scene=null;failed=true;loading=false;render();}
  });
 }
 function setVisible(value){if(disposed)return;shown=!!value;scene?.setVisible(shown&&!doc.hidden&&!loading&&!failed&&!loadError&&!!record);if(!shown)drag=null;else if(record&&loading)queueRender();}
 function down(event){if(!scene||event.button!==0||event.isPrimary===false)return;event.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(event.pointerId);drag={id:event.pointerId,x:event.clientX,y:event.clientY};}
 function move(event){if(!drag||drag.id!==event.pointerId)return;scene.orbitView(-(event.clientX-drag.x)*.006,(event.clientY-drag.y)*.004);drag.x=event.clientX;drag.y=event.clientY;}
 function up(event){if(!drag||drag.id!==event.pointerId)return;if(canvas.hasPointerCapture(drag.id))canvas.releasePointerCapture(drag.id);drag=null;}
 function key(event){if(!scene||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();scene.orbitView(event.key==='ArrowLeft'?-.09:event.key==='ArrowRight'?.09:0,event.key==='ArrowUp'?.05:event.key==='ArrowDown'?-.05:0);}
 canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('lostpointercapture',()=>{drag=null;});canvas.addEventListener('keydown',key);reset.addEventListener('click',()=>scene?.resetView());make.addEventListener('click',()=>onMakeYours?.());
 render();return {show,showRecord,showLoading,showError,render,setVisible,dispose(){disposed=true;shown=false;record=nft=null;scene?.dispose();scene=null;}};
}
