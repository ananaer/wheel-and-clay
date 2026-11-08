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
function nftVerifyFired(receipt,actual,address){
 const logs=nftReceiptLogs(receipt,address).filter(log=>log.topics.length===4&&log.topics[0].toLowerCase()===NFT_FIRED_TOPIC);
 if(logs.length!==1)throw Error('Missing PieceFired event');
 const log=logs[0],data=kilnWords(log.data);
 if(data.length!==2||log.topics[1].toLowerCase()!=='0x'+kilnWord(actual.nft.tokenId)||log.topics[2].toLowerCase()!=='0x'+kilnWord(BigInt(actual.maker))||log.topics[3].toLowerCase()!=='0x'+kilnWord(actual.kiln.round)||kilnUint(data[0],64)!==BigInt(actual.kiln.work)||'0x'+data[1]!==actual.designHash)throw Error('PieceFired differs from the minted piece');
}
function nftMintReference(hash,account,config){return {transactionHash:hash.toLowerCase(),hash:hash.toLowerCase(),account:kilnAddress(account),contract:kilnAddress(config.address),chainId:KILN_NETWORK.chainId};}
function nftPendingError(reference,cause,reason='unconfirmed'){
 return Object.assign(Error('Transaction sent; confirmation is incomplete. Recheck this transaction before minting again.'),reference,{code:'pending',pending:true,reason,...(cause?{cause}: {})});
}

export async function waitForNftMint(hash,account,record,{request=publicKilnRead,config=NFT_CONFIG,attempts=60,delay=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 if(!nftTxUrl(hash)||!kilnAddress(account)||!nftAvailable(config)||!Number.isInteger(attempts)||attempts<0||attempts>120||typeof delay!=='function')throw Error('Invalid mint reference');
 const reference=nftMintReference(hash,account,config);let expected;
 try{expected=nftFrozenPreview(record);}catch(error){throw nftPendingError(reference,error,'invalid_saved_preview');}
 try{
  for(let i=0;i<attempts;i++){
   const receipt=await request('eth_getTransactionReceipt',[reference.transactionHash]);
   if(receipt){
    nftReceiptIdentity(receipt,reference.account,reference.contract,reference.transactionHash);
    const header=await request('eth_getBlockByNumber',[receipt.blockNumber,false]);
    if(header?.hash?.toLowerCase()!==receipt.blockHash.toLowerCase()||kilnQuantity(header.number)!==BigInt(receipt.blockNumber))throw Error('Receipt block is no longer canonical');
    const tip=kilnQuantity(await request('eth_blockNumber',[]));
    if(tip<BigInt(receipt.blockNumber))throw Error('Receipt is beyond the chain tip');
    // 与来源读取一样，等到 tip-12 覆盖该交易区块，再宣布成功或回滚。
    if(tip-BigInt(receipt.blockNumber)>=12n){
     const tokenId=mintedTokenFromReceipt(receipt,reference.account,reference.contract,reference.transactionHash);
     const actual=await readNftPiece(tokenId,{request,config,blockTag:receipt.blockNumber});
     if(actual.maker!==reference.account||encodePieceDesign(actual)!==encodePieceDesign(expected)||!nftSameKiln(actual.kiln,expected.kiln))throw Error('Minted piece differs from the preview');
     nftVerifyFired(receipt,actual,reference.contract);
     const finalHeader=await request('eth_getBlockByNumber',[receipt.blockNumber,false]);if(finalHeader?.hash?.toLowerCase()!==receipt.blockHash.toLowerCase()||kilnQuantity(finalHeader.number)!==BigInt(receipt.blockNumber))throw Error('Receipt block changed while checking');
     return {...actual,nft:{...actual.nft,transactionHash:reference.transactionHash,blockNumber:receipt.blockNumber,blockHash:receipt.blockHash.toLowerCase()}};
    }
   }
   if(i+1<attempts)await delay(4000);
  }
 }catch(error){
  if(error.code==='reverted')throw Object.assign(error,reference,{pending:false});
  throw nftPendingError(reference,error,'verification_incomplete');
 }
 throw nftPendingError(reference,null,'confirmation_timeout');
}

// 已广播记录在页面内保留；UI 使用 onState / pending error 持久保存相同引用以跨刷新重查。
const nftPendingMints=new Map(),nftMintFlights=new Map();
// 仅由明确的“Mint”点击调用。无需登录签名、授权、代币转移或私钥。
export async function mintNft(record,{provider=globalThis.ethereum,config=NFT_CONFIG,onState=()=>{},request=publicKilnRead,waitOptions={}}={}){
 if(!provider?.request)throw Object.assign(Error('Open in a browser with an Ethereum wallet'),{code:'no_wallet'});
 if(!nftAvailable(config))throw Object.assign(Error('Mint is not deployed'),{code:'not_deployed'});
 const preview=nftFrozenPreview(record),data=encodeMintCall(preview);onState('connecting');
 if(kilnQuantity(await provider.request({method:'eth_chainId'}))!==BigInt(KILN_NETWORK.chainId)){onState('switching');await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:KILN_NETWORK.hexChainId}]});}
 if(kilnQuantity(await provider.request({method:'eth_chainId'}))!==BigInt(KILN_NETWORK.chainId))throw Error('Use Sepolia testnet');
 const accounts=await provider.request({method:'eth_requestAccounts'}),account=kilnAddress(accounts?.[0]);if(!account)throw Error('No wallet account');
 const address=kilnAddress(config.address),key=address+':'+account+':'+data;
 if(nftMintFlights.has(key))return nftMintFlights.get(key);
 const run=(async()=>{
  let reference=nftPendingMints.get(key);
  try{
   if(!reference){
    onState('checking');await verifyNftDeployment(request,config);
    const source=await loadKilnRounds({round:preview.kiln.round,count:1,request});
    if(!nftSameKiln(source.records[0],preview.kiln))throw Object.assign(Error('The preview does not match the certified round. Re-fire before minting.'),{code:'source_mismatch'});
    const transaction={from:account,to:address,data,value:'0x0',chainId:KILN_NETWORK.hexChainId};
    await provider.request({method:'eth_call',params:[transaction,'latest']});
    const gas=kilnQuantity(await provider.request({method:'eth_estimateGas',params:[transaction]}));if(gas===0n||gas>3000000n)throw Error('Unexpected gas estimate');transaction.gas='0x'+(gas*12n/10n).toString(16);
    const current=await provider.request({method:'eth_accounts'});if(kilnAddress(current?.[0])!==account||kilnQuantity(await provider.request({method:'eth_chainId'}))!==BigInt(KILN_NETWORK.chainId))throw Error('Wallet changed. Try again.');
    onState('confirming');const hash=await provider.request({method:'eth_sendTransaction',params:[transaction]});
    if(!nftTxUrl(hash))throw Object.assign(Error('Wallet returned no valid reference. Check wallet activity before trying again.'),{code:'submission_unknown',account,contract:address,pending:true});
    reference=nftMintReference(hash,account,config);nftPendingMints.set(key,reference);
   }
   onState('pending',{...reference});
   const result=await waitForNftMint(reference.transactionHash,account,preview,{...waitOptions,request,config});nftPendingMints.delete(key);return result;
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
