import base64,hashlib,json,subprocess,zipfile
from pathlib import Path
RUN=37991163050
SOURCE="efd1f3d4b63d737001ab6301b65bd151609b76af"
apk=Path("Dominion-camera-optimized-illustrated.apk")
with zipfile.ZipFile(apk) as z:
    assert z.testzip() is None
    bundle=z.read("assets/index.android.bundle")
    assert b"https://dfjsnjxnyjspwugjguhq.supabase.co/functions/v1" in bundle
report_path=Path("CAMERA_NATIVE_PAIRED.json")
report=json.loads(report_path.read_text()) if report_path.exists() else {"incomplete":True,"before":json.loads(Path("camera-before/results.json").read_text()) if Path("camera-before/results.json").exists() else None,"after":json.loads(Path("camera-after/results.json").read_text()) if Path("camera-after/results.json").exists() else None}
report["apkVerification"]={"sourceRuntime":SOURCE,"sourceRun":RUN,"bytes":apk.stat().st_size,"sha256":hashlib.sha256(apk.read_bytes()).hexdigest(),"bundleBytes":len(bundle),"integrity":Path("checkpoint-integrity.txt").read_text(),"note":"Intermediate only; Expansion 2.0 stages 3-11 unfinished."}
report["pictures"]={}
for name in ["03-pinch","04-world-pan"]:
    p=Path("camera-after")/(name+".png")
    if not p.exists():continue
    raw=p.read_bytes()
    report["pictures"][name]={"bytes":len(raw),"sha256":hashlib.sha256(raw).hexdigest(),"gitBlobSha":hashlib.sha1(b"blob "+str(len(raw)).encode()+b"\0"+raw).hexdigest()}
    encoded=base64.b64encode(raw).decode()
    for i in range(0,len(encoded),4000):print("DOMINION_PNG_CHUNK",name,i//4000,encoded[i:i+4000],flush=True)
Path("EXPANSION_CAMERA_REVIEW.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
encoded=base64.b64encode(json.dumps(report,ensure_ascii=True).encode()).decode()
for i in range(0,len(encoded),4000):print("DOMINION_EVIDENCE_CHUNK",i//4000,encoded[i:i+4000],flush=True)
