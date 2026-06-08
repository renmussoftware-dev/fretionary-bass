import Constants from 'expo-constants';

// True when running inside the Expo Go sandbox, where custom native modules
// (Meta SDK, etc.) are NOT present. We use this to no-op those integrations so
// the app still runs in Expo Go for UI/audio preview, while staying fully
// functional in dev/production builds.
export const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';
