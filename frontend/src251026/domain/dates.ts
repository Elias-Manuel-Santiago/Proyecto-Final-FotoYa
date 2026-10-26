/**
 * @file
 * Separa día argentino de instantes UTC. Valida períodos inclusivos, formatea horarios y
 * calcula el siguiente cambio de día.
 */
export const businessTimeZone = 'America/Argentina/Buenos_Aires';

// Agrega la marca UTC a fechas del servidor sin zona explícita.
export function utcInstant(value: string) {
  return /(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    ? value
    : `${value.replace(' ', 'T')}Z`;
}

// Convierte un instante al día argentino con formato YYYY-MM-DD.
export function businessDate(value: Date | string = new Date()): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: businessTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  // Obtiene una parte de la fecha ya convertida a la zona de negocio.
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

// Convierte la fecha comercial a día/mes/año sin alterar el día.
export function displayDate(date: string) {
  return date.split('-').reverse().join('/');
}

// Calcula el tiempo restante hasta el próximo cambio de día en Argentina.
export function millisecondsUntilBusinessMidnight(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: businessTimeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(now);
  // Extrae un componente numérico de la hora argentina.
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return (
    (86400 - value('hour') * 3600 - value('minute') * 60 - value('second')) *
      1000 -
    now.getMilliseconds()
  );
}

// Presenta fecha y hora de un instante en horario argentino.
export function displayInstant(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: businessTimeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(utcInstant(value)));
}

// Valida el formato y la existencia real de la fecha de calendario.
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

// Comprueba el período y devuelve el mensaje que deben mostrar los filtros.
export function periodError(from: string, to: string) {
  if (!validDate(from) || !validDate(to))
    return 'Usá fechas válidas: AAAA-MM-DD.';
  if ((Date.parse(to) - Date.parse(from)) / 86400000 > 366)
    return 'El período máximo es de 367 días.';
  return from > to
    ? 'La fecha inicial debe ser anterior o igual a la final.'
    : '';
}

// Muestra la duración entre entrada y salida o indica que el turno sigue abierto.
export function duration(
  checkIn: string,
  checkOut: string | null,
  closedAt: string | null = null,
) {
  if (!checkOut && closedAt) return 'No calculable: sin check-out';
  if (!checkOut) return 'Turno abierto';
  const minutes = Math.floor(
    (Date.parse(checkOut) - Date.parse(checkIn)) / 60000,
  );
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
