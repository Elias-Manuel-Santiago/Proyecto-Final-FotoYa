export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}

export class ApiClient {
  private token: string | null = null;
  onUnauthorized?: () => void;
  setOnUnauthorized(listener?: () => void) {
    this.onUnauthorized = listener;
  }

  constructor(private baseUrl: string) {
    if (!/^https?:\/\//.test(baseUrl))
      throw new Error(
        'Configurá EXPO_PUBLIC_API_URL con la URL HTTP(S) del backend.',
      );
  }

  setToken(token: string | null) {
    this.token = token;
  }

  async post<T>(
    path: string,
    body: object = {},
    multipart = false,
  ): Promise<T> {
    const token = this.token;
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      multipart ? 90000 : 20000,
    );
    try {
      const response = await fetch(
        `${this.baseUrl.replace(/\/$/, '')}/${path}`,
        {
          method: 'POST',
          headers: {
            ...(multipart ? {} : { 'Content-Type': 'application/json' }),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: multipart ? (body as FormData) : JSON.stringify(body),
          signal: controller.signal,
          cache: 'no-store',
        },
      );
      const payload = await response.json();
      if (token && token !== this.token)
        throw new ApiError(
          'La sesión cambió. Volvé a consultar.',
          401,
          'SESSION_CHANGED',
        );
      if (!response.ok) {
        if (
          response.status === 401 &&
          token &&
          payload.error?.code === 'UNAUTHENTICATED' &&
          token === this.token
        ) {
          this.token = null;
          this.onUnauthorized?.();
        }
        throw new ApiError(
          payload.error?.message ?? 'No se pudo completar la solicitud.',
          response.status,
          payload.error?.code ?? 'HTTP_ERROR',
        );
      }
      return payload.data as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new Error(
        controller.signal.aborted
          ? 'El servidor tardó demasiado. Podés reintentar la operación.'
          : 'No se pudo conectar con el servidor. Revisá tu conexión y la URL del backend.',
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async all<T>(path: string, body: object = {}): Promise<T[]> {
    const rows: T[] = [];
    for (let offset = 0; offset <= 100000; offset += 100) {
      const page = await this.post<T[]>(path, { ...body, limit: 100, offset });
      rows.push(...page);
      if (page.length < 100) return rows;
    }
    throw new Error(
      'La consulta supera el límite del servidor. Reducí el período.',
    );
  }
}
