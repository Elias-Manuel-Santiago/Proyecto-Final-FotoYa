/**
 * @file
 * Persiste el token web en localStorage. Tolera ausencia de window en exportación estática y
 * serializa escrituras con el adaptador común.
 */
import {
  orderedSessionStorage,
  sessionStorageKey,
} from './session-persistence';

// Esta implementación también se importa durante la exportación estática web.
// Adapta localStorage con una clave independiente por API.
export function createSessionStorage(apiUrl: string) {
  const key = sessionStorageKey(apiUrl);
  return orderedSessionStorage({
    // Recupera el token si hay navegador; en render del servidor devuelve null.
    async read() {
      return typeof window === 'undefined'
        ? null
        : window.localStorage.getItem(key);
    },
    // Guarda o elimina el token solo cuando está disponible el navegador.
    async write(token) {
      if (typeof window === 'undefined') return;
      if (token === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, token);
    },
  });
}
