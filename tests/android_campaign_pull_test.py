import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from android_campaign_pull import PACKAGE,copy_campaign_saves

BOOT='11111111-2222-3333-4444-555555555555'

class CampaignCopyTest(unittest.TestCase):
    def adb(self,calls,fail=None,pid_after=None):
        pulls=0
        def run(*args,**kwargs):
            nonlocal pulls
            calls.append(args)
            if args[:2]==('shell','pidof'):return pid_after if pulls and pid_after else '4836'
            if args[:2]==('shell','cat'):return BOOT
            if args[:3]==('shell','ls','-1'):return 'camera23-war.1.json\ncamera23-war.2.json.pending\npreferences.tmp'
            if args[0]=='pull':
                pulls+=1
                if fail and (pulls==1 or fail=='persistent'):
                    text='device offline' if fail=='offline' else 'permission denied' if fail=='permission' else 'remote open failed: No such file or directory: camera23-war.1.json'
                    raise subprocess.CalledProcessError(1,['adb',*args],output=text)
                Path(args[2]).write_text('{"state":{"simulationDay":5}}');return '1 file pulled'
            if args[0]=='wait-for-device':return ''
            raise AssertionError(args)
        return run

    def test_pending_generations_are_not_copied_and_committed_files_are_hashed(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);calls=[]
            copy_campaign_saves(self.adb(calls),PACKAGE,root/'saves',root/'proof.json')
            pulls=[c for c in calls if c[0]=='pull']
            self.assertEqual(len(pulls),1);self.assertNotIn('.pending',pulls[0][1])
            proof=json.loads((root/'proof.json').read_text());self.assertTrue(proof['readOnly'])
            self.assertTrue(proof['attempts'][0]['success']);self.assertEqual(len(proof['attempts'][0]['copiedSha256']),1)

    def test_known_transport_or_generation_race_is_preserved_and_retried(self):
        for mode in ['offline','rotated']:
            with self.subTest(mode=mode),tempfile.TemporaryDirectory() as directory,patch('android_campaign_pull.time.sleep'):
                root=Path(directory)
                copy_campaign_saves(self.adb([],mode),PACKAGE,root/'saves',root/'proof.json')
                attempts=json.loads((root/'proof.json').read_text())['attempts']
                self.assertEqual(len(attempts),2);self.assertFalse(attempts[0]['success']);self.assertTrue(attempts[1]['success'])

    def test_unrecognized_error_or_restarted_app_does_not_get_accepted(self):
        for mode,pid,error in [('permission',None,subprocess.CalledProcessError),('offline','9000',AssertionError),('persistent',None,subprocess.CalledProcessError)]:
            with self.subTest(mode=mode),tempfile.TemporaryDirectory() as directory,patch('android_campaign_pull.time.sleep'):
                root=Path(directory)
                with self.assertRaises(error):copy_campaign_saves(self.adb([],mode,pid),PACKAGE,root/'saves',root/'proof.json')
                attempts=json.loads((root/'proof.json').read_text())['attempts']
                self.assertFalse(any(a.get('success') for a in attempts));self.assertLessEqual(len(attempts),3)

if __name__=='__main__':unittest.main()
