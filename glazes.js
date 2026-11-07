/* 釉色与表面工艺独立：藏品只存稳定 ID，不存界面译名。 */
export const GLAZES=Object.freeze([
 {id:'jade',name:['翡翠青','Jade'],color:'#286e61',accent:'#aac8a0'},
 {id:'ivory',name:['暖象牙','Ivory'],color:'#ddd5bd',accent:'#ad9270'},
 {id:'cobalt',name:['深钴蓝','Cobalt'],color:'#233d73',accent:'#94b5ce'},
 {id:'iron',name:['铁锈红','Iron'],color:'#74351f',accent:'#d8a06a'},
 {id:'seafoam',name:['青瓷绿','Celadon'],color:'#9caf95',accent:'#e4dec1'},
 {id:'turquoise',name:['孔雀蓝','Turquoise'],color:'#176f81',accent:'#a4dfd6'},
 {id:'lagoon',name:['晴空蓝','Sky'],color:'#729aba',accent:'#e0e6df'},
 {id:'ink',name:['曜石黑','Obsidian'],color:'#232b31',accent:'#7b8993'},
 {id:'amethyst',name:['烟紫','Amethyst'],color:'#7e6b9b',accent:'#c5b3cd'},
 {id:'plum',name:['桑葚紫','Mulberry'],color:'#743c65',accent:'#c99ab2'},
 {id:'rose',name:['胭脂粉','Rose'],color:'#c89194',accent:'#f1d9c5'},
 {id:'coral',name:['珊瑚橘','Coral'],color:'#c9604c',accent:'#efbf8b'},
 {id:'saffron',name:['姜黄','Saffron'],color:'#d4aa49',accent:'#f0df9b'},
 {id:'ochre',name:['蜂蜜琥珀','Amber'],color:'#a56f34',accent:'#e1bd72'},
 {id:'olive',name:['苔藓绿','Moss'],color:'#68744a',accent:'#bdc69a'},
 {id:'slate',name:['雾岩灰','Slate'],color:'#89938d',accent:'#d8d7c6'},
].map(item=>Object.freeze({...item,name:Object.freeze(item.name)})));

export const FINISHES=Object.freeze([
 {id:'glossy',name:['光釉','Gloss'],color:'#dae5df',accent:'#ffffff',mode:0},
 {id:'matte',name:['哑釉','Matte'],color:'#b5b3a8',accent:'#cfcdc2',mode:1},
 {id:'speckle',name:['细斑釉','Speckled'],color:'#c8bea3',accent:'#68513b',mode:2},
 {id:'flow',name:['双色流釉','Two-tone flow'],color:'#286e61',accent:'#aac8a0',mode:3},
].map(item=>Object.freeze({...item,name:Object.freeze(item.name)})));

export function getGlaze(id){return GLAZES.find(item=>item.id===id)||GLAZES[0];}
export function getSurface(id){return FINISHES.find(item=>item.id===id)||FINISHES[0];}

/* 可在无 WebGL 环境下验证的材质规则。光泽滑杆始终在所选工艺范围内调节。 */
export function materialFor(glazeId,surfaceId,finish=.72){
 const glaze=getGlaze(glazeId),surface=getSurface(surfaceId);
 const gloss=typeof finish==='number'&&Number.isFinite(finish)?Math.max(0,Math.min(1,finish)):.72;
 const base={color:glaze.color,accent:glaze.accent,mode:surface.mode,gloss,
  roughness:.36-gloss*.26,clearcoat:1,clearcoatRoughness:.32-gloss*.24,
  metalness:glaze.id==='iron'?.14:.025,bumpScale:.004,envMapIntensity:1.05};
 if(surface.id==='matte')return {...base,roughness:.87-gloss*.23,clearcoat:.05+gloss*.07,clearcoatRoughness:.65-gloss*.15,metalness:.005,bumpScale:.009,envMapIntensity:.75};
 if(surface.id==='speckle')return {...base,roughness:.52-gloss*.27,clearcoat:.55+gloss*.35,clearcoatRoughness:.37-gloss*.19,bumpScale:.0065,envMapIntensity:.95};
 if(surface.id==='flow')return {...base,roughness:.30-gloss*.21,clearcoat:1,clearcoatRoughness:.24-gloss*.17,bumpScale:.003,envMapIntensity:1.12};
 return base;
}
