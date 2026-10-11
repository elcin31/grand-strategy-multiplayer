"""Verify original packaged image bytes despite Metro/aapt resource renaming."""
import hashlib

def assert_packaged_art(apk,entries):
 digests={hashlib.sha256(apk.read(name)).hexdigest() for name in apk.namelist()
          if name.startswith(('assets/','res/')) and name.endswith('.webp')}
 for entry in entries:
  assert entry['sha256'] in digests,'Missing or changed packaged painting: '+entry['path']
 return len(entries)
