/* 配方用独立 BigInt oracle；渲染只替换浏览器/GPU 边界，不声称像素等价或 GPU FPS。 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import * as Three from '../vendor/three.module.min.js';
import {cleanKilnRecord,kilnRecipe} from '../kiln-art.js';
import {materialFor} from '../glazes.js';

const require=createRequire(import.meta.url),Pottery=require('../engine.js');
const CORE='0xfd6c166d4b8e2962e65746a13e5a0797cd4de0c4';
const ZERO_HASH='0x'+'0'.repeat(64);
const BASE={version:1,chainId:'11155111',core:CORE,round:'646',work:'514',dataHash:'0xdeadbeef'+'1234567890abcdef'.repeat(3)+'12345678'};
const record=overrides=>({...BASE,...overrides});
let total=0,passed=0,nextFrame=0,frameTime=0;
const frames=new Map(),renderers=[];
function check(name,test){
 total++;
 try{test();assert.equal(frames.size,0,'测试不能遗留 RAF');passed++;console.log('PASS '+name);}
 catch(error){console.error('FAIL '+name);console.error(error.stack);frames.clear();}
}
function close(actual,expected,message){assert.ok(Math.abs(actual-expected)<1e-12,message??`${actual} != ${expected}`);}

check('记录规范化为独立冻结对象，剥离无关字段，不修改输入',()=>{
 const input=record({core:CORE.toUpperCase(),dataHash:BASE.dataHash.toUpperCase().replace('0X','0x'),unused:'discard'}),before={...input};
 const clean=cleanKilnRecord(input);
 assert.deepEqual(clean,BASE);assert.notEqual(clean,input);assert.ok(Object.isFrozen(clean));assert.deepEqual(input,before);
 assert.throws(()=>{clean.round='1';},TypeError);
 input.round='999';assert.equal(clean.round,'646');
 const recipe=kilnRecipe(BASE);assert.ok(Object.isFrozen(recipe));assert.ok(Object.isFrozen(recipe.record));
 assert.deepEqual(Object.keys(recipe).sort(),['record','seed32','energyBps','phase','flow'].sort());
});

check('仅接受固定版本、Sepolia 字符串 chainId 与正确 Core',()=>{
 for(const input of [null,undefined,false,0,'record',[],()=>BASE])assert.equal(cleanKilnRecord(input),null);
 for(const version of [undefined,null,'1',0,2,1n,new Number(1)])assert.equal(cleanKilnRecord(record({version})),null);
 for(const chainId of [undefined,null,11155111,'1','011155111','11155111 ','0xaa36a7'])assert.equal(cleanKilnRecord(record({chainId})),null);
 for(const core of [undefined,null,0,CORE.slice(0,-1),' '+CORE,CORE.replace('fd6c','ad6c')])assert.equal(cleanKilnRecord(record({core})),null);
 const throwing=Object.defineProperty({},'version',{get(){throw new Error('untrusted getter');}});
 assert.doesNotThrow(()=>cleanKilnRecord(throwing));assert.equal(cleanKilnRecord(throwing),null);
});

check('round 与 work 拒绝非规范十进制和有损数字类型',()=>{
 const malformed=['',' ','01','00','+1','-1','1.0','1e2','0x1','1 ',' 1','1\n','1_000','１２','NaN','Infinity'];
 for(const field of ['round','work'])for(const value of [...malformed,undefined,null,false,1,1n,NaN,Infinity,new String('1')]){
  assert.equal(cleanKilnRecord(record({[field]:value})),null,`${field}: ${String(value)}`);
  assert.equal(kilnRecipe(record({[field]:value})),null);
 }
});

check('round 完整覆盖 uint64 边界，work 完整覆盖 0..10000',()=>{
 for(const round of ['1','4294967296','9007199254740993','18446744073709551615'])assert.equal(cleanKilnRecord(record({round})).round,round);
 for(const round of ['0','18446744073709551616','9'.repeat(1000)])assert.equal(cleanKilnRecord(record({round})),null);
 for(const work of ['0','1','499','500','9999','10000'])assert.equal(cleanKilnRecord(record({work})).work,work);
 for(const work of ['10001','65535','100000','9'.repeat(1000)])assert.equal(cleanKilnRecord(record({work})),null);
});

check('哈希严格为 32 字节 hex，正工作量不能配零哈希',()=>{
 for(const dataHash of [undefined,null,1,'',ZERO_HASH.slice(2),'0X'+'a'.repeat(64),'0x'+'a'.repeat(63),'0x'+'a'.repeat(65),'0x'+'g'.repeat(64),BASE.dataHash+' ',ZERO_HASH]){
  assert.equal(cleanKilnRecord(record({dataHash})),null,String(dataHash));
 }
 assert.equal(cleanKilnRecord(record({dataHash:'0x'+'A'.repeat(64)})).dataHash,'0x'+'a'.repeat(64));
 assert.ok(cleanKilnRecord(record({dataHash:'0x'+'0'.repeat(63)+'1'})));
});

check('零工作量允许零哈希与非零哈希，不推导 sleep 状态',()=>{
 for(const dataHash of [ZERO_HASH,BASE.dataHash]){
  const clean=cleanKilnRecord(record({work:'0',dataHash})),recipe=kilnRecipe(clean);
  assert.ok(clean);assert.equal(recipe.energyBps,0);assert.equal(recipe.flow,.18);
  assert.deepEqual(Object.keys(clean).sort(),['version','chainId','core','round','work','dataHash'].sort());
  assert.ok(!JSON.stringify(recipe).toLowerCase().includes('sleep'));
 }
});

// 全哈希先右移 224 位，再按 Solidity uint32 取模；不复用实现的 parseInt/Number 位运算。
function seedOracle(input){
 const mask=(1n<<32n)-1n;
 return Number(((BigInt(input.dataHash)>>224n)&mask)^(BigInt(input.round)&mask)^(BigInt(input.work)&mask));
}
check('独立 BigInt oracle 验证首 4 字节与 uint32 截断、符号位和大 round',()=>{
 const vectors=[
  record(),
  record({round:'1',work:'1',dataHash:'0x'+'0'.repeat(63)+'1'}),
  record({round:'4294967296',work:'0',dataHash:'0x80000000'+'0'.repeat(56)}),
  record({round:'9007199254740993',work:'10000',dataHash:'0xffffffff'+'0'.repeat(56)}),
  record({round:'18446744073709551615',work:'10000',dataHash:'0xffffffff'+'f'.repeat(56)}),
  record({round:'18446744073709551615',work:'0',dataHash:ZERO_HASH}),
 ];
 // 可重复广覆盖输入；BigInt 生成器与实现中的 32 位 Number 运算独立。
 let state=0x123456789abcdefn;
 const next=()=>{state=(state*6364136223846793005n+1442695040888963407n)&((1n<<64n)-1n);return state;};
 for(let i=0;i<64;i++){
  const round=String(next()||1n),work=String(next()%10001n);
  const dataHash='0x'+Array.from({length:4},()=>next().toString(16).padStart(16,'0')).join('');
  vectors.push(record({round,work,dataHash}));
 }
 for(const input of vectors){
  const recipe=kilnRecipe(input),expected=seedOracle(input);
  assert.equal(recipe.seed32,expected);assert.ok(Number.isInteger(recipe.seed32)&&recipe.seed32>=0&&recipe.seed32<=4294967295);
  close(recipe.phase,Number(BigInt(expected)%6283n)/1000);assert.ok(recipe.phase>=0&&recipe.phase<=6.282);
  assert.deepEqual(kilnRecipe(JSON.parse(JSON.stringify(input))),recipe);
 }
 assert.equal(kilnRecipe(vectors[1]).seed32,0,'有效记录的零 seed 不等于无记录');
 assert.equal(kilnRecipe(vectors[2]).seed32,2147483648,'最高位必须保留为无符号');
});

check('配方只用哈希前 4 字节，round 每 2^32 保留相同低位',()=>{
 const first=record({round:'1',work:'514'}),suffix=record({round:'1',dataHash:BASE.dataHash.slice(0,10)+'f'.repeat(56)});
 assert.equal(kilnRecipe(first).seed32,kilnRecipe(suffix).seed32);
 assert.equal(kilnRecipe(first).seed32,kilnRecipe({...first,round:'4294967297'}).seed32);
 assert.notEqual(kilnRecipe(first).seed32,kilnRecipe({...first,dataHash:'0x01020304'+BASE.dataHash.slice(10)}).seed32);
});

check('工作量改变能量和流动强度，并在 500 work 起饱和',()=>{
 for(const [work,energyBps,flow] of [['0',0,.18],['1',20,.18124],['100',2000,.304],['499',9980,.79876],['500',10000,.8],['514',10000,.8],['10000',10000,.8]]){
  const recipe=kilnRecipe(record({work}));assert.equal(recipe.energyBps,energyBps);close(recipe.flow,flow);
 }
 const low=kilnRecipe(record({work:'1'})),high=kilnRecipe(record({work:'500'}));
 assert.ok(high.flow-low.flow>.6);assert.ok(high.energyBps>low.energyBps);assert.notEqual(high.seed32,low.seed32);
 assert.notEqual(kilnRecipe(record({work:'500'})).seed32,kilnRecipe(record({work:'10000'})).seed32,'饱和后不同 work 仍进入种子');
});

globalThis.window={Pottery};globalThis.devicePixelRatio=2;
globalThis.requestAnimationFrame=callback=>{const id=++nextFrame;frames.set(id,callback);return id;};
globalThis.cancelAnimationFrame=id=>frames.delete(id);
function step(){const first=frames.entries().next().value;assert.ok(first,'需要待绘制帧');frames.delete(first[0]);frameTime+=16;first[1](frameTime);}
function context2d(){return new Proxy({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),createRadialGradient:()=>({addColorStop(){}})},{get:(target,key)=>key in target?target[key]:()=>{}});}
function canvas(){return {width:640,height:480,clientWidth:640,clientHeight:480,dataset:{},style:{},getContext:()=>context2d(),addEventListener(){},getBoundingClientRect:()=>({width:640,height:480,left:0,top:0}),hasPointerCapture:()=>false,toDataURL:()=> 'data:image/png;base64,kiln'};}
globalThis.document={createElement:()=>canvas(),body:{dataset:{}}};
globalThis.ResizeObserver=class{observe(){}disconnect(){}};
class Renderer{
 constructor(){this.shadowMap={};this.capabilities={getMaxAnisotropy:()=>8};this.size=new Three.Vector2(640,480);this.renders=0;this.shadows=0;this.pixelRatio=1;this.info={render:{calls:0,triangles:0}};renderers.push(this);}
 setPixelRatio(value){this.pixelRatio=value;}getPixelRatio(){return this.pixelRatio;}setClearColor(){}setSize(w,h){this.size.set(w,h);}getSize(value){return value.copy(this.size);}compile(){}
 render(world,camera){
  this.world=world;this.camera=camera.position.clone();this.renders++;
  if(this.shadowMap.autoUpdate||this.shadowMap.needsUpdate)this.shadows++;
  this.shadowMap.needsUpdate=false;this.info.render={calls:0,triangles:0};
  // 统计场景提交的可见 mesh；这是结构回归指标，并非实际 GPU draw calls。
  world.traverseVisible(object=>{if(object.isMesh){this.info.render.calls++;this.info.render.triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;}});
 }
 dispose(){}
}
class PMREM{fromScene(){return {texture:new Three.Texture(),dispose(){}};}dispose(){}}
class TextureLoader{load(){return new Three.Texture();}}
globalThis.__kilnTestThree={...Three,WebGLRenderer:Renderer,PMREMGenerator:PMREM,TextureLoader};
const sceneUrl=new URL('../scene.js',import.meta.url);
const sceneSource=fs.readFileSync(sceneUrl,'utf8')
 .replace("import * as THREE from './vendor/three.module.min.js';",'const THREE=globalThis.__kilnTestThree;')
 // data: 模块没有相对 URL 基址；其余源码 import 全部指向真实绝对 URL。
 .replace(/(\bfrom\s*)(['"])(\.[^'"]+)\2/g,(_,prefix,quote,path)=>prefix+JSON.stringify(new URL(path,sceneUrl).href));
const {createStudio}=await import('data:text/javascript;base64,'+Buffer.from(sceneSource).toString('base64'));
function fixture(options={presentationOnly:true}){
 const node=canvas(),scene=createStudio(node,options),renderer=renderers.at(-1);
 return {node,scene,renderer,draw:()=>options.filmCapture?scene.renderFilmFrame({dt:0,width:640,height:480,motorRpm:0}):step()};
}
function withScene(options,test){const f=fixture(options);try{test(f);}finally{f.scene.dispose();}}
function renderedPot(renderer){let pot;renderer.world.traverse(object=>{if(object.isMesh&&object.material.isMeshPhysicalMaterial)pot=object;});assert.ok(pot);return pot;}
function potteryShader(material){const shader={uniforms:{},vertexShader:Three.ShaderLib.physical.vertexShader,fragmentShader:Three.ShaderLib.physical.fragmentShader};material.onBeforeCompile(shader);return shader;}
const kilnUniformNames=['potteryKilnEnabled','potteryKilnReveal','potteryKilnEnergy','potteryKilnPhase','potteryKilnFlow','potteryKilnSeed'];
function uniformSnapshot(shader){return Object.fromEntries(kilnUniformNames.map(name=>[name,shader.uniforms[name].value?.isVector2?shader.uniforms[name].value.toArray():shader.uniforms[name].value]));}
function datasetSnapshot(node){return Object.fromEntries(Object.entries(node.dataset).filter(([key])=>key.startsWith('kiln')));}
function assertRecipe(shader,input){
 const expected=kilnRecipe(input),u=shader.uniforms;
 assert.equal(u.potteryKilnEnabled.value,1);close(u.potteryKilnEnergy.value,expected.energyBps/10000);
 close(u.potteryKilnPhase.value,expected.phase);close(u.potteryKilnFlow.value,expected.flow);
 const halves=u.potteryKilnSeed.value;
 const restored=Math.round(halves.x*65535)+Math.round(halves.y*65535)*65536;
 assert.equal(restored,seedOracle(input),'16 位分量必须保留全部 32 位种子');
}
const modes=[
 ['工作台',{}],['静态分享页',{presentationOnly:true}],['首页',{animatedPreview:true}],
 ['首页片头',{animatedPreview:true,heroReveal:true,heroLaser:true,heroCraft:true,sealUrl:'fixture-seal.svg'}],
 ['逐帧影片',{filmCapture:true}],['预热工作台',{prewarm:true}],
];
check('所有模式默认关闭窑变，素坯不注入窑变 uniform，釉面显影默认完整',()=>{
 for(const [name,options] of modes)withScene(options,({node,scene,renderer,draw})=>{
  draw();const clayShader=potteryShader(renderedPot(renderer).material);
  for(const key of kilnUniformNames)assert.equal(clayShader.uniforms[key],undefined,name);
  scene.setPhase('glaze');draw();const shader=potteryShader(renderedPot(renderer).material);
  assert.equal(shader.uniforms.potteryKilnEnabled.value,0,name);assert.equal(shader.uniforms.potteryKilnReveal.value,1,name);
  assert.equal(shader.uniforms.potteryKilnEnergy.value,0);assert.equal(node.dataset.kilnReveal,'1.0000');
  for(const key of ['kilnRound','kilnWork','kilnSeed'])assert.equal(node.dataset[key],undefined);
  assert.match(shader.fragmentShader,/if\(potteryKilnEnabled>0\.5&&potteryKilnReveal>0\.0\)/);
  assert.match(shader.fragmentShader,/float kilnRoughness=0\.0;/);
  assert.equal(scene.setKiln(BASE),true);assertRecipe(shader,BASE);draw();
 });
});

check('所有表面保留所选釉色与材质，重复 setKiln 只更新共享 uniform',()=>{
 for(const surface of ['glossy','matte','speckle','flow'])withScene({presentationOnly:true},({node,scene,renderer,draw})=>{
  scene.setPhase('glaze');scene.setGlaze('cobalt');scene.setSurface(surface);scene.setFinish(.61);draw();
  const pot=renderedPot(renderer),material=pot.material,geometry=pot.geometry,position=geometry.attributes.position;
  const before={materialVersion:material.version,positionVersion:position.version,normalVersion:geometry.attributes.normal.version,key:material.customProgramCacheKey(),shadows:renderer.shadows,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
  const shader=potteryShader(material),secondShader=potteryShader(material),seedVector=shader.uniforms.potteryKilnSeed.value,spec=materialFor('cobalt',surface,.61);
  for(const key of kilnUniformNames)assert.equal(shader.uniforms[key],secondShader.uniforms[key]);
  assert.equal(material.color.getHexString(),new Three.Color(spec.color).getHexString());
  for(const input of [record({work:'1'}),record({work:'500'}),record({round:'18446744073709551615',work:'10000'})]){
   assert.equal(scene.setKiln(input),true);assertRecipe(shader,input);assertRecipe(secondShader,input);draw();
   assert.equal(node.dataset.kilnRound,input.round);assert.equal(node.dataset.kilnWork,input.work);assert.equal(node.dataset.kilnSeed,String(seedOracle(input)));
   assert.equal(pot.material,material);assert.equal(pot.geometry,geometry);assert.equal(geometry.attributes.position,position);
   assert.equal(material.version,before.materialVersion);assert.equal(position.version,before.positionVersion);assert.equal(geometry.attributes.normal.version,before.normalVersion);assert.equal(material.customProgramCacheKey(),before.key);
   assert.equal(shader.uniforms.potteryKilnSeed.value,seedVector);assert.equal(material.color.getHexString(),new Three.Color(spec.color).getHexString());
   assert.equal(shader.uniforms.potteryAccent.value.getHexString(),new Three.Color(spec.accent).getHexString());assert.equal(shader.uniforms.potterySurface.value,spec.mode);
   for(const key of ['roughness','clearcoat','clearcoatRoughness','metalness','bumpScale','envMapIntensity'])assert.equal(material[key],spec[key],key);
   assert.equal(renderer.shadows,before.shadows);assert.equal(renderer.info.render.calls,before.calls);assert.equal(renderer.info.render.triangles,before.triangles);
  }
  assert.equal(potteryShader(material).fragmentShader,shader.fragmentShader,'更新记录不能生成另一套 shader 源码');
 });
});

check('静态分享页的记录更新合并为一帧，不产生持续 RAF 或额外阴影',()=>withScene({presentationOnly:true},({scene,renderer,draw})=>{
 scene.setPhase('glaze');draw();assert.equal(frames.size,0);const renders=renderer.renders,shadows=renderer.shadows;
 scene.setKiln(record({work:'1'}));scene.setKiln(BASE);scene.setKilnReveal(.3);assert.equal(frames.size,1);
 draw();assert.equal(renderer.renders,renders+1);assert.equal(renderer.shadows,shadows);assert.equal(frames.size,0);
 scene.setVisible(false);scene.setKiln(record({work:'100'}));assert.equal(frames.size,0);scene.setVisible(true);assert.equal(frames.size,1);draw();assert.equal(frames.size,0);
}));

check('无效与 null 记录清空启用态、种子及 dataset，不留上一条记录',()=>withScene({presentationOnly:true},({node,scene,renderer,draw})=>{
 scene.setPhase('glaze');draw();const shader=potteryShader(renderedPot(renderer).material),seedVector=shader.uniforms.potteryKilnSeed.value;
 for(const invalid of [null,undefined,record({round:646}),record({chainId:'1'}),record({dataHash:ZERO_HASH})]){
  scene.setKiln(BASE);assertRecipe(shader,BASE);assert.equal(scene.setKiln(invalid),false);
  assert.deepEqual(uniformSnapshot(shader),{potteryKilnEnabled:0,potteryKilnReveal:1,potteryKilnEnergy:0,potteryKilnPhase:0,potteryKilnFlow:.18,potteryKilnSeed:[0,0]});
  assert.equal(shader.uniforms.potteryKilnSeed.value,seedVector);
  assert.deepEqual(datasetSnapshot(node),{kilnReveal:'1.0000'});draw();assert.equal(frames.size,0);
 }
 assert.equal(scene.setKiln(record({work:'0',dataHash:ZERO_HASH})),true);assertRecipe(shader,record({work:'0',dataHash:ZERO_HASH}));
 assert.equal(node.dataset.kilnWork,'0');assert.ok(!JSON.stringify(datasetSnapshot(node)).includes('sleep'));draw();
}));

check('显影值仅接受 finite number，钳制到 0..1，关闭时不唤醒静态页',()=>withScene({presentationOnly:true},({node,scene,renderer,draw})=>{
 scene.setPhase('glaze');draw();const shader=potteryShader(renderedPot(renderer).material);
 scene.setKilnReveal(.375);assert.equal(shader.uniforms.potteryKilnReveal.value,.375);assert.equal(node.dataset.kilnReveal,'0.3750');assert.equal(frames.size,0);
 for(const invalid of [NaN,Infinity,-Infinity,undefined,null,'0.5',false,{},[]])scene.setKilnReveal(invalid);
 assert.equal(shader.uniforms.potteryKilnReveal.value,.375);assert.equal(frames.size,0);
 scene.setKilnReveal(-2);assert.equal(shader.uniforms.potteryKilnReveal.value,0);scene.setKilnReveal(4);assert.equal(shader.uniforms.potteryKilnReveal.value,1);assert.equal(frames.size,0);
 scene.setKiln(BASE);draw();const shadows=renderer.shadows;
 scene.setKilnReveal(.25);assert.equal(frames.size,1);draw();assert.equal(shader.uniforms.potteryKilnReveal.value,.25);assert.equal(node.dataset.kilnReveal,'0.2500');assert.equal(renderer.shadows,shadows);
 scene.setKilnReveal(.25);assert.equal(frames.size,0);scene.setKilnReveal(-1);draw();assert.equal(shader.uniforms.potteryKilnReveal.value,0);scene.setKilnReveal(2);draw();assert.equal(shader.uniforms.potteryKilnReveal.value,1);
}));

check('各 studio 的窑变状态相互独立，shape/glaze 切换保留已选记录',()=>{
 const first=fixture({presentationOnly:true}),second=fixture({presentationOnly:true});
 try{
  first.scene.setPhase('glaze');second.scene.setPhase('glaze');step();step();
  const firstShader=potteryShader(renderedPot(first.renderer).material),secondShader=potteryShader(renderedPot(second.renderer).material);
  first.scene.setKiln(BASE);assertRecipe(firstShader,BASE);assert.equal(secondShader.uniforms.potteryKilnEnabled.value,0);
  for(const key of kilnUniformNames)assert.notEqual(firstShader.uniforms[key],secondShader.uniforms[key]);
  first.scene.setPhase('shape');step();assert.equal(potteryShader(renderedPot(first.renderer).material).uniforms.potteryKilnEnabled,undefined);
  first.scene.setPhase('glaze');step();assertRecipe(potteryShader(renderedPot(first.renderer).material),BASE);
 }finally{first.scene.dispose();second.scene.dispose();}
});

check('截图成功与编码抛错期间均继承窑变，恢复后仍共享同一配方与显影',()=>{
 for(const options of [{},{presentationOnly:true},{animatedPreview:true}])withScene(options,({node,scene,renderer,draw})=>{
  scene.setPhase('glaze');scene.setSurface('flow');scene.setKiln(BASE);scene.setKilnReveal(.42);scene.setPresentationView(.91,.37);draw();
  const material=renderedPot(renderer).material,shader=potteryShader(material),values=uniformSnapshot(shader),dataset=datasetSnapshot(node),references=kilnUniformNames.map(key=>shader.uniforms[key]);
  const before={camera:renderer.camera.toArray(),size:renderer.size.toArray(),ratio:renderer.getPixelRatio(),materialVersion:material.version,key:material.customProgramCacheKey()};
  const inspect=()=>{
   assert.deepEqual(uniformSnapshot(shader),values);assert.deepEqual(datasetSnapshot(node),dataset);assertRecipe(shader,BASE);
   assert.deepEqual(renderer.size.toArray(),[1200,1500]);assert.equal(renderer.getPixelRatio(),1);
   kilnUniformNames.forEach((key,index)=>assert.equal(shader.uniforms[key],references[index]));
  };
  const restored=()=>{
   assert.deepEqual(uniformSnapshot(shader),values);assert.deepEqual(datasetSnapshot(node),dataset);
   assert.deepEqual(renderer.camera.toArray(),before.camera);assert.deepEqual(renderer.size.toArray(),before.size);assert.equal(renderer.getPixelRatio(),before.ratio);
   assert.equal(material.version,before.materialVersion);assert.equal(material.customProgramCacheKey(),before.key);
   const newShader=potteryShader(material);kilnUniformNames.forEach((key,index)=>assert.equal(newShader.uniforms[key],references[index]));
  };
  node.toDataURL=()=>{inspect();return 'data:image/png;base64,kiln-capture';};assert.equal(scene.capture(1200,1500),'data:image/png;base64,kiln-capture');restored();
  const failure=new Error('fixture: encode failed');node.toDataURL=()=>{inspect();throw failure;};assert.throws(()=>scene.capture(1200,1500),error=>error===failure);restored();
 });
});

console.log(`RESULT ${passed}/${total}`);
if(passed!==total)process.exitCode=1;
