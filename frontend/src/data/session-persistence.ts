export interface SessionStorage {
  read(): Promise<string | null>;
  write(token: string | null): Promise<void>;
}

// Ordena escrituras y borrados para que un logout no deje un token pendiente.
export function orderedSessionStorage(storage: SessionStorage): SessionStorage {
  let pending: Promise<void> = Promise.resolve();
  return {
    async read() {
      await pending;
      return storage.read();
    },
    write(token) {
      const operation = pending.then(() => storage.write(token));
      pending = operation.catch(() => undefined);
      return operation;
    },
  };
}

export function sessionStorageKey(apiUrl: string) {
  return `foto-ya.session.${Array.from(apiUrl.replace(/\/$/, ''))
    .map((character) => character.charCodeAt(0).toString(16).padStart(4, '0'))
    .join('')}`;
}
