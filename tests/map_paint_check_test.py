import importlib.util
import tempfile
import unittest
from pathlib import Path
from PIL import Image, ImageDraw

spec = importlib.util.spec_from_file_location('map_paint_check', Path(__file__).parents[1]/'scripts/map_paint_check.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class MapPaintTest(unittest.TestCase):
    def test_water_with_labels_and_markers_does_not_pass_for_a_map(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'water.png'
            image = Image.new('RGB', (1280,720), '#203b48')
            draw = ImageDraw.Draw(image)
            for y in range(180,540,30):
                draw.rectangle((100,y,165,y+8),fill='#dddcca')
            image.save(path)
            with self.assertRaises(AssertionError): module.assert_map_painted(path)

    def test_land_is_checked_without_hud_or_right_panel(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'land.png'
            image = Image.new('RGB',(1280,720),'#203b48')
            ImageDraw.Draw(image).rectangle((150,170,600,540),fill='#8c9bab')
            image.save(path)
            self.assertGreater(module.assert_map_painted(path)['landFraction'],.3)
