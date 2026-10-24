/**
 * @file
 * Coordina sesión, perfil y datos sobre el repositorio HTTP. Restaura token, refresca al
 * reactivar y consulta jornada/kiosco cada quince segundos.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import type { AppData, Employee } from '../domain/models';
import { ApiClient } from '../data/api-client';
import { HttpFotoYaRepository } from '../data/http-repository';
import { createSessionStorage } from '../data/session-storage';
import { errorMessage } from '../domain/format';

interface AppContextValue {
  data: AppData | null;
  employee: Employee | null;
  loading: boolean;
  restoring: boolean;
  error: string;
  login: (email: string, password: string) => Promise<void>;
  acceptSession: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  restoreSession: () => Promise<void>;
  logoutCheckIn: (password: string) => Promise<void>;
  assignCheckIn: (stationId: string, password: string) => Promise<void>;
  repository: HttpFotoYaRepository;
}

const AppContext = createContext<AppContextValue | null>(null);

// Temporal: cambiar a true para volver a recuperar la cuenta guardada al iniciar.
const RESTORE_PERSISTED_SESSION = false;

// Comparte repositorio, sesión y datos; coordina restauración, refresco y cambios de identidad.
export function AppProvider({ children }: { children: ReactNode }) {
  const [repository] = useState(() => {
    const apiUrl =
      process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
    return new HttpFotoYaRepository(
      new ApiClient(apiUrl),
      createSessionStorage(apiUrl),
    );
  });
  const [data, setData] = useState<AppData | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(RESTORE_PERSISTED_SESSION);
  const [restoring, setRestoring] = useState(RESTORE_PERSISTED_SESSION);
  const [error, setError] = useState('');
  // La generación cambia al limpiar sesión e invalida cargas que todavía estén en vuelo.
  const generation = useRef(0);
  const signedIn = useRef(false);
  const loginRunning = useRef(false);
  // Borra el usuario y los datos visibles e invalida respuestas iniciadas antes del cierre.
  const clear = useCallback(() => {
    generation.current += 1;
    signedIn.current = false;
    setData(null);
    setEmployee(null);
    setLoading(false);
    setRestoring(false);
  }, []);

  useEffect(() => {
    repository.setOnProfile((actor) =>
      setEmployee((current) =>
        JSON.stringify(current) === JSON.stringify(actor) ? current : actor,
      ),
    );
    repository.api.setOnUnauthorized(() => {
      clear();
      setError('La sesión venció o fue revocada. Volvé a iniciar sesión.');
      void repository.clearSession().catch(() => {
        setError(
          'No se pudo borrar la sesión guardada. Volvé a intentar cerrar sesión.',
        );
      });
    });
    return () => {
      repository.api.setOnUnauthorized();
      repository.setOnProfile();
    };
  }, [repository, clear]);

  // Publica el snapshot solo si pertenece a la misma generación de sesión.
  const refresh = useCallback(async () => {
    const current = generation.current;
    try {
      const snapshot = await repository.snapshot();
      if (current === generation.current) {
        setData(snapshot);
        setError('');
      }
    } catch (cause) {
      if (current === generation.current) setError(errorMessage(cause));
      throw cause;
    }
  }, [repository]);

  // Primero restaura la credencial y luego valida el acceso cargando el estado remoto.
  const restoreSession = useCallback(() => {
    if (!RESTORE_PERSISTED_SESSION) {
      return Promise.resolve();
    }
    const current = generation.current;
    return repository
      .restoreSession()
      .then(async (restored) => {
        if (current !== generation.current) return;
        if (restored) {
          await refresh();
          if (current !== generation.current) return;
          signedIn.current = true;
        }
        setRestoring(false);
      })
      .catch((cause) => {
        // Un fallo de red no elimina una credencial que todavía puede ser válida.
        if (current === generation.current) setError(errorMessage(cause));
      })
      .finally(() => {
        if (current === generation.current) setLoading(false);
      });
  }, [repository, refresh]);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && signedIn.current)
        void refresh().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [refresh]);

  useEffect(() => {
    if (!employee) return;
    let running = false;
    // Consulta cambios de jornada o kiosco cada minuto sin superponer verificaciones.
    const timer = setInterval(() => {
      if (running || !signedIn.current) return;
      running = true;
      void repository
        .profile()
        .then(async (current) => {
          if (
            current.working !== employee.working ||
            current.kioskMode !== employee.kioskMode
          )
            await refresh();
        })
        .catch(() => undefined)
        .finally(() => {
          running = false;
        });
    }, 60000);
    return () => clearInterval(timer);
  }, [employee, repository, refresh]);

  const assignCheckIn = async (stationId: string, password: string) => {
    await repository.assignCheckIn(stationId, password);
    await refresh();
  };
  const logoutCheckIn = async (password: string) => {
    await repository.logoutCheckIn(password);
    clear();
  };

  // Evita accesos simultáneos y carga los datos antes de marcar la sesión como iniciada.
  const login = async (email: string, password: string) => {
    if (loginRunning.current) return;
    loginRunning.current = true;
    setLoading(true);
    setError('');
    try {
      await repository.login(email, password);
      await refresh();
      signedIn.current = true;
    } catch (cause) {
      try {
        await repository.logout();
      } catch {
        /* La credencial local ya se eliminó. */
      }
      clear();
      setError(errorMessage(cause));
      throw cause;
    } finally {
      loginRunning.current = false;
      setLoading(false);
    }
  };
  // Limpia el estado compartido incluso si la revocación remota falla.
  const logout = async () => {
    setError('');
    try {
      await repository.logout();
    } catch (cause) {
      setError(errorMessage(cause));
      throw cause;
    } finally {
      clear();
    }
  };
  // Integra una sesión emitida por registro o identidad social y carga sus datos.
  const acceptSession = async (token: string) => {
    setLoading(true);
    setError('');
    try {
      await repository.acceptSession(token);
      await refresh();
      signedIn.current = true;
    } catch (cause) {
      await repository.logout().catch(() => undefined);
      clear();
      throw cause;
    } finally {
      setLoading(false);
    }
  };
  return (
    <AppContext.Provider
      value={{
        data,
        employee,
        loading,
        restoring,
        error,
        login,
        acceptSession,
        logout,
        refresh,
        restoreSession: async () => {
          if (!RESTORE_PERSISTED_SESSION) return;
          setLoading(true);
          setError('');
          await restoreSession();
        },
        assignCheckIn,
        logoutCheckIn,
        repository,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

// Obtiene el contexto global y detecta consumidores fuera del proveedor.
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('Falta AppProvider.');
  return context;
}

// Exige datos y usuario autenticado antes de entregar contexto a pantallas privadas.
export function useWorkspace() {
  const context = useApp();
  if (!context.data || !context.employee)
    throw new Error('Iniciá sesión para continuar.');
  return { ...context, data: context.data, employee: context.employee };
}
