import hashlib,io,sys,unittest,zipfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from art_package import assert_packaged_art

class PackagedArtTests(unittest.TestCase):
 def entries(self):
  return [dict(path=name,sha256=hashlib.sha256(data).hexdigest()) for name,data in [('first.webp',b'original-one'),('second.webp',b'original-two')]]
 def apk(self,files):
  buffer=io.BytesIO()
  with zipfile.ZipFile(buffer,'w') as apk:
   for path,data in files.items():apk.writestr(path,data)
  return zipfile.ZipFile(buffer)
 def test_resource_renaming_preserves_required_source_bytes(self):
  with self.apk({'res/drawable-mdpi/renamed.webp':b'original-one','assets/42.webp':b'original-two'}) as apk:
   self.assertEqual(assert_packaged_art(apk,self.entries()),2)
 def test_missing_changed_or_unloadable_path_cannot_pass(self):
  for files in [{'assets/42.webp':b'original-two'},{'res/drawable/first.webp':b'changed','assets/42.webp':b'original-two'},{'unused/first.webp':b'original-one','assets/42.webp':b'original-two'}]:
   with self.apk(files) as apk,self.assertRaisesRegex(AssertionError,'Missing or changed packaged painting'):
    assert_packaged_art(apk,self.entries())
