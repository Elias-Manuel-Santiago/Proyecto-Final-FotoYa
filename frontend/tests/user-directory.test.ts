import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Auth0User, Employee } from '../src/domain/models';
import {
  authenticationLabel,
  filterUserDirectory,
  groupUserDirectory,
  userDirectory,
} from '../src/domain/user-directory';

const employee: Employee = {
  id: '1',
  firstName: 'Ana',
  lastName: 'Pérez',
  email: 'ana@example.com',
  dni: '12345678',
  roleId: 'client',
  stationId: '',
  active: true,
  auth0Subject: 'amazon|123',
  authenticationProviders: ['amazon'],
};
const external: Auth0User = {
  id: 'amazon|123',
  firstName: 'Ana',
  lastName: '',
  email: 'ana@example.com',
  active: true,
  identities: [{ subject: 'amazon|123', provider: 'amazon' }],
  authenticationProviders: ['amazon'],
};

test('agrupa correos sin distinguir mayúsculas y conserva fichas y servicios', () => {
  const local = {
    ...employee,
    roleId: 'seller' as const,
    auth0Subject: null,
    authenticationProviders: ['local'],
  };
  const google = {
    ...external,
    id: 'google|456',
    email: ' ANA@example.com ',
    identities: [],
    authenticationProviders: ['google-oauth2', 'amazon'],
  };
  const rows = groupUserDirectory(userDirectory([local], [external, google]));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].localUser?.id, local.id);
  assert.equal(rows[0].accounts?.length, 3);
  assert.deepEqual(rows[0].authenticationProviders, [
    'local',
    'amazon',
    'google-oauth2',
  ]);
});

test('no agrupa cuentas sin correo ni correos diferentes', () => {
  const other = { ...external, id: 'other', email: 'other@example.com' };
  const missing = { ...external, id: 'missing', email: '' };
  const missingToo = { ...missing, id: 'missing-too', email: ' ' };
  assert.equal(
    groupUserDirectory(
      userDirectory([], [external, other, missing, missingToo]),
    ).length,
    4,
  );
});

test('el directorio de empleados excluye clientes locales y vinculados a Auth0', () => {
  const actor = { ...employee, id: 'owner', roleId: 'owner' as const };
  const seller = {
    ...employee,
    id: 'seller',
    roleId: 'seller' as const,
    auth0Subject: null,
  };
  const localClient = { ...employee, id: 'local-client', auth0Subject: null };
  const rows = userDirectory([employee, localClient, seller], [external]);
  const visible = filterUserDirectory(rows, actor, {
    role: '',
    stationId: '',
    status: 'all',
    search: '',
  });
  assert.deepEqual(
    visible.map((row) => row.localUser?.id),
    ['seller'],
  );
});

test('la cuenta Auth0 vinculada aparece una vez y conserva la ficha local', () => {
  const rows = userDirectory([employee], [external]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].localUser?.id, '1');
  assert.deepEqual(rows[0].authenticationProviders, ['amazon']);
});

test('identidades secundarias vinculadas se reconocen sin fusionar cuentas por correo', () => {
  const linked = {
    ...external,
    id: 'google-oauth2|456',
    identities: [
      ...external.identities,
      { subject: 'google-oauth2|456', provider: 'google-oauth2' },
    ],
    authenticationProviders: ['google-oauth2', 'amazon'],
  };
  const unrelated = {
    ...external,
    id: 'github|789',
    identities: [{ subject: 'github|789', provider: 'github' }],
    authenticationProviders: ['github'],
  };
  const rows = userDirectory([employee], [linked, unrelated]);
  assert.equal(rows.length, 2);
  assert.equal(rows[1].localUser, undefined);
  assert.equal(
    authenticationLabel(rows[0].authenticationProviders),
    'Google, Amazon',
  );
});

test('cuentas externas bloqueadas y sin correo conservan su estado, las locales usan contraseña', () => {
  const rows = userDirectory(
    [{ ...employee, auth0Subject: null, authenticationProviders: ['local'] }],
    [{ ...external, active: false, email: '' }],
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[1].active, false);
  assert.equal(rows[1].email, '');
  assert.equal(
    authenticationLabel(rows[0].authenticationProviders),
    'Correo y contraseña (Foto Ya)',
  );
});

test('oculta la cuenta propia después de vincular Auth0 y combina filtros de rol y puesto', () => {
  for (const roleId of ['owner', 'secretary', 'manager'] as const) {
    const actor = { ...employee, roleId, stationId: '1', working: true };
    const other = {
      ...employee,
      id: '2',
      roleId: 'seller' as const,
      stationId: '1',
      auth0Subject: null,
    };
    const elsewhere = { ...other, id: '3', stationId: '2' };
    const rows = userDirectory([actor, other, elsewhere], [external]);
    const filters = { role: '', stationId: '', status: 'all', search: '' };
    const visible = filterUserDirectory(rows, actor, filters);
    assert(
      !visible.some((row) => row.localUser?.id === actor.id || !row.localUser),
    );
    assert.deepEqual(
      filterUserDirectory(rows, actor, {
        ...filters,
        role: 'seller',
        stationId: '1',
      }).map((row) => row.localUser?.id),
      ['2'],
    );
    assert.equal(
      filterUserDirectory(rows, actor, { ...filters, role: 'editor' }).length,
      0,
    );
  }
});

test('secretary directory excludes owner accounts even when they share an email with another employee', () => {
  const owner = { ...employee, id: 'owner', roleId: 'owner' as const };
  const seller = { ...employee, id: 'seller', roleId: 'seller' as const };
  const secretary = {
    ...employee,
    id: 'secretary',
    roleId: 'secretary' as const,
  };
  const rows = filterUserDirectory(
    userDirectory([owner, seller], []),
    secretary,
    { role: '', stationId: '', status: 'all', search: '' },
  );
  assert.equal(rows.length, 1);
  assert.deepEqual(
    rows[0].accounts?.map((row) => row.localUser?.id),
    ['seller'],
  );
});
