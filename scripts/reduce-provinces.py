"""Deterministic v4 land-adjacent, within-country dissolve; run from immutable v3 source.
Keeps every city/island ring. Sea links are contracted, never invented. Retains
source economic weights for heterogeneous resource deposits. Old campaigns use
an explicit dataset boundary instead of silently merging contested territory.
"""
import json,subprocess,math,heapq
from pathlib import Path
from shapely.geometry import Polygon,MultiPolygon
from shapely.ops import unary_union
from shapely import make_valid
root=Path(__file__).resolve().parents[1]
REF='416b0b70374ffc2f9eb84e238213bc389f19782f'
def read(p):return subprocess.check_output(['git','show',REF+':'+p],cwd=root).decode()
def data(p):return json.loads(read(p))
def batches(prefix):
 paths=subprocess.check_output(['git','ls-tree','-r','--name-only',REF,'supabase/functions/_shared/worldData'],cwd=root).decode().splitlines()
 return [r for p in paths if '/'+prefix+'-' in p for r in json.loads(read(p).split(' = ',1)[1].strip().removesuffix(';'))]
def dump(p,v): (root/p).write_text(json.dumps(v,ensure_ascii=False,separators=(',',':'))+'\n')
rows=batches('provinceDefinitions');cities=batches('cityDefinitions');countries=data('src/world/data/countries.json');caps=data('src/world/data/capitals.json');geo=data('src/world/data/geometry.json')
by={p['id']:p for p in rows};groups={p['id']:[p['id']] for p in rows};parent={p['id']:p['id'] for p in rows}
shapes={g['id']:unary_union([make_valid(Polygon(r[0],r[1:])) for r in g['polygons']]) for g in geo}
capital={c['provinceId'] for c in caps};cityweight={p['id']:sum(c['population'] for c in cities if c['provinceId']==p['id']) for p in rows}
# Prioritize compact, small unions; keep national borders and capital/major-city anchors.
def find(a):
 while parent[a]!=a:a=parent[a]
 return a
edges=[]
for p in rows:
 for n in p['neighbors']:
  if n<=p['id'] or by[n]['countryId']!=p['countryId']:continue
  shared=shapes[p['id']].boundary.intersection(shapes[n].boundary).length
  if shared<=1e-7:continue # do not merge across sea, even if graph has a crossing
  score=(shapes[p['id']].area+shapes[n].area)/(shared*shared)+abs(p['development']-by[n]['development'])/20
  heapq.heappush(edges,(score,p['id'],n))
target=round(len(rows)/1.5)
while len(groups)>target and edges:
 _,a,b=heapq.heappop(edges);a,b=find(a),find(b)
 if a==b or len(groups[a])+len(groups[b])>4:continue
 if not any(find(n) not in (a,b) for i in groups[a]+groups[b] for n in by[i]['neighbors']):continue
 if any(i in capital for i in groups[a]) and any(i in capital for i in groups[b]):continue
 # Avoid combining two high-population city centers; their surrounding hinterland may merge.
 if cityweight[a]>1500000 and cityweight[b]>1500000:continue
 if (a in capital,cityweight[a],by[a]['population'],a)<(b in capital,cityweight[b],by[b]['population'],b):a,b=b,a
 groups[a]+=groups.pop(b);parent[b]=a;cityweight[a]+=cityweight[b]
assert len(groups)<=target*1.04,(len(groups),target)
mapping={old:find(old) for old in by};newrows=[];newgeo=[]
for pid,members in sorted(groups.items()):
 ps=[by[i] for i in members];v=dict(by[pid]);pop=sum(p['population'] for p in ps);v['population']=pop;v['income']=sum(p['income'] for p in ps)
 v['development']=round(sum(p['development']*max(1,p['population']) for p in ps)/sum(max(1,p['population']) for p in ps),3)
 v['cityIds']=sorted(c for p in ps for c in p['cityIds']);v['neighbors']=sorted({mapping[n] for p in ps for n in p['neighbors']}-{pid})
 if len(ps)>1:v['sourceRegions']=[{'id':p['id'],'income':p['income'],'development':p['development'],'population':p['population']} for p in ps]
 shape=unary_union([shapes[i] for i in members]);assert shape.is_valid
 polygons=[shape] if shape.geom_type=='Polygon' else list(shape.geoms)
 rings=[[[list(q) for q in g.exterior.coords],*[[list(q) for q in h.coords] for h in g.interiors]] for g in polygons]
 bounds=shape.bounds;v['width']=bounds[2]-bounds[0];v['height']=bounds[3]-bounds[1]
 newrows.append(v);newgeo.append({'id':pid,'anchor':[v['x'],v['y']],'polygons':rings})
for c in cities:c['provinceId']=mapping[c['provinceId']]
for c in caps:c['provinceId']=mapping[c['provinceId']]
for c in countries:c['provinceIds']=sorted({mapping[i] for i in c['provinceIds']})
# Exhaustive reference and conservation checks.
ids={p['id'] for p in newrows};newby={p['id']:p for p in newrows}
for p in newrows:
 assert p['id'] not in p['neighbors'] and all(n in ids and p['id'] in newby[n]['neighbors'] for n in p['neighbors'])
 assert p['neighbors'] or not by[p['id']]['neighbors']
for c in countries:
 assert sum(p['population'] for p in rows if p['countryId']==c['id'])==sum(newby[i]['population'] for i in c['provinceIds'])
for c in cities:assert c['provinceId'] in ids
assert len(cities)==7214 and len(countries)==195
header=read('supabase/functions/_shared/worldDefinitions.ts').split('import { data as',1)[0].replace('export interface ProvinceDefinition {','export interface ProvinceDefinition { sourceRegions?: {id:string;income:number;development:number;population:number}[];')
worlddir=root/'supabase/functions/_shared/worldData'
for p in worlddir.glob('*.ts'):p.unlink()
imports=[];exports=[]
minimal=[{k:c[k] for k in ['id','name','shortName','color','adjective','flag','capitalCityId','provinceIds','populationEstimate','region']} for c in countries]
for name,kind,values,size in [('countryDefinitions','CountryDefinition',minimal,100),('provinceDefinitions','ProvinceDefinition',newrows,100),('cityDefinitions','CityDefinition',cities,200)]:
 names=[]
 for i in range(0,len(values),size):
  filename=f'{name}-{i//size:02d}.ts';batch=name+'Batch'+str(i//size);names.append('...'+batch)
  (worlddir/filename).write_text(f'import type {{ {kind} }} from "../worldDefinitions.ts";\nexport const data: {kind}[] = '+json.dumps(values[i:i+size],ensure_ascii=False,separators=(',',':'))+';\n')
  imports.append(f'import {{data as {batch}}} from "./worldData/{filename}";')
 exports.append(f'export const {name}: readonly {kind}[] = ['+','.join(names)+'];')
(root/'supabase/functions/_shared/worldDefinitions.ts').write_text(header+'\n'.join(imports+exports)+'\n')
for name,value in [('geometry',newgeo),('countries',countries),('capitals',caps)]:dump('src/world/data/'+name+'.json',value)
dump('src/world/data/province-v4-mapping.json',mapping)
dump('PROVINCE_REDUCTION_PASS3.json',{'source':REF,'before':len(rows),'after':len(newrows),'reductionPercent':100*(1-len(newrows)/len(rows)),'cities':len(cities),'countries':len(countries),'populationBefore':sum(p['population'] for p in rows),'populationAfter':sum(p['population'] for p in newrows),'geometryBytesBefore':len(read('src/world/data/geometry.json').encode()),'geometryBytesAfter':(root/'src/world/data/geometry.json').stat().st_size,'method':'land-edge adjacent country-local unions, max four source regions, protected capitals and major-city pairs','saveCompatibility':'modern-world-v2; v1 campaigns rejected explicitly, never silently merged'})
print(len(rows),'->',len(newrows),'provinces;',len(cities),'cities retained')
