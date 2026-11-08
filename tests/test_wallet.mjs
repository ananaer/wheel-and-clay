import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createWalletSession} from '../wallet.js';
const ACCOUNT='0x'+'12'.repeat(20),OTHER='0x'+'34'.repeat(20),SEPOLIA='0xaa36a7';
let total=0;
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
class WalletScope extends EventTarget{constructor(provider){super();this.ethereum=provider;const values=new Map();this.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};}}
class Provider extends EventEmitter{
 constructor(){super();this.calls=[];this.account=ACCOUNT;this.chain=SEPOLIA;this.handler=null;}
 async request(input){this.calls.push(input);if(this.handler){const result=this.handler(input);if(result!==undefined)return await result;}if(['eth_accounts','eth_requestAccounts'].includes(input.method))return this.account?[this.account]:[];if(input.method==='eth_chainId')return this.chain;if(input.method==='wallet_switchEthereumChain'){this.chain=input.params[0].chainId;this.emit('chainChanged',this.chain);return null;}throw Error('Unexpected method '+input.method);}
}
const announce=(scope,provider,id,name='Test Wallet')=>scope.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:{provider,info:{uuid:id,name,rdns:'test.wallet',icon:'data:image/svg+xml,<svg/>'}}}));
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
async function check(name,run){await run();total++;console.log('PASS '+name);}
function fixture(options={}){const provider=new Provider(),scope=new WalletScope(provider),session=createWalletSession({scope,restore:false,...options});return {provider,scope,session};}
await check('EIP6963发现优先、按会话去重、保持监听直到dispose',async()=>{
 const {provider,scope,session}=fixture(),second=new Provider();try{
  announce(scope,provider,ids[0],'First');announce(scope,provider,ids[0],'Duplicate');announce(scope,second,ids[1],'Second');
  assert.deepEqual(session.getSnapshot().providers.map(x=>x.name),['First','Second']);
  await assert.rejects(session.connect(),e=>e.code==='choose_wallet');assert.equal(provider.calls.length,0);
  await session.connect(ids[1]);assert.equal(session.getProvider(),second);assert.equal(provider.calls.length,0);
 }finally{session.dispose();}announce(scope,new Provider(),'33333333-3333-4333-8333-333333333333','Late');assert.equal(session.getSnapshot().providers.length,2);
});
await check('刷新只读已授权账户，不自动请求授权或切网络',async()=>{
 const provider=new Provider(),scope=new WalletScope(provider),session=createWalletSession({scope});try{await new Promise(r=>setTimeout(r,180));assert.equal(session.getSnapshot().account,ACCOUNT);assert.deepEqual(provider.calls.map(x=>x.method),['eth_accounts','eth_chainId']);}finally{session.dispose();}
});
await check('显式连接单飞，不切换错误网络、不签名或发送交易',async()=>{
 const {provider,session}=fixture(),gate=deferred();provider.chain='0x1';provider.handler=input=>input.method==='eth_requestAccounts'?gate.promise:undefined;
 try{const a=session.connect(),b=session.connect();assert.equal(a,b);await flush();gate.resolve([ACCOUNT]);await a;assert.equal(session.getSnapshot().connected,true);assert.equal(session.getSnapshot().correctChain,false);assert.deepEqual(provider.calls.map(x=>x.method),['eth_requestAccounts','eth_chainId']);}finally{session.dispose();}
});
await check('用户拒绝连接保持未连接，可再次明确发起',async()=>{
 const {provider,session}=fixture();provider.handler=input=>input.method==='eth_requestAccounts'?Promise.reject(Object.assign(Error('Rejected'),{code:4001})):undefined;
 try{await assert.rejects(session.connect(),e=>e.code===4001);assert.equal(session.getSnapshot().error,'rejected');assert.equal(session.getSnapshot().connected,false);assert.equal(session.getSnapshot().busy,'');provider.handler=null;await session.connect();assert.equal(session.getSnapshot().account,ACCOUNT);}finally{session.dispose();}
});
await check('迟到的静默账户查询不能覆盖随后显式连接',async()=>{
 const {provider,session}=fixture(),gate=deferred();try{await session.connect();provider.handler=input=>input.method==='eth_accounts'?gate.promise:undefined;const passive=session.refresh();session.disconnect();provider.account=OTHER;await session.connect();gate.resolve([ACCOUNT]);await passive;assert.equal(session.getSnapshot().account,OTHER);}finally{session.dispose();}
});
await check('accountsChanged与chainChanged立即更新；空账户使连接失效',async()=>{
 const {provider,session}=fixture();try{await session.connect();const requests=provider.calls.length;provider.emit('accountsChanged',[OTHER]);provider.emit('chainChanged','0x1');assert.equal(session.getSnapshot().account,OTHER);assert.equal(session.getSnapshot().correctChain,false);assert.equal(provider.calls.length,requests);provider.emit('accountsChanged',[]);assert.equal(session.getSnapshot().connected,false);}finally{session.dispose();}
});
await check('账户事件优先于较旧的连接返回值',async()=>{
 const {provider,session}=fixture(),gate=deferred();provider.handler=input=>input.method==='eth_requestAccounts'?gate.promise:undefined;
 try{const task=session.connect();await flush();provider.emit('accountsChanged',[OTHER]);gate.resolve([ACCOUNT]);await task;assert.equal(session.getSnapshot().account,OTHER);}finally{session.dispose();}
});
await check('本地断开后，迟到授权结果不恢复会话或触发交易',async()=>{
 const {provider,session,scope}=fixture(),gate=deferred();provider.handler=input=>input.method==='eth_requestAccounts'?gate.promise:undefined;
 try{const task=session.connect();await flush();session.disconnect();gate.resolve([ACCOUNT]);await assert.rejects(task,e=>e.code===4001);assert.equal(session.getSnapshot().connected,false);assert.equal(scope.localStorage.getItem('wheel-clay-wallet-detached'),'true');assert.equal(provider.listenerCount('accountsChanged'),0);assert.deepEqual(provider.calls.map(x=>x.method),['eth_requestAccounts']);}finally{session.dispose();}
});
await check('本地断开偏好跨刷新保留，不自动重新展示账户',async()=>{
 const provider=new Provider(),scope=new WalletScope(provider);scope.localStorage.setItem('wheel-clay-wallet-detached','true');const session=createWalletSession({scope});try{await new Promise(r=>setTimeout(r,180));assert.equal(provider.calls.length,0);assert.equal(session.getSnapshot().account,null);await session.connect();assert.equal(session.getSnapshot().connected,true);}finally{session.dispose();}
});
await check('钱包disconnect事件清除连接并阻止旧结果覆盖',async()=>{
 const {provider,session}=fixture(),gate=deferred();try{await session.connect();provider.handler=input=>input.method==='eth_accounts'?gate.promise:undefined;const refresh=session.refresh();provider.emit('disconnect',{code:1011});gate.resolve([ACCOUNT]);await refresh;assert.equal(session.getSnapshot().account,null);assert.equal(session.getSnapshot().error,'disconnected');}finally{session.dispose();}
});
await check('切换到Sepolia必须显式请求并核对钱包返回的真实网络',async()=>{
 const {provider,session}=fixture();provider.chain='0x1';try{await session.connect();assert.equal(provider.calls.some(x=>x.method==='wallet_switchEthereumChain'),false);assert.equal(await session.switchNetwork(),true);assert.equal(session.getSnapshot().correctChain,true);assert.deepEqual(provider.calls.find(x=>x.method==='wallet_switchEthereumChain').params,[{chainId:SEPOLIA}]);}finally{session.dispose();}
});
await check('钱包拒绝网络切换不伪报Sepolia已连接',async()=>{
 const {provider,session}=fixture();provider.chain='0x1';provider.handler=input=>input.method==='wallet_switchEthereumChain'?Promise.reject(Object.assign(Error('Rejected'),{code:4001})):undefined;try{await session.connect();assert.equal(await session.switchNetwork(),false);assert.equal(session.getSnapshot().correctChain,false);assert.equal(session.getSnapshot().chainId,'0x1');assert.equal(session.getSnapshot().error,'switch_rejected');}finally{session.dispose();}
});
await check('选择另一钱包后旧provider事件不污染当前账户',async()=>{
 const {provider,session,scope}=fixture(),second=new Provider();second.account=OTHER;announce(scope,provider,ids[0]);announce(scope,second,ids[1]);try{await session.connect(ids[0]);await session.connect(ids[1]);provider.emit('accountsChanged',[ACCOUNT]);provider.emit('chainChanged','0x1');assert.equal(session.getSnapshot().account,OTHER);assert.equal(session.getSnapshot().correctChain,true);assert.equal(provider.listenerCount('chainChanged'),0);}finally{session.dispose();}
});
await check('挂起请求有反馈，重试复用原请求，不重复弹授权',async()=>{
 const {provider,session}=fixture({requestTimeoutMs:15}),gate=deferred();provider.handler=input=>input.method==='eth_requestAccounts'?gate.promise:undefined;try{await assert.rejects(session.connect(),e=>e.code==='wallet_timeout');assert.equal(session.getSnapshot().error,'timeout');const retry=session.connect();gate.resolve([ACCOUNT]);await retry;assert.equal(provider.calls.filter(x=>x.method==='eth_requestAccounts').length,1);assert.equal(session.getSnapshot().account,ACCOUNT);}finally{session.dispose();}
});
await check('没有注入钱包时可安全返回，不猜测远程连接',async()=>{
 const scope=new WalletScope(null),session=createWalletSession({scope,restore:false});try{assert.equal(session.getSnapshot().providers.length,0);await assert.rejects(session.connect(),e=>e.code==='no_wallet');assert.equal(session.getSnapshot().connected,false);}finally{session.dispose();}
});
console.log(`RESULT ${total}/${total}`);
