module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Worklets-core for VisionCamera frame processors (Reanimated is handled by babel-preset-expo)
      'react-native-worklets-core/plugin',
    ],
  };
};
