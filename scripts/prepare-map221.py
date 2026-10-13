"""Bake unchanged 2.2 coast/lakes/rivers once. Pillow+cairocffi, no downloads."""
import hashlib, io, json
from pathlib import Path
import cairocffi as cairo
from PIL import Image
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'assets/map/dominion-2.2.1'
modern={c['sourceCode'] for c in json.loads((ROOT/'src/world/data/countries.json').read_text())}
context=[f for f in json.loads((ROOT/'src/map/geography.json').read_text()) if not f.get('provinceId') and f['id'] not in modern]
def shape(f):
    p=[[[[v['x'],v['y']] if isinstance(v,dict) else v for v in ring] for ring in polygon] for polygon in f['polygons']]
    points=[v for poly in p for ring in poly for v in ring]
    return p,dict(left=min(v[0] for v in points),right=max(v[0] for v in points),top=min(v[1] for v in points),bottom=max(v[1] for v in points))
world=[shape(f) for f in context+json.loads((ROOT/'src/world/data/country-lod.json').read_text())]
local=[shape(f) for f in context+json.loads((ROOT/'src/world/data/geometry.json').read_text())]
geography=json.loads((ROOT/'src/map/geography22.json').read_text())
def overlaps(a,b):return a['left']<=b['right'] and a['right']>=b['left'] and a['top']<=b['bottom'] and a['bottom']>=b['top']
def line(c,points,closed=False):
    c.move_to(*points[0])
    for point in points[1:]:c.line_to(*point)
    if closed:c.close_path()
def vector(c,v):
    coords=v['coordinates'];kind=v['type']
    if kind=='LineString':line(c,coords)
    elif kind=='MultiLineString':
        for r in coords:line(c,r)
    elif kind=='Polygon':
        for r in coords:line(c,r,True)
    else:
        for p in coords:
            for r in p:line(c,r,True)
def rgb(c,color):c.set_source_rgb(*(int(color[i:i+2],16)/255 for i in (1,3,5)))
records=[];requires=[]
for row in (ROOT/'src/map/atlas22Assets.ts').read_text().splitlines():
    if not row.startswith('{"key"'):continue
    tile=json.loads(row.split(',terrain:')[0]+'}')
    i=tile['imageBounds'];level=tile['level'];scale={'world':1,'region':3,'province':6}[level]
    w=round((i['right']-i['left'])*scale);h=round((i['bottom']-i['top'])*scale)
    mask=cairo.ImageSurface(cairo.FORMAT_ARGB32,w,h);c=cairo.Context(mask)
    c.scale(scale,scale);c.translate(-i['left'],-i['top']);c.set_fill_rule(cairo.FILL_RULE_EVEN_ODD)
    for polys,bounds in world if level=='world' else local:
        if overlaps(bounds,i):
            for poly in polys:
                for ring in poly:line(c,ring,True)
    path=c.copy_path()
    for surface in ['terrain','relief']:
        raster=cairo.ImageSurface(cairo.FORMAT_ARGB32,w,h);c=cairo.Context(raster)
        c.scale(scale,scale);c.translate(-i['left'],-i['top']);c.set_fill_rule(cairo.FILL_RULE_EVEN_ODD);c.append_path(path)
        rgb(c,'#31596a');c.set_line_width(1.2 if level=='world' else .65);c.stroke_preserve()
        c.clip();c.append_path(path);rgb(c,'#9d9d6c' if surface=='terrain' else '#ded5b5');c.fill()
        source=Image.open(ROOT/'assets/map/dominion-2.2'/surface/(tile['key']+'.webp')).convert('RGBA')
        buffer=io.BytesIO();source.save(buffer,format='PNG');buffer.seek(0);texture=cairo.ImageSurface.create_from_png(buffer)
        c.save();c.translate(i['left'],i['top']);c.scale(1/scale,1/scale);c.set_source_surface(texture);c.paint();c.restore()
        rank={'world':2,'region':5,'province':10}[level];rgb(c,'#17455c')
        for lake in geography['lakes']:
            if lake['rank']<=rank and overlaps(lake['bounds'],i):vector(c,lake);c.fill()
        rgb(c,'#3d94b4' if surface=='terrain' else '#47788b');c.set_line_width(.85/{'world':1,'region':4,'province':12}[level])
        for river in geography['rivers']:
            if river['rank']<=rank and overlaps(river['bounds'],i):vector(c,river);c.stroke()
        buffer=io.BytesIO();raster.write_to_png(buffer);buffer.seek(0);image=Image.open(buffer)
        dest=OUT/surface/(tile['key']+'.webp');dest.parent.mkdir(parents=True,exist_ok=True);image.save(dest,format='WEBP',quality=90,method=4,exact=True)
        records.append(dict(file=str(dest.relative_to(ROOT)),sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),size=[w,h],bytes=dest.stat().st_size))
    requires.append('"'+tile['key']+'":{terrain:require("../../assets/map/dominion-2.2.1/terrain/'+tile['key']+'.webp"),relief:require("../../assets/map/dominion-2.2.1/relief/'+tile['key']+'.webp")},')
for name,size in [('ocean-balanced',(1440,720)),('ocean-performance',(720,360))]:
    dest=OUT/(name+'.webp');image=Image.open(ROOT/'assets/map/dominion-2.2/water/ocean.webp').resize(size,Image.Resampling.LANCZOS);image.save(dest,format='WEBP',quality=90,method=4)
    records.append(dict(file=str(dest.relative_to(ROOT)),sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),size=list(size),bytes=dest.stat().st_size))
(ROOT/'src/map/atlas221Assets.ts').write_text('// Generated offline: unchanged 2.2 art with precomposed coast/lakes/rivers.\nexport const preparedAtlas:Record<string,{terrain:number;relief:number}>={\n'+'\n'.join(requires)+'\n};\n')
(ROOT/'MAP_HOTFIX_ASSET_MANIFEST.json').write_text(json.dumps(dict(version='2.2.1',generator='scripts/prepare-map221.py',source='unchanged Dominion 2.2 textures and authoritative geometry',assets=records),indent=2)+'\n')
print('Prepared',len(records),'offline atlas assets;',sum(r['bytes'] for r in records),'bytes')
