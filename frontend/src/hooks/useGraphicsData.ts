import { useEffect, useState } from 'react';
import type { GraphicsData } from '../domain/graphics';
import type { Period } from '../domain/models';
import { periodError } from '../domain/dates';
import { errorMessage } from '../domain/format';
import { useWorkspace } from '../providers/AppProvider';
import {
  failedPeriodResult,
  periodDataState,
  type PeriodResult,
} from './period-data-state';

export function useGraphicsData(period: Period, day?: string) {
  const { employee, repository, data: base } = useWorkspace();
  const [revision, setRevision] = useState(0);
  const scope = JSON.stringify([
    period.from,
    period.to,
    period.stationId,
    day,
    employee.id,
    employee.roleId,
    employee.stationId,
    employee.permissions,
    employee.active,
    employee.working,
    employee.kioskMode,
  ]);
  const key = JSON.stringify([scope, revision]);
  const [result, setResult] = useState<PeriodResult<GraphicsData>>();
  const invalid = periodError(period.from, period.to);
  useEffect(() => {
    if (invalid) return;
    let active = true;
    const [from, to, stationId, requestedDay] = JSON.parse(scope) as [
      string,
      string,
      string,
      string | undefined,
    ];
    const timer = setTimeout(() => {
      void repository
        .graphics({ from, to, stationId }, requestedDay)
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
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key, scope, base, repository, invalid]);
  const state = periodDataState(result, key, scope, base);
  return {
    data: invalid ? undefined : state.data,
    error: invalid || state.error || state.refreshError,
    loading: !invalid && state.loading,
    refreshing: !invalid && state.refreshing,
    reload: () => setRevision((v) => v + 1),
  };
}
