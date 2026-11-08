import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {nftAvailable,nftPieceUrl,verifyNftDeployment,decodeNftPiece,readNftPiece,encodeMintCall,mintedTokenFromReceipt,waitForNftMint,mintNft} from '../nft-client.js';
import {KILN_NETWORK,KILN_SELECTORS,kilnWord,kilnWords} from '../kiln-chain.js';
import {encodePieceDesign} from '../piece-link.js';
import {coreFixture,chainAbi,chainSetWord,CHAIN_DATA_HASH,CHAIN_BLOCK_HASH} from './test_kiln_chain.mjs';

// 所有钱包和 RPC 都是受控内存 fixture；不会签名、连接钱包或广播。
const NFT_TEST_ACCOUNT='0x1000000000000000000000000000000000000001';
const NFT_TEST_OTHER='0x2000000000000000000000000000000000000002';
const NFT_TEST_HASH='0x'+'33'.repeat(32),NFT_TEST_DESIGN_HASH='0x'+'44'.repeat(32),NFT_TEST_CODE='0x6001600055';
const NFT_TEST_TRANSFER='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const NFT_TEST_FIRED='0x966d2f0d7c7d94a8af4b43a2c97a1ab620892bb34d8b1e09b5e393ea73c92e2f';
let fixtureId=100;
function testRecord(){return {profile:Array.from({length:129},(_,index)=>.56+.43*Math.sin(Math.PI*index/128)),form:'vase',glaze:'turquoise',surface:'flow',finish:.82,hadSim:true,companionId:'8891',kiln:{version:1,chainId:'11155111',core:KILN_NETWORK.core,round:'40',work:'420',dataHash:CHAIN_DATA_HASH}};}
function pieceFixture(record,{maker=NFT_TEST_ACCOUNT,designHash=NFT_TEST_DESIGN_HASH}={}){
 const design=encodePieceDesign(record),kiln=record.kiln;
 return chainAbi(BigInt(maker),BigInt(kiln.round),BigInt(kiln.work),kiln.dataHash.slice(2),designHash.slice(2),BigInt(KILN_NETWORK.implementation),1n,256n,270n,...design.slice(2).padEnd(576,'0').match(/.{64}/g));
}
function receiptFixture(address,{account=NFT_TEST_ACCOUNT,hash=NFT_TEST_HASH,tokenId=7n,record=testRecord()}={}){
 const common={address,removed:false,transactionHash:hash,blockHash:CHAIN_BLOCK_HASH,blockNumber:'0x64',transactionIndex:'0x0'};
 return {transactionHash:hash,from:account,to:address,status:'0x1',blockHash:CHAIN_BLOCK_HASH,blockNumber:'0x64',transactionIndex:'0x0',logs:[
  {...common,logIndex:'0x0',topics:[NFT_TEST_TRANSFER,'0x'+'0'.repeat(64),'0x'+kilnWord(BigInt(account)),'0x'+kilnWord(tokenId)],data:'0x'},
  {...common,logIndex:'0x1',topics:[NFT_TEST_FIRED,'0x'+kilnWord(tokenId),'0x'+kilnWord(BigInt(account)),'0x'+kilnWord(record.kiln.round)],data:chainAbi(BigInt(record.kiln.work),NFT_TEST_DESIGN_HASH.slice(2))}
 ]};
}
function nftFixture(options={}){
 const config={chainId:'11155111',address:'0x'+(++fixtureId).toString(16).padStart(40,'0'),runtimeSha256:createHash('sha256').update(Buffer.from(NFT_TEST_CODE.slice(2),'hex')).digest('hex'),rendererVersion:1};
 const record=options.record??testRecord(),pieceData=pieceFixture(record),receipt=receiptFixture(config.address,{record}),core=coreFixture(options.core??{}),reads=[],walletCalls=[];
 let chain=options.walletChain??KILN_NETWORK.hexChainId;
 const request=async(method,params=[])=>{
  reads.push({method,params});if(options.readOverride){const answer=await options.readOverride(method,params);if(answer!==undefined)return answer;}
  if(method==='eth_getTransactionReceipt')return Object.hasOwn(options,'receipt')?options.receipt:receipt;
  if(method==='eth_getCode'&&params[0]===config.address)return options.code??NFT_TEST_CODE;
  if(method==='eth_call'&&params[0].to===config.address){
   const data=params[0].data;
   if(data===KILN_SELECTORS.core)return options.binding??chainAbi(BigInt(KILN_NETWORK.core));
   if(data.startsWith(KILN_SELECTORS.piece))return options.pieceData??pieceData;
   if(data.startsWith(KILN_SELECTORS.owner))return options.ownerData??chainAbi(BigInt(NFT_TEST_ACCOUNT));
  }
  return core.request(method,params);
 };
 const provider={async request(input){
  walletCalls.push(input);if(options.walletOverride){const answer=await options.walletOverride(input);if(answer!==undefined)return answer;}
  if(input.method==='eth_chainId')return chain;
  if(input.method==='wallet_switchEthereumChain'){if(options.switchWorks!==false)chain=KILN_NETWORK.hexChainId;return null;}
  if(input.method==='eth_requestAccounts'||input.method==='eth_accounts')return [NFT_TEST_ACCOUNT];
  if(input.method==='eth_call')return chainAbi(7n);
  if(input.method==='eth_estimateGas')return '0x80000';
  if(input.method==='eth_sendTransaction')return NFT_TEST_HASH;
  throw Error('Unexpected wallet request '+input.method);
 }};
 const mint=(extra={})=>mintNft(record,{provider,request,config,waitOptions:{attempts:1,delay:async()=>{}},...extra});
 const wait=(extra={})=>waitForNftMint(NFT_TEST_HASH,NFT_TEST_ACCOUNT,record,{request,config,attempts:1,delay:async()=>{},...extra});
 return {config,record,pieceData,receipt,options,core,reads,walletCalls,request,provider,mint,wait};
}
function sent(fixture){return fixture.walletCalls.filter(call=>call.method==='eth_sendTransaction');}
async function pending(promise,hash=NFT_TEST_HASH){
 let captured;await assert.rejects(promise,error=>{captured=error;return error.code==='pending'&&error.pending===true&&error.transactionHash===hash&&error.account===NFT_TEST_ACCOUNT;});return captured;
}
let total=0;const check=async(name,fn)=>{await fn();total++;console.log('PASS '+name);};

await check('部署可用性、token ID 与 Mint ABI 严格，设计编码可往返',async()=>{
 const fixture=nftFixture();assert.equal(nftAvailable(fixture.config),true);assert.equal(nftAvailable({...fixture.config,address:null}),false);assert.equal(nftAvailable({...fixture.config,rendererVersion:2}),false);
 const call=encodeMintCall(fixture.record);assert.ok(call.startsWith(KILN_SELECTORS.mint));const words=kilnWords('0x'+call.slice(10));assert.equal(words[0],kilnWord(96));assert.equal(words[1],kilnWord(40));assert.equal(words[2],kilnWord(420));assert.equal(words[3],kilnWord(270));
 assert.equal(encodePieceDesign(decodeNftPiece(fixture.pieceData)),encodePieceDesign(fixture.record));assert.ok(nftPieceUrl((1n<<256n)-1n).includes('nft='));
 for(const id of [0,-1,'01',1.5,1n<<256n])assert.throws(()=>nftPieceUrl(id));
});
await check('NFT decoder 拒绝偏移、版本、padding、零maker和来源字段污染',()=>{
 const fixture=nftFixture(),base=fixture.pieceData;
 for(const [index,value] of [[0,0n],[1,1n<<64n],[2,1n<<64n],[4,0n],[5,BigInt(NFT_TEST_OTHER)],[6,2n],[7,288n],[8,269n]])assert.throws(()=>decodeNftPiece(chainSetWord(base,index,value)));
 assert.throws(()=>decodeNftPiece(base.slice(0,-1)+'1'));assert.throws(()=>decodeNftPiece(base+'00'.repeat(32)));
 const zero={...fixture.record,kiln:{...fixture.record.kiln,work:'0'}};assert.throws(()=>decodeNftPiece(pieceFixture(zero)));assert.throws(()=>encodeMintCall(zero));
});
await check('部署校验核对网络、运行时代码、Core绑定，read不能跳过校验',async()=>{
 for(const options of [{code:'0x6000'},{binding:chainAbi(BigInt(NFT_TEST_OTHER))},{core:{chain:'0x1'}}]){
  const fixture=nftFixture(options);await assert.rejects(verifyNftDeployment(fixture.request,fixture.config));await assert.rejects(readNftPiece(7,{request:fixture.request,config:fixture.config,verified:true}));
 }
 const fixture=nftFixture();const piece=await readNftPiece(7,{request:fixture.request,config:fixture.config});assert.equal(piece.nft.owner,NFT_TEST_ACCOUNT);
 for(const {method,params} of fixture.reads)if(['eth_call','eth_getCode'].includes(method))assert.equal(params[1],'0x64');
});
await check('成功mint发送前核对真实来源，零value发送并严格验证确认回执和PieceFired',async()=>{
 const fixture=nftFixture(),states=[],actual=await fixture.mint({onState:(state,detail)=>states.push({state,detail})});
 assert.equal(sent(fixture).length,1);const tx=sent(fixture)[0].params[0];assert.equal(tx.value,'0x0');assert.equal(tx.chainId,KILN_NETWORK.hexChainId);assert.equal(tx.to,fixture.config.address);assert.equal(tx.from,NFT_TEST_ACCOUNT);assert.equal(tx.data,encodeMintCall(fixture.record));assert.equal(BigInt(tx.gas),524288n*12n/10n);
 assert.ok(fixture.core.calls.some(call=>call.params[0]?.data?.startsWith(KILN_SELECTORS.roundPage)));assert.ok(fixture.core.calls.some(call=>call.method==='eth_getStorageAt'));
 assert.equal(actual.nft.tokenId,'7');assert.equal(actual.nft.transactionHash,NFT_TEST_HASH);assert.equal(actual.maker,NFT_TEST_ACCOUNT);
 const state=states.find(value=>value.state==='pending');assert.equal(state.detail.hash,NFT_TEST_HASH);assert.equal(state.detail.account,NFT_TEST_ACCOUNT);
 assert.equal(fixture.walletCalls.some(call=>/sign|approve/i.test(call.method)),false);
});
await check('P1回归：同round/work伪造dataHash必须在钱包发送前拒绝',async()=>{
 for(const change of [{dataHash:'0x'+'99'.repeat(32)},{work:'419'}]){
  const record=testRecord();record.kiln={...record.kiln,...change};const fixture=nftFixture({record});
  await assert.rejects(fixture.mint(),error=>error.code==='source_mismatch');assert.equal(sent(fixture).length,0);assert.equal(fixture.walletCalls.some(call=>call.method==='eth_call'),false);
 }
 const record=testRecord();record.kiln.work='0';const fixture=nftFixture({record});await assert.rejects(fixture.mint());assert.equal(fixture.walletCalls.length,0);
});
await check('已认证零work零hash预览可以铸造，模拟/来源标签不会绕过链核验',async()=>{
 const record=testRecord();record.kiln={...record.kiln,work:'0',dataHash:'0x'+'00'.repeat(32)};const fixture=nftFixture({record,core:{work:0n}});const actual=await fixture.mint();assert.equal(actual.kiln.work,'0');assert.equal(sent(fixture).length,1);
 for(const hadSim of [true,false,null]){const forged=testRecord();forged.hadSim=hadSim;forged.kiln.dataHash='0x'+'55'.repeat(32);const test=nftFixture({record:forged});await assert.rejects(test.mint(),error=>error.code==='source_mismatch');assert.equal(sent(test).length,0);}
});
await check('钱包拒绝、切链拒绝和仍在错链均不广播',async()=>{
 for(const rejected of ['eth_requestAccounts','wallet_switchEthereumChain','eth_sendTransaction']){
  const fixture=nftFixture({walletChain:rejected==='wallet_switchEthereumChain'?'0x1':KILN_NETWORK.hexChainId,walletOverride({method}){if(method===rejected)throw Object.assign(Error('User rejected'),{code:4001});}});
  await assert.rejects(fixture.mint(),error=>error.code===4001);assert.equal(sent(fixture).length,rejected==='eth_sendTransaction'?1:0);
 }
 const wrong=nftFixture({walletChain:'0x1',switchWorks:false});await assert.rejects(wrong.mint(),/Sepolia/);assert.equal(sent(wrong).length,0);
 const missing=nftFixture();await assert.rejects(mintNft(missing.record,{provider:null,config:missing.config}),error=>error.code==='no_wallet');
});
await check('钱包账户/网络变化或异常gas估算在发送前停止',async()=>{
 for(const options of [
  {walletOverride({method}){if(method==='eth_accounts')return [NFT_TEST_OTHER];}},
  {walletOverride({method}){if(method==='eth_estimateGas')return '0x0';}},
  {walletOverride({method}){if(method==='eth_estimateGas')return '0x2dc6c1';}}
 ]){const fixture=nftFixture(options);await assert.rejects(fixture.mint());assert.equal(sent(fixture).length,0);}
 let estimated=false;const changed=nftFixture({walletOverride({method}){if(method==='eth_estimateGas')estimated=true;if(method==='eth_chainId'&&estimated)return '0x1';}});await assert.rejects(changed.mint(),/Wallet changed/);assert.equal(sent(changed).length,0);
});
await check('未知/升级/代码变化/离线Core不能用前端自报来源铸造',async()=>{
 for(const core of [{slot:chainAbi(BigInt(NFT_TEST_OTHER))},{code:'0x6000'},{latest:39n},{override(method){if(method==='eth_getStorageAt')throw Error('offline');}}]){
  const fixture=nftFixture({core});await assert.rejects(fixture.mint());assert.equal(sent(fixture).length,0);
 }
});
await check('回执与日志必须属于请求的hash/account/contract/block，异常保持可恢复',async()=>{
 const mutations=[
  receipt=>{receipt.transactionHash='0x'+'88'.repeat(32);},receipt=>{receipt.from=NFT_TEST_OTHER;},receipt=>{receipt.to=NFT_TEST_OTHER;},receipt=>{receipt.status='0x2';},receipt=>{receipt.blockHash='0x'+'88'.repeat(32);},receipt=>{receipt.transactionIndex='0x00';},
  receipt=>{receipt.logs[0].transactionHash='0x'+'88'.repeat(32);},receipt=>{receipt.logs[0].blockHash='0x'+'88'.repeat(32);},receipt=>{receipt.logs[0].blockNumber='0x63';},receipt=>{receipt.logs[0].transactionIndex='0x1';},receipt=>{receipt.logs[0].removed=true;},receipt=>{receipt.logs[0].topics[2]='0x'+kilnWord(BigInt(NFT_TEST_OTHER));}
 ];
 for(const mutate of mutations){const fixture=nftFixture();mutate(fixture.receipt);const error=await pending(fixture.wait());assert.equal(error.contract,fixture.config.address);}
});
await check('唯一Transfer与PieceFired互相核对，重复/缺失/伪造事件不能宣布成功',async()=>{
 for(const mutate of [
  r=>r.logs.push({...r.logs[0],logIndex:'0x2'}),r=>r.logs.splice(1,1),r=>{r.logs[1].data=chainAbi(419n,NFT_TEST_DESIGN_HASH.slice(2));},r=>{r.logs[1].topics[3]='0x'+kilnWord(41);},r=>{r.logs[0].topics[3]='0x'+kilnWord(0);}
 ]){const fixture=nftFixture();mutate(fixture.receipt);await pending(fixture.wait());}
 const fixture=nftFixture();assert.equal(mintedTokenFromReceipt(fixture.receipt,NFT_TEST_ACCOUNT,fixture.config.address,NFT_TEST_HASH),'7');
});
await check('只有身份及规范区块确认后的回滚才返回reverted并解除pending',async()=>{
 const fixture=nftFixture();fixture.receipt.status='0x0';fixture.receipt.logs=[];
 await assert.rejects(fixture.wait(),error=>error.code==='reverted'&&error.pending===false&&error.transactionHash===NFT_TEST_HASH&&error.account===NFT_TEST_ACCOUNT);
 fixture.receipt.from=NFT_TEST_OTHER;await pending(fixture.wait());
 const unconfirmed=nftFixture({core:{tip:'0x6f'}});unconfirmed.receipt.status='0x0';unconfirmed.receipt.logs=[];await pending(unconfirmed.wait());
});
await check('未出回执、未够12块及超时均保留hash/account，不读取未确认的piece',async()=>{
 for(const options of [{receipt:null},{core:{tip:'0x6f'}}]){
  const fixture=nftFixture(options),error=await pending(fixture.wait());assert.equal(error.reason,'confirmation_timeout');assert.equal(fixture.reads.some(r=>r.params[0]?.data?.startsWith(KILN_SELECTORS.piece)),false);
 }
 const fixture=nftFixture();await pending(fixture.wait({attempts:0}));
});
await check('广播后的RPC故障与onState异常均返回原交易引用，重查不重复send',async()=>{
 let offline=true;const fixture=nftFixture({readOverride(method){if(method==='eth_getTransactionReceipt'&&offline)throw Error('RPC offline');}});
 const error=await pending(fixture.mint());assert.equal(error.hash,NFT_TEST_HASH);assert.equal(sent(fixture).length,1);offline=false;
 const actual=await fixture.mint();assert.equal(actual.nft.transactionHash,NFT_TEST_HASH);assert.equal(sent(fixture).length,1);
 const callback=nftFixture();await pending(callback.mint({onState(state){if(state==='pending')throw Error('UI failed');}}));assert.equal(sent(callback).length,1);await callback.mint();assert.equal(sent(callback).length,1);
});
await check('存储设计/来源与冻结预览不符时保留交易，不诱导再铸造',async()=>{
 for(const change of [record=>{record.profile[32]=.24;},record=>{record.kiln.dataHash='0x'+'55'.repeat(32);},record=>{record.kiln.work='419';}]){
  const fixture=nftFixture(),actual=testRecord();change(actual);fixture.options.pieceData=pieceFixture(actual);const error=await pending(fixture.mint());assert.match(error.cause.message,/differs from the preview/);assert.equal(sent(fixture).length,1);
 }
 const outage=nftFixture({readOverride(method,params){if(method==='eth_call'&&params[0].data.startsWith(KILN_SELECTORS.piece))throw Error('temporary archive failure');}});await pending(outage.mint());assert.equal(sent(outage).length,1);
});
await check('异步钱包等待期间修改外部record不会替换已冻结设计或链上来源',async()=>{
 const record=testRecord(),original=encodeMintCall(record);const fixture=nftFixture({record,walletOverride({method}){if(method==='eth_estimateGas'){record.profile[30]=.24;record.kiln.dataHash='0x'+'55'.repeat(32);}}});
 const actual=await fixture.mint();assert.equal(sent(fixture)[0].params[0].data,original);assert.equal(actual.kiln.dataHash,CHAIN_DATA_HASH);assert.notEqual(encodePieceDesign(actual),encodePieceDesign(record));
});
await check('同一作品并发Mint共享一次广播，未部署配置不会请求钱包',async()=>{
 const fixture=nftFixture(),[a,b]=await Promise.all([fixture.mint(),fixture.mint()]);assert.equal(a.nft.tokenId,b.nft.tokenId);assert.equal(sent(fixture).length,1);
 const disabled=nftFixture();await assert.rejects(disabled.mint({config:{...disabled.config,address:null}}),error=>error.code==='not_deployed');assert.equal(disabled.walletCalls.length,0);
});
await check('读取NFT的零owner、脏address字和区块重组均不展示作品',async()=>{
 for(const ownerData of [chainAbi(0n),chainAbi(1n<<160n),chainAbi(BigInt(NFT_TEST_ACCOUNT),0n)]){
  const fixture=nftFixture({ownerData});await assert.rejects(readNftPiece(7,{request:fixture.request,config:fixture.config}));
 }
 let count=0;const fixture=nftFixture({readOverride(method,params){if(method==='eth_getBlockByNumber'&&++count===2)return {number:params[0],hash:'0x'+'88'.repeat(32)};}});await assert.rejects(readNftPiece(7,{request:fixture.request,config:fixture.config}),/block changed/);
});
console.log(`RESULT ${total}/${total}`);
