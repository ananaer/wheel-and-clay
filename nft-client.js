import {NFT_CONFIG} from './nft-config.js';
import {cleanKilnRecord} from './kiln-art.js';
import {encodePieceDesign,decodePieceDesign} from './piece-link.js';
import {KILN_NETWORK,KILN_SELECTORS,kilnWord,kilnWords,kilnAddress,kilnAddressWord,kilnQuantity,kilnUint,kilnCodeSha256,kilnConfirmedBlock,loadKilnRounds,publicKilnRead} from './kiln-chain.js';

export function nftAvailable(config=NFT_CONFIG){return !!kilnAddress(config.address)&&/^[0-9a-f]{64}$/.test(config.runtimeSha256||'')&&config.chainId===KILN_NETWORK.chainId&&config.rendererVersion===1;}
function nftTokenId(value){const id=String(value);if(!/^[1-9][0-9]{0,77}$/.test(id)||BigInt(id)>=(1n<<256n)||(typeof value==='number'&&!Number.isSafeInteger(value)))throw Error('Invalid token');return id;}
export function nftPieceUrl(tokenId,lang='en'){return 'https://wheel-and-clay.shop/?lang='+(lang==='zh'?'zh':'en')+'&nft='+nftTokenId(tokenId);}
export const nftTxUrl=hash=>/^0x[0-9a-fA-F]{64}$/.test(hash||'')?KILN_NETWORK.explorer+'/tx/'+hash:null;
const NFT_ZERO_HASH='0x'+'0'.repeat(64);
function nftCleanKiln(value){const record=cleanKilnRecord(value);return record&&!(record.work==='0'&&record.dataHash!==NFT_ZERO_HASH)?record:null;}
function nftSameKiln(a,b){return !!a&&!!b&&['version','chainId','core','round','work','dataHash'].every(key=>a[key]===b[key]);}
function nftFrozenPreview(record){
 const design=encodePieceDesign(record),kiln=nftCleanKiln(record?.kiln);if(!design||!kiln)throw Error('Finish a valid fired piece first');
 const base=decodePieceDesign(design);if(!base)throw Error('Invalid piece design');
 return Object.freeze({...base,profile:Object.freeze(base.profile.slice()),kiln});
}

export async function verifyNftDeployment(request=publicKilnRead,config=NFT_CONFIG,{blockTag='latest'}={}){
 if(!nftAvailable(config))throw Object.assign(Error('Mint is not deployed'),{code:'not_deployed'});
 if(blockTag!=='latest')kilnQuantity(blockTag);
 if(kilnQuantity(await request('eth_chainId',[]))!==BigInt(KILN_NETWORK.chainId))throw Error('Wrong network');
 const address=kilnAddress(config.address),[code,binding]=await Promise.all([request('eth_getCode',[address,blockTag]),request('eth_call',[{to:address,data:KILN_SELECTORS.core},blockTag])]);
 if(await kilnCodeSha256(code)!==config.runtimeSha256)throw Error('Contract code differs from the reviewed release');
 const words=kilnWords(binding);if(words.length!==1||kilnAddressWord(words[0])!==KILN_NETWORK.core)throw Error('Unexpected Core binding');
 return address;
}

export function decodeNftPiece(data){
 const w=kilnWords(data);if(w.length!==18||w[7]!==kilnWord(256)||w[8]!==kilnWord(270)||kilnUint(w[6],16)!==1n)throw Error('Unsupported NFT data');
 const design='0x'+w.slice(9).join('').slice(0,540);if(!/^0*$/.test(w.slice(9).join('').slice(540)))throw Error('Invalid NFT padding');
 const base=decodePieceDesign(design),kiln=nftCleanKiln({version:1,chainId:KILN_NETWORK.chainId,core:KILN_NETWORK.core,round:kilnUint(w[1],64).toString(),work:kilnUint(w[2],64).toString(),dataHash:'0x'+w[3]});
 const maker=kilnAddress(kilnAddressWord(w[0]));
 if(!base||!kiln||!maker||kilnAddressWord(w[5])!==KILN_NETWORK.implementation||'0x'+w[4]===NFT_ZERO_HASH)throw Error('Invalid NFT source');
 return {...base,kiln,maker,designHash:'0x'+w[4]};
}

export async function readNftPiece(tokenId,{request=publicKilnRead,config=NFT_CONFIG,blockTag=null}={}){
 const id=nftTokenId(tokenId),snapshot=blockTag===null?await kilnConfirmedBlock(request):{block:blockTag};kilnQuantity(snapshot.block);
 const address=await verifyNftDeployment(request,config,{blockTag:snapshot.block});
 const [data,owner]=await Promise.all([request('eth_call',[{to:address,data:KILN_SELECTORS.piece+kilnWord(id)},snapshot.block]),request('eth_call',[{to:address,data:KILN_SELECTORS.owner+kilnWord(id)},snapshot.block])]);
 const ownerWords=kilnWords(owner),ownerAddress=ownerWords.length===1&&kilnAddress(kilnAddressWord(ownerWords[0]));if(!ownerAddress)throw Error('Invalid NFT owner');
 if(snapshot.blockHash){const header=await request('eth_getBlockByNumber',[snapshot.block,false]);if(header?.hash?.toLowerCase()!==snapshot.blockHash||kilnQuantity(header.number)!==BigInt(snapshot.block))throw Error('Confirmation block changed');}
 return {...decodeNftPiece(data),nft:{chainId:KILN_NETWORK.chainId,contract:address,tokenId:id,owner:ownerAddress}};
}

export function encodeMintCall(record){
 const design=encodePieceDesign(record),kiln=nftCleanKiln(record?.kiln);if(!design||!kiln)throw Error('Finish a valid fired piece first');
 return KILN_SELECTORS.mint+kilnWord(96)+kilnWord(kiln.round)+kilnWord(kiln.work)+kilnWord(270)+design.slice(2).padEnd(576,'0');
}

const NFT_TRANSFER_TOPIC='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const NFT_FIRED_TOPIC='0x966d2f0d7c7d94a8af4b43a2c97a1ab620892bb34d8b1e09b5e393ea73c92e2f';
function nftReceiptIdentity(receipt,account,address,hash){
 if(!kilnAddress(account)||!kilnAddress(address)||!nftTxUrl(hash)||!receipt||receipt.transactionHash?.toLowerCase()!==hash.toLowerCase()||kilnAddress(receipt.from)!==kilnAddress(account)||kilnAddress(receipt.to)!==kilnAddress(address)||!['0x0','0x1'].includes(receipt.status)||!/^0x[0-9a-f]{64}$/i.test(receipt.blockHash)||receipt.blockHash===NFT_ZERO_HASH||!Array.isArray(receipt.logs)||receipt.logs.length>1024)throw Error('Receipt identity mismatch');
 kilnQuantity(receipt.blockNumber);kilnQuantity(receipt.transactionIndex);
}
function nftReceiptTransaction(transaction,receipt,reference,expected){
 // 立即成功必须对应这份冻结设计。仅支持直调EOA，不能把别的作品的hash套给预览。
 if(!transaction||transaction.hash?.toLowerCase()!==reference.transactionHash||kilnAddress(transaction.from)!==reference.account||kilnAddress(transaction.to)!==reference.contract||transaction.input?.toLowerCase()!==encodeMintCall(expected)||kilnQuantity(transaction.value)!==0n||kilnQuantity(transaction.chainId)!==BigInt(reference.chainId)||transaction.blockHash?.toLowerCase()!==receipt.blockHash.toLowerCase()||kilnQuantity(transaction.blockNumber)!==BigInt(receipt.blockNumber)||kilnQuantity(transaction.transactionIndex)!==BigInt(receipt.transactionIndex))throw Error('Mint transaction differs from the frozen preview');
}
function nftReceiptLogs(receipt,address){
 const logs=receipt.logs.filter(log=>kilnAddress(log?.address)===kilnAddress(address));
 for(const log of logs){
  if(log.removed!==false||log.transactionHash?.toLowerCase()!==receipt.transactionHash.toLowerCase()||log.blockHash?.toLowerCase()!==receipt.blockHash.toLowerCase()||kilnQuantity(log.blockNumber)!==BigInt(receipt.blockNumber)||kilnQuantity(log.transactionIndex)!==BigInt(receipt.transactionIndex)||!Array.isArray(log.topics)||!log.topics.every(topic=>typeof topic==='string'&&/^0x[0-9a-f]{64}$/i.test(topic))||typeof log.data!=='string'||!/^0x(?:[0-9a-f]{2})*$/i.test(log.data))throw Error('Mint log identity mismatch');
  kilnQuantity(log.logIndex);
 }
 return logs;
}
export function mintedTokenFromReceipt(receipt,account,address,hash=receipt?.transactionHash){
 nftReceiptIdentity(receipt,account,address,hash);
 if(receipt.status==='0x0')throw Object.assign(Error('Mint transaction reverted'),{code:'reverted'});
 const matches=nftReceiptLogs(receipt,address).filter(log=>log.topics.length===4&&log.topics[0].toLowerCase()===NFT_TRANSFER_TOPIC&&log.topics[1]===NFT_ZERO_HASH&&log.topics[2].toLowerCase()==='0x'+kilnWord(BigInt(account))&&log.data==='0x');
 if(matches.length!==1)throw Error('Mint receipt has no unique matching NFT');return nftTokenId(BigInt(matches[0].topics[3]));
}
function nftFiredDesignHash(receipt,tokenId,maker,kiln,address){
 const logs=nftReceiptLogs(receipt,address).filter(log=>log.topics.length===4&&log.topics[0].toLowerCase()===NFT_FIRED_TOPIC);
 if(logs.length!==1)throw Error('Missing PieceFired event');
 const log=logs[0],data=kilnWords(log.data);
 if(data.length!==2||log.topics[1].toLowerCase()!=='0x'+kilnWord(tokenId)||log.topics[2].toLowerCase()!=='0x'+kilnWord(BigInt(maker))||log.topics[3].toLowerCase()!=='0x'+kilnWord(kiln.round)||kilnUint(data[0],64)!==BigInt(kiln.work)||'0x'+data[1]===NFT_ZERO_HASH)throw Error('PieceFired differs from the minted piece');
 return '0x'+data[1];
}
function nftVerifyFired(receipt,actual,address){
 if(nftFiredDesignHash(receipt,actual.nft.tokenId,actual.maker,actual.kiln,address)!==actual.designHash)throw Error('PieceFired differs from the minted piece');
}
function nftMintReference(hash,account,config){return {transactionHash:hash.toLowerCase(),hash:hash.toLowerCase(),account:kilnAddress(account),contract:kilnAddress(config.address),chainId:KILN_NETWORK.chainId};}
function nftNotify(callback,state,detail){
 // UI观察器不能决定交易结果；同步异常、异步reject都不打断跟踪。
 if(typeof callback!=='function')return;
 try{Promise.resolve(callback(state,detail&&Object.freeze({...detail}))).catch(()=>{});}catch{}
}
function nftPendingError(reference,cause,reason='unconfirmed',observed={}){
 return Object.assign(Error(reason==='aborted'?'Transaction tracking paused. Resume checking the saved transaction.':'Transaction sent; verification is incomplete. Recheck this transaction before minting again.'),reference,observed,{code:'pending',pending:true,reason,...(cause?{cause}: {})});
}
function nftAborted(){return Object.assign(Error('Transaction tracking aborted'),{code:'nft_aborted'});}
function nftDelay(ms,{signal}={}){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(nftAborted());return;}
  const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(nftAborted());};
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);signal?.addEventListener('abort',abort,{once:true});
 });
}
function nftInterruptible(operation,{signal,timeoutMs}){
 return new Promise((resolve,reject)=>{
  const controller=new AbortController();let done=false,timer;
  const finish=(fn,value)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);fn(value);};
  const abort=()=>{controller.abort();finish(reject,nftAborted());};
  if(signal?.aborted){abort();return;}
  signal?.addEventListener('abort',abort,{once:true});
  timer=setTimeout(()=>{controller.abort();finish(reject,Object.assign(Error('Chain request timed out'),{code:'nft_rpc_error'}));},timeoutMs);
  Promise.resolve().then(()=>operation(controller.signal)).then(value=>finish(resolve,value),error=>finish(reject,signal?.aborted?nftAborted():error));
 });
}

export async function waitForNftMint(hash,account,record,{request=publicKilnRead,config=NFT_CONFIG,attempts=60,delay=nftDelay,onProgress=()=>{},signal,maxRpcRetries=3,pollIntervalMs=4000,retryDelayMs=1500,requestTimeoutMs=15000}={}){
 if(!nftTxUrl(hash)||!kilnAddress(account)||!nftAvailable(config)||!Number.isInteger(attempts)||attempts<0||attempts>120||typeof delay!=='function'||!Number.isInteger(maxRpcRetries)||maxRpcRetries<0||maxRpcRetries>8||![pollIntervalMs,retryDelayMs].every(value=>Number.isFinite(value)&&value>=0&&value<=30000)||!Number.isFinite(requestTimeoutMs)||requestTimeoutMs<1||requestTimeoutMs>60000)throw Error('Invalid mint reference');
 const reference=nftMintReference(hash,account,config),observed={stage:'submitted',lastObservedStage:'submitted',receiptVerified:false,tokenId:null,confirmedBlocks:0,requiredDepth:12,blockNumber:null,blockHash:null};
 let expected,rpcRetries=0,chainChecked=false,lastProgress='';
 const progress=(state,extra={})=>{const detail={...reference,...observed,...extra},key=state+JSON.stringify(detail);if(key!==lastProgress){lastProgress=key;nftNotify(onProgress,state,detail);}};
 const observe=changes=>{Object.assign(observed,changes);observed.lastObservedStage=observed.stage;};
 const read=async(method,params)=>{
  try{return await nftInterruptible(childSignal=>request(method,params,{signal:childSignal}),{signal,timeoutMs:requestTimeoutMs});}
  catch(error){if(error.code==='nft_aborted')throw error;throw Object.assign(Error('Chain request failed'),{code:'nft_rpc_error',cause:error});}
 };
 const pause=ms=>nftInterruptible(childSignal=>delay(ms,{signal:childSignal}),{signal,timeoutMs:ms+1000});
 const unresolved=(reason,cause)=>{
  if(reason==='verification_failed'||reason==='invalid_saved_preview')observed.receiptVerified=false;
  const retryInfo=reason==='network_retry_exhausted'?{retryCount:Math.min(Math.max(0,rpcRetries-1),maxRpcRetries),maxRetries:maxRpcRetries}:{};
  progress(reason==='aborted'?'aborted':reason==='verification_failed'||reason==='invalid_saved_preview'?'verification_failed':'pending',{reason,...retryInfo});
  return nftPendingError(reference,cause,reason,{...observed,...retryInfo});
 };
 try{expected=nftFrozenPreview(record);}catch(error){throw unresolved('invalid_saved_preview',error);}
 progress('pending');
 for(let i=0;i<attempts;i++){
  try{
   if(signal?.aborted)throw nftAborted();
   if(!chainChecked){if(kilnQuantity(await read('eth_chainId',[]))!==BigInt(KILN_NETWORK.chainId))throw Error('Wrong receipt network');chainChecked=true;}
   const receipt=await read('eth_getTransactionReceipt',[reference.transactionHash]);
   if(receipt){
    nftReceiptIdentity(receipt,reference.account,reference.contract,reference.transactionHash);
    if(observed.blockHash&&observed.blockHash!==receipt.blockHash.toLowerCase()){Object.assign(observed,{stage:'submitted',receiptVerified:false,tokenId:null,confirmedBlocks:0,blockNumber:null,blockHash:null});progress('pending',{reason:'receipt_changed'});}
    const header=await read('eth_getBlockByNumber',[receipt.blockNumber,false]);
    if(header?.hash?.toLowerCase()!==receipt.blockHash.toLowerCase()||kilnQuantity(header.number)!==BigInt(receipt.blockNumber))throw Error('Receipt block is no longer canonical');
    if(receipt.status==='0x0'){
     if(receipt.logs.length!==0)throw Error('Reverted receipt contains logs');
     observe({stage:'reverted',receiptVerified:false,tokenId:null,confirmedBlocks:0,blockNumber:receipt.blockNumber,blockHash:receipt.blockHash.toLowerCase()});progress('reverted');
     throw Object.assign(Error('Mint transaction reverted'),reference,{...observed,code:'reverted',pending:false});
    }
    const tokenId=mintedTokenFromReceipt(receipt,reference.account,reference.contract,reference.transactionHash);
    nftFiredDesignHash(receipt,tokenId,reference.account,expected.kiln,reference.contract);
    const transaction=await read('eth_getTransactionByHash',[reference.transactionHash]);
    if(transaction===null)throw Object.assign(Error('Mint transaction is not yet available'),{code:'nft_rpc_error'});
    nftReceiptTransaction(transaction,receipt,reference,expected);
    const sameBlock=observed.blockHash===receipt.blockHash.toLowerCase();
    observe({stage:'included',receiptVerified:true,tokenId,blockNumber:receipt.blockNumber,blockHash:receipt.blockHash.toLowerCase(),confirmedBlocks:sameBlock?observed.confirmedBlocks:0});progress('included');
    const tip=kilnQuantity(await read('eth_blockNumber',[]));if(tip<BigInt(receipt.blockNumber))throw Error('Receipt is beyond the chain tip');
    const depth=tip-BigInt(receipt.blockNumber);observe({confirmedBlocks:Number(depth>12n?12n:depth)});progress('included');
    // 上链立即可见；只有tip-12覆盖交易且完整作品校验通过才宣布verified。
    if(depth>=12n){
     observe({stage:'verifying'});progress('verifying');
     // 普通RPC会裁剪旧state；不可变设计在本次tip-12读取，不要求交易区块的archive state。
     // 交易证明仍固定在原receipt区块，所有作品/代码/owner读取共用同一个近期确认snapshot。
     const stateBlockNumber='0x'+(tip-12n).toString(16);
     if(BigInt(stateBlockNumber)<BigInt(receipt.blockNumber))throw Error('Verification snapshot predates the mint');
     const stateHeader=await read('eth_getBlockByNumber',[stateBlockNumber,false]);
     if(!stateHeader||kilnQuantity(stateHeader.number)!==BigInt(stateBlockNumber)||!/^0x[0-9a-f]{64}$/i.test(stateHeader.hash)||stateHeader.hash===NFT_ZERO_HASH)throw Error('Unknown verification snapshot');
     const stateBlockHash=stateHeader.hash.toLowerCase();
     const actual=await readNftPiece(tokenId,{request:read,config,blockTag:stateBlockNumber});
     if(actual.maker!==reference.account||encodePieceDesign(actual)!==encodePieceDesign(expected)||!nftSameKiln(actual.kiln,expected.kiln))throw Error('Minted piece differs from the preview');
     nftVerifyFired(receipt,actual,reference.contract);
     const finalStateHeader=await read('eth_getBlockByNumber',[stateBlockNumber,false]);if(finalStateHeader?.hash?.toLowerCase()!==stateBlockHash||kilnQuantity(finalStateHeader.number)!==BigInt(stateBlockNumber))throw Error('Verification snapshot changed while checking');
     const finalHeader=await read('eth_getBlockByNumber',[receipt.blockNumber,false]);if(finalHeader?.hash?.toLowerCase()!==receipt.blockHash.toLowerCase()||kilnQuantity(finalHeader.number)!==BigInt(receipt.blockNumber))throw Error('Receipt block changed while checking');
     const result={...actual,nft:{...actual.nft,transactionHash:reference.transactionHash,blockNumber:receipt.blockNumber,blockHash:receipt.blockHash.toLowerCase(),stateBlockNumber,stateBlockHash}};
     observe({stage:'verified'});progress('verified');return result;
    }
   }else{
    // 先前包含过也可能暂时查不到或被重组移除；当前阶段必须退回submitted。
    // lastObservedStage仅是历史，不能用来恢复已失去证据的token或确认数。
    Object.assign(observed,{stage:'submitted',receiptVerified:false,tokenId:null,confirmedBlocks:0,blockNumber:null,blockHash:null});
    progress('pending',{reason:observed.lastObservedStage==='submitted'?'awaiting_receipt':'receipt_unavailable'});
   }
   rpcRetries=0;
   if(i+1<attempts)await pause(pollIntervalMs);
  }catch(error){
   if(error.code==='reverted')throw error;
   if(error.code==='nft_aborted'||signal?.aborted)throw unresolved('aborted',error);
   if(error.code==='nft_rpc_error'){
    rpcRetries++;const retry=rpcRetries<=maxRpcRetries&&i+1<attempts,waitMs=retry?Math.min(retryDelayMs*2**(rpcRetries-1),8000):0;
    if(!retry)throw unresolved('network_retry_exhausted',error);
    progress('retrying',{retryCount:rpcRetries,maxRetries:maxRpcRetries,retryAfterMs:waitMs});
    try{await pause(waitMs);}catch(pauseError){throw unresolved(pauseError.code==='nft_aborted'||signal?.aborted?'aborted':'network_retry_exhausted',pauseError);}
    continue;
   }
   throw unresolved('verification_failed',error);
  }
 }
 throw unresolved(signal?.aborted?'aborted':'confirmation_timeout');
}

// 已广播记录在页面内保留；UI 使用 onState / pending error 持久保存相同引用以跨刷新重查。
const nftPendingMints=new Map(),nftMintFlights=new Map();
// 仅由明确的“Mint”点击调用。无需登录签名、授权、代币转移或私钥。
export async function mintNft(record,{provider=globalThis.ethereum,config=NFT_CONFIG,onState=()=>{},onProgress=()=>{},signal,request=publicKilnRead,waitOptions={}}={}){
 if(!provider?.request)throw Object.assign(Error('Open in a browser with an Ethereum wallet'),{code:'no_wallet'});
 if(!nftAvailable(config))throw Object.assign(Error('Mint is not deployed'),{code:'not_deployed'});
 const preview=nftFrozenPreview(record),data=encodeMintCall(preview),state=(name,detail)=>nftNotify(onState,name,detail);
 const checkAbort=()=>{if(signal?.aborted)throw new DOMException('Aborted','AbortError');};checkAbort();state('connecting');
 if(kilnQuantity(await provider.request({method:'eth_chainId'}))!==BigInt(KILN_NETWORK.chainId)){checkAbort();state('switching');await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:KILN_NETWORK.hexChainId}]});}
 if(kilnQuantity(await provider.request({method:'eth_chainId'}))!==BigInt(KILN_NETWORK.chainId))throw Error('Use Sepolia testnet');
 checkAbort();const accounts=await provider.request({method:'eth_requestAccounts'}),account=kilnAddress(accounts?.[0]);if(!account)throw Error('No wallet account');
 const address=kilnAddress(config.address),key=address+':'+account+':'+data;
 if(nftMintFlights.has(key))return nftMintFlights.get(key);
 const run=(async()=>{
  let reference=nftPendingMints.get(key);
  try{
   if(!reference){
    checkAbort();state('checking');await verifyNftDeployment(request,config);
    const source=await loadKilnRounds({round:preview.kiln.round,count:1,request});
    if(!nftSameKiln(source.records[0],preview.kiln))throw Object.assign(Error('The preview does not match the certified round. Re-fire before minting.'),{code:'source_mismatch'});
    checkAbort();
    const transaction={from:account,to:address,data,value:'0x0',chainId:KILN_NETWORK.hexChainId};
    await provider.request({method:'eth_call',params:[transaction,'latest']});
    const gas=kilnQuantity(await provider.request({method:'eth_estimateGas',params:[transaction]}));if(gas===0n||gas>3000000n)throw Error('Unexpected gas estimate');transaction.gas='0x'+(gas*12n/10n).toString(16);
    const current=await provider.request({method:'eth_accounts'});if(kilnAddress(current?.[0])!==account||kilnQuantity(await provider.request({method:'eth_chainId'}))!==BigInt(KILN_NETWORK.chainId))throw Error('Wallet changed. Try again.');
    checkAbort();state('confirming');const hash=await provider.request({method:'eth_sendTransaction',params:[transaction]});
    if(!nftTxUrl(hash))throw Object.assign(Error('Wallet returned no valid reference. Check wallet activity before trying again.'),{code:'submission_unknown',account,contract:address,pending:true});
    reference=nftMintReference(hash,account,config);nftPendingMints.set(key,reference);
   }
   state('pending',{...reference});
   const progress=(name,detail)=>{nftNotify(onProgress,name,detail);if(waitOptions.onProgress!==onProgress)nftNotify(waitOptions.onProgress,name,detail);};
   const result=await waitForNftMint(reference.transactionHash,account,preview,{...waitOptions,request,config,signal:signal??waitOptions.signal,onProgress:progress});nftPendingMints.delete(key);return result;
  }catch(error){
   if(reference){
    if(error.code==='reverted'){nftPendingMints.delete(key);throw Object.assign(error,reference,{pending:false});}
    if(error.code==='pending')throw error;
    throw nftPendingError(reference,error,'verification_incomplete');
   }
   throw error;
  }
 })();
 nftMintFlights.set(key,run);
 try{return await run;}finally{nftMintFlights.delete(key);}
}
