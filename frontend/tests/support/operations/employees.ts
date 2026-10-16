import type {
  AppData,
  Employee,
  EmployeeInput,
} from '../../../src/domain/models';
import { operationId } from '../../../src/domain/format';
import {
  assignableRoles,
  requirePermission,
  requireStation,
} from '../../../src/domain/permissions';
import { validateEmployee } from '../../../src/domain/validation';

export function saveEmployee(
  data: AppData,
  actor: Employee,
  input: EmployeeInput,
) {
  requirePermission(actor, 'employees.manage');
  requireStation(actor, input.stationId);
  const existing = input.id
    ? data.employees.find((row) => row.id === input.id)
    : undefined;
  if (input.id && !existing) throw new Error('El empleado no existe.');
  if (existing) requireManageable(actor, existing);
  if (!assignableRoles(actor).includes(input.roleId))
    throw new Error('No podés asignar este rol.');
  if (
    actor.id === input.id &&
    (input.roleId !== actor.roleId || input.stationId !== actor.stationId)
  ) {
    throw new Error('No podés modificar tu propio rol o puesto.');
  }
  validateEmployee(input, data);
  const employee: Employee = {
    ...input,
    id: existing?.id ?? operationId('employee'),
    active: existing?.active ?? true,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim().toLowerCase(),
    dni: input.dni.trim(),
  };
  data.employees = existing
    ? data.employees.map((row) => (row.id === existing.id ? employee : row))
    : [...data.employees, employee];
}

function requireManageable(actor: Employee, employee: Employee) {
  requireStation(actor, employee.stationId);
  if (!assignableRoles(actor).includes(employee.roleId))
    throw new Error('No podés administrar este usuario.');
}

export function setEmployeeActive(
  data: AppData,
  actor: Employee,
  employeeId: string,
  active: boolean,
) {
  requirePermission(actor, 'employees.manage');
  const employee = data.employees.find((row) => row.id === employeeId);
  if (!employee) throw new Error('El empleado no existe.');
  requireManageable(actor, employee);
  if (employeeId === actor.id)
    throw new Error('No podés dar de baja tu propio usuario.');
  data.employees = data.employees.map((row) =>
    row.id === employeeId ? { ...row, active } : row,
  );
}
