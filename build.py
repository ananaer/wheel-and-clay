"""本地独立 HTML 与源码包；标准库构建，不安装依赖、不发布。"""
from pathlib import Path
import base64
import zipfile
import re
root=Path(__file__).resolve().parent
html=(root/'index.html').read_text()
for css in ['style','home','share']:
    html=html.replace(f'<link rel="stylesheet" href="{css}.css">','<style>'+(root/f'{css}.css').read_text()+'</style>')
for name in ['core','engine']:
    html=html.replace(f'<script src="{name}.js"></script>','<script>'+(root/f'{name}.js').read_text()+'</script>')
engine=base64.b64encode((root/'vendor/three.module.min.js').read_bytes()).decode()
scene=(root/'scene.js').read_text().replace("'./vendor/three.module.min.js'","'data:text/javascript;base64,"+engine+"'").replace('export function createStudio','function createStudio')
glazes=(root/'glazes.js').read_text().replace('export const ','const ').replace('export function ','function ')
scene=re.sub(r"import \{[^}]+\} from './glazes.js';",'',scene)
audio=(root/'audio.js').read_text().replace('export const SCORE','const SCORE').replace('export function ','function ')
activity=(root/'activity.js').read_text().replace('export function ','function ')
orders=(root/'orders.js').read_text().replace('export function createOrders','function createOrders')
home=(root/'home.js').read_text().replace('export function ','function ').replace('export const ','const ')
share=(root/'share.js').read_text().replace('export function ','function ').replace('export const ','const ')
app=(root/'app.js').read_text().replace("import {createStudio} from './scene.js';",'').replace("import {createOrders} from './orders.js';",'').replace("import {createSoundscape} from './audio.js';",'').replace("import {activityEvidence} from './activity.js';",'')
app=re.sub(r"import \{[^}]+\} from './(?:glazes|home|share).js';",'',app)
html=html.replace('<script type="module" src="app.js"></script>','<script type="module">'+glazes+'\n'+scene+'\n'+audio+'\n'+activity+'\n'+orders+'\n'+home+'\n'+share+'\n'+app+'</script>')
(root/'Wheel-and-Clay.html').write_text(html)
(root/'qa').mkdir(exist_ok=True)
for mode,inject in [('timeout',"window.fetch=(_url,options={})=>new Promise((_resolve,reject)=>{options.signal?.addEventListener('abort',()=>reject(new DOMException('QA timeout','AbortError')),{once:true});});"),('offline',"window.fetch=async()=>{throw Error('QA offline fixture')};"),('no-webgl',"HTMLCanvasElement.prototype.getContext=new Proxy(HTMLCanvasElement.prototype.getContext,{apply(target,that,args){return /webgl/i.test(args[0])?null:Reflect.apply(target,that,args);}});"),('hardware',"window.fetch=async()=>new Response(JSON.stringify({measurement:{freshness:'online',provenance:'hardware',coreStatus:'ACTIVE',rpmMilli:18000,speedMmPerSecond:216,observedAt:new Date().toISOString()}}),{status:200,headers:{'Content-Type':'application/json'}});")]:
    fixture=html.replace('<body>','<body><div style="position:fixed;bottom:0;left:0;z-index:99;background:#fff09b;color:#111;padding:3px;font:10px monospace">QA fixture · '+mode+' · NOT LIVE DATA</div><script>'+inject+'</script>')
    (root/'qa'/f'{mode}.html').write_text(fixture)
with zipfile.ZipFile(root/'Wheel-and-Clay.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(root.rglob('*')):
        if path.is_file() and path.suffix!='.zip' and not any(part in {'qa','.git','.wrangler','__pycache__','public'} for part in path.relative_to(root).parts):
            archive.write(path,'Wheel-and-Clay/'+str(path.relative_to(root)))
print('Built Wheel-and-Clay.html and Wheel-and-Clay.zip')
