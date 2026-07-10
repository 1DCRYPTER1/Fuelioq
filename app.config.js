module.exports = ({ config }) => {
  return {
    ...config,
    ios: {
      ...config.ios,
      config: {
        ...config.ios?.config,
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_IOS || config.ios?.config?.googleMapsApiKey
      }
    },
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: {
          ...config.android?.config?.googleMaps,
          apiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID || config.android?.config?.googleMaps?.apiKey
        }
      }
    }
  };
};
