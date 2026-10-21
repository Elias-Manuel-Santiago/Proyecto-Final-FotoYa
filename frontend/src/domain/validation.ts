/**
 * @file
 * Valida formularios antes del envío. Complementa los contratos obligatorios del servidor
 * facilitando correcciones en la interfaz.
 */
import type { AppData, EmployeeInput } from './models';

// Comprueba datos y asignaciones del formulario antes de operar.
export function validateEmployee(input: EmployeeInput, data: AppData) {
  const station = data.stations.find((row) => row.id === input.stationId);
  const existing = data.employees.find((row) => row.id === input.id);
  if (station?.active === false && existing?.stationId !== input.stationId)
    throw new Error('Seleccioná un puesto activo.');
  if (!input.firstName.trim() || !input.lastName.trim())
    throw new Error('Completá nombre y apellido.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()))
    throw new Error('Ingresá un email válido.');
  if (
    !/^[\d.\s-]{5,20}$/.test(input.dni) ||
    !/^\d{5,15}$/.test(input.dni.replace(/[.\s-]/g, ''))
  )
    throw new Error('El DNI debe tener entre 5 y 15 dígitos.');
  if (
    !['owner', 'secretary', 'client'].includes(input.roleId) &&
    !data.stations.some((station) => station.id === input.stationId)
  )
    throw new Error('Seleccioná un puesto.');
  if (
    data.employees.some(
      (employee) =>
        employee.id !== input.id &&
        employee.email.toLowerCase() === input.email.trim().toLowerCase(),
    )
  ) {
    throw new Error('El email ya está registrado.');
  }
  if (
    data.employees.some(
      (employee) =>
        employee.id !== input.id && employee.dni === input.dni.trim(),
    )
  ) {
    throw new Error('El DNI ya está registrado.');
  }
}

// Valida cantidad y precio textual y devuelve los importes de la venta.
export function saleAmounts(quantityText: string, priceText: string) {
  if (!/^\d+$/.test(quantityText))
    throw new Error('Ingresá una cantidad entera mayor a cero.');
  const quantity = Number(quantityText);
  if (!Number.isSafeInteger(quantity) || quantity <= 0)
    throw new Error('Ingresá una cantidad entera mayor a cero.');
  const normalized = priceText.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized))
    throw new Error('Ingresá un precio válido con hasta 2 decimales.');
  const unitPrice = Number(normalized);
  if (
    !Number.isSafeInteger(Math.round(unitPrice * 100)) ||
    !Number.isSafeInteger(Math.round(unitPrice * 100) * quantity)
  )
    throw new Error('El importe es demasiado grande.');
  return {
    quantity,
    unitPrice,
    total: (Math.round(unitPrice * 100) * quantity) / 100,
  };
}
