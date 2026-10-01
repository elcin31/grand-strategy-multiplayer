"""Reproducible public-domain geography import. No game assets are used.

Usage: python scripts/import-map.py /path/ne_110m_admin_0_countries.geojson
Requires shapely. Source SHA256 is recorded alongside generated data.
The 12 scenario provinces remain compatible with existing server campaigns.
World playable-state migration is a separate phase, not a renderer concern.
"""
import hashlib
import json
import sys
from pathlib import Path
from shapely.geometry import shape, box, Polygon, MultiPolygon

source = Path(sys.argv[1])
features = json.loads(source.read_text())["features"]
active = {"DEU": "germany", "FRA": "france", "ITA": "italy", "POL": "poland", "ESP": "spain", "GBR": "uk", "TUR": "turkey", "RUS": "russia"}
splits = {
    "germany": [("de-1", box(-180, -90, 10.5, 90)), ("de-2", box(10.5, -90, 180, 90))],
    "france": [("fr-1", box(-180, 46, 180, 90)), ("fr-2", box(-180, -90, 180, 46))],
    "italy": [("it-1", box(-180, 41.5, 180, 90)), ("it-2", box(-180, -90, 180, 41.5))],
    "russia": [("ru-1", box(-180, -90, 60, 90)), ("ru-2", box(60, -90, 180, 90))],
}
single = {"poland": "pl-1", "spain": "es-1", "uk": "uk-1", "turkey": "tr-1"}
result = []
def encode(geom, fid, name, country_id=None, province_id=None):
    if geom.is_empty: return
    polygons = [geom] if isinstance(geom, Polygon) else list(geom.geoms)
    polygons = [p for p in polygons if isinstance(p, Polygon)]
    if not polygons: return
    def ring(coords): return [{"x": round((lon + 180) * 4, 3), "y": round((90 - lat) * 4, 3)} for lon, lat in coords]
    rings = [[ring(p.exterior.coords), *[ring(i.coords) for i in p.interiors]] for p in polygons]
    points = [pt for polygon in rings for r in polygon for pt in r]
    largest = max(polygons, key=lambda p: p.area)
    anchor = largest.representative_point()
    result.append({"id": fid, "name": name, "countryId": country_id, "provinceId": province_id, "polygons": rings,
      "bounds": {"left": min(p["x"] for p in points), "right": max(p["x"] for p in points), "top": min(p["y"] for p in points), "bottom": max(p["y"] for p in points)},
      "anchor": {"x": round((anchor.x + 180) * 4, 3), "y": round((90 - anchor.y) * 4, 3)}})
for f in features:
    props = f["properties"]
    code = props["ADM0_A3"]
    geom = shape(f["geometry"])
    # France's overseas polygons stay as neutral context for the legacy European scenario.
    nation = active.get(code)
    if nation == "france": geom = geom.intersection(box(-6, 40, 10, 52))
    if nation in splits:
        for pid, clip in splits[nation]: encode(geom.intersection(clip), pid, props["NAME"], nation, pid)
    elif nation: encode(geom, single[nation], props["NAME"], nation, single[nation])
    else: encode(geom, code, props["NAME"])
target = Path(__file__).resolve().parents[1] / "src/map/geography.json"
target.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
(target.parent / "source.json").write_text(json.dumps({"source": "Natural Earth 110m admin_0_countries", "license": "Public domain", "url": "https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson", "sha256": hashlib.sha256(source.read_bytes()).hexdigest(), "featureCount": len(result)}, indent=2) + "\n")
print(f"Wrote {len(result)} geographic features; source SHA256 recorded")
