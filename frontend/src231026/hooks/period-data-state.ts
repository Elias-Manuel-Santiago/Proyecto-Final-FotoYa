import type { AppData } from '../domain/models';

export interface PeriodResult {
  key: string;
  scope: string;
  base: AppData;
  data?: AppData;
  error?: string;
}

// Un fallo de actualización conserva únicamente datos del mismo filtro y autorización.
export function failedPeriodResult(
  previous: PeriodResult | undefined,
  request: Omit<PeriodResult, 'data'>,
): PeriodResult {
  return {
    ...request,
    data: previous?.scope === request.scope ? previous.data : undefined,
  };
}

// Cambiar revisión o datos base refresca sin vaciar; cambiar alcance sí descarta lo anterior.
export function periodDataState(
  result: PeriodResult | undefined,
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
