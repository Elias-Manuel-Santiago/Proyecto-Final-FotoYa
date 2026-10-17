import { useState } from 'react';
import { businessDate, periodError } from '../domain/dates';
import type { Period } from '../domain/models';

export function usePeriod() {
  const [period, setPeriod] = useState<Period>({
    from: businessDate(),
    to: businessDate(),
    stationId: '',
    city: '',
    event: '',
  });
  const update = (patch: Partial<Period>) =>
    setPeriod((current) => ({ ...current, ...patch }));
  return { period, update, error: periodError(period.from, period.to) };
}
