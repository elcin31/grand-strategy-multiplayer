"""Offline Dominion atlas. pip install -r scripts/map22-requirements.txt

python scripts/prepare-map22.py --source /path/to/source-cache
Downloads public-domain Natural Earth once; keeps originals OUTSIDE the repo.
No AI geography, game state mutation, or runtime terrain generation.
"""
import argparse
import hashlib
import json
import urllib.request
from pathlib import Path
from zipfile import ZipFile
import numpy as np
from scipy.ndimage import distance_transform_edt, gaussian_filter
from PIL import Image
from shapely.geometry import shape, mapping

Image.MAX_IMAGE_PIXELS = 300_000_000
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets/map/dominion-2.2'
parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, required=True)
args = parser.parse_args()
args.source.mkdir(parents=True, exist_ok=True)
SOURCES = [
    ('NE1_HR_LC_SR_W.zip', 'https://naciscdn.org/naturalearth/10m/raster/NE1_HR_LC_SR_W.zip'),
    ('ne_10m_rivers_lake_centerlines.geojson', 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson'),
    ('ne_10m_lakes.geojson', 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_lakes.geojson'),
    ('ETOPO_2022_v1_60s_N90W180_surface.tif','https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2022/data/60s/60s_surface_elev_gtif/ETOPO_2022_v1_60s_N90W180_surface.tif'),
]
for name, url in SOURCES:
    if not (args.source / name).exists(): urllib.request.urlretrieve(url, args.source / name)
if not (args.source / 'NE1_HR_LC_SR_W.tif').exists():
    with ZipFile(args.source / SOURCES[0][0]) as z:
        for n in z.namelist():
            if n.endswith(('.tif', '.tfw', '.prj', '.html', '.txt')): z.extract(n, args.source)
tfw = [float(v) for v in (args.source / 'NE1_HR_LC_SR_W.tfw').read_text().split()]
assert len(tfw)==6 and abs(tfw[0]-1/60)<1e-9 and abs(tfw[3]+1/60)<1e-9
assert abs(tfw[4]-(-180+1/120))<1e-9 and abs(tfw[5]-(90-1/120))<1e-9
source = Image.open(args.source / 'NE1_HR_LC_SR_W.tif')
assert source.size == (21600, 10800)
elevation=Image.open(args.source / SOURCES[3][0])
assert elevation.size==(21600,10800) and elevation.tag_v2[33922][3:5]==(-180.,90.)
assert elevation.tag_v2[33550][:2]==(1/60,1/60)
tiles, records = [], []
for level, scale, cell in [('world', 1, 1440), ('region', 3, 240), ('province', 6, 120)]:
    base = source.resize((1440 * scale, 720 * scale), Image.Resampling.LANCZOS)
    heights = elevation.resize(base.size,Image.Resampling.BILINEAR)
    for y in range(0, 720, cell):
        for x in range(0, 1440, cell):
            right, bottom = min(x+cell,1440), min(y+cell,720)
            # 2-pixel gutters sample the same continuous source across neighbours.
            box = (max(0,x*scale-2),max(0,y*scale-2),min(base.width,right*scale+2),min(base.height,bottom*scale+2))
            rgb = np.asarray(base.crop(box)).astype(np.float32)
            ocean = (rgb[:,:,2] > rgb[:,:,0] * 1.08) & (rgb[:,:,2] > rgb[:,:,1] * 1.025)
            if np.any(~ocean):
                _, nearest = distance_transform_edt(ocean, return_indices=True)
                land = rgb[nearest[0],nearest[1]]
            else: land = np.full_like(rgb, [174,173,125])
            lum = land @ np.array([.299,.587,.114],dtype=np.float32)
            detail = lum - gaussian_filter(lum, sigma=max(1,scale*.75))
            # Natural Earth colours encode landcover and geographic relief.
            # Increase the source contrast; no random mountain/forest placements.
            tint = np.clip((land-105)*1.28, 18, 245)
            tint[:,:,1] += 9
            height=np.asarray(heights.crop(box))
            if np.any(~ocean):height=height[nearest[0],nearest[1]]
            latitude=90-(np.arange(box[1],box[3])/scale)/4
            # Elevation and hillshade use real ETOPO samples, prepared offline.
            dy,dx=np.gradient(height)
            metres=111320/(4*scale)
            dx=dx/np.maximum(.2,np.cos(np.deg2rad(latitude)))[:,None]/metres*2.2
            dy=dy/metres*2.2
            shade=np.clip((.72-dx*.5+dy*.5)/np.sqrt(1+dx*dx+dy*dy),.18,1.15)
            rock=np.clip((height-950)/2200,0,.85)
            tint=tint*(1-rock[:,:,None])+np.array([173,155,127])*(rock[:,:,None])
            snowline=np.maximum(1700,4600-np.abs(latitude)*42)[:,None]
            snow=np.clip((height-snowline)/650,0,.93)
            tint=tint*(1-snow[:,:,None])+np.array([232,234,227])*snow[:,:,None]
            tint=tint*(.72+shade[:,:,None]*.38)+detail[:,:,None]*.85
            terrain = Image.fromarray(np.clip(tint,0,255).astype('uint8'))
            relief = np.clip(225 + (shade-.72)*95 + detail*1.4, 96, 248).astype('uint8')
            relief = Image.merge('RGB', (Image.fromarray(relief),)*3)
            entry = dict(key=f'{level}-{x}-{y}',level=level,bounds=dict(left=x,top=y,right=right,bottom=bottom),imageBounds=dict(left=box[0]/scale,top=box[1]/scale,right=box[2]/scale,bottom=box[3]/scale))
            for kind, im in [('terrain', terrain), ('relief', relief)]:
                path = OUT / kind / f'{level}-{x}-{y}.webp'
                path.parent.mkdir(parents=True,exist_ok=True)
                im.save(path,format='WEBP',quality=85 if level=='province' else 83,method=6)
                entry[kind] = str(path.relative_to(ROOT))
                records.append(dict(file=entry[kind],bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),size=im.size))
            tiles.append(entry)
    print('Prepared',level,flush=True)
# Bathymetric shading from the same raster. Coast geometry is applied at runtime.
water = np.asarray(source.resize((2880,1440),Image.Resampling.LANCZOS)).astype(np.float32)
ocean = (water[:,:,2]>water[:,:,0]*1.08)&(water[:,:,2]>water[:,:,1]*1.025)
luma=water@np.array([.299,.587,.114],dtype=np.float32)
sea_height=np.asarray(elevation.resize((2880,1440),Image.Resampling.BILINEAR))
depth=np.clip((-sea_height-80)/7000,0,1)
sea=np.stack([16-depth*9,49-depth*24,65-depth*26],axis=2)
sea[~ocean]=[13,39,53]
path=OUT/'water/ocean.webp';path.parent.mkdir(parents=True,exist_ok=True)
Image.fromarray(sea.astype('uint8')).save(path,quality=82,method=6)
records.append(dict(file=str(path.relative_to(ROOT)),bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),size=[2880,1440]))

def project(coords):
    if isinstance(coords[0],(float,int)):return [round((coords[0]+180)*4,3),round((90-coords[1])*4,3)]
    return [project(c) for c in coords]
vectors={}
for kind,file in [('rivers',SOURCES[1][0]),('lakes',SOURCES[2][0])]:
    rows=[]
    for i,f in enumerate(json.loads((args.source/file).read_text())['features']):
        p=f['properties'];rank=int(p.get('scalerank') or 1)
        g=shape(f['geometry']).simplify(.015,preserve_topology=True)
        if g.is_empty:continue
        geo=mapping(g);coords=project(geo['coordinates'])
        left,latmin,right,latmax=g.bounds
        rows.append(dict(id=f'{kind}-{i}',name=p.get('name_ru') or p.get('name') or '',rank=rank,type=geo['type'],coordinates=coords,bounds=dict(left=(left+180)*4,top=(90-latmax)*4,right=(right+180)*4,bottom=(90-latmin)*4)))
    vectors[kind]=rows
(ROOT/'src/map/geography22.json').write_text(json.dumps(vectors,ensure_ascii=False,separators=(',',':'))+'\n')
module=['// Generated by scripts/prepare-map22.py. Literal requires bundle every offline tile.', "import type {AtlasTile} from './atlas22';", 'export const atlasTiles:AtlasTile[] = [']
for t in tiles:
    data={k:v for k,v in t.items() if k not in ('terrain','relief')}
    text=json.dumps(data,separators=(',',':'))[:-1]
    text+=f',terrain:require("../../{t["terrain"]}"),relief:require("../../{t["relief"]}")}}'
    module.append(text+',')
module.append('];')
(ROOT/'src/map/atlas22Assets.ts').write_text('\n'.join(module)+'\n')
manifest=dict(version='2.2',projection=dict(name='Equirectangular',epsg=4326,worldSize=[1440,720],formula='x=(lon+180)*4; y=(90-lat)*4'),sources=[dict(file=n,url=u,sha256=hashlib.sha256((args.source/n).read_bytes()).hexdigest(),license='Public domain',licenseURL='https://doi.org/10.25921/fd45-gt74' if n==SOURCES[3][0] else 'https://www.naturalearthdata.com/about/terms-of-use/',attribution='NOAA National Centers for Environmental Information, ETOPO 2022, doi:10.25921/fd45-gt74' if n==SOURCES[3][0] else 'Natural Earth' ) for n,u in SOURCES],generator='scripts/prepare-map22.py',levels=[dict(name='world',pixelsPerWorldUnit=1),dict(name='region',pixelsPerWorldUnit=3),dict(name='province',pixelsPerWorldUnit=6)],assets=records,vectors={k:len(v) for k,v in vectors.items()},limitations=['NOAA ETOPO 60 arc-second elevations and Natural Earth landcover are visual layers; province terrain remains the combat model.','Snow tint is a stylized elevation/latitude snowline, not live weather.','Landcover represents the source atlas, not historical biome reconstruction.','Coast pixels are extended to the authoritative game geometry; rivers/lakes are clipped by its land mask.','Building/resource symbols are provincial indicators, not surveyed locations.','Accepted trade contracts have no geographic transport path; links between real capitals are schematic.'])
(ROOT/'MAP_ASSET_MANIFEST.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
print('Assets',len(records),'bytes',sum(r['bytes'] for r in records),'vectors',manifest['vectors'])
