import * as SecureStore from 'expo-secure-store';
import {
  orderedSessionStorage,
  sessionStorageKey,
} from './session-persistence';

export function createSessionStorage(apiUrl: string) {
  const key = sessionStorageKey(apiUrl);
  return orderedSessionStorage({
    read: () => SecureStore.getItemAsync(key),
    write: (token) =>
      token === null
        ? SecureStore.deleteItemAsync(key)
        : SecureStore.setItemAsync(key, token, {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          }),
  });
}
