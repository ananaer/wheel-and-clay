import assert from 'node:assert/strict';
import {COMPANIONS,getCompanion,drawCompanionCard} from '../companions.js';

let total=0;
function check(name,test){test();total++;console.log(`PASS ${name}`);}

check('只开放三个已核实角色及固定釉色映射',()=>{
 assert.deepEqual(COMPANIONS.map(({id,glaze})=>[id,glaze]),[['8891','amethyst'],['8890','coral'],['8889','turquoise']]);
 for(const companion of COMPANIONS){
  assert.equal(getCompanion(companion.id),companion);
  assert.equal(getCompanion(Number(companion.id)),companion);
  assert.equal(companion.imageSrc,`./brand-research/official/squeek-${companion.id}-display.png`);
  assert.equal(companion.name.length,2);assert.equal(companion.traits.length,2);
  assert.match(companion.name[0],/[\u3400-\u9fff]/);assert.doesNotMatch(companion.name[1],/[\u3400-\u9fff]/);
  assert.match(companion.traits[0],/[\u3400-\u9fff]/);assert.doesNotMatch(companion.traits[1],/[\u3400-\u9fff]/);
 }
});

check('不将相似字符串、路径或对象误识别为角色',()=>{
 const untrusted={toString(){throw new Error('不应对不可信对象调用 toString');}};
 for(const id of [null,undefined,'','8891 ',' 8891','08891','8891x','8891.0','8.891e3','../8891','__proto__','constructor',8891.1,NaN,Infinity,true,{},untrusted,[],['8891'],new Number(8891),new String('8891')])assert.equal(getCompanion(id),null);
});

check('旧记录与无效角色记录不补默认共创身份',()=>{
 const legacy={id:1,glaze:'jade',hadSim:false};
 const unknown={...legacy,companionId:'9999'};
 assert.equal(getCompanion(legacy.companionId),null);assert.equal(getCompanion(unknown.companionId),null);
 assert.equal('companionId' in legacy,false);assert.equal(unknown.companionId,'9999');
 assert.equal(getCompanion({...legacy,companionId:8889}.companionId).glaze,'turquoise');
});

check('某件作品不能污染全局角色和双语资料',()=>{
 assert.ok(Object.isFrozen(COMPANIONS));
 assert.throws(()=>{getCompanion('8891').glaze='jade';},TypeError);
 assert.throws(()=>{getCompanion('8891').name[0]='被改写';},TypeError);
 assert.throws(()=>{getCompanion('8891').traits.push('新属性');},TypeError);
});

for(const image of ['https://example.com/pot.png','./some-other-file.png','data:image/svg+xml;base64,PHN2Zz4=','data:text/html;base64,PHNjcmlwdD4=',null]){
 await assert.rejects(drawCompanionCard({image,companionId:'8891'}),TypeError);
}
total++;console.log('PASS 作品卡只接受已保存的本地栅格图片，不读取记录中的外部 URL');
console.log(`RESULT ${total}/${total}`);
