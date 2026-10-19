# Bundles dist/ into one page for claude.ai Artifacts: inline CSS/JS, Three.js from jsDelivr.
# Usage: python build-artifact.py <out-dir>
import re, shutil, sys, os
here = os.path.dirname(os.path.abspath(__file__))
d = os.path.join(here, 'dist')
out = sys.argv[1]
os.makedirs(os.path.join(out, 'assets'), exist_ok=True)
for f in ('ribbon.png', 'merch-mark-blurred.png'):
    shutil.copy(os.path.join(d, 'assets', f), os.path.join(out, 'assets', f))
r = lambda f: open(os.path.join(d, f), encoding='utf8').read()
html, css = r('index.html'), r('style.css')
gest = r('gesture-engine.js').replace('export class', 'class').replace('export function', 'function')
merch = re.sub(r"^import .*\n", "", r('merchandise.js'), flags=re.M).replace('export function', 'function')
app = re.sub(r"^import .*\n", "", r('app.js'), flags=re.M)
# Downloads are inert in the artifact frame: show the PNG so the viewer can save it themselves.
old = "c.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='洋流-我的飄帶作品.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('作品已匯出為 PNG。');});"
assert old in app
app = app.replace(old, "$('save-preview').src=c.toDataURL('image/png');$('save-dialog').showModal();")
app += "\ndocument.querySelectorAll('.close-save').forEach(b=>b.onclick=()=>$('save-dialog').close());\n"
body = html[html.index('<body>') + 6:html.index('</body>')]
body += '\n<dialog id="save-dialog"><button class="close-save close" aria-label="關閉">×</button><div class="eyebrow">KEEP YOUR BAG</div><h2>收藏這一袋。</h2><p>在圖片上按右鍵選「另存圖片」，手機請長按圖片儲存。</p><img id="save-preview" alt="我打包好的垃圾袋" style="width:100%;border:1px solid var(--line)"><button class="primary-button close-save" style="margin-top:20px">完成 <span>↗</span></button></dialog>\n'
title = re.search(r'<title>(.*?)</title>', html).group(1)
page = f'''<title>{title}</title>
<style>
{css}
</style>
{body}
<script type="module">
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
{gest}
{merch}
{app}
</script>
'''
open(os.path.join(out, 'index.html'), 'w', encoding='utf8').write(page)
print('built', len(page), 'chars')
