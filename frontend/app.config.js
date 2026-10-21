module.exports = ({ config }) => {
  const domain = process.env.EXPO_PUBLIC_AUTH0_DOMAIN?.trim();
  const clientId = process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID?.trim();
  if (domain && !/^[a-z0-9.-]+$/i.test(domain))
    throw new Error('AUTH0_DOMAIN debe ser un hostname sin https://.');
  return {
    ...config,
    scheme: 'fotoya',
    ios: { ...config.ios, bundleIdentifier: 'com.fotoya.app' },
    android: { ...config.android, package: 'com.fotoya.app' },
    plugins: [
      ...(config.plugins ?? []).filter(
        (plugin) =>
          (Array.isArray(plugin) ? plugin[0] : plugin) !== 'react-native-auth0',
      ),
      ...(domain && clientId
        ? [['react-native-auth0', { domain, customScheme: 'fotoya' }]]
        : []),
    ],
  };
};
