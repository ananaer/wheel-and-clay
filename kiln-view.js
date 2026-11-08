import {cleanPieceRecord} from './piece-link.js';
import {kilnRecipe} from './kiln-art.js';
import {loadKilnRounds,KILN_NETWORK,kilnSourceUrl} from './kiln-chain.js';
import {nftAvailable,mintNft,waitForNftMint,nftTxUrl,nftPieceUrl} from './nft-client.js';

// 第三步保留独立场景，工作台仍保存原坯。预览与铸造共用同一份冻结记录。
export function createKilnView({root,lang=()=> 'en',createStudio,onKeep=async()=>false,onBack=()=>{}}={}){
 const text={
  kicker:['SQUEEKCHAIN · 仓鼠窑','SQUEEKCHAIN · THE HAMSTER KILN'],title:['你的手艺。\n它的火候。','Your hands.\nHis fire.'],
  intro:['选一个真实结算轮次，让仓鼠的工作量留在釉里。','Choose a settled round. Let his work leave a mark in your glaze.'],
  back:['← 返回施釉','← Back to glazing'],select:['选择火候','CHOOSE YOUR FIRING'],round:['轮次','ROUND'],work:['有效工作','accepted work'],
  recentActive:['最近活跃轮次','RECENT ACTIVE ROUND'],quiet:['静纹','Quiet grain'],flow:['流釉','Flowing glaze'],glow:['浓烈窑变','Deep kiln bloom'],
  effectQuiet:['零工作量留下细密静纹。它不代表仓鼠一定在睡觉。','Zero work leaves a quiet grain. It does not prove the hamster was asleep.'],
  effectFlow:['工作量越高，流釉越明显；轮次记录决定窑斑的位置。','More work, stronger glaze flow. The round record places the mineral blooms.'],
  loading:['正在读取已确认轮次…','Reading confirmed rounds…'],failed:['暂时读不到链上轮次。重试，或先收藏原釉作品。','The rounds could not be read. Retry, or keep your original glaze for now.'],
  retry:['最新轮次','Latest rounds'],earlier:['更早的轮次 ←','← Earlier rounds'],mismatch:['轮次来源与预览不一致。请重新读取并开窑。','The source differs from this preview. Reload the rounds and fire again.'],source:['查看链上来源 ↗','Inspect the source ↗'],block:['确认区块','CONFIRMED AT BLOCK'],
  fire:['用这个轮次开窑 ↗','Fire with this round ↗'],firing:['窑变正在显影…','Letting the glaze bloom…'],fired:['窑变已完成','Your firing is ready.'],
  keep:['收藏并分享','Keep & share'],keepPlain:['直接收藏原釉作品','Keep the original glaze'],mint:['铸造为 NFT ↗','Mint this piece ↗'],minted:['NFT 已铸造','NFT minted'],
  fee:['Sepolia 测试网 · 零铸造费，仅需测试币 gas','Sepolia testnet · no mint fee, test ETH for gas'],
  nftInfo:['铸造会保存什么？','What goes onchain?'],nftBody:['器形、釉色、轮次和工作量写入独立的 Wheel & Clay NFT。它不是官方 Squeeks。铸造使用 Sepolia 普通账户，暂不支持智能账户；收藏与分享不需要钱包。','Your shape, glaze, round and work are stored in a separate Wheel & Clay NFT. It is not an official Squeek. Use a standard wallet account on Sepolia; smart accounts are not supported yet. Keeping and sharing need no wallet.'],
  unavailable:['NFT 正在准备，先收藏这一件。','NFT minting is being prepared. You can keep this piece now.'],
  noWallet:['请在装有以太坊钱包的浏览器里打开本页，再点击铸造。','Open this page in a browser with an Ethereum wallet, then choose Mint.'],
  rejected:['你取消了钱包请求，作品还在这里。','Wallet request cancelled. Your piece is still here.'],
  mintError:['交易未完成。确认钱包在 Sepolia、有测试币后再试。','The mint did not complete. Check Sepolia and your test ETH, then retry.'],
  connecting:['连接钱包…','Connecting your wallet…'],switching:['请切换到 Sepolia','Switch to Sepolia'],checking:['核对合约与作品…','Checking the contract and piece…'],confirming:['请在钱包确认铸造','Confirm the mint in your wallet'],pending:['等待链上确认…','Waiting for confirmation…'],
  pendingHelp:['交易已提交。请核对这笔交易，勿重复铸造。','Your transaction was sent. Check this transaction before trying another mint.'],unknownHelp:['钱包未返回有效交易编号。请先查钱包活动，勿重复铸造；若已提交，可粘贴交易哈希核验。','The wallet returned no transaction reference. Check wallet activity before minting again; paste its transaction hash if it was sent.'],hashLabel:['钱包中的交易哈希','Transaction hash from your wallet'],recheck:['检查交易状态','Check transaction'],transaction:['查看交易 ↗','View transaction ↗'],openNft:['打开这件 NFT ↗','Open your NFT ↗'],
  before:['原釉','Before'],after:['窑变','After'],drag:['拖动旋转 · 方向键微调','Drag to orbit · arrow keys to adjust'],reset:['复位视角','Reset view'],
  rendering:['陶器正在就位…','Preparing your piece…'],webgl:['图形加速不可用，请启用 WebGL 后重试。','Graphics acceleration is unavailable. Enable WebGL and retry.'],
  saving:['正在制作作品卡…','Making your keepsake…'],saveError:['作品卡未能保存，请再试一次。','Your keepsake could not be saved. Try again.'],
  recordOnly:['原始釉色，尚未窑烧','Original glaze · not fired'],changeRound:['换个轮次','Change round'],step:['03 / 窑烧','03 / FIRE'],
 };
 const t=key=>text[key][lang()==='zh'?0:1],q=s=>root.querySelector(s),all=s=>root.querySelectorAll(s),put=(s,value)=>{const el=q(s);if(el&&el.textContent!==String(value))el.textContent=String(value);};
 let base=null,records=[],proof=null,selected=null,state='empty',view=null,visible=false,sceneReady=false,gen=0,raf=0,elapsed=0,lastFrame=0,compare=false,error='',mintState='',mintInfo=null,minted=null,busy=false,disposed=false;
 const pendingKey='wheel-clay-pending-mint-v1';
 const readPending=()=>{try{const p=JSON.parse(localStorage.getItem(pendingKey));return p&&(nftTxUrl(p.hash)||p.unknown===true)&&/^0x[0-9a-f]{40}$/i.test(p.account)&&cleanPieceRecord(p.record)?.kiln?p:null;}catch{return null;}};
 const persistPending=()=>{try{if(mintInfo)localStorage.setItem(pendingKey,JSON.stringify(mintInfo));else localStorage.removeItem(pendingKey);}catch{/* 链接仍保留在当前页面，不隐藏已提交交易。 */}};
 const locked=()=>busy||state==='firing'||!!mintInfo;
 const firedRecord=()=>base&&selected?{...base,kiln:selected,...(minted?{nft:minted.nft,maker:minted.maker}:{} )}:null;
 const level=record=>!Number(record.work)?'quiet':Number(record.work)<500?'flow':'glow';
 root.classList.add('kiln-page');root.setAttribute('aria-labelledby','kiln-title');
 root.innerHTML=`<div class="kiln-topline"><button type="button" class="kiln-back" data-kiln-text="back"></button><span data-kiln-text="step"></span></div>
 <div class="kiln-layout"><div class="kiln-visual"><div class="kiln-stage-label"><img src="./brand-research/official/squeekchain-hamster-mark.svg" alt="" width="28" height="28"><span data-kiln-text="kicker"></span></div><canvas id="kiln-canvas" tabindex="0"></canvas><div class="kiln-scene-status" role="status"></div><div class="kiln-stage-bottom"><span data-kiln-text="drag"></span><button type="button" class="kiln-reset" data-kiln-text="reset"></button></div><div class="kiln-reveal" aria-hidden="true"></div></div>
 <div class="kiln-controls"><h1 id="kiln-title" tabindex="-1" data-kiln-text="title"></h1><p class="kiln-intro" data-kiln-text="intro"></p>
 <div class="kiln-locked-round"><strong></strong><button type="button" class="kiln-change-round" data-kiln-text="changeRound"></button></div><div class="kiln-select-head"><span data-kiln-text="select"></span><button type="button" class="kiln-refresh" data-kiln-text="retry"></button></div><div class="kiln-rounds" role="group"></div><button type="button" class="kiln-earlier" data-kiln-text="earlier"></button><p class="kiln-effect"></p><div class="kiln-proof"><a target="_blank" rel="noopener noreferrer" class="kiln-source" data-kiln-text="source"></a><span class="kiln-confirmed"></span></div>
 <div class="kiln-actions"><button type="button" class="kiln-fire" data-kiln-text="fire"></button><div class="kiln-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div><p class="kiln-result" role="status" aria-live="polite"></p>
 <div class="kiln-comparison"><button type="button" data-kiln-compare="before" data-kiln-text="before"></button><button type="button" data-kiln-compare="after" data-kiln-text="after"></button></div>
 <div class="kiln-finished-actions"><button type="button" class="kiln-keep" data-kiln-text="keep"></button><button type="button" class="kiln-mint" data-kiln-text="mint"></button></div>
 <a class="kiln-nft-link" target="_blank" rel="noopener noreferrer" data-kiln-text="openNft"></a><p class="kiln-mint-fee" data-kiln-text="fee"></p><p class="kiln-feedback" role="status" aria-live="polite"></p><label class="kiln-hash-entry"><span data-kiln-text="hashLabel"></span><input id="kiln-tx-input" type="text" spellcheck="false" autocomplete="off" placeholder="0x…" maxlength="66"></label><div class="kiln-pending-actions"><a class="kiln-tx" target="_blank" rel="noopener noreferrer" data-kiln-text="transaction"></a><button type="button" class="kiln-recheck" data-kiln-text="recheck"></button></div>
 <details class="kiln-nft-details"><summary data-kiln-text="nftInfo"></summary><p data-kiln-text="nftBody"></p></details><button type="button" class="kiln-plain" data-kiln-text="keepPlain"></button></div></div></div>`;
 function renderRounds(){
  const container=q('.kiln-rounds');container.replaceChildren();container.setAttribute('aria-label',t('select'));
  for(const record of records){const button=document.createElement('button');button.type='button';button.dataset.round=record.round;button.setAttribute('aria-pressed',String(record===selected));button.disabled=locked();
   const name=document.createElement('span');name.className='kiln-round-label';name.textContent=(record.round===proof?.recentActiveRound?t('recentActive'):t('round'))+' '+record.round;
   const number=document.createElement('strong');number.textContent=Number(record.work).toLocaleString(lang()==='zh'?'zh-CN':'en-US');
   const unit=document.createElement('small');unit.textContent=t('work');const bars=document.createElement('i');bars.className='kiln-round-bars';bars.setAttribute('aria-hidden','true');bars.style.setProperty('--energy',String(kilnRecipe(record).energyBps/10000));
   const description=document.createElement('span');description.className='kiln-round-mood';description.textContent=t(level(record));button.append(name,number,unit,bars,description);
   button.addEventListener('click',()=>{if(locked()||selected===record)return;selected=record;state='ready';minted=null;error='';compare=false;view?.setKiln(selected);view?.setKilnReveal(0);render();});container.append(button);
  }
 }
 function render(){
  all('[data-kiln-text]').forEach(el=>{el.textContent=t(el.dataset.kilnText);});root.dataset.kilnState=state;root.dataset.kilnBusy=String(busy);root.dataset.round=selected?.round||'';
  renderRounds();q('.kiln-earlier').hidden=!records.length||!!minted;q('.kiln-earlier').disabled=locked()||state==='loading'||BigInt(records.at(-1)?.round||'1')<=1n;q('.kiln-back').disabled=busy||state==='firing';q('.kiln-refresh').disabled=locked()||state==='loading';q('.kiln-refresh').hidden=!!minted;
  q('#kiln-canvas').setAttribute('aria-label',lang()==='zh'?'窑变陶器预览，可拖动旋转':'Fired pottery preview. Drag to orbit');
  put('.kiln-scene-status',!view?t('webgl'):sceneReady?'':t('rendering'));q('.kiln-scene-status').hidden=!!view&&sceneReady;
  put('.kiln-effect',state==='loading'?t('loading'):state==='error'?t('failed'):selected?t(Number(selected.work)?'effectFlow':'effectQuiet'):t('recordOnly'));
  q('.kiln-proof').hidden=!selected;q('.kiln-source').href=selected?kilnSourceUrl(selected):'#';put('.kiln-confirmed',proof?t('block')+' '+Number(proof.blockNumber).toLocaleString('en-US'):'');
  const fired=state==='fired';q('.kiln-locked-round').hidden=!fired;put('.kiln-locked-round strong',selected?t('round')+' '+selected.round+' · '+selected.work+' '+t('work'):'');q('.kiln-change-round').disabled=locked()||!!minted;q('.kiln-fire').hidden=fired||!!mintInfo;q('.kiln-fire').disabled=state!=='ready'||!sceneReady||!selected||busy;
  q('.kiln-fire').textContent=t(state==='firing'?'firing':'fire');q('.kiln-progress').hidden=state!=='firing';q('.kiln-result').hidden=!fired;put('.kiln-result',t(minted?'minted':'fired')+(minted?' #'+minted.nft.tokenId:''));
  q('.kiln-comparison').hidden=!fired;all('[data-kiln-compare]').forEach(button=>{button.disabled=busy;button.setAttribute('aria-pressed',String((button.dataset.kilnCompare==='before')===compare));});
  q('.kiln-finished-actions').hidden=!fired;q('.kiln-keep').disabled=busy;q('.kiln-mint').hidden=!!minted;q('.kiln-mint').disabled=busy||!!mintInfo||!nftAvailable();
  q('.kiln-mint-fee').hidden=!fired||!!minted;put('.kiln-mint-fee',nftAvailable()?t('fee'):t('unavailable'));q('.kiln-nft-details').hidden=!fired;
  q('.kiln-nft-link').hidden=!minted;if(minted)q('.kiln-nft-link').href=nftPieceUrl(minted.nft.tokenId,lang());
  q('.kiln-hash-entry').hidden=!(mintInfo?.unknown||mintInfo?.manual);q('.kiln-tx').hidden=!mintInfo?.hash;q('.kiln-pending-actions').hidden=!mintInfo;q('.kiln-recheck').disabled=busy;if(mintInfo)q('.kiln-tx').href=nftTxUrl(mintInfo.hash);
  put('.kiln-feedback',mintState?t(mintState):error?t(error):mintInfo?t(mintInfo.unknown?'unknownHelp':'pendingHelp'):'');
  q('.kiln-plain').hidden=state==='fired'||state==='firing'||!!mintInfo;q('.kiln-plain').disabled=busy||!base||!sceneReady;
 }
 function ensureScene(){if(view||disposed)return;try{view=createStudio(q('#kiln-canvas'),{background:'#101114',sealUrl:'./brand-research/official/squeekchain-hamster-mark.svg',onReady(){sceneReady=true;render();}});view.setPhase('glaze');view.setRpm(0);view.setVisible(visible);}catch{view=null;}render();}
 function updateScene(){ensureScene();if(!view||!base)return;view.setProfile(base.profile,base.form);view.setGlaze(base.glaze);view.setSurface(base.surface);view.setFinish(base.finish);view.setKiln(selected);view.setKilnReveal(state==='fired'?1:0);view.resetView();}
 async function load(round=null){const serial=++gen;state='loading';error='';selected=null;proof=null;records=[];view?.setKiln(null);render();try{const result=await loadKilnRounds({round,includeRecentActive:round===null});if(disposed||serial!==gen)return;proof=result;records=result.records;selected=records.find(record=>Number(record.work)>0)||records[0];state='ready';view?.setKiln(selected);view?.setKilnReveal(0);}catch{if(disposed||serial!==gen)return;state='error';}render();}
 function tick(now){raf=0;if(disposed||!visible||state!=='firing'){lastFrame=0;return;}if(lastFrame)elapsed+=Math.min(now-lastFrame,50);lastFrame=now;const p=Math.min(1,elapsed/2400),ease=p*p*(3-2*p);view?.setKilnReveal(ease);root.style.setProperty('--kiln-progress',String(p));q('.kiln-progress').setAttribute('aria-valuenow',String(Math.round(p*100)));if(p===1){state='fired';render();}else raf=requestAnimationFrame(tick);}
 function fire(){if(state!=='ready'||!selected||!sceneReady||locked())return;state='firing';compare=false;elapsed=0;lastFrame=0;view.setKiln(selected);view.setKilnReveal(0);render();if(matchMedia('(prefers-reduced-motion: reduce)').matches){view.setKilnReveal(1);state='fired';render();}else raf=requestAnimationFrame(tick);}
 async function keep(plain=false){if(busy||!base||!view||!sceneReady)return;busy=true;error='';mintState='saving';render();try{const record=plain?base:firedRecord();view.setKiln(plain?null:selected);view.setKilnReveal(1);const image=view.capture(1200,1100);const ok=await onKeep(record,image,{verifiedKiln:!plain,verifiedNft:!!minted});if(!ok)error='saveError';}catch{error='saveError';}finally{busy=false;mintState='';if(compare)view?.setKilnReveal(0);render();}}
 function mintedDone(actual){minted=actual;mintInfo=null;persistPending();mintState='';error='';state='fired';}
 async function mint(){if(locked()||state!=='fired'||!nftAvailable())return;busy=true;error='';render();try{const result=await mintNft(firedRecord(),{onState(next,info){mintState=next;if(next==='pending'){mintInfo={...info,record:firedRecord()};persistPending();}render();}});mintedDone(result);}catch(err){if(err?.code==='reverted'){mintInfo=null;persistPending();error='mintError';}else if(err?.code==='submission_unknown'){mintInfo={unknown:true,account:err.account,record:firedRecord()};persistPending();error='unknownHelp';}else if(mintInfo){error='pendingHelp';}else error=err?.code==='source_mismatch'?'mismatch':err?.code===4001?'rejected':err?.code==='no_wallet'?'noWallet':'mintError';}finally{busy=false;mintState='';render();}}
 async function recheck(){if(!mintInfo||busy)return;if(mintInfo.unknown||mintInfo.manual){const hash=q('#kiln-tx-input').value.trim();if(!nftTxUrl(hash)){error='unknownHelp';render();return;}mintInfo={...mintInfo,unknown:false,manual:true,hash};persistPending();}busy=true;error='';mintState='pending';render();try{mintedDone(await waitForNftMint(mintInfo.hash,mintInfo.account,mintInfo.record,{attempts:3}));}catch(err){if(err?.code==='reverted'){mintInfo=null;persistPending();error='mintError';}else error='pendingHelp';}finally{busy=false;mintState='';render();}}
 q('.kiln-earlier').addEventListener('click',()=>{if(!locked()&&records.length&&BigInt(records.at(-1).round)>1n)load((BigInt(records.at(-1).round)-1n).toString());});
 q('.kiln-change-round').addEventListener('click',()=>{if(locked()||minted)return;state='ready';error='';compare=false;view?.setKilnReveal(0);render();});
 q('.kiln-back').addEventListener('click',()=>{if(!busy&&state!=='firing')onBack();});q('.kiln-refresh').addEventListener('click',()=>{if(!locked())load();});q('.kiln-fire').addEventListener('click',fire);q('.kiln-keep').addEventListener('click',()=>keep());q('.kiln-plain').addEventListener('click',()=>keep(true));q('.kiln-mint').addEventListener('click',mint);q('.kiln-recheck').addEventListener('click',recheck);q('.kiln-reset').addEventListener('click',()=>view?.resetView());
 all('[data-kiln-compare]').forEach(button=>button.addEventListener('click',()=>{if(busy||state!=='fired')return;compare=button.dataset.kilnCompare==='before';view?.setKilnReveal(compare?0:1);render();}));
 q('#kiln-canvas').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();view?.orbitView(e.key==='ArrowLeft'?-.09:e.key==='ArrowRight'?.09:0,e.key==='ArrowUp'?.05:e.key==='ArrowDown'?-.05:0);});
 return {
  open(record){if(busy)return false;const pending=readPending(),candidate=pending?.record||record,clean=cleanPieceRecord(candidate);if(!clean)return false;cancelAnimationFrame(raf);raf=0;base={...candidate,...clean};base.profile=clean.profile.slice();delete base.kiln;delete base.nft;minted=null;mintInfo=pending;q('#kiln-tx-input').value=pending?.hash||'';mintState='';error='';compare=false;state=pending?'fired':'loading';selected=pending?.record.kiln||null;records=selected?[selected]:[];proof=null;updateScene();render();if(!pending)load();return true;},
  resume(){const pending=readPending();return pending?this.open(pending.record):false;},
  get hasPiece(){return !!base;},get isBusy(){return busy||state==='firing';},
  render,setVisible(value){visible=!!value;view?.setVisible(visible);if(!visible){cancelAnimationFrame(raf);raf=0;lastFrame=0;}else if(state==='firing'&&!raf)raf=requestAnimationFrame(tick);},
  dispose(){disposed=true;gen++;cancelAnimationFrame(raf);view?.dispose();}
 };
}
