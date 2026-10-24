/**
 * @file
 * Mantiene filtros de período de las pantallas. Centraliza cambios de fechas y puesto para
 * consultas y componentes de filtrado.
 */
import { useState } from 'react';
import { businessDate, periodError } from '../domain/dates';
import type { Period } from '../domain/models';

// Inicializa filtros en el día argentino actual y expone su validación.
export function usePeriod() {
  const [period, setPeriod] = useState<Period>({
    from: businessDate(),
    to: businessDate(),
    stationId: '',
    city: '',
    event: '',
  });
  // Aplica cambios parciales conservando el resto de los filtros.
  const update = (patch: Partial<Period>) =>
    setPeriod((current) => ({ ...current, ...patch }));
  return { period, update, error: periodError(period.from, period.to) };
}
