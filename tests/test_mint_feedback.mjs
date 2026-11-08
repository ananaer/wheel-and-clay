import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cleanPieceRecord,encodePieceDesign} from '../piece-link.js';
import {kilnRecipe} from '../kiln-art.js';
import {nftAvailable,nftTxUrl,nftPieceUrl} from '../nft-client.js';

// 合成 DOM 验证状态机，不冒充真实浏览器或钱包测试；没有网络、签名或广播。
const account='0x1000000000000000000000000000000000000001',hash='0x'+'ab'.repeat(32);
const record={profile:Array.from({length:129},(_,i)=>.55+.3*Math.sin(i/128*Math.PI)),form:'vase',glaze:'turquoise',surface:'glossy',finish:.72,hadSim:true,companionId:'8889',kiln:{version:1,chainId:'11155111',core:'0xfd6c166d4b8e2962e65746a13e5a0797cd4de0c4',round:'646',work:'514',dataHash:'0x'+'cd'.repeat(32)}};
const actual={...record,maker:account,nft:{chainId:'11155111',contract:'0xf83b2c5dc0650ccfb0a621b68c9bbbbdf35f0cc9',tokenId:'2',owner:account,transactionHash:hash}};
const nextRecord={...record,profile:record.profile.map(r=>r*.9),glaze:'amethyst',kiln:{...record.kiln,round:'700',work:'100'}};
const progress=(changes={})=>({transactionHash:hash,hash,account,contract:actual.nft.contract,chainId:'11155111',stage:'included',lastObservedStage:'included',tokenId:'2',confirmedBlocks:0,requiredDepth:12,blockNumber:'100',blockHash:'0x'+'12'.repeat(32),receiptVerified:true,...changes});
const raw=await readFile(new URL('../kiln-view.js',import.meta.url),'utf8');
const code=raw.replace(/^import .*;\n/gm,'');
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
class Element{
 constructor(){this.textContent='';this.hidden=false;this.disabled=false;this.open=false;this.value='';this.dataset={};this.attrs={};this.events={};this.children=[];this.addCounts=new Map();this.style={setProperty:(k,v)=>{this.attrs[k]=v;}};const set=new Set();this.classList={add:(...xs)=>{for(const x of xs){set.add(x);this.addCounts.set(x,(this.addCounts.get(x)||0)+1);}},remove:(...xs)=>xs.forEach(x=>set.delete(x)),contains:x=>set.has(x)};}
 setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];}addEventListener(k,fn){this.events[k]=fn;}replaceChildren(){this.children=[];}append(...nodes){this.children.push(...nodes);}focus(){this.focused=true;}
}
let serial=0;
async function fixture({pending=null,mintImpl,waitImpl,loadImpl,keepImpl,connectWallet,getWalletProvider,onWalletChange}={}){
 const map=new Map(),timers=new Map(),storage=new Map(),listeners=new Map();let timerId=0,mintCalls=0,waitCalls=0,kept=null,backCalls=0,walletRefreshes=0,lastProfile=null;const mintArgs=[],waitArgs=[];
 const q=s=>{if(!map.has(s))map.set(s,new Element());return map.get(s);};
 const root=new Element();root.querySelector=q;root.querySelectorAll=s=>s==='[data-kiln-compare]'?['before','after'].map(value=>{const el=q('compare-'+value);el.dataset.kilnCompare=value;return el;}):[];
 if(pending)storage.set('wheel-clay-pending-mint-v1',JSON.stringify(pending));
 const originals={document:globalThis.document,window:globalThis.window,localStorage:globalThis.localStorage,matchMedia:globalThis.matchMedia,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
 Object.assign(globalThis,{document:{createElement:()=>new Element()},window:{addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key)},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},matchMedia:()=>({matches:true}),requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)});
 globalThis.__mintUiDeps={cleanPieceRecord,encodePieceDesign,kilnRecipe,nftAvailable,nftTxUrl,nftPieceUrl,KILN_NETWORK:{},kilnSourceUrl:()=> 'https://example.test/source',loadKilnRounds:loadImpl||(async()=>({records:[record.kiln],blockNumber:'100'})),mintNft:async(r,options)=>{mintCalls++;mintArgs.push([r,options]);if(mintImpl)return mintImpl(r,options);options.onState?.('pending',{hash,account});return actual;},waitForNftMint:async(h,a,r,options)=>{waitCalls++;waitArgs.push([h,a,r,options]);return waitImpl?waitImpl(h,a,r,options):actual;}};
 const {createKilnView}=await import('data:text/javascript;base64,'+Buffer.from('const {cleanPieceRecord,encodePieceDesign,kilnRecipe,nftAvailable,nftTxUrl,nftPieceUrl,KILN_NETWORK,kilnSourceUrl,loadKilnRounds,mintNft,waitForNftMint}=globalThis.__mintUiDeps;\n'+code+'\n//'+serial++).toString('base64'));
 const studio={setPhase(){},setRpm(){},setVisible(){},setProfile(value){lastProfile=value.slice();},setGlaze(){},setSurface(){},setFinish(){},setKiln(){},setKilnReveal(){},resetView(){},orbitView(){},capture:()=> 'data:image/png;base64,AA==',dispose(){}};
 const ui=createKilnView({root,createStudio(_canvas,options){Promise.resolve().then(options.onReady);return studio;},onKeep:async(...args)=>{kept=args;return keepImpl?keepImpl(...args):true;},onBack:()=>{backCalls++;},...(connectWallet?{connectWallet}:{}),...(getWalletProvider?{getWalletProvider}:{}),onWalletChange:()=>{walletRefreshes++;return onWalletChange?.();}});
 const click=async selector=>{const el=q(selector);assert.equal(el.disabled,false,'button disabled: '+selector);const promise=el.events.click?.();await flush();return {promise};};
 const runTimer=async ms=>{const entry=[...timers].find(([,v])=>v.ms===ms);assert.ok(entry,'timer '+ms+' missing');timers.delete(entry[0]);entry[1].fn();await flush();};
 return {ui,root,q,storage,timers,listeners,click,runTimer,mintArgs,waitArgs,get mintCalls(){return mintCalls;},get waitCalls(){return waitCalls;},get kept(){return kept;},get backCalls(){return backCalls;},get walletRefreshes(){return walletRefreshes;},get lastProfile(){return lastProfile;},get celebrations(){return root.addCounts.get('kiln-mint-celebrate')||0;},get pending(){return JSON.parse(storage.get('wheel-clay-pending-mint-v1')||'null');},async ready(){ui.open(record);ui.setVisible(true);await flush();await click('.kiln-fire');},dispose(){ui.dispose();Object.assign(globalThis,originals);delete globalThis.__mintUiDeps;}};
}
const successVisible=f=>!f.q('.kiln-piece-stamp').hidden;
const noTrustedNft=f=>assert.equal(f.q('.kiln-nft-link').hidden,true);
let passed=0;
async function check(name,fn){await fn();passed++;console.log('PASS '+name);}

await check('只返回hash立即反馈已提交，不声称铸造完成或播放柔光',async()=>{
 const gate=deferred();const f=await fixture({mintImpl:async(_,o)=>{o.onState('pending',{hash,account});return gate.promise;}});
 try{await f.ready();await f.click('.kiln-mint');assert.match(f.q('#kiln-mint-heading').textContent,/Transaction submitted/i);assert.equal(successVisible(f),false);assert.equal(f.celebrations,0);noTrustedNft(f);assert.equal(f.pending.hash,hash);assert.equal(f.q('.kiln-tx').href,nftTxUrl(hash));assert.equal(f.ui.isBusy,false);assert.equal(f.q('.kiln-back').disabled,false);assert.equal(f.q('.kiln-keep').disabled,false);assert.equal(f.q('.kiln-mint').disabled,true);assert.equal(f.q('.kiln-mint-sync-details').open,false);await f.q('.kiln-mint').events.click();await flush();assert.equal(f.mintCalls,1);}finally{f.dispose();}
});
await check('0个后继块即临时成功，本机分享不冒充已核验NFT',async()=>{
 const gate=deferred();let options;const f=await fixture({mintImpl:async(_,o)=>{options=o;o.onState('pending',{hash,account});return gate.promise;}});
 try{await f.ready();await f.click('.kiln-mint');options.onProgress('included',progress());assert.equal(successVisible(f),true);assert.match(f.q('.kiln-mint-status-kicker').textContent+' '+f.q('#kiln-mint-heading').textContent,/Mint complete/i);assert.equal(f.celebrations,1);assert.equal(f.ui.isBusy,false);assert.equal(f.q('.kiln-finished-actions').hidden,false);assert.equal(f.q('.kiln-continue').hidden,false);noTrustedNft(f);assert.equal(f.pending.hash,hash);await f.click('.kiln-keep');assert.equal(f.kept[0].nft,undefined);assert.deepEqual(f.kept[2],{verifiedKiln:true,verifiedNft:false});await f.click('.kiln-continue');assert.equal(f.backCalls,1);assert.equal(f.pending.hash,hash);}finally{f.dispose();}
});
await check('未经receipt身份核验的included不能给作品盖成功章',async()=>{
 const gate=deferred();let options;const f=await fixture({mintImpl:async(_,o)=>{options=o;o.onState('pending',{hash,account});return gate.promise;}});
 try{await f.ready();await f.click('.kiln-mint');options.onProgress('included',progress({receiptVerified:false}));assert.equal(successVisible(f),false);assert.equal(f.celebrations,0);noTrustedNft(f);}finally{f.dispose();}
});
await check('最终actual才给NFT链接并清pending，重复回调和最终核验只庆祝一次',async()=>{
 const gate=deferred();let options;const f=await fixture({mintImpl:async(_,o)=>{options=o;o.onState('pending',{hash,account});return gate.promise;}});
 try{await f.ready();await f.click('.kiln-mint');options.onProgress('included',progress());options.onProgress('included',progress({confirmedBlocks:4}));await f.runTimer(2600);f.ui.render();f.ui.setVisible(false);f.ui.setVisible(true);options.onProgress('verified',progress({stage:'verified',confirmedBlocks:12}));noTrustedNft(f);assert.equal(f.pending.hash,hash);gate.resolve(actual);await flush();assert.equal(f.q('.kiln-nft-link').hidden,false);assert.equal(f.q('.kiln-nft-link').href,nftPieceUrl('2','en'));assert.equal(f.pending,null);assert.equal(f.celebrations,1);assert.equal(f.root.classList.contains('kiln-mint-celebrate'),false);await f.click('.kiln-keep');assert.equal(f.kept[0].nft.tokenId,'2');assert.deepEqual(f.kept[2],{verifiedKiln:true,verifiedNft:true});}finally{f.dispose();}
});
await check('旧pending自动恢复只查原交易，后台不busy且重复显示不重复启动',async()=>{
 const gate=deferred();const f=await fixture({pending:{hash,account,record},waitImpl:()=>gate.promise});
 try{f.ui.resume();f.ui.setVisible(true);f.ui.setVisible(true);await f.runTimer(500);assert.equal(f.waitCalls,1);assert.equal(f.mintCalls,0);assert.equal(f.ui.isBusy,false);assert.equal(f.q('.kiln-back').disabled,false);f.ui.setVisible(true);f.ui.resume();await flush();assert.equal(f.waitCalls,1);assert.equal(f.waitArgs[0][0],hash);assert.equal(f.waitArgs[0][1],account);gate.resolve(actual);await flush();assert.equal(f.q('.kiln-nft-link').hidden,false);assert.equal(f.mintCalls,0);}finally{f.dispose();}
});
await check('RPC短断保留已成功事实，耗尽后保留hash并只读恢复',async()=>{
 let count=0;const f=await fixture({pending:{hash,account,record},waitImpl:async(_h,_a,_r,o)=>{if(++count===1){o.onProgress('included',progress({confirmedBlocks:5}));o.onProgress('retrying',progress({confirmedBlocks:5,retryCount:1,maxNetworkRetries:3}));throw Object.assign(Error('offline'),{code:'pending',reason:'network_retry_exhausted'});}return actual;}});
 try{f.ui.resume();f.ui.setVisible(true);await f.runTimer(500);assert.equal(f.ui.isBusy,false);assert.equal(f.pending.hash,hash);assert.equal(successVisible(f),true);assert.match(f.q('.kiln-mint-status-help').textContent,/succeeded|complete|sync|verif/i);assert.equal(f.q('.kiln-mint').disabled,true);assert.equal(f.celebrations,1);await f.runTimer(15000);assert.equal(f.waitCalls,2);assert.equal(f.mintCalls,0);assert.equal(f.q('.kiln-nft-link').hidden,false);assert.equal(f.celebrations,1);}finally{f.dispose();}
});
await check('receipt消失撤销临时成功，网络重试不能复活旧receipt',async()=>{
 const gate=deferred();let options;const f=await fixture({mintImpl:async(_,o)=>{options=o;o.onState('pending',{hash,account});return gate.promise;}});
 try{await f.ready();await f.click('.kiln-mint');options.onProgress('included',progress());assert.equal(successVisible(f),true);const lost=progress({stage:'submitted',receiptVerified:false,tokenId:null,confirmedBlocks:0,blockNumber:null,blockHash:null,reason:'receipt_unavailable'});options.onProgress('pending',lost);assert.equal(successVisible(f),false);assert.equal(f.root.classList.contains('kiln-mint-celebrate'),false);noTrustedNft(f);options.onProgress('retrying',lost);assert.equal(successVisible(f),false);assert.match(f.q('#kiln-mint-heading').textContent,/submitted/i);assert.equal(f.pending.hash,hash);options.onProgress('included',progress());assert.equal(successVisible(f),true);assert.equal(f.celebrations,1);}finally{f.dispose();}
});
await check('verification_failed清临时成功并保留防重复锁定，无自动重试',async()=>{
 const gate=deferred();let options;const f=await fixture({pending:{hash,account,record},waitImpl:(_h,_a,_r,o)=>{options=o;return gate.promise;}});
 try{f.ui.resume();f.ui.setVisible(true);await f.runTimer(500);options.onProgress('included',progress());options.onProgress('verification_failed',progress({receiptVerified:false}));gate.reject(Object.assign(Error('mismatch'),{code:'pending',reason:'verification_failed'}));await flush();assert.match(f.q('#kiln-mint-heading').textContent,/needs a check/);assert.equal(successVisible(f),false);assert.equal(f.root.classList.contains('kiln-mint-celebrate'),false);assert.equal(f.q('.kiln-mint').disabled,true);assert.equal(f.ui.isBusy,false);assert.equal([...f.timers.values()].some(x=>x.ms===15000),false);assert.equal(f.pending.hash,hash);noTrustedNft(f);}finally{f.dispose();}
});
await check('reverted立即撤销临时成功，保留交易失败反馈且清pending',async()=>{
 const gate=deferred();let options;const f=await fixture({mintImpl:async(_,o)=>{options=o;o.onState('pending',{hash,account});return gate.promise;}});
 try{await f.ready();await f.click('.kiln-mint');options.onProgress('included',progress());options.onProgress('reverted',progress({receiptVerified:false}));assert.equal(successVisible(f),false);gate.reject(Object.assign(Error('reverted'),{code:'reverted'}));await flush();assert.equal(successVisible(f),false);assert.equal(f.root.classList.contains('kiln-mint-celebrate'),false);assert.equal(f.pending,null);assert.equal(f.ui.isBusy,false);assert.match(f.q('.kiln-feedback').textContent,/did not complete|revert|failed/i);noTrustedNft(f);}finally{f.dispose();}
});
await check('未返回hash不声称已提交，手动错误hash仍可纠正而不广播',async()=>{
 let count=0;const f=await fixture({pending:{unknown:true,account,record},waitImpl:async()=>{if(++count===1)throw Object.assign(Error('wrong hash'),{code:'pending',reason:'verification_failed'});return actual;}});
 try{f.ui.resume();f.ui.setVisible(true);assert.equal(f.q('.kiln-mint-status').hidden,true);assert.equal(f.q('.kiln-hash-entry').hidden,false);assert.equal(successVisible(f),false);f.q('#kiln-tx-input').value=hash;await f.click('.kiln-recheck');assert.equal(f.q('.kiln-hash-entry').hidden,false);assert.equal(f.waitCalls,1);f.q('#kiln-tx-input').value='0x'+'ef'.repeat(32);await f.click('.kiln-recheck');assert.equal(f.waitCalls,2);assert.equal(f.q('.kiln-nft-link').hidden,false);assert.equal(f.mintCalls,0);}finally{f.dispose();}
});
await check('离页后旧job不覆盖新作品，返回pending不重发交易',async()=>{
 const gate=deferred();let options,loads=0;const f=await fixture({mintImpl:async(_,o)=>{options=o;o.onState('pending',{hash,account});return gate.promise;},loadImpl:async()=>({records:[++loads===1?record.kiln:nextRecord.kiln],blockNumber:'101'})});
 try{await f.ready();await f.click('.kiln-mint');options.onProgress('included',progress());await f.click('.kiln-continue');f.ui.setVisible(false);assert.equal(f.ui.open(nextRecord),true);f.ui.setVisible(true);await flush();await f.click('.kiln-fire');assert.equal(f.root.dataset.round,'700');const newProfile=f.lastProfile.slice();options.onProgress('verifying',progress({stage:'verifying',confirmedBlocks:12}));assert.equal(f.root.dataset.round,'700');assert.equal(successVisible(f),false);gate.resolve(actual);await flush();assert.equal(f.root.dataset.round,'700');assert.deepEqual(f.lastProfile,newProfile);noTrustedNft(f);assert.equal(f.q('.kiln-background-pending').hidden,false);await f.click('.kiln-background-pending');await flush();assert.equal(f.root.dataset.round,'646');assert.equal(f.q('.kiln-nft-link').hidden,false);assert.equal(f.mintCalls,1);assert.equal(f.celebrations,1);}finally{f.dispose();}
});
await check('隐藏时receipt不抢焦点，回来仅播放一次且最终resolve不重播',async()=>{
 const gate=deferred();let options;const f=await fixture({pending:{hash,account,record},waitImpl:(_h,_a,_r,o)=>{options=o;return gate.promise;}});
 try{f.ui.resume();f.ui.setVisible(true);await f.runTimer(500);f.ui.setVisible(false);options.onProgress('included',progress());assert.equal(f.celebrations,0);assert.equal(f.q('#kiln-mint-heading').focused,undefined);f.ui.setVisible(true);assert.equal(f.celebrations,1);await f.runTimer(2600);gate.resolve(actual);await flush();f.ui.render();f.ui.setVisible(false);f.ui.setVisible(true);assert.equal(f.celebrations,1);assert.equal(f.root.classList.contains('kiln-mint-celebrate'),false);}finally{f.dispose();}
});
await check('dispose中断后台跟踪，晚到结果不能显示成功',async()=>{
 const gate=deferred();let signal,options;const f=await fixture({pending:{hash,account,record},waitImpl:(_h,_a,_r,o)=>{signal=o.signal;options=o;return gate.promise;}});
 try{f.ui.resume();f.ui.setVisible(true);await f.runTimer(500);f.ui.dispose();assert.equal(signal.aborted,true);options.onProgress('included',progress());gate.resolve(actual);await flush();noTrustedNft(f);assert.equal(f.celebrations,0);}finally{f.dispose();}
});
await check('恢复pending使旧轮次请求失效，迟到load不能覆盖器形来源',async()=>{
 const old=deferred();const f=await fixture({loadImpl:()=>old.promise});
 try{f.ui.open(record);await flush();f.storage.set('wheel-clay-pending-mint-v1',JSON.stringify({hash,account,record}));f.ui.resume();assert.equal(f.root.dataset.round,'646');old.resolve({records:[nextRecord.kiln],blockNumber:'200'});await flush();assert.equal(f.root.dataset.round,'646');assert.equal(f.root.dataset.kilnState,'fired');}finally{f.dispose();}
});
await check('钱包选择得到的provider传给mint，finally刷新header',async()=>{
 const provider={request(){throw Error('fixture must not call wallet');}};let connects=0;const f=await fixture({connectWallet:async()=>{connects++;return provider;},getWalletProvider:()=>({wrong:true})});
 try{await f.ready();assert.equal(connects,0);await f.click('.kiln-mint');assert.equal(connects,1);assert.equal(f.mintCalls,1);assert.equal(f.mintArgs[0][1].provider,provider);assert.ok(f.walletRefreshes>=1);assert.equal(f.q('.kiln-nft-link').hidden,false);}finally{f.dispose();}
});
await check('取消钱包选择4001不调用mint，解除busy并刷新header',async()=>{
 const f=await fixture({connectWallet:async()=>{throw Object.assign(Error('cancelled'),{code:4001});}});
 try{await f.ready();await f.click('.kiln-mint');assert.equal(f.mintCalls,0);assert.equal(f.pending,null);assert.equal(f.ui.isBusy,false);assert.ok(f.walletRefreshes>=1);assert.match(f.q('.kiln-feedback').textContent,/cancelled/i);assert.equal(successVisible(f),false);assert.equal(f.celebrations,0);}finally{f.dispose();}
});
await check('未提供连接回调时使用getWalletProvider，钱包刷新异常不改写成功',async()=>{
 const provider={name:'chosen wallet'};const f=await fixture({getWalletProvider:()=>provider,onWalletChange:()=>{throw Error('header observer error');}});
 try{await f.ready();const {promise}=await f.click('.kiln-mint');await promise;assert.equal(f.mintArgs[0][1].provider,provider);assert.equal(f.q('.kiln-nft-link').hidden,false);assert.equal(f.ui.isBusy,false);assert.equal(f.pending,null);}finally{f.dispose();}
});
await check('异步header刷新拒绝被隔离，不形成unhandled rejection或改写成功',async()=>{
 const unhandled=[];const observe=error=>unhandled.push(error);process.on('unhandledRejection',observe);
 const f=await fixture({onWalletChange:async()=>{throw Error('async header observer error');}});
 try{await f.ready();await f.click('.kiln-mint');await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(unhandled,[]);assert.equal(f.q('.kiln-nft-link').hidden,false);assert.equal(f.ui.isBusy,false);}finally{f.dispose();process.removeListener('unhandledRejection',observe);}
});
await check('重新启动只读tracker遇RPC短断不撤回此前成功事实',async()=>{
 const gate=deferred();let attempts=0,options;const f=await fixture({pending:{hash,account,record},waitImpl:async(_h,_a,_r,o)=>{if(++attempts===1){o.onProgress('included',progress());throw Object.assign(Error('offline'),{code:'pending',reason:'network_retry_exhausted'});}options=o;o.onProgress('pending',progress({stage:'submitted',receiptVerified:false,tokenId:null,confirmedBlocks:0,blockNumber:null,blockHash:null}));return gate.promise;}});
 try{f.ui.resume();f.ui.setVisible(true);await f.runTimer(500);assert.equal(successVisible(f),true);await f.runTimer(15000);assert.equal(successVisible(f),true);options.onProgress('retrying',progress({stage:'submitted',receiptVerified:false,tokenId:null,confirmedBlocks:0,blockNumber:null,blockHash:null,retryCount:1,maxRetries:3}));assert.equal(successVisible(f),true);options.onProgress('pending',progress({stage:'submitted',receiptVerified:false,tokenId:null,confirmedBlocks:0,blockNumber:null,blockHash:null,reason:'network_retry_exhausted'}));assert.equal(successVisible(f),true);assert.equal(f.celebrations,1);noTrustedNft(f);assert.equal(f.pending.hash,hash);assert.equal(f.mintCalls,0);options.onProgress('pending',progress({stage:'submitted',receiptVerified:false,tokenId:null,confirmedBlocks:0,blockNumber:null,blockHash:null,reason:'awaiting_receipt'}));assert.equal(successVisible(f),false);}finally{f.dispose();}
});
await check('已持久化庆祝记录恢复后不重播柔光',async()=>{
 const gate=deferred();let options;const f=await fixture({pending:{hash,account,record,celebrated:true},waitImpl:(_h,_a,_r,o)=>{options=o;return gate.promise;}});
 try{f.ui.resume();f.ui.setVisible(true);await f.runTimer(500);options.onProgress('included',progress());assert.equal(successVisible(f),true);assert.equal(f.celebrations,0);gate.resolve(actual);await flush();assert.equal(f.q('.kiln-nft-link').hidden,false);assert.equal(f.celebrations,0);}finally{f.dispose();}
});
await check('保存本机作品期间后台核验完成，不解除保存busy或抹去saving',async()=>{
 const mintGate=deferred(),keepGate=deferred();let options;const f=await fixture({mintImpl:async(_,o)=>{options=o;o.onState('pending',{hash,account});return mintGate.promise;},keepImpl:()=>keepGate.promise});
 try{await f.ready();await f.click('.kiln-mint');options.onProgress('included',progress());await f.click('.kiln-keep');assert.equal(f.ui.isBusy,true);assert.equal(f.kept[0].nft,undefined);assert.equal(f.kept[2].verifiedNft,false);assert.match(f.q('.kiln-feedback').textContent,/Making your keepsake/);mintGate.resolve(actual);await flush();assert.equal(f.ui.isBusy,true);assert.equal(f.q('.kiln-keep').disabled,true);assert.equal(f.q('.kiln-back').disabled,true);assert.match(f.q('.kiln-feedback').textContent,/Making your keepsake/);assert.equal(f.q('.kiln-nft-link').hidden,false);keepGate.resolve(true);await flush();assert.equal(f.ui.isBusy,false);assert.equal(f.q('.kiln-keep').disabled,false);assert.equal(f.q('.kiln-back').disabled,false);assert.doesNotMatch(f.q('.kiln-feedback').textContent,/Making your keepsake/);}finally{f.dispose();}
});
await check('手动hash从A改成B先撤销A的receipt事实，B网络异常不能继承成功',async()=>{
 const otherHash='0x'+'ef'.repeat(32);let reads=0;
 const f=await fixture({pending:{hash,account,record,manual:true},waitImpl:async(h,_a,_r,o)=>{
  reads++;
  if(h===hash)o.onProgress('included',progress({hash:h,transactionHash:h}));
  else{
   const unknown=progress({hash:h,transactionHash:h,stage:'submitted',lastObservedStage:'submitted',receiptVerified:false,tokenId:null,confirmedBlocks:0,blockNumber:null,blockHash:null});
   o.onProgress('pending',unknown);o.onProgress('retrying',{...unknown,retryCount:1,maxRetries:3});o.onProgress('retrying',{...unknown,retryCount:2,maxRetries:3});
  }
  throw Object.assign(Error('network unavailable'),{code:'pending',reason:'network_retry_exhausted'});
 }});
 try{
  f.ui.resume();f.ui.setVisible(true);await f.click('.kiln-recheck');assert.equal(successVisible(f),true);assert.equal(f.pending.hash,hash);assert.equal(f.pending.progress.tokenId,'2');assert.equal(f.celebrations,1);
  f.q('#kiln-tx-input').value=otherHash;await f.click('.kiln-recheck');assert.equal(f.pending.hash,otherHash);assert.equal(f.q('.kiln-tx').href,nftTxUrl(otherHash));assert.equal(successVisible(f),false);assert.equal(f.root.classList.contains('kiln-mint-celebrate'),false);assert.notEqual(f.pending.progress?.receiptVerified,true);assert.notEqual(f.pending.progress?.tokenId,'2');assert.notEqual(f.pending.celebrated,true);assert.doesNotMatch(f.q('.kiln-mint-status-network').textContent,/NFT #2/);assert.equal(f.q('.kiln-confirmation-caption strong').textContent,'0 / 12');assert.equal(f.celebrations,1);noTrustedNft(f);
  // 切回确实已庆祝过的A，重新查到有效receipt也不重播；清B状态不能清全局历史。
  f.q('#kiln-tx-input').value=hash;await f.click('.kiln-recheck');assert.equal(successVisible(f),true);assert.equal(f.celebrations,1);assert.equal(f.pending.hash,hash);assert.equal(reads,3);assert.equal(f.mintCalls,0);
 }finally{f.dispose();}
});
await check('localStorage恢复的合法但假来源可收藏，不授予任何链上核验标志',async()=>{
 const unverified={...record,kiln:{...record.kiln,work:'999',dataHash:'0x'+'ef'.repeat(32)}},gate=deferred();let sourceReads=0;
 const f=await fixture({pending:{hash,account,record:unverified},waitImpl:()=>gate.promise,loadImpl:async()=>{sourceReads++;throw Error('no successful source read');}});
 try{
  f.ui.resume();f.ui.setVisible(true);await f.runTimer(500);assert.equal(f.ui.isBusy,false);assert.equal(f.q('.kiln-keep').disabled,false);await f.click('.kiln-keep');assert.equal(f.kept[0].kiln.work,'999');assert.equal(f.kept[0].kiln.dataHash,unverified.kiln.dataHash);assert.equal(f.kept[0].nft,undefined);assert.deepEqual(f.kept[2],{verifiedKiln:false,verifiedNft:false});assert.equal(sourceReads,0);assert.equal(f.waitCalls,1);assert.equal(f.mintCalls,0);assert.equal(f.pending.hash,hash);noTrustedNft(f);
 }finally{f.dispose();}
});
console.log(`RESULT ${passed}/${passed}`);
