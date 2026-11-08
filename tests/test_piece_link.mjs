import assert from 'node:assert/strict';
import {cleanPieceRecord,encodePiece,decodePiece,readPieceHash,buildPieceUrl,createPieceView,PIECE_SITE} from '../piece-link.js';
import {buildXIntent,createShareControls} from '../share.js';
import {GLAZES,FINISHES} from '../glazes.js';
let count=0;
function check(name,test){test();count++;console.log('PASS '+name);}
const sample={profile:Array.from({length:129},(_,i)=>.7+.2*Math.sin(i/128*Math.PI*2)),form:'vase',glaze:'turquoise',surface:'flow',finish:.783,hadSim:true,companionId:'8889',order:{score:99},apiSample:'private sample',id:876543210,image:'private image'};
const payload=encodePiece(sample);
const mutate=(index,value)=>{const bytes=Uint8Array.from(atob(payload.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));bytes[index]=value;return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_');};
check('链接固定长度，形状与工艺可往返且误差小于万分之一',()=>{
 assert.equal(payload.length,360);const result=decodePiece(payload);assert.ok(result);
 sample.profile.forEach((v,i)=>assert.ok(Math.abs(result.profile[i]-v)<=.00005+1e-10));
 for(const key of ['form','glaze','surface','finish','hadSim','companionId'])assert.equal(result[key],sample[key]);
 assert.deepEqual(readPieceHash('#piece='+payload),result);
});
check('所有公开器形釉色和工艺都能往返',()=>{
 for(const form of ['vase','column','bowl'])for(const glaze of GLAZES)for(const surface of FINISHES){const record={...sample,form,glaze:glaze.id,surface:surface.id};assert.deepEqual(decodePiece(encodePiece(record)),cleanPieceRecord(record));}
});
check('不把私有ID、图片、采样或成绩编进作品链接',()=>{
 const decoded=decodePiece(payload);assert.deepEqual(Object.keys(decoded).sort(),['profile','form','glaze','surface','finish','hadSim','companionId'].sort());
 assert.equal(decoded.order,undefined);assert.equal(decoded.id,undefined);assert.equal(decoded.apiSample,undefined);
});
check('修改清理后的器形不会回写创作者对象',()=>{const before=sample.profile.slice(),clean=cleanPieceRecord(sample);clean.profile[10]=1.2;assert.deepEqual(sample.profile,before);});
check('模拟历史不可由外层实时标签抹掉；未知不补造实时',()=>{
 assert.equal(decodePiece(encodePiece({...sample,hadSim:false,order:{hadSim:true}})).hadSim,true);
 assert.equal(decodePiece(encodePiece({...sample,hadSim:false,order:null})).hadSim,false);
 assert.equal(decodePiece(encodePiece({...sample,hadSim:undefined,order:null})).hadSim,null);
});
check('缺器形旧记录降级为首页，避免伪造专属作品',()=>{assert.equal(buildPieceUrl({hadSim:true}),PIECE_SITE);assert.equal(buildPieceUrl({...sample,profile:[.7]}),PIECE_SITE);});
check('畸形数据在任何渲染前被拒绝',()=>{
 for(const profile of [null,[],Array(128).fill(.7),Array(130).fill(.7),Array(129).fill('.7'),Array(129).fill(NaN),Array(129).fill(Infinity),Array(129).fill(.2399),Array(129).fill(1.2301)])assert.equal(encodePiece({...sample,profile}),null);
 for(const finish of [-.01,1.01,NaN,Infinity,'0.7'])assert.equal(encodePiece({...sample,finish}),null);
 for(const key of ['form','glaze','surface'])assert.equal(encodePiece({...sample,[key]:'<img src=x onerror=alert(1)>'}),null);
});
check('超长/短链接和非URL安全字符拒绝，不执行HTML或URL',()=>{
 for(const bad of [null,{},'',payload.slice(1),payload+'a','A'.repeat(1000000),'<script>alert(1)</script>','javascript:alert(1)',payload.replace(/./,'='),payload.replace(/./,'/')])assert.equal(decodePiece(bad),null);
 assert.equal(readPieceHash('#home'),null);assert.equal(readPieceHash('#piece='+payload+'&x=1'),null);
});
check('版本、枚举和保留字节严格校验',()=>{for(const [index,value] of [[0,0],[1,0],[2,2],[3,3],[4,GLAZES.length],[5,FINISHES.length],[6,3],[7,4],[10,1],[11,1]])assert.equal(decodePiece(mutate(index,value)),null);});
check('二进制半径和光泽越界仍拒绝',()=>{assert.equal(decodePiece(mutate(12,255)),null);assert.equal(decodePiece(mutate(8,255)),null);assert.equal(decodePiece(mutate(12,0)),null);});
check('可控作品链接固定公开站点，语言仅中英；拒绝注入站点',()=>{
 const url=new URL(buildPieceUrl({...sample,url:'https://evil.invalid',token:'secret'},'javascript:foo'));assert.equal(url.origin,new URL(PIECE_SITE).origin);assert.equal(url.search,'?lang=en');assert.ok(url.hash.startsWith('#piece='));
 assert.equal(new URL(buildPieceUrl(sample,'zh')).search,'?lang=zh');
});
check('X草稿实际附专属作品链接，而非只有首页',()=>{const intent=new URL(buildXIntent(sample,'en'));const link=intent.searchParams.get('url');assert.deepEqual(readPieceHash(new URL(link).hash),decodePiece(payload));assert.equal(intent.origin,'https://x.com');});
// 最小DOM驱动真实只读控制器，传入独立scene；接收者工作台对象未暴露给控制器。
class Element{
 constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.events={};this.dataset={};this.hidden=false;this.attributes={};this.textContent='';}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}closest(){return null;}get classList(){return {add(){}};}select(){this.selected=true;}removeAttribute(k){delete this.attributes[k];}removeEventListener(k){delete this.events[k];}setAttribute(k,v){this.attributes[k]=v;}addEventListener(k,fn){this.events[k]=fn;}focus(){}setPointerCapture(){}hasPointerCapture(){return false;}releasePointerCapture(){}
}
const doc={hidden:false,createElement(tag){return new Element(tag,this);}},root=new Element('section',doc),frames=[];
const oldRAF=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=fn=>{frames.push(fn);return frames.length;};
let lang='en',created=0,made=0,disposed=0;const calls=[],workspace={profile:[.45,.51],dirty:true,collection:[{id:99}]},beforeWorkspace=JSON.stringify(workspace);
const stub={setProfile:(...v)=>calls.push(['profile',...v]),setPhase:v=>calls.push(['phase',v]),setGlaze:v=>calls.push(['glaze',v]),setSurface:v=>calls.push(['surface',v]),setFinish:v=>calls.push(['finish',v]),setPresentationRotation:()=>{},setRpm:v=>calls.push(['rpm',v]),resetView:()=>{},setVisible:v=>calls.push(['visible',v]),orbitView:(...v)=>calls.push(['orbit',...v]),dispose:()=>disposed++};
const view=createPieceView({root,lang:()=>lang,createStudio(_canvas,options){created++;assert.equal(options.presentationOnly,true);return stub;},onMakeYours(){made++;}});
const flush=()=>{while(frames.length)frames.shift()();};
check('只读页在显示时创建独立场景，仅进入glaze并保持零动力',()=>{view.setVisible(true);view.show('#piece='+payload);flush();assert.equal(created,1);assert.equal(root.dataset.pieceState,'ready');assert.deepEqual(calls.find(v=>v[0]==='profile')[1],decodePiece(payload).profile);assert.ok(calls.some(v=>v[0]==='phase'&&v[1]==='glaze'));assert.ok(calls.some(v=>v[0]==='rpm'&&v[1]===0));});
check('Make yours仅调用导航，不写入接收者作品或收藏',()=>{root.children[0].children[5].events.click();assert.equal(made,1);assert.equal(JSON.stringify(workspace),beforeWorkspace);});
check('只读预览方向键只改变视角，不触发塑形',()=>{const canvas=root.children[1].children[0];let prevented=false;canvas.events.keydown({key:'ArrowRight',preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.deepEqual(calls.at(-1),['orbit',.09,0]);assert.equal(JSON.stringify(workspace),beforeWorkspace);});
check('无效链接显示错误而不送入3D场景',()=>{const profiles=calls.filter(v=>v[0]==='profile').length;view.show('#piece=<script>');flush();assert.equal(root.dataset.pieceState,'invalid');assert.equal(calls.filter(v=>v[0]==='profile').length,profiles);assert.ok(!root.children[0].children[1].textContent.includes('<script>'));});
check('隐藏期间不初始化；恢复可见后渲染当前作品',()=>{view.setVisible(false);view.show('#piece='+payload);flush();assert.equal(root.dataset.pieceState,'loading');view.setVisible(true);flush();assert.equal(root.dataset.pieceState,'ready');});
check('切换中文不改变作品，不残留英文功能说明',()=>{lang='zh';view.render();assert.equal(root.children[0].children[5].textContent,'开始我的创作 ↗');assert.equal(root.children[1].children[2].children[0].textContent,'拖动旋转 · 方向键也可查看');assert.equal(JSON.stringify(workspace),beforeWorkspace);});
check('离开页面停止场景，销毁释放渲染器',()=>{view.setVisible(false);assert.deepEqual(calls.at(-1),['visible',false]);view.dispose();assert.equal(disposed,1);});
globalThis.requestAnimationFrame=oldRAF;
async function asyncCheck(name,test){await test();count++;console.log('PASS '+name);}
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
await asyncCheck('复制链接权限拒绝后显示完整可选择文本，不假报成功',async()=>{
 const shareDoc={createElement(tag){return new Element(tag,this);},defaultView:{navigator:{clipboard:{writeText(){return Promise.reject(new Error('denied'));}}}}};
 const shareRoot=new Element('div',shareDoc),controls=createShareControls({root:shareRoot,lang:()=> 'en'});assert.equal(controls.setPiece({record:sample,dataUrl:png}),true);
 const linkRow=shareRoot.children[1],button=linkRow.children[0],input=linkRow.children[2];await button.events.click();
 assert.equal(shareRoot.dataset.shareStatus,'linkFallback');assert.equal(input.hidden,false);assert.equal(input.selected,true);assert.equal(input.value,buildPieceUrl(sample,'en'));assert.equal(button.disabled,false);controls.dispose();
});
await asyncCheck('复制只传当前作品URL，成功后保留按钮可聚焦状态',async()=>{
 let copied;const shareDoc={createElement(tag){return new Element(tag,this);},defaultView:{navigator:{clipboard:{writeText(value){copied=value;return Promise.resolve();}}}}};
 const shareRoot=new Element('div',shareDoc),controls=createShareControls({root:shareRoot,lang:()=> 'en'});controls.setPiece({record:sample,dataUrl:png});const button=shareRoot.children[1].children[0];await button.events.click();
 assert.equal(copied,buildPieceUrl(sample,'en'));assert.equal(shareRoot.dataset.shareStatus,'linkCopied');assert.equal(button.disabled,false);controls.dispose();
});
await asyncCheck('较旧复制结果不能覆盖后来打开的作品卡',async()=>{
 let finish;const shareDoc={createElement(tag){return new Element(tag,this);},defaultView:{navigator:{clipboard:{writeText(){return new Promise(resolve=>finish=resolve);}}}}};
 const shareRoot=new Element('div',shareDoc),controls=createShareControls({root:shareRoot,lang:()=> 'en'});controls.setPiece({record:sample,dataUrl:png});const pending=shareRoot.children[1].children[0].events.click();controls.setPiece({record:{...sample,glaze:'coral'},dataUrl:png});finish();await pending;
 assert.equal(shareRoot.dataset.shareStatus,'');assert.equal(shareRoot.children[1].children[2].value,buildPieceUrl({...sample,glaze:'coral'},'en'));controls.dispose();
});
console.log(`RESULT ${count}/${count}`);
