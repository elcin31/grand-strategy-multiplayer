"""Import invariants on a small independent fixture, without network downloads."""
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

@unittest.skipUnless(importlib.util.find_spec('shapely'), 'Install scripts/world-requirements.txt for import tests')
class WorldImportTests(unittest.TestCase):
    def test_reproducible_catalogue_has_capitals_and_symmetric_land_neighbors(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            def write(name, value):
                path = root / name
                path.write_text(json.dumps(value))
                return path
            def square(left, right):
                return {'type':'Polygon','coordinates':[[[left,0],[right,0],[right,1],[left,1],[left,0]]]}
            countries = []
            for code in ['NRU','SDS']:
                countries.append({'properties':{'ADM0_A3':code,'ISO_A2_EH':code[:2], 'NAME_RU':code, 'NAME_EN':code, 'NAME':code, 'POP_EST':10000,'POP_YEAR':2019,'REGION_UN':'Test','SUBREGION':'Test'},'geometry':square(0,1)})
            provinces = []
            for i, (code, name) in enumerate([('NRU','Yaren'),('NRU','Other district'),('SDS','Juba district')]):
                provinces.append({'properties':{'adm0_a3':code,'adm1_code':f'{code}-{i}','name':name},'geometry':square(i,i+1)})
            city = {'properties':{'adm0_a3':'SSD','ne_id':'juba','name':'Juba','latitude':0.5,'longitude':2.5,'pop_max':1500,'adm0cap':0,'featurecla':'Populated place'}}
            paths = [write('countries.geojson', {'features':countries}), write('provinces.geojson',{'features':provinces}), write('cities.geojson',{'features':[city]}), write('roster.json',{'codes':['NRU','SDS']})]
            output = root / 'generated'
            command = [sys.executable, str(Path(__file__).resolve().parents[1] / 'scripts/import-world.py')]
            for flag,path in zip(['--countries','--provinces','--cities','--roster'],paths): command.extend([flag,str(path)])
            command.extend(['--output',str(output)])
            subprocess.run(command,check=True,capture_output=True)
            first = {p.name:p.read_bytes() for p in output.iterdir()}
            subprocess.run(command,check=True,capture_output=True)
            self.assertEqual(first,{p.name:p.read_bytes() for p in output.iterdir()})
            generated = json.loads((output/'countries.json').read_text())
            self.assertEqual(len(generated),2)
            cities = json.loads((output/'cities.json').read_text())
            self.assertEqual({c['countryId'] for c in cities if c['isCapital']},{'nru','sds'})
            provinces = json.loads((output/'provinces.json').read_text())
            by_id = {p['id']:p for p in provinces}
            self.assertEqual(sum(len(p['neighbors']) for p in provinces),4)
            for province in provinces:
                for neighbor in province['neighbors']: self.assertIn(province['id'],by_id[neighbor]['neighbors'])
            self.assertEqual(next(c for c in cities if c['name']=='Juba')['provinceId'],'sds-2')
