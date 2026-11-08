import {cleanPieceRecord,encodePieceDesign} from './piece-link.js';
import {kilnRecipe} from './kiln-art.js';
import {loadKilnRounds,KILN_NETWORK,kilnSourceUrl} from './kiln-chain.js';
import {nftAvailable,mintNft,waitForNftMint,nftTxUrl,nftPieceUrl} from './nft-client.js';

// 第三步保留独立场景，工作台仍保存原坯。预览与铸造共用同一份冻结记录。
export function createKilnView({root,lang=()=> 'en',createStudio,onKeep=async()=>false,onBack=()=>{},connectWallet=null,getWalletProvider=()=>globalThis.ethereum,onWalletChange=()=>{}}={}){
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
  connecting:['连接钱包…','Connecting your wallet…'],switching:['请切换到 Sepolia','Switch to Sepolia'],checking:['核对合约与作品…','Checking the contract and piece…'],confirming:['请在钱包确认铸造','Confirm the mint in your wallet'],pending:['交易已提交','Transaction submitted'],
  pendingHelp:['交易已提交。请核对这笔交易，勿重复铸造。','Your transaction was sent. Check this transaction before trying another mint.'],unknownHelp:['钱包未返回有效交易编号。请先查钱包活动，勿重复铸造；若已提交，可粘贴交易哈希核验。','The wallet returned no transaction reference. Check wallet activity before minting again; paste its transaction hash if it was sent.'],hashLabel:['钱包中的交易哈希','Transaction hash from your wallet'],recheck:['检查交易状态','Check transaction'],transaction:['查看交易 ↗','View transaction ↗'],openNft:['打开这件 NFT ↗','Open your NFT ↗'],
  mintSent:['交易已提交','Transaction submitted'],mintIncluded:['铸造完成','Mint complete'],mintVerifying:['正在校验作品','Checking your piece'],mintRestoring:['正在找回这笔铸造','Finding your mint'],mintRetrying:['连接暂时中断，正在重试','Connection interrupted. Reconnecting…'],mintPaused:['连接尚未恢复，可重新检查这笔交易。','Still unable to reconnect. Recheck this transaction.'],mintCheckFailed:['交易记录需要进一步核对。请查看交易或重新检查，无需再铸造。','This transaction needs another check. Inspect it or recheck; do not mint again.'],mintIncludedHelp:['交易已成功。作品核验在后台继续，你可以继续创作。','Your mint succeeded. Artwork verification continues in the background. You can keep creating.'],mintVerifyHelp:['核对器形、釉色和回合来源。','Matching the shape, glaze and round provenance.'],mintSentHelp:['交易正在等待打包。你可以继续创作，进度会保留在这里。','Your transaction is awaiting inclusion. Keep creating; its progress is saved here.'],mintConfirmations:['后续区块','FOLLOWING BLOCKS'],mintSteps:['发送 · 上链 · 校验','SENT · ONCHAIN · VERIFIED'],mintSuccessTitle:['这一件，\n已上链。','Your piece.\nOnchain.'],mintSuccessLead:['你的手艺与它的火候，已经一起封存。','Your hands. His fire. Sealed together.'],mintSuccessLabel:['铸造完成','MINT COMPLETE'],mintSuccessHelp:['器形、釉色与轮次来源已保存至合约。','Shape, glaze and round provenance saved in the contract.'],mintShare:['分享这件作品','Share your piece'],mintStamp:['链上封存','SEALED ONCHAIN'],mintChecking:['核验中','CHECKING'],
  mintCheckTitle:['这笔铸造需要核对','This mint needs a check'],mintIncludedRetryHelp:['交易已成功。连接恢复后会继续核验作品。','The transaction succeeded. Reconnecting to finish verification.'],
  continue:['继续创作','Keep creating'],localShare:['分享本机作品','Share local piece'],localHelp:['本机作品分享 · NFT 尚未完成核验','Local piece share · NFT verification pending'],background:['之前的铸造正在同步 · 查看','Previous mint syncing · View'],backgroundReady:['之前的 NFT 已就绪 · 查看','Previous NFT ready · View'],syncDetails:['后台核验详情','Background verification'],provisionalStamp:['已铸造 · 核验中','MINTED · SYNCING'],
  mintStatusLabel:['铸造进度','MINT PROGRESS'],
  before:['原釉','Before'],after:['窑变','After'],drag:['拖动旋转 · 方向键微调','Drag to orbit · arrow keys to adjust'],reset:['复位视角','Reset view'],
  rendering:['陶器正在就位…','Preparing your piece…'],webgl:['图形加速不可用，请启用 WebGL 后重试。','Graphics acceleration is unavailable. Enable WebGL and retry.'],
  saving:['正在制作作品卡…','Making your keepsake…'],saveError:['作品卡未能保存，请再试一次。','Your keepsake could not be saved. Try again.'],
  recordOnly:['原始釉色，尚未窑烧','Original glaze · not fired'],changeRound:['换个轮次','Change round'],step:['03 / 窑烧','03 / FIRE'],
 };
 const t=key=>text[key][lang()==='zh'?0:1],q=s=>root.querySelector(s),all=s=>root.querySelectorAll(s),put=(s,value)=>{const el=q(s);if(el&&el.textContent!==String(value))el.textContent=String(value);};
 let base=null,records=[],proof=null,selected=null,state='empty',view=null,visible=false,sceneReady=false,gen=0,raf=0,elapsed=0,lastFrame=0,compare=false,error='',mintState='',mintInfo=null,minted=null,busy=false,disposed=false;
 let mintProgress=null,mintPhase='',mintController=null,resumeTimer=0,resumeAttempts=0,celebrationTimer=0,celebrationPending=null;
 let sourceVerified=false,tracking=false,mintAttached=false,mintErrorKey='',completedJob=null,jobSerial=0;const celebrated=new Set();
 const pendingKey='wheel-clay-pending-mint-v1';
 const readPending=()=>{try{const p=JSON.parse(localStorage.getItem(pendingKey));return p&&(nftTxUrl(p.hash)||p.unknown===true)&&/^0x[0-9a-f]{40}$/i.test(p.account)&&cleanPieceRecord(p.record)?.kiln?p:null;}catch{return null;}};
 const persistPending=()=>{try{if(mintInfo)localStorage.setItem(pendingKey,JSON.stringify(mintInfo));else localStorage.removeItem(pendingKey);}catch{/* 链接仍保留在当前页面，不隐藏已提交交易。 */}};
 const locked=()=>busy||state==='firing'||mintAttached&&!!mintInfo;
 const provisional=()=>mintAttached&&!!mintInfo&&mintProgress?.receiptVerified===true;
 const notifyWallet=()=>{try{Promise.resolve(onWalletChange()).catch(()=>{});}catch{}};
 const firedRecord=()=>base&&selected?{...base,kiln:selected,...(minted?{nft:minted.nft,maker:minted.maker}:{} )}:null;
 const level=record=>!Number(record.work)?'quiet':Number(record.work)<500?'flow':'glow';
 root.classList.add('kiln-page');root.setAttribute('aria-labelledby','kiln-title');
 root.innerHTML=`<div class="kiln-topline"><button type="button" class="kiln-back" data-kiln-text="back"></button><span data-kiln-text="step"></span></div>
 <div class="kiln-layout"><div class="kiln-visual"><div class="kiln-stage-label"><img src="./brand-research/official/squeekchain-hamster-mark.svg" alt="" width="28" height="28"><span data-kiln-text="kicker"></span></div><canvas id="kiln-canvas" tabindex="0"></canvas><div class="kiln-scene-status" role="status"></div><div class="kiln-stage-bottom"><span data-kiln-text="drag"></span><button type="button" class="kiln-reset" data-kiln-text="reset"></button></div><div class="kiln-reveal" aria-hidden="true"></div><div class="kiln-mint-shine" aria-hidden="true"></div><div class="kiln-mint-halo" aria-hidden="true"></div><div class="kiln-piece-stamp" hidden><span data-kiln-text="mintStamp"></span><strong></strong><small>SEPOLIA</small></div></div>
 <div class="kiln-controls"><h1 id="kiln-title" tabindex="-1" data-kiln-text="title"></h1><p class="kiln-intro" data-kiln-text="intro"></p>
 <div class="kiln-locked-round"><strong></strong><button type="button" class="kiln-change-round" data-kiln-text="changeRound"></button></div><div class="kiln-select-head"><span data-kiln-text="select"></span><button type="button" class="kiln-refresh" data-kiln-text="retry"></button></div><div class="kiln-rounds" role="group"></div><button type="button" class="kiln-earlier" data-kiln-text="earlier"></button><p class="kiln-effect"></p><div class="kiln-proof"><a target="_blank" rel="noopener noreferrer" class="kiln-source" data-kiln-text="source"></a><span class="kiln-confirmed"></span></div>
 <div class="kiln-actions"><button type="button" class="kiln-fire" data-kiln-text="fire"></button><div class="kiln-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div><p class="kiln-result" role="status" aria-live="polite"></p>
 <div class="kiln-comparison"><button type="button" data-kiln-compare="before" data-kiln-text="before"></button><button type="button" data-kiln-compare="after" data-kiln-text="after"></button></div>
 <section class="kiln-mint-status" hidden aria-labelledby="kiln-mint-heading"><div class="kiln-mint-status-top"><span class="kiln-mint-status-kicker"></span><span class="kiln-mint-status-network">SEPOLIA</span></div><h2 id="kiln-mint-heading" tabindex="-1" aria-live="polite"></h2><p class="kiln-mint-status-help"></p><details class="kiln-mint-sync-details"><summary data-kiln-text="syncDetails"></summary><div class="kiln-confirmation-meter" role="progressbar" aria-valuemin="0" aria-valuemax="12"><i></i></div><div class="kiln-confirmation-caption"><span data-kiln-text="mintConfirmations"></span><strong></strong></div><div class="kiln-mint-retry" role="status" aria-live="polite"></div></details></section>
 <div class="kiln-finished-actions"><button type="button" class="kiln-keep" data-kiln-text="keep"></button><button type="button" class="kiln-mint" data-kiln-text="mint"></button></div>
 <p class="kiln-local-share-note" data-kiln-text="localHelp" hidden></p><button type="button" class="kiln-continue" data-kiln-text="continue" hidden></button><button type="button" class="kiln-background-pending" hidden></button><a class="kiln-nft-link" target="_blank" rel="noopener noreferrer" data-kiln-text="openNft"></a><p class="kiln-mint-fee" data-kiln-text="fee"></p><p class="kiln-feedback" role="status" aria-live="polite"></p><label class="kiln-hash-entry"><span data-kiln-text="hashLabel"></span><input id="kiln-tx-input" type="text" spellcheck="false" autocomplete="off" placeholder="0x…" maxlength="66"></label><div class="kiln-pending-actions"><a class="kiln-tx" target="_blank" rel="noopener noreferrer" data-kiln-text="transaction"></a><button type="button" class="kiln-recheck" data-kiln-text="recheck"></button></div>
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
 function renderMintStatus(){
  const attached=mintAttached&&!!mintInfo,active=!!minted||attached&&!!mintInfo.hash&&!mintInfo.unknown,done=!!minted,included=provisional(),phase=done?'verified':included?'included':mintErrorKey==='mintCheckFailed'?'checking':mintPhase||'pending';
  root.dataset.mintPhase=active?phase:'';q('.kiln-mint-status').hidden=!active;
  q('.kiln-piece-stamp').hidden=!(done||included);
  if(done||included){put('.kiln-piece-stamp strong','WCLAY #'+(minted?.nft.tokenId||mintProgress.tokenId));put('.kiln-piece-stamp span',t(done?'mintStamp':'provisionalStamp'));}
  if(!active)return;
  const count=Math.min(12,Math.max(0,Number(mintProgress?.confirmedBlocks)||0));
  put('.kiln-mint-status-kicker',done||included?t('mintSuccessLabel'):t('mintStatusLabel'));
  put('.kiln-mint-status-network',included?'NFT #'+mintProgress.tokenId:'SEPOLIA');
  put('#kiln-mint-heading',done?'NFT #'+minted.nft.tokenId:mintErrorKey==='mintCheckFailed'?t('mintCheckTitle'):included?t('mintIncluded'):phase==='restoring'?t('mintRestoring'):t('mintSent'));
  put('.kiln-mint-status-help',done?t('mintSuccessHelp'):included?t(mintProgress?.status==='retrying'||mintErrorKey==='mintPaused'?'mintIncludedRetryHelp':'mintIncludedHelp'):mintErrorKey==='mintCheckFailed'?t('mintCheckFailed'):t('mintSentHelp'));
  q('.kiln-mint-sync-details').hidden=done;q('.kiln-confirmation-meter').hidden=!included;q('.kiln-confirmation-caption').hidden=!included;
  q('.kiln-confirmation-meter').setAttribute('aria-valuenow',String(count));q('.kiln-confirmation-meter').setAttribute('aria-label',t('mintConfirmations'));
  q('.kiln-confirmation-meter').style.setProperty('--mint-confirmed',String(count/12));put('.kiln-confirmation-caption strong',count+' / 12');
  put('.kiln-mint-retry',done?'':mintErrorKey?t(mintErrorKey):mintProgress?.status==='retrying'?t('mintRetrying'):mintProgress?.stage==='verifying'?t('mintVerifyHelp'):t('pendingHelp'));
 }

 function render(){
  all('[data-kiln-text]').forEach(el=>{el.textContent=t(el.dataset.kilnText);});root.dataset.kilnState=state;root.dataset.kilnBusy=String(busy);root.dataset.mintTracking=String(tracking);root.dataset.round=selected?.round||'';
  renderRounds();q('.kiln-earlier').hidden=!records.length||!!minted;q('.kiln-earlier').disabled=locked()||state==='loading'||BigInt(records.at(-1)?.round||'1')<=1n;q('.kiln-back').disabled=busy||state==='firing';q('.kiln-refresh').disabled=locked()||state==='loading';q('.kiln-refresh').hidden=!!minted;
  q('#kiln-canvas').setAttribute('aria-label',lang()==='zh'?'窑变陶器预览，可拖动旋转':'Fired pottery preview. Drag to orbit');
  put('.kiln-scene-status',!view?t('webgl'):sceneReady?'':t('rendering'));q('.kiln-scene-status').hidden=!!view&&sceneReady;
  put('.kiln-effect',state==='loading'?t('loading'):state==='error'?t('failed'):selected?t(Number(selected.work)?'effectFlow':'effectQuiet'):t('recordOnly'));
  q('.kiln-proof').hidden=!selected;q('.kiln-source').href=selected?kilnSourceUrl(selected):'#';put('.kiln-confirmed',proof?t('block')+' '+Number(proof.blockNumber).toLocaleString('en-US'):'');
  const fired=state==='fired';q('.kiln-locked-round').hidden=!fired;put('.kiln-locked-round strong',selected?t('round')+' '+selected.round+' · '+selected.work+' '+t('work'):'');q('.kiln-change-round').disabled=locked()||!!minted;q('.kiln-change-round').hidden=!!minted||mintAttached&&!!mintInfo;q('.kiln-fire').hidden=fired||mintAttached&&!!mintInfo;q('.kiln-fire').disabled=state!=='ready'||!sceneReady||!selected||busy;
  q('.kiln-fire').textContent=t(state==='firing'?'firing':'fire');q('.kiln-progress').hidden=state!=='firing';q('.kiln-result').hidden=!fired;put('.kiln-result',t(minted?'minted':'fired')+(minted?' #'+minted.nft.tokenId:''));
  q('.kiln-comparison').hidden=!fired;all('[data-kiln-compare]').forEach(button=>{button.disabled=busy;button.setAttribute('aria-pressed',String((button.dataset.kilnCompare==='before')===compare));});
  q('.kiln-finished-actions').hidden=!fired;q('.kiln-keep').disabled=busy;q('.kiln-mint').hidden=!!minted||!!mintInfo;q('.kiln-mint').disabled=busy||!!mintInfo||!nftAvailable();
  q('.kiln-mint-fee').hidden=!fired||!!minted||!!mintInfo;put('.kiln-mint-fee',nftAvailable()?t('fee'):t('unavailable'));q('.kiln-nft-details').hidden=!fired||!!mintInfo;
  q('.kiln-local-share-note').hidden=!(fired&&mintAttached&&mintInfo);if(fired&&mintAttached&&mintInfo)put('.kiln-keep',t('localShare'));
  q('.kiln-continue').hidden=!(minted||mintAttached&&mintInfo);q('.kiln-continue').disabled=busy||state==='firing';
  q('.kiln-background-pending').hidden=mintAttached||!mintInfo&&!completedJob||!!minted;q('.kiln-background-pending').disabled=busy||state==='firing';put('.kiln-background-pending',t(mintInfo?'background':'backgroundReady'));
  q('.kiln-nft-link').hidden=!minted;if(minted){q('.kiln-nft-link').href=nftPieceUrl(minted.nft.tokenId,lang());put('#kiln-title',t('mintSuccessTitle'));put('.kiln-intro',t('mintSuccessLead'));put('.kiln-keep',t('mintShare'));}
  q('.kiln-hash-entry').hidden=!(mintAttached&&(mintInfo?.unknown||mintInfo?.manual));q('.kiln-tx').hidden=!mintInfo?.hash;q('.kiln-pending-actions').hidden=!mintInfo||!mintAttached;q('.kiln-recheck').disabled=busy||tracking;if(mintInfo)q('.kiln-tx').href=nftTxUrl(mintInfo.hash);
  put('.kiln-feedback',mintState==='saving'?t('saving'):mintAttached&&mintInfo&&!mintInfo.unknown?'':mintState?t(mintState):error?t(error):mintAttached&&mintInfo?t('unknownHelp'):'');
  q('.kiln-plain').hidden=state==='fired'||state==='firing'||mintAttached&&!!mintInfo;q('.kiln-plain').disabled=busy||!base||!sceneReady;
  renderMintStatus();
 }
 function ensureScene(){if(view||disposed)return;try{view=createStudio(q('#kiln-canvas'),{background:'#101114',sealUrl:'./brand-research/official/squeekchain-hamster-mark.svg',onReady(){sceneReady=true;render();}});view.setPhase('glaze');view.setRpm(0);view.setVisible(visible);}catch{view=null;}render();}
 function updateScene(){ensureScene();if(!view||!base)return;view.setProfile(base.profile,base.form);view.setGlaze(base.glaze);view.setSurface(base.surface);view.setFinish(base.finish);view.setKiln(selected);view.setKilnReveal(state==='fired'?1:0);view.resetView();}
 async function load(round=null){const serial=++gen;sourceVerified=false;state='loading';error='';selected=null;proof=null;records=[];view?.setKiln(null);render();try{const result=await loadKilnRounds({round,includeRecentActive:round===null});if(disposed||serial!==gen)return;proof=result;sourceVerified=true;records=result.records;selected=records.find(record=>Number(record.work)>0)||records[0];state='ready';view?.setKiln(selected);view?.setKilnReveal(0);}catch{if(disposed||serial!==gen)return;state='error';}render();}
 function tick(now){raf=0;if(disposed||!visible||state!=='firing'){lastFrame=0;return;}if(lastFrame)elapsed+=Math.min(now-lastFrame,50);lastFrame=now;const p=Math.min(1,elapsed/2400),ease=p*p*(3-2*p);view?.setKilnReveal(ease);root.style.setProperty('--kiln-progress',String(p));q('.kiln-progress').setAttribute('aria-valuenow',String(Math.round(p*100)));if(p===1){state='fired';render();}else raf=requestAnimationFrame(tick);}
 function fire(){if(state!=='ready'||!selected||!sceneReady||locked())return;state='firing';compare=false;elapsed=0;lastFrame=0;view.setKiln(selected);view.setKilnReveal(0);render();if(matchMedia('(prefers-reduced-motion: reduce)').matches){view.setKilnReveal(1);state='fired';render();}else raf=requestAnimationFrame(tick);}
 async function keep(plain=false){if(busy||!base||!view||!sceneReady)return;busy=true;error='';mintState='saving';render();try{const record=plain?base:firedRecord();view.setKiln(plain?null:selected);view.setKilnReveal(1);const image=view.capture(1200,1100);const ok=await onKeep(record,image,{verifiedKiln:!plain&&sourceVerified,verifiedNft:!!minted});if(!ok)error='saveError';}catch{error='saveError';}finally{busy=false;mintState='';if(compare)view?.setKilnReveal(0);render();}}
 function clearCelebration(){clearTimeout(celebrationTimer);celebrationPending=null;root.classList.remove('kiln-mint-celebrate');}
 function onMintProgress(next,detail){
  if(disposed||!mintInfo)return;
  // 重新启动只读tracker的初始pending不撤销刚才的receipt事实；实际null/坏证明会明确撤销。
  const unobserved=['pending','retrying','aborted'].includes(next)&&detail.stage==='submitted'&&!['receipt_unavailable','awaiting_receipt','receipt_changed','verification_failed','invalid_saved_preview'].includes(detail.reason);
  if(unobserved&&mintProgress?.receiptVerified)mintProgress={...mintProgress,status:next,retryCount:detail.retryCount,maxRetries:detail.maxRetries,reason:detail.reason};
  else mintProgress={...detail,status:next};
  if(['verification_failed','reverted'].includes(next)){mintProgress={...detail,status:next,receiptVerified:false};mintErrorKey=next==='verification_failed'?'mintCheckFailed':'';clearCelebration();}
  else if(detail.reason==='receipt_unavailable'||detail.reason==='awaiting_receipt'||detail.reason==='receipt_changed'){mintProgress={...detail,status:next,receiptVerified:false};clearCelebration();}
  else if(['included','verifying','verified'].includes(next))mintErrorKey='';
  mintPhase=mintProgress?.receiptVerified?'included':next==='verification_failed'?'checking':'pending';
  mintInfo={...mintInfo,progress:{stage:mintProgress.stage,confirmedBlocks:mintProgress.confirmedBlocks,tokenId:mintProgress.tokenId,receiptVerified:mintProgress.receiptVerified}};persistPending();
  if(provisional())queueCelebrate(mintInfo.hash);render();
 }
 function scheduleResume(delay=500){
  clearTimeout(resumeTimer);resumeTimer=0;
  if(disposed||!visible||busy||tracking||!mintInfo?.hash||mintInfo.unknown||mintInfo.manual||mintErrorKey==='mintCheckFailed'||resumeAttempts>=5)return;
  resumeTimer=setTimeout(()=>{resumeTimer=0;recheck(true);},delay);
 }
 function mintedDone(actual){
  if(disposed)return;const attached=mintAttached;completedJob=actual;mintInfo=null;persistPending();mintErrorKey='';resumeAttempts=0;clearTimeout(resumeTimer);resumeTimer=0;
  if(!attached){render();return;}
  sourceVerified=true;minted=actual;selected=actual.kiln;records=[selected];base={...base,...actual,profile:actual.profile.slice()};delete base.kiln;delete base.nft;mintAttached=false;error='';state='fired';mintPhase='verified';compare=false;
  view?.setKiln(actual.kiln);view?.setKilnReveal(1);queueCelebrate(actual.nft.transactionHash);
 }
 function queueCelebrate(hash){if(hash&&!celebrated.has(hash)){celebrationPending=hash;celebrate();}}
 function celebrate(){
  if(!visible||!celebrationPending||disposed||!(minted||provisional()))return;
  const hash=minted?.nft.transactionHash||mintInfo?.hash;if(hash!==celebrationPending||celebrated.has(hash))return;
  celebrationPending=null;celebrated.add(hash);if(mintInfo){mintInfo={...mintInfo,celebrated:true};persistPending();}root.classList.add('kiln-mint-celebrate');
  clearTimeout(celebrationTimer);celebrationTimer=setTimeout(()=>root.classList.remove('kiln-mint-celebrate'),2600);
 }
 function confirmationError(err){
  if(err?.code==='reverted'){const attached=mintAttached;mintInfo=null;mintProgress=null;mintPhase='';mintAttached=false;persistPending();clearCelebration();if(attached&&state==='fired')error='mintError';}
  else if(mintInfo){mintErrorKey=err?.reason==='verification_failed'||err?.reason==='invalid_saved_preview'?'mintCheckFailed':'mintPaused';if(mintErrorKey==='mintCheckFailed'){mintProgress={...mintProgress,receiptVerified:false};mintPhase='checking';clearCelebration();}}
 }
 async function mint(){
  if(locked()||mintInfo||minted||tracking||state!=='fired'||!nftAvailable())return;
  clearTimeout(resumeTimer);busy=true;error='';mintErrorKey='';mintProgress=null;mintPhase='';resumeAttempts=0;mintController=new AbortController();const serial=++jobSerial,record={...firedRecord(),profile:base.profile.slice()},controller=mintController;let released=false;render();
  try{
   const provider=connectWallet?await connectWallet():getWalletProvider();notifyWallet();if(disposed||serial!==jobSerial)return;
   const result=await mintNft(record,{provider,signal:controller.signal,onProgress:(next,detail)=>{if(serial===jobSerial)onMintProgress(next,detail);},onState(next,info){
    if(disposed||serial!==jobSerial)return;mintState=next;
    if(next==='pending'){mintInfo={...info,record};mintAttached=true;mintPhase='pending';released=true;busy=false;mintState='';tracking=true;persistPending();}
    render();
   }});if(serial===jobSerial)mintedDone(result);
  }catch(err){
   if(disposed||serial!==jobSerial)return;
   if(err?.code==='submission_unknown'){mintInfo={unknown:true,account:err.account,record};mintAttached=true;persistPending();error='unknownHelp';}
   else if(mintInfo)confirmationError(err);else error=err?.code==='source_mismatch'?'mismatch':err?.code===4001?'rejected':err?.code==='no_wallet'?'noWallet':'mintError';
  }finally{notifyWallet();if(serial===jobSerial){if(!released){busy=false;mintState='';}tracking=false;mintController=null;if(!disposed){render();scheduleResume(15000);}}}
 }
 async function recheck(automatic=false){
  if(!mintInfo||busy||tracking||disposed)return;clearTimeout(resumeTimer);resumeTimer=0;
  if(mintInfo.unknown||mintInfo.manual){
   const hash=q('#kiln-tx-input').value.trim().toLowerCase();if(!nftTxUrl(hash)){error='unknownHelp';render();return;}
   // receipt事实只属于原hash；换交易后不能把旧成功、token或庆祝状态带入新tracker。
   if(hash!==(mintInfo.hash||'').toLowerCase()){
    const {progress:oldProgress,celebrated:oldCelebrated,...reference}=mintInfo;mintInfo=reference;
    mintProgress=null;mintPhase='pending';mintErrorKey='';clearCelebration();
   }
   mintInfo={...mintInfo,unknown:false,manual:true,hash,transactionHash:hash};persistPending();
  }
  if(automatic)resumeAttempts++;else resumeAttempts=0;
  tracking=true;mintErrorKey='';if(!mintProgress)mintPhase='restoring';mintController=new AbortController();const serial=++jobSerial,job=mintInfo,controller=mintController;render();
  try{const actual=await waitForNftMint(job.hash,job.account,job.record,{attempts:60,onProgress:(next,detail)=>{if(serial===jobSerial)onMintProgress(next,detail);},signal:controller.signal});if(serial===jobSerial)mintedDone(actual);}
  catch(err){if(!disposed&&serial===jobSerial)confirmationError(err);}
  finally{if(serial===jobSerial){tracking=false;mintController=null;if(!disposed){render();scheduleResume(15000);}}}
 }
 function online(){if(mintInfo&&!busy&&!tracking&&mintErrorKey!=='mintCheckFailed'){resumeAttempts=0;scheduleResume(100);}}
 function openPiece(record,actual=null){
  if(busy||state==='firing'||disposed)return false;
  if(!mintInfo){const saved=readPending();if(saved){mintInfo=saved;mintProgress=null;mintPhase='restoring';mintErrorKey='';if(saved.celebrated)celebrated.add(saved.hash);}}
  let clean=cleanPieceRecord(record);if(!clean)return false;
  mintAttached=!actual&&!!mintInfo&&encodePieceDesign(clean)===encodePieceDesign(mintInfo.record)&&(!clean.kiln||JSON.stringify(clean.kiln)===JSON.stringify(cleanPieceRecord(mintInfo.record)?.kiln));
  const candidate=mintAttached?mintInfo.record:record;clean=cleanPieceRecord(candidate);
  gen++;cancelAnimationFrame(raf);clearTimeout(resumeTimer);clearCelebration();raf=0;base={...candidate,...clean,profile:clean.profile.slice()};delete base.kiln;delete base.nft;minted=actual;sourceVerified=!!actual;error='';mintState='';compare=false;selected=actual?.kiln||(mintAttached?mintInfo.record.kiln:null);records=selected?[selected]:[];state=selected?'fired':'loading';proof=null;
  q('#kiln-tx-input').value=mintAttached?mintInfo.hash||'':'';q('.kiln-mint-sync-details').open=false;updateScene();render();
  if(actual||provisional())queueCelebrate(actual?.nft.transactionHash||mintInfo.hash);if(!selected)load();scheduleResume();return true;
 }
 window.addEventListener('online',online);
 q('.kiln-continue').addEventListener('click',()=>{if(!busy&&state!=='firing')onBack();});
 q('.kiln-background-pending').addEventListener('click',()=>{if(mintInfo)openPiece(mintInfo.record);else if(completedJob)openPiece(completedJob,completedJob);});
 q('.kiln-earlier').addEventListener('click',()=>{if(!locked()&&records.length&&BigInt(records.at(-1).round)>1n)load((BigInt(records.at(-1).round)-1n).toString());});
 q('.kiln-change-round').addEventListener('click',()=>{if(locked()||minted)return;state='ready';error='';compare=false;view?.setKilnReveal(0);render();});
 q('.kiln-back').addEventListener('click',()=>{if(!busy&&state!=='firing')onBack();});q('.kiln-refresh').addEventListener('click',()=>{if(!locked())load();});q('.kiln-fire').addEventListener('click',fire);q('.kiln-keep').addEventListener('click',()=>keep());q('.kiln-plain').addEventListener('click',()=>keep(true));q('.kiln-mint').addEventListener('click',mint);q('.kiln-recheck').addEventListener('click',()=>recheck(false));q('.kiln-reset').addEventListener('click',()=>view?.resetView());
 all('[data-kiln-compare]').forEach(button=>button.addEventListener('click',()=>{if(busy||state!=='fired')return;compare=button.dataset.kilnCompare==='before';view?.setKilnReveal(compare?0:1);render();}));
 q('#kiln-canvas').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();view?.orbitView(e.key==='ArrowLeft'?-.09:e.key==='ArrowRight'?.09:0,e.key==='ArrowUp'?.05:e.key==='ArrowDown'?-.05:0);});
 return {
  open(record){return openPiece(record);},
  resume(){const pending=mintInfo||readPending();return pending?openPiece(pending.record):false;},
  get hasPiece(){return !!base;},get isBusy(){return busy||state==='firing';},
  render,setVisible(value){const changed=visible!==!!value;visible=!!value;view?.setVisible(visible);if(!visible){cancelAnimationFrame(raf);clearTimeout(resumeTimer);resumeTimer=0;raf=0;lastFrame=0;}else{if(state==='firing'&&!raf)raf=requestAnimationFrame(tick);if(changed)scheduleResume();celebrate();}},
  dispose(){disposed=true;gen++;cancelAnimationFrame(raf);clearTimeout(resumeTimer);clearTimeout(celebrationTimer);mintController?.abort();window.removeEventListener('online',online);view?.dispose();}
 };
}
