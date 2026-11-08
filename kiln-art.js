/* 窑变配方 v1：只解释已结算记录，不读取网络，也不证明记录真实性。 */
const CHAIN_ID='11155111';
const CORE='0xfd6c166d4b8e2962e65746a13e5a0797cd4de0c4';
const MAX_ROUND=18446744073709551615n;
const DECIMAL=/^(0|[1-9][0-9]*)$/;
const ZERO_HASH='0x'+'0'.repeat(64);

export function cleanKilnRecord(record){
 if(!record||typeof record!=='object'||Array.isArray(record))return null;
 try{
  const {version,chainId,core,round,work,dataHash}=record;
  if(version!==1||chainId!==CHAIN_ID||typeof core!=='string'||core.toLowerCase()!==CORE)return null;
  // 先限制长度，再做 BigInt 运算；不接受空白、前导零、科学计数法或有损数字。
  if(typeof round!=='string'||round.length>20||!DECIMAL.test(round)||typeof work!=='string'||work.length>5||!DECIMAL.test(work))return null;
  const roundValue=BigInt(round),workValue=BigInt(work);
  if(roundValue<1n||roundValue>MAX_ROUND||workValue>10000n)return null;
  if(typeof dataHash!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(dataHash))return null;
  const hash=dataHash.toLowerCase();
  if(workValue>0n&&hash===ZERO_HASH)return null;
  return Object.freeze({version:1,chainId:CHAIN_ID,core:CORE,round,work,dataHash:hash});
 }catch{return null;}
}

export function kilnRecipe(record){
 const clean=cleanKilnRecord(record);if(!clean)return null;
 // 与 Solidity uint32(bytes4(hash)) ^ uint32(round) ^ uint32(work) 对齐。
 // 种子仅用于创作纹理，不是密码学随机数，也不代表稀有度或资产价值。
 const seed32=(Number.parseInt(clean.dataHash.slice(2,10),16)^Number(BigInt(clean.round)&0xffffffffn)^Number(clean.work))>>>0;
 const energyBps=Math.min(Number(clean.work)*20,10000);
 return Object.freeze({record:clean,seed32,energyBps,phase:(seed32%6283)/1000,flow:.18+.62*energyBps/10000});
}
