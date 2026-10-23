/** Comprueba que un fallo de copia no elimine las verificaciones originales. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateVerifications } from '../scripts/lib/migrate-verifications.js';

for (const failure of ['copy', 'commit']) {
  test(`la migración conserva la tabla original si falla ${failure}`, async () => {
    const events = [], error = new Error('simulated failure');
    const connection = {
      beginTransaction: async () => events.push('begin'),
      commit: async () => { events.push('commit'); if (failure === 'commit') throw error; },
      rollback: async () => events.push('rollback'),
      query: async sql => {
        if (sql.startsWith('DELETE')) events.push('delete');
        else if (sql.startsWith('INSERT')) { events.push('copy'); if (failure === 'copy') throw error; }
        else if (sql.startsWith('DROP')) events.push('drop');
        else assert.fail(`SQL inesperado: ${sql}`);
      },
    };
    await assert.rejects(migrateVerifications(connection, { hasColumn: async () => true, hasIndex: async () => true }), error);
    assert.deepEqual(events, failure === 'copy'
      ? ['begin', 'delete', 'copy', 'rollback']
      : ['begin', 'delete', 'copy', 'commit', 'rollback']);
  });
}

test('la migración elimina la tabla original sólo después de confirmar la copia', async () => {
  const events = [];
  const connection = {
    beginTransaction: async () => events.push('begin'),
    commit: async () => events.push('commit'),
    rollback: async () => assert.fail('No debe revertir una copia confirmada'),
    query: async sql => events.push(sql.split(' ')[0]),
  };
  await migrateVerifications(connection, { hasColumn: async () => true, hasIndex: async () => true });
  assert.deepEqual(events, ['begin', 'DELETE', 'INSERT', 'commit', 'DROP']);
});
