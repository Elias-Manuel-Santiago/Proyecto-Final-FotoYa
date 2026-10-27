import { useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../ui/Button';
import { useTheme } from '../ui/theme';
import { displayDate, periodError } from '../../domain/dates';
import { useBusinessDate } from '../../hooks/useBusinessDate';
import type { Period, Station } from '../../domain/models';
import { useWorkspace } from '../../providers/AppProvider';
import { graphicScopes } from '../../domain/graphics';
import {
  periodScopeIds,
  periodScopePatch,
  scopeColumns,
} from '../../domain/filter-scopes';
import { DateField } from './DateField';
import { FilterSection } from './FilterSection';
import { ScopeColumns } from './ScopeColumns';

export function PeriodFilters({
  period,
  stations,
  onChange,
  allowScopeChange: requestedScopeChange = true,
  indicator,
  scopePicker,
  children,
  singleDay = false,
  allowAllTime = false,
}: {
  period: Period;
  stations: Station[];
  onChange: (value: Partial<Period>) => void;
  allowScopeChange?: boolean;
  indicator?: ReactNode;
  scopePicker?: ReactNode;
  children?: ReactNode;
  singleDay?: boolean;
  allowAllTime?: boolean;
}) {
  const { employee } = useWorkspace();
  const allowScopeChange =
    requestedScopeChange && employee.roleId !== 'manager';
  const { styles } = useTheme();
  const today = useBusinessDate();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(period);
  const error = periodError(draft.from, draft.to, draft.allTime);
  const change = (patch: Partial<Period>) =>
    setDraft((value) => ({ ...value, ...patch }));
  const presets = [
    { label: 'Hoy', from: today },
    ...(!singleDay
      ? [
          {
            label: 'Últimos 7 días',
            from: new Date(Date.parse(`${today}T12:00:00Z`) - 6 * 86400000)
              .toISOString()
              .slice(0, 10),
          },
          { label: 'Este mes', from: `${today.slice(0, 7)}-01` },
        ]
      : []),
  ];
  return (
    <FilterSection
      open={open}
      onOpenChange={setOpen}
      onOpen={() => setDraft(period)}
      summary={
        period.allTime
          ? 'Siempre'
          : singleDay
            ? displayDate(period.from)
            : `${displayDate(period.from)} — ${displayDate(period.to)}`
      }
    >
      {indicator}
      <Text style={styles.label}>Fecha</Text>
      <View style={styles.row}>
        {presets.map((preset) => (
          <Button
            key={preset.label}
            title={preset.label}
            secondary
            onPress={() =>
              change({ from: preset.from, to: today, allTime: false })
            }
          />
        ))}
        {allowAllTime && !singleDay && (
          <Button
            title="Siempre"
            secondary={!draft.allTime}
            onPress={() => change({ allTime: true })}
          />
        )}
      </View>
      {!draft.allTime && (
        <View style={[styles.row, { alignItems: 'flex-start' }]}>
          <View style={{ flexGrow: 1, flexBasis: 220 }}>
            <DateField
              label={singleDay ? 'Día' : 'Desde'}
              value={draft.from}
              onChange={(from) =>
                change(singleDay ? { from, to: from } : { from })
              }
            />
          </View>
          {!singleDay && (
            <View style={{ flexGrow: 1, flexBasis: 220 }}>
              <DateField
                label="Hasta"
                value={draft.to}
                onChange={(to) => change({ to })}
              />
            </View>
          )}
        </View>
      )}
      {scopePicker ??
        (allowScopeChange && stations.length > 0 && (
          <View style={styles.stack}>
            <Text style={styles.label}>Ciudades, eventos y puestos</Text>
            <Text style={styles.muted}>
              Sin selección se incluyen todos. Las opciones de cada columna se
              combinan con las de las demás columnas.
            </Text>
            <ScopeColumns
              columns={scopeColumns(graphicScopes(stations))}
              selected={periodScopeIds(draft)}
              onChange={(ids) => change(periodScopePatch(stations, ids))}
            />
          </View>
        ))}
      {children}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <View style={[styles.row, { justifyContent: 'center' }]}>
        <Button
          title="Aplicar filtros"
          disabled={!!error}
          onPress={() => {
            onChange(
              allowScopeChange
                ? draft
                : { from: draft.from, to: draft.to, allTime: draft.allTime },
            );
            setOpen(false);
          }}
        />
        <Button
          title="Restablecer fecha y alcance"
          secondary
          onPress={() =>
            setDraft({
              ...period,
              from: today,
              to: today,
              allTime: false,
              ...(allowScopeChange ? periodScopePatch(stations, []) : {}),
            })
          }
        />
      </View>
    </FilterSection>
  );
}
