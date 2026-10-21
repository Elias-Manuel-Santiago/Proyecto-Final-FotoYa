import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  businessDate,
  millisecondsUntilBusinessMidnight,
} from '../domain/dates';

export function useBusinessDate() {
  const [date, setDate] = useState(() => businessDate());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setDate(businessDate());
        schedule();
      }, millisecondsUntilBusinessMidnight() + 10);
    };
    schedule();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setDate(businessDate());
        schedule();
      }
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);
  return date;
}
