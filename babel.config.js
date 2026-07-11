module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo (SDK 54) auto-applies the react-native-reanimated plugin
    // when the library is installed, so no explicit plugins are needed here.
    presets: ['babel-preset-expo'],
  };
};
