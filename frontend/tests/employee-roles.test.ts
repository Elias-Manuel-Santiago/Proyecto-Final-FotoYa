import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assignableRoles,
  can,
  roleLabels,
  rolePermissions,
} from '../src/domain/permissions';
import { createSeed } from './support/seed';

test('Camarógrafo conserva las consultas del vendedor, requiere jornada y no vende ni edita fotos', () => {
  const seller = createSeed().employees.find((row) => row.roleId === 'seller')!;
  const cameraman = { ...seller, roleId: 'cameraman' as const };
  assert.equal(roleLabels.editor, 'Editor');
  assert.equal(roleLabels.cameraman, 'Camarógrafo');
  assert.deepEqual(
    rolePermissions.cameraman,
    rolePermissions.seller.filter(
      (permission) => permission !== 'sales.create',
    ),
  );
  for (const permission of rolePermissions.cameraman)
    assert.equal(can(cameraman, permission), true);
  for (const permission of [
    'sales.create',
    'photos.upload',
    'photos.assign',
    'employees.manage',
  ] as const)
    assert.equal(can(cameraman, permission), false);
  assert.equal(can({ ...cameraman, working: false }, 'sales.read'), false);
  for (const roleId of ['owner', 'manager'] as const) {
    const assignable = assignableRoles({ ...seller, roleId });
    assert(assignable.includes('editor'));
    assert(assignable.includes('cameraman'));
  }
});
