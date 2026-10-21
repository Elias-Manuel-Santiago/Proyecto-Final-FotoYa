import {
  orderedSessionStorage,
  sessionStorageKey,
} from './session-persistence';

// Esta implementación también se importa durante la exportación estática web.
export function createSessionStorage(apiUrl: string) {
  const key = sessionStorageKey(apiUrl);
  return orderedSessionStorage({
    async read() {
      return typeof window === 'undefined'
        ? null
        : window.localStorage.getItem(key);
    },
    async write(token) {
      if (typeof window === 'undefined') return;
      if (token === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, token);
    },
  });
}
