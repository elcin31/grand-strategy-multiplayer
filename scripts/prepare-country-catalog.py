"""Build the immutable country catalogue and flags from audited world-import output.

Usage: python scripts/prepare-country-catalog.py --world-dir /tmp/world \
  --flags-dir /tmp/flag-icons/package --output src/world/data
flag-icons 7.5.0 is MIT licensed; Natural Earth is public domain.
Adjectives and the color assignment are project-authored. No game assets are used.
"""
import argparse
import hashlib
import json
from pathlib import Path
parser=argparse.ArgumentParser()
parser.add_argument('--world-dir',type=Path,required=True)
parser.add_argument('--flags-dir',type=Path,required=True)
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
read=lambda path:json.loads(path.read_text())
countries=read(args.world_dir/'countries.json');provinces=read(args.world_dir/'provinces.json');cities=read(args.world_dir/'cities.json')
adjective_path=Path(__file__).with_name('country-adjectives.json');adjectives=read(adjective_path)
country_ids={c['id'] for c in countries};neighbors={cid:set() for cid in country_ids};province_by_id={p['id']:p for p in provinces}
for p in provinces:
    for neighbor in p['neighbors']:
        other=province_by_id[neighbor]['countryId']
        if other!=p['countryId']:neighbors[p['countryId']].add(other)
palette=['#5d7988','#ac6864','#6c896d','#a69262','#7f7099','#6a9394','#b48063','#857c65','#7f96af','#a1818c','#91a36e','#bd9d79','#638270','#92788c','#b59554','#6f779b']
colors={'germany':'#586E75','france':'#355C9A','italy':'#4F7C64','poland':'#A95D67','spain':'#B38B49','uk':'#574E8C','turkey':'#A34A4A','russia':'#486A7A'}
def rgb(color):return tuple(int(color[i:i+2],16) for i in [1,3,5])
def distance(a,b):return sum((x-y)**2 for x,y in zip(rgb(a),rgb(b)))
for cid in sorted(country_ids-colors.keys(),key=lambda cid:(-len(neighbors[cid]),cid)):
    used=[colors[n] for n in neighbors[cid] if n in colors]
    offset=int(hashlib.sha256(cid.encode()).hexdigest()[:4],16)%len(palette)
    candidates=palette[offset:]+palette[:offset]
    colors[cid]=max(candidates,key=lambda color:min([distance(color,n) for n in used],default=1000000))
    assert colors[cid] not in used
for c in countries:
    c['adjective']=adjectives[c['iso2']];c['color']=colors[c['id']];c['flag']=c['iso2'];c['neighbors']=sorted(neighbors[c['id']])
capital_ids={c['capitalCityId'] for c in countries};capitals=[c for c in cities if c['id'] in capital_ids]
flags={c['iso2']:(args.flags_dir/'flags/4x3'/(c['iso2']+'.svg')).read_text() for c in countries}
license=(args.flags_dir/'LICENSE').read_text()
metadata={'worldImport':read(args.world_dir/'metadata.json'),'flags':{'name':'flag-icons','version':'7.5.0','license':'MIT','url':'https://github.com/lipis/flag-icons','licenseText':license},'adjectives':'Project-authored lexical forms','colorAssignment':'Project-authored deterministic neighbor-aware palette','inputHashes':{name:hashlib.sha256((args.world_dir/(name+'.json')).read_bytes()).hexdigest() for name in ['countries','provinces','cities']}}
for name,data in [('countries',countries),('capitals',capitals),('flags',flags),('source',metadata)]:
    (args.output/(name+'.json')).write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
(args.output/'flag-icons-LICENSE.txt').write_text(license)
print('Country definitions',len(countries),'capitals',len(capitals),'flag vectors',len(flags))
