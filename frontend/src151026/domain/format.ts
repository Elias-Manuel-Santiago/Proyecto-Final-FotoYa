export function money(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(value);
}

export function fullName(employee: { firstName: string; lastName: string }) {
  return `${employee.firstName} ${employee.lastName}`;
}

export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'No se pudo completar la operación.';
}

let sequence = 0;
export function operationId(prefix: string) {
  sequence += 1;
  return `${prefix}-${Date.now()}-${sequence}`;
}
