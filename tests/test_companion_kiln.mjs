/* 检查卡片文案和 Canvas 布局调用；不替代真实截图的字体与视觉验收。 */
import assert from 'node:assert/strict';
import {drawCompanionCard} from '../companions.js';

const IMAGE='data:image/png;base64,YQ==';
const WORDMARK='./brand-research/official/squeekchain-wordmark.svg';
const CHARACTER='./brand-research/official/squeek-8891-display.png';
const KILN=Object.freeze({version:1,chainId:'11155111',core:'0xfd6c166d4b8e2962e65746a13e5a0797cd4de0c4',round:'646',work:'514',dataHash:'0x'+'a'.repeat(64)});
const BASE=Object.freeze({image:IMAGE,companionId:'8891',hadSim:false,turns:12.5});
const OPTIONS=Object.freeze({lang:'en',glazeName:'Amethyst',surfaceName:'Gloss',orderCaption:'Order · 4 / 5 complete',timeLabel:'2026-11-08 · UTC+8'});
let calls=[],decoded=[],lastCanvas,total=0,passed=0;
class Context{
 constructor(){this.fillStyle='';this.strokeStyle='';this.font='10px sans-serif';this.textAlign='left';this.globalCompositeOperation='source-over';this.stack=[];}
 measureText(value){
  const size=Number(this.font.match(/([\d.]+)px/)?.[1]??10);
  return {width:Array.from(value).reduce((sum,char)=>sum+size*(/[\u3400-\u9fff]/.test(char)?1:.56),0)};
 }
 fillText(text,x,y){calls.push({kind:'text',text,x,y,font:this.font,size:Number(this.font.match(/([\d.]+)px/)[1]),width:this.measureText(text).width,align:this.textAlign,color:this.fillStyle});}
 fillRect(...args){calls.push({kind:'fillRect',args,color:this.fillStyle});}
 strokeRect(...args){calls.push({kind:'strokeRect',args,color:this.strokeStyle});}
 beginPath(){calls.push({kind:'beginPath'});}
 moveTo(...args){calls.push({kind:'moveTo',args});}
 lineTo(...args){calls.push({kind:'lineTo',args});}
 stroke(){calls.push({kind:'stroke',color:this.strokeStyle});}
 drawImage(image,...args){calls.push({kind:'image',src:image.src,args,composite:this.globalCompositeOperation});}
 save(){this.stack.push({fillStyle:this.fillStyle,strokeStyle:this.strokeStyle,font:this.font,textAlign:this.textAlign,globalCompositeOperation:this.globalCompositeOperation});calls.push({kind:'save'});}
 restore(){Object.assign(this,this.stack.pop());calls.push({kind:'restore'});}
}
const previousImage=globalThis.Image,previousDocument=globalThis.document;
globalThis.Image=class{
 async decode(){decoded.push(this.src);[this.naturalWidth,this.naturalHeight]=this.src===WORDMARK?[600,180]:this.src===IMAGE?[1000,1100]:[430,430];}
};
globalThis.document={createElement(tag){
 assert.equal(tag,'canvas');const context=new Context();
 lastCanvas={width:0,height:0,getContext:type=>{assert.equal(type,'2d');return context;},toDataURL:type=>{assert.equal(type,'image/png');return 'data:image/png;base64,card';}};
 return lastCanvas;
}};
async function render(record=BASE,options=OPTIONS){
 calls=[];decoded=[];lastCanvas=null;
 const result=await drawCompanionCard(record,options);
 assert.equal(result,'data:image/png;base64,card');assert.equal(lastCanvas.width,1200);assert.equal(lastCanvas.height,1500);
 return {calls:structuredClone(calls),texts:calls.filter(call=>call.kind==='text'),images:calls.filter(call=>call.kind==='image'),decoded:[...decoded]};
}
function text(card,value){const result=card.texts.find(call=>call.text===value);assert.ok(result,`没有绘制文字：${value}`);return result;}
function status(card){return card.texts.find(call=>call.x===1112&&call.y===1226)?.text;}
function noNftClaim(card){assert.doesNotMatch(card.texts.map(call=>call.text).join('\n'),/\bNFT\b|\bminted\b|\btoken\b|已铸造|已铸成|铸币/i);}
async function check(name,test){
 total++;try{await test();passed++;console.log('PASS '+name);}catch(error){console.error('FAIL '+name);console.error(error.stack);}
}

try{
 await check('无窑烧记录保留旧卡尺寸、身份、图片和底部布局',async()=>{
  const card=await render();
  assert.equal(text(card,'LIVE MODE').y,177);assert.equal(text(card,'Squeektoshi').y,1114);
  assert.equal(text(card,'Color inspiration · Sepolia sample').y,884);assert.equal(text(card,'Squeek #8891').y,805);
  assert.equal(text(card,'12.5 pottery-wheel turns').y,1240);assert.equal(text(card,OPTIONS.timeLabel).y,1240);
  assert.equal(text(card,OPTIONS.orderCaption).y,1291);assert.equal(text(card,OPTIONS.orderCaption).size,23);
  assert.equal(text(card,'Make the next one yours.').y,1395);assert.equal(text(card,'Community creation · Not an official release').y,1439);
  assert.equal(status(card),undefined);assert.equal(card.texts.some(call=>/KILN|Round 646/.test(call.text)),false);
  assert.deepEqual(card.decoded,[IMAGE,WORDMARK,CHARACTER]);assert.equal(card.images.length,3);noNftClaim(card);
 });

 await check('无效窑烧数据即使带 verified 选项也与旧卡绘制调用完全一致',async()=>{
  const baseline=await render();
  for(const kiln of [undefined,null,{}, {...KILN,round:'0646'},{...KILN,work:'10001'},{...KILN,chainId:'1'},{...KILN,core:'0x'+'0'.repeat(40)},{...KILN,dataHash:'0x'+'0'.repeat(64)}]){
   const card=await render({...BASE,kiln},{...OPTIONS,verifiedKiln:true});
   assert.deepEqual(card.calls,baseline.calls);assert.deepEqual(card.decoded,baseline.decoded);
  }
 });

 await check('普通本地与分享记录默认标待核验，不接受记录自报的核验或 NFT 身份',async()=>{
  for(const extra of [{},{source:'share',verifiedKiln:true,verified:true,minted:true,tokenId:'999',nft:{verified:true,minted:true}}]){
   const card=await render({...BASE,...extra,kiln:{...KILN,verified:true,verifiedKiln:true,minted:true}});
   assert.equal(status(card),'Sepolia · Source unverified');text(card,'ROUND-BASED KILN');text(card,'Round 646 · Work 514');
   assert.equal(text(card,'MAKING POWER · LIVE').y,177);text(card,'Real hamster wheel data');noNftClaim(card);
  }
 });

 await check('仅调用方明确传入 boolean true 才标链上来源已核验',async()=>{
  const record={...BASE,kiln:KILN};
  for(const value of [undefined,false,'true',1,{},null]){
   const card=await render(record,{...OPTIONS,verifiedKiln:value});assert.equal(status(card),'Sepolia · Source unverified');
  }
  const card=await render(record,{...OPTIONS,verifiedKiln:true});assert.equal(status(card),'Sepolia · Source verified');noNftClaim(card);
  const noRecord=await render(BASE,{...OPTIONS,verifiedKiln:true});assert.equal(status(noRecord),undefined);
 });

 await check('制作动力 SIM/Live 与回合来源核验分别显示，SIM 不冒称真实跑轮',async()=>{
  const cases=[
   [{hadSim:true},'MAKING POWER · SIM','Simulated wheel','A simulation of Squeektoshi’s wheel'],
   [{hadSim:false,order:{hadSim:true}},'MAKING POWER · SIM','Simulated wheel','A simulation of Squeektoshi’s wheel'],
   [{hadSim:false,order:{hadSim:false}},'MAKING POWER · LIVE','Squeektoshi','Real hamster wheel data'],
   [{hadSim:undefined},'MAKING POWER · NOT RECORDED','Not recorded','This piece has no saved wheel source'],
  ];
  for(const [patch,heading,power,detail] of cases){
   const card=await render({...BASE,...patch,kiln:KILN},{...OPTIONS,verifiedKiln:true});
   assert.equal(text(card,heading).y,177);assert.equal(text(card,power).y,1114);assert.equal(text(card,detail).y,1154);
   assert.equal(text(card,'WHEEL POWER').y,1066);assert.equal(text(card,'ROUND-BASED KILN').y,1226);assert.equal(status(card),'Sepolia · Source verified');
   if(heading.endsWith('SIM'))assert.equal(card.texts.some(call=>call.text==='Real hamster wheel data'),false);
  }
 });

 await check('中英文保留完整 uint64 round 与零 work，不赋予 sleep 标签',async()=>{
  const kiln={...KILN,round:'18446744073709551615',work:'0',dataHash:'0x'+'0'.repeat(64)};
  for(const lang of ['zh','en'])for(const verifiedKiln of [false,true]){
   const card=await render({...BASE,hadSim:true,kiln},{...OPTIONS,lang,verifiedKiln});
   const details=text(card,'Round 18446744073709551615 · Work 0');assert.equal(details.y,1254);assert.equal(details.size,21);assert.ok(details.width<=1024);
   assert.equal(status(card),lang==='zh'?(verifiedKiln?'Sepolia · 链上来源已核验':'Sepolia · 来源待核验'):(verifiedKiln?'Sepolia · Source verified':'Sepolia · Source unverified'));
   text(card,lang==='zh'?'制作动力 · SIM':'MAKING POWER · SIM');text(card,lang==='zh'?'回合窑烧':'ROUND-BASED KILN');
   assert.doesNotMatch(card.texts.map(call=>call.text).join('\n'),/sleep|休眠|睡眠/i);noNftClaim(card);
  }
 });

 await check('窑烧条与圈数、时间、订单各占独立行，不扩大卡片或移动上半部',async()=>{
  const baseline=await render(),card=await render({...BASE,kiln:{...KILN,round:'18446744073709551615',work:'10000'}});
  const box=card.calls.find(call=>call.kind==='fillRect'&&call.args[1]===1204);assert.deepEqual(box.args,[70,1204,1060,62]);
  assert.deepEqual(card.images,baseline.images);
  assert.deepEqual(card.texts.filter(call=>call.y<1190&&call.y!==177),baseline.texts.filter(call=>call.y<1190&&call.y!==177));
  assert.equal(text(card,'12.5 pottery-wheel turns').y,1294);assert.equal(text(card,OPTIONS.timeLabel).y,1294);
  const order=text(card,OPTIONS.orderCaption);assert.equal(order.y,1324);assert.equal(order.size,18);
  assert.ok(order.y+order.size*.25<1342);assert.ok(card.calls.some(call=>call.kind==='lineTo'&&call.args[1]===1342));
  assert.deepEqual(card.texts.filter(call=>call.y>1342),baseline.texts.filter(call=>call.y>1342));
  const title=text(card,'ROUND-BASED KILN'),source=card.texts.find(call=>call.text===status(card));
  assert.ok(title.x+title.width<source.x-source.width,'窑烧标题与来源状态不重叠');
  for(const call of card.texts.filter(call=>call.y>=1204&&call.y<=1324)){
   const left=call.align==='right'?call.x-call.width:call.x,right=call.align==='right'?call.x:call.x+call.width;
   assert.ok(left>=70&&right<=1130,`底部文字超出安全边界：${call.text}`);
  }
 });

 await check('长订单在窑烧布局中缩字或省略，仍与下方分隔线分离',async()=>{
  const card=await render({...BASE,kiln:KILN},{...OPTIONS,orderCaption:'A long order '.repeat(80)});
  const order=card.texts.find(call=>call.x===70&&call.y===1324);assert.ok(order);assert.equal(order.size,16);assert.ok(order.text.endsWith('…'));assert.ok(order.width<=1060);
  assert.equal(text(card,'Round 646 · Work 514').y,1254);assert.equal(text(card,'Make the next one yours.').y,1395);
 });

 await check('窑烧元数据不触发额外图片请求，也不修改记录和原有身份',async()=>{
  const kiln=Object.freeze({...KILN,image:'https://example.invalid/untrusted.png',imageSrc:'https://example.invalid/other.png'});
  const record=Object.freeze({...BASE,companionId:undefined,kiln}),before=JSON.stringify(record);
  const card=await render(record);assert.deepEqual(card.decoded,[IMAGE,WORDMARK]);assert.equal(JSON.stringify(record),before);
  text(card,'The original identity is preserved');assert.equal(card.texts.some(call=>/Squeek #/.test(call.text)),false);assert.equal(status(card),'Sepolia · Source unverified');noNftClaim(card);
 });
}finally{
 if(previousImage===undefined)delete globalThis.Image;else globalThis.Image=previousImage;
 if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
}
console.log(`RESULT ${passed}/${total}`);
if(passed!==total)process.exitCode=1;
