import {buildPieceUrl,cleanPieceRecord} from './piece-link.js';
import {getCompanion} from './companions.js';
/* 分享只交给用户确认：不上传图片，不调用 X 发帖接口，也不读取当前位置或账号。 */
export const SHARE_URL='https://wheel-and-clay.blackhaven-phase1-dashboard.workers.dev/';
const shareWords={
 title:['分享这件作品','Share your piece'],
 download:['下载作品卡','Download card'],x:['打开 X ↗','Open X ↗'],xCopied:['打开 X 并粘贴 ↗','Open X & paste ↗'],native:['带图分享…','Share with image…'],copy:['复制作品图','Copy image'],copying:['正在复制…','Copying…'],
 instruction:['复制作品图，打开 X 后粘贴。文案和试玩链接已备好。','Copy the image, then paste it on X. Your caption and play link are ready.'],
 downloadInstruction:['下载作品卡，在 X 附上图片。文案和试玩链接已备好。','Download the card and attach it on X. Your caption and play link are ready.'],
 downloaded:['图片下载已开始；到 X 附上这张作品卡。','Image download started. Attach the card to your post on X.'],
 xReady:['文案和链接已打开；请粘贴或附上作品图，再确认发布。','Your caption and link are ready. Paste or attach the image, then confirm your post.'],
 copied:['图片已复制。在 X 编辑框粘贴，再确认发布。','Image copied. Paste it into the X composer, then confirm your post.'],
 copyFailed:['未能复制图片；可下载作品卡，再到 X 附图。','Could not copy the image. Download the card and attach it on X.'],
 nativeHint:['把作品图交给系统分享，再选择接收应用。','Share the image through your device and choose an app.'],
 sharing:['正在打开分享…','Opening share…'],shared:['已交给系统分享，请在所选应用中确认。','Handed to your device. Confirm in the app you choose.'],
 unavailable:['图片暂不可用，请重新打开这件作品。','The card is unavailable. Please open this piece again.'],
 failed:['系统分享暂不可用；仍可下载作品卡并打开 X。','Device sharing is unavailable. You can still download the card and open X.'],
 caption:['分享文案','Share caption'],
 link:['复制作品链接 ↗','Copy piece link ↗'],linkCopied:['作品链接已复制','Piece link copied'],linkHint:['打开链接，即可旋转查看这件陶器。','Open the link to explore this piece in 3D.'],linkFallback:['请选中下方链接并复制。','Select and copy the link below.'],linkLabel:['作品链接','Piece link']
};
const shareLang=lang=>lang==='en'?'en':'zh';

// 不接收自由输入或当前 URL；SIM 痕迹不能被后续切换实时模式抹掉。
export function buildShareCopy(record={},lang='zh'){
 const en=shareLang(lang)==='en',sim=record?.hadSim===true||record?.order?.hadSim===true;
 const source=sim?(en?'Made in simulation.':'模拟练习作品。'):record?.hadSim===false?(en?'Made in live mode.':'实时模式作品。'):(en?'Wheel source not recorded.':'轮速来源未记录。');
 const order=record?.order,score=typeof order?.score==='number'&&Number.isFinite(order.score)&&order.score>=0&&order.score<=100?Math.round(order.score):null;
 const mode=order?.play==='repair'?(en?'Rescue a Pot':'修坯委托'):order?.play==='study'?(en?'Open practice':'临摹练习'):order?.play==='turns'||(order&&!order.play)?(en?'Twenty turns':'20 圈订单'):order?.play==='burst'?(en?'One run only':'一跑定形'):null;
 const companion=getCompanion(record?.companionId);const muse=companion?(en?'Palette inspired by Squeek #'+companion.id+'.':'配色灵感来自 Squeek #'+companion.id+'。'):'';
 const result=mode&&score!==null?(en?`${mode} · ${score}% shape match.`:`${mode} · 轮廓吻合 ${score}%。`):'';
 return [en?'I made this in Wheel & Clay on Squeekchain. Squeektoshi sets the rhythm; I shape the clay.':'我在 Squeekchain 社区工坊「轮间」做了一件陶器。Squeektoshi 决定节奏，我来塑形。',muse,result,source,en?'Make yours ↓':'来做你的下一件 ↓'].filter(Boolean).join('\n');
}
export function buildXIntent(record={},lang='zh'){
 const url=new URL('https://x.com/intent/tweet');
 url.searchParams.set('text',buildShareCopy(record,lang));url.searchParams.set('url',buildPieceUrl(record,lang));
 return url.toString();
}
export function shareFileName(record={}){
 const score=record?.order?.score;
 return 'wheel-and-clay'+(typeof score==='number'&&Number.isFinite(score)&&score>=0&&score<=100?'-'+Math.round(score):'')+'.png';
}

/* 作品卡已由画布生成。同步解码本地 PNG，点击分享时保留浏览器用户激活。 */
export function pngBytes(dataUrl){
 if(typeof dataUrl!=='string'||dataUrl.length>28*1024*1024||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(dataUrl))throw new TypeError('A local PNG card is required');
 const binary=atob(dataUrl.slice(dataUrl.indexOf(',')+1)),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
 const signature=[137,80,78,71,13,10,26,10];
 if(bytes.length<32||signature.some((value,index)=>bytes[index]!==value))throw new TypeError('Invalid PNG card');
 return bytes;
}

/* 只写用户当前选中的本地 PNG；在点击的同步调用段内启动剪贴板写入。 */
export async function copyPngToClipboard(dataUrl,{clipboard=globalThis.navigator?.clipboard,ClipboardItemCtor=globalThis.ClipboardItem}={}){
 const bytes=pngBytes(dataUrl);
 if(typeof clipboard?.write!=='function'||typeof ClipboardItemCtor!=='function'||(typeof ClipboardItemCtor.supports==='function'&&!ClipboardItemCtor.supports('image/png')))throw new Error('PNG clipboard is unavailable');
 const item=new ClipboardItemCtor({'image/png':new Blob([bytes],{type:'image/png'})});
 await clipboard.write([item]);
}

export function createShareControls({root,lang=()=> 'zh',notify=()=>{}}={}){
 if(!root)throw new TypeError('Share controls need a root element');
 const label=key=>shareWords[key][shareLang(typeof lang==='function'?lang():lang)==='en'?1:0];
 const language=()=>shareLang(typeof lang==='function'?lang():lang);
 const doc=root.ownerDocument,view=doc.defaultView||globalThis,nav=view.navigator||navigator,dialog=root.closest('dialog');
 let piece=null,file=null,objectUrl=null,busy='',nativeSupported=false,copySupported=false,copied=false,status='',disposed=false,revision=0;
 const heading=doc.createElement('h3'),actions=doc.createElement('div'),download=doc.createElement('a'),x=doc.createElement('a'),native=doc.createElement('button'),copy=doc.createElement('button'),instruction=doc.createElement('p'),feedback=doc.createElement('p');
 heading.className='share-title';actions.className='share-actions';download.className='share-download';x.className='share-x';native.className='share-native';copy.className='share-copy';instruction.className='share-instruction';feedback.className='share-feedback';
 const link=doc.createElement('button'),linkRow=doc.createElement('div'),linkHint=doc.createElement('p'),fallback=doc.createElement('input');link.type='button';link.className='share-piece-link';linkRow.className='share-link-row';linkHint.className='share-link-hint';fallback.className='share-link-fallback';fallback.type='text';fallback.readOnly=true;fallback.hidden=true;linkRow.append(link,linkHint,fallback);
 x.target='_blank';x.rel='noopener noreferrer';native.type=copy.type='button';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
 root.classList.add('share-tools');root.replaceChildren(heading,linkRow,actions,instruction,feedback);actions.append(native,copy,x,download);
 function updateStatus(key,announce=false){status=key;render();if(announce)notify(label(key));}
 function release(){if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=null;file=null;nativeSupported=copySupported=false;}
 function render(){
  if(disposed)return;
  heading.textContent=label('title');link.textContent=label(busy==='link'?'copying':status==='linkCopied'?'linkCopied':'link');linkHint.textContent=label('linkHint');fallback.setAttribute('aria-label',label('linkLabel'));link.disabled=!piece?.link;link.setAttribute('aria-busy',String(busy==='link'));linkRow.hidden=!piece?.link;download.textContent=label('download');x.textContent=label(copied?'xCopied':'x');native.textContent=label(busy==='native'?'sharing':'native');copy.textContent=label(busy==='copy'?'copying':'copy');
  instruction.textContent=label(nativeSupported?'nativeHint':copySupported?'instruction':'downloadInstruction');feedback.textContent=status?label(status):'';feedback.hidden=!status;
  root.dataset.shareReady=String(!!file);root.dataset.nativeShare=String(nativeSupported);root.dataset.copyShare=String(copySupported);root.dataset.copied=String(copied);root.dataset.shareStatus=status;root.setAttribute('aria-label',label('title'));root.setAttribute('aria-busy',String(!!busy));
  for(const link of [download,x]){link.setAttribute('aria-disabled',String(!file||busy));link.tabIndex=file&&!busy?0:-1;}
  native.hidden=!nativeSupported;native.disabled=!!busy||!file;copy.hidden=!copySupported;copy.disabled=!!busy||!file;
  if(file){download.href=objectUrl;download.download=file.name;x.href=buildXIntent(piece.record,language());fallback.value=piece.link?buildPieceUrl(piece.record,language()):'';}
  else{download.removeAttribute('href');x.removeAttribute('href');download.removeAttribute('download');}
 }
 function setPiece(next){
  revision++;release();piece=null;status='';busy='';copied=false;fallback.hidden=true;
  try{
   if(!next?.record)throw new TypeError('Missing piece');
   const geometry=cleanPieceRecord(next.record);
   const record={...geometry,companionId:getCompanion(next.record.companionId)?.id||null,hadSim:next.record.hadSim,order:next.record.order?{hadSim:next.record.order.hadSim,play:next.record.order.play,score:next.record.order.score}:null};
   file=new File([pngBytes(next.dataUrl)],shareFileName(record),{type:'image/png'});objectUrl=URL.createObjectURL(file);piece={record,dataUrl:next.dataUrl,link:!!geometry};
   try{nativeSupported=typeof nav.share==='function'&&typeof nav.canShare==='function'&&nav.canShare({files:[file]});}catch{nativeSupported=false;}
   try{copySupported=typeof nav.clipboard?.write==='function'&&typeof view.ClipboardItem==='function'&&(typeof view.ClipboardItem.supports!=='function'||view.ClipboardItem.supports('image/png'));}catch{copySupported=false;}
  }catch{release();status='unavailable';}
  render();return !!file;
 }
 function downloadClick(event){if(!file||busy){event.preventDefault();return;}updateStatus('downloaded');}
 function xClick(event){if(!file||busy){event.preventDefault();return;}updateStatus(copied?'copied':'xReady');}
 async function copyClick(){
  if(!file||busy||!copySupported)return;
  const current=revision;busy='copy';status='';render();
  try{await copyPngToClipboard(piece.dataUrl,{clipboard:nav.clipboard,ClipboardItemCtor:view.ClipboardItem});if(!disposed&&current===revision){copied=true;updateStatus('copied');}}
  catch{if(!disposed&&current===revision){copied=false;updateStatus('copyFailed');}}
  finally{if(current===revision){busy='';if(!disposed)render();}}
 }
 async function nativeClick(){
  if(!file||busy||!nativeSupported)return;
  const payload={files:[file],title:language()==='en'?'My Wheel & Clay piece':'我的轮间作品',text:buildShareCopy(piece.record,language()),url:buildPieceUrl(piece.record,language())};
  const current=revision;busy='native';status='';render();
  try{await nav.share(payload);if(!disposed&&current===revision)updateStatus('shared');}
  catch(error){if(!disposed&&current===revision&&error?.name!=='AbortError')updateStatus('failed');}
  finally{if(current===revision){busy='';if(!disposed)render();}}
 }
 async function linkClick(){
  if(!piece?.link||busy)return;const current=revision;busy='link';status='';render();
  try{if(typeof nav.clipboard?.writeText!=='function')throw new Error('Clipboard unavailable');await nav.clipboard.writeText(buildPieceUrl(piece.record,language()));if(!disposed&&current===revision){fallback.hidden=true;updateStatus('linkCopied');}}
  catch{if(!disposed&&current===revision){fallback.hidden=false;updateStatus('linkFallback');fallback.focus();fallback.select();}}
  finally{if(current===revision){busy='';if(!disposed)render();}}
 }
 // 关闭作品卡后，旧的权限/系统分享结果不能写回下一次打开的卡片。
 function invalidatePending(){revision++;busy='';status='';copied=false;render();}
 link.addEventListener('click',linkClick);download.addEventListener('click',downloadClick);x.addEventListener('click',xClick);native.addEventListener('click',nativeClick);copy.addEventListener('click',copyClick);dialog?.addEventListener('close',invalidatePending);
 render();
 return {setPiece,render,clear(){revision++;release();piece=null;status='';busy='';copied=false;render();},dispose(){disposed=true;revision++;release();link.removeEventListener('click',linkClick);download.removeEventListener('click',downloadClick);x.removeEventListener('click',xClick);native.removeEventListener('click',nativeClick);copy.removeEventListener('click',copyClick);dialog?.removeEventListener('close',invalidatePending);}};
}
