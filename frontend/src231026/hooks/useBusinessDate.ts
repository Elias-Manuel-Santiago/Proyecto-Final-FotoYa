/**
 * @file
 * Actualiza el día argentino al cruzar medianoche o reactivar la aplicación. Permite reiniciar
 * ventas cuando cambia el día comercial.
 */
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  businessDate,
  millisecondsUntilBusinessMidnight,
} from '../domain/dates';

// Mantiene el día actualizado al llegar medianoche o reactivarse la aplicación.
export function useBusinessDate() {
  const [date, setDate] = useState(() => businessDate());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    // Programa el próximo cambio de fecha y vuelve a calcularlo después de medianoche.
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
