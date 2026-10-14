const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {withDangerousMod} = require('expo/config-plugins');

const NATIVE_PATH = 'node_modules/@shopify/react-native-skia/android/cpp/rnskia-android/OpenGLWindowContext.cpp';
const ORIGINAL_SHA256 = 'fc204391ec75d5df6e5d2eb11c2a4395e1415b5ae1d3d75fbaa19c31e636e705';
const MARKER = '// DOMINION_UI_SCHEDULED_SWAP: the UI frame callback already schedules camera presentation.';
const BEFORE = '    _glContext->makeCurrent(_glSurface.get());\n    GLint stencil;';
const AFTER = `    _glContext->makeCurrent(_glSurface.get());
    ${MARKER}
    // Request asynchronous buffer submission only after the window is current.
    // EGL may clamp to the driver's minimum; measurements decide acceptance.
    if (eglSwapInterval(eglGetCurrentDisplay(), 0) == EGL_TRUE) {
      RNSkLogger::logToConsole("DOMINION_PRESENTATION swap-zero-requested");
    } else {
      // A rejected request leaves the existing driver behavior in place.
      RNSkLogger::logToConsole("DOMINION_PRESENTATION swap-zero-unavailable");
    }
    GLint stencil;`;
const hash = text => crypto.createHash('sha256').update(text).digest('hex');

function patchSwapPacing(source) {
  const original = source.includes(MARKER) ? source.replace(AFTER, BEFORE) : source;
  if (hash(original) !== ORIGINAL_SHA256 || original.split(BEFORE).length !== 2) {
    throw new Error('Review swap pacing before changing pinned Skia window context');
  }
  const patched = original.replace(BEFORE, AFTER);
  if (source.includes(MARKER) && patched !== source) throw new Error('Inconsistent swap pacing patch');
  return patched;
}

function applySwapPacing(projectRoot, proofDirectory) {
  const metadata = JSON.parse(fs.readFileSync(path.join(projectRoot, 'node_modules/@shopify/react-native-skia/package.json'), 'utf8'));
  if (metadata.version !== '2.6.2') throw new Error('Swap pacing requires reviewed Skia 2.6.2');
  const filename = path.join(projectRoot, NATIVE_PATH);
  const patched = patchSwapPacing(fs.readFileSync(filename, 'utf8'));
  fs.writeFileSync(filename, patched);
  const proof = {skiaVersion: metadata.version, nativePath: NATIVE_PATH, originalSourceSha256: ORIGINAL_SHA256,
    nativeSourceSha256: hash(patched), requestedSwapInterval: 0, driverMinimumMayClamp: true,
    appliesAfterWindowMadeCurrent: true, oncePerSurface: true, unsupportedRequestKeepsDriverBehavior: true,
    presentationBackend: 'TextureView', geometryChanges: false, extraImagesOrSurfaces: false,
    simulationChanges: false, frameRateClaim: false};
  if (proofDirectory) {
    fs.mkdirSync(proofDirectory, {recursive: true});
    fs.writeFileSync(path.join(proofDirectory, 'skia-swap-pacing.json'), JSON.stringify(proof, null, 2) + '\n');
  }
  return proof;
}

module.exports = config => withDangerousMod(config, ['android', async mod => {
  applySwapPacing(mod.modRequest.projectRoot, mod.modRequest.platformProjectRoot);
  return mod;
}]);
module.exports.patchSwapPacing = patchSwapPacing;
module.exports.applySwapPacing = applySwapPacing;
module.exports.nativePath = NATIVE_PATH;
module.exports.originalSha256 = ORIGINAL_SHA256;
module.exports.restoreSwapPacing = source => {
  const original = source.includes(MARKER) ? source.replace(AFTER, BEFORE) : source;
  if (hash(original) !== ORIGINAL_SHA256) throw new Error('Cannot restore unreviewed native window context');
  return original;
};
