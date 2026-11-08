import * as THREE from './vendor/three.module.min.js';
import {getGlaze,getSurface,materialFor} from './glazes.js';
import {kilnRecipe} from './kiln-art.js';

/* 真正的可编辑旋转体，不使用预渲染器物图片。 */
export function createStudio(canvas,callbacks={}){
 const P=window.Pottery,scene=new THREE.Scene(),filmCapture=callbacks.filmCapture===true,presentationOnly=callbacks.presentationOnly===true,animatedPreview=callbacks.animatedPreview===true,heroLaser=animatedPreview&&callbacks.heroLaser===true&&!!callbacks.sealUrl,heroCraft=heroLaser&&callbacks.heroCraft===true;
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:callbacks.transparentBackground===true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(filmCapture?1:Math.min(devicePixelRatio,1.8));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
 // 固定光源下的旋转体轮廓基本不变；重塑时再刷新阴影，避免每帧重复阴影通道。
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.setClearColor(callbacks.background||'#eae8e1',callbacks.transparentBackground===true?0:1);
 const camera=new THREE.PerspectiveCamera(33,1,.05,60),look=new THREE.Vector3(0,1.67,0),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
 let sceneReady=false,drawing=false,needsRender=true,needsShadow=true,pendingHover=null;
 const entranceDuration=animatedPreview&&callbacks.presentationEntrance===true&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?1:0;
 let entranceTime=0,presentationScale=1,baseCameraDistance=7.5,cameraDistance=baseCameraDistance*(entranceDuration?1.04:1);
 let values=P.profile(),kind='vase',phase='shape',glaze='jade',surface='glossy',finish=.72,rpm=0,targetRpm=18,angle=0,drag=null,orbit=.28,tilt=.24,visible=true,disposed=false,frame=0,elapsed=0,changed=true,hoverHeight=.55,brushRadius=.13;
 let presentationRotation=null,presentationOffset=0,lastFrameNow=null,renderedFrames=0;
 // 以浏览器给出的展示帧时间积分。不能用回调实际执行的墙钟：同一帧内的任务延迟
 // 会把稳定的 16.7ms 帧误算成 43ms / 0.5ms，产生视觉上的冲刺与补偿。
 function consumeFrameTime(now){
  const valid=Number.isFinite(now),rawDt=valid&&lastFrameNow!==null?Math.max(0,(now-lastFrameNow)/1000):0;
  if(valid&&(lastFrameNow===null||now>=lastFrameNow))lastFrameNow=now;
  return {dt:Math.min(rawDt,.1),rawDt};
 }
 const resetFrameClock=()=>{lastFrameNow=null;};
 document.addEventListener?.('visibilitychange',resetFrameClock);
 // 静态预览按需绘制；动态首页与工作台保留连续物理时钟。
 function invalidate(shadow=false){needsRender=true;needsShadow ||= shadow;if(!filmCapture&&presentationOnly&&sceneReady&&visible&&!disposed&&!drawing&&!frame)frame=requestAnimationFrame(draw);}
 const H=()=>kind==='bowl'?1.78:P.HEIGHT;
 const setCamera=()=>{camera.position.set(Math.sin(orbit)*cameraDistance,1.67+Math.sin(tilt)*cameraDistance,Math.cos(orbit)*cameraDistance);camera.lookAt(look);invalidate();};setCamera();
 const room=new THREE.Scene();room.background=new THREE.Color('#7f827a');
 const walls=new THREE.Mesh(new THREE.BoxGeometry(30,20,30),new THREE.MeshBasicMaterial({color:'#303b37',side:THREE.BackSide}));room.add(walls);
 function softbox(p,s,color,power){const m=new THREE.Mesh(new THREE.PlaneGeometry(...s),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(power),side:THREE.DoubleSide}));m.position.set(...p);m.lookAt(0,1,0);room.add(m);}
 // 首页用一主一辅的竖向反光保留釉色，工作台与其他预览保持既有灯光。
 const heroLighting=animatedPreview&&callbacks.heroLighting===true;
 // 刻印首页略收敛瓶肩固定条灯，保留真实扫描头的局部亮度层级。
 softbox([-4,5,4],heroLighting?[1,6.5]:[3,7],'#fff3dd',heroLaser?2.6:heroLighting?3.5:5);
 softbox([5,4,2],heroLighting?[.5,5.5]:[1.4,6],'#eff9ff',heroLaser?1.4:heroLighting?1.8:4);
 softbox([0,7,-1],heroLighting?[3,.8]:[6,3],'#ffffff',heroLaser?.8:heroLighting?1:3);
 softbox([-4,2,-4],[2,5],'#d5e6de',2);softbox([3,1,-5],[1,5],'#d7d0bb',2);
 const pmrem=new THREE.PMREMGenerator(renderer),env=pmrem.fromScene(room,.025);scene.environment=env.texture;pmrem.dispose();
 scene.add(new THREE.HemisphereLight('#fff8eb','#879182',1.1));
 const key=new THREE.DirectionalLight('#ffedda',2.5);key.position.set(-3.5,6,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-5;key.shadow.camera.right=5;key.shadow.camera.top=5;key.shadow.camera.bottom=-5;key.shadow.normalBias=.025;key.shadow.bias=-.0002;key.shadow.radius=8;key.shadow.blurSamples=12;scene.add(key);
 const fill=new THREE.DirectionalLight('#d4e9ec',1.5);fill.position.set(3,3,-2);scene.add(fill);
 function material(color,metalness,roughness){return new THREE.MeshStandardMaterial({color,metalness,roughness,envMapIntensity:1.2});}
 function mesh(geometry,mat,parent=scene,pos=[0,0,0]){const m=new THREE.Mesh(geometry,mat);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 const heroPlatform=animatedPreview&&callbacks.heroPlatform===true;
 const chrome=material(heroPlatform?'#59625f':'#9aa5a3',.96,heroPlatform?.3:.23),dark=material(heroPlatform?'#18201e':'#28352f',.85,heroPlatform?.4:.3),brass=material('#b09968',.88,.3),rubber=material('#2e3932',.05,.85);
 const body=new THREE.Group();scene.add(body);
 function lathe(points,mat,parent=body){return mesh(new THREE.LatheGeometry(points.map(p=>new THREE.Vector2(...p)),160),mat,parent);}
 lathe([[0,.10],[1.05,.10],[1.17,.13],[1.22,.19],[1.22,.29],[1.19,.33],[0,.33]],dark);
 lathe([[0,.32],[1.20,.32],[1.25,.34],[1.26,.38],[1.23,.42],[0,.42]],chrome);
 lathe([[1.21,.20],[1.224,.20],[1.224,.245],[1.21,.245]],brass);
 const rotor=new THREE.Group();body.add(rotor);
 function updatePresentationRotation(){rotor.rotation.y=animatedPreview?(presentationRotation??angle+presentationOffset):angle;canvas.dataset.presentationAngle=rotor.rotation.y.toFixed(5);}
 updatePresentationRotation();
 lathe([[0,.41],[1.30,.41],[1.355,.435],[1.355,.47],[1.33,.49],[0,.49]],chrome,rotor);
 // 刻度直接贴在盘面，避免细小悬浮几何的闪烁。唯一的金色零位随真实转角运动。
 const dialCanvas=document.createElement('canvas');dialCanvas.width=dialCanvas.height=1024;
 const dg=dialCanvas.getContext('2d');dg.fillStyle=heroPlatform?'#242c29':'#b4b8ac';dg.fillRect(0,0,1024,1024);dg.translate(512,512);
 dg.strokeStyle=heroPlatform?'#59645d':'#9aa397';dg.lineWidth=2;dg.beginPath();dg.arc(0,0,475,0,Math.PI*2);dg.stroke();
 for(let i=0;i<60;i++){const a=i/60*Math.PI*2,major=i%5===0;dg.save();dg.rotate(a);dg.strokeStyle=heroPlatform?(major?'#b7b8a2':'#66766c'):(major?'#596b59':'#82917e');dg.lineWidth=major?5:3;dg.beginPath();dg.moveTo(0,-468);dg.lineTo(0,major?-433:-450);dg.stroke();dg.restore();}
 for(const degrees of [0,90,180,270]){dg.save();dg.rotate(degrees*Math.PI/180);dg.fillStyle=heroPlatform?'#899b8c':'#63735f';dg.font='25px monospace';dg.textAlign='center';dg.textBaseline='middle';dg.fillText(String(degrees).padStart(3,'0'),0,-401);dg.restore();}
 dg.save();dg.rotate(.18);dg.strokeStyle=heroPlatform?'#d5ac62':'#ac7842';dg.lineWidth=13;dg.beginPath();dg.moveTo(0,-475);dg.lineTo(0,-335);dg.stroke();dg.fillStyle=heroPlatform?'#bc914f':'#745b36';dg.beginPath();dg.arc(0,-345,10,0,Math.PI*2);dg.fill();dg.restore();
 // 三个不等距的小定位孔进一步打破圆周对称，保持盘面简洁。
 for(const a of [.8,2.7,4.5]){dg.fillStyle=heroPlatform?'#122019':'#6e7c68';dg.beginPath();dg.arc(Math.sin(a)*370,Math.cos(a)*370,6,0,Math.PI*2);dg.fill();}
 const dialTexture=new THREE.CanvasTexture(dialCanvas);dialTexture.colorSpace=THREE.SRGBColorSpace;dialTexture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 const discMaterial=new THREE.MeshStandardMaterial({map:dialTexture,color:'#ffffff',metalness:heroPlatform?.42:.57,roughness:heroPlatform?.43:.36,envMapIntensity:heroPlatform?.75:1.05});
 const disc=mesh(new THREE.CylinderGeometry(1.30,1.30,.012,160),[chrome,discMaterial,chrome],rotor,[0,.495,0]);disc.receiveShadow=false;
 const dummy=new THREE.Object3D();
 // 固定在底座上的指针不随盘面转动，给加速、惯性滑行和完全停转一个可见参照。
 const pointerShape=new THREE.Shape();pointerShape.moveTo(-.045,1.43);pointerShape.lineTo(.045,1.43);pointerShape.lineTo(0,1.28);pointerShape.closePath();
 const pointerGeometry=new THREE.ExtrudeGeometry(pointerShape,{depth:.012,bevelEnabled:true,bevelSize:.004,bevelThickness:.003,bevelSegments:2});pointerGeometry.rotateX(Math.PI/2);
 const fixedPointer=mesh(pointerGeometry,brass,body,[0,.535,0]);fixedPointer.rotation.y=.28;fixedPointer.castShadow=false;
 const grooveGeo=new THREE.BoxGeometry(.008,.055,.012),grooves=new THREE.InstancedMesh(grooveGeo,dark,160);
 for(let i=0;i<160;i++){const a=i/160*Math.PI*2;dummy.position.set(Math.sin(a)*1.222,.275,Math.cos(a)*1.222);dummy.rotation.set(0,a,0);dummy.scale.set(1,1,1);dummy.updateMatrix();grooves.setMatrixAt(i,dummy.matrix);}body.add(grooves);
 for(const a of [.2,2.3,4.4])mesh(new THREE.CylinderGeometry(.12,.14,.13,24),rubber,body,[Math.sin(a)*.88,.075,Math.cos(a)*.88]);
 const plateCanvas=document.createElement('canvas');plateCanvas.width=768;plateCanvas.height=128;const pg=plateCanvas.getContext('2d');pg.fillStyle='#29372f';pg.fillRect(0,0,768,128);pg.fillStyle='#b7c4b0';pg.font='20px monospace';pg.textAlign='center';pg.fillText('S Q U E E K T O S H I',384,58);pg.font='13px monospace';pg.fillStyle='#82947e';pg.fillText('0 0 1  /  S Q K',384,94);
 const plateTex=new THREE.CanvasTexture(plateCanvas);plateTex.colorSpace=THREE.SRGBColorSpace;
 const plate=mesh(new THREE.PlaneGeometry(.66,.11),new THREE.MeshStandardMaterial({map:plateTex,roughness:.5,metalness:.5}),body,[.04,.205,1.224]);
 const noiseCanvas=document.createElement('canvas');noiseCanvas.width=512;noiseCanvas.height=1024;const ng=noiseCanvas.getContext('2d'),pixels=ng.createImageData(512,1024);let seed=1709;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let y=0;y<1024;y++)for(let x=0;x<512;x++){const index=(y*512+x)*4,v=150+rand()*60+Math.sin(y*.8)*9;pixels.data[index]=pixels.data[index+1]=pixels.data[index+2]=v;pixels.data[index+3]=255;}ng.putImageData(pixels,0,0);
 const bump=new THREE.CanvasTexture(noiseCanvas);bump.wrapS=THREE.RepeatWrapping;bump.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 const clay=new THREE.MeshPhysicalMaterial({color:'#906f54',roughness:.43,metalness:0,clearcoat:.18,clearcoatRoughness:.35,bumpMap:bump,bumpScale:.007,envMapIntensity:.55,side:THREE.FrontSide});
 const ceramic=new THREE.MeshPhysicalMaterial({color:'#276f62',roughness:.15,metalness:.04,clearcoat:1,clearcoatRoughness:.11,bumpMap:bump,bumpScale:.004,envMapIntensity:1.05,side:THREE.FrontSide});
 // 纹理锁在陶器局部坐标：窑变与小爪印会绕到侧面、背面，不能靠静止高光假装旋转。
 const surfaceHeight={value:P.HEIGHT},surfaceMode={value:0},glazeAccent={value:new THREE.Color(getGlaze(glaze).accent)};
 // 固定一套 shader；结算记录与显影进度只更新 uniform，不反复编译材质。
 const kilnEnabled={value:0},kilnReveal={value:1},kilnEnergy={value:0},kilnPhase={value:0},kilnFlow={value:.18},kilnSeed={value:new THREE.Vector2()};
 canvas.dataset.kilnReveal='1.0000';
 // 只在首页显影中使用片元遮罩；数值更新不会重建器形或触发阴影重算。
 const heroReveal=animatedPreview&&callbacks.heroReveal===true,glazeReveal={value:1};canvas.dataset.glazeReveal='1.0000';
 // 品牌概念可指定原始透明 SVG 为窑印；不传时保留工作台现有爪印。
 let resolveFilmAsset,rejectFilmAsset;
 const filmAssetsReady=filmCapture&&callbacks.sealUrl?new Promise((resolve,reject)=>{resolveFilmAsset=resolve;rejectFilmAsset=reject;}):Promise.resolve();
 const brandSeal=callbacks.sealUrl?new THREE.TextureLoader().load(callbacks.sealUrl,()=>{invalidate();resolveFilmAsset?.();},undefined,filmCapture?error=>rejectFilmAsset?.(error):undefined):null;
 const laserProgress={value:1},laserActive={value:0},laserPixelRatio={value:renderer.getPixelRatio()};
 canvas.dataset.laserProgress='1.0000';canvas.dataset.laserActive='false';
 function turningSurface(mat,glazed){const revealEnabled=glazed&&heroReveal,laserEnabled=glazed&&heroLaser;mat.onBeforeCompile=shader=>{
  shader.uniforms.potteryHeight=surfaceHeight;
  if(brandSeal)shader.uniforms.potterySeal={value:brandSeal};
  if(glazed){shader.uniforms.potterySurface=surfaceMode;shader.uniforms.potteryAccent=glazeAccent;Object.assign(shader.uniforms,{potteryKilnEnabled:kilnEnabled,potteryKilnReveal:kilnReveal,potteryKilnEnergy:kilnEnergy,potteryKilnPhase:kilnPhase,potteryKilnFlow:kilnFlow,potteryKilnSeed:kilnSeed});}
  if(revealEnabled){shader.uniforms.potteryGlazeReveal=glazeReveal;shader.uniforms.potteryClayColor={value:clay.color};}
  if(laserEnabled){shader.uniforms.potteryLaserProgress=laserProgress;shader.uniforms.potteryLaserActive=laserActive;shader.uniforms.potteryLaserPixelRatio=laserPixelRatio;}
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 potteryUV;\nvarying float potteryY;\nuniform float potteryHeight;').replace('#include <begin_vertex>','#include <begin_vertex>\npotteryUV=uv;\npotteryY=position.y/potteryHeight;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 potteryUV;\nvarying float potteryY;'+(brandSeal?'\nuniform sampler2D potterySeal;':'')+(glazed?'\nuniform float potterySurface;\nuniform vec3 potteryAccent;\nuniform float potteryKilnEnabled;\nuniform float potteryKilnReveal;\nuniform float potteryKilnEnergy;\nuniform float potteryKilnPhase;\nuniform float potteryKilnFlow;\nuniform vec2 potteryKilnSeed;':'')+(revealEnabled?'\nuniform float potteryGlazeReveal;\nuniform vec3 potteryClayColor;':'')+(laserEnabled?'\nuniform float potteryLaserProgress;\nuniform float potteryLaserActive;\nuniform float potteryLaserPixelRatio;':'')).replace('#include <color_fragment>',`#include <color_fragment>
   float theta=potteryUV.x*6.2831853;
   float clayFlow=sin(theta*3.0+sin(potteryY*7.0)*0.9)*0.6+sin(theta*5.0-potteryY*9.0)*0.4;
   diffuseColor.rgb*=1.0+clayFlow*${glazed?'0.13':'0.085'};
   ${glazed?`
   float mineralSpot=0.0;
   float glazeEdge=0.0;
   vec3 potteryBaseGlaze=diffuseColor.rgb;
   float kilnRoughness=0.0;
   if(potterySurface>1.5&&potterySurface<2.5){
    // 稀疏矿物颗粒在整格内随机分布；邻格采样避免越界颗粒被切成规则方阵。
    // 圆周 92 个完整周期，首尾接缝连续；斑点位置与陶器一起旋转。
    vec2 grain=vec2(potteryUV.x*92.0,potteryY*62.0);
    for(int gy=-1;gy<=1;gy++)for(int gx=-1;gx<=1;gx++){
     vec2 neighbor=vec2(float(gx),float(gy));
     vec2 rawCell=floor(grain)+neighbor;
     vec2 cell=vec2(mod(rawCell.x,92.0),rawCell.y);
     vec2 jitter=fract(sin(vec2(dot(cell,vec2(127.1,311.7)),dot(cell,vec2(269.5,183.3))))*43758.5453);
     float mineral=fract(sin(dot(cell,vec2(41.7,83.1)))*17538.239);
     float sizeSeed=fract(jitter.x*31.71+jitter.y*17.13);
     float grainRadius=0.055+pow(sizeSeed,1.4)*0.275;
     vec2 grainOffset=(fract(grain)-neighbor-jitter)*vec2(0.8+jitter.x*0.6,1.2-jitter.x*0.4);
     float spot=(1.0-smoothstep(grainRadius*0.5,grainRadius,length(grainOffset)))*step(0.54,mineral);
     mineralSpot=max(mineralSpot,spot*(0.65+sizeSeed*0.35));
    }
    vec3 mineralColor=mix(vec3(0.035,0.019,0.011),potteryAccent*0.16,0.35);
    diffuseColor.rgb=mix(diffuseColor.rgb,mineralColor,mineralSpot*0.82);
   }
   if(potterySurface>2.5){
    // 第二层釉从口沿向下流，长短不同的垂釉不会变成环形贴图。
    float longDrip=pow(max(0.0,sin(theta*3.0+${heroCraft?'3.1':'0.8'})),14.0);
    float shortDrip=pow(max(0.0,sin(theta*7.0+${heroCraft?'1.4':'-0.6'})),10.0);
    float edgeHeight=0.62+sin(theta*5.0)*0.025-longDrip*0.19-shortDrip*0.07;
    float topGlaze=smoothstep(edgeHeight-0.014,edgeHeight+0.025,potteryY);
    glazeEdge=1.0-smoothstep(0.0,0.025,abs(potteryY-edgeHeight));
    diffuseColor.rgb=mix(diffuseColor.rgb,potteryAccent*(1.0+clayFlow*0.10),topGlaze*0.96);
    diffuseColor.rgb*=1.0-glazeEdge*0.13;
   }
   if(potteryKilnEnabled>0.5&&potteryKilnReveal>0.0){
    // 整数圆周频率保证接缝连续。局部坐标与静态种子使前后视角、分享和截图一致。
    float kilnP=potteryKilnPhase;
    vec2 kilnS=potteryKilnSeed*6.2831853;
    float kilnE=potteryKilnEnergy;
    float kilnWarp=sin(theta*3.0+kilnP+sin(potteryY*5.0+kilnS.x)*0.65);
    float kilnVein=sin(theta*7.0-kilnS.y+potteryY*(1.4+potteryKilnFlow*3.0)+kilnWarp*0.75);
    float kilnRun=pow(max(0.0,0.5+0.5*kilnVein),5.0);
    float kilnCloud=sin(theta*5.0+kilnP+sin(potteryY*9.0+kilnS.x)*1.1)*sin(theta*9.0-potteryY*12.0+kilnS.y);
    float kilnBloom=smoothstep(0.28,0.72,kilnCloud);
    vec3 kilnColor=diffuseColor.rgb;
    if(potterySurface>2.5){
     // 双釉重算垂釉边界；工作量越高，长流痕越深入瓶腹，仍保留原来的两种釉色。
     float kilnLong=pow(max(0.0,sin(theta*3.0+kilnP)),12.0);
     float kilnShort=pow(max(0.0,sin(theta*7.0+kilnS.x)),9.0);
     float kilnEdgeHeight=0.66+sin(theta*5.0+kilnS.y)*0.025-kilnLong*(0.04+potteryKilnFlow*0.46)-kilnShort*(0.025+potteryKilnFlow*0.12);
     float kilnTop=smoothstep(kilnEdgeHeight-0.014,kilnEdgeHeight+0.025,potteryY);
     float kilnEdge=1.0-smoothstep(0.0,0.025,abs(potteryY-kilnEdgeHeight));
     kilnColor=mix(potteryBaseGlaze,potteryAccent*(1.0+clayFlow*0.10),kilnTop*0.96)*(1.0-kilnEdge*0.13);
     kilnRoughness+=(kilnEdge-glazeEdge)*0.08;
    }
    // 窑斑与细流影响明暗和表面质感，不把用户所选釉色替换成另一种颜色。
    kilnColor*=1.0+kilnCloud*(0.025+kilnE*0.09)-kilnBloom*(0.025+kilnE*0.13);
    kilnColor=mix(kilnColor,potteryAccent*(0.83+kilnCloud*0.06),kilnRun*(0.025+kilnE*0.18));
    diffuseColor.rgb=mix(diffuseColor.rgb,kilnColor,potteryKilnReveal);
    kilnRoughness+=(kilnBloom*0.10-kilnRun*0.055)*(0.2+kilnE*0.8);
   }`:''}
   float dx=potteryUV.x-0.04;dx-=floor(dx+0.5);
   vec2 seal=vec2(dx*70.0,(potteryY-0.34)*34.0);
   float pad=1.0-smoothstep(0.57,0.66,length((seal-vec2(0.0,-0.22))*vec2(1.0,1.3)));
   float toeA=1.0-smoothstep(0.17,0.23,length(seal-vec2(-0.47,0.35)));
   float toeB=1.0-smoothstep(0.18,0.24,length(seal-vec2(0.0,0.58)));
   float toeC=1.0-smoothstep(0.17,0.23,length(seal-vec2(0.47,0.35)));
   ${brandSeal?`vec2 brandUV=${laserEnabled?'vec2(dx*4.4+0.5,(potteryY-0.47)*3.0+0.5)':'vec2(dx*11.0+0.5,(potteryY-0.32)*7.3+0.5)'};
   float stamp=texture2D(potterySeal,clamp(brandUV,0.0,1.0)).a*step(0.0,brandUV.x)*step(brandUV.x,1.0)*step(0.0,brandUV.y)*step(brandUV.y,1.0);`:'float stamp=max(pad,max(toeA,max(toeB,toeC)))*(1.0-step(0.50,potteryUV.y));'}
   ${laserEnabled?`
   // 40 行蛇形路径从上向下。当前行只有扫过的部分留下金属刻痕，非整块淡入。
   float laserRow=min(39.0,floor(clamp(1.0-brandUV.y,0.0,1.0)*40.0));
   float laserDirection=mod(laserRow,2.0);
   float laserPath=(laserRow+mix(clamp(brandUV.x,0.0,1.0),1.0-clamp(brandUV.x,0.0,1.0),laserDirection))/40.0;
   float engraved=potteryLaserProgress>=1.0?1.0:(potteryLaserProgress<=0.0?0.0:1.0-smoothstep(potteryLaserProgress-0.0003,potteryLaserProgress+0.0003,laserPath));
   stamp*=engraved;
   vec3 engravingGold=vec3(0.92,0.78,0.53)*(0.98+0.02*cos(brandUV.y*251.3274));
   diffuseColor.rgb=mix(diffuseColor.rgb,engravingGold,stamp*0.96);
   float laserSweep=min(potteryLaserProgress*40.0,39.99999);
   float laserHeadRow=floor(laserSweep);
   float laserHeadX=mix(fract(laserSweep),1.0-fract(laserSweep),mod(laserHeadRow,2.0));
   float laserHeadY=1.0-(laserHeadRow+0.5)/40.0;
   float laserBehind=(laserHeadX-brandUV.x)*(1.0-2.0*mod(laserHeadRow,2.0));
   float laserDy=brandUV.y-laserHeadY;
   float laserBounds=step(0.0,brandUV.x)*step(brandUV.x,1.0)*step(0.0,brandUV.y)*step(brandUV.y,1.0);
   float laserOn=potteryLaserActive*(1.0-step(1.0,potteryLaserProgress))*laserBounds;
   float laserTail=step(0.0,laserBehind)*(1.0-smoothstep(0.18,0.29,laserBehind));
   float laserCore=exp(-pow(laserDy/0.0024,2.0))*laserTail*exp(-max(0.0,laserBehind)*5.0);
   float laserHalo=exp(-pow(laserDy/0.017,2.0))*laserTail*exp(-max(0.0,laserBehind)*7.0);
   // 用屏幕导数维持约 5–6 CSS px 的圆形光头，不能被瓶腹投影压成一段横线。
   vec2 laserPixel=max(vec2(length(vec2(dFdx(brandUV.x),dFdy(brandUV.x))),length(vec2(dFdx(brandUV.y),dFdy(brandUV.y))))*potteryLaserPixelRatio,vec2(0.00001));
   vec2 laserHeadOffset=vec2(brandUV.x-laserHeadX,laserDy)/laserPixel;
   float laserHeadDistance=length(laserHeadOffset);
   float laserHead=1.0-smoothstep(1.7,3.0,laserHeadDistance);
   float laserWarmHalo=exp(-pow(laserHeadDistance/5.5,2.0));
   `:`diffuseColor.rgb=mix(diffuseColor.rgb,${glazed?'vec3(0.46,0.34,0.18)':'diffuseColor.rgb*0.48'},stamp*${glazed?'0.82':'0.60'});`}
   ${revealEnabled?`
   ${heroCraft?`
   // 从口沿下行的流釉前沿；长短垂釉随进度生长再收拢，首尾均越过完整内外壁。
   float revealFlow=sin(potteryGlazeReveal*3.1415927);
   float revealLongDrip=pow(max(0.0,sin(theta*3.0+3.1)),14.0);
   float revealShortDrip=pow(max(0.0,sin(theta*7.0+1.4)),10.0);
   float glazeFront=mix(1.10,-0.08,potteryGlazeReveal)+revealFlow*(sin(theta*5.0)*0.012-revealLongDrip*0.20-revealShortDrip*0.075);
   float glazeCoverage=potteryGlazeReveal>=1.0?1.0:(potteryGlazeReveal<=0.0?0.0:smoothstep(glazeFront-0.025,glazeFront+0.025,potteryY));`:`
   // 釉线在局部坐标里微曲，随器物一起旋转；边界越过整段内外壁后精确恢复原釉面。
   float glazeFront=mix(-0.07,1.11,potteryGlazeReveal)+sin(theta*2.0+0.4)*0.018+sin(theta*5.0-potteryY*2.0)*0.009;
   float glazeCoverage=potteryGlazeReveal>=1.0?1.0:(potteryGlazeReveal<=0.0?0.0:1.0-smoothstep(glazeFront-0.025,glazeFront+0.025,potteryY));`}
   vec3 unglazedColor=potteryClayColor*(1.0+clayFlow*0.085);
   unglazedColor=mix(unglazedColor,unglazedColor*0.48,stamp*0.60);
   diffuseColor.rgb=mix(unglazedColor,diffuseColor.rgb,glazeCoverage);`:''}
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   roughnessFactor=clamp(roughnessFactor*(1.0+clayFlow*${glazed?'0.35':'0.18'}),0.06,1.0);
   ${glazed?'roughnessFactor=clamp(roughnessFactor+mineralSpot*0.20+glazeEdge*0.08,0.06,1.0);':''}
   ${glazed?'if(potteryKilnEnabled>0.5&&potteryKilnReveal>0.0)roughnessFactor=mix(roughnessFactor,clamp(roughnessFactor+kilnRoughness,0.06,1.0),potteryKilnReveal);':''}
   ${revealEnabled?'roughnessFactor=mix(0.5*(1.0+clayFlow*0.18),roughnessFactor,glazeCoverage);':''}
   ${laserEnabled?`roughnessFactor=mix(roughnessFactor,0.30+0.015*cos(brandUV.y*251.3274),stamp${revealEnabled?'*glazeCoverage':''});`:''}
  `);
  if(revealEnabled)shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
   metalnessFactor*=glazeCoverage;
  `).replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>
   #ifdef USE_CLEARCOAT
    material.clearcoat=mix(0.18,material.clearcoat,glazeCoverage);
    material.clearcoatRoughness=mix(0.35,material.clearcoatRoughness,glazeCoverage);
   #endif
  `);
  if(laserEnabled)shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
   metalnessFactor=mix(metalnessFactor,0.60,stamp${revealEnabled?'*glazeCoverage':''});
  `).replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   totalEmissiveRadiance+=laserOn${revealEnabled?'*glazeCoverage':''}*(vec3(1.0,0.93,0.76)*laserCore*2.7+vec3(0.38,0.85,1.0)*laserHalo*0.40+vec3(1.0,0.53,0.16)*laserWarmHalo*0.90+vec3(1.0,0.98,0.90)*laserHead*5.5);
  `).replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>
   #ifdef USE_CLEARCOAT
    material.clearcoat=mix(material.clearcoat,0.14,stamp${revealEnabled?'*glazeCoverage':''});
   #endif
  `);
 };mat.customProgramCacheKey=()=>(glazed?'wheel-clay-glaze-surfaces-v3-kiln-v1':'wheel-clay-earth-motion-v2')+(brandSeal?'-official-seal':'')+(revealEnabled?heroCraft?'-hero-reveal-craft-v1':'-hero-reveal-v1':'')+(laserEnabled?'-hero-laser-v1':'');}
 turningSurface(clay,false);turningSurface(ceramic,true);
 // 小幅首页预览减少圆周细分；纵向塑形精度与工作台网格保持不变。
 const SEG=animatedPreview?96:144,RINGS=P.COUNT*2+10,positions=new Float32Array(RINGS*(SEG+1)*3),uv=new Float32Array(RINGS*(SEG+1)*2),indices=[];
 const sinAngle=new Float64Array(SEG+1),cosAngle=new Float64Array(SEG+1),sinTriple=new Float64Array(SEG+1),cosTriple=new Float64Array(SEG+1);
 for(let j=0;j<=SEG;j++){const a=j/SEG*Math.PI*2;sinAngle[j]=Math.sin(a);cosAngle[j]=Math.cos(a);sinTriple[j]=Math.sin(a*3);cosTriple[j]=Math.cos(a*3);}
 for(let row=0;row<RINGS;row++)for(let j=0;j<=SEG;j++){const at=row*(SEG+1)+j;uv[at*2]=j/SEG;uv[at*2+1]=row/(RINGS-1);if(row<RINGS-1&&j<SEG){const next=at+SEG+1;indices.push(at,at+1,next,next,at+1,next+1);}}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setIndex(indices);
 const pot=mesh(geometry,clay,rotor,[0,.51,0]);
 canvas.dataset.presentationHeight='1.0000';
 let targetActive=false;
 const targetGuide=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:'#866130',dashSize:.04,gapSize:.03,transparent:true,opacity:.95,depthTest:false,toneMapped:false}));targetGuide.visible=false;targetGuide.renderOrder=6;scene.add(targetGuide);
 function setTarget(profile){invalidate();targetActive=!!profile;targetGuide.visible=targetActive&&phase==='shape';if(!profile)return;const points=[];for(const sign of [-1,1])for(const offset of [-.004,0,.004])for(let i=0;i<P.COUNT-1;i++){points.push(new THREE.Vector3(sign*profile[i]+offset,.555+i/(P.COUNT-1)*P.HEIGHT,0),new THREE.Vector3(sign*profile[i+1]+offset,.555+(i+1)/(P.COUNT-1)*P.HEIGHT,0));}targetGuide.geometry.dispose();targetGuide.geometry=new THREE.BufferGeometry().setFromPoints(points);targetGuide.computeLineDistances();}
 const scratches=new Float32Array(P.COUNT);
 function radiusAt(h){const n=P.clamp(h,0,1)*(P.COUNT-1),i=Math.min(P.COUNT-2,Math.floor(n)),u=n-i;return values[i]*(1-u)+values[i+1]*u;}
 function rebuild(){
  const height=H();surfaceHeight.value=height;
  // 从外底向上，圆唇翻入内壁，再闭合内底。
  const cross=[];cross.push([0,0],[values[0]-.05,0],[values[0],.026]);
  for(let i=0;i<P.COUNT;i++)cross.push([values[i],.045+i/(P.COUNT-1)*height]);
  const top=values[P.COUNT-1],wall=.055;
  for(let i=1;i<=5;i++){const a=i/5*Math.PI;cross.push([top-wall/2+Math.cos(a)*wall/2,height+.045+Math.sin(a)*wall/2]);}
  for(let i=P.COUNT-2;i>=0;i--)cross.push([Math.max(.08,values[i]-.07),.13+i/(P.COUNT-1)*(height-.085)]);
  cross.push([0,.13]);
  while(cross.length<RINGS)cross.push([0,.13]);
  for(let row=0;row<RINGS;row++){
   const [base,y]=cross[row],h=P.clamp((y-.045)/height,0,1),n=Math.min(P.COUNT-1,Math.round(h*(P.COUNT-1))),ridge=(row>2&&row<3+P.COUNT)?Math.sin(h*110)*(.00012+scratches[n]*.00015):0;
   const sinHeight=Math.sin(h*7),cosHeight=Math.cos(h*7);
   for(let j=0;j<=SEG;j++){const at=(row*(SEG+1)+j)*3,r=base>0?base+ridge+(sinTriple[j]*cosHeight+cosTriple[j]*sinHeight)*.0015:0;positions[at]=sinAngle[j]*r;positions[at+1]=y;positions[at+2]=cosAngle[j]*r;}
  }
  geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();geometry.computeBoundingBox();changed=false;
 }
 // 接触阴影 + 自然投影，避免器物漂浮。
 const floor=mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.055}),scene,[0,0,0]);floor.rotation.x=-Math.PI/2;floor.castShadow=false;
 const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=256;const sg=shadowCanvas.getContext('2d'),gradient=sg.createRadialGradient(128,128,5,128,128,128);gradient.addColorStop(0,'rgba(40,49,38,.33)');gradient.addColorStop(.45,'rgba(40,49,38,.18)');gradient.addColorStop(1,'rgba(40,49,38,0)');sg.fillStyle=gradient;sg.fillRect(0,0,256,256);
 const shadow=mesh(new THREE.PlaneGeometry(4.6,4.6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}),scene,[.12,.005,.15]);shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;
 // 首页透明展台保留实体自身阴影，不画额外地面片，避免窄桌面窗口出现矩形裁边。
 if(heroLaser){floor.visible=false;shadow.visible=false;}
 const guideMat=new THREE.MeshBasicMaterial({color:'#e8c8a3',transparent:true,opacity:.7,depthTest:false}),guide=new THREE.Mesh(new THREE.TorusGeometry(1,.0022,4,160),guideMat);guide.rotation.x=Math.PI/2;guide.visible=false;guide.renderOrder=4;scene.add(guide);
 function guideAt(y){invalidate();hoverHeight=P.clamp(y,0.04,1);const r=radiusAt(hoverHeight)+.009;guide.scale.set(r,r,1);guide.position.set(0,.51+.045+hoverHeight*H(),0);guide.visible=phase==='shape';}
 function hit(e){const b=canvas.getBoundingClientRect();pointer.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObject(pot)[0];}
 function down(e){if(presentationOnly||animatedPreview)return;if(e.button!==0||drag||e.isPrimary===false)return;pendingHover=null;const found=hit(e);if(phase==='shape'&&!found)return;if(phase==='shape'&&(rpm<.5||callbacks.canSculpt?.()===false)){callbacks.onBlocked?.();return;}e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);document.body.dataset.dragging='true';const local=found?pot.worldToLocal(found.point.clone()):null;drag={id:e.pointerId,x:e.clientX,y:e.clientY,originX:e.clientX,reach:Math.max(60,canvas.getBoundingClientRect().height*.18),pressure:0,target:0,didSculpt:false,center:local?P.clamp((local.y-.045)/H(),.06,1):.5,sign:pointer.x<0?-1:1};if(phase==='shape'){guideAt(drag.center);callbacks.onStrokeStart?.();}}
 function move(e){if(presentationOnly||animatedPreview)return;if(drag&&e.pointerId!==drag.id)return;if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;if(phase==='shape'){drag.target=P.touchTarget((e.clientX-drag.originX)*drag.sign,drag.reach);}else{orbit-=dx*.006;tilt=P.clamp(tilt+dy*.004,-.02,.9);setCamera();}}else if(phase==='shape'){pendingHover={clientX:e.clientX,clientY:e.clientY};}}
 // 高频鼠标事件只保留最后一个位置，每个展示帧最多进行一次完整网格拾取。
 function updateHover(){if(!pendingHover||drag||phase!=='shape')return;const point=pendingHover;pendingHover=null;const found=hit(point);if(found){const local=pot.worldToLocal(found.point.clone());guideAt((local.y-.045)/H());}else guide.visible=false;}
 function shapeUnderTouch(dt){if(!drag||phase!=='shape'||rpm<.5)return;const touch=P.stepTouch(drag.pressure,drag.target,dt);drag.pressure=touch.pressure;if(Math.abs(touch.delta)>1e-7&&callbacks.onSculpt?.(drag.center,touch.delta,brushRadius,rpm)){drag.didSculpt=true;const n=Math.round(drag.center*(P.COUNT-1));scratches[n]=Math.min(2,scratches[n]+Math.abs(touch.delta)*1.2);guideAt(drag.center);}guideMat.opacity=.35+Math.abs(drag.pressure)*.5;}
 function up(e){if(!drag||(e&&e.pointerId!==drag.id))return;const previous=drag;drag=null;if(canvas.hasPointerCapture(previous.id))canvas.releasePointerCapture(previous.id);document.body.dataset.dragging='false';guideMat.opacity=.7;if(phase==='shape'&&previous.didSculpt)callbacks.onStrokeEnd?.();}
 canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('lostpointercapture',up);canvas.addEventListener('pointerleave',()=>{pendingHover=null;if(!drag)guide.visible=false;});
 const renderSize=new THREE.Vector2();
 function resizeCanvas(){const size=presentationOnly?{width:canvas.clientWidth,height:canvas.clientHeight}:canvas.getBoundingClientRect(),width=size.width,height=size.height;if(!width||!height)return;renderer.getSize(renderSize);const resized=renderSize.x!==width||renderSize.y!==height,aspectChanged=camera.aspect!==width/height;if(resized)renderer.setSize(width,height,false);if(aspectChanged){camera.aspect=width/height;camera.updateProjectionMatrix();}if(resized||aspectChanged)invalidate();}
 const resizer=filmCapture?null:new ResizeObserver(resizeCanvas);resizer?.observe(canvas);
 rebuild();let ready=false;
 function recordFrame(now,dt,rawDt,started,clockMode='raf'){
  const ended=performance.now();
  const state={wheelAngle:(angle%(Math.PI*2)).toFixed(5),motorRpm:rpm.toFixed(3),touchPressure:(drag?.pressure||0).toFixed(4),middleRadius:radiusAt(.5).toFixed(6),frameSerial:String(++renderedFrames),frameClock:clockMode,frameNow:now.toFixed(3),frameDt:dt.toFixed(6),frameRawDt:rawDt.toFixed(6),framePerfStart:started.toFixed(3),framePerfEnd:ended.toFixed(3)};
  for(const key in state)if(canvas.dataset[key]!==state[key])canvas.dataset[key]=state[key];
  if(!ready){ready=true;callbacks.onReady?.();}
 }
 function renderScene(){if(heroLaser)laserPixelRatio.value=renderer.getPixelRatio();renderer.shadowMap.needsUpdate=needsShadow;needsShadow=false;renderer.render(scene,camera);}
 function reportFrame(now,started,dt,rawDt){callbacks.onFrame?.({now,dt,rawDt,frameSerial:renderedFrames,presentationAngle:rotor.rotation.y,motorRpm:rpm,renderMs:performance.now()-started,phase,visible,drawCalls:renderer.info?.render?.calls??0,triangles:renderer.info?.render?.triangles??0});}
 function drawPresentation(now){
  frame=0;if(disposed||!visible)return;drawing=true;
  const started=performance.now(),{dt,rawDt}=consumeFrameTime(now);let animate=false;
  try{
   // 返回 true 可让调用方的镜头缓动继续；停止后不再请求空白帧。
   animate=callbacks.onTick?.(0,dt)===true;
   if(changed){rebuild();needsRender=true;needsShadow=true;}
   if(needsRender){needsRender=false;targetGuide.rotation.y=orbit;renderScene();recordFrame(now,dt,rawDt,started);reportFrame(now,started,dt,rawDt);}
  }finally{drawing=false;if(!disposed&&visible&&(animate||needsRender)&&!frame)frame=requestAnimationFrame(draw);else if(!frame)resetFrameClock();}
 }
 function draw(now){
  if(presentationOnly){drawPresentation(now);return;}frame=0;if(disposed||!visible)return;
  const started=performance.now(),{dt,rawDt}=consumeFrameTime(now);elapsed+=dt;
  if(entranceTime<entranceDuration){entranceTime=Math.min(entranceDuration,entranceTime+dt);cameraDistance=baseCameraDistance*(1+.04*(1-entranceTime/entranceDuration)**3);setCamera();}
  rpm=P.stepMotor(rpm,targetRpm,dt);if(rpm<.015)rpm=0;updateHover();shapeUnderTouch(dt);angle+=rpm/60*Math.PI*2*dt;updatePresentationRotation();targetGuide.rotation.y=orbit;
  // 首页制作在渲染前推进，避免每个阶段晚一帧显示；工作台保留原有回调时序。
  if(animatedPreview)callbacks.onTick?.(rpm,dt);
  if(changed){rebuild();needsShadow=true;}needsRender=false;renderScene();recordFrame(now,dt,rawDt,started);if(!animatedPreview)callbacks.onTick?.(rpm,dt);reportFrame(now,started,dt,rawDt);
  if(!disposed&&visible&&!frame)frame=requestAnimationFrame(draw);
 }
 // 只在工作台构造期预热：在首页动画建立前完成着色器、缓冲和阴影首次绘制。
 // 不读物理时钟、不触发游戏/就绪/验收回调；真正可见的首帧仍按正常 RAF 绘制。
 if(callbacks.prewarm===true&&!presentationOnly&&!animatedPreview){resizeCanvas();renderer.compile(scene,camera);renderScene();}
 sceneReady=true;callbacks.onVisibility?.(visible,performance.now());if(!filmCapture){if(presentationOnly)invalidate(true);else frame=requestAnimationFrame(draw);}
 function setMaterial(){
  invalidate(true);
  const spec=materialFor(glaze,surface,finish);
  ceramic.color.set(spec.color);glazeAccent.value.set(spec.accent);surfaceMode.value=spec.mode;
  for(const key of ['roughness','clearcoat','clearcoatRoughness','metalness','bumpScale','envMapIntensity'])ceramic[key]=spec[key];
  pot.material=phase==='shape'?clay:ceramic;
  canvas.dataset.glaze=glaze;canvas.dataset.surface=surface;canvas.dataset.material=phase==='shape'?'clay':'ceramic';
 }
 return {
  filmAssetsReady,
  // 仅本地影片工具启用：不读墙钟、不创建 RAF，保证每张图片对应调用方指定的同一时间。
  renderFilmFrame({dt=1/60,width=1440,height=1440,motorRpm=18,wheelAngle,timeSeconds}={}){
   if(!filmCapture)throw new Error('Film rendering requires the explicit filmCapture option.');
   if(disposed)throw new Error('Film renderer has been disposed.');
   if(!Number.isFinite(dt)||dt<0||dt>.1)throw new RangeError('Film dt must be between 0 and 0.1 seconds.');
   if(!Number.isInteger(width)||!Number.isInteger(height)||width<64||height<64||width>4096||height>4096)throw new RangeError('Film dimensions must be integers from 64 to 4096.');
   if(timeSeconds!==undefined&&(!Number.isFinite(timeSeconds)||timeSeconds<0))throw new RangeError('Film time must be a finite non-negative number.');
   const started=performance.now();
   renderer.getSize(renderSize);if(renderSize.x!==width||renderSize.y!==height)renderer.setSize(width,height,false);
   if(camera.aspect!==width/height){camera.aspect=width/height;camera.updateProjectionMatrix();}
   rpm=Number.isFinite(motorRpm)?P.clamp(motorRpm,0,90):0;targetRpm=rpm;elapsed=timeSeconds??elapsed+dt;
   angle=Number.isFinite(wheelAngle)?wheelAngle:angle+rpm/60*Math.PI*2*dt;
   updatePresentationRotation();guide.visible=false;targetGuide.visible=false;
   if(changed){rebuild();needsShadow=true;}needsRender=false;renderScene();recordFrame(elapsed*1000,dt,dt,started,'film');
   const result={elapsed,dt,rpm,wheelAngle:angle,presentationAngle:rotor.rotation.y,width,height,renderMs:performance.now()-started,drawCalls:renderer.info?.render?.calls??0};
   return Object.freeze(result);
  },
  setProfile(v,type=kind){values=v.slice();kind=type;changed=true;invalidate(true);},setRpm(v){targetRpm=Number.isFinite(v)?P.clamp(v,0,90):0;},get rpm(){return rpm;},get frame(){return frame;},
  setTarget,setPhase(next){up();pendingHover=null;phase=next;guide.visible=false;targetGuide.visible=targetActive&&phase==='shape';setMaterial();},setGlaze(next){glaze=getGlaze(next).id;setMaterial();},setSurface(next){surface=getSurface(next).id;setMaterial();},setFinish(v){finish=v;setMaterial();},setBrush(v){brushRadius=v;},setGuide(v){guideAt(v);},hideGuide(){guide.visible=false;invalidate();},
  setKiln(record){
   const recipe=kilnRecipe(record);kilnEnabled.value=recipe?1:0;kilnEnergy.value=recipe?recipe.energyBps/10000:0;kilnPhase.value=recipe?.phase??0;kilnFlow.value=recipe?.flow??.18;
   // 拆成两段 16 位，避免 WebGL float 丢失 32 位种子的低位信息。
   kilnSeed.value.set(recipe?(recipe.seed32&0xffff)/65535:0,recipe?(recipe.seed32>>>16)/65535:0);
   if(recipe){canvas.dataset.kilnRound=recipe.record.round;canvas.dataset.kilnWork=recipe.record.work;canvas.dataset.kilnSeed=String(recipe.seed32);}
   else{delete canvas.dataset.kilnRound;delete canvas.dataset.kilnWork;delete canvas.dataset.kilnSeed;}
   invalidate();return !!recipe;
  },
  setKilnReveal(value){if(!Number.isFinite(value))return;const next=P.clamp(value,0,1);if(next===kilnReveal.value)return;kilnReveal.value=next;canvas.dataset.kilnReveal=next.toFixed(4);if(kilnEnabled.value)invalidate();},
  setPresentationView(nextOrbit,nextTilt){const nextYaw=Number.isFinite(nextOrbit)?nextOrbit:orbit,nextPitch=Number.isFinite(nextTilt)?P.clamp(nextTilt,-.02,.9):tilt;if(Math.abs(nextYaw-orbit)<1e-7&&Math.abs(nextPitch-tilt)<1e-7)return;orbit=nextYaw;tilt=nextPitch;setCamera();},
  setPresentationScale(value){if(!Number.isFinite(value))return;const next=P.clamp(value,.85,1.25);if(next===presentationScale)return;presentationScale=next;baseCameraDistance=7.5/next;cameraDistance=baseCameraDistance*(entranceTime<entranceDuration?1+.04*(1-entranceTime/entranceDuration)**3:1);setCamera();},
  // 器物局部原点在底面：只缩放高度即可保持贴盘，不改真实轮廓、几何或游戏高度。
  setPresentationHeight(value){if(!animatedPreview||!Number.isFinite(value))return;const next=P.clamp(value,.65,1.15);if(next===pot.scale.y)return;pot.scale.y=next;canvas.dataset.presentationHeight=next.toFixed(4);invalidate(true);},
  get presentationAngle(){return rotor.rotation.y;},
  setPresentationRotation(value){if(!animatedPreview||(value!==null&&!Number.isFinite(value)))return;if(value===null){if(presentationRotation===null)return;presentationOffset=rotor.rotation.y-angle;presentationRotation=null;}else{if(presentationRotation===value)return;presentationRotation=value;}updatePresentationRotation();invalidate();},
  setGlazeReveal(value){if(!heroReveal||!Number.isFinite(value))return;const next=P.clamp(value,0,1);if(next===glazeReveal.value)return;glazeReveal.value=next;canvas.dataset.glazeReveal=next.toFixed(4);invalidate();},
  setLaserEngraving(progress,active){if(!heroLaser)return;const nextProgress=Number.isFinite(progress)?P.clamp(progress,0,1):laserProgress.value,nextActive=typeof active==='boolean'?(active?1:0):laserActive.value;if(nextProgress===laserProgress.value&&nextActive===laserActive.value)return;laserProgress.value=nextProgress;laserActive.value=nextActive;canvas.dataset.laserProgress=nextProgress.toFixed(4);canvas.dataset.laserActive=String(nextActive===1);invalidate();},
  orbitView(deltaOrbit=0,deltaTilt=0){if(Number.isFinite(deltaOrbit))orbit+=deltaOrbit;if(Number.isFinite(deltaTilt))tilt=P.clamp(tilt+deltaTilt,-.02,.9);setCamera();},
  resetView(){orbit=.28;tilt=.24;setCamera();},setVisible(v){const next=!!v;if(visible===next)return;visible=next;resetFrameClock();callbacks.onVisibility?.(visible,performance.now());if(!visible){up();pendingHover=null;guide.visible=false;cancelAnimationFrame(frame);frame=0;}else if(!filmCapture){if(presentationOnly)invalidate();else if(!frame)frame=requestAnimationFrame(draw);}},
  capture(width=1000,height=1100){
   const oldSize=renderer.getSize(new THREE.Vector2()),oldRatio=renderer.getPixelRatio(),oldAspect=camera.aspect,oldOrbit=orbit,oldTilt=tilt,oldGuide=guide.visible,oldRotor=rotor.rotation.y,oldDistance=cameraDistance,oldLaserProgress=laserProgress.value,oldLaserActive=laserActive.value;
   // 导出只调整展示朝向，不写入物理 angle；无论截图成败都恢复正在运行的转盘。
   try{guide.visible=false;orbit=.28;tilt=.24;rotor.rotation.y=0;laserProgress.value=1;laserActive.value=0;cameraDistance=7.5;setCamera();renderer.setPixelRatio(1);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();if(changed){rebuild();needsShadow=true;}renderScene();return canvas.toDataURL('image/png');}
   finally{camera.aspect=oldAspect;camera.updateProjectionMatrix();orbit=oldOrbit;tilt=oldTilt;rotor.rotation.y=oldRotor;laserProgress.value=oldLaserProgress;laserActive.value=oldLaserActive;cameraDistance=oldDistance;setCamera();guide.visible=oldGuide;renderer.setPixelRatio(oldRatio);renderer.setSize(oldSize.x,oldSize.y,false);renderScene();}
  },
  dispose(){disposed=true;document.removeEventListener?.('visibilitychange',resetFrameClock);cancelAnimationFrame(frame);resizer?.disconnect();renderer.dispose();env.dispose();scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.dispose());}});bump.dispose();plateTex.dispose();dialTexture.dispose();brandSeal?.dispose();},
 };
}
