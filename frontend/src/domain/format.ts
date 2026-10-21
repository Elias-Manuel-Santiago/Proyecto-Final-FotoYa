/**
 * @file
 * Formatea importes, porcentajes y errores para las vistas. Comparte presentación sin mezclar
 * HTTP con componentes.
 */
// Formatea un importe como pesos argentinos para su presentación.
export function money(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(value);
}

// Reúne nombre y apellido para las etiquetas compartidas.
export function fullName(employee: { firstName: string; lastName: string }) {
  return `${employee.firstName} ${employee.lastName}`;
}

// Convierte un error desconocido en un mensaje legible para la interfaz.
export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'No se pudo completar la operación.';
}

let sequence = 0;
// Genera un identificador local combinando prefijo, tiempo y secuencia.
export function operationId(prefix: string) {
  sequence += 1;
  return `${prefix}-${Date.now()}-${sequence}`;
}
