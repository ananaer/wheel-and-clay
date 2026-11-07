const assert=require('node:assert/strict'),P=require('../engine.js'),C=require('../core.js');
let passed=0;function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(e){console.error('FAIL '+name);throw e;}}
test('三个初始形状是有界可编辑实体',()=>{for(const type of ['vase','bowl','column'])assert(P.validProfile(P.profile(type)));});
test('零动力不能塑形',()=>{const p=P.profile();assert.deepEqual(P.sculpt(p,.5,.1,.13,0),p);});
test('未知动力不能塑形',()=>{const p=P.profile();assert.deepEqual(P.sculpt(p,.5,.1,.13,NaN),p);});
test('拖动确实改变器形且不改原数组',()=>{const p=P.profile(),before=p.slice(),out=P.sculpt(p,.5,.1,.13,18);assert(P.changed(p,out));assert.deepEqual(p,before);assert(out[64]>p[64]);});
test('相同手势在冲刺中产生更大形变',()=>{const p=P.profile('column'),slow=P.sculpt(p,.5,.04,.13,8),fast=P.sculpt(p,.5,.04,.13,42);assert(fast[64]-p[64]>slow[64]-p[64]);});
test('脚圈保持稳定',()=>{const p=P.profile();assert.equal(P.sculpt(p,.05,.1,.2,40)[0],p[0]);});
test('长时间过量塑形不会穿壁或爆开',()=>{for(const sign of [-1,1]){let p=P.profile();for(let i=0;i<200;i++)p=P.sculpt(p,.5,sign*.1,.24,42);assert(P.validProfile(p));assert(p[64]>P.MIN&&p[64]<P.MAX);}});
test('大笔触影响范围更宽',()=>{const p=P.profile('column'),narrow=P.sculpt(p,.5,.05,.05,18),wide=P.sculpt(p,.5,.05,.24,18);assert(wide[35]-p[35]>narrow[35]-p[35]);});
test('撤销恢复器形和起形种类',()=>{const p=P.profile(),h=P.history(p);h.push(P.profile('bowl'),'bowl');assert.equal(h.form,'bowl');assert.deepEqual(h.undo(),p);assert.equal(h.form,'vase');assert.equal(h.canRedo,true);h.redo();assert.equal(h.form,'bowl');});
test('撤销后新编辑正确丢弃重做分支',()=>{const p=P.profile(),h=P.history(p);h.push(P.sculpt(p,.3,.05,.13,18));h.undo();h.push(P.sculpt(p,.8,-.05,.13,18));assert.equal(h.canRedo,false);});
test('撤销历史不会保存调用方的可变引用',()=>{const p=P.profile(),h=P.history(p),next=P.sculpt(p,.3,.05,.13,18);h.push(next);next[5]=100;assert(P.validProfile(h.redo()));});
test('停机有惯性但最终停止',()=>{let rpm=18;rpm=P.stepMotor(rpm,0,.05);assert(rpm>0&&rpm<18);for(let i=0;i<220;i++)rpm=P.stepMotor(rpm,0,.05);assert(rpm<.01);});
test('冲刺平滑启动，长帧不跳变',()=>{const rpm=P.stepMotor(0,42,10);assert(rpm>0&&rpm<10);});
test('轻触抖动不变形，推拉施力方向相反',()=>{for(const x of [-3,-1,0,1,3])assert.equal(P.touchTarget(x,100),0);assert.equal(P.touchTarget(43,100),.4);assert.equal(P.touchTarget(-43,100),-.4);});
test('快速大幅拖动不会瞬间把陶坯拉大',()=>{let pressure=0,p=P.profile('column');const before=p[64];for(let i=0;i<6;i++){const touch=P.stepTouch(pressure,1,1/60);pressure=touch.pressure;p=P.sculpt(p,.5,touch.delta,.13,42);}assert(p[64]>before);assert(p[64]-before<.006);});
test('持续施力逐渐成形，按住两秒仍有明确幅度上限',()=>{let pressure=0,p=P.profile('column');const before=p[64];for(let i=0;i<120;i++){const touch=P.stepTouch(pressure,.6,1/60);pressure=touch.pressure;p=P.sculpt(p,.5,touch.delta,.13,18);}assert(p[64]-before>.06);assert(p[64]-before<.09);});
test('不同帧率下两秒施力产生相近结果',()=>{const run=fps=>{let p=P.profile('column'),pressure=0;for(let i=0;i<fps*2;i++){const touch=P.stepTouch(pressure,.7,1/fps);pressure=touch.pressure;p=P.sculpt(p,.5,touch.delta,.13,18);}return p[64];};assert(Math.abs(run(30)-run(120))<.001);});
test('无效或暂停的时钟不产生形变积累',()=>{assert.equal(P.stepTouch(1,1,0).delta,0);assert.equal(P.stepTouch(1,1,NaN).delta,0);assert(P.stepTouch(1,1,30).delta<=.0065+1e-12);});
test('三个订单可成形且固定底脚一致',()=>{for(const id of ['vase','cup','jar']){const target=P.orderProfile(id);assert(P.validProfile(target));assert.equal(target[0],P.profile('column')[0]);assert(P.similarity(target,target)===100);}});
test('更接近目标的陶坯有更高完成度',()=>{const target=P.orderProfile('vase'),start=P.profile('column'),half=start.map((v,i)=>(v+target[i])/2);assert(P.similarity(half,target)>P.similarity(start,target));assert(P.similarity(start,target)<100);});
test('挑战只按旋转消耗圈数，零速与未知信号不扣圈',()=>{assert.equal(P.spendTurns(3,0,.1),3);assert.equal(P.spendTurns(3,18,.1,false),3);assert(Math.abs(P.spendTurns(3,18,.1)-3.03)<1e-10);});
test('挑战最多消耗20圈，冲刺缩短可操作时间',()=>{assert.equal(P.spendTurns(19.99,42,.1),20);assert(P.spendTurns(0,42,.1)>P.spendTurns(0,18,.1));});
const now=Date.now(),raw={measurement:{freshness:'online',provenance:'hardware',coreStatus:'ACTIVE',rpmMilli:18000,speedMmPerSecond:216,observedAt:new Date(now).toISOString()}};
test('硬件 RPM 单位转换',()=>{assert.equal(C.normalizeStatus(raw,now).rpm,18);assert.equal(C.normalizeStatus(raw,now).state,'running');});
test('非硬件来源不能冒充实时',()=>{assert.equal(C.normalizeStatus({measurement:{...raw.measurement,provenance:'simulation'}},now).state,'unknown');});
test('过期数据不能冒充仓鼠休息',()=>{assert.equal(C.normalizeStatus(raw,now+180000).state,'unknown');});
test('真正的硬件零速才表示静止',()=>{const data={measurement:{...raw.measurement,rpmMilli:0,speedMmPerSecond:0}};assert.equal(C.normalizeStatus(data,now).state,'idle');});
test('设备 IDLE 不能覆盖实际非零转速',()=>{assert.equal(C.normalizeStatus({measurement:{...raw.measurement,coreStatus:'IDLE'}},now).state,'running');});
test('九个目标都有固定底脚且不是换名的重复轮廓',()=>{
 const ids=['cup','beaker','flare','vase','jar','pear','spindle','gourd','tulip'];
 for(const id of ids){const p=P.orderProfile(id);assert(P.validProfile(p));assert.equal(p[0],P.profile('column')[0]);for(let i=1;i<p.length;i++)assert(Math.abs(p[i]-p[i-1])<.08);}
 for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)assert(P.similarity(P.orderProfile(ids[i]),P.orderProfile(ids[j]))<97,ids[i]+' / '+ids[j]);
});
const freshRound=(play='burst')=>({play,used:0,stops:0,lastSignal:null,armed:false,idleSeconds:0});
const ticks=(state,rpm,signal,n)=>{for(let i=0;i<n;i++)state=P.advanceRound(state,rpm,.1,signal);return state;};
test('一跑定形开局静止不结算',()=>{const s=ticks(freshRound(),0,'idle',200);assert(!s.reason);assert(!s.armed);assert.equal(s.used,0);});
test('一跑定形先跑再停才自动结算',()=>{let s=ticks(freshRound(),18,'running',20);s=ticks(s,0,'idle',31);assert.equal(s.reason,'settled');assert.equal(s.stops,1);});
test('短暂停跑后恢复不会提前封坯',()=>{let s=ticks(freshRound(),18,'running',10);s=ticks(s,0,'idle',10);s=ticks(s,18,'running',10);assert(!s.reason);assert.equal(s.idleSeconds,0);});
test('停跑但还有惯性不能提前封坯',()=>{let s=ticks(freshRound(),18,'running',10);s=ticks(s,1,'idle',40);assert(!s.reason);s=P.advanceRound(s,.4,.1,'idle');assert.equal(s.reason,'settled');});
test('断线暂停并中断停跑确认，不当作结算',()=>{let s=ticks(freshRound(),18,'running',10);s=ticks(s,0,'idle',20);const used=s.used;s=ticks(s,18,'unknown',200);assert(!s.reason);assert.equal(s.used,used);assert.equal(s.idleSeconds,0);s=ticks(s,0,'idle',20);assert(!s.reason);});
test('临摹超过20圈仍可继续',()=>{const s=P.advanceRound({...freshRound('study'),used:20},18,.1,'running');assert(s.used>20);assert(!s.reason);});
test('订单在20圈结算，临摹停跑只暂停',()=>{const s=P.advanceRound({...freshRound('turns'),used:19.99},18,.1,'running');assert.equal(s.used,20);assert.equal(s.reason,'exhausted');const study=ticks({...freshRound('study'),armed:true},0,'idle',100);assert(!study.reason);});
test('无效帧时长不会计时或误结算',()=>{const s=P.advanceRound({...freshRound(),armed:true},18,NaN,'idle');assert.equal(s.used,0);assert.equal(s.idleSeconds,0);assert(!s.reason);});
test('硬件采样与服务器接收时间分别用于显示和新鲜度',()=>{const observed=now-5000,received=now-100;const s=C.normalizeStatus({measurement:{...raw.measurement,observedAt:new Date(observed).toISOString(),receivedAt:new Date(received).toISOString()}},now);assert.equal(s.observedAt,observed);assert.equal(s.freshnessAt,received);assert.equal(s.state,'running');});
const repairIds=['cup','beaker','flare','vase','jar','pear','spindle','gourd','tulip'];
test('九份修坯委托确定且有明显局部损伤，不从直筒起形',()=>{
 for(const id of repairIds){const c=P.repairCommission(id);assert.deepEqual(c,P.repairCommission(id));assert(P.validProfile(c.initial));assert(P.validProfile(c.target));assert.equal(c.initial[0],c.target[0]);assert(P.changed(c.initial,P.profile('column')));assert(P.similarity(c.initial,c.target)<80);assert.equal(c.mask.filter(Boolean).length>20,true);assert.equal(c.mask.filter(x=>!x).length>20,true);c.initial.forEach((v,i)=>{if(!c.mask[i])assert.equal(v,c.target[i]);});}
});
test('原封不动或撤销全部修复都不能通过，也不虚报修复进度',()=>{
 for(const id of repairIds){const c=P.repairCommission(id);assert.deepEqual(P.repairMetrics(c.initial,c),{shape:69,repair:0,preservation:100,success:false});assert(!P.repairMetrics(c.initial,c,true).success);assert(!P.repairMetrics(c.target,c,false).success);}
});
test('准确修复后损伤清零且完好区保持满分',()=>{
 for(const id of repairIds){const c=P.repairCommission(id);assert.deepEqual(P.repairMetrics(c.target,c,true),{shape:100,repair:100,preservation:100,success:true});}
});
test('全局轮廓接近也不能掩盖完好区域被破坏',()=>{
 const c=P.repairCommission('cup'),p=c.target.map((v,i)=>v+(c.mask[i]?0:.04)),m=P.repairMetrics(p,c,true);assert(m.shape>=85);assert.equal(m.repair,100);assert(m.preservation<90);assert.equal(m.success,false);
});
test('错误的收放方向没有修复收益',()=>{
 for(const id of repairIds){const c=P.repairCommission(id),wrong=P.sculpt(c.initial,c.center,c.direction==='narrow'?.04:-.04,c.brushRadius,18);const m=P.repairMetrics(wrong,c,true);assert.equal(m.repair,0);assert(!m.success);}
});
test('九份委托在慢走、常速、冲刺下都能用真实施力规则修复',()=>{
 for(const rpm of [8,18,42])for(const id of repairIds){
  const c=P.repairCommission(id);let p=c.initial,pressure=0,used=0,m=P.repairMetrics(p,c,true),frames=0;
  while(used<12&&!m.success&&frames++<7200){const touch=P.stepTouch(pressure,c.direction==='narrow'?-.65:.65,1/60);pressure=touch.pressure;p=P.sculpt(p,c.center,touch.delta,c.brushRadius,rpm);used=P.spendTurns(used,rpm,1/60,true,12);m=P.repairMetrics(p,c,true);}
  assert(m.success,`${id} at ${rpm} RPM`);assert(used>0&&used<12);assert(m.preservation>=90);
 }
});
test('修坯用完12圈结算，提前交付之外停跑只暂停',()=>{
 let s=P.advanceRound({...freshRound('repair'),used:11.99},18,.1,'running');assert.equal(s.used,12);assert.equal(s.reason,'repairExhausted');
 s=ticks(freshRound('repair'),18,'running',10);const used=s.used;s=ticks(s,0,'idle',500);assert.equal(s.used,used);assert(!s.reason);assert.equal(s.stops,1);
});
test('修坯断线不扣圈不结算，转动速度确实决定时间成本',()=>{
 const s={...freshRound('repair'),used:11.99};assert.equal(ticks(s,42,'unknown',100).used,11.99);assert(!ticks(s,42,'unknown',100).reason);
 assert(P.advanceRound(freshRound('repair'),42,.1,'running').used>P.advanceRound(freshRound('repair'),18,.1,'running').used);
});
test('无效修复轮廓安全失败',()=>{const c=P.repairCommission('cup');assert.equal(P.repairMetrics([],c,true).success,false);assert.equal(P.repairMetrics(c.initial,null,true).success,false);});
console.log(`RESULT ${passed}/${passed}`);
