/* 使用真实 Three 几何与材质，仅替换 GPU/浏览器边界来验证预览调度。 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import * as Three from '../vendor/three.module.min.js';
const require=createRequire(import.meta.url),Pottery=require('../engine.js');
let nextFrame=0,total=0;
const frames=new Map(),renderers=[];
globalThis.window={Pottery};globalThis.devicePixelRatio=2;
globalThis.requestAnimationFrame=callback=>{const id=++nextFrame;frames.set(id,callback);return id;};
globalThis.cancelAnimationFrame=id=>frames.delete(id);
function step(){const first=frames.entries().next().value;assert.ok(first,'expected a pending frame');frames.delete(first[0]);first[1]();}
function context2d(){return new Proxy({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),createRadialGradient:()=>({addColorStop(){}})},{get:(target,key)=>key in target?target[key]:()=>{}});}
function canvas(){return {width:640,height:480,clientWidth:640,clientHeight:480,dataset:{},style:{},getContext:()=>context2d(),addEventListener(){},getBoundingClientRect:()=>({width:640,height:480,left:0,top:0}),hasPointerCapture:()=>false,toDataURL:()=> 'data:image/png;base64,test'};}
globalThis.document={createElement:()=>canvas(),body:{dataset:{}}};
globalThis.ResizeObserver=class{constructor(callback){this.callback=callback;}observe(){}disconnect(){}};
class Renderer{
 constructor({canvas}){this.canvas=canvas;this.shadowMap={};this.capabilities={getMaxAnisotropy:()=>8};this.size=new Three.Vector2(640,480);this.renders=0;this.shadows=0;this.pixelRatio=1;renderers.push(this);}
 setPixelRatio(v){this.pixelRatio=v;}getPixelRatio(){return this.pixelRatio;}setClearColor(){}setSize(w,h){this.size.set(w,h);}getSize(v){return v.copy(this.size);}
 render(_scene,camera){this.renders++;this.camera=camera.position.clone();if(this.shadowMap.autoUpdate||this.shadowMap.needsUpdate)this.shadows++;this.shadowMap.needsUpdate=false;}
 dispose(){this.disposed=true;}
}
class PMREM{fromScene(){return {texture:new Three.Texture(),dispose(){}};}dispose(){}}
class Clock{getDelta(){return .016;}}
globalThis.__previewThree={...Three,WebGLRenderer:Renderer,PMREMGenerator:PMREM,Clock};
const path=new URL('../scene.js',import.meta.url);
const source=fs.readFileSync(path,'utf8').replace("import * as THREE from './vendor/three.module.min.js';","const THREE=globalThis.__previewThree;").replace("'./glazes.js'",JSON.stringify(new URL('../glazes.js',import.meta.url).href));
const {createStudio}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function check(name,test){test();assert.equal(frames.size,0,'test left scheduled work');total++;console.log('PASS '+name);}
function preview(callbacks={}){const scene=createStudio(canvas(),{presentationOnly:true,...callbacks});return [scene,renderers.at(-1)];}
check('预览首次绘制后停止，连续设置合并为一帧',()=>{
 const [scene,r]=preview();scene.setPhase('glaze');scene.setGlaze('jade');scene.setSurface('flow');assert.equal(frames.size,1);step();assert.equal(r.renders,1);assert.equal(r.shadows,1);assert.equal(frames.size,0);scene.dispose();
});
check('相同镜头不会唤醒预览，相机变化重绘但复用阴影',()=>{
 const [scene,r]=preview();step();scene.setPresentationView(.28,.24);assert.equal(frames.size,0);scene.setPresentationView(.4,.3);step();assert.equal(r.renders,2);assert.equal(r.shadows,1);scene.dispose();
});
check('材质或器形变化会刷新预览及阴影',()=>{
 const [scene,r]=preview();step();scene.setPhase('glaze');scene.setFinish(.5);step();assert.equal(r.shadows,2);const shape=Pottery.profile();shape[50]+=.01;scene.setProfile(shape);step();assert.equal(r.shadows,3);scene.dispose();
});
check('离屏取消待绘帧，回到页面保留镜头；销毁后无绘制',()=>{
 const [scene,r]=preview();step();scene.setPresentationView(.8,.3);scene.setVisible(false);assert.equal(frames.size,0);assert.equal(r.renders,1);scene.setVisible(true);step();assert.equal(r.renders,2);assert.ok(Math.abs(r.camera.x-Math.sin(.8)*7.5)<1e-10);assert.equal(r.shadows,1);scene.setPresentationView(.9,.3);scene.dispose();assert.equal(frames.size,0);
});
check('预览可用onTick完成有限缓动，停止返回后不保留常驻帧',()=>{
 let ticks=0;let scene;[scene]=preview({onTick:()=>{ticks++;scene.setPresentationView(.28+ticks*.01,.24);return ticks<3;}});step();step();step();assert.equal(ticks,3);assert.equal(frames.size,0);scene.dispose();
});
check('工作台持续推进转速和回调，不使用预览阴影缓存',()=>{
 const node=canvas();let ticks=0;const scene=createStudio(node,{onTick:()=>ticks++}),r=renderers.at(-1);const first=Number(node.dataset.motorRpm);step();step();assert.ok(Number(node.dataset.motorRpm)>first);assert.equal(ticks,3);assert.equal(r.renders,3);assert.equal(r.shadows,3);assert.equal(frames.size,1);scene.dispose();
});
check('动态首页在离屏时取消时钟，返回后恢复同一镜头和惯性',()=>{
 const node=canvas();let ticks=0;
 const scene=createStudio(node,{animatedPreview:true,onTick:()=>ticks++}),r=renderers.at(-1);
 scene.setRpm(18);scene.setPresentationView(.65,.18);step();const before=ticks;
 scene.setVisible(false);assert.equal(frames.size,0);assert.equal(ticks,before);
 scene.setVisible(true);assert.equal(frames.size,1);step();assert.equal(ticks,before+1);
 assert.ok(Math.abs(r.camera.x-Math.sin(.65)*7.5)<1e-10);
 scene.dispose();assert.equal(frames.size,0);
});

// 让真实工作台先转起来，再从渲染场景读取实际 rotor，避免只测试静止预览。
function spinningCapture(){
 const node=canvas(),scene=createStudio(node),r=renderers.at(-1),originalRender=r.render.bind(r);let renderedScene;
 r.render=(world,camera)=>{renderedScene=world;originalRender(world,camera);};
 scene.setRpm(42);scene.setPresentationView(.91,.37);step();step();
 const body=renderedScene.children.find(child=>child.isGroup),rotor=body.children.find(child=>child.isGroup);
 assert.ok(rotor.rotation.y>0);
 return {node,scene,r,rotor};
}
check('导出固定正面，恢复视角尺寸与转盘朝向且下一帧物理角度连续',()=>{
 const {node,scene,r,rotor}=spinningCapture(),rotation=rotor.rotation.y,rpm=scene.rpm,camera=r.camera.clone(),ratio=r.getPixelRatio(),size=r.getSize(new Three.Vector2()),wheelAngle=node.dataset.wheelAngle;
 node.toDataURL=()=>{
  assert.equal(rotor.rotation.y,0);assert.ok(Math.abs(r.camera.x-Math.sin(.28)*7.5)<1e-10);
  assert.deepEqual(r.getSize(new Three.Vector2()).toArray(),[1200,1500]);assert.equal(r.getPixelRatio(),1);
  return 'data:image/png;base64,captured';
 };
 assert.equal(scene.capture(1200,1500),'data:image/png;base64,captured');
 assert.equal(rotor.rotation.y,rotation);assert.equal(scene.rpm,rpm);assert.equal(node.dataset.wheelAngle,wheelAngle);
 assert.deepEqual(r.camera.toArray(),camera.toArray());assert.deepEqual(r.getSize(new Three.Vector2()).toArray(),size.toArray());assert.equal(r.getPixelRatio(),ratio);
 const expected=rotation+Pottery.stepMotor(rpm,42,.016)/60*Math.PI*2*.016;step();assert.ok(Math.abs(rotor.rotation.y-expected)<1e-12,'capture must not reset the physical angle');
 scene.dispose();
});
check('截图编码失败仍恢复正在运行的转盘和镜头，不清零真实角度',()=>{
 const {node,scene,r,rotor}=spinningCapture(),rotation=rotor.rotation.y,rpm=scene.rpm,camera=r.camera.clone(),ratio=r.getPixelRatio(),size=r.getSize(new Three.Vector2()),failure=new Error('fixture: PNG encoding failed');
 node.toDataURL=()=>{assert.equal(rotor.rotation.y,0);throw failure;};
 assert.throws(()=>scene.capture(700,900),error=>error===failure);
 assert.equal(rotor.rotation.y,rotation);assert.equal(scene.rpm,rpm);assert.deepEqual(r.camera.toArray(),camera.toArray());
 assert.deepEqual(r.getSize(new Three.Vector2()).toArray(),size.toArray());assert.equal(r.getPixelRatio(),ratio);
 const expected=rotation+Pottery.stepMotor(rpm,42,.016)/60*Math.PI*2*.016;step();assert.ok(Math.abs(rotor.rotation.y-expected)<1e-12);
 scene.dispose();
});
console.log(`RESULT ${total}/${total}`);
