/* 使用真实 Three 几何与材质，仅替换 GPU/浏览器边界来验证预览调度。 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import * as Three from '../vendor/three.module.min.js';
const require=createRequire(import.meta.url),Pottery=require('../engine.js');
let nextFrame=0,total=0,frameTime=0,clockReads=0;
const frames=new Map(),renderers=[],environmentRooms=[];
globalThis.window={Pottery};globalThis.devicePixelRatio=2;
globalThis.requestAnimationFrame=callback=>{const id=++nextFrame;frames.set(id,callback);return id;};
globalThis.cancelAnimationFrame=id=>frames.delete(id);
function step(){const first=frames.entries().next().value;assert.ok(first,'expected a pending frame');frames.delete(first[0]);frameTime+=16;first[1](frameTime);}
function context2d(){return new Proxy({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),createRadialGradient:()=>({addColorStop(){}})},{get:(target,key)=>key in target?target[key]:()=>{}});}
function canvas(){const listeners={};return {width:640,height:480,clientWidth:640,clientHeight:480,dataset:{},style:{},getContext:()=>context2d(),addEventListener(type,callback){(listeners[type]??=[]).push(callback);},emit(type,event={}){for(const callback of listeners[type]||[])callback(event);},getBoundingClientRect:()=>({width:640,height:480,left:0,top:0}),hasPointerCapture:()=>false,toDataURL:()=> 'data:image/png;base64,test'};}
globalThis.document={createElement:()=>canvas(),body:{dataset:{}}};
globalThis.ResizeObserver=class{constructor(callback){this.callback=callback;}observe(){}disconnect(){}};
class Renderer{
 constructor(options){this.canvas=options.canvas;this.options=options;this.shadowMap={};this.capabilities={getMaxAnisotropy:()=>8};this.size=new Three.Vector2(640,480);this.renders=0;this.shadows=0;this.compiles=0;this.pixelRatio=1;this.info={render:{calls:0,triangles:0}};renderers.push(this);}
 setPixelRatio(v){this.pixelRatio=v;}getPixelRatio(){return this.pixelRatio;}setClearColor(color,alpha){this.clearColor=color;this.clearAlpha=alpha;}setSize(w,h){this.size.set(w,h);}getSize(v){return v.copy(this.size);}
 compile(world,camera){this.compiles++;this.compiledSize=this.size.clone();this.compiledAspect=camera.aspect;this.compiledWorld=world;}
 render(world,camera){this.world=world;this.renders++;this.camera=camera.position.clone();if(this.shadowMap.autoUpdate||this.shadowMap.needsUpdate)this.shadows++;this.shadowMap.needsUpdate=false;this.info.render={calls:0,triangles:0};world.traverse(object=>{if(object.isMesh){this.info.render.calls++;this.info.render.triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;}});}
 dispose(){this.disposed=true;}
}
class PMREM{fromScene(room){environmentRooms.push(room);return {texture:new Three.Texture(),dispose(){}};}dispose(){}}
class Clock{getDelta(){clockReads++;return .016;}}
const picking={calls:0,point:null};
class Raycaster extends Three.Raycaster{setFromCamera(point,camera){picking.point=point.clone();super.setFromCamera(point,camera);}intersectObject(){picking.calls++;return [];}}
globalThis.__previewThree={...Three,WebGLRenderer:Renderer,PMREMGenerator:PMREM,Clock,Raycaster};
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
check('工作台连续转动复用阴影，形状变化才重新投影',()=>{
 const node=canvas();let ticks=0;const scene=createStudio(node,{onTick:()=>ticks++}),r=renderers.at(-1);step();const first=Number(node.dataset.motorRpm);step();step();assert.ok(Number(node.dataset.motorRpm)>first);assert.equal(ticks,3);assert.equal(r.renders,3);assert.equal(r.shadows,1);
 const shape=Pottery.profile();shape[50]+=.02;scene.setProfile(shape);step();assert.equal(r.shadows,2);scene.orbitView(.2);step();assert.equal(r.shadows,2);assert.equal(frames.size,1);scene.dispose();
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
check('所有场景可见性同值不重置时钟，离屏无空转或采样',()=>{
 const changes=[],samples=[],node=canvas(),scene=createStudio(node,{onVisibility:(visible,now)=>changes.push({visible,now}),onFrame:sample=>samples.push(sample)});
 assert.deepEqual(changes.map(change=>change.visible),[true]);assert.ok(Number.isFinite(changes[0].now));
 step();const reads=clockReads;scene.setVisible(true);scene.setVisible(true);assert.equal(clockReads,reads);assert.equal(changes.length,1);
 scene.setVisible(false);assert.equal(frames.size,0);const hiddenReads=clockReads;scene.setVisible(false);assert.equal(clockReads,hiddenReads);assert.equal(samples.length,1);
 scene.setVisible(true);step();assert.equal(samples.length,2);assert.deepEqual(changes.map(change=>change.visible),[true,false,true]);scene.dispose();
});
check('逐帧采样保留原始 RAF 时间，包含渲染统计但不包含截图绘制',()=>{
 const samples=[],scene=createStudio(canvas(),{onFrame:sample=>samples.push(sample)}),r=renderers.at(-1);
 step();assert.equal(samples[0].now,frameTime);assert.equal(samples[0].phase,'shape');assert.equal(samples[0].visible,true);assert.ok(samples[0].renderMs>=0);assert.equal(samples[0].drawCalls,r.info.render.calls);assert.equal(samples[0].triangles,r.info.render.triangles);
 scene.setPhase('glaze');step();assert.equal(samples[1].now-samples[0].now,16);assert.equal(samples[1].phase,'glaze');
 const renders=r.renders;scene.capture();assert.equal(r.renders,renders+2);assert.equal(samples.length,2);scene.dispose();
});
check('工作台构造时预热真实画布，不推进游戏或冒充可见首帧',()=>{
 const node=canvas(),samples=[];node.getBoundingClientRect=()=>({width:820,height:600,left:0,top:1200});let ticks=0,ready=0;
 const beforeReads=clockReads,scene=createStudio(node,{prewarm:true,onTick:()=>ticks++,onReady:()=>ready++,onFrame:sample=>samples.push(sample)}),r=renderers.at(-1);
 assert.equal(r.compiles,1);assert.equal(r.renders,1);assert.equal(r.shadows,1);assert.deepEqual(r.compiledSize.toArray(),[820,600]);assert.equal(r.compiledAspect,820/600);assert.equal(clockReads,beforeReads);assert.equal(scene.rpm,0);assert.equal(ticks,0);assert.equal(ready,0);assert.equal(samples.length,0);
 const body=r.world.children.find(child=>child.isGroup),rotor=body.children.find(child=>child.isGroup);assert.equal(rotor.rotation.y,0);assert.equal(node.dataset.wheelAngle,undefined);
 scene.setVisible(false);assert.equal(frames.size,0);assert.equal(r.renders,1);scene.setRpm(18);scene.setVisible(true);step();
 assert.equal(r.compiles,1);assert.equal(r.renders,2);assert.equal(r.shadows,1);assert.equal(ticks,1);assert.equal(ready,1);assert.equal(samples.length,1);assert.equal(samples[0].now,frameTime);assert.ok(rotor.rotation.y>0);
 scene.setVisible(false);scene.setVisible(true);step();assert.equal(r.compiles,1);assert.equal(ready,1);assert.equal(ticks,2);scene.dispose();
});
check('预热选项不改变静态或动态首页的原有入口',()=>{
 for(const previewOptions of [{presentationOnly:true},{animatedPreview:true}]){
  const scene=createStudio(canvas(),{...previewOptions,prewarm:true}),r=renderers.at(-1);assert.equal(r.compiles,0);assert.equal(r.renders,0);step();assert.equal(r.renders,1);scene.dispose();
 }
});
check('仅真正绘制的静态预览帧会上报，空白调度不冒充帧率',()=>{
 let ticks=0;const samples=[],[scene]=preview({onTick:()=>++ticks<3,onFrame:sample=>samples.push(sample)});step();step();step();assert.equal(ticks,3);assert.equal(samples.length,1);scene.dispose();
});
check('每帧最多拾取最后一次悬停位置，移出与换阶段会清除待拾取',()=>{
 const node=canvas(),scene=createStudio(node);step();const before=picking.calls;
 for(let i=0;i<40;i++)node.emit('pointermove',{clientX:100+i,clientY:200});assert.equal(picking.calls,before);step();assert.equal(picking.calls,before+1);assert.equal(picking.point.x,139/640*2-1);
 step();assert.equal(picking.calls,before+1);node.emit('pointermove',{clientX:100,clientY:200});node.emit('pointerleave');step();assert.equal(picking.calls,before+1);
 node.emit('pointermove',{clientX:100,clientY:200});scene.setPhase('glaze');step();assert.equal(picking.calls,before+1);scene.dispose();
});
check('首页仅降低角向细分，透明背景保留材质、纵向轮廓精度与像素比',()=>{
 const node=canvas(),scene=createStudio(node,{animatedPreview:true,transparentBackground:true}),r=renderers.at(-1);step();
 let pot;r.world.traverse(object=>{if(object.isMesh&&object.geometry.attributes.position.count===(Pottery.COUNT*2+10)*97)pot=object;});
 assert.ok(pot);assert.equal(pot.geometry.index.count/3,(Pottery.COUNT*2+9)*96*2);assert.equal(pot.material.type,'MeshPhysicalMaterial');assert.equal(r.getPixelRatio(),1.8);assert.equal(r.options.alpha,true);assert.equal(r.clearAlpha,0);assert.equal(r.world.background,null);scene.dispose();
});
check('首页条灯只调整前三个环境软箱，不影响补光、材质或工作台',()=>{
 const boxes=()=>environmentRooms.at(-1).children.filter(object=>object.geometry.type==='PlaneGeometry');
 const dimensions=lights=>lights.map(light=>[light.geometry.parameters.width,light.geometry.parameters.height]);
 let scene=createStudio(canvas(),{animatedPreview:true,heroLighting:true}),lights=boxes();step();
 assert.deepEqual(dimensions(lights),[[1,6.5],[.5,5.5],[3,.8],[2,5],[1,5]]);
 for(const [index,color,power] of [[0,'#fff3dd',3.5],[1,'#eff9ff',1.8],[2,'#ffffff',1],[3,'#d5e6de',2],[4,'#d7d0bb',2]])assert.ok(lights[index].material.color.equals(new Three.Color(color).multiplyScalar(power)));
 const world=renderers.at(-1).world;assert.equal(world.children.find(object=>object.isHemisphereLight).intensity,1.1);assert.deepEqual(world.children.filter(object=>object.isDirectionalLight).map(light=>light.intensity),[2.5,1.5]);scene.dispose();
 scene=createStudio(canvas(),{heroLighting:true});lights=boxes();assert.deepEqual(dimensions(lights),[[3,7],[1.4,6],[6,3],[2,5],[1,5]]);scene.dispose();
});
check('可选首页镜头在一秒内轻推收敛，减少动态效果偏好会关闭',()=>{
 window.matchMedia=()=>({matches:false});let scene=createStudio(canvas(),{animatedPreview:true,presentationEntrance:true}),r=renderers.at(-1);step();const initial=r.camera.x/Math.sin(.28);assert.ok(initial>7.5&&initial<7.8);for(let i=0;i<63;i++)step();assert.ok(Math.abs(r.camera.x-Math.sin(.28)*7.5)<1e-10);scene.dispose();
 window.matchMedia=()=>({matches:true});scene=createStudio(canvas(),{animatedPreview:true,presentationEntrance:true});r=renderers.at(-1);step();assert.ok(Math.abs(r.camera.x-Math.sin(.28)*7.5)<1e-10);scene.dispose();delete window.matchMedia;
});

function renderedPot(renderer){let pot;renderer.world.traverse(object=>{if(object.isMesh&&object.material.isMeshPhysicalMaterial)pot=object;});assert.ok(pot);return pot;}
function potteryShader(material){const shader={uniforms:{},vertexShader:Three.ShaderLib.physical.vertexShader,fragmentShader:Three.ShaderLib.physical.fragmentShader};material.onBeforeCompile(shader);return shader;}
check('深石墨展台仅在动态首页启用，保留金色零位指针和原有网格数量',()=>{
 const inspect=options=>{const scene=createStudio(canvas(),options),r=renderers.at(-1);step();const body=r.world.children.find(child=>child.isGroup),rotor=body.children.find(child=>child.isGroup),disc=rotor.children.find(child=>Array.isArray(child.material)),pointer=body.children.find(child=>child.geometry?.type==='ExtrudeGeometry');const result={ring:rotor.children.find(child=>child.geometry?.type==='LatheGeometry').material.color.getHexString(),roughness:disc.material[1].roughness,metalness:disc.material[1].metalness,pointer:pointer.material.color.getHexString(),calls:r.info.render.calls,triangles:r.info.render.triangles};scene.dispose();return result;};
 const plain=inspect({animatedPreview:true}),hero=inspect({animatedPreview:true,heroPlatform:true}),studio=inspect({heroPlatform:true});
 assert.equal(plain.ring,'9aa5a3');assert.equal(studio.ring,plain.ring);assert.equal(studio.roughness,plain.roughness);
 assert.equal(hero.ring,'59625f');assert.equal(hero.roughness,.43);assert.equal(hero.metalness,.42);assert.equal(hero.pointer,plain.pointer);assert.equal(hero.pointer,'b09968');assert.equal(hero.calls,plain.calls);assert.equal(hero.triangles,plain.triangles);
});
check('显影默认完整，只对显式开启的动态首页陶瓷材质注入着色器',()=>{
 for(const options of [{},{heroReveal:true},{presentationOnly:true,heroReveal:true},{animatedPreview:true},{animatedPreview:true,heroReveal:true}]){
  const node=canvas(),scene=createStudio(node,options),r=renderers.at(-1);step();const clay=renderedPot(r).material,clayShader=potteryShader(clay);
  assert.equal(clayShader.uniforms.potteryGlazeReveal,undefined);assert.ok(!clay.customProgramCacheKey().includes('hero-reveal'));
  scene.setPhase('glaze');step();const ceramic=renderedPot(r).material,shader=potteryShader(ceramic),enabled=options.animatedPreview===true&&options.heroReveal===true;
  assert.equal(node.dataset.glazeReveal,'1.0000');assert.equal(shader.uniforms.potteryGlazeReveal?.value,enabled?1:undefined);assert.equal(ceramic.customProgramCacheKey().includes('hero-reveal'),enabled);
  scene.setGlazeReveal(.28);assert.equal(node.dataset.glazeReveal,enabled?'0.2800':'1.0000');if(enabled){assert.equal(shader.uniforms.potteryGlazeReveal.value,.28);assert.equal(shader.uniforms.potteryClayColor.value,clay.color);}else assert.ok(!shader.fragmentShader.includes('glazeCoverage'));
  scene.dispose();
 }
});
check('显影钳制范围并忽略非法值，直接更新已编译 uniform 而不重建器形或阴影',()=>{
 const node=canvas(),scene=createStudio(node,{animatedPreview:true,heroReveal:true}),r=renderers.at(-1);scene.setPhase('glaze');step();const pot=renderedPot(r),geometry=pot.geometry,material=pot.material,positionVersion=geometry.attributes.position.version,materialVersion=material.version,shader=potteryShader(material),shadowCount=r.shadows,calls=r.info.render.calls;
 scene.setGlazeReveal(.28);for(const value of [NaN,Infinity,-Infinity,undefined,'0.5'])scene.setGlazeReveal(value);assert.equal(shader.uniforms.potteryGlazeReveal.value,.28);assert.equal(node.dataset.glazeReveal,'0.2800');
 scene.setGlazeReveal(-1);assert.equal(shader.uniforms.potteryGlazeReveal.value,0);assert.equal(node.dataset.glazeReveal,'0.0000');step();scene.setGlazeReveal(2);assert.equal(shader.uniforms.potteryGlazeReveal.value,1);assert.equal(node.dataset.glazeReveal,'1.0000');step();
 assert.equal(pot.geometry,geometry);assert.equal(pot.material,material);assert.equal(geometry.attributes.position.version,positionVersion);assert.equal(material.version,materialVersion);assert.equal(r.shadows,shadowCount);assert.equal(r.info.render.calls,calls);scene.dispose();
});
check('显影片元使用当前 Three 的实际材质变量，素陶遮罩覆盖纹理与金印且完整显影保留釉面',()=>{
 const scene=createStudio(canvas(),{animatedPreview:true,heroReveal:true}),r=renderers.at(-1);scene.setPhase('glaze');scene.setSurface('flow');step();const shader=potteryShader(renderedPot(r).material),fragment=shader.fragmentShader;
 assert.ok(fragment.includes('uniform float potteryGlazeReveal;'));assert.ok(shader.vertexShader.includes('potteryY=position.y/potteryHeight;'));
 assert.ok(fragment.indexOf('diffuseColor.rgb=mix(unglazedColor,diffuseColor.rgb,glazeCoverage);')>fragment.indexOf('stamp*0.82'),'clay masking must follow the glaze surface and gold seal');
 assert.ok(fragment.includes('potteryGlazeReveal>=1.0?1.0:(potteryGlazeReveal<=0.0?0.0:1.0-smoothstep'));
 assert.ok(fragment.includes('roughnessFactor=mix(0.5*(1.0+clayFlow*0.18),roughnessFactor,glazeCoverage);'));
 assert.ok(Three.ShaderChunk.roughnessmap_fragment.includes('float roughnessFactor'));
 assert.ok(Three.ShaderChunk.metalnessmap_fragment.includes('float metalnessFactor'));
 assert.ok(Three.ShaderChunk.lights_physical_fragment.includes('material.clearcoat = clearcoat;'));
 assert.ok(fragment.includes('material.clearcoat=mix(0.18,material.clearcoat,glazeCoverage);'));assert.ok(!fragment.includes('clearcoatFactor'));
 assert.ok(fragment.indexOf('material.clearcoat=mix')>fragment.indexOf('#include <lights_physical_fragment>'));assert.ok(fragment.indexOf('material.clearcoat=mix')<fragment.indexOf('#include <lights_fragment_begin>'));
 scene.dispose();
});
check('展示缩放忽略非法值、钳制范围并合并重绘，不改变几何或阴影',()=>{
 const [scene,r]=preview();step();const pot=renderedPot(r),positionVersion=pot.geometry.attributes.position.version,shadows=r.shadows;
 scene.setPresentationScale(1);scene.setPresentationScale(NaN);scene.setPresentationScale(Infinity);assert.equal(frames.size,0);
 scene.setPresentationScale(2);step();assert.ok(Math.abs(r.camera.x/Math.sin(.28)-7.5/1.25)<1e-10);
 scene.setPresentationScale(-5);step();assert.ok(Math.abs(r.camera.x/Math.sin(.28)-7.5/.85)<1e-10);
 scene.setPresentationScale(1.12);scene.setPresentationScale(1.15);assert.equal(frames.size,1);step();assert.ok(Math.abs(r.camera.x/Math.sin(.28)-7.5/1.15)<1e-10);assert.equal(pot.geometry.attributes.position.version,positionVersion);assert.equal(r.shadows,shadows);scene.dispose();
});
check('首页入场尊重展示缩放，截图成功或失败后恢复缩放并继续原有入场',()=>{
 window.matchMedia=()=>({matches:false});const node=canvas(),scene=createStudio(node,{animatedPreview:true,presentationEntrance:true,heroReveal:true}),r=renderers.at(-1);
 scene.setPhase('glaze');scene.setGlazeReveal(.28);scene.setPresentationScale(1.2);scene.setPresentationView(.65,.18);step();const firstDistance=r.camera.x/Math.sin(.65),before=r.camera.clone();assert.ok(firstDistance>7.5/1.2&&firstDistance<7.8/1.2);
 node.toDataURL=()=>{assert.ok(Math.abs(r.camera.x-Math.sin(.28)*7.5)<1e-10);return 'data:image/png;base64,scaled';};assert.equal(scene.capture(),'data:image/png;base64,scaled');assert.deepEqual(r.camera.toArray(),before.toArray());assert.equal(node.dataset.glazeReveal,'0.2800');
 const failure=new Error('fixture: scaled capture failed');node.toDataURL=()=>{throw failure;};assert.throws(()=>scene.capture(),error=>error===failure);assert.deepEqual(r.camera.toArray(),before.toArray());step();assert.ok(r.camera.x/Math.sin(.65)<firstDistance);assert.ok(r.camera.x/Math.sin(.65)>7.5/1.2);
 scene.setPresentationScale(1.1);for(let i=0;i<63;i++)step();assert.ok(Math.abs(r.camera.x-Math.sin(.65)*7.5/1.1)<1e-10);assert.equal(node.dataset.glazeReveal,'0.2800');scene.dispose();delete window.matchMedia;
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
