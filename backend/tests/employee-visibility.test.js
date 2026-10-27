import test, { mock, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/config/database.js';
import { userRepository } from '../src/modules/users/users.repository.js';
import { actor } from './fixtures.js';

afterEach(() => mock.restoreAll());
after(() => db.end());

test('secretary user directory and direct detail exclude owners and clients', async () => {
  mock.method(db, 'execute', async sql => {
    assert.match(sql, /r.nombre NOT IN \('cliente','dueno'\)/);
    return [[]];
  });
  const secretary = actor('secretario');
  await userRepository.query(secretary, { limit: 100, offset: 0 });
  assert.equal(userRepository.canRead(secretary, { role: 'dueno' }), false);
  assert.equal(userRepository.canRead(secretary, { role: 'cliente' }), false);
  assert.equal(userRepository.canRead(secretary, { role: 'vendedor' }), true);
  assert.equal(userRepository.canRead(actor('dueno'), { role: 'dueno' }), true);
});
