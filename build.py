"""本地独立 HTML 与源码包；标准库构建，不安装依赖、不发布。"""
from pathlib import Path
import base64
import zipfile
import re
root=Path(__file__).resolve().parent
html=(root/'index.html').read_text()
for css in ['style','home','share','companions','brand']:
    html=html.replace(f'<link rel="stylesheet" href="{css}.css">','<style>'+(root/f'{css}.css').read_text()+'</style>')
for name in ['core','engine']:
    html=html.replace(f'<script src="{name}.js"></script>','<script>'+(root/f'{name}.js').read_text()+'</script>')
three=base64.b64encode((root/'vendor/three.module.min.js').read_bytes()).decode()
modules=[]
for name in ['glazes','scene','audio','activity','orders','companions','home','share','app']:
    source=(root/f'{name}.js').read_text()
    source=source.replace("'./vendor/three.module.min.js'","'data:text/javascript;base64,"+three+"'")
    source=re.sub(r"import \{[^}]+\} from './[^']+\.js';",'',source)
    source=re.sub(r'\bexport\s+(?=(?:async\s+)?function|const|let|class)','',source)
    modules.append(source)
html=html.replace('<script type="module" src="app.js"></script>','<script type="module">'+'\n'.join(modules)+'</script>')
# 仅把经过溯源的官方矢量素材嵌入发布页面，绝不引用研究目录的其他素材。
brand_assets=['squeekchain-wordmark.svg','squeekchain-hamster-mark.svg','squeek-8889-sepolia.svg','squeek-8890-sepolia.svg','squeek-8891-sepolia.svg']
for filename in brand_assets:
    encoded=base64.b64encode((root/'brand-research'/'official'/filename).read_bytes()).decode()
    html=html.replace('./brand-research/official/'+filename,'data:image/svg+xml;base64,'+encoded)
if 'brand-research/' in html or 'squeektoshi-ceramic' in html:
    raise SystemExit('停止：发布页面仍引用未内联素材或已拒收的陶瓷角色。')
(root/'Wheel-and-Clay.html').write_text(html)
(root/'qa').mkdir(exist_ok=True)
for mode,inject in [('timeout',"window.fetch=(_url,options={})=>new Promise((_resolve,reject)=>{options.signal?.addEventListener('abort',()=>reject(new DOMException('QA timeout','AbortError')),{once:true});});"),('offline',"window.fetch=async()=>{throw Error('QA offline fixture')};"),('no-webgl',"HTMLCanvasElement.prototype.getContext=new Proxy(HTMLCanvasElement.prototype.getContext,{apply(target,that,args){return /webgl/i.test(args[0])?null:Reflect.apply(target,that,args);}});"),('hardware',"window.fetch=async()=>new Response(JSON.stringify({measurement:{freshness:'online',provenance:'hardware',coreStatus:'ACTIVE',rpmMilli:18000,speedMmPerSecond:216,observedAt:new Date().toISOString()}}),{status:200,headers:{'Content-Type':'application/json'}});")]:
    fixture=html.replace('<body>','<body><div style="position:fixed;bottom:0;left:0;z-index:99;background:#fff09b;color:#111;padding:3px;font:10px monospace">QA fixture · '+mode+' · NOT LIVE DATA</div><script>'+inject+'</script>')
    (root/'qa'/f'{mode}.html').write_text(fixture)
# 源码包按明确名单导出，研究图、旧生成角色与验收夹不进入提交包。
source_files=['index.html','core.js','engine.js','app.js','glazes.js','scene.js','audio.js','activity.js','orders.js','home.js','home.css','share.js','share.css','style.css','brand.css','companions.js','companions.css','build.py','README.md','BRAND-ASSETS.md','SUBMISSION.md','DEPLOYMENT.md','Wheel-and-Clay.html','vendor/three.module.min.js','vendor/THREE-LICENSE.txt','deploy/prepare.py','deploy/wrangler.toml']
source_files += ['brand-research/official/'+name for name in brand_assets]
source_files += [str(path.relative_to(root)) for path in sorted((root/'tests').glob('test_*'))]
with zipfile.ZipFile(root/'Wheel-and-Clay.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for name in source_files:
        path=root/name
        if path.is_file():archive.write(path,'Wheel-and-Clay/'+name)
print('Built Wheel-and-Clay.html and Wheel-and-Clay.zip')
