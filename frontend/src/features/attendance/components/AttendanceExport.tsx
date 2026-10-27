import { useState } from 'react';
import { Text, View } from 'react-native';
import { DateField } from '../../../components/filters/DateField';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Select } from '../../../components/ui/Select';
import { DataTable } from '../../../components/ui/DataTable';
import { Feedback } from '../../../components/ui/Feedback';
import { useTheme } from '../../../components/ui/theme';
import {
  attendanceCsv,
  attendancePayroll,
  hoursLabel,
  payrollError,
  type PayrollOptions,
} from '../../../domain/attendance-payroll';
import { businessDate, displayInstant } from '../../../domain/dates';
import { fullName, money } from '../../../domain/format';
import type { AppData, Attendance, Employee } from '../../../domain/models';
import { downloadCsv } from '../../../data/download-csv';
import { useAction } from '../../../hooks/useAction';

export function AttendanceExport({
  records,
  data,
  employee,
}: {
  records: Attendance[];
  data: AppData;
  employee: Employee;
}) {
  const { styles } = useTheme();
  const action = useAction();
  const [expanded, setExpanded] = useState(false);
  const [options, setOptions] = useState<PayrollOptions>(() => {
    const today = businessDate();
    return {
      from: `${today.slice(0, 7)}-01T00:00`,
      to: `${businessDate(new Date(Date.now() + 86400000))}T00:00`,
      rounding: 'none',
      incrementMinutes: 30,
      hourlyRate: '',
    };
  });
  const update = (patch: Partial<PayrollOptions>) => {
    setOptions((current) => ({ ...current, ...patch }));
    action.clear();
  };
  let error = payrollError(options);
  let result: ReturnType<typeof attendancePayroll> | undefined;
  if (!error) {
    try {
      result = attendancePayroll(records, options);
    } catch (cause) {
      error =
        cause instanceof Error ? cause.message : 'No se pudo calcular el pago.';
    }
  }
  return (
    <View style={{ gap: 12 }}>
      <Button
        title={expanded ? 'Cerrar exportación' : 'Preparar CSV y calcular pago'}
        secondary
        onPress={() => setExpanded(!expanded)}
      />
      {expanded && (
        <View style={[styles.card, { gap: 12 }]}>
          <Text style={styles.heading}>
            Horarios y pago de {fullName(employee)}
          </Text>
          <Text style={styles.muted}>
            Fechas y horas de Argentina. El límite final es exclusivo. Se toma
            sólo el tiempo dentro del rango y se redondea la duración de cada
            turno, sin modificar las marcaciones originales.
          </Text>
          <DateField
            label="Fecha de inicio"
            value={options.from.slice(0, 10)}
            onChange={(date) =>
              update({ from: `${date}T${options.from.slice(11)}` })
            }
          />
          <Field
            label="Hora de inicio (Argentina, HH:MM)"
            value={options.from.slice(11)}
            placeholder="00:00"
            maxLength={5}
            keyboardType="numbers-and-punctuation"
            onChangeText={(time) =>
              update({ from: `${options.from.slice(0, 10)}T${time}` })
            }
          />
          <DateField
            label="Fecha final"
            value={options.to.slice(0, 10)}
            onChange={(date) =>
              update({ to: `${date}T${options.to.slice(11)}` })
            }
          />
          <Field
            label="Hora final (Argentina, HH:MM)"
            value={options.to.slice(11)}
            placeholder="00:00"
            maxLength={5}
            keyboardType="numbers-and-punctuation"
            onChangeText={(time) =>
              update({ to: `${options.to.slice(0, 10)}T${time}` })
            }
          />
          <Select
            label="Redondeo de duración por turno"
            value={options.rounding}
            onChange={(value) =>
              update({ rounding: value as PayrollOptions['rounding'] })
            }
            options={[
              { value: 'none', label: 'Sin redondear' },
              { value: 'up', label: 'Hacia arriba' },
              { value: 'down', label: 'Hacia abajo' },
            ]}
          />
          {options.rounding !== 'none' && (
            <Field
              label="Redondear en intervalos de minutos"
              value={String(options.incrementMinutes || '')}
              keyboardType="number-pad"
              onChangeText={(value) =>
                update({ incrementMinutes: Number(value) })
              }
            />
          )}
          <Field
            label="Pago por hora (ARS)"
            value={options.hourlyRate}
            keyboardType="decimal-pad"
            placeholder="Ej.: 5000,00"
            onChangeText={(hourlyRate) => update({ hourlyRate })}
          />
          <Text style={styles.muted}>
            Por ejemplo: 7 h 50 min, en intervalos de 30 min, equivale a 8 h
            hacia arriba o 7 h 30 min hacia abajo. Los turnos abiertos, sin
            check-out o inválidos se incluyen identificados, sin calcularles
            pago.
          </Text>
          {!!error && !!options.hourlyRate && <Feedback error={error} />}
          {result && (
            <>
              <Text style={styles.text}>
                Tiempo real en rango: {hoursLabel(result.seconds)} · Tiempo a
                pagar: {hoursLabel(result.paidSeconds)}
              </Text>
              <Text style={styles.heading}>
                Total a pagar: {money(result.amountCents / 100)}
              </Text>
              {!!result.incomplete && (
                <Text style={styles.muted}>
                  {result.incomplete} turnos sin duración válida, excluidos del
                  total.
                </Text>
              )}
              <DataTable
                label="Vista previa del CSV y cálculo de pago"
                columns={[
                  'Entrada',
                  'Estado',
                  'Tiempo real',
                  'Tiempo a pagar',
                  'Importe',
                ]}
                rows={result.rows.map((row) => ({
                  key: row.record.id,
                  cells: [
                    displayInstant(row.record.checkIn),
                    row.status,
                    row.seconds === null ? '—' : hoursLabel(row.seconds),
                    row.paidSeconds === null
                      ? '—'
                      : hoursLabel(row.paidSeconds),
                    row.amountCents === null
                      ? '—'
                      : money(row.amountCents / 100),
                  ],
                }))}
              />
            </>
          )}
          <Feedback error={action.error} success={action.success} />
          <Button
            title="Descargar CSV para Excel"
            disabled={!!error || !result?.rows.length}
            busy={action.busy}
            onPress={() => {
              void action.run(async () => {
                await downloadCsv(
                  `horarios-${employee.id}-${options.from.slice(0, 10)}-${options.to.slice(0, 10)}.csv`,
                  attendanceCsv(employee, data, records, options),
                );
              }, 'CSV preparado.');
            }}
          />
        </View>
      )}
    </View>
  );
}
