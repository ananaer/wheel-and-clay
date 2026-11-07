import assert from 'node:assert/strict';
import {SHARE_URL,buildShareCopy,buildXIntent,shareFileName,pngBytes,copyPngToClipboard} from '../share.js';
let total=0;
function check(name,test){test();total++;console.log(`PASS ${name}`);}
const sample={hadSim:true,order:{play:'repair',score:96,hadSim:true},profile:[.9],id:123456789,apiSample:12345,image:'private image'};
check('分享明确保留模拟来源，切实时标记不能洗掉模拟历史',()=>{
 assert.match(buildShareCopy(sample,'zh'),/模拟练习作品/);
 assert.match(buildShareCopy({...sample,hadSim:false},'en'),/Made in simulation/);
 assert.match(buildShareCopy({hadSim:false},'en'),/Made in live mode/);
 assert.match(buildShareCopy({},'zh'),/轮速来源未记录/);
});
check('中英文案分别完整且包含有意义的挑战成绩',()=>{
 const zh=buildShareCopy(sample,'zh'),en=buildShareCopy(sample,'en');
 assert.match(zh,/修坯委托 · 轮廓吻合 96%/);assert.doesNotMatch(zh,/Made|Rescue|shape/);
 assert.match(en,/Rescue a Pot · 96% shape match/);assert.doesNotMatch(en,/[\u3400-\u9fff]/);
 assert.match(buildShareCopy({hadSim:true,order:{play:'turns',score:78}},'en'),/Twenty turns/);
 assert.match(buildShareCopy({hadSim:true,order:{play:'study',score:90}},'zh'),/临摹练习/);
});
check('X 只收到公开试玩地址与必要文案，不带本机地址或作品隐私',()=>{
 const url=new URL(buildXIntent({...sample,url:'http://localhost:8772',caption:'@someone',token:'secret'},'en'));
 assert.equal(url.origin,'https://x.com');assert.equal(url.pathname,'/intent/tweet');
 assert.deepEqual([...url.searchParams.keys()],['text','url']);assert.equal(url.searchParams.get('url'),SHARE_URL);
 for(const secret of ['localhost','123456789','12345','private image','secret','@someone'])assert.ok(!decodeURIComponent(url.href).includes(secret));
});
check('文案为标准帖子预留链接空间，不因中文双字重超出280',()=>{
 for(const lang of ['zh','en'])for(const play of ['repair','turns','study','burst',undefined]){
  const text=buildShareCopy({hadSim:true,order:{play,score:100}},lang);
  const weighted=Array.from(text).reduce((n,char)=>n+(char.codePointAt(0)>0x10ff?2:1),0);
  assert.ok(weighted+24<=280,`${lang}/${play}: ${weighted}`);
 }
});
check('无效成绩不会生成假分数或损坏文件名',()=>{
 for(const score of [NaN,Infinity,-1,101,'96',null,undefined]){
  const record={hadSim:true,order:{play:'repair',score}};
  assert.ok(!buildShareCopy(record,'en').includes('shape match'));assert.equal(shareFileName(record),'wheel-and-clay.png');
 }
 assert.equal(shareFileName(sample),'wheel-and-clay-96.png');
});
check('仅接受实际 PNG 数据，拒绝远程内容和伪装文件',()=>{
 const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
 assert.equal(pngBytes(png)[0],137);assert.ok(pngBytes(png).length>32);
 for(const bad of ['https://example.com/image.png','data:text/html;base64,PHNjcmlwdD4=','data:image/png;base64,SGVsbG8=',png.replace('png','svg+xml'),null])assert.throws(()=>pngBytes(bad),TypeError);
});
async function checkAsync(name,test){await test();total++;console.log(`PASS ${name}`);}
const clipboardPng='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
class PNGItem{constructor(data){this.data=data;}static supports(type){return type==='image/png';}}
await checkAsync('复制只写当前PNG图像，不向剪贴板写入链接或私有字段',async()=>{
 let received;
 await copyPngToClipboard(clipboardPng,{ClipboardItemCtor:PNGItem,clipboard:{write(items){received=items;return Promise.resolve();}}});
 assert.equal(received.length,1);assert.deepEqual(Object.keys(received[0].data),['image/png']);
 const image=received[0].data['image/png'];assert.equal(image.type,'image/png');
 assert.deepEqual(new Uint8Array(await image.arrayBuffer()),pngBytes(clipboardPng));
});
await checkAsync('剪贴板写入在调用的同步阶段启动，保留用户点击激活',async()=>{
 let invoked=false,finish;
 const writing=copyPngToClipboard(clipboardPng,{ClipboardItemCtor:PNGItem,clipboard:{write(){invoked=true;return new Promise(resolve=>{finish=resolve;});}}});
 assert.equal(invoked,true);finish();await writing;
});
await checkAsync('复制无效或远程图片时不触碰剪贴板',async()=>{
 let writes=0;const environment={ClipboardItemCtor:PNGItem,clipboard:{write(){writes++;}}};
 for(const bad of ['https://example.com/photo.png','data:image/png;base64,SGVsbG8=',null])await assert.rejects(copyPngToClipboard(bad,environment),TypeError);
 assert.equal(writes,0);
});
await checkAsync('复制权限拒绝保留失败，不假报已复制',async()=>{
 const denied=new DOMException('No clipboard permission','NotAllowedError');
 await assert.rejects(copyPngToClipboard(clipboardPng,{ClipboardItemCtor:PNGItem,clipboard:{write(){return Promise.reject(denied);}}}),error=>error===denied);
});
await checkAsync('不支持PNG剪贴板时安全失败，未尝试非图片格式替代',async()=>{
 let writes=0;
 class UnsupportedItem{static supports(){return false;}}
 await assert.rejects(copyPngToClipboard(clipboardPng,{ClipboardItemCtor:UnsupportedItem,clipboard:{write(){writes++;}}}),/unavailable/);
 await assert.rejects(copyPngToClipboard(clipboardPng,{ClipboardItemCtor:PNGItem,clipboard:null}),/unavailable/);
 assert.equal(writes,0);
});
console.log(`RESULT ${total}/${total}`);
