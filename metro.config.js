const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Android's native audio player supports our original local Vorbis tracks.
// Metro must package them as binary assets instead of looking for JS modules.
if (!config.resolver.assetExts.includes('ogg')) {
  config.resolver.assetExts.push('ogg');
}

module.exports = config;
