import { useCallback, useEffect, useState } from 'react';
import { useWorkspace } from '../providers/AppProvider';
import { periodError } from '../domain/dates';
import { errorMessage } from '../domain/format';
import type { AppData, Period } from '../domain/models';

// Cada consulta conserva su período; nunca muestra los datos de otro filtro.
export function usePeriodData(period: Period, attendanceSelf = false) {
  const { data: base, repository } = useWorkspace();
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify([period, revision, attendanceSelf]);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const [result, setResult] = useState<{
    key: string;
    base: AppData;
    data?: AppData;
    error?: string;
  }>();
  useEffect(() => {
    let active = true;
    const [requested] = JSON.parse(key) as [Period, number, boolean];
    if (periodError(requested.from, requested.to)) return;
    
    const timer = setTimeout(() => {
      void repository
        .snapshot(requested, attendanceSelf)
        .then((data) => {
          if (active) setResult({ key, base, data });
        })
        .catch((cause: unknown) => {
          if (active) setResult({ key, base, error: errorMessage(cause) });
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key, repository, base, attendanceSelf, revision]);

  const current =
    result?.key === key && result.base === base ? result : undefined;

  const data = current?.data ?? {
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
    loading: !current && !periodError(period.from, period.to),
    error: current?.error ?? '',
    reload,
  };
}
