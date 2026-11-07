import assert from 'node:assert/strict';
import {GLAZES,FINISHES,getGlaze,getSurface,materialFor} from '../glazes.js';

let total=0;
function check(name,test){test();total++;console.log(`PASS ${name}`);}

check('釉色具备不同色值、双语名称和稳定 ID',()=>{
 assert.ok(GLAZES.length>=16);
 assert.equal(new Set(GLAZES.map(item=>item.id)).size,GLAZES.length);
 assert.equal(new Set(GLAZES.map(item=>item.color)).size,GLAZES.length);
 for(const item of [...GLAZES,...FINISHES]){
  assert.match(item.id,/^[a-z]+$/);
  assert.equal(item.name.length,2);
  assert.match(item.name[0],/[\u3400-\u9fff]/);
  assert.match(item.name[1],/[a-z]/i);
  assert.match(item.color,/^#[0-9a-f]{6}$/i);
  assert.match(item.accent,/^#[0-9a-f]{6}$/i);
 }
});
check('四种工艺对应四个独立 shader 分支',()=>{
 assert.deepEqual(FINISHES.map(item=>item.id),['glossy','matte','speckle','flow']);
 assert.equal(new Set(FINISHES.map(item=>materialFor('jade',item.id).mode)).size,4);
});
check('旧藏品四种釉色与默认光釉保持兼容',()=>{
 for(const [id,color] of Object.entries({jade:'#286e61',ivory:'#ddd5bd',cobalt:'#233d73',iron:'#74351f'})){
  assert.equal(getGlaze(id).color,color);
  assert.deepEqual(materialFor(id,undefined),materialFor(id,'glossy'));
 }
 assert.equal(getGlaze('missing').id,'jade');
 assert.equal(getSurface('missing').id,'glossy');
});
check('光泽滑杆在每种工艺内有效且不会把哑釉变成光釉',()=>{
 for(const surface of FINISHES){
  const dull=materialFor('jade',surface.id,0),shiny=materialFor('jade',surface.id,1);
  assert.ok(dull.roughness>shiny.roughness);
  assert.ok(dull.clearcoatRoughness>shiny.clearcoatRoughness);
 }
 assert.ok(materialFor('jade','matte',1).roughness>materialFor('jade','glossy',0).roughness);
 assert.ok(materialFor('jade','matte',1).clearcoat<materialFor('jade','glossy',0).clearcoat);
 assert.ok(materialFor('jade','speckle').bumpScale>materialFor('jade','glossy').bumpScale);
 assert.notEqual(materialFor('jade','flow').color,materialFor('jade','flow').accent);
});
check('所有颜色工艺和极端输入都产生有限合法材质参数',()=>{
 for(const glaze of GLAZES)for(const surface of FINISHES)for(const gloss of [-100,0,.72,1,100,NaN,Infinity,undefined,null,'1']){
  const spec=materialFor(glaze.id,surface.id,gloss);
  for(const key of ['roughness','clearcoat','clearcoatRoughness','metalness','bumpScale','gloss']){
   assert.ok(Number.isFinite(spec[key]),`${key} 必须有限`);
   assert.ok(spec[key]>=0&&spec[key]<=1,`${key} 超出物理范围`);
  }
  assert.ok(spec.envMapIntensity>0&&Number.isFinite(spec.envMapIntensity));
 }
});
check('釉色元数据和工艺元数据不会被单件作品污染',()=>{
 assert.ok(Object.isFrozen(GLAZES)&&Object.isFrozen(FINISHES));
 assert.throws(()=>{getGlaze('jade').color='#ffffff';},TypeError);
 const spec=materialFor('jade','flow');spec.color='#ffffff';
 assert.equal(getGlaze('jade').color,'#286e61');
});
console.log(`RESULT ${total}/${total}`);
