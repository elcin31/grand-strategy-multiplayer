const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {withDangerousMod} = require('expo/config-plugins');

const NATIVE_PATH = 'node_modules/@shopify/react-native-skia/src/sksg/Container.native.ts';
const RECORDER_PATH = 'node_modules/@shopify/react-native-skia/cpp/api/recorder/JsiRecorder.h';
const ORIGINAL_SHA256 = '921d99c81ea02318d217dd52386d8b71ac268e1b56138c7f781c1ae2e9935e0b';
const RECORDER_SHA256 = 'a6b8561f75d993b16003011feb7619d906c88851be802359e184bb92706c86e1';
const MARKER = '// DOMINION_RECORDER_LIFECYCLE: release retired commands on the UI runtime.';
const hash = source => crypto.createHash('sha256').update(source).digest('hex');
const changes = [
  ['  private picture: SkPicture;', '  private picture: SkPicture;\n  private recorder: JsiRecorder | null = null;'],
  ['  redraw() {', `  ${MARKER}
  unmount() {
    super.unmount();
    if (this.mapperId !== null) {
      Rea.stopMapper(this.mapperId);
      this.mapperId = null;
    }
    const recorder = this.recorder;
    this.recorder = null;
    if (recorder !== null) {
      Rea.runOnUI(() => {
        "worklet";
        recorder.reset();
      })();
    }
  }

  redraw() {`],
  ['      Rea.stopMapper(this.mapperId);\n    }\n    if (this.unmounted)', '      Rea.stopMapper(this.mapperId);\n      this.mapperId = null;\n    }\n    if (this.unmounted)'],
  ['    const recorder = new ReanimatedRecorder(this.Skia);', '    const previousRecorder = this.recorder;\n    const recorder = new ReanimatedRecorder(this.Skia);'],
  ['    const sharedRecorder = recorder.getRecorder();', '    const sharedRecorder = recorder.getRecorder();\n    this.recorder = sharedRecorder;'],
  ['      nativeDrawOnscreen(nativeId, sharedRecorder, picture);\n    })();', `      nativeDrawOnscreen(nativeId, sharedRecorder, picture);
      // The new picture owns its native references before retiring the old commands.
      if (previousRecorder !== null) {
        previousRecorder.reset();
      }
    })();`],
];

function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) throw new Error('Unexpected pinned Skia recorder lifecycle layout');
  return source.replace(before, after);
}

function patchNativeContainer(source) {
  let original = source;
  if (source.includes(MARKER)) {
    for (const [before, after] of [...changes].reverse()) original = replaceOnce(original, after, before);
  }
  if (hash(original) !== ORIGINAL_SHA256) throw new Error('Review the recorder lifecycle contract before changing pinned Skia source');
  let patched = original;
  for (const [before, after] of changes) patched = replaceOnce(patched, before, after);
  if (source.includes(MARKER) && source !== patched) throw new Error('Inconsistent Dominion recorder lifecycle patch');
  return patched;
}

function applySkiaRecorderLifecycle(projectRoot, proofDirectory) {
  const metadata = JSON.parse(fs.readFileSync(path.join(projectRoot, 'node_modules/@shopify/react-native-skia/package.json'), 'utf8'));
  if (metadata.version !== '2.6.2' || metadata['react-native'] !== 'src/index.ts') {
    throw new Error('Review the recorder lifecycle contract before changing Skia version or native Metro entry');
  }
  const header = fs.readFileSync(path.join(projectRoot, RECORDER_PATH), 'utf8');
  if (hash(header) !== RECORDER_SHA256) throw new Error('Unexpected pinned native recorder reset implementation');
  const filename = path.join(projectRoot, NATIVE_PATH);
  const patched = patchNativeContainer(fs.readFileSync(filename, 'utf8'));
  fs.writeFileSync(filename, patched);
  const proof = {skiaVersion: metadata.version, nativeMetroEntry: metadata['react-native'],
    nativePath: NATIVE_PATH, originalSourceSha256: ORIGINAL_SHA256, nativeSourceSha256: hash(patched),
    recorderPath: RECORDER_PATH, recorderHeaderSha256: hash(header),
    retiredCommandsResetOnUi: true, stopMapperBeforeReset: true, livePicturesDisposed: false};
  if (proofDirectory) {
    fs.mkdirSync(proofDirectory, {recursive: true});
    fs.writeFileSync(path.join(proofDirectory, 'skia-recorder-lifecycle.json'), JSON.stringify(proof, null, 2) + '\n');
  }
  return proof;
}

function withSkiaRecorderLifecycle(config) {
  return withDangerousMod(config, ['android', async mod => {
    applySkiaRecorderLifecycle(mod.modRequest.projectRoot, mod.modRequest.platformProjectRoot);
    return mod;
  }]);
}
module.exports = withSkiaRecorderLifecycle;
module.exports.patchNativeContainer = patchNativeContainer;
module.exports.applySkiaRecorderLifecycle = applySkiaRecorderLifecycle;
