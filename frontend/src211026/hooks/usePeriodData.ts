/**
 * @file
 * Consulta un snapshot por período después de 350 ms. Conserva datos al refrescar el mismo
 * filtro y descarta respuestas anteriores o de otro alcance.
 */
import { useCallback, useEffect, useState } from 'react';
import { useWorkspace } from '../providers/AppProvider';
import { periodError } from '../domain/dates';
import { errorMessage } from '../domain/format';
import type { Period } from '../domain/models';
import {
  failedPeriodResult,
  periodDataState,
  type PeriodResult,
} from './period-data-state';

// Cada consulta conserva su período; nunca muestra los datos de otro filtro.
// Consulta el período vigente y descarta resultados de filtros o datos base anteriores.
export function usePeriodData(period: Period, attendanceSelf = false) {
  const { data: base, employee, repository } = useWorkspace();
  const [revision, setRevision] = useState(0);
  // Período, revisión y consulta personal identifican qué respuesta puede mostrarse.
  const scope = JSON.stringify([
    period,
    attendanceSelf,
    employee.id,
    employee.roleId,
    employee.stationId,
    employee.permissions,
    employee.active,
    employee.working,
    employee.kioskMode,
  ]);
  const key = JSON.stringify([scope, revision]);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const [result, setResult] = useState<PeriodResult>();
  useEffect(() => {
    let active = true;
    const [requested, self] = JSON.parse(scope) as [Period, boolean];
    if (periodError(requested.from, requested.to)) return;

    const timer = setTimeout(() => {
      void repository
        .snapshot(requested, self)
        .then((data) => {
          if (active) setResult({ key, scope, base, data });
        })
        .catch((cause: unknown) => {
          if (active)
            setResult((previous) =>
              failedPeriodResult(previous, {
                key,
                scope,
                base,
                error: errorMessage(cause),
              }),
            );
        });
    }, 350);
    // Al cambiar filtros se cancela la espera y se impide publicar respuestas anteriores.
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key, scope, repository, base]);

  const state = periodDataState(result, key, scope, base);
  const invalid = periodError(period.from, period.to);

  // Mientras carga otro período se conserva el catálogo y se vacían las colecciones filtradas.
  const data = state.data ?? {
    ...base,
    counts: [],
    photos: [],
    sales: [],
    attendance: [],
    reports: [],
    summary: undefined,
  };

  return {
    data,
    loading: state.loading && !invalid,
    refreshing: state.refreshing && !invalid,
    error: state.error,
    refreshError: state.refreshError,
    reload,
  };
}
