/**
 * @file
 * Persiste el token nativo con SecureStore. Comparte interfaz y orden de escrituras con web
 * usando protección del dispositivo.
 */
import * as SecureStore from 'expo-secure-store';
import {
  orderedSessionStorage,
  sessionStorageKey,
} from './session-persistence';

// Adapta el almacenamiento seguro nativo a la cola común de persistencia.
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
