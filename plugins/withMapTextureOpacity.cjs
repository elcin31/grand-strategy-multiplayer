const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {withDangerousMod} = require('expo/config-plugins');

const MARKER = '// DOMINION_OPAQUE_MAP_TEXTURE: the sole canvas begins with a full opaque Fill.';
const NATIVE_PATH = 'node_modules/@shopify/react-native-skia/android/src/main/java/com/shopify/reactnative/skia/SkiaTextureView.java';
const BASE_PATH = 'node_modules/@shopify/react-native-skia/android/src/main/java/com/shopify/reactnative/skia/SkiaBaseView.java';
const hash = text => crypto.createHash('sha256').update(text).digest('hex');

function patchTextureView(source) {
  if (!source.includes('class SkiaTextureView extends TextureView') || !source.includes('setSurfaceTextureListener(this);')) {
    throw new Error('Unexpected pinned Skia TextureView implementation');
  }
  if (source.includes(MARKER)) {
    if ((source.match(/setOpaque\(true\);/g) || []).length !== 1 || source.includes('setOpaque(false);')) {
      throw new Error('Inconsistent Dominion texture opacity patch');
    }
    return source;
  }
  if ((source.match(/setOpaque\(false\);/g) || []).length !== 1 || source.includes('setOpaque(true);')) {
    throw new Error('Unexpected pinned Skia texture opacity declaration');
  }
  const patched = source.replace('        setOpaque(false);', '        ' + MARKER + '\n        setOpaque(true);');
  if (patched === source) throw new Error('Unexpected pinned Skia texture constructor layout');
  return patched;
}

function validateCanvasContract(canvases) {
  const opening = canvases.length === 1 ? canvases[0].source.match(/<Canvas\b[^>]*>/)?.[0] : undefined;
  if (canvases.length !== 1 || canvases[0].path !== 'src/components/WorldMap.tsx' ||
      !opening || /\bopaque\s*=/.test(opening) ||
      !/<Canvas\b[^>]*>\s*<Fill\s+color="#203B48"\s*\/>/.test(canvases[0].source)) {
    throw new Error('Texture opacity requires the sole map canvas to begin with its full opaque ocean Fill');
  }
}

function applyMapTextureOpacity(projectRoot, proofDirectory) {
  const version = JSON.parse(fs.readFileSync(path.join(projectRoot, 'node_modules/@shopify/react-native-skia/package.json'), 'utf8')).version;
  if (version !== '2.6.2') throw new Error('Review the map texture opacity contract before changing Skia version');
  const canvases = [];
  const inspect = name => {
    const source = fs.readFileSync(path.join(projectRoot, name), 'utf8');
    for (const _ of source.matchAll(/<Canvas\b/g)) canvases.push({path: name.split(path.sep).join('/'), source});
  };
  for (const name of ['App.tsx', 'CampaignScreen.tsx']) inspect(name);
  const walk = directory => {
    for (const item of fs.readdirSync(path.join(projectRoot, directory), {withFileTypes: true})) {
      const name = path.join(directory, item.name);
      if (item.isDirectory()) walk(name);
      else if (name.endsWith('.tsx')) inspect(name);
    }
  };
  walk('src');
  validateCanvasContract(canvases);
  const filename = path.join(projectRoot, NATIVE_PATH), source = fs.readFileSync(filename, 'utf8');
  const base = fs.readFileSync(path.join(projectRoot, BASE_PATH), 'utf8');
  const patched = patchTextureView(source);
  if (patched === source && !patched.includes(MARKER)) throw new Error('Native texture opacity patch did not apply');
  fs.writeFileSync(filename, patched);
  const proof = {skiaVersion: version, backend: 'TextureView', textureOpaque: true,
    soleCanvas: canvases[0].path, fullOpaqueFill: '#203B48', nativePath: NATIVE_PATH,
    nativeSourceSha256: hash(patched), baseViewSha256: hash(base), baseViewUnchanged: base === fs.readFileSync(path.join(projectRoot, BASE_PATH), 'utf8')};
  if (proofDirectory) {
    fs.mkdirSync(proofDirectory, {recursive: true});
    fs.writeFileSync(path.join(proofDirectory, 'map-texture-opacity.json'), JSON.stringify(proof, null, 2) + '\n');
  }
  return proof;
}

function withMapTextureOpacity(config) {
  return withDangerousMod(config, ['android', async mod => {
    applyMapTextureOpacity(mod.modRequest.projectRoot, mod.modRequest.platformProjectRoot);
    return mod;
  }]);
}
module.exports = withMapTextureOpacity;
module.exports.patchTextureView = patchTextureView;
module.exports.validateCanvasContract = validateCanvasContract;
module.exports.applyMapTextureOpacity = applyMapTextureOpacity;
