const { withGradleProperties } = require('expo/config-plugins');

// Use a CMake package with Ninja >= 1.12 for Windows long-path support.
// A 240-character object limit cannot fit all Worklets object filenames.
module.exports = (config) =>
  withGradleProperties(config, (config) => {
    const properties = {
      'android.cmakeVersion': '3.31.6',
      'expo.android.cmakeObjectPathMax': '1024',
    };
    config.modResults = config.modResults.filter(
      (entry) =>
        entry.type !== 'property' || !Object.hasOwn(properties, entry.key),
    );
    for (const [key, value] of Object.entries(properties)) {
      config.modResults.push({ type: 'property', key, value });
    }
    return config;
  });
