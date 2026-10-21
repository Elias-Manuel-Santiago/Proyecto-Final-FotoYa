/**
 * @file
 * Ejecuta acciones evitando envíos simultáneos desde el hook. Expone estado ocupado y
 * mensajes, y captura errores para mostrarlos.
 */
import { useRef, useState } from 'react';
import { errorMessage } from '../domain/format';

// Comparte bloqueo de envíos y mensajes de resultado para acciones de una pantalla.
export function useAction() {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Ignora ejecuciones simultáneas y libera el estado ocupado al resolver o fallar.
  async function run(action: () => Promise<void>, message = '') {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await action();
      setSuccess(message);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return {
    busy,
    error,
    success,
    run,
    clear: () => {
      setError('');
      setSuccess('');
    },
  };
}
