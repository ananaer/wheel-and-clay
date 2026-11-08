// 进站默认来源：实时有信号且转速大于零优先实时，否则模拟。手动来源与实际创作永远不被自动切换。
export function createOpeningPower({requestedMode,home=true}={}){
 const explicit=['live','sim'].includes(requestedMode);
 let automatic=!explicit,mode=explicit?requestedMode:'sim',observed=false;
 // 深链或首次信号返回前就进入创作：先等一次判定再锁定，避免把正在跑的仓鼠锁成模拟。
 let lockOnFirstSignal=!home;
 return {
  get mode(){return mode;},get automatic(){return automatic;},
  observe(signal){
   if(automatic){mode=signal?.state==='running'&&Number.isFinite(signal.rpm)&&signal.rpm>0?'live':'sim';observed=true;if(lockOnFirstSignal)automatic=false;}
   return mode;
  },
  choose(next){automatic=false;if(['live','sim'].includes(next))mode=next;return mode;},
  lock(){if(observed)automatic=false;else lockOnFirstSignal=true;return mode;},
  // 已经用当前来源动手创作，立即定下来，不再等待信号。
  settle(){automatic=false;return mode;}
 };
}
