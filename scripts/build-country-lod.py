"""Dissolve internal province seams for the render-only world LOD.
No campaign identifiers, islands, cities, resources or authoritative topology change.
"""
import json
from pathlib import Path
from shapely.geometry import Polygon, MultiPolygon
from shapely.ops import unary_union
from shapely import make_valid
root=Path(__file__).resolve().parents[1]
geometry={g['id']:g for g in json.loads((root/'src/world/data/geometry.json').read_text())}
countries=json.loads((root/'src/world/data/countries.json').read_text())
result=[]
for c in countries:
    parts=[]
    for pid in c['provinceIds']:
        for rings in geometry[pid]['polygons']:
            p=make_valid(Polygon(rings[0],rings[1:]))
            if p.geom_type=='Polygon':parts.append(p)
            else:parts.extend(g for g in p.geoms if g.geom_type=='Polygon')
    merged=unary_union(parts)
    assert merged.is_valid and not merged.is_empty
    # No lossy topology simplification here: preserve every island and coastline.
    polygons=[merged] if merged.geom_type=='Polygon' else list(merged.geoms)
    rings=[[[list(p) for p in g.exterior.coords],*[[list(p) for p in h.coords] for h in g.interiors]] for g in polygons]
    rep=max(polygons,key=lambda g:g.area).representative_point()
    result.append({'id':'render-country-'+c['id'],'countryId':c['id'],'provinceId':c['provinceIds'][0],'anchor':[rep.x,rep.y],'polygons':rings})
(root/'src/world/data/country-lod.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
print('Country LOD:',len(result),'features;',sum(len(r) for c in result for p in c['polygons'] for r in p),'vertices')
