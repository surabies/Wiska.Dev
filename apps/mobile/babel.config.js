// babel.config.js — wajib untuk NativeWind v4: `jsxImportSource: nativewind`
// membuat setiap elemen menerima prop `className`, dan preset `nativewind/babel`
// mentransformasikannya. Plugin reanimated/worklets sudah otomatis disertakan
// oleh `babel-preset-expo` (SDK 57), jadi tidak perlu ditambah manual.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
