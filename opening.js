// 首屏可用演示动力；手动来源与实际创作永远不被自动切换。
export function createOpeningPower({requestedMode,home=true}={}){
 let automatic=home&&!['live','sim'].includes(requestedMode);
 let mode=['live','sim'].includes(requestedMode)?requestedMode:automatic?'sim':'live';
 return {
  get mode(){return mode;},get automatic(){return automatic;},
  observe(signal){
   if(automatic)mode=signal?.state==='running'&&Number.isFinite(signal.rpm)&&signal.rpm>0?'live':'sim';
   return mode;
  },
  choose(next){automatic=false;if(['live','sim'].includes(next))mode=next;return mode;},
  lock(){automatic=false;return mode;}
 };
}
