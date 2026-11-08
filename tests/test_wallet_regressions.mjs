import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createWalletSession,createWalletControl} from '../wallet.js';
const A='0x'+'12'.repeat(20),B='0x'+'34'.repeat(20),CHAIN='0xaa36a7';
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
class Provider extends EventEmitter{
 constructor(account=A){super();this.account=account;this.calls=[];this.handler=null;}
 async request(input){this.calls.push(input.method);const result=this.handler?.(input);if(result!==undefined)return await result;if(['eth_accounts','eth_requestAccounts'].includes(input.method))return [this.account];if(input.method==='eth_chainId')return CHAIN;throw Error('Forbidden '+input.method);}
}
class Scope extends EventTarget{constructor(provider){super();this.ethereum=provider;const values=new Map();this.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};}}
class Element extends EventTarget{
 constructor(tag,doc){super();this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.children=[];this.dataset={};this.attributes={};this.classList={add(){}};}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=children;}
 setAttribute(key,value){this.attributes[key]=value;}
 removeAttribute(key){delete this.attributes[key];delete this[key];}
 focus(){this.ownerDocument.activeElement=this;}
 contains(target){return this===target||this.children.some(child=>child.contains(target));}
 querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
 querySelectorAll(selector){const matches=el=>selector==='button'?el.tagName==='BUTTON':selector.startsWith('.')?el.className===selector.slice(1):false;return this.children.flatMap(child=>[...(matches(child)?[child]:[]),...child.querySelectorAll(selector)]);}
 click(){if(!this.disabled)this.dispatchEvent(new Event('click'));}
}
class Doc extends EventTarget{createElement(tag){return new Element(tag,this);}}
const announce=(scope,provider,id)=>scope.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:{provider,info:{uuid:id,name:'Independent fixture',rdns:'review.test',icon:'never-loaded'}}}));
let pass=0,total=0;
async function check(name,fn){total++;try{await fn();pass++;console.log('PASS '+name);}catch(error){console.log('FAIL '+name+': '+error.message);}}
await check('out-of-order passive refresh cannot overwrite newer completed refresh',async()=>{
 const provider=new Provider(),scope=new Scope(provider),session=createWalletSession({scope,restore:false}),old=deferred(),fresh=deferred();
 try{await session.connect();let n=0;provider.handler=({method})=>method==='eth_accounts'?(++n===1?old.promise:fresh.promise):undefined;
  const one=session.refresh(),two=session.refresh();fresh.resolve([B]);await two;assert.equal(session.getSnapshot().account,B);
  old.resolve([A]);await one;assert.equal(session.getSnapshot().account,B);
 }finally{session.dispose();}
});
await check('late cancelled old wallet chooser cannot reject a newer wallet connection',async()=>{
 const first=new Provider(),second=new Provider(B),scope=new Scope(first),session=createWalletSession({scope,restore:false}),a=deferred(),b=deferred();
 first.handler=({method})=>method==='eth_requestAccounts'?a.promise:undefined;second.handler=({method})=>method==='eth_requestAccounts'?b.promise:undefined;
 announce(scope,first,ids[0]);announce(scope,second,ids[1]);const doc=new Doc(),root=new Element('div',doc),control=createWalletControl({root,scope,session});
 try{
  const earlier=control.connect().then(()=>({ok:true}),error=>({ok:false,code:error.code}));root.querySelectorAll('.wallet-option')[0].click();await flush();
  first.emit('disconnect',{code:1011});const esc=new Event('keydown');esc.key='Escape';esc.preventDefault=()=>{};doc.dispatchEvent(esc);assert.deepEqual(await earlier,{ok:false,code:4001});
  let settled=false;const later=control.connect().then(provider=>{settled=true;return {ok:true,provider};},error=>{settled=true;return {ok:false,code:error.code};});root.querySelectorAll('.wallet-option')[1].click();await flush();
  a.resolve([A]);await flush();const incorrectlySettled=settled;b.resolve([B]);const result=await later;await flush();
  assert.equal(incorrectlySettled,false,'older A cancellation settled the newer B caller');assert.equal(result.ok,true);assert.equal(result.provider,second);assert.equal(control.getState().account,B);
 }finally{a.resolve([A]);b.resolve([B]);control.dispose();}
});
console.log(`RESULT ${pass}/${total}`);if(pass!==total)process.exitCode=1;
