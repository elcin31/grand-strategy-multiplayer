"""Detect a transparent base-map regression in native screenshots.

Markers/labels alone must not count as a successfully rendered political map.
This checks a broad unobstructed map area; detailed geometry is reviewed in PNGs.
"""
from pathlib import Path
from PIL import Image

def map_paint_stats(path: Path):
    image = Image.open(path).convert('RGB')
    w, h = image.size
    crop = image.crop((0, round(h*.23), round(w*.60), round(h*.75)))
    counts = crop.getcolors(crop.width*crop.height)
    land = sum(count for count, rgb in counts if min(rgb) >= 70 and max(rgb)-min(rgb) < 90)
    return {'landFraction': round(land/(crop.width*crop.height), 4), 'samplePixels': crop.width*crop.height}

def assert_map_painted(path: Path):
    result = map_paint_stats(path)
    assert result['landFraction'] >= .08, 'Base map is missing or transparent: '+str(path)+' '+str(result)
    return result
