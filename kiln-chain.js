import {cleanKilnRecord} from './kiln-art.js';

// 只读 Sepolia。身份、代理存储、代码和轮次均在同一确认区块读取。
export const KILN_NETWORK=Object.freeze({chainId:'11155111',hexChainId:'0xaa36a7',name:'Sepolia',core:'0xfd6c166d4b8e2962e65746a13e5a0797cd4de0c4',implementation:'0x6869d6102696243fd17013ab955d99cd0c522ad3',layout:'0x9a9c008e029460808209571703fbf2679785874e0e6d3232f16a864d12abcb20',implementationSlot:'0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',runtimeKeccak:'0x65b5780a4fccafedeca1260806364d2bb512b4501c097253f792ae2839565a9c',runtimeSha256:'d8c9ab4cc9c26867dfdd3970cc0adb9261dc9f0841e800448b0a8635fa8b100b',explorer:'https://eth-sepolia.blockscout.com',rpc:'https://ethereum-sepolia-rpc.publicnode.com'});
export const KILN_SELECTORS=Object.freeze({state:'0xc19d93fb',roundPage:'0xc8b9e08f',implementation:'0x9d4237ce',layout:'0x85fabc21',mint:'0x483a6892',piece:'0x22239816',owner:'0x6352211e',core:'0xf2f4eb26'});
export const kilnHex=value=>'0x'+BigInt(value).toString(16);
export function kilnWord(value){const n=BigInt(value);if(n<0n||n>=(1n<<256n))throw Error('Invalid integer');return n.toString(16).padStart(64,'0');}
export function kilnWords(data){if(typeof data!=='string'||!/^0x(?:[0-9a-fA-F]{64})+$/.test(data)||data.length>65538)throw Error('Invalid contract response');return data.slice(2).toLowerCase().match(/.{64}/g);}
export function kilnQuantity(value,bits=256){if(typeof value!=='string'||!/^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(value)||value.length>66)throw Error('Invalid chain quantity');const n=BigInt(value);if(n>=(1n<<BigInt(bits)))throw Error('Chain quantity overflow');return n;}
export function kilnUint(word,bits){if(typeof word!=='string'||!/^[0-9a-fA-F]{64}$/.test(word))throw Error('Invalid ABI integer');const n=BigInt('0x'+word);if(n>=(1n<<BigInt(bits)))throw Error('ABI integer overflow');return n;}
export const kilnAddress=value=>typeof value==='string'&&/^0x[0-9a-fA-F]{40}$/.test(value)&&!/^0x0{40}$/.test(value)?value.toLowerCase():null;
export function kilnAddressWord(word){if(typeof word!=='string'||!/^0{24}[0-9a-fA-F]{40}$/.test(word))throw Error('Invalid address');return '0x'+word.slice(-40).toLowerCase();}
export async function kilnCodeSha256(code){
 if(typeof code!=='string'||!/^0x(?:[0-9a-fA-F]{2})+$/.test(code)||code.length>100000)throw Error('Contract is unavailable');
 const bytes=Uint8Array.from(code.slice(2).match(/../g),v=>parseInt(v,16)),digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
}
let kilnReadId=0;
export async function publicKilnRead(method,params=[],{signal,fetcher=globalThis.fetch,timeoutMs=12000}={}){
 if(!['eth_chainId','eth_blockNumber','eth_getBlockByNumber','eth_call','eth_getCode','eth_getStorageAt','eth_getTransactionReceipt','eth_getTransactionByHash','eth_getBalance'].includes(method))throw Error('Read method not allowed');
 if(!Array.isArray(params)||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>12000)throw Error('Invalid read options');
 const id=++kilnReadId,controller=new AbortController(),abort=()=>controller.abort();if(signal?.aborted)throw new DOMException('Aborted','AbortError');signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,timeoutMs);
 try{
  const response=await fetcher(KILN_NETWORK.rpc,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id,method,params}),signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok)throw Error('Chain service unavailable');const result=await response.json();
  if(!result||Array.isArray(result)||result.jsonrpc!=='2.0'||result.id!==id||Object.hasOwn(result,'error')||!Object.hasOwn(result,'result'))throw Error('Chain read failed');
  return result.result;
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}

export function decodeKilnRound(data,round){
 const r=BigInt(round),w=kilnWords(data);if(r<1n||r>=(1n<<64n)||w[0]!==kilnWord(32)||w.length<10)throw Error('Invalid round');
 const v=w.slice(1);if(kilnUint(v[0],64)!==r||v[7]!==kilnWord(256))throw Error('Round is not settled');
 const before=kilnUint(v[1],64),after=kilnUint(v[4],64),count=kilnUint(v[8],256);
 for(const index of [2,5])kilnUint(v[index],96);for(const index of [3,6])kilnUint(v[index],32);
 if(after<before||after-before>10000n||count>1n||v.length!==9+Number(count)*5)throw Error('Invalid round history');
 const work=after-before;let dataHash='0x'+'0'.repeat(64);
 if(count===1n){
  if(kilnUint(v[9],64)!==r||kilnUint(v[10],64)!==after||work===0n)throw Error('Invalid checkpoint');
  kilnUint(v[11],96);kilnUint(v[12],32);dataHash='0x'+v[13];
 }else if(work!==0n)throw Error('Missing active round');
 const record=cleanKilnRecord({version:1,chainId:KILN_NETWORK.chainId,core:KILN_NETWORK.core,round:r.toString(),work:work.toString(),dataHash});if(!record)throw Error('Invalid kiln recipe');return record;
}

export function decodeKilnHistoryPage(data,{after,through,maxRecords=16}={}){
 const from=BigInt(after),to=BigInt(through),w=kilnWords(data);
 if(from<0n||to<from||to>=(1n<<64n)||to-from>144n||!Number.isInteger(maxRecords)||maxRecords<1||maxRecords>16||w.length<10||w[0]!==kilnWord(32))throw Error('Invalid history bounds');
 const v=w.slice(1),certified=kilnUint(v[0],64),count=kilnUint(v[8],256);
 if(v[7]!==kilnWord(256)||certified<from||certified>to||count>BigInt(maxRecords)||v.length!==9+Number(count)*5||(certified<to&&count!==BigInt(maxRecords)))throw Error('Invalid certified history page');
 const position=offset=>({work:kilnUint(v[offset],64),blocks:kilnUint(v[offset+1],96),difficulty:kilnUint(v[offset+2],32)});
 const start=position(1),end=position(4);let previous=start,previousRound=from,latestActive=null;
 if(end.work<start.work||end.blocks<start.blocks||end.work-start.work>(certified-from)*10000n)throw Error('Invalid history endpoints');
 for(let index=0;index<Number(count);index++){
  const offset=9+index*5,id=kilnUint(v[offset],64),point=position(offset+1),hash='0x'+v[offset+4],work=point.work-previous.work;
  if(id<=previousRound||id>certified||work<=0n||work>10000n||point.blocks<previous.blocks||/^0x0{64}$/.test(hash))throw Error('Invalid active history checkpoint');
  latestActive={round:id.toString(),work:work.toString(),dataHash:hash};previous=point;previousRound=id;
 }
 if(end.work!==previous.work||end.blocks!==previous.blocks||end.difficulty!==previous.difficulty)throw Error('Incomplete history endpoint');
 return {certifiedThroughRound:certified,start,end,latestActive,count:Number(count)};
}

async function kilnRecentActive(call,latest){
 let cursor=latest>144n?latest-144n:0n,previousEnd=null,candidate=null;
 // 官方 Core 的 maxRecords 上限为16；144轮最多9页，不把144误作单页上限。
 for(let pageNumber=0;cursor<latest&&pageNumber<9;pageNumber++){
  const page=decodeKilnHistoryPage(await call(KILN_SELECTORS.roundPage+kilnWord(cursor)+kilnWord(latest)+kilnWord(16)),{after:cursor,through:latest});
  if(page.certifiedThroughRound<=cursor)throw Error('History page did not advance');
  if(previousEnd&&['work','blocks','difficulty'].some(key=>previousEnd[key]!==page.start[key]))throw Error('History pages disagree');
  if(page.latestActive)candidate=page.latestActive;
  cursor=page.certifiedThroughRound;previousEnd=page.end;
 }
 if(cursor!==latest)throw Error('History search limit exceeded');
 if(!candidate)return null;
 const id=BigInt(candidate.round),record=decodeKilnRound(await call(KILN_SELECTORS.roundPage+kilnWord(id-1n)+kilnWord(id)+kilnWord(1)),id);
 if(record.work!==candidate.work||record.dataHash!==candidate.dataHash)throw Error('Recent active round changed');
 return record;
}

export async function kilnConfirmedBlock(request=publicKilnRead){
 const [chain,tip]=await Promise.all([request('eth_chainId',[]),request('eth_blockNumber',[])]);
 if(kilnQuantity(chain)!==BigInt(KILN_NETWORK.chainId)||kilnQuantity(tip)<12n)throw Error('Wrong chain');
 const block=kilnHex(BigInt(tip)-12n),header=await request('eth_getBlockByNumber',[block,false]);
 if(!header||kilnQuantity(header.number)!==BigInt(block)||!/^0x[0-9a-f]{64}$/i.test(header.hash)||/^0x0{64}$/.test(header.hash))throw Error('Unknown confirmation block');
 return {block,blockHash:header.hash.toLowerCase()};
}
export async function loadKilnRounds({request=publicKilnRead,round=null,count=3,includeRecentActive=false}={}){
 if(!Number.isInteger(count)||count<1||count>3||typeof includeRecentActive!=='boolean')throw Error('Invalid read size');
 const {block,blockHash}=await kilnConfirmedBlock(request),call=data=>request('eth_call',[{to:KILN_NETWORK.core,data},block]);
 const [identity,layout,state,slot,code]=await Promise.all([
  call(KILN_SELECTORS.implementation),call(KILN_SELECTORS.layout),call(KILN_SELECTORS.state),
  request('eth_getStorageAt',[KILN_NETWORK.core,KILN_NETWORK.implementationSlot,block]),request('eth_getCode',[KILN_NETWORK.implementation,block])
 ]);
 const iw=kilnWords(identity),lw=kilnWords(layout),slotw=kilnWords(slot);
 if(iw.length!==1||lw.length!==1||slotw.length!==1||kilnAddressWord(iw[0])!==KILN_NETWORK.implementation||'0x'+lw[0]!==KILN_NETWORK.layout||kilnAddressWord(slotw[0])!==KILN_NETWORK.implementation)throw Error('Core release changed');
 // 此 SHA-256 对应的实时字节码已与官方公布的 Keccak 核对；浏览器不引入哈希 SDK。
 if(await kilnCodeSha256(code)!==KILN_NETWORK.runtimeSha256)throw Error('Core implementation code changed');
 const sw=kilnWords(state);if(sw.length!==8)throw Error('Invalid Core state');
 const latest=kilnUint(sw[0],64);kilnUint(sw[1],64);kilnUint(sw[2],96);kilnUint(sw[3],64);kilnUint(sw[4],96);kilnUint(sw[5],32);if(kilnUint(sw[7],8)>1n)throw Error('Invalid Core state');
 if(latest<1n)throw Error('No settled rounds');
 const selected=round===null?latest:BigInt(round);if(selected<1n||selected>latest)throw Error('Round is not settled');
 const ids=Array.from({length:Math.min(count,Number(selected<3n?selected:3n))},(_,i)=>selected-BigInt(i));
 const records=await Promise.all(ids.map(async r=>decodeKilnRound(await call(KILN_SELECTORS.roundPage+kilnWord(r-1n)+kilnWord(r)+kilnWord(1)),r)));
 let recentActiveRound=null;
 if(includeRecentActive&&round===null&&records.length===3&&records.every(record=>record.work==='0')){
  const active=await kilnRecentActive(call,latest);
  if(active){if(records.some(record=>record.round===active.round))throw Error('Recent activity contradicts latest rounds');records[2]=active;recentActiveRound=active.round;}
 }
 const finalHeader=await request('eth_getBlockByNumber',[block,false]);if(finalHeader?.hash?.toLowerCase()!==blockHash||kilnQuantity(finalHeader.number)!==BigInt(block))throw Error('Confirmation block changed');
 return {records,blockNumber:BigInt(block).toString(),blockHash,checkedAt:Date.now(),implementation:KILN_NETWORK.implementation,...(recentActiveRound?{recentActiveRound}:{})};
}
export function kilnSourceUrl(record){const p=cleanKilnRecord(record);return p?KILN_NETWORK.explorer+'/address/'+KILN_NETWORK.core+'?tab=read_contract':null;}
