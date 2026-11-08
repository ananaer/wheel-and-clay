import {KILN_NETWORK,kilnAddress} from './kiln-chain.js';

// 连接入口只管理账户授权与网络，不签消息、不发送交易。铸造仍由独立按钮触发。
const walletDetachedKey='wheel-clay-wallet-detached';
const walletCancelled=()=>Object.assign(Error('Wallet connection cancelled'),{code:4001});
const walletChain=value=>typeof value==='string'&&/^0x[0-9a-f]+$/i.test(value)?'0x'+BigInt(value).toString(16):null;
const walletName=value=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,48):'Browser wallet';
const walletShort=address=>address?address.slice(0,6)+'…'+address.slice(-4):'';

export function createWalletSession({scope=globalThis,storage,requestTimeoutMs=30000,restore=true}={}){
 let store=storage;try{if(store===undefined)store=scope.localStorage;}catch{}
 const announced=new Map(),subscribers=new Set(),accountRequests=new WeakMap();
 let selected=null,account=null,chainId=null,busy='',error='',epoch=0,accountVersion=0,chainVersion=0,refreshVersion=0,disposed=false,flight=null,detachListeners=()=>{};
 let detached=false;try{detached=store?.getItem(walletDetachedKey)==='true';}catch{}
 const persist=value=>{detached=value;try{store?.setItem(walletDetachedKey,String(value));}catch{}};
 const snapshot=()=>({account,chainId,busy,error,connected:!!account,correctChain:chainId===KILN_NETWORK.hexChainId,providerId:selected?.id??null,providerName:selected?.name??'',providers:providers().map(({id,name})=>({id,name})),detached});
 const emit=()=>{if(!disposed)for(const fn of subscribers)try{fn(snapshot());}catch{}};
 function providers(){
  if(announced.size)return [...announced.values()];
  let injected;try{injected=scope.ethereum;}catch{}
  const list=Array.isArray(injected?.providers)?injected.providers:[injected];
  return list.filter((provider,i)=>provider?.request&&list.indexOf(provider)===i).slice(0,16).map((provider,i)=>({id:'injected-'+i,name:list.length>1?'Browser wallet '+(i+1):'Browser wallet',provider}));
 }
 function announce(event){
  const detail=event?.detail,info=detail?.info;
  if(!info||typeof info.uuid!=='string'||!/^[0-9a-f-]{36}$/i.test(info.uuid)||typeof info.name!=='string'||typeof detail.provider?.request!=='function'||announced.size>=16||announced.has(info.uuid))return;
  if([...announced.values()].some(item=>item.provider===detail.provider))return;
  announced.set(info.uuid,{id:info.uuid,name:walletName(info.name)||'Browser wallet',provider:detail.provider});emit();
 }
 function discover(){scope.dispatchEvent?.(new Event('eip6963:requestProvider'));emit();return snapshot().providers;}
 function fail(errorValue){const code=Number(errorValue?.code);return code===4001?'rejected':code===4100?'unauthorized':code===4900?'disconnected':code===4901?'network':code===4902?'add_network':code===4200?'unsupported':code===-32002?'pending':errorValue?.code==='wallet_timeout'?'timeout':'unavailable';}
 function deadline(operation){
  let timer;return Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('Wallet request timed out'),{code:'wallet_timeout'})),requestTimeoutMs);})]).finally(()=>clearTimeout(timer));
 }
 function activate(next){
  if(selected?.provider===next.provider){selected=next;return;}
  epoch++;detachListeners();selected=next;account=null;chainId=null;error='';accountVersion++;chainVersion++;
  const provider=next.provider,live=()=>!disposed&&selected?.provider===provider;
  const accountsChanged=accounts=>{if(!live())return;accountVersion++;account=kilnAddress(accounts?.[0]);error='';if(!account){epoch++;busy='';flight=null;}emit();};
  const chainChanged=value=>{if(!live())return;chainVersion++;chainId=walletChain(value);error=chainId?'':'network';emit();};
  const disconnected=()=>{if(!live())return;epoch++;accountVersion++;chainVersion++;account=null;chainId=null;busy='';flight=null;error='disconnected';emit();};
  const connected=()=>{if(live())void refresh();};
  const events={accountsChanged,chainChanged,disconnect:disconnected,connect:connected};
  for(const [event,handler]of Object.entries(events))provider.on?.(event,handler);
  detachListeners=()=>{for(const [event,handler]of Object.entries(events))provider.removeListener?.(event,handler);};
 }
 async function refresh(){
  if(disposed||detached||!selected)return snapshot();
  const current=epoch,revision=++refreshVersion,provider=selected.provider,a=accountVersion,c=chainVersion;
  try{
   const [accounts,chain]=await deadline(Promise.all([provider.request({method:'eth_accounts'}),provider.request({method:'eth_chainId'})]));
   if(disposed||current!==epoch||revision!==refreshVersion||selected?.provider!==provider)return snapshot();
   if(a===accountVersion)account=kilnAddress(accounts?.[0]);if(c===chainVersion)chainId=walletChain(chain);if(!busy)error='';emit();
  }catch(cause){if(!disposed&&current===epoch&&revision===refreshVersion&&selected?.provider===provider&&!busy){error=fail(cause);emit();}}
  return snapshot();
 }
 function connect(id){
  if(disposed)return Promise.reject(walletCancelled());if(flight)return flight;
  const list=providers(),next=id?list.find(item=>item.id===id):selected??(list.length===1?list[0]:null);
  if(!next)return Promise.reject(Object.assign(Error(list.length?'Choose a wallet':'No wallet installed'),{code:list.length?'choose_wallet':'no_wallet'}));
  if(selected?.provider===next.provider&&account&&!detached&&!error)return Promise.resolve(next.provider);
  persist(false);activate(next);epoch++;busy='connecting';error='';const current=epoch,provider=next.provider,a=accountVersion;emit();
  let request=accountRequests.get(provider);
  if(!request){request=Promise.resolve().then(()=>provider.request({method:'eth_requestAccounts'}));accountRequests.set(provider,request);request.finally(()=>{if(accountRequests.get(provider)===request)accountRequests.delete(provider);}).catch(()=>{});}
  const run=(async()=>{
   try{
    const accounts=await deadline(request);if(disposed||current!==epoch)throw walletCancelled();
    if(a===accountVersion)account=kilnAddress(accounts?.[0]);if(!account)throw Object.assign(Error('Account access unavailable'),{code:4100});
    const c=chainVersion,chain=await deadline(provider.request({method:'eth_chainId'}));if(disposed||current!==epoch)throw walletCancelled();if(c===chainVersion)chainId=walletChain(chain);if(!chainId)throw Object.assign(Error('Unknown chain'),{code:4901});
    error='';return provider;
   }catch(cause){if(!disposed&&current===epoch)error=fail(cause);throw cause;}
   finally{if(!disposed&&current===epoch){busy='';emit();}if(flight===run)flight=null;}
  })();flight=run;return run;
 }
 async function switchNetwork(){
  if(!selected||!account||busy)return false;
  const current=++epoch,provider=selected.provider;busy='switching';error='';emit();
  try{
   await deadline(provider.request({method:'wallet_switchEthereumChain',params:[{chainId:KILN_NETWORK.hexChainId}]}));if(disposed||current!==epoch)return false;
   const c=chainVersion,chain=await deadline(provider.request({method:'eth_chainId'}));if(disposed||current!==epoch)return false;if(c===chainVersion)chainId=walletChain(chain);if(chainId!==KILN_NETWORK.hexChainId)throw Object.assign(Error('Use Sepolia'),{code:4901});return true;
  }catch(cause){if(!disposed&&current===epoch)error=Number(cause?.code)===4001?'switch_rejected':fail(cause);return false;}
  finally{if(!disposed&&current===epoch){busy='';emit();}}
 }
 function disconnect(){epoch++;detachListeners();detachListeners=()=>{};selected=null;account=null;chainId=null;busy='';error='';flight=null;persist(true);emit();}
 scope.addEventListener?.('eip6963:announceProvider',announce);
 scope.addEventListener?.('ethereum#initialized',discover);discover();
 const restoreTimer=setTimeout(()=>{if(!disposed&&restore&&!detached&&!selected){const list=providers();if(list.length===1){activate(list[0]);void refresh();}}},150);
 return {getSnapshot:snapshot,getProvider:()=>selected?.provider,discover,connect,switchNetwork,disconnect,refresh,subscribe(fn){subscribers.add(fn);return()=>subscribers.delete(fn);},dispose(){disposed=true;epoch++;clearTimeout(restoreTimer);detachListeners();subscribers.clear();scope.removeEventListener?.('eip6963:announceProvider',announce);scope.removeEventListener?.('ethereum#initialized',discover);}};
}

const walletWords={
 connect:['连接钱包','Connect wallet'],connecting:['等待钱包','Check your wallet'],account:['钱包','Wallet'],close:['关闭钱包面板','Close wallet panel'],pick:['选择钱包','Choose your wallet'],connected:['已连接','CONNECTED'],optional:['只在铸造 NFT 时需要钱包。','A wallet is only needed to mint.'],noWallet:['未检测到钱包','No wallet found'],install:['请在装有以太坊钱包插件的浏览器中打开。','Open in a browser with an Ethereum wallet extension.'],retry:['重新检测','Check again'],continue:['继续创作','Keep creating'],network:['当前网络','NETWORK'],sepolia:['Sepolia 测试网','Sepolia testnet'],wrong:['需要 Sepolia','Sepolia required'],switch:['切换到 Sepolia','Switch to Sepolia'],switching:['正在切换…','Switching…'],copy:['复制地址','Copy address'],copied:['地址已复制','Address copied'],copyFailed:['请选中上方地址复制。','Select the address above to copy.'],explorer:['在 Sepolia 查看 ↗','View on Sepolia ↗'],disconnect:['断开连接','Disconnect'],disconnectHint:['钱包授权可在钱包内管理。','Manage site permissions in your wallet.'],change:['更换钱包','Change wallet'],rejected:['已取消连接，你可以继续创作。','Connection cancelled. Keep creating anytime.'],switch_rejected:['已取消切换网络，钱包仍保持连接。','Network switch cancelled. Your wallet is still connected.'],unauthorized:['钱包尚未授权，请重新连接。','Account access is unavailable. Connect again.'],disconnected:['钱包已断开，请重新连接。','Your wallet disconnected. Connect again.'],unavailable:['暂时无法连接，请打开钱包后重试。','Open your wallet and try connecting again.'],pending:['请在钱包中处理已有的连接请求。','Finish the open request in your wallet.'],timeout:['钱包还没有回应，请打开钱包后重试。','Your wallet has not responded. Open it and try again.'],networkError:['网络状态不可用，请在钱包中选择 Sepolia。','Select Sepolia in your wallet and try again.'],add_network:['请在钱包中启用 Sepolia 测试网，再重试。','Enable Sepolia testnet in your wallet, then try again.'],unsupported:['请在钱包中手动选择 Sepolia。','Select Sepolia directly in your wallet.']
};

export function createWalletControl({root,lang=()=> 'en',scope=globalThis,session=createWalletSession({scope}),notify=()=>{}}={}){
 if(!root)throw Error('Wallet control needs a root');
 const doc=root.ownerDocument,t=key=>(walletWords[key]??walletWords.unavailable)[lang()==='zh'?0:1];
 let opened=false,choosing=false,disposed=false,pendingConnect=null,copyState='',copyRevision=0,chooserRevision=0;
 const make=(tag,className)=>{const el=doc.createElement(tag);el.className=className;return el;};
 const trigger=make('button','wallet-trigger'),glyph=make('span','wallet-glyph'),triggerLabel=make('span','wallet-trigger-label'),dot=make('span','wallet-dot');
 trigger.type='button';trigger.id='wallet-connect';trigger.setAttribute('aria-controls','wallet-panel');trigger.setAttribute('aria-haspopup','dialog');glyph.setAttribute('aria-hidden','true');dot.setAttribute('aria-hidden','true');trigger.append(glyph,triggerLabel,dot);
 const panel=make('section','wallet-panel');panel.id='wallet-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','wallet-title');
 const top=make('div','wallet-panel-top'),heading=make('h2','wallet-title'),close=make('button','wallet-close');heading.id='wallet-title';close.type='button';close.textContent='×';top.append(heading,close);
 const intro=make('p','wallet-intro'),list=make('div','wallet-list'),empty=make('div','wallet-empty'),emptyTitle=make('strong',''),emptyBody=make('p',''),retry=make('button','wallet-retry');retry.type='button';empty.append(emptyTitle,emptyBody,retry);
 const connected=make('div','wallet-account'),name=make('span','wallet-provider-name'),address=make('p','wallet-address'),network=make('div','wallet-network'),networkLabel=make('span',''),networkValue=make('strong','');address.tabIndex=0;network.append(networkLabel,networkValue);
 const switcher=make('button','wallet-switch'),actions=make('div','wallet-account-actions'),copy=make('button','wallet-copy'),explorer=make('a','wallet-explorer'),change=make('button','wallet-change'),disconnect=make('button','wallet-disconnect'),note=make('p','wallet-footnote');
 switcher.type=copy.type=change.type=disconnect.type='button';explorer.target='_blank';explorer.rel='noopener noreferrer';actions.append(copy,explorer);connected.append(name,address,network,switcher,actions,change,disconnect,note);
 const feedback=make('p','wallet-feedback');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');const keep=make('button','wallet-keep');keep.type='button';panel.append(top,intro,list,empty,connected,feedback,keep);root.classList.add('wallet-control');root.replaceChildren(trigger,panel);
 function render(){
  if(disposed)return;const state=session.getSnapshot();root.dataset.walletState=state.busy||state.error||(state.connected?state.correctChain?'connected':'wrong-network':'disconnected');
  triggerLabel.textContent=state.busy==='connecting'?t('connecting'):state.connected?walletShort(state.account):t('connect');trigger.setAttribute('aria-label',state.busy==='connecting'?t('connecting'):state.connected?t('account')+' '+state.account+' · '+(state.correctChain?t('sepolia'):t('wrong')):t('connect'));trigger.setAttribute('aria-expanded',String(opened));trigger.setAttribute('aria-busy',String(!!state.busy));trigger.title=state.connected?(state.correctChain?t('sepolia'):t('wrong')):t('optional');
  panel.hidden=!opened;heading.textContent=t(state.connected&&!choosing?'account':'pick');close.setAttribute('aria-label',t('close'));intro.textContent=t('optional');intro.hidden=state.connected&&!choosing;
  connected.hidden=!state.connected||choosing;list.hidden=state.connected&&!choosing;empty.hidden=state.providers.length>0||state.connected;
  // 钱包元数据只作为纯文本，不装载扩展自报的SVG/远程图标。
  const priorFocus=doc.activeElement?.dataset?.walletId;list.replaceChildren();for(const provider of state.providers){const button=make('button','wallet-option'),mark=make('span','wallet-option-mark'),label=make('span',''),arrow=make('span','wallet-option-arrow');button.type='button';button.dataset.walletId=provider.id;button.disabled=!!state.busy;mark.textContent=provider.name.slice(0,1).toUpperCase();mark.setAttribute('aria-hidden','true');label.textContent=provider.name;arrow.textContent='↗';arrow.setAttribute('aria-hidden','true');button.append(mark,label,arrow);button.addEventListener('click',()=>void choose(provider.id));list.append(button);if(priorFocus===provider.id)button.focus({preventScroll:true});}
  emptyTitle.textContent=t('noWallet');emptyBody.textContent=t('install');retry.textContent=t('retry');name.textContent=state.providerName;address.textContent=state.account??'';networkLabel.textContent=t('network');networkValue.textContent=state.correctChain?t('sepolia'):t('wrong');network.dataset.correct=String(state.correctChain);switcher.hidden=state.correctChain;switcher.disabled=!!state.busy;switcher.textContent=t(state.busy==='switching'?'switching':'switch');copy.textContent=t(copyState||'copy');explorer.textContent=t('explorer');if(state.account)explorer.href=KILN_NETWORK.explorer+'/address/'+state.account;else explorer.removeAttribute('href');change.textContent=t('change');change.hidden=state.providers.length<2;disconnect.textContent=t('disconnect');note.textContent=t('disconnectHint');keep.textContent=t('continue');keep.hidden=state.connected&&!choosing;feedback.hidden=!state.error;feedback.textContent=state.error?t(state.error==='network'?'networkError':state.error):'';
 }
 function open(pick=false){opened=true;choosing=pick;session.discover();render();(pick||!session.getSnapshot().connected?list.querySelector('button')??retry:close).focus({preventScroll:true});}
 function shut({focus=true,cancel=true}={}){chooserRevision++;opened=false;choosing=false;if(cancel&&pendingConnect){pendingConnect.reject(walletCancelled());pendingConnect=null;}render();if(focus)trigger.focus({preventScroll:true});}
 async function choose(id){
  const revision=++chooserRevision,owner=pendingConnect;
  try{const provider=await session.connect(id);if(disposed||revision!==chooserRevision)return;choosing=false;copyState='';copyRevision++;if(owner&&pendingConnect===owner){owner.resolve(provider);pendingConnect=null;shut({focus:false,cancel:false});}else render();}
  catch(cause){if(disposed||revision!==chooserRevision)return;if(owner&&pendingConnect===owner){owner.reject(cause);pendingConnect=null;}opened=true;render();}
 }
 function connect(){
  if(disposed)return Promise.reject(walletCancelled());const state=session.getSnapshot();
  if(state.connected&&!state.error&&!state.busy)return Promise.resolve(session.getProvider());
  if(pendingConnect)return pendingConnect.promise;let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});pendingConnect={resolve,reject,promise};
  open(true);if(state.busy==='connecting'&&state.providerId)void choose(state.providerId);else if(state.providers.length===1)void choose(state.providers[0].id);return promise;
 }
 const onTrigger=()=>{const state=session.getSnapshot();if(opened){shut();return;}if(state.connected||state.providers.length!==1){open(!state.connected);return;}open(true);void choose(state.providers[0].id);};
 const onOutside=event=>{if(opened&&!root.contains(event.target))shut({focus:false});};
 const onKey=event=>{if(opened&&event.key==='Escape'){event.preventDefault();shut();}};
 trigger.addEventListener('click',onTrigger);close.addEventListener('click',()=>shut());keep.addEventListener('click',()=>shut());retry.addEventListener('click',()=>{session.discover();render();});change.addEventListener('click',()=>open(true));switcher.addEventListener('click',()=>void session.switchNetwork());disconnect.addEventListener('click',()=>{session.disconnect();shut();});
 copy.addEventListener('click',async()=>{const revision=++copyRevision,account=session.getSnapshot().account;if(!account)return;try{await scope.navigator?.clipboard?.writeText(account);if(!scope.navigator?.clipboard?.writeText)throw Error('Unavailable');if(!disposed&&revision===copyRevision&&account===session.getSnapshot().account){copyState='copied';render();}}catch{if(!disposed&&revision===copyRevision){copyState='copyFailed';render();address.focus();}}});
 const unsubscribe=session.subscribe(()=>{copyState='';copyRevision++;render();});doc.addEventListener('pointerdown',onOutside);doc.addEventListener('keydown',onKey);render();
 return {connect,getProvider:session.getProvider,refresh:session.refresh,render,getState:session.getSnapshot,dispose(){disposed=true;pendingConnect?.reject(walletCancelled());pendingConnect=null;unsubscribe();session.dispose();doc.removeEventListener('pointerdown',onOutside);doc.removeEventListener('keydown',onKey);}};
}
