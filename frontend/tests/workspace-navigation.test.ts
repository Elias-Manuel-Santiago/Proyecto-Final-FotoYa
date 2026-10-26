import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isNavigationActive,
  navigationFor,
} from '../src/components/navigation/workspace-navigation';
import type { Employee, RoleId } from '../src/domain/models';

const employee = (roleId: RoleId): Employee => ({
  id: 'test',
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
  dni: '',
  stationId: '',
  active: true,
  working: true,
  roleId,
});

test('la barra móvil conserva todas las secciones autorizadas de cada rol', () => {
  const roles: RoleId[] = [
    'owner',
    'manager',
    'secretary',
    'editor',
    'cameraman',
    'seller',
    'client',
  ];
  for (const role of roles) {
    const allowed = navigationFor(employee(role));
    const hrefs = allowed.map((item) => item.href);
    assert.ok(hrefs.includes('/profile'));
    assert.equal(new Set(hrefs).size, hrefs.length);
  }
});

test('las cuentas sin jornada requerida solo conservan Mi usuario', () => {
  const allowed = navigationFor({ ...employee('cameraman'), working: false });
  assert.deepEqual(
    allowed.map((item) => item.href),
    ['/profile'],
  );
});

test('una ficha o formulario mantiene activa su sección sin confundir prefijos', () => {
  assert.equal(isNavigationActive('/sales/new', '/sales'), true);
  assert.equal(isNavigationActive('/employees/123', '/employees'), true);
  assert.equal(isNavigationActive('/sales', '/sales'), true);
  assert.equal(isNavigationActive('/sales-other', '/sales'), false);
});

test('Dueño y Secretario navegan ciudades, eventos y puestos; otros roles no ven esos accesos', () => {
  for (const role of [
    'owner',
    'secretary',
    'manager',
    'editor',
    'cameraman',
    'seller',
    'client',
  ] as const) {
    const links = navigationFor(employee(role)).map((link) => link.href);
    for (const href of ['/cities', '/events', '/stations'] as const)
      assert.equal(links.includes(href), ['owner', 'secretary'].includes(role));
  }
});
