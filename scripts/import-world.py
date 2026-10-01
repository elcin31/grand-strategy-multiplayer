"""Generate a deterministic, attributed world catalogue from Natural Earth.

All political boundaries are source data, not an assertion about disputed status.
Population values retain their source year; gameplay allocation is an estimate.
Requires shapely 2.1.2. No game source/assets, online AI, or backend credentials.
"""
import argparse
import hashlib
import json
from collections import defaultdict
from pathlib import Path
from shapely import make_valid, coverage_is_valid, coverage_simplify
from shapely.geometry import shape, Point, Polygon, MultiPolygon
from shapely.strtree import STRtree

parser = argparse.ArgumentParser()
parser.add_argument('--countries', type=Path, required=True)
parser.add_argument('--provinces', type=Path, required=True)
parser.add_argument('--cities', type=Path, required=True)
parser.add_argument('--roster', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
load = lambda path: json.loads(path.read_text())
codes = set(load(args.roster)['codes'])
raw_countries = [f for f in load(args.countries)['features'] if f['properties']['ADM0_A3'] in codes]
assert len(raw_countries) == len(codes), 'Every roster country must occur exactly once'
aliases = {'DEU':'germany','FRA':'france','ITA':'italy','POL':'poland','ESP':'spain','GBR':'uk','TUR':'turkey','RUS':'russia'}
ids = {code: aliases.get(code, code.lower()) for code in codes}
city_codes = {'SSD': 'SDS'}
province_rows = sorted([f for f in load(args.provinces)['features'] if f['properties']['adm0_a3'] in codes], key=lambda f: f['properties']['adm1_code'])
geoms = [make_valid(shape(f['geometry'])) for f in province_rows]
assert all(isinstance(g,(Polygon,MultiPolygon)) and g.is_valid and not g.is_empty for g in geoms)
assert coverage_is_valid(geoms), 'Do not independently simplify overlapping coverage'
# Preserve shared boundaries; tiny states and islands are retained.
render_geoms = coverage_simplify(geoms,0.06)
assert all(g.is_valid and not g.is_empty for g in render_geoms)
tree = STRtree(geoms)
country_indices = defaultdict(list)
provinces = []
def project(lon,lat): return [round((lon+180)*4,4), round((90-lat)*4,4)]
def polygons(g):
    parts = [g] if isinstance(g,Polygon) else list(g.geoms)
    return [[ [project(*p) for p in part.exterior.coords], *[[project(*p) for p in hole.coords] for hole in part.interiors]] for part in parts]
for i,(row,g) in enumerate(zip(province_rows,geoms)):
    p=row['properties']; cid=ids[p['adm0_a3']]; country_indices[p['adm0_a3']].append(i)
    land = render_geoms[i]
    parts=[land] if isinstance(land,Polygon) else list(land.geoms)
    anchor=max(parts,key=lambda x:x.area).representative_point()
    neighbors=[]
    for other in tree.query(g):
        j=int(other)
        if i!=j and g.boundary.intersection(geoms[j].boundary).length > 1e-6:
            neighbors.append(province_rows[j]['properties']['adm1_code'].lower())
    provinces.append({'id':p['adm1_code'].lower(),'name':p.get('name_ru') or p.get('name_en') or p.get('name') or p['adm1_code'], 'countryId':cid,'neighbors':sorted(neighbors),'anchor':project(anchor.x,anchor.y),'polygons':polygons(land),'cityIds':[]})
assert len({p['id'] for p in provinces})==len(provinces)
by_id={p['id']:p for p in provinces}
assert all(p['id'] in by_id[n]['neighbors'] for p in provinces for n in p['neighbors'])
raw_cities=[]
for f in load(args.cities)['features']:
    p=f['properties'];code=city_codes.get(p['adm0_a3'],p['adm0_a3'])
    if code in codes:raw_cities.append((code,p))
# Source has no populated-place point for Nauru: use the mapped government district.
yaren=next((i for i in country_indices['NRU'] if province_rows[i]['properties']['name']=='Yaren'),None)
assert yaren is not None
yp=geoms[yaren].representative_point()
raw_cities.append(('NRU',{'name':'Yaren','ne_id':'government-seat-yaren','longitude':yp.x,'latitude':yp.y,'pop_max':0,'adm0cap':0,'featurecla':'Government seat'}))
# Explicit seat choices; keep alternate capitals as cities, not lost records.
capital_names={'BOL':'Sucre','ZAF':'Pretoria','CIV':'Yamoussoukro','PSX':'Ramallah','SDS':'Juba','NRU':'Yaren'}
capitals={}
for code in codes:
    candidates=[p for c,p in raw_cities if c==code and (p['name']==capital_names[code] if code in capital_names else p['adm0cap']==1)]
    assert len(candidates)==1,(code,[p['name'] for p in candidates])
    capitals[code]=str(candidates[0]['ne_id'])
cities=[];snap_distances=[]
for code,p in sorted(raw_cities,key=lambda pair: str(pair[1]['ne_id'])):
    point=Point(p['longitude'],p['latitude'])
    candidates=[int(j) for j in tree.query(point) if int(j) in country_indices[code] and geoms[int(j)].covers(point)]
    i=min(candidates) if candidates else min(country_indices[code],key=lambda j:(geoms[j].distance(point),provinces[j]['id']))
    distance=geoms[i].distance(point)
    if distance>0.1:snap_distances.append({'name':p['name'],'countryId':ids[code],'distanceDegrees':round(distance,4)})
    city={'id':'city-'+str(p['ne_id']),'name':p['name'],'countryId':ids[code],'provinceId':provinces[i]['id'],'point':project(point.x,point.y),'populationEstimate':max(0,int(p['pop_max'])),'isCapital':str(p['ne_id'])==capitals[code],'isRegionalCapital':'Admin-1 capital' in p.get('featurecla',''),'capitalRole':'government-seat' if code in {'PSX','NRU'} and str(p['ne_id'])==capitals[code] else 'capital' if str(p['ne_id'])==capitals[code] else None}
    provinces[i]['cityIds'].append(city['id']);cities.append(city)
assert len({c['id'] for c in cities})==len(cities)
countries=[]
for f in sorted(raw_countries,key=lambda f:ids[f['properties']['ADM0_A3']]):
    p=f['properties'];code=p['ADM0_A3'];indices=country_indices[code]
    countries.append({'id':ids[code],'sourceCode':code,'iso2':p['ISO_A2_EH'].lower(),'name':p['NAME_RU'] or p['NAME'],'englishName':p['NAME_EN'],'shortName':p['ADM0_A3'],'capitalCityId':'city-'+capitals[code],'populationEstimate':int(p['POP_EST']),'populationYear':int(p['POP_YEAR']),'region':p['REGION_UN'],'subregion':p['SUBREGION'],'provinceIds':[provinces[i]['id'] for i in indices]})
assert all(c['provinceIds'] and any(city['id']==c['capitalCityId'] and city['countryId']==c['id'] for city in cities) for c in countries)
metadata={'version':1,'recognitionPolicy':'UN member states plus Holy See and Palestine; explicit roster, extensible identifiers','licence':'Natural Earth public domain','sourcePopulationWarning':'Historical source estimates, not contemporary 2026 census data','capitalExceptions':capital_names,'countryCount':len(countries),'provinceCount':len(provinces),'cityCount':len(cities),'distantCityAssignments':snap_distances,'sources':[{ 'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()} for path in [args.countries,args.provinces,args.cities]],'sourceRepository':'https://github.com/nvkelso/natural-earth-vector','licenseURL':'https://www.naturalearthdata.com/about/terms-of-use/','geometrySimplificationDegrees':0.06}
for name,data in [('countries',countries),('provinces',provinces),('cities',cities),('metadata',metadata)]:
    (args.output/(name+'.json')).write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
print(json.dumps({k:metadata[k] for k in ['countryCount','provinceCount','cityCount']}));print('Distant city assignments requiring audit:',len(snap_distances))
