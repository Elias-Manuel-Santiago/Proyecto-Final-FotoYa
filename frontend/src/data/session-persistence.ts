/**
 * @file
 * Define almacenamiento mínimo de sesión y ordena escrituras/borrados. Deriva una clave por
 * URL de API para separar entornos.
 */
export interface SessionStorage {
  read(): Promise<string | null>;
  write(token: string | null): Promise<void>;
}

// Ordena escrituras y borrados para que un logout no deje un token pendiente.
// Encadena escrituras para que un token anterior no reaparezca después del cierre de sesión.
export function orderedSessionStorage(storage: SessionStorage): SessionStorage {
  let pending: Promise<void> = Promise.resolve();
  return {
    // Espera las escrituras pendientes antes de consultar el token persistido.
    async read() {
      await pending;
      return storage.read();
    },
    // Encola guardado o borrado y permite continuar la cola aunque esta escritura falle.
    write(token) {
      const operation = pending.then(() => storage.write(token));
      pending = operation.catch(() => undefined);
      return operation;
    },
  };
}

// Deriva una clave por URL de API para separar sesiones entre entornos.
export function sessionStorageKey(apiUrl: string) {
  return `foto-ya.session.${Array.from(apiUrl.replace(/\/$/, ''))
    .map((character) => character.charCodeAt(0).toString(16).padStart(4, '0'))
    .join('')}`;
}
