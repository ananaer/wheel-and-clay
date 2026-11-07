/* Squeeks 只提供配色灵感；真实跑轮动力来自 Squeektoshi。角色 ID 不代表持有权。 */
export const COMPANIONS=Object.freeze([
 {id:'8891',glaze:'amethyst',name:['烟紫 Squeek','Amethyst Squeek'],traits:['盾形面部 · 圆点身体','Shield face · Circle body'],glazeName:['烟紫','Amethyst'],color:'#7e6b9b',accent:'#c5b1ff',imageSrc:'./brand-research/official/squeek-8891-display.png'},
 {id:'8890',glaze:'coral',name:['珊瑚橘 Squeek','Coral Squeek'],traits:['菱形面部 · 梅花身体','Diamond face · Clover body'],glazeName:['珊瑚橘','Coral'],color:'#c9604c',accent:'#ffb59e',imageSrc:'./brand-research/official/squeek-8890-display.png'},
 {id:'8889',glaze:'turquoise',name:['孔雀蓝 Squeek','Turquoise Squeek'],traits:['爱心面部 · 菱形身体','Heart face · Diamond body'],glazeName:['孔雀蓝','Turquoise'],color:'#248f9c',accent:'#72e4db',imageSrc:'./brand-research/official/squeek-8889-display.png'}
].map(item=>Object.freeze({...item,name:Object.freeze(item.name),traits:Object.freeze(item.traits),glazeName:Object.freeze(item.glazeName)})));

// 兼容 JSON 中的整数 ID；不解析部分字符串、路径、对象或带空白的 ID。
export function getCompanion(id){
 if(typeof id!=='string'&&!(typeof id==='number'&&Number.isInteger(id)))return null;
 return COMPANIONS.find(item=>item.id===String(id))||null;
}

const companionWords={
 eyebrow:['Squeeks 共创社','The Squeeks studio'],
 title:['挑一位 Squeek，\n把它的颜色烧进作品。','Pick a Squeek.\nFire its colors into your piece.'],
 choose:['选择配色伙伴','Choose a color companion'],
 sample:['Sepolia 角色样例','Sepolia character sample'],
 palette:['角色配色','Companion palette'],
 start:['一起做陶器','Make a pot together'],
 signature:['你 × Squeek #','You × Squeek #'],
 select:['选择','Choose'],
 updated:['配色已更新为','Palette updated to'],
 failed:['这次未能更新配色，请再试一次。','The palette could not be updated. Please try again.'],
 startFailed:['暂时无法进入工作台，请再试一次。','The studio could not open. Please try again.']
};
let companionInstance=0;

export function createCompanions({root,lang=()=> 'zh',selected=()=> '8891',onSelect=()=>{},onStart=()=>{}}={}){
 if(!root?.ownerDocument)throw new TypeError('A companion section root is required.');
 const doc=root.ownerDocument,number=++companionInstance,listeners=[];
 const hadClass=root.classList.contains('companions-section');
 root.classList.add('companions-section');
 let disposed=false,lastRender='',selectionRequest=0;
 const text=(key)=>companionWords[key][lang()==='en'?1:0];
 const element=(tag,className,content)=>{const node=doc.createElement(tag);if(className)node.className=className;if(content!==undefined)node.textContent=content;return node;};
 const write=(node,value)=>{if(node.textContent!==value)node.textContent=value;};
 const listen=(node,type,fn)=>{node.addEventListener(type,fn);listeners.push(()=>node.removeEventListener(type,fn));};
 const shell=element('div','companions-shell');
 const portrait=element('figure','companions-portrait');
 const portraitImage=element('img','companions-character');portraitImage.width=250;portraitImage.height=250;portraitImage.decoding='async';
 const portraitCaption=element('figcaption','companions-caption');
 const roleId=element('strong','companions-id'),sample=element('span','companions-sample');
 portraitCaption.append(roleId,sample);portrait.append(portraitImage,portraitCaption);
 const copy=element('div','companions-copy'),eyebrow=element('p','companions-eyebrow'),title=element('h2','companions-title');
 title.id=`companions-title-${number}`;title.tabIndex=-1;
 const group=element('div','companions-choices');group.setAttribute('role','group');
 const choiceNodes=COMPANIONS.map(companion=>{
  const button=element('button','companions-choice');button.type='button';button.dataset.companion=companion.id;button.setAttribute('aria-pressed','false');
  const image=element('img');image.src=companion.imageSrc;image.alt='';image.width=45;image.height=45;image.decoding='async';
  const label=element('span','companions-choice-id',`#${companion.id}`);button.append(image,label);group.append(button);
  listen(button,'click',()=>{
   if(disposed)return;
   const request=++selectionRequest;
   try{
    const result=onSelect(companion);render();
    if(result&&typeof result.then==='function')result.then(()=>{if(!disposed&&request===selectionRequest){render();announce(companion);}},()=>{if(!disposed&&request===selectionRequest)write(status,text('failed'));});
    else announce(companion);
   }catch{if(!disposed)write(status,text('failed'));}
  });
  return {button,companion};
 });
 const traits=element('p','companions-traits');copy.append(eyebrow,title,group,traits);
 const action=element('div','companions-action'),palette=element('div','companions-palette'),swatch=element('span','companions-swatch');swatch.setAttribute('aria-hidden','true');
 const paletteCopy=element('div'),paletteLabel=element('span','companions-palette-label'),paletteName=element('strong','companions-palette-name');paletteCopy.append(paletteLabel,paletteName);palette.append(swatch,paletteCopy);
 const start=element('button','companions-start');start.type='button';const startText=element('span'),arrow=element('span','companions-start-arrow','↗');arrow.setAttribute('aria-hidden','true');start.append(startText,arrow);
 const signature=element('p','companions-signature');action.append(palette,start,signature);
 const status=element('p','companions-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');
 shell.append(portrait,copy,action,status);root.replaceChildren(shell);root.setAttribute('aria-labelledby',title.id);
 listen(start,'click',()=>{if(disposed)return;try{const result=onStart();if(result&&typeof result.then==='function')result.catch(()=>{if(!disposed)write(status,text('startFailed'));});}catch{write(status,text('startFailed'));}});
 function announce(companion){if(getCompanion(selected())?.id===companion.id)write(status,`${text('updated')} ${companion.glazeName[lang()==='en'?1:0]} · Squeek #${companion.id}`);}
 function render(){
  if(disposed)return;
  const en=lang()==='en',index=en?1:0,companion=getCompanion(selected())||COMPANIONS[0],key=`${en}/${companion.id}`;
  if(key===lastRender)return;lastRender=key;
  root.dataset.companion=companion.id;root.dataset.companionsLang=en?'en':'zh';root.style.setProperty('--companion-accent',companion.accent);root.style.setProperty('--companion-glaze',companion.color);
  if(portraitImage.getAttribute('src')!==companion.imageSrc)portraitImage.src=companion.imageSrc;
  portraitImage.alt=`Squeek #${companion.id} · ${companion.traits[index]}`;
  write(roleId,`Squeek #${companion.id}`);write(sample,text('sample'));write(eyebrow,text('eyebrow'));write(title,text('title'));write(traits,companion.traits[index]);
  group.setAttribute('aria-label',text('choose'));
  for(const item of choiceNodes){item.button.setAttribute('aria-pressed',String(item.companion.id===companion.id));item.button.setAttribute('aria-label',`${text('select')} Squeek #${item.companion.id} · ${item.companion.glazeName[index]}`);}
  write(paletteLabel,text('palette'));write(paletteName,companion.glazeName[index]);write(startText,text('start'));write(signature,text('signature')+companion.id);write(status,'');
 }
 render();
 return {render,dispose(){if(disposed)return;disposed=true;selectionRequest++;for(const remove of listeners)remove();shell.remove();if(!hadClass)root.classList.remove('companions-section');root.removeAttribute('aria-labelledby');delete root.dataset.companion;delete root.dataset.companionsLang;root.style.removeProperty('--companion-accent');root.style.removeProperty('--companion-glaze');}};
}

const companionWordmarkSrc='./brand-research/official/squeekchain-wordmark.svg';

async function companionDecodedImage(source){
 const image=new Image();image.decoding='async';image.src=source;await image.decode();
 if(!image.naturalWidth||!image.naturalHeight)throw new Error('The artwork image is empty.');
 return image;
}

function companionCardText(context,value,x,y,{width=1060,size=24,min=16,color='#ece6f1',align='left',weight='400'}={}){
 const raw=typeof value==='string'?value.replace(/\s+/g,' ').trim():'';
 let label=raw.slice(0,400),fontSize=size;
 context.textAlign=align;context.fillStyle=color;
 const font=()=>{context.font=`${weight} ${fontSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif`;};font();
 while(fontSize>min&&context.measureText(label).width>width){fontSize--;font();}
 if(context.measureText(label).width>width){while(label.length&&context.measureText(label+'…').width>width)label=label.slice(0,-1);label+='…';}
 context.fillText(label,x,y);
}

function companionContain(context,image,x,y,width,height){
 const scale=Math.min(width/image.naturalWidth,height/image.naturalHeight),w=image.naturalWidth*scale,h=image.naturalHeight*scale;
 context.drawImage(image,x+(width-w)/2,y+(height-h)/2,w,h);
}

/* 只解码已保存的本地作品和已核实的打包素材；不从记录中的 URL 请求图片。 */
export async function drawCompanionCard(record,{lang='zh',glazeName='',surfaceName='',orderCaption='',timeLabel=''}={}){
 if(!record||typeof record.image!=='string'||!/^data:image\/(?:png|webp|jpeg);base64,[A-Za-z0-9+/=\r\n]+$/.test(record.image))throw new TypeError('A saved local pottery image is required.');
 const en=lang==='en',companion=getCompanion(record.companionId),sim=record.hadSim===true||record.order?.hadSim===true,live=!sim&&record.hadSim===false;
 const [photo,wordmark,character]=await Promise.all([companionDecodedImage(record.image),companionDecodedImage(companionWordmarkSrc),companion?companionDecodedImage(companion.imageSrc):Promise.resolve(null)]);
 const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1500;const g=canvas.getContext('2d');if(!g)throw new Error('The artwork card could not be created.');
 const accent=companion?.accent||'#edc47e',muted='#a69aad',line='#332b3a';
 const label=(zh,english)=>en?english:zh;
 const write=(value,x,y,options)=>companionCardText(g,value,x,y,options);
 g.fillStyle='#101114';g.fillRect(0,0,1200,1500);g.strokeStyle=line;g.lineWidth=1;g.strokeRect(26.5,26.5,1147,1447);
 companionContain(g,wordmark,70,47,310,139);
 write(label('轮间 · 共同创作','Wheel & Clay · Made together'),1130,92,{width:650,size:27,min:21,align:'right'});
 write(label('Squeekchain 社区作品','A Squeekchain community creation'),1130,132,{width:650,size:18,align:'right',color:muted});
 const source=sim?label('模拟作品','SIMULATION'):live?label('实时模式作品','LIVE MODE'):label('轮速来源未记录','SOURCE NOT RECORDED');
 write(source,1130,177,{width:650,size:18,align:'right',color:accent,weight:'500'});
 g.strokeStyle=line;g.beginPath();g.moveTo(70,217);g.lineTo(1130,217);g.stroke();

 if(character){
  // 仅在卡片合成时融合原 SVG 深色底，官方文件与后续陶器绘制保持原样。
  g.save();g.globalCompositeOperation='lighten';companionContain(g,character,44,310,430,430);g.restore();
  write(`Squeek #${companion.id}`,70,805,{width:385,size:27,color:accent});
  write(companion.traits[en?1:0],70,843,{width:385,size:17,color:muted});
  write(label('配色灵感 · Sepolia 样例','Color inspiration · Sepolia sample'),70,884,{width:385,size:18,color:muted});
  g.strokeStyle='#55425f';g.beginPath();g.moveTo(450,563);g.lineTo(498,563);g.stroke();
  write('×',474,553,{width:35,size:28,color:accent,align:'center'});
  companionContain(g,photo,508,258,622,662);
 }else{
  companionContain(g,photo,150,248,900,670);
 }
 const glaze=typeof glazeName==='string'&&glazeName.trim()?glazeName:label('陶器','Pottery');
 const finish=typeof surfaceName==='string'&&surfaceName.trim()?surfaceName:'';
 write(finish?`${glaze} · ${finish}`:glaze,1130,963,{width:character?622:1060,size:30,min:20,align:'right'});
 g.beginPath();g.moveTo(70,1010);g.lineTo(1130,1010);g.strokeStyle=line;g.stroke();

 // 三种身份分栏：模拟作品不把虚拟动力署给真实仓鼠，旧记录不补角色。
 const powerName=sim?label('模拟跑轮','Simulated wheel'):live?'Squeektoshi':label('来源未记录','Not recorded');
 const powerDetail=sim?label('模拟 Squeektoshi 的跑轮','A simulation of Squeektoshi’s wheel'):live?label('真实仓鼠跑轮数据','Real hamster wheel data'):label('旧作品未保存轮速来源','This piece has no saved wheel source');
 const authors=[
  {x:70,label:label('跑轮动力','WHEEL POWER'),name:powerName,detail:powerDetail},
  {x:440,label:label('塑形与施釉','SHAPING & GLAZING'),name:label('你','You'),detail:label('手感，留在器形里。','Your touch, kept in clay.')},
  {x:810,label:label('配色灵感','COLOR INSPIRATION'),name:companion?`Squeek #${companion.id}`:label('未记录','Not recorded'),detail:companion?label('Sepolia 测试网角色样例','Sepolia testnet character sample'):label('保留旧作品原有身份','The original identity is preserved')}
 ];
 for(const author of authors){write(author.label,author.x,1066,{width:320,size:15,color:muted});write(author.name,author.x,1114,{width:320,size:29,min:22,color:accent});write(author.detail,author.x,1154,{width:320,size:16,min:14,color:muted});}
 g.beginPath();g.moveTo(70,1190);g.lineTo(1130,1190);g.stroke();

 const rawTurns=record.order?.used??record.turns,turns=typeof rawTurns==='number'&&Number.isFinite(rawTurns)&&rawTurns>=0?rawTurns:null;
 write(turns===null?label('陶轮圈数未记录','Pottery-wheel turns not recorded'):`${turns.toFixed(1)} ${label('陶轮圈数','pottery-wheel turns')}`,70,1240,{width:510,size:22,color:'#d3c7dc'});
 write(typeof timeLabel==='string'&&timeLabel.trim()?timeLabel:label('创作时间未记录','Creation time not recorded'),1130,1240,{width:510,size:19,align:'right',color:muted});
 if(typeof orderCaption==='string'&&orderCaption.trim())write(orderCaption,70,1291,{width:1060,size:23,min:18,color:'#d3c7dc'});
 g.beginPath();g.moveTo(70,1342);g.lineTo(1130,1342);g.stroke();
 write(label('把下一件，交给你的双手。','Make the next one yours.'),70,1395,{width:1060,size:27,min:22,color:'#ece6f1'});
 write(label('社区作品 · 非官方发布','Community creation · Not an official release'),70,1439,{width:680,size:16,color:muted});
 write('Squeekchain',1130,1439,{width:300,size:19,align:'right',color:accent});
 return canvas.toDataURL('image/png');
}
