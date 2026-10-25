import type { AppData } from '../domain/models';

export interface PeriodResult<T = AppData> {
  key: string;
  scope: string;
  base: AppData;
  data?: T;
  error?: string;
}

// Un fallo de actualización conserva únicamente datos del mismo filtro y autorización.
export function failedPeriodResult<T>(
  previous: PeriodResult<T> | undefined,
  request: Omit<PeriodResult<T>, 'data'>,
): PeriodResult<T> {
  return {
    ...request,
    data: previous?.scope === request.scope ? previous.data : undefined,
  };
}

// Cambiar revisión o datos base refresca sin vaciar; cambiar alcance sí descarta lo anterior.
export function periodDataState<T>(
  result: PeriodResult<T> | undefined,
  key: string,
  scope: string,
  base: AppData,
) {
  const current = result?.key === key && result.base === base;
  const data = result?.scope === scope ? result.data : undefined;
  return {
    data,
    loading: !current && !data,
    refreshing: !current,
    error: current && !data ? (result?.error ?? '') : '',
    refreshError:
      current && data && result?.error
        ? `No se pudo actualizar. Se muestran los últimos datos recibidos. ${result.error}`
        : '',
  };
}
