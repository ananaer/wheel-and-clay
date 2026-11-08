const assert=require('node:assert/strict');
const P=require('../engine.js');
let passed=0;const test=(name,run)=>{run();passed++;console.log('PASS '+name);};
const positive=(observedAt=1000,rpm=67.1)=>({state:'running',rpm,observedAt,freshnessAt:observedAt+3,speed:740});
const zero=(observedAt=2000)=>({state:'idle',rpm:0,observedAt,freshnessAt:observedAt+3});
const unknown=(observedAt=2000)=>({state:'unknown',rpm:null,observedAt,freshnessAt:observedAt+3});
function expected(state,{powerState,powerRpm,buffering,remaining}){
 assert.equal(state.powerState,powerState);assert.equal(state.powerRpm,powerRpm);assert.equal(state.buffering,buffering);assert.equal(state.bufferRemainingMs,remaining);
}
test('首次就是零或未知不伪造动力，也不启动缓冲',()=>{
 for(const signal of [zero(),unknown(),{},null]){
  const buffer=P.createLivePowerBuffer(),state=buffer.update(signal,10000);
  expected(state,{powerState:signal?.state==='idle'?'idle':'unknown',powerRpm:signal?.state==='idle'?0:null,buffering:false,remaining:0});
  assert.equal(state.bufferStartedAt,null);assert.equal(state.bufferExpiresAt,null);assert.equal(state.lastPositiveObservedAt,null);
 }
});
test('90秒从首个坏信号开始，同一正常正样本几十秒不消耗缓冲',()=>{
 const buffer=P.createLivePowerBuffer(),signal=positive();buffer.update(signal,1000);
 const stable=buffer.update(signal,71000);expected(stable,{powerState:'running',powerRpm:67.1,buffering:false,remaining:0});assert.equal(stable.lastPositiveAt,1000);
 const firstBad=buffer.update(zero(),72000);expected(firstBad,{powerState:'running',powerRpm:67.1,buffering:true,remaining:90000});assert.equal(firstBad.bufferStartedAt,72000);assert.equal(firstBad.bufferExpiresAt,162000);
});
test('持续有效零速在89999毫秒保留动力，90000边界变idle/0',()=>{
 const buffer=P.createLivePowerBuffer();buffer.update(positive(),1000);buffer.update(zero(),2000);
 expected(buffer.update(zero(90000),91999),{powerState:'running',powerRpm:67.1,buffering:true,remaining:1});
 expected(buffer.update(zero(92000),92000),{powerState:'idle',powerRpm:0,buffering:false,remaining:0});
 expected(buffer.update(zero(200000),200000),{powerState:'idle',powerRpm:0,buffering:false,remaining:0});
});
test('持续未知到期仍是unknown/null，不能伪装仓鼠静止',()=>{
 const buffer=P.createLivePowerBuffer();buffer.update(positive(),1000);buffer.update(unknown(),2000);
 expected(buffer.update(unknown(),91999),{powerState:'running',powerRpm:67.1,buffering:true,remaining:1});
 expected(buffer.update(unknown(),92000),{powerState:'unknown',powerRpm:null,buffering:false,remaining:0});
});
test('zero与unknown互换不重启计时，到期口径跟随当前源状态',()=>{
 const buffer=P.createLivePowerBuffer();buffer.update(positive(),1000);buffer.update(zero(),2000);
 for(let now=3000;now<92000;now+=1000){const state=buffer.update(now%2000?unknown(now):zero(now),now);assert.equal(state.bufferStartedAt,2000);assert.equal(state.bufferExpiresAt,92000);assert.equal(state.bufferRemainingMs,92000-now);}
 expected(buffer.update(unknown(92000),92000),{powerState:'unknown',powerRpm:null,buffering:false,remaining:0});
 expected(buffer.update(zero(93000),93000),{powerState:'idle',powerRpm:0,buffering:false,remaining:0});
});
test('缓冲中重复旧正样本及仅received/freshness更新不能解除或续期',()=>{
 const buffer=P.createLivePowerBuffer(),signal=positive();buffer.update(signal,1000);buffer.update(unknown(),2000);
 for(let now=3000;now<92000;now+=1000){const state=buffer.update({...signal,rpm:80,freshnessAt:now},now);assert.equal(state.powerRpm,67.1);assert.equal(state.bufferStartedAt,2000);assert.equal(state.bufferRemainingMs,92000-now);assert.equal(state.lastPositiveAt,1000);}
 expected(buffer.update({...signal,freshnessAt:92000},92000),{powerState:'unknown',powerRpm:null,buffering:false,remaining:0});
 expected(buffer.update(signal,900000),{powerState:'unknown',powerRpm:null,buffering:false,remaining:0});
});
test('严格更新的正样本恢复动力，并允许下一次坏状态获得新的90秒',()=>{
 const buffer=P.createLivePowerBuffer();buffer.update(positive(),1000);buffer.update(zero(),2000);
 const recovered=buffer.update(positive(40000,80),41000);expected(recovered,{powerState:'running',powerRpm:80,buffering:false,remaining:0});assert.equal(recovered.bufferStartedAt,null);assert.equal(recovered.lastPositiveAt,41000);assert.equal(recovered.lastPositiveObservedAt,40000);
 const badAgain=buffer.update(unknown(42000),42000);expected(badAgain,{powerState:'running',powerRpm:80,buffering:true,remaining:90000});assert.equal(badAgain.bufferExpiresAt,132000);
 const expired=buffer.update(unknown(),132000);assert.equal(expired.powerState,'unknown');
 expected(buffer.update(positive(133000,60),133000),{powerState:'running',powerRpm:60,buffering:false,remaining:0});
});
test('乱序旧正读数不能覆盖较新的动力，也不能恢复过期episode',()=>{
 const buffer=P.createLivePowerBuffer();buffer.update(positive(10000,80),10000);
 const old=buffer.update(positive(9000,60),11000);expected(old,{powerState:'running',powerRpm:80,buffering:true,remaining:90000});assert.equal(old.lastPositiveObservedAt,10000);
 expected(buffer.update(positive(9000,60),101000),{powerState:'unknown',powerRpm:null,buffering:false,remaining:0});
 expected(buffer.update(positive(10000,80),102000),{powerState:'unknown',powerRpm:null,buffering:false,remaining:0});
});
test('恢复必须新于已见有效零样本，递增旧正样本不能反复重开episode',()=>{
 const buffer=P.createLivePowerBuffer();buffer.update(positive(1000),1000);buffer.update(zero(10000),11000);
 for(let stamp=2000;stamp<=10000;stamp+=1000){const state=buffer.update(positive(stamp,80),11000+stamp);assert.equal(state.buffering,true);assert.equal(state.powerRpm,67.1);assert.equal(state.bufferStartedAt,11000);assert.equal(state.latestKnownObservedAt,10000);}
 expected(buffer.update(positive(9999,80),101000),{powerState:'unknown',powerRpm:null,buffering:false,remaining:0});
 expected(buffer.update(positive(10001,80),102000),{powerState:'running',powerRpm:80,buffering:false,remaining:0});
});
test('初始零样本建立时间水位，未知的未来时间戳不能阻断真实恢复',()=>{
 const buffer=P.createLivePowerBuffer();buffer.update(zero(2000),2000);
 expected(buffer.update(positive(1000),3000),{powerState:'unknown',powerRpm:null,buffering:false,remaining:0});
 expected(buffer.update(positive(3000),4000),{powerState:'running',powerRpm:67.1,buffering:false,remaining:0});
 buffer.update(unknown(99999999),5000);
 expected(buffer.update(positive(6000,80),6000),{powerState:'running',powerRpm:80,buffering:false,remaining:0});
});
test('源字段原样保留，缓冲不会把原始零或未知改写成运行',()=>{
 const buffer=P.createLivePowerBuffer(),signal=Object.freeze({...zero(),raw:Object.freeze({measurement:'fixture'})});buffer.update(positive(),1000);
 const state=buffer.update(signal,2000);assert.equal(state.state,'idle');assert.equal(state.rpm,0);assert.equal(state.observedAt,2000);assert.equal(state.raw,signal.raw);assert.equal(state.sourceState,'idle');assert.equal(state.sourceRpm,0);assert.equal(state.sourceObservedAt,2000);assert.equal(state.sourceFreshnessAt,2003);assert.equal(state.powerState,'running');assert.equal(state.powerRpm,67.1);assert.ok(Object.isFrozen(state));
 const drive=P.driveSignal({...state,state:state.powerState,rpm:state.powerRpm});assert.equal(drive.potteryRpm,P.potteryDrive(67.1));assert.equal(drive.sourceRpm,0);
});
test('reset清除历史，不能把上个LIVE会话或SIM动力带进新会话',()=>{
 const buffer=P.createLivePowerBuffer();buffer.update(positive(),1000);buffer.update(zero(),2000);buffer.reset();
 const initial=buffer.update(zero(),3000);expected(initial,{powerState:'idle',powerRpm:0,buffering:false,remaining:0});assert.equal(initial.lastPositiveObservedAt,null);
 buffer.reset();expected(buffer.update(positive(1000,60),4000),{powerState:'running',powerRpm:60,buffering:false,remaining:0});
});
test('非法输入不制造正动力，无时间戳的正值不能续期',()=>{
 for(const rpm of [-1,NaN,Infinity,'60',true,null]){const state=P.createLivePowerBuffer().update({state:'running',rpm,observedAt:1000},1000);assert.equal(state.powerState,'unknown');assert.equal(state.powerRpm,null);}
 for(const observedAt of [-1,Infinity,NaN,'1','1960-01-01T00:00:00Z','not-a-time']){const state=P.createLivePowerBuffer().update({state:'running',rpm:60,observedAt},1000);assert.equal(state.powerState,'unknown');assert.equal(state.powerRpm,null);}
 const buffer=P.createLivePowerBuffer();buffer.update(positive(),1000);const state=buffer.update({state:'running',rpm:90,observedAt:null},2000);assert.equal(state.powerRpm,67.1);assert.equal(state.buffering,true);
 expected(buffer.update({state:'running',rpm:90,observedAt:null},92000),{powerState:'unknown',powerRpm:null,buffering:false,remaining:0});
});
test('ISO observedAt也可比较，但新鲜度receivedAt独自变化不算新样本',()=>{
 const buffer=P.createLivePowerBuffer(),first={...positive(),observedAt:'2026-11-08T00:00:00Z'};buffer.update(first,1000);buffer.update(unknown(),2000);
 assert.equal(buffer.update({...first,freshnessAt:90000},90000).buffering,true);
 expected(buffer.update({...first,observedAt:'2026-11-08T00:00:01Z'},91000),{powerState:'running',powerRpm:67.1,buffering:false,remaining:0});
});
test('系统时间回拨不增加剩余缓冲，非法时间不修改状态',()=>{
 const buffer=P.createLivePowerBuffer();buffer.update(positive(),1000);buffer.update(zero(),2000);assert.equal(buffer.update(unknown(),12000).bufferRemainingMs,80000);
 assert.equal(buffer.update(unknown(),5000).bufferRemainingMs,80000);
 for(const now of [NaN,Infinity,-1,null,undefined,'12000'])assert.throws(()=>buffer.update(positive(13000),now),RangeError);
 assert.equal(buffer.update(unknown(),13000).bufferRemainingMs,79000);
});
test('实例互相独立，配置只接受有效时长',()=>{
 for(const holdMs of [0,-1,NaN,Infinity,'90000',null])assert.throws(()=>P.createLivePowerBuffer({holdMs}),RangeError);
 const a=P.createLivePowerBuffer({holdMs:10}),b=P.createLivePowerBuffer();a.update(positive(),1000);a.update(zero(),2000);
 expected(a.update(zero(),2010),{powerState:'idle',powerRpm:0,buffering:false,remaining:0});assert.equal(b.update(zero(),2010).powerRpm,0);assert.ok(Object.isFrozen(a));
});
console.log(`RESULT ${passed}/${passed}`);
