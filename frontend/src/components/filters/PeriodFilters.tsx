import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Field } from '../ui/Field';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { useTheme } from '../ui/theme';
import { displayDate, periodError } from '../../domain/dates';
import { useBusinessDate } from '../../hooks/useBusinessDate';
import type { Period, Station } from '../../domain/models';
import { useWorkspace } from '../../providers/AppProvider';
export function PeriodFilters({
  period,
  stations,
  onChange,
  extended = false,
  allowScopeChange: requestedScopeChange = true,
}: {
  period: Period;
  stations: Station[];
  onChange: (value: Partial<Period>) => void;
  extended?: boolean;
  allowScopeChange?: boolean;
}) {
  const { employee } = useWorkspace();
  const allowScopeChange =
    requestedScopeChange && employee.roleId !== 'manager';
  const { colors, styles } = useTheme();
  const today = useBusinessDate();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(period);
  const error = periodError(draft.from, draft.to);
  const change = (value: Partial<Period>) =>
    setDraft((current) => ({ ...current, ...value }));
  const scopedStations = stations.filter(
    (row) =>
      (!draft.city || (row.cityId ?? row.city) === draft.city) &&
      (!draft.event || (row.eventId ?? row.event) === draft.event),
  );
  const presets = [
    { label: 'Hoy', from: today },
    {
      label: 'Últimos 7 días',
      from: new Date(Date.parse(`${today}T12:00:00Z`) - 6 * 86400000)
        .toISOString()
        .slice(0, 10),
    },
    { label: 'Este mes', from: `${today.slice(0, 7)}-01` },
  ];
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? 'Cerrar filtros' : 'Abrir filtros'}
        onPress={() => {
          if (!open) setDraft(period);
          setOpen(!open);
        }}
        style={[styles.row, { minHeight: 44, justifyContent: 'space-between' }]}
      >
        <View style={styles.row}>
          <Icon name="filtrar" />
          <Text style={styles.label}>Filtros</Text>
        </View>
        <Text style={styles.muted}>
          {displayDate(period.from)} — {displayDate(period.to)}
        </Text>
        <Text style={{ color: colors.primary, fontWeight: '600' }}>
          {open ? 'Cerrar' : 'Editar'}
        </Text>
      </Pressable>
      {allowScopeChange &&
        !!(period.stationId || period.city || period.event) && (
          <Text style={styles.muted}>
            {[
              stations.find((s) => s.id === period.stationId)?.name,
              stations.find((s) => (s.cityId ?? s.city) === period.city)?.city,
              stations.find((s) => (s.eventId ?? s.event) === period.event)
                ?.event,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        )}
      {open && (
        <>
          <View style={styles.row}>
            {presets.map((preset) => (
              <Button
                key={preset.label}
                title={preset.label}
                secondary
                onPress={() => change({ from: preset.from, to: today })}
              />
            ))}
          </View>
          <View style={[styles.row, { alignItems: 'flex-start' }]}>
            <View style={{ flexGrow: 1, flexBasis: 220 }}>
              <Field
                label="Desde"
                accessibilityHint="Fecha en formato AAAA-MM-DD"
                placeholder="AAAA-MM-DD"
                value={draft.from}
                onChangeText={(from) => change({ from })}
                autoCapitalize="none"
                maxLength={10}
              />
            </View>
            <View style={{ flexGrow: 1, flexBasis: 220 }}>
              <Field
                label="Hasta"
                accessibilityHint="Fecha en formato AAAA-MM-DD"
                placeholder="AAAA-MM-DD"
                value={draft.to}
                onChangeText={(to) => change({ to })}
                autoCapitalize="none"
                maxLength={10}
              />
            </View>
          </View>
          {allowScopeChange && (
            <View style={[styles.row, { alignItems: 'flex-start' }]}>
              {extended && (
                <>
                  <View style={{ flexGrow: 1, flexBasis: 220 }}>
                    <Select
                      label="Ciudad"
                      value={draft.city ?? ''}
                      options={[
                        { value: '', label: 'Todas las ciudades' },
                        ...Array.from(
                          new Map(
                            stations.map((s) => [s.cityId ?? s.city, s.city]),
                          ).entries(),
                        ).map(([value, label]) => ({ value, label })),
                      ]}
                      onChange={(city) => change({ city, stationId: '' })}
                    />
                  </View>
                  <View style={{ flexGrow: 1, flexBasis: 220 }}>
                    <Select
                      label="Evento"
                      value={draft.event ?? ''}
                      options={[
                        { value: '', label: 'Todos los eventos' },
                        ...Array.from(
                          new Map(
                            stations
                              .filter((s) => s.event)
                              .map((s) => [s.eventId ?? s.event, s.event]),
                          ).entries(),
                        ).map(([value, label]) => ({ value, label })),
                      ]}
                      onChange={(event) => change({ event, stationId: '' })}
                    />
                  </View>
                </>
              )}
              {stations.length > 1 && (
                <View style={{ flexGrow: 1, flexBasis: 220 }}>
                  <Select
                    label="Puesto"
                    value={draft.stationId}
                    options={[
                      { value: '', label: 'Todos los puestos' },
                      ...scopedStations.map((s) => ({
                        value: s.id,
                        label: s.name,
                      })),
                    ]}
                    onChange={(stationId) => change({ stationId })}
                  />
                </View>
              )}
            </View>
          )}
          {!!error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
          <View style={styles.row}>
            <Button
              title="Aplicar filtros"
              disabled={!!error}
              onPress={() => {
                onChange(
                  allowScopeChange ? draft : { from: draft.from, to: draft.to },
                );
                setOpen(false);
              }}
            />
            <Button
              title="Restablecer"
              secondary
              onPress={() =>
                setDraft({
                  ...period,
                  from: today,
                  to: today,
                  ...(allowScopeChange
                    ? { stationId: '', city: '', event: '' }
                    : {}),
                })
              }
            />
          </View>
        </>
      )}
    </View>
  );
}
