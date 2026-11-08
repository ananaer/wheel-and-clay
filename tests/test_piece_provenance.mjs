/* 用实际 codec 和 DOM 控制器验证信任边界；不连接钱包或访问网络。 */
import assert from 'node:assert/strict';
import {cleanPieceRecord,encodePiece,decodePiece,encodePieceDesign,decodePieceDesign,buildPieceUrl,buildPieceShareUrl,cleanVerifiedPieceNft,createPieceView} from '../piece-link.js';
import {buildShareCopy,buildXIntent,createShareControls} from '../share.js';
const kiln={version:1,chainId:'11155111',core:'0xfd6c166d4b8e2962e65746a13e5a0797cd4de0c4',round:'646',work:'514',dataHash:'0x12345678'+'ab'.repeat(28)};
const design={profile:Array.from({length:129},(_,i)=>.65+.15*Math.sin(i/128*Math.PI)),form:'vase',glaze:'jade',surface:'flow',finish:.72,hadSim:true,companionId:'8889'};
const piece={...design,kiln,maker:'0x'+'1'.repeat(40),nft:{chainId:'11155111',contract:'0x'+'2'.repeat(40),tokenId:'42',owner:'0x'+'3'.repeat(40),verified:true}};
const verified={verifiedNft:true};
const explorer='https://eth-sepolia.blockscout.com';
let total=0;
function check(name,test){test();total++;console.log('PASS '+name);}
async function checkAsync(name,test){await test();total++;console.log('PASS '+name);}
function bytes(payload){return Uint8Array.from(atob(payload.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
function encodeBytes(value){return btoa(String.fromCharCode(...value)).replace(/\+/g,'-').replace(/\//g,'_');}

check('v2往返完整窑烧记录，v1仍为原270字节设计',()=>{
 const encoded=encodePiece(piece),decoded=decodePiece(encoded);
 assert.equal(encoded.length,416);assert.equal(bytes(encoded).length,312);assert.equal(bytes(encoded)[2],2);
 assert.deepEqual(decoded,cleanPieceRecord(piece));assert.deepEqual(decoded.kiln,kiln);
 assert.equal(encodePiece(design).length,360);assert.equal(bytes(encodePiece(design))[2],1);
 assert.equal(decoded.nft,undefined);assert.equal(decoded.maker,undefined);assert.equal(decoded.verified,undefined);
 assert.equal(encodePieceDesign(piece),encodePieceDesign(design));assert.equal(encodePieceDesign(piece).length,542);
 assert.deepEqual(decodePieceDesign(encodePieceDesign(piece)),cleanPieceRecord(design));
});
check('v2保留uint64整轮次与零工作量，不引入sleep或已验证声明',()=>{
 for(const [round,work,dataHash] of [['18446744073709551615','10000',kiln.dataHash],['1','0','0x'+'0'.repeat(64)]]){
  const record={...design,kiln:{...kiln,round,work,dataHash}},result=decodePiece(encodePiece(record));
  assert.deepEqual(result.kiln,record.kiln);assert.doesNotMatch(JSON.stringify(result),/sleep|verified|nft/);
 }
});
check('v2拒绝版本长度错配、未知保留字节、越界work和正work零hash',()=>{
 const payload=encodePiece(piece),original=bytes(payload);
 for(const [index,value] of [[2,1],[10,1],[11,1],[278,255]]){const changed=original.slice();changed[index]=value;assert.equal(decodePiece(encodeBytes(changed)),null);}
 const zeroRound=original.slice();zeroRound.fill(0,270,278);assert.equal(decodePiece(encodeBytes(zeroRound)),null);
 const zeroHash=original.slice();zeroHash.fill(0,280);assert.equal(decodePiece(encodeBytes(zeroHash)),null);
 assert.equal(decodePiece(encodeBytes(original.slice(0,270))),null);
 assert.equal(decodePiece(payload+'AA'),null);assert.equal(encodePiece({...piece,kiln:{...kiln,work:'10001'}}),null);
});
check('NFT只接受显式信任上下文，local nft或verified字段不构成证明',()=>{
 assert.equal(cleanVerifiedPieceNft(piece),null);assert.equal(cleanVerifiedPieceNft({...piece,verifiedNft:true}),null);
 assert.equal(new URL(buildPieceShareUrl(piece,'en')).searchParams.has('nft'),false);
 assert.equal(new URL(buildPieceShareUrl(piece,'en',verified)).searchParams.get('nft'),'42');
 assert.equal(new URL(buildPieceShareUrl(piece,'zh',verified)).hash,'');
 assert.equal(cleanVerifiedPieceNft(piece,verified).maker,piece.maker);
 for(const nft of [{...piece.nft,tokenId:'01'},{...piece.nft,tokenId:'1e2'},{...piece.nft,tokenId:String(1n<<256n)},{...piece.nft,chainId:'1'},{...piece.nft,owner:'javascript:alert(1)'},{...piece.nft,contract:'0x'+'0'.repeat(40)}])assert.equal(cleanVerifiedPieceNft({...piece,nft},verified),null);
 assert.equal(cleanVerifiedPieceNft({...piece,maker:null},verified),null);assert.equal(cleanVerifiedPieceNft({...piece,kiln:null},verified),null);
});
check('分享文案区分模拟塑形和真实回合配方，普通链接不宣称NFT',()=>{
 const unverified=buildShareCopy(piece,'en'),trusted=buildShareCopy(piece,'en',verified);
 assert.match(unverified,/Shaping: simulation/);assert.match(unverified,/Sepolia round 646 · work 514/);assert.match(unverified,/source unverified/);assert.doesNotMatch(unverified,/NFT|Source verified/);
 assert.match(trusted,/Shaping: simulation/);assert.match(trusted,/Source verified/);assert.match(trusted,/Sepolia NFT #42/);
 assert.doesNotMatch(buildShareCopy({...piece,kiln:{...kiln,work:'0',dataHash:'0x'+'0'.repeat(64)}},'en'),/sleep/i);
 const kilnOnly=buildShareCopy(piece,'zh',{verifiedKiln:true});assert.match(kilnOnly,/模拟练习/);assert.match(kilnOnly,/回合来源已核验/);assert.doesNotMatch(kilnOnly,/NFT/);
});
check('窑烧文案极值仍给X链接留24字符，中英文不混杂界面文本',()=>{
 const extreme={...piece,kiln:{...kiln,round:'18446744073709551615',work:'10000'},nft:{...piece.nft,tokenId:((1n<<256n)-1n).toString()}};
 for(const lang of ['en','zh'])for(const options of [{},verified,{verifiedKiln:true}]){
  const text=buildShareCopy(extreme,lang,options),weight=Array.from(text).reduce((n,c)=>n+(c.codePointAt(0)>0x10ff?2:1),0);
  assert.ok(weight+24<=280,`${lang}: ${weight}`);if(lang==='en')assert.doesNotMatch(text,/[\u3400-\u9fff]/);
 }
});
check('X草稿与复制URL使用相同显式NFT选择，不读取任意记录URL',()=>{
 for(const options of [{},verified]){
  const value={...piece,url:'https://evil.invalid',nftUrl:'javascript:evil'},url=new URL(buildXIntent(value,'zh',options));
  assert.equal(url.searchParams.get('url'),buildPieceShareUrl(value,'zh',options));assert.doesNotMatch(url.href,/evil/);
 }
});

class Element{
 constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.events={};this.dataset={};this.attributes={};this.textContent='';this.hidden=false;}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}closest(){return null;}get classList(){return {add(){}};}setAttribute(k,v){this.attributes[k]=v;}removeAttribute(k){delete this.attributes[k];if(k==='href')delete this.href;}addEventListener(k,fn){this.events[k]=fn;}removeEventListener(k){delete this.events[k];}focus(){}select(){}setPointerCapture(){}hasPointerCapture(){return false;}releasePointerCapture(){}
}
const visibleText=node=>node.hidden?'':[node.textContent,...node.children.map(visibleText)].join(' ');
const descendants=node=>[node,...node.children.flatMap(descendants)];
const doc={hidden:false,createElement(tag){return new Element(tag,this);}},frames=[];
const priorRAF=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=callback=>{frames.push(callback);return frames.length;};
const flush=()=>{while(frames.length)frames.shift()();};
function viewer(){
 const root=new Element('section',doc),calls=[];let created=0;
 const scene=Object.fromEntries(['setProfile','setPhase','setGlaze','setSurface','setFinish','setKiln','setKilnReveal','setPresentationRotation','setRpm','resetView','setVisible','orbitView','dispose'].map(key=>[key,(...args)=>calls.push([key,...args])]));
 const view=createPieceView({root,createStudio(){created++;return scene;}});view.setVisible(true);
 return {root,calls,view,created:()=>created};
}
try{
 check('普通v2链接显示回合与待核验说明，场景复现kiln但无NFT所有权',()=>{
  const {root,calls,view}=viewer();view.show('#piece='+encodePiece(piece));flush();
  const text=visibleText(root);assert.match(text,/Round 646 \/ Work 514/);assert.match(text,/source unverified/);assert.match(text,/MADE IN SIMULATION/);assert.doesNotMatch(text,/NFT #42|Current owner/);
  assert.deepEqual(calls.find(call=>call[0]==='setKiln')[1],kiln);assert.equal(root.dataset.kilnVerified,'false');
  const source=descendants(root).find(node=>node.href?.includes('?tab=read_contract'));assert.equal(source.href,explorer+'/address/'+kiln.core+'?tab=read_contract');view.dispose();
 });
 check('已验证NFT显示maker、owner及固定Blockscout链接，并保留模拟制作标签',()=>{
  const {root,view}=viewer();assert.equal(view.showRecord(piece,verified),true);flush();
  const text=visibleText(root),links=descendants(root).filter(node=>node.href);
  assert.match(text,/NFT #42/);assert.match(text,/source verified/);assert.match(text,/Maker/);assert.match(text,/Current owner/);assert.match(text,/MADE IN SIMULATION/);
  assert.equal(root.dataset.pieceNft,'42');assert.equal(root.dataset.kilnVerified,'true');
  for(const address of [piece.maker,piece.nft.owner])assert.ok(links.some(link=>link.href===explorer+'/address/'+address&&link.attributes['aria-label']===address));
  assert.ok(links.some(link=>link.href===explorer+'/token/'+piece.nft.contract+'/instance/42'));
  for(const link of links){assert.equal(link.target,'_blank');assert.equal(link.rel,'noopener noreferrer');}view.dispose();
 });
 check('读取与错误状态清除旧NFT和旧场景，错误内容不接收HTML',()=>{
  const {root,calls,view}=viewer();view.showRecord(piece,verified);flush();view.showLoading();
  assert.equal(root.dataset.pieceState,'loading');assert.equal(root.dataset.pieceNft,'');assert.doesNotMatch(visibleText(root),/NFT #42|Current owner/);assert.deepEqual(calls.at(-1),['setVisible',false]);
  view.showError('<script>');flush();assert.equal(root.dataset.pieceState,'error');assert.doesNotMatch(visibleText(root),/<script>|NFT #42/);
  view.showRecord(design);flush();assert.equal(root.dataset.pieceState,'ready');assert.deepEqual(calls.filter(call=>call[0]==='setKiln').at(-1),['setKiln',null]);assert.equal(root.dataset.kilnVerified,'false');view.dispose();
 });
 check('尚未绘制的旧记录不能覆盖loading/error或销毁后的页面',()=>{
  const {root,view,created}=viewer();view.showRecord(piece,verified);view.showLoading();flush();assert.equal(created(),0);assert.equal(root.dataset.pieceState,'loading');
  view.showRecord(piece,verified);view.showError();flush();assert.equal(created(),0);assert.equal(root.dataset.pieceState,'error');
  view.showRecord(piece,verified);view.dispose();flush();assert.equal(created(),0);
 });
}finally{globalThis.requestAnimationFrame=priorRAF;}

const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
await checkAsync('分享控制器仅在显式验证后复制NFT链接，下个普通记录立即清除验证状态',async()=>{
 let copied,native;const shareDoc={createElement(tag){return new Element(tag,this);},defaultView:{navigator:{clipboard:{writeText(value){copied=value;return Promise.resolve();}},canShare:()=>true,share:async value=>{native=value;}}}};
 const root=new Element('div',shareDoc),controls=createShareControls({root,lang:()=> 'en'});
 assert.equal(controls.setPiece({record:piece,dataUrl:png}),true);await root.children[1].children[0].events.click();assert.equal(copied,buildPieceUrl(piece,'en'));assert.equal(root.dataset.shareNft,'false');
 controls.setPiece({record:piece,dataUrl:png},verified);await root.children[1].children[0].events.click();assert.equal(copied,buildPieceShareUrl(piece,'en',verified));assert.equal(root.dataset.shareNft,'true');
 await root.children[2].children[0].events.click();assert.equal(native.url,copied);assert.match(native.text,/Sepolia NFT #42/);
 const x=new URL(root.children[2].children[2].href);assert.equal(x.searchParams.get('url'),copied);
 controls.setPiece({record:piece,dataUrl:png});assert.equal(root.dataset.shareNft,'false');assert.equal(root.children[1].children[2].value,buildPieceUrl(piece,'en'));controls.dispose();
});
console.log(`RESULT ${total}/${total}`);
