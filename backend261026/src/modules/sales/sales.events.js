/** Estado volátil por puesto. Cada proceso arranca con todas las ventas cerradas. */
export function createEventCache() {
  const events = new Map();
  const pending = new Map();
  return {
    get(stationId) {
      const event = events.get(String(stationId));
      return event ? { ...event } : undefined;
    },
    set(stationId, event) {
      events.set(String(stationId), { ...event });
    },
    // No reservar conexiones mientras se espera otra operación del mismo puesto.
    async run(stationId, operation) {
      const key = String(stationId);
      const previous = pending.get(key);
      let release;
      const next = new Promise(resolve => { release = resolve; });
      pending.set(key, next);
      await previous;
      try { return await operation(); }
      finally {
        release();
        if (pending.get(key) === next) pending.delete(key);
      }
    },
  };
}

export const eventCache = createEventCache();
