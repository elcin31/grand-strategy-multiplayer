"""Read committed QA save generations without racing temporary save files.

Used outside timed camera captures only. Never writes to the device, restarts
the game, suppresses unknown errors, or accepts a changed process/boot.
"""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import time

PACKAGE='com.elcin31.grandstrategymultiplayer'

def copy_campaign_saves(adb,package,destination,diagnostic):
    assert package==PACKAGE
    destination=Path(destination);destination.mkdir(parents=True,exist_ok=True)
    diagnostic=Path(diagnostic)
    pid=adb('shell','pidof',package).strip()
    boot=adb('shell','cat','/proc/sys/kernel/random/boot_id').strip()
    assert pid.isascii() and pid.isdigit() and int(pid)>0
    assert re.fullmatch('[0-9a-fA-F-]{36}',boot),'Missing native boot identity'
    directory='/data/user/0/'+package+'/files/dominion-campaigns'
    report={'readOnly':True,'outsideTimedCapture':True,'gamePid':int(pid),'bootId':boot,'attempts':[]}
    def persist():diagnostic.write_text(json.dumps(report,indent=2)+'\n')
    for attempt in range(3):
        record={'attempt':attempt+1};report['attempts'].append(record);persist()
        try:
            names=adb('shell','ls','-1',directory,timeout=15).splitlines()
            files=sorted(n for n in names if re.fullmatch(r'[A-Za-z0-9_.-]+\.json',n) and '..' not in n)
            assert files,'No committed campaign generations on the QA device'
            record['committedFiles']=files
            for name in files:
                adb('pull',directory+'/'+name,destination/name,timeout=30)
                json.loads((destination/name).read_text())
            assert adb('shell','pidof',package).strip()==pid,'App restarted during diagnostic save copy'
            assert adb('shell','cat','/proc/sys/kernel/random/boot_id').strip()==boot,'Emulator rebooted during diagnostic save copy'
            record['success']=True
            record['copiedSha256']={name:hashlib.sha256((destination/name).read_bytes()).hexdigest() for name in files}
            persist();return
        except subprocess.CalledProcessError as error:
            output=error.output.decode(errors='replace') if isinstance(error.output,bytes) else str(error.output or '')
            record.update(success=False,errorOutput=output,errorCommand=[str(x) for x in error.cmd]);persist()
            offline='device offline' in output
            if not output and len(error.cmd)>1 and str(error.cmd[1])=='pull':
                # Some SDK adb builds print the daemon's offline error outside
                # the pull subprocess output. Require an explicit transport
                # observation; an empty unknown error is never enough.
                try:transport=adb('get-state',timeout=10).strip()
                except subprocess.CalledProcessError as probe:
                    transport=probe.output.decode(errors='replace') if isinstance(probe.output,bytes) else str(probe.output or '')
                record['transportProbe']=transport;persist()
                offline=transport=='offline' or 'device offline' in transport
            generation_rotated='No such file or directory' in output and 'remote' in output and '.json' in output
            if attempt==2 or not(offline or generation_rotated):raise
            if offline:adb('wait-for-device',timeout=30)
            assert adb('shell','pidof',package).strip()==pid,'App restarted during diagnostic transport failure'
            assert adb('shell','cat','/proc/sys/kernel/random/boot_id').strip()==boot,'Emulator rebooted; comparison invalid'
            time.sleep(.25)
        except Exception as error:
            record.update(success=False,errorType=type(error).__name__,errorMessage=str(error));persist();raise
