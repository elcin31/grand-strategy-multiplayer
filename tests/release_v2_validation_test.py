import copy
import sys
import unittest
import tempfile
import json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parents[1]/'scripts'))
from release_v2_validation import (assert_accepted_run,assert_binary_evidence,REQUIRED_JOBS,
                                  PACKAGE,BACKUP_SUFFIXES,read_evidence)


class ReleaseAcceptanceTest(unittest.TestCase):
    def test_uploaded_common_root_is_supported_but_missing_or_duplicate_native_evidence_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(AssertionError):read_evidence(folder,'NATIVE_ONLINE_QA.json')
            nested=Path(folder)/'home/runner/work/dominion/android-online'
            nested.mkdir(parents=True)
            (nested/'NATIVE_ONLINE_QA.json').write_text(json.dumps({'apkSha256':'b'*64}))
            self.assertEqual(read_evidence(folder,'NATIVE_ONLINE_QA.json'),{'apkSha256':'b'*64})
            (Path(folder)/'NATIVE_ONLINE_QA.json').write_text('{}')
            with self.assertRaises(AssertionError):read_evidence(folder,'NATIVE_ONLINE_QA.json')

    def fixture(self):
        acceptance={'status':'ACCEPTED','runtime':'a'*40,'runId':17,'apkSha256':'b'*64,
                    'apkBytes':142473325,'version':'2.0.0','versionCode':10,
                    'qaCleanup':{'roomIds':['http-qa','native-qa'],'roomsRemaining':0,
                                 'playersRemaining':0,'receiptsRemaining':0,'preservedCityBackups':29}}
        run={'repository':{'full_name':'elcin31/grand-strategy-multiplayer'},'id':17,
             'head_sha':'a'*40,'status':'completed','conclusion':'success'}
        jobs={'jobs':[{'name':n,'status':'completed','conclusion':'success'} for n in REQUIRED_JOBS]}
        upgrade={'baseline':{'package':PACKAGE,'versionCode':9,'certificateSha256':'c'*64},
                 'candidate':{'package':PACKAGE,'versionCode':10,'versionName':'2.0.0','certificateSha256':'c'*64},
                 'oldSchema':12,'newSchema':18,'migrationBackupSha256':{k:'d'*64 for k in BACKUP_SUFFIXES},
                 'originalWorld':{'countries':195,'provinces':2924,'cities':5411}}
        upgrade.update({k:True for k in ['appUidRetained','privateCampaignFilesRetained',
            'encryptedPreferenceBytesRetainedBeforeLaunch','repeatBackupBytesUnchanged',
            'actualCandidateRestart','finalVersionUpgrade']})
        online={'apkSha256':'b'*64,'stateVersion':18,'members':2,'nativePaidFocus':'eco-audit','roomId':'native-qa'}
        online.update({k:True for k in ['nativeCreate','serverPaused','menuReconnect','processReconnect',
            'realHostMigration','nativeOwnerReturn','rebootReconnect','sameNativeUidAndSessionKeys',
            'onceOnlyFocusPaymentRetained']})
        backend={'featuresVerified':True,'hostMigrationVerified':True,'stateVersion':18,
                 'finalSchema':18,'roomId':'http-qa'}
        return acceptance,run,jobs,upgrade,online,backend

    def test_pending_or_wrong_commit_and_each_missing_failed_or_running_gate_cannot_publish(self):
        a,r,j,*_=self.fixture();assert_accepted_run(a,r,j)
        for name in REQUIRED_JOBS:
            for status in ['failure','cancelled','in_progress']:
                wrong=copy.deepcopy(j)
                job=next(x for x in wrong['jobs'] if x['name']==name)
                job['conclusion']=status
                with self.assertRaises(AssertionError):assert_accepted_run(a,r,wrong)
            wrong=copy.deepcopy(j);wrong['jobs']=[x for x in wrong['jobs'] if x['name']!=name]
            with self.assertRaises(AssertionError):assert_accepted_run(a,r,wrong)
        for key,value in [('status','in_progress'),('head_sha','e'*40),('id',18)]:
            wrong={**r,key:value}
            with self.assertRaises(AssertionError):assert_accepted_run(a,wrong,j)
        with self.assertRaises(AssertionError):assert_accepted_run({**a,'status':'PENDING'},r,j)

    def test_wrong_binary_repeated_paid_reward_lower_version_or_unfinished_cleanup_cannot_publish(self):
        a,_,_,u,o,b=self.fixture()
        check=lambda a,u,o,b,sha='b'*64,size=142473325,stress=1818:assert_binary_evidence(a,sha,size,u,o,b,stress)
        check(a,u,o,b)
        for sha,size in [('e'*64,142473325),('b'*64,142473324)]:
            with self.assertRaises(AssertionError):check(a,u,o,b,sha,size)
        for field in ['finalVersionUpgrade','repeatBackupBytesUnchanged','encryptedPreferenceBytesRetainedBeforeLaunch']:
            with self.assertRaises(AssertionError):check(a,{**u,field:False},o,b)
        for field in ['onceOnlyFocusPaymentRetained','nativeOwnerReturn','rebootReconnect']:
            with self.assertRaises(AssertionError):check(a,u,{**o,field:False},b)
        wrong=copy.deepcopy(u);wrong['candidate']['versionCode']=9
        with self.assertRaises(AssertionError):check(a,wrong,o,b)
        for field in ['roomsRemaining','playersRemaining','receiptsRemaining']:
            wrong=copy.deepcopy(a);wrong['qaCleanup'][field]=1
            with self.assertRaises(AssertionError):check(wrong,u,o,b)
        with self.assertRaises(AssertionError):check(a,u,o,{**b,'hostMigrationVerified':False})
        for stress in [1799,float('inf'),float('nan')]:
            with self.assertRaises(AssertionError):check(a,u,o,b,stress=stress)
