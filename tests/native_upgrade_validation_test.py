import copy
import json
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parents[1]/'scripts'))
from native_upgrade_validation import (PACKAGE,BACKUP_SUFFIXES,package_metadata,
    assert_install_compatibility,assert_app_data_preserved,assert_migration,assert_backups_immutable)


class NativeUpgradeValidationTest(unittest.TestCase):
    def metadata(self,code=9,name='0.8.1'):
        return {'package':PACKAGE,'versionCode':code,'versionName':name,'certificateSha256':'a'*64}

    def test_real_signature_package_and_monotonic_release_version_are_required(self):
        badging="package: name='"+PACKAGE+"' versionCode='9' versionName='0.8.1'"
        signature='Verifies\nV2 Signer: certificate SHA-256 digest: '+'a'*64
        self.assertEqual(package_metadata(badging,signature),self.metadata())
        for bad,sig in [(badging+'\napplication-debuggable',signature),(badging.replace(PACKAGE,'other'),signature),(badging,signature.replace('a'*64,'bad')),(badging,signature+'\ncertificate SHA-256 digest: '+'b'*64)]:
            with self.assertRaises(AssertionError):package_metadata(bad,sig)
        expected={'version':'2.0.0','android':{'versionCode':10}}
        assert_install_compatibility(self.metadata(),self.metadata(10,'2.0.0'),expected)
        assert_install_compatibility(self.metadata(),self.metadata(),{'version':'0.8.1','android':{'versionCode':9}})
        for candidate,config in [(self.metadata(9,'2.0.0'),{'version':'2.0.0','android':{'versionCode':9}}),(self.metadata(8),{'version':'0.8.1','android':{'versionCode':8}}),({**self.metadata(10,'2.0.0'),'certificateSha256':'b'*64},expected),(self.metadata(10,'2.0.1'),expected)]:
            with self.assertRaises(AssertionError):assert_install_compatibility(self.metadata(),candidate,config)

    def test_installation_must_retain_uid_private_save_bytes_and_encrypted_preferences(self):
        files={'campaign.1.json':'b'*64};secure='a'*64
        assert_app_data_preserved('10100','10100',files,files,secure,secure)
        for values in [('10100','10101',files,files,secure,secure),('10100','10100',files,{},secure,secure),('10100','10100',files,{'campaign.1.json':'c'*64},secure,secure),('10100','10100',files,files,secure,'c'*64),('10100','10100',{}, {},secure,secure)]:
            with self.assertRaises(AssertionError):assert_app_data_preserved(*values)

    def fixture(self):
        return {'format':1,'metadata':{'id':'fixture','generation':2},'state':{'id':'fixture','stateVersion':12,'phase':'paused','tick':0,'countries':{'de':{'treasury':100}},'provinces':[],'cities':[],'armies':[],'diplomacy':{},'wars':[],'constructions':[],'movements':[]}}

    def test_native_migration_and_repeat_save_need_all_original_backups_and_no_rewards(self):
        before=self.fixture();after=copy.deepcopy(before);after['state']['stateVersion']=18;after['metadata']['generation']=3
        raw=json.dumps(before).encode();new=json.dumps(after).encode();backups={suffix:raw for suffix in BACKUP_SUFFIXES}
        assert_migration(raw,new,backups)
        hashes={suffix:'a'*64 for suffix in BACKUP_SUFFIXES};assert_backups_immutable(hashes,hashes)
        for bad in [{**backups,'before-focus-v18':b'changed'},{k:v for k,v in backups.items() if k!='before-economy-v15'}]:
            with self.assertRaises(AssertionError):assert_migration(raw,new,bad)
        for key,value in [('stateVersion',17),('tick',1),('focusEvents',[{'id':'reward'}])]:
            changed=copy.deepcopy(after);changed['state'][key]=value
            with self.assertRaises(AssertionError):assert_migration(raw,json.dumps(changed).encode(),backups)
        changed=copy.deepcopy(after);changed['state']['countries']['de']['treasury']=101
        with self.assertRaises(AssertionError):assert_migration(raw,json.dumps(changed).encode(),backups)
        with self.assertRaises(AssertionError):assert_backups_immutable(hashes,{**hashes,'before-focus-v18':'b'*64})
        with self.assertRaises(AssertionError):assert_backups_immutable({}, {})
