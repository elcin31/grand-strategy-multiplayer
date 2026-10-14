import json
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from android_saved_generation import latest_war_state

class SavedGenerationTest(unittest.TestCase):
    def write(self,root,generation,state):
        (root/f'camera23-war.{generation}.json').write_text(json.dumps({'state':state}))

    def test_paused_commit_at_same_date_supersedes_running_save(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            self.write(root,3,{'simulationDay':48,'phase':'running'})
            self.write(root,4,{'simulationDay':48,'phase':'paused'})
            self.assertEqual(latest_war_state(root)['phase'],'paused')

    def test_selection_does_not_prefer_paused_when_later_running_commit_exists(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            self.write(root,3,{'simulationDay':48,'phase':'paused'})
            self.write(root,4,{'simulationDay':48,'phase':'running'})
            self.assertEqual(latest_war_state(root)['phase'],'running')

    def test_numeric_order_ignores_pending_and_index_and_conflicting_copy_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            self.write(root,9,{'simulationDay':48,'phase':'running'})
            self.write(root,10,{'simulationDay':48,'phase':'paused'})
            (root/'camera23-war.11.json.pending').write_text('{')
            (root/'camera23-war.index.json').write_text('{}')
            self.assertEqual(latest_war_state(root)['phase'],'paused')
            nested=root/'nested';nested.mkdir();self.write(nested,10,{'simulationDay':48,'phase':'running'})
            with self.assertRaisesRegex(AssertionError,'Conflicting copies'):latest_war_state(root)

if __name__=='__main__':unittest.main()
