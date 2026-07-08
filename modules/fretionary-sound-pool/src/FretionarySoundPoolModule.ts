import { Platform } from 'react-native';
import { requireNativeModule } from 'expo';

interface FretionarySoundPoolNative {
  loadFromUri(name: string, uri: string): Promise<void>;
  play(name: string, rate: number): boolean;
  stopAll(): void;
  unloadAll(): void;
}

// The native module exists only on Android (expo-module.config.json restricts
// platforms to ["android"]) and only in a real dev/production build — it is NOT
// present in Expo Go. requireNativeModule throws when the module is missing, so
// we guard it: on iOS and in Android Expo Go, nativeModule stays null and the
// audio engine falls back to expo-av.
let nativeModule: FretionarySoundPoolNative | null = null;
if (Platform.OS === 'android') {
  try {
    nativeModule = requireNativeModule<FretionarySoundPoolNative>('FretionarySoundPool');
  } catch {
    nativeModule = null;
  }
}

export const isSoundPoolAvailable = nativeModule !== null;

export function loadSound(name: string, uri: string): Promise<void> {
  return nativeModule ? nativeModule.loadFromUri(name, uri) : Promise.resolve();
}

export function playSound(name: string, rate: number): boolean {
  return nativeModule ? nativeModule.play(name, rate) : false;
}

export function stopAllSounds(): void {
  nativeModule?.stopAll();
}

export function unloadAllSounds(): void {
  nativeModule?.unloadAll();
}

export default nativeModule;
