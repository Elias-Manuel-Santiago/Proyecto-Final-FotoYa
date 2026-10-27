/**
 * @file
 * Mantiene filtros de período de las pantallas. Centraliza cambios de fechas y puesto para
 * consultas y componentes de filtrado.
 */
import { useState } from 'react';
import { businessDate, periodError } from '../domain/dates';
import type { Period } from '../domain/models';
import { useWorkspace } from '../providers/AppProvider';

// Inicializa filtros en el día argentino actual y expone su validación.
export function usePeriod() {
  const { employee } = useWorkspace();
  const [filters, setPeriod] = useState<Period>({
    from: businessDate(),
    to: businessDate(),
    stationId: '',
    city: '',
    event: '',
  });
  const period =
    employee.roleId === 'manager'
      ? {
          ...filters,
          stationId: employee.stationId,
          city: '',
          event: '',
          stationIds: undefined,
          scopeIds: undefined,
        }
      : filters;
  // Aplica cambios parciales conservando el resto de los filtros.
  const update = (patch: Partial<Period>) =>
    setPeriod((current) => ({ ...current, ...patch }));
  return {
    period,
    update,
    error: periodError(period.from, period.to, period.allTime),
  };
}
