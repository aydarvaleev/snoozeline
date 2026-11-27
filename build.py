#!/usr/bin/env python3
"""Build dist/snoozeline-playgama.zip (upload to Playgama), dist/snoozeline-crazygames.zip + dist/crazygames-covers/ and dist/snoozeline-standalone.html (single-file playtest)."""
import re, base64, os, shutil, subprocess
shutil.rmtree('dist', ignore_errors=True)
os.makedirs('dist/zip/src'); os.makedirs('dist/zip/assets')
for f in ['index.html', 'matter.min.js', 'playgama-bridge.js', 'playgama-bridge-config.json']: shutil.copy(f, 'dist/zip/')
for f in ['sim', 'levels', 'i18n', 'platform', 'art', 'game']: shutil.copy(f'src/{f}.js', 'dist/zip/src/')
for f in os.listdir('assets'): shutil.copy('assets/' + f, 'dist/zip/assets/')
shutil.copytree('licenses', 'dist/zip/licenses')
subprocess.run('cd dist/zip && zip -qr ../snoozeline-playgama.zip .', shell=True, check=True)
# CrazyGames: the same build (Bridge detects the platform and loads the CrazyGames SDK itself) plus their covers
subprocess.run('cd dist/zip && zip -qr ../snoozeline-crazygames.zip .', shell=True, check=True)
os.makedirs('dist/crazygames-covers')
for src, dst in [('cover_cg_landscape.jpg', 'landscape_1920x1080.jpg'), ('cover_portrait23.jpg', 'portrait_800x1200.jpg'), ('cover_cg_square.jpg', 'square_800x800.jpg'),
                 ('preview_landscape_1920x1080.mp4', 'video_landscape_1920x1080.mp4'), ('preview_portrait_1080x1620.mp4', 'video_portrait_1080x1620.mp4')]:
    if os.path.exists('promo/' + src): shutil.copy('promo/' + src, 'dist/crazygames-covers/' + dst)
d = 'dist/zip/'; h = open(d + 'index.html').read()
h = re.sub(r'<script src="([^"]+)"></script>', lambda m: '' if 'bridge' in m.group(1) else '<script>' + open(d + m.group(1)).read().replace('</script>', '<\\/script>') + '</script>', h)
b64 = {n[:-4]: base64.b64encode(open('assets/' + n, 'rb').read()).decode() for n in os.listdir('assets')}
shim = "<script>window.__AUDIO=" + str(b64).replace("'", '"') + ";var _f=window.fetch;window.fetch=function(u){var m=/assets\\/(\\w+)\\.(ogg|mp3)/.exec(u);if(m&&window.__AUDIO[m[1]]){var s=atob(window.__AUDIO[m[1]]),a=new Uint8Array(s.length);for(var i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return Promise.resolve({ok:true,arrayBuffer:function(){return Promise.resolve(a.buffer)}})}return _f.apply(this,arguments)}</script>"
f = h.find('<script>'); h = h[:f] + shim + h[f:]
open('dist/snoozeline-standalone.html', 'w').write(h)
print('ok')
