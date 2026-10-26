import { validDate } from './dates';

// El calendario usa días locales: convertir mediante UTC desplazaría la fecha
// elegida en dispositivos con otra zona horaria.
export function dateToCalendar(value: string) {
  if (!validDate(value)) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return date;
}

export function dateFromCalendar(date: Date) {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
