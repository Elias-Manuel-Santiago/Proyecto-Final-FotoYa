import type { Attendance, AppData, Employee } from './models';
import { displayInstant, utcInstant, validDate } from './dates';
import { fullName } from './format';

export interface PayrollOptions {
  from: string;
  to: string;
  rounding: 'none' | 'up' | 'down';
  incrementMinutes: number;
  hourlyRate: string;
}

// Los límites del formulario son horas argentinas, independientes del dispositivo.
export function payrollInstant(value: string): number {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ||
    !validDate(value.slice(0, 10))
  )
    return NaN;
  const hours = Number(value.slice(11, 13)),
    minutes = Number(value.slice(14, 16));
  if (hours > 23 || minutes > 59) return NaN;
  return Date.parse(`${value}:00-03:00`);
}

export function payrollError(options: PayrollOptions): string {
  const from = payrollInstant(options.from),
    to = payrollInstant(options.to);
  if (!Number.isFinite(from) || !Number.isFinite(to))
    return 'Usá fecha y hora válidas: AAAA-MM-DDTHH:MM.';
  if (from >= to)
    return 'La fecha y hora final debe ser posterior a la inicial.';
  if (!['none', 'up', 'down'].includes(options.rounding))
    return 'Elegí un redondeo válido.';
  if (
    options.rounding !== 'none' &&
    (!Number.isInteger(options.incrementMinutes) ||
      options.incrementMinutes < 1 ||
      options.incrementMinutes > 1440)
  )
    return 'El intervalo debe ser de 1 a 1440 minutos.';
  if (!/^\d{1,9}([.,]\d{1,2})?$/.test(options.hourlyRate))
    return 'Ingresá un valor por hora válido, con hasta dos decimales.';
  return '';
}

export function attendancePayroll(
  records: Attendance[],
  options: PayrollOptions,
) {
  const error = payrollError(options);
  if (error) throw new Error(error);
  const from = payrollInstant(options.from),
    to = payrollInstant(options.to);
  const rateCents = Math.round(
    Number(options.hourlyRate.replace(',', '.')) * 100,
  );
  const stepSeconds = options.incrementMinutes * 60;
  const rows = records.flatMap((record) => {
    const start = Date.parse(utcInstant(record.checkIn));
    const end = record.checkOut ? Date.parse(utcInstant(record.checkOut)) : NaN;
    if (!Number.isFinite(start)) return [];
    const valid = Number.isFinite(end) && end > start;
    // Un turno abierto puede solaparse con el rango; se muestra sin inventar salida.
    if (start >= to || (valid && end <= from) || (!valid && start < from))
      return [];
    const seconds = valid
      ? (Math.min(end, to) - Math.max(start, from)) / 1000
      : null;
    const paidSeconds =
      seconds === null
        ? null
        : options.rounding === 'up'
          ? Math.ceil(seconds / stepSeconds) * stepSeconds
          : options.rounding === 'down'
            ? Math.floor(seconds / stepSeconds) * stepSeconds
            : seconds;
    const amountCents =
      paidSeconds === null
        ? null
        : Number(
            (BigInt(Math.round(paidSeconds * 1000)) * BigInt(rateCents) +
              1800000n) /
              3600000n,
          );
    if (amountCents !== null && !Number.isSafeInteger(amountCents))
      throw new Error(
        'El importe supera el máximo permitido. Reducí el período o el valor por hora.',
      );
    return [
      {
        record,
        seconds,
        paidSeconds,
        amountCents,
        status: valid
          ? 'Completo'
          : record.checkOut
            ? 'Horario inválido'
            : record.closedAt
              ? 'No hizo check-out'
              : 'Turno abierto',
      },
    ];
  });
  const amountCents = rows.reduce(
    (sum, row) => sum + (row.amountCents ?? 0),
    0,
  );
  if (!Number.isSafeInteger(amountCents))
    throw new Error(
      'El total supera el máximo permitido. Reducí el período o el valor por hora.',
    );
  return {
    rows,
    seconds: rows.reduce((sum, row) => sum + (row.seconds ?? 0), 0),
    paidSeconds: rows.reduce((sum, row) => sum + (row.paidSeconds ?? 0), 0),
    amountCents,
    incomplete: rows.filter((row) => row.paidSeconds === null).length,
  };
}

export function hoursLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

// CSV con BOM, separador y decimales compatibles con Excel en español.
export function attendanceCsv(
  employee: Employee,
  data: AppData,
  records: Attendance[],
  options: PayrollOptions,
) {
  const result = attendancePayroll(records, options);
  const decimal = (value: number) => value.toFixed(2).replace('.', ',');
  const cell = (value: string | number) => {
    const text = String(value);
    const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const rows: (string | number)[][] = [
    [
      'Empleado',
      'DNI',
      'Puesto',
      'Fecha',
      'Entrada (Argentina)',
      'Salida (Argentina)',
      'Estado',
      'Minutos reales en rango',
      'Minutos pagados',
      'Valor por hora',
      'Importe',
      'Desde (Argentina)',
      'Hasta (Argentina)',
      'Redondeo por turno',
      'Intervalo (minutos)',
    ],
    ...result.rows.map((row) => [
      fullName(employee),
      employee.dni,
      data.stations.find((station) => station.id === row.record.stationId)
        ?.name ?? row.record.stationId,
      row.record.date,
      displayInstant(row.record.checkIn),
      row.record.checkOut ? displayInstant(row.record.checkOut) : '',
      row.status,
      row.seconds === null ? '' : decimal(row.seconds / 60),
      row.paidSeconds === null ? '' : decimal(row.paidSeconds / 60),
      options.hourlyRate.replace('.', ','),
      row.amountCents === null ? '' : decimal(row.amountCents / 100),
      options.from,
      options.to,
      options.rounding === 'up'
        ? 'Hacia arriba'
        : options.rounding === 'down'
          ? 'Hacia abajo'
          : 'Sin redondear',
      options.incrementMinutes,
    ]),
    [
      'TOTAL',
      '',
      '',
      '',
      '',
      '',
      '',
      decimal(result.seconds / 60),
      decimal(result.paidSeconds / 60),
      '',
      decimal(result.amountCents / 100),
    ],
  ];
  return (
    '\uFEFFsep=;\r\n' +
    rows.map((row) => row.map(cell).join(';')).join('\r\n') +
    '\r\n'
  );
}
