"""Deterministic launcher packaging of the exact user-supplied Dominion artwork.
No redraw: remove only connected near-black outside the rounded illustration,
resize, and add Android safe-zone padding. Original JPEG remains unmodified.
"""
from collections import deque
from pathlib import Path
import hashlib,json
from PIL import Image
root=Path(__file__).resolve().parent.parent
master=root/'assets/icon/dominion-master.jpg'
im=Image.open(master).convert('RGBA');w,h=im.size;pixels=im.load()
seen=set();queue=deque([(x,0) for x in range(w)]+[(x,h-1) for x in range(w)]+[(0,y) for y in range(h)]+[(w-1,y) for y in range(h)])
while queue:
 x,y=queue.popleft()
 if (x,y) in seen:continue
 seen.add((x,y));r,g,b,a=pixels[x,y]
 if max(r,g,b)>22:continue
 pixels[x,y]=(r,g,b,0)
 for dx,dy in ((-1,0),(1,0),(0,-1),(0,1)):
  xx,yy=x+dx,y+dy
  if 0<=xx<w and 0<=yy<h and (xx,yy) not in seen:queue.append((xx,yy))
im=im.crop(im.getbbox());art=im.copy();art.thumbnail((1024,1024),Image.Resampling.LANCZOS)
icon=Image.new('RGBA',(1024,1024),'#0B2030');icon.alpha_composite(art,((1024-art.width)//2,(1024-art.height)//2));icon.convert('RGB').save(root/'assets/icon/dominion.png')
foreground=Image.new('RGBA',(1024,1024));art=im.copy();art.thumbnail((660,660),Image.Resampling.LANCZOS);foreground.alpha_composite(art,((1024-art.width)//2,(1024-art.height)//2));foreground.save(root/'assets/icon/dominion-adaptive-foreground.png')
(root/'assets/icon/source.json').write_text(json.dumps({'original':'dominion-master.jpg','originalSha256':hashlib.sha256(master.read_bytes()).hexdigest(),'artwork':'Exact user upload; no redraw','adaptiveCanvas':[1024,1024],'adaptiveArtworkBox':foreground.getbbox(),'background':'#0B2030'},indent=2)+'\n')
# Circle mask preview at launcher scale, for visual inspection only.
from PIL import ImageDraw
preview=Image.new('RGBA',(1024,1024),'#0B2030');preview.alpha_composite(foreground);mask=Image.new('L',(1024,1024));ImageDraw.Draw(mask).ellipse((85,85,939,939),fill=255);preview.putalpha(mask);preview.resize((192,192),Image.Resampling.LANCZOS).save('/workspace/scratch/dominion-icon-preview.png')
