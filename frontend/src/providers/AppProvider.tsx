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
import { errorMessage } from '../domain/format';

interface AppContextValue {
  data: AppData | null;
  employee: Employee | null;
  loading: boolean;
  error: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  repository: HttpFotoYaRepository;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [repository] = useState(
    () =>
      new HttpFotoYaRepository(
        new ApiClient(
          process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api',
        ),
      ),
  );
  const [data, setData] = useState<AppData | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const signedIn = useRef(false);
  const loginRunning = useRef(false);
  const clear = useCallback(() => {
    generation.current += 1;
    signedIn.current = false;
    setData(null);
    setEmployee(null);
    setLoading(false);
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
    });
    return () => {
      repository.api.setOnUnauthorized();
      repository.setOnProfile();
    };
  }, [repository, clear]);

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

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && signedIn.current)
        void refresh().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [refresh]);

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
  const logout = async () => {
    try {
      await repository.logout();
    } finally {
      clear();
      setError('');
    }
  };
  return (
    <AppContext.Provider
      value={{
        data,
        employee,
        loading,
        error,
        login,
        logout,
        refresh,
        repository,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('Falta AppProvider.');
  return context;
}

export function useWorkspace() {
  const context = useApp();
  if (!context.data || !context.employee)
    throw new Error('Iniciá sesión para continuar.');
  return { ...context, data: context.data, employee: context.employee };
}
