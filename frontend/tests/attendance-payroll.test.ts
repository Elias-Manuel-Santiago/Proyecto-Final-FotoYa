import assert from 'node:assert/strict';
import test from 'node:test';
import {
  attendancePayroll,
  attendanceCsv,
  payrollError,
  payrollInstant,
  type PayrollOptions,
} from '../src/domain/attendance-payroll';
import type { Attendance } from '../src/domain/models';
import { createSeed } from './support/seed';

const options: PayrollOptions = {
  from: '2026-10-01T00:00',
  to: '2026-11-01T00:00',
  rounding: 'none',
  incrementMinutes: 30,
  hourlyRate: '1000,00',
};
const shift = (
  checkIn = '2026-10-15T12:00:00Z',
  checkOut: string | null = '2026-10-15T19:50:00Z',
  closedAt: string | null = null,
): Attendance => ({
  id: '1',
  employeeId: 'seller',
  stationId: 'centro',
  date: '2026-10-15',
  checkIn,
  checkOut,
  closedAt,
});

test('7h50 pays exact time, eight hours rounded up or 7h30 rounded down in 30-minute steps', () => {
  const exact = attendancePayroll([shift()], options);
  assert.equal(exact.paidSeconds, 28200);
  assert.equal(exact.amountCents, 783333);
  for (const [rounding, minutes, cents] of [
    ['up', 480, 800000],
    ['down', 450, 750000],
  ] as const) {
    const result = attendancePayroll([shift()], { ...options, rounding });
    assert.equal(result.paidSeconds, minutes * 60);
    assert.equal(result.amountCents, cents);
  }
  assert.equal(
    attendancePayroll([shift()], {
      ...options,
      rounding: 'down',
      incrementMinutes: 15,
    }).paidSeconds,
    465 * 60,
  );
});

test('rounding applies per shift and exact multiples remain unchanged', () => {
  const records = [
    shift('2026-10-15T12:00:00Z', '2026-10-15T12:10:00Z'),
    { ...shift('2026-10-16T12:00:00Z', '2026-10-16T12:10:00Z'), id: '2' },
  ];
  assert.equal(
    attendancePayroll(records, { ...options, rounding: 'up' }).paidSeconds,
    3600,
  );
  assert.equal(
    attendancePayroll([shift('2026-10-15T12:00:00Z', '2026-10-15T13:00:00Z')], {
      ...options,
      rounding: 'up',
    }).paidSeconds,
    3600,
  );
});

test('range uses Argentina time, clips overnight shifts and treats the final timestamp as exclusive', () => {
  const range = {
    ...options,
    from: '2026-10-15T23:00',
    to: '2026-10-16T01:00',
  };
  assert.equal(payrollInstant(range.from), Date.parse('2026-10-16T02:00:00Z'));
  const result = attendancePayroll(
    [
      shift('2026-10-16 01:00:00', '2026-10-16 05:00:00'),
      shift('2026-10-16T04:00:00Z', '2026-10-16T05:00:00Z'),
    ],
    range,
  );
  assert.equal(result.rows.length, 1);
  assert.equal(result.seconds, 7200);
  assert.equal(result.amountCents, 200000);
});

test('open, missing checkout and reversed shifts remain identified and unpaid', () => {
  const result = attendancePayroll(
    [
      shift(undefined, null),
      { ...shift(undefined, null, '2026-10-16T03:00:00Z'), id: '2' },
      { ...shift(undefined, '2026-10-15T11:00:00Z'), id: '3' },
    ],
    options,
  );
  assert.equal(result.incomplete, 3);
  assert.equal(result.amountCents, 0);
  assert.deepEqual(
    result.rows.map((row) => row.status),
    ['Turno abierto', 'No hizo check-out', 'Horario inválido'],
  );
  assert(result.rows.every((row) => row.paidSeconds === null));
});

test('validates dates, timestamps, rate and rounding interval', () => {
  for (const patch of [
    { from: '2026-02-30T00:00' },
    { from: '2026-10-01T24:00' },
    { to: options.from },
    { hourlyRate: '-1' },
    { hourlyRate: '1.001' },
    { hourlyRate: '' },
    { rounding: 'up' as const, incrementMinutes: 0 },
    { rounding: 'down' as const, incrementMinutes: 1.5 },
  ])
    assert.notEqual(payrollError({ ...options, ...patch }), '');
  assert.equal(payrollError(options), '');
});

test('CSV contains original punches, adjusted minutes, totals and Excel-safe escaped text', () => {
  const data = createSeed();
  const employee = {
    ...data.employees[0],
    firstName: '=SUM(1;2)',
    lastName: 'Gómez "A"',
    dni: '00123',
  };
  const csv = attendanceCsv(employee, data, [shift()], {
    ...options,
    rounding: 'up',
  });
  assert(csv.startsWith('\uFEFFsep=;\r\n'));
  assert(csv.includes("'="));
  assert(csv.includes('Gómez ""A""'));
  assert(csv.includes('"480,00"'));
  assert(csv.includes('"8000,00"'));
  assert(csv.includes('"TOTAL"'));
  assert(csv.includes('"Hacia arriba"'));
});

test('a reported missing-checkout duration participates in rounding, payroll and CSV while original marks remain missing', () => {
  const record = {
    ...shift(undefined, null, '2026-10-16T03:00:00Z'),
    manualMinutes: 470,
    manualMinutesBy: 'secretary',
  };
  const result = attendancePayroll([record], { ...options, rounding: 'up' });
  assert.equal(result.seconds, 470 * 60);
  assert.equal(result.paidSeconds, 480 * 60);
  assert.equal(result.amountCents, 800000);
  assert.equal(result.incomplete, 0);
  assert.match(result.rows[0].status, /informada/);
  const data = createSeed();
  assert(
    attendanceCsv(data.employees[0], data, [record], options).includes(
      'Duración informada por Secretario',
    ),
  );
  assert.equal(record.checkOut, null);
  const actual = attendancePayroll(
    [{ ...record, checkOut: '2026-10-15T13:00:00Z' }],
    options,
  );
  assert.equal(actual.seconds, 3600);
});
