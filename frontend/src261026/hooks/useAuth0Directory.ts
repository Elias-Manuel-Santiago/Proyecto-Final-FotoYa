import { useEffect, useState } from 'react';
import type { AppData, Auth0User, Employee } from '../domain/models';
import type { HttpFotoYaRepository } from '../data/http-repository';
import { errorMessage } from '../domain/format';

// Cada snapshot de MySQL renueva también el directorio externo del dueño.
export function useAuth0Directory(
  data: AppData | null,
  employee: Employee | null,
  repository: HttpFotoYaRepository,
) {
  const [result, setResult] = useState<{
    ownerId: string;
    users: Auth0User[];
    error: string;
  }>({ ownerId: '', users: [], error: '' });
  const ownerId = employee?.roleId === 'owner' ? employee.id : '';
  useEffect(() => {
    if (!ownerId || !data) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    async function load() {
      try {
        const response = await repository.auth0Users();
        if (cancelled) return;
        if (response.status === 'complete') {
          setResult({ ownerId, users: response.users, error: '' });
        } else if (Date.now() - started < 120000) {
          timer = setTimeout(() => void load(), 1500);
        } else {
          throw new Error('No se pudo actualizar el directorio de servicios.');
        }
      } catch (cause) {
        if (!cancelled)
          setResult((previous) => ({
            ownerId,
            users: previous.ownerId === ownerId ? previous.users : [],
            error: errorMessage(cause),
          }));
      }
    }
    void load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [data, ownerId, repository]);
  return {
    auth0Users: ownerId && result.ownerId === ownerId ? result.users : [],
    directoryError: ownerId && result.ownerId === ownerId ? result.error : '',
  };
}
