/**
 * @file
 * Verifica usuarios y asistencia. Cubre alcance por rol/puesto y transformaciones de datos.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { MockFotoYaRepository } from './support/mock-repository';
import { businessDate, duration, validDate } from '../src/domain/dates';
import { repository } from './fixtures';

const newEmployee = {
  firstName: 'Nuevo',
  lastName: 'Empleado',
  email: 'nuevo@example.com',
  dni: '40123456',
  roleId: 'seller' as const,
  stationId: 'centro',
};

test('alta, edición y baja conservan el historial; email y DNI son únicos', async () => {
  const repo = repository();
  await repo.saveEmployee('manager', newEmployee);
  await assert.rejects(repo.saveEmployee('manager', newEmployee), /email/);
  await assert.rejects(
    repo.saveEmployee('manager', { ...newEmployee, email: 'otro@example.com' }),
    /DNI/,
  );
  const employee = (await repo.snapshot()).employees.find(
    (row) => row.email === newEmployee.email,
  )!;
  await repo.saveEmployee('manager', { ...employee, firstName: 'Editado' });
  assert.equal(
    (await repo.snapshot()).employees.find((row) => row.id === employee.id)
      ?.firstName,
    'Editado',
  );
  await repo.setEmployeeActive('manager', 'photographer', false);
  const data = await repo.snapshot();
  assert.equal(
    data.employees.find((row) => row.id === 'photographer')?.active,
    false,
  );
  assert.equal(data.attendance.length, 1);
  await assert.rejects(repo.checkIn('photographer', 'new-turn'), /activo/);
  await repo.setEmployeeActive('manager', 'photographer', true);
  assert.equal(
    (await repo.snapshot()).employees.find((row) => row.id === 'photographer')
      ?.active,
    true,
  );
});

test('encargado no gestiona otro puesto o roles globales y secretario solo consulta', async () => {
  const repo = repository();
  await assert.rejects(
    repo.saveEmployee('manager', { ...newEmployee, stationId: 'parque' }),
    /alcance/,
  );
  await assert.rejects(
    repo.saveEmployee('manager', { ...newEmployee, roleId: 'owner' }),
    /rol/,
  );
  await assert.rejects(
    repo.setEmployeeActive('manager', 'owner', false),
    /administrar/,
  );
  await assert.rejects(repo.saveEmployee('secretary', newEmployee), /permiso/);
  await assert.rejects(
    repo.setEmployeeActive('owner', 'owner', false),
    /propio/,
  );
});

test('un turno puede cruzar medianoche manteniendo día y puesto de la entrada', async () => {
  let clock = new Date('2026-10-16T02:00:00Z'); // 15/10 a las 23:00 en Argentina.
  const repo = new MockFotoYaRepository({ now: () => clock });
  await repo.checkIn('seller', 'night-shift');
  await repo.checkIn('seller', 'night-shift');
  await assert.rejects(repo.checkIn('seller', 'duplicate-shift'), /abierto/);
  clock = new Date('2026-10-16T04:00:00Z');
  await repo.checkOut('seller', 'night-shift');
  await repo.checkOut('seller', 'night-shift');
  const record = (await repo.snapshot()).attendance.find(
    (row) => row.id === 'night-shift',
  )!;
  assert.equal(record.date, '2026-10-15');
  assert.equal(record.stationId, 'centro');
  assert.equal(duration(record.checkIn, record.checkOut), '2 h 0 min');
  await repo.checkIn('seller', 'second-shift');
  assert.equal(
    (await repo.snapshot()).attendance.filter(
      (row) => row.employeeId === 'seller',
    ).length,
    2,
  );
});

test('solo el empleado cierra su turno y se rechaza una salida anterior', async () => {
  let clock = new Date('2026-10-15T15:00:00Z');
  const repo = new MockFotoYaRepository({ now: () => clock });
  await repo.checkIn('seller', 'own-shift');
  await assert.rejects(repo.checkOut('manager', 'own-shift'), /no existe/);
  clock = new Date('2026-10-15T14:00:00Z');
  await assert.rejects(repo.checkOut('seller', 'own-shift'), /anterior/);
  assert.equal(
    (await repo.snapshot()).attendance.find((row) => row.id === 'own-shift')
      ?.checkOut,
    null,
  );
});

test('fechas inválidas no se normalizan silenciosamente y la fecha usa la zona del negocio', () => {
  assert.equal(validDate('2026-02-30'), false);
  assert.equal(validDate('2026-10-15'), true);
  assert.equal(businessDate('2026-10-16T02:00:00Z'), '2026-10-15');
  assert.equal(duration('2026-10-15T10:00:00Z', null), 'Turno abierto');
  assert.equal(
    duration('2026-10-15T10:00:00Z', null, '2026-10-15T22:00:00Z'),
    'No calculable: sin check-out',
  );
});

test('una lectura no permite modificar el repositorio ni genera asistencia', async () => {
  const repo = repository();
  const data = await repo.snapshot();
  data.employees[0].active = false;
  data.attendance.splice(0);
  const next = await repo.snapshot();
  assert.equal(next.employees[0].active, true);
  assert.equal(next.attendance.length, 1);
});
