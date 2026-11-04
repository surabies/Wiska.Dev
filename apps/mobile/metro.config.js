// metro.config.js — konfigurasi Metro untuk monorepo pnpm + NativeWind.
// Tanpa `withNativeWind` tidak ada pipeline CSS: class `className` TIDAK
// ter-generate di release build (`bundleRelease`) sehingga komponen ter-render
// tanpa style / tak terlihat di HP walau di dev tampak normal.
//
// Dua penyesuaian monorepo:
//   1. watchFolders → sertakan root repo supaya Metro memantau paket bersama.
//   2. nodeModulesPaths → resolusi mencari di node_modules app DAN root.
//
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Dukungan aset wasm bila dibutuhkan
config.resolver.assetExts.push('wasm');

// Mock resolusi expo-sqlite khusus platform web agar tidak memicu
// bug Metro "Worker chunk not found for .../worker.ts" di browser.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && (moduleName === 'expo-sqlite' || moduleName.startsWith('expo-sqlite/'))) {
    return {
      filePath: path.resolve(projectRoot, 'features/pencatat/lib/DbBacaMeter.web.ts'),
      type: 'sourceFile',
    };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Header cross-origin untuk keamanan web dev server
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  return middleware(req, res, next);
};

module.exports = withNativeWind(config, { input: './global.css' });
