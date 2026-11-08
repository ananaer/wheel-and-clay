import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cleanPieceRecord} from '../piece-link.js';
import {kilnRecipe} from '../kiln-art.js';
import {nftAvailable,nftTxUrl,nftPieceUrl} from '../nft-client.js';

// 合成 DOM 验证状态机，不冒充真实浏览器或钱包测试；没有网络、签名或广播。
const account='0x1000000000000000000000000000000000000001',hash='0x'+'ab'.repeat(32);
const record={profile:Array.from({length:129},(_,i)=>.55+.3*Math.sin(i/128*Math.PI)),form:'vase',glaze:'turquoise',surface:'glossy',finish:.72,hadSim:true,companionId:'8889',kiln:{version:1,chainId:'11155111',core:'0xfd6c166d4b8e2962e65746a13e5a0797cd4de0c4',round:'646',work:'514',dataHash:'0x'+'cd'.repeat(32)}};
const actual={...record,maker:account,nft:{chainId:'11155111',contract:'0xf83b2c5dc0650ccfb0a621b68c9bbbbdf35f0cc9',tokenId:'2',owner:account,transactionHash:hash}};
const raw=await readFile(new URL('../kiln-view.js',import.meta.url),'utf8');
const code=raw.replace(/^import .*;\n/gm,'');
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
class Element{
 constructor(){this.textContent='';this.hidden=false;this.disabled=false;this.value='';this.dataset={};this.attrs={};this.events={};this.children=[];this.style={setProperty:(k,v)=>{this.attrs[k]=v;}};const set=new Set();this.classList={add:x=>set.add(x),remove:x=>set.delete(x),contains:x=>set.has(x)};}
 setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];}addEventListener(k,fn){this.events[k]=fn;}replaceChildren(){this.children=[];}append(...nodes){this.children.push(...nodes);}focus(){this.focused=true;}
}
let serial=0;
async function fixture({pending=null,mintImpl,waitImpl,loadImpl}={}){
 const map=new Map(),timers=new Map(),storage=new Map(),listeners=new Map();let timerId=0,mintCalls=0,waitCalls=0,kept=null;
 const q=s=>{if(!map.has(s))map.set(s,new Element());return map.get(s);};
 const root=new Element();root.querySelector=q;root.querySelectorAll=s=>s==='[data-kiln-compare]'?['before','after'].map(value=>{const el=q('compare-'+value);el.dataset.kilnCompare=value;return el;}):[];
 if(pending)storage.set('wheel-clay-pending-mint-v1',JSON.stringify(pending));
 const originals={document:globalThis.document,window:globalThis.window,localStorage:globalThis.localStorage,matchMedia:globalThis.matchMedia,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
 Object.assign(globalThis,{document:{createElement:()=>new Element()},window:{addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key)},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},matchMedia:()=>({matches:true}),requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)});
 globalThis.__mintUiDeps={cleanPieceRecord,kilnRecipe,nftAvailable,nftTxUrl,nftPieceUrl,KILN_NETWORK:{},kilnSourceUrl:()=> 'https://example.test/source',loadKilnRounds:loadImpl||(async()=>({records:[record.kiln],blockNumber:'100'})),mintNft:async(r,options)=>{mintCalls++;return mintImpl?mintImpl(r,options):actual;},waitForNftMint:async(h,a,r,options)=>{waitCalls++;return waitImpl?waitImpl(h,a,r,options):actual;}};
 const {createKilnView}=await import('data:text/javascript;base64,'+Buffer.from('const {cleanPieceRecord,kilnRecipe,nftAvailable,nftTxUrl,nftPieceUrl,KILN_NETWORK,kilnSourceUrl,loadKilnRounds,mintNft,waitForNftMint}=globalThis.__mintUiDeps;\n'+code+'\n//'+serial++).toString('base64'));
 const studio={setPhase(){},setRpm(){},setVisible(){},setProfile(){},setGlaze(){},setSurface(){},setFinish(){},setKiln(){},setKilnReveal(){},resetView(){},orbitView(){},capture:()=> 'data:image/png;base64,AA==',dispose(){}};
 const ui=createKilnView({root,createStudio(_canvas,options){Promise.resolve().then(options.onReady);return studio;},onKeep:async(...args)=>{kept=args;return true;}});
 const click=async selector=>{const el=q(selector);assert.equal(el.disabled,false,'button disabled: '+selector);const promise=el.events.click?.();await flush();return {promise};};
 const runTimer=async ms=>{const entry=[...timers].find(([,v])=>v.ms===ms);assert.ok(entry,'timer '+ms+' missing');timers.delete(entry[0]);entry[1].fn();await flush();};
 return {ui,root,q,storage,timers,listeners,click,runTimer,get mintCalls(){return mintCalls;},get waitCalls(){return waitCalls;},get kept(){return kept;},async ready(){ui.open(record);ui.setVisible(true);await flush();await click('.kiln-fire');},dispose(){ui.dispose();Object.assign(globalThis,originals);delete globalThis.__mintUiDeps;}};
}
let passed=0;
async function check(name,fn){await fn();passed++;console.log('PASS '+name);}

await check('交易已上链显示计数，只有完整resolve才展示成功与NFT链接',async()=>{
 const gate=deferred();let options;const f=await fixture({mintImpl:async(_,o)=>{options=o;o.onState('pending',{hash,account});return gate.promise;}});
 try{await f.ready();await f.click('.kiln-mint');options.onProgress('included',{stage:'included',tokenId:'2',confirmedBlocks:3});
  assert.match(f.q('#kiln-mint-heading').textContent,/onchain/);assert.equal(f.q('.kiln-confirmation-caption strong').textContent,'3 / 12');assert.equal(f.q('.kiln-nft-link').hidden,true);
  options.onProgress('verified',{stage:'verified',tokenId:'2',confirmedBlocks:12});assert.equal(f.q('.kiln-piece-stamp').hidden,true);
  gate.resolve(actual);await flush();assert.equal(f.q('#kiln-mint-heading').textContent,'NFT #2');assert.equal(f.q('.kiln-nft-link').hidden,false);assert.equal(f.root.classList.contains('kiln-mint-celebrate'),true);assert.equal(f.storage.has('wheel-clay-pending-mint-v1'),false);
  await f.click('.kiln-keep');assert.equal(f.kept[0].nft.tokenId,'2');assert.deepEqual(f.kept[2],{verifiedKiln:true,verifiedNft:true});
 }finally{f.dispose();}
});
await check('旧版pending自动恢复只查原交易，不广播；多次显示不重复启动',async()=>{
 const gate=deferred();const f=await fixture({pending:{hash,account,record},waitImpl:()=>gate.promise});
 try{f.ui.resume();f.ui.setVisible(true);f.ui.setVisible(true);await f.runTimer(500);assert.equal(f.waitCalls,1);assert.equal(f.mintCalls,0);f.ui.setVisible(true);assert.equal(f.waitCalls,1);gate.resolve(actual);await flush();assert.equal(f.q('#kiln-mint-heading').textContent,'NFT #2');assert.equal(f.mintCalls,0);}finally{f.dispose();}
});
await check('网络耗尽后解除busy、保留原hash并自动只读恢复',async()=>{
 let count=0;const f=await fixture({pending:{hash,account,record},waitImpl:async(_h,_a,_r,o)=>{if(++count===1){o.onProgress('included',{stage:'included',tokenId:'2',confirmedBlocks:5});throw Object.assign(Error('offline'),{code:'pending',reason:'network_retry_exhausted'});}return actual;}});
 try{f.ui.resume();f.ui.setVisible(true);await f.runTimer(500);assert.equal(f.ui.isBusy,false);assert.equal(JSON.parse(f.storage.get('wheel-clay-pending-mint-v1')).hash,hash);assert.match(f.q('.kiln-mint-status-help').textContent,/succeeded/);assert.equal(f.q('.kiln-mint').disabled,true);await f.runTimer(15000);assert.equal(f.waitCalls,2);assert.equal(f.mintCalls,0);assert.equal(f.q('.kiln-nft-link').hidden,false);}finally{f.dispose();}
});
await check('来源或作品不符保持锁定，不自动重试或播放成功',async()=>{
 const f=await fixture({pending:{hash,account,record},waitImpl:async()=>{throw Object.assign(Error('mismatch'),{code:'pending',reason:'verification_failed'});}});
 try{f.ui.resume();f.ui.setVisible(true);await f.runTimer(500);assert.match(f.q('#kiln-mint-heading').textContent,/needs a check/);assert.equal(f.q('.kiln-mint').disabled,true);assert.equal(f.root.classList.contains('kiln-mint-celebrate'),false);assert.equal([...f.timers.values()].some(x=>x.ms===15000),false);assert.equal(f.storage.has('wheel-clay-pending-mint-v1'),true);}finally{f.dispose();}
});
await check('未返回hash不声称已经发送，手动输入错误hash后仍可纠正',async()=>{
 let count=0;const f=await fixture({pending:{unknown:true,account,record},waitImpl:async()=>{if(++count===1)throw Object.assign(Error('wrong hash'),{code:'pending',reason:'verification_failed'});return actual;}});
 try{f.ui.resume();f.ui.setVisible(true);assert.equal(f.q('.kiln-mint-status').hidden,true);assert.equal(f.q('.kiln-hash-entry').hidden,false);f.q('#kiln-tx-input').value=hash;await f.click('.kiln-recheck');assert.equal(f.q('.kiln-hash-entry').hidden,false);assert.equal(f.waitCalls,1);f.q('#kiln-tx-input').value='0x'+'ef'.repeat(32);await f.click('.kiln-recheck');assert.equal(f.waitCalls,2);assert.equal(f.q('.kiln-nft-link').hidden,false);assert.equal(f.mintCalls,0);}finally{f.dispose();}
});
await check('后台确认不抢焦点，回到页面播放一次，render不重播',async()=>{
 const gate=deferred();const f=await fixture({pending:{hash,account,record},waitImpl:()=>gate.promise});
 try{f.ui.resume();f.ui.setVisible(true);await f.runTimer(500);f.ui.setVisible(false);gate.resolve(actual);await flush();assert.equal(f.root.classList.contains('kiln-mint-celebrate'),false);assert.equal(f.q('#kiln-mint-heading').focused,undefined);f.ui.setVisible(true);assert.equal(f.root.classList.contains('kiln-mint-celebrate'),true);await f.runTimer(2600);f.ui.render();f.ui.setVisible(true);assert.equal(f.root.classList.contains('kiln-mint-celebrate'),false);}finally{f.dispose();}
});
await check('dispose中断跟踪，晚到结果不能显示成功',async()=>{
 const gate=deferred();let signal;const f=await fixture({pending:{hash,account,record},waitImpl:(_h,_a,_r,o)=>{signal=o.signal;return gate.promise;}});
 try{f.ui.resume();f.ui.setVisible(true);await f.runTimer(500);f.ui.dispose();assert.equal(signal.aborted,true);gate.resolve(actual);await flush();assert.equal(f.q('.kiln-nft-link').hidden,true);assert.equal(f.root.classList.contains('kiln-mint-celebrate'),false);}finally{f.dispose();}
});
await check('恢复pending使旧轮次请求失效，迟到load不能覆盖器形来源',async()=>{
 const old=deferred();const f=await fixture({loadImpl:()=>old.promise});
 try{f.ui.open(record);await flush();f.storage.set('wheel-clay-pending-mint-v1',JSON.stringify({hash,account,record}));f.ui.open(record);assert.equal(f.root.dataset.round,'646');old.resolve({records:[{...record.kiln,round:'700'}],blockNumber:'200'});await flush();assert.equal(f.root.dataset.round,'646');assert.equal(f.root.dataset.kilnState,'fired');}finally{f.dispose();}
});
console.log(`RESULT ${passed}/${passed}`);
