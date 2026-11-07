/* 分享只交给用户确认：不上传图片，不调用 X 发帖接口，也不读取当前位置或账号。 */
export const SHARE_URL='https://wheel-and-clay.blackhaven-phase1-dashboard.workers.dev/';
const shareWords={
 title:['分享这件作品','Share your piece'],
 download:['下载作品卡','Download card'],x:['分享到 X ↗','Share on X ↗'],native:['分享图片与链接…','Share image & link…'],
 instruction:['先下载作品卡，再到 X 附上图片。文案和试玩链接已准备好。','Download the card, then attach it on X. Your caption and play link are ready.'],
 downloaded:['图片下载已开始；到 X 附上这张作品卡。','Image download started. Attach the card to your post on X.'],
 xReady:['请在 X 附上下载的作品卡，再确认发布。','Attach your downloaded card on X, then confirm your post.'],
 nativeHint:['也可以用系统分享，把作品卡和试玩链接一起带走。','You can also share the card and play link together through your device.'],
 sharing:['正在打开分享…','Opening share…'],shared:['已交给系统分享，请在所选应用中确认。','Handed to your device. Confirm in the app you choose.'],
 unavailable:['图片暂不可用，请重新打开这件作品。','The card is unavailable. Please open this piece again.'],
 failed:['系统分享暂不可用；仍可下载作品卡并打开 X。','Device sharing is unavailable. You can still download the card and open X.'],
 caption:['分享文案','Share caption']
};
const shareLang=lang=>lang==='en'?'en':'zh';

// 不接收自由输入或当前 URL；SIM 痕迹不能被后续切换实时模式抹掉。
export function buildShareCopy(record={},lang='zh'){
 const en=shareLang(lang)==='en',sim=record?.hadSim===true||record?.order?.hadSim===true;
 const source=sim?(en?'Made in simulation.':'模拟练习作品。'):record?.hadSim===false?(en?'Made in live mode.':'实时模式作品。'):(en?'Wheel source not recorded.':'轮速来源未记录。');
 const order=record?.order,score=typeof order?.score==='number'&&Number.isFinite(order.score)&&order.score>=0&&order.score<=100?Math.round(order.score):null;
 const mode=order?.play==='repair'?(en?'Rescue a Pot':'修坯委托'):order?.play==='study'?(en?'Open practice':'临摹练习'):order?.play==='turns'||(order&&!order.play)?(en?'Twenty turns':'20 圈订单'):order?.play==='burst'?(en?'One run only':'一跑定形'):null;
 const result=mode&&score!==null?(en?`${mode} · ${score}% shape match.`:`${mode} · 轮廓吻合 ${score}%。`):'';
 return [en?'I made this in Wheel & Clay. A hamster sets the rhythm; I shape the clay.':'我在「轮间」做了一件陶器。仓鼠决定节奏，我来塑形。',result,source,en?'Make yours ↓':'来做你的下一件 ↓'].filter(Boolean).join('\n');
}
export function buildXIntent(record={},lang='zh'){
 const url=new URL('https://x.com/intent/tweet');
 url.searchParams.set('text',buildShareCopy(record,lang));url.searchParams.set('url',SHARE_URL);
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

export function createShareControls({root,lang=()=> 'zh',notify=()=>{}}={}){
 if(!root)throw new TypeError('Share controls need a root element');
 const label=key=>shareWords[key][shareLang(typeof lang==='function'?lang():lang)==='en'?1:0];
 const language=()=>shareLang(typeof lang==='function'?lang():lang);
 const doc=root.ownerDocument,nav=doc.defaultView?.navigator||navigator;
 let piece=null,file=null,objectUrl=null,busy=false,nativeSupported=false,status='',disposed=false,revision=0;
 const heading=doc.createElement('h3'),actions=doc.createElement('div'),download=doc.createElement('a'),x=doc.createElement('a'),native=doc.createElement('button'),instruction=doc.createElement('p'),feedback=doc.createElement('p');
 heading.className='share-title';actions.className='share-actions';download.className='share-download';x.className='share-x';native.className='share-native';instruction.className='share-instruction';feedback.className='share-feedback';
 x.target='_blank';x.rel='noopener noreferrer';native.type='button';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
 root.classList.add('share-tools');root.replaceChildren(heading,actions,instruction,feedback);actions.append(download,x,native);
 function updateStatus(key,announce=false){status=key;render();if(announce)notify(label(key));}
 function release(){if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=null;file=null;nativeSupported=false;}
 function render(){
  if(disposed)return;
  heading.textContent=label('title');download.textContent=label('download');x.textContent=label('x');native.textContent=label(busy?'sharing':'native');
  instruction.textContent=label('instruction');feedback.textContent=status?label(status):'';feedback.hidden=!status;
  root.dataset.shareReady=String(!!file);root.dataset.nativeShare=String(nativeSupported);root.setAttribute('aria-label',label('title'));
  for(const link of [download,x]){link.setAttribute('aria-disabled',String(!file||busy));link.tabIndex=file&&!busy?0:-1;}
  native.hidden=!nativeSupported;native.disabled=busy||!file;
  if(file){download.href=objectUrl;download.download=file.name;x.href=buildXIntent(piece.record,language());}
  else{download.removeAttribute('href');x.removeAttribute('href');download.removeAttribute('download');}
 }
 function setPiece(next){
  revision++;release();piece=null;status='';busy=false;
  try{
   if(!next?.record)throw new TypeError('Missing piece');
   const record={hadSim:next.record.hadSim,order:next.record.order?{hadSim:next.record.order.hadSim,play:next.record.order.play,score:next.record.order.score}:null};
   file=new File([pngBytes(next.dataUrl)],shareFileName(record),{type:'image/png'});objectUrl=URL.createObjectURL(file);piece={record};
   try{nativeSupported=typeof nav.share==='function'&&typeof nav.canShare==='function'&&nav.canShare({files:[file]});}catch{nativeSupported=false;}
  }catch{release();status='unavailable';}
  render();return !!file;
 }
 function downloadClick(event){if(!file||busy){event.preventDefault();return;}updateStatus('downloaded');}
 function xClick(event){if(!file||busy){event.preventDefault();return;}updateStatus('xReady');}
 async function nativeClick(){
  if(!file||busy||!nativeSupported)return;
  const payload={files:[file],title:language()==='en'?'My Wheel & Clay piece':'我的轮间作品',text:buildShareCopy(piece.record,language()),url:SHARE_URL};
  const current=revision;busy=true;status='';render();
  try{await nav.share(payload);if(!disposed&&current===revision)updateStatus('shared');}
  catch(error){if(!disposed&&current===revision&&error?.name!=='AbortError')updateStatus('failed');}
  finally{if(current===revision){busy=false;if(!disposed)render();}}
 }
 download.addEventListener('click',downloadClick);x.addEventListener('click',xClick);native.addEventListener('click',nativeClick);
 render();
 return {setPiece,render,clear(){revision++;release();piece=null;status='';busy=false;render();},dispose(){disposed=true;release();download.removeEventListener('click',downloadClick);x.removeEventListener('click',xClick);native.removeEventListener('click',nativeClick);}};
}
