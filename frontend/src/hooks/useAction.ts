import { useRef, useState } from 'react';
import { errorMessage } from '../domain/format';

export function useAction() {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
