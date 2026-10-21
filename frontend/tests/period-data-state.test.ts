import assert from 'node:assert/strict';
import test from 'node:test';
import {
  failedPeriodResult,
  periodDataState,
} from '../src/hooks/period-data-state';
import { createSeed } from './support/seed';

test('la primera consulta carga sin datos y el refresco conserva el resultado visible', () => {
  const base = createSeed();
  const data = createSeed();
  const initial = periodDataState(undefined, 'request-1', 'scope', base);
  assert.equal(initial.loading, true);
  assert.equal(initial.refreshing, true);
  assert.equal(initial.data, undefined);

  const result = { key: 'request-1', scope: 'scope', base, data };
  const loaded = periodDataState(result, 'request-1', 'scope', base);
  assert.equal(loaded.loading, false);
  assert.equal(loaded.refreshing, false);
  assert.equal(loaded.data, data);

  const refreshing = periodDataState(result, 'request-2', 'scope', base);
  assert.equal(refreshing.loading, false);
  assert.equal(refreshing.refreshing, true);
  assert.equal(refreshing.data, data);

  const newBase = periodDataState(result, 'request-1', 'scope', createSeed());
  assert.equal(newBase.refreshing, true);
  assert.equal(newBase.loading, false);
  assert.equal(newBase.data, data);
});

test('al cambiar filtros o autorización no se muestran datos del alcance anterior', () => {
  const base = createSeed();
  const result = { key: 'old-request', scope: 'old-scope', base, data: base };
  const changed = periodDataState(result, 'new-request', 'new-scope', base);
  assert.equal(changed.data, undefined);
  assert.equal(changed.loading, true);
  const failed = failedPeriodResult(result, {
    key: 'new-request',
    scope: 'new-scope',
    base,
    error: 'Sin conexión',
  });
  const state = periodDataState(failed, 'new-request', 'new-scope', base);
  assert.equal(state.data, undefined);
  assert.equal(state.loading, false);
  assert.equal(state.error, 'Sin conexión');
  assert.equal(state.refreshError, '');
});

test('un fallo de refresco mantiene datos y avisa; un reintento conserva el contenido', () => {
  const base = createSeed();
  const previous = { key: 'request-1', scope: 'scope', base, data: base };
  const failed = failedPeriodResult(previous, {
    key: 'request-2',
    scope: 'scope',
    base,
    error: 'Sin conexión',
  });
  const state = periodDataState(failed, 'request-2', 'scope', base);
  assert.equal(state.data, base);
  assert.equal(state.loading, false);
  assert.equal(state.refreshing, false);
  assert.equal(state.error, '');
  assert.match(state.refreshError, /últimos datos recibidos/);
  const retry = periodDataState(failed, 'request-3', 'scope', base);
  assert.equal(retry.data, base);
  assert.equal(retry.refreshing, true);
  assert.equal(retry.refreshError, '');
});
