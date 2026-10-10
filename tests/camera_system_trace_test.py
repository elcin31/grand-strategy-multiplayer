import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
from camera_system_trace import capture_camera_trace


class Process:
    def __init__(self, code): self.code = code; self.stopped = False
    def wait(self, **_): return self.code
    def poll(self): return self.code if self.stopped else None
    def terminate(self): self.stopped = True


class SystemTraceTest(unittest.TestCase):
    def capture(self, root, code=0, after_pid='42', logs='', byte_count=2048, gesture_error=False):
        calls = []
        def adb(*args):
            calls.append(args)
            if args[:3] == ('shell', 'id', '-u'): return '0'
            if args[:2] == ('shell', 'pidof'):
                return '42' if sum(c[:2] == ('shell', 'pidof') for c in calls)==1 else after_pid
            if args[0]=='logcat': return logs
            if args[0]=='pull': Path(args[2]).write_bytes(b'x'*byte_count)
            return ''
        def gesture():
            calls.append(('gesture',))
            if gesture_error: raise RuntimeError('input failed')
        process=Process(code)
        result=capture_camera_trace(adb,root,gesture,popen=lambda *a,**kw:process,pause=lambda _:None)
        return result,calls,process

    def test_trace_is_diagnostic_and_real_markers_enclose_gesture(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);result,calls,process=self.capture(root)
            markers=[i for i,c in enumerate(calls) if c[:3]==('shell','sh','-c')]
            self.assertLess(markers[0],calls.index(('gesture',)));self.assertGreater(markers[1],calls.index(('gesture',)))
            self.assertIn('S|42|DOMINION_PINCH_TRACE|101',calls[markers[0]][3])
            self.assertIn('F|42|DOMINION_PINCH_TRACE|101',calls[markers[1]][3])
            self.assertTrue(result['diagnosticOnly']);self.assertNotIn('fps',result)
            self.assertEqual(json.loads((root/'trace-capture.json').read_text()),result)

    def test_missing_restart_fatal_or_failed_capture_cannot_produce_success_report(self):
        for options in [dict(after_pid='43'),dict(logs='FATAL EXCEPTION'),dict(code=1),dict(byte_count=5),dict(gesture_error=True)]:
            with tempfile.TemporaryDirectory() as directory:
                root=Path(directory)
                with self.assertRaises((AssertionError,RuntimeError)): self.capture(root,**options)
                self.assertFalse((root/'trace-capture.json').exists())

    def test_ambiguous_or_untrusted_pid_is_rejected_before_any_shell_interpolation(self):
        for pid in ['', '42 43', '42;echo bad', '４２']:
            calls=[]
            def adb(*args):
                calls.append(args);return '0' if args[:3]==('shell','id','-u') else pid
            with tempfile.TemporaryDirectory() as directory:
                with self.assertRaisesRegex(AssertionError,'Missing/ambiguous'):
                    capture_camera_trace(adb,Path(directory),lambda:None)
            self.assertFalse(any(c[:2]==('shell','sh') for c in calls))
