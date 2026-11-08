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
 const record=options.record??testRecord(),pieceData=pieceFixture(record),receipt=receiptFixture(config.address,{record}),transaction={hash:NFT_TEST_HASH,from:NFT_TEST_ACCOUNT,to:config.address,value:'0x0',chainId:KILN_NETWORK.hexChainId,input:(()=>{try{return encodeMintCall(record);}catch{return '0x';}})(),blockNumber:'0x64',blockHash:CHAIN_BLOCK_HASH,transactionIndex:'0x0'},core=coreFixture(options.core??{}),reads=[],walletCalls=[];
 let chain=options.walletChain??KILN_NETWORK.hexChainId;
 const request=async(method,params=[])=>{
  reads.push({method,params});if(options.readOverride){const answer=await options.readOverride(method,params);if(answer!==undefined)return answer;}
  if(method==='eth_getTransactionReceipt')return Object.hasOwn(options,'receipt')?options.receipt:receipt;
  if(method==='eth_getTransactionByHash')return Object.hasOwn(options,'transaction')?options.transaction:transaction;
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
 return {config,record,pieceData,receipt,transaction,options,core,reads,walletCalls,request,provider,mint,wait};
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
await check('身份及规范区块通过的status0尽早返回reverted，不必等待12块',async()=>{
 const fixture=nftFixture();fixture.receipt.status='0x0';fixture.receipt.logs=[];
 await assert.rejects(fixture.wait(),error=>error.code==='reverted'&&error.pending===false&&error.transactionHash===NFT_TEST_HASH&&error.account===NFT_TEST_ACCOUNT);
 fixture.receipt.from=NFT_TEST_OTHER;await pending(fixture.wait());
 const unconfirmed=nftFixture({core:{tip:'0x64'}});unconfirmed.receipt.status='0x0';unconfirmed.receipt.logs=[];await assert.rejects(unconfirmed.wait(),error=>error.code==='reverted'&&error.stage==='reverted');
});
await check('未出回执、未够12块及超时均保留hash/account，不读取未确认的piece',async()=>{
 for(const options of [{receipt:null},{core:{tip:'0x6f'}}]){
  const fixture=nftFixture(options),error=await pending(fixture.wait());assert.equal(error.reason,'confirmation_timeout');assert.equal(fixture.reads.some(r=>r.params[0]?.data?.startsWith(KILN_SELECTORS.piece)),false);
 }
 const fixture=nftFixture();await pending(fixture.wait({attempts:0}));
});
await check('广播后RPC故障保存引用，onState异常不影响成功，重查不重复send',async()=>{
 let offline=true;const fixture=nftFixture({readOverride(method){if(method==='eth_getTransactionReceipt'&&offline)throw Error('RPC offline');}});
 const error=await pending(fixture.mint());assert.equal(error.hash,NFT_TEST_HASH);assert.equal(sent(fixture).length,1);offline=false;
 const actual=await fixture.mint();assert.equal(actual.nft.transactionHash,NFT_TEST_HASH);assert.equal(sent(fixture).length,1);
 const callback=nftFixture();const result=await callback.mint({onState(state){if(state==='pending')throw Error('UI failed');}});assert.equal(result.nft.tokenId,'7');assert.equal(sent(callback).length,1);
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
await check('已上链立即显示included，0/3/11/12后继块推进后才verifying和verified',async()=>{
 const tips=[100n,103n,111n,112n],events=[];let index=0;
 const fixture=nftFixture({readOverride(method){if(method==='eth_blockNumber')return '0x'+tips[index++].toString(16);}});
 const result=await fixture.wait({attempts:4,onProgress:(state,detail)=>events.push({state,...detail})});assert.equal(result.nft.tokenId,'7');
 const counts=events.filter(event=>event.state==='included').map(event=>event.confirmedBlocks);assert.deepEqual([...new Set(counts)],[0,3,11,12]);
 const verifyIndex=events.findIndex(event=>event.state==='verifying'),twelveIndex=events.findIndex(event=>event.state==='included'&&event.confirmedBlocks===12);assert.ok(verifyIndex>twelveIndex);
 assert.equal(events.at(-1).state,'verified');assert.equal(events.filter(event=>event.state==='verified').length,1);
 for(const event of events){assert.equal(event.transactionHash,NFT_TEST_HASH);assert.equal(event.account,NFT_TEST_ACCOUNT);assert.equal(event.contract,fixture.config.address);assert.equal(event.requiredDepth,12);assert.ok(event.confirmedBlocks<=12);}
});
await check('短暂RPC异常有限重试后继续同一交易成功，不重复广播',async()=>{
 let failures=0;const delays=[],events=[],fixture=nftFixture({readOverride(method){if(method==='eth_getTransactionReceipt'&&failures++===0)throw Error('temporary RPC outage');}});
 const result=await fixture.mint({waitOptions:{attempts:3,delay:async ms=>delays.push(ms)},onProgress:(state,detail)=>events.push({state,...detail})});
 assert.equal(result.nft.tokenId,'7');assert.equal(sent(fixture).length,1);assert.deepEqual(delays,[1500]);assert.equal(events.filter(event=>event.state==='retrying').length,1);assert.equal(events.at(-1).state,'verified');
 assert.ok(fixture.reads.filter(read=>read.method==='eth_getTransactionReceipt').every(read=>read.params[0]===NFT_TEST_HASH));
});
await check('已包含或校验中断网时保留阶段，恢复后完成，不把断网当成verify失败',async()=>{
 for(const stage of ['included','verifying']){
  let failed=false;const events=[],fixture=nftFixture({readOverride(method,params){const target=stage==='included'?method==='eth_blockNumber':method==='eth_call'&&params[0].data.startsWith(KILN_SELECTORS.piece);if(target&&!failed){failed=true;throw Error('transient archive outage');}}});
  await fixture.wait({attempts:3,onProgress:(state,detail)=>events.push({state,...detail})});
  const retry=events.find(event=>event.state==='retrying');assert.equal(retry.stage,stage);assert.equal(retry.tokenId,'7');assert.equal(retry.blockNumber,'0x64');assert.equal(events.some(event=>event.state==='verification_failed'),false);assert.equal(events.at(-1).state,'verified');
 }
});
await check('连续RPC失败有明确次数和退避上限，最终pending仍保存已观察到的token',async()=>{
 const delays=[],events=[];let receiptReads=0;
 const fixture=nftFixture({readOverride(method){if(method==='eth_blockNumber')throw Error('tip unavailable');if(method==='eth_getTransactionReceipt')receiptReads++;}});
 const error=await pending(fixture.wait({attempts:10,maxRpcRetries:2,retryDelayMs:5,delay:async ms=>delays.push(ms),onProgress:(state,detail)=>events.push({state,...detail})}));
 assert.equal(receiptReads,3);assert.deepEqual(delays,[5,10]);assert.equal(error.reason,'network_retry_exhausted');assert.equal(error.stage,'included');assert.equal(error.lastObservedStage,'included');assert.equal(error.tokenId,'7');assert.equal(error.confirmedBlocks,0);
 assert.deepEqual(events.filter(event=>event.state==='retrying').map(event=>event.retryCount),[1,2]);assert.equal(error.retryCount,2);assert.equal(error.maxRetries,2);assert.equal(events.some(event=>event.state==='verified'),false);
});
await check('无效日志不报告included，设计不符报告verification_failed且保持禁止再广播',async()=>{
 const invalid=nftFixture(),badEvents=[];invalid.receipt.logs[0].removed=true;
 const bad=await pending(invalid.wait({attempts:5,onProgress:(state,detail)=>badEvents.push({state,...detail})}));assert.equal(bad.reason,'verification_failed');assert.equal(badEvents.some(event=>event.state==='included'),false);assert.equal(badEvents.some(event=>event.state==='retrying'),false);
 const fixture=nftFixture(),changed=testRecord(),events=[];changed.profile[20]=.24;fixture.options.pieceData=pieceFixture(changed);
 const error=await pending(fixture.mint({onProgress:(state,detail)=>events.push({state,...detail})}));assert.equal(error.reason,'verification_failed');assert.equal(error.stage,'verifying');assert.equal(error.confirmedBlocks,12);assert.equal(events.at(-1).state,'verification_failed');assert.equal(events.some(event=>event.state==='verified'),false);
 await pending(fixture.mint());assert.equal(sent(fixture).length,1);fixture.options.pieceData=fixture.pieceData;await fixture.mint();assert.equal(sent(fixture).length,1);
});
await check('同步throw、异步reject或修改progress对象均不能改写成功或制造unhandled rejection',async()=>{
 const unhandled=[],handler=error=>unhandled.push(error);process.on('unhandledRejection',handler);
 try{
  const fixture=nftFixture(),states=[];
  const result=await fixture.mint({onState:async()=>{throw Error('async UI failure');},onProgress(state,detail){states.push(state);assert.ok(Object.isFrozen(detail));if(state==='included')return Promise.reject(Error('async progress failure'));if(state==='verified')detail.transactionHash='0x'+'99'.repeat(32);throw Error('sync progress failure');}});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(result.nft.transactionHash,NFT_TEST_HASH);assert.equal(result.nft.tokenId,'7');assert.ok(states.includes('included'));assert.equal(states.at(-1),'verified');assert.deepEqual(unhandled,[]);assert.equal(sent(fixture).length,1);
 }finally{process.removeListener('unhandledRejection',handler);}
});
await check('abort已包含交易时保存进度，暂停恢复查询不会重新发交易',async()=>{
 const controller=new AbortController(),events=[],fixture=nftFixture({core:{tip:'0x67'}});
 const error=await pending(fixture.mint({signal:controller.signal,waitOptions:{attempts:3,delay:async()=>controller.abort()},onProgress:(state,detail)=>events.push({state,...detail})}));
 assert.equal(error.reason,'aborted');assert.equal(error.stage,'included');assert.equal(error.tokenId,'7');assert.equal(error.confirmedBlocks,3);assert.equal(events.at(-1).state,'aborted');assert.equal(sent(fixture).length,1);
 fixture.options.core.tip='0x70';const resumed=await fixture.mint();assert.equal(resumed.nft.tokenId,'7');assert.equal(sent(fixture).length,1);
});
await check('abort终止无响应RPC，晚到响应不能触发verified或遗失交易引用',async()=>{
 const fixture=nftFixture(),controller=new AbortController(),events=[];let lateResolve,childAborted=false;
 const request=(method,params,options)=>{
  if(method==='eth_getTransactionReceipt')return new Promise(resolve=>{lateResolve=resolve;options.signal.addEventListener('abort',()=>{childAborted=true;});queueMicrotask(()=>controller.abort());});
  return fixture.request(method,params);
 };
 const error=await pending(fixture.wait({request,signal:controller.signal,requestTimeoutMs:100,onProgress:(state,detail)=>events.push({state,...detail})}));assert.equal(error.reason,'aborted');assert.equal(childAborted,true);
 lateResolve(fixture.receipt);await new Promise(resolve=>setImmediate(resolve));assert.equal(events.some(event=>event.state==='verified'),false);assert.equal(events.at(-1).state,'aborted');
 const initial=new AbortController();initial.abort();const before=fixture.reads.length;await pending(fixture.wait({signal:initial.signal}));assert.equal(fixture.reads.length,before);
});
await check('单次RPC有独立超时，即使request不响应也不会永久busy',async()=>{
 const fixture=nftFixture();let childAborted=false;
 const request=(method,params,options)=>method==='eth_getTransactionReceipt'?new Promise(()=>options.signal.addEventListener('abort',()=>{childAborted=true;})):fixture.request(method,params);
 const error=await pending(fixture.wait({request,requestTimeoutMs:5,maxRpcRetries:0}));assert.equal(error.reason,'network_retry_exhausted');assert.equal(error.stage,'submitted');assert.equal(childAborted,true);
});
await check('广播后立即导航abort仍保留hash，观察器不改变早期revert结果',async()=>{
 const controller=new AbortController(),fixture=nftFixture();const error=await pending(fixture.mint({signal:controller.signal,onState(state){if(state==='pending')controller.abort();}}));assert.equal(error.reason,'aborted');assert.equal(sent(fixture).length,1);await fixture.mint();assert.equal(sent(fixture).length,1);
 const reverted=nftFixture({core:{tip:'0x64'}}),states=[];reverted.receipt.status='0x0';reverted.receipt.logs=[];
 await assert.rejects(reverted.wait({onProgress(state){states.push(state);throw Error('observer error');}}),error=>error.code==='reverted'&&error.stage==='reverted'&&error.pending===false);assert.equal(states.at(-1),'reverted');assert.equal(reverted.reads.some(read=>read.method==='eth_blockNumber'),false);
});
await check('12块后仍需最终规范区块和作品校验，重组不能宣告verified',async()=>{
 let headers=0;const events=[],fixture=nftFixture({readOverride(method,params){if(method==='eth_getBlockByNumber'&&++headers===2)return {number:params[0],hash:'0x'+'99'.repeat(32)};}});
 const error=await pending(fixture.wait({onProgress:(state,detail)=>events.push({state,...detail})}));assert.equal(error.reason,'verification_failed');assert.equal(error.stage,'verifying');assert.equal(error.confirmedBlocks,12);assert.ok(events.some(event=>event.state==='included'));assert.equal(events.some(event=>event.state==='verified'),false);
 const deep=nftFixture({core:{tip:'0x1000'}}),deepEvents=[];await deep.wait({onProgress:(state,detail)=>deepEvents.push({state,...detail})});assert.equal(deepEvents.at(-1).confirmedBlocks,12);assert.equal(deepEvents.at(-1).state,'verified');
});
await check('已包含回执消失时清空当前阶段，网络重试不能复活旧token和确认数',async()=>{
 let receipts=0,tips=0;const events=[],fixture=nftFixture({readOverride(method){
  if(method==='eth_getTransactionReceipt'){receipts++;if(receipts===2)return null;if(receipts===3)throw Error('RPC unavailable after receipt disappeared');}
  if(method==='eth_blockNumber')return ['0x67','0x6f','0x70'][tips++];
 }});
 const result=await fixture.wait({attempts:5,onProgress:(state,detail)=>events.push({state,...detail})});assert.equal(result.nft.tokenId,'7');
 const disappearedIndex=events.findIndex(event=>event.reason==='receipt_unavailable'),retryIndex=events.findIndex(event=>event.state==='retrying');assert.ok(disappearedIndex>0&&retryIndex>disappearedIndex);
 for(const event of [events[disappearedIndex],events[retryIndex]]){assert.equal(event.stage,'submitted');assert.equal(event.tokenId,null);assert.equal(event.confirmedBlocks,0);assert.equal(event.blockNumber,null);assert.equal(event.blockHash,null);assert.equal(event.lastObservedStage,'included');}
 assert.equal(events.slice(0,retryIndex+1).some(event=>event.state==='verified'),false);
 const elevenIndex=events.findIndex((event,index)=>index>retryIndex&&event.state==='included'&&event.confirmedBlocks===11),verifiedIndex=events.findIndex(event=>event.state==='verified');assert.ok(elevenIndex>retryIndex&&verifiedIndex>elevenIndex);assert.equal(events[verifiedIndex].confirmedBlocks,12);
});
await check('回执消失后达到轮询上限，恢复引用只保留历史stage而不声称当前已包含',async()=>{
 let reads=0;const fixture=nftFixture({core:{tip:'0x67'},readOverride(method){if(method==='eth_getTransactionReceipt'&&++reads>1)return null;}});
 const error=await pending(fixture.wait({attempts:2}));assert.equal(error.reason,'confirmation_timeout');assert.equal(error.stage,'submitted');assert.equal(error.lastObservedStage,'included');assert.equal(error.tokenId,null);assert.equal(error.confirmedBlocks,0);assert.equal(error.blockNumber,null);assert.equal(error.blockHash,null);
});
await check('旧receipt state不可用时，以同一次tip-12的固定snapshot校验并成功',async()=>{
 const fixture=nftFixture({core:{tip:'0xc8'},ownerData:chainAbi(BigInt(NFT_TEST_OTHER)),readOverride(method,params){
  if(['eth_getCode','eth_call'].includes(method)&&params[1]==='0x64')throw Object.assign(Error('historical state is not available'),{code:-32000});
 }}),events=[];
 const result=await fixture.wait({onProgress:(state,detail)=>events.push({state,...detail})});assert.equal(result.nft.tokenId,'7');assert.equal(result.nft.owner,NFT_TEST_OTHER);assert.equal(result.maker,NFT_TEST_ACCOUNT);
 assert.equal(result.nft.blockNumber,'0x64');assert.equal(result.nft.stateBlockNumber,'0xbc');assert.equal(result.nft.stateBlockHash,CHAIN_BLOCK_HASH);
 assert.equal(fixture.reads.filter(read=>read.method==='eth_blockNumber').length,1);
 const stateReads=fixture.reads.filter(read=>['eth_getCode','eth_call'].includes(read.method));assert.equal(stateReads.length,4);for(const read of stateReads)assert.equal(read.params[1],'0xbc');
 const headers=fixture.reads.filter(read=>read.method==='eth_getBlockByNumber').map(read=>read.params[0]);assert.deepEqual(headers,['0x64','0xbc','0xbc','0x64']);assert.equal(events.at(-1).state,'verified');
});
await check('近期snapshot发生重组或原receipt最后变更，均不能verified',async()=>{
 for(const target of ['snapshot','receipt']){
  const counts=new Map(),events=[],fixture=nftFixture({core:{tip:'0xc8'},readOverride(method,params){
   if(method==='eth_getBlockByNumber'){
    const block=params[0],count=(counts.get(block)??0)+1;counts.set(block,count);
    if(count===2&&block===(target==='snapshot'?'0xbc':'0x64'))return {number:block,hash:'0x'+'99'.repeat(32)};
   }
  }});
  const error=await pending(fixture.wait({onProgress:(state,detail)=>events.push({state,...detail})}));assert.equal(error.reason,'verification_failed');assert.equal(error.stage,'verifying');assert.equal(events.some(event=>event.state==='verified'),false);
  assert.match(error.cause.message,target==='snapshot'?/snapshot changed/:/Receipt block changed/);
 }
});
await check('snapshot header必须对应tip-12，缺失或早于receipt不能读取作品',async()=>{
 for(const replacement of [null,{number:'0x63',hash:CHAIN_BLOCK_HASH},{number:'0xbc',hash:'0x'+'00'.repeat(32)}]){
  const fixture=nftFixture({core:{tip:'0xc8'},readOverride(method,params){if(method==='eth_getBlockByNumber'&&params[0]==='0xbc')return replacement;}});
  const error=await pending(fixture.wait());assert.equal(error.reason,'verification_failed');assert.equal(fixture.reads.some(read=>['eth_getCode','eth_call'].includes(read.method)),false);
 }
 for(const tip of ['0x60','0x64','0x6f']){
  const fixture=nftFixture({core:{tip}});await pending(fixture.wait());assert.equal(fixture.reads.some(read=>['eth_getCode','eth_call'].includes(read.method)),false);
 }
});
await check('近期snapshot仍严格检查runtime和冻结设计，不能借切换读取区块绕过',async()=>{
 const changed=testRecord();changed.profile[40]=.24;
 for(const options of [{code:'0x6000'},{pieceData:pieceFixture(changed)},{binding:chainAbi(BigInt(NFT_TEST_OTHER))}]){
  const fixture=nftFixture({...options,core:{tip:'0xc8'}}),events=[];
  const error=await pending(fixture.wait({onProgress:(state,detail)=>events.push({state,...detail})}));assert.equal(error.reason,'verification_failed');assert.equal(events.some(event=>event.state==='verified'),false);
 }
});
await check('0-depth included先核对交易calldata及EOA身份，手工hash不能套用别的器形',async()=>{
 const mutations=[tx=>{tx.input=tx.input.slice(0,-2)+'01';},tx=>{tx.hash='0x'+'88'.repeat(32);},tx=>{tx.from=NFT_TEST_OTHER;},tx=>{tx.to=NFT_TEST_OTHER;},tx=>{tx.value='0x1';},tx=>{tx.chainId='0x1';},tx=>{tx.blockHash='0x'+'88'.repeat(32);},tx=>{tx.blockNumber='0x63';},tx=>{tx.transactionIndex='0x1';}];
 for(const mutate of mutations){const fixture=nftFixture({core:{tip:'0x64'}}),events=[];mutate(fixture.transaction);const error=await pending(fixture.wait({onProgress:(state,detail)=>events.push({state,...detail})}));assert.equal(error.reason,'verification_failed');assert.equal(error.receiptVerified,false);assert.equal(events.some(event=>event.state==='included'),false);assert.equal(fixture.reads.some(read=>read.params[0]?.data?.startsWith(KILN_SELECTORS.piece)),false);}
 const fixture=nftFixture({core:{tip:'0x64'}}),events=[];const error=await pending(fixture.wait({onProgress:(state,detail)=>events.push({state,...detail})}));assert.equal(error.receiptVerified,true);assert.equal(error.confirmedBlocks,0);const included=events.find(event=>event.state==='included');assert.equal(included.receiptVerified,true);assert.equal(included.confirmedBlocks,0);assert.equal(events.some(event=>event.state==='verified'),false);
});
await check('交易input只读请求短断重试；未核对input不能发临时成功，恢复不重发',async()=>{
 let txReads=0;const fixture=nftFixture({readOverride(method){if(method==='eth_getTransactionByHash'&&++txReads===1)throw Error('temporary transaction read failure');}}),events=[];
 const result=await fixture.mint({waitOptions:{attempts:3,delay:async()=>{}},onProgress:(state,detail)=>events.push({state,...detail})});assert.equal(result.nft.tokenId,'7');assert.equal(sent(fixture).length,1);const retry=events.findIndex(event=>event.state==='retrying'),included=events.findIndex(event=>event.state==='included');assert.ok(retry>=0&&included>retry);assert.equal(events[retry].receiptVerified,false);
});
await check('失去回执、重组、最终设计不匹配均撤销receiptVerified，短断仍保留证实事实',async()=>{
 for(const kind of ['null','reorg','design','network']){
  let reads=0;const fixture=nftFixture({core:{tip:kind==='design'?'0x70':'0x64'},readOverride(method,params){
   if(method==='eth_getTransactionReceipt'&&++reads>1){if(kind==='null')return null;if(kind==='network')throw Error('offline');}
   if(kind==='reorg'&&method==='eth_getBlockByNumber'&&reads>1)return {number:params[0],hash:'0x'+'99'.repeat(32)};
  }});
  if(kind==='design'){const other=testRecord();other.profile[12]=.24;fixture.options.pieceData=pieceFixture(other);}
  const error=await pending(fixture.wait({attempts:2,maxRpcRetries:0}));assert.equal(error.receiptVerified,kind==='network');assert.equal(sent(fixture).length,0);
 }
});
await check('receipt已可见但transaction暂缺时有限重试，恢复前不宣成功',async()=>{
 let count=0;const fixture=nftFixture({readOverride(method){if(method==='eth_getTransactionByHash'&&++count===1)return null;}}),events=[];
 const actual=await fixture.wait({attempts:2,onProgress:(state,detail)=>events.push({state,...detail})});assert.equal(actual.nft.tokenId,'7');assert.equal(events.find(event=>event.state==='retrying').receiptVerified,false);assert.ok(events.findIndex(event=>event.state==='included')>events.findIndex(event=>event.state==='retrying'));
 const unavailable=nftFixture({transaction:null});const error=await pending(unavailable.wait({maxRpcRetries:0}));assert.equal(error.reason,'network_retry_exhausted');assert.equal(error.receiptVerified,false);
});
console.log(`RESULT ${total}/${total}`);
