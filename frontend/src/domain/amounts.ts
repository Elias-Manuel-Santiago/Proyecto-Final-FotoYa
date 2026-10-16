export function sumAmounts(values: number[]) {
  return (
    values.reduce((cents, value) => cents + Math.round(value * 100), 0) / 100
  );
}
