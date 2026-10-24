/**
 * @file
 * Suma importes de presentación acumulando centavos redondeados. El backend calcula y persiste
 * los importes definitivos de ventas.
 */
// Suma importes redondeados a centavos para reducir errores de coma flotante.
export function sumAmounts(values: number[]) {
  return (
    values.reduce((cents, value) => cents + Math.round(value * 100), 0) / 100
  );
}
