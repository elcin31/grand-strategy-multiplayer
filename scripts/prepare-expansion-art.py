"""Downscale commissioned originals without altering their composition.

Input JSON rows contain id/category/prompt/path. Generated source PNGs remain
untouched. Only these new expansion derivatives/manifest rows are updated;
the inherited15 accepted assets are never recompressed or replaced.
"""
from pathlib import Path
import argparse,hashlib,json
from PIL import Image

def prepare(inputs,quality=76):
 root=Path(__file__).resolve().parents[1]
 output=root/'assets/art/expansion';output.mkdir(exist_ok=True)
 manifest=json.loads((root/'assets/art/manifest.json').read_text())
 prompt_path=root/'assets/art/expansion-prompts.json'
 prompts=json.loads(prompt_path.read_text()) if prompt_path.exists() else []
 seen=set()
 for row in inputs:
  identifier=row['id'];assert identifier not in seen and identifier.replace('-','').isalnum();seen.add(identifier)
  source=Path(row['path']);original=source.read_bytes();digest=hashlib.sha256(original).hexdigest()
  existing=next((e for e in manifest if e.get('subjectId')==identifier),None)
  assert existing is None or existing['sourceSha256']==digest,'Refuse replacing an approved source'
  width,height=(960,540) if identifier=='theme-loading' else (640,360)
  with Image.open(source) as image:
   source_size=image.size
   assert image.format=='PNG' and not getattr(image,'is_animated',False)
   image.resize((width,height),Image.Resampling.LANCZOS).save(output/(identifier+'.webp'),format='WEBP',quality=quality,method=6)
  target=output/(identifier+'.webp');data=target.read_bytes()
  entry={'path':str(target.relative_to(root)),'width':width,'height':height,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'source':'Original OpenAI built-in ImageGen artwork commissioned for Dominion Expansion2.0 on 2026-10-10','category':row['category'],'subjectId':identifier,'sourceSha256':digest,'sourceWidth':source_size[0],'sourceHeight':source_size[1]}
  manifest=[e for e in manifest if e.get('subjectId')!=identifier]+[entry]
  prompts=[p for p in prompts if p['id']!=identifier]+[{'id':identifier,'category':row['category'],'prompt':row['prompt'],'sourceFile':source.name,'sourceSha256':digest}]
  print(identifier,len(data))
 (root/'assets/art/manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 prompt_path.write_text(json.dumps(prompts,indent=2)+'\n')
 print('Total packaged art bytes',sum(e['bytes'] for e in manifest))

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('inputs');parser.add_argument('--quality',type=int,default=76);args=parser.parse_args()
 assert 70<=args.quality<=90
 prepare(json.loads(Path(args.inputs).read_text()),args.quality)
