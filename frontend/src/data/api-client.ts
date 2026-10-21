/**
 * @file
 * Centraliza POST, Bearer, timeouts y errores. Detecta respuestas de otra sesión y pagina sin
 * presentar resultados truncados como totales.
 */
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
  // Registra el aviso que permite limpiar la interfaz al vencer la sesión.
  setOnUnauthorized(listener?: () => void) {
    this.onUnauthorized = listener;
  }

  constructor(private baseUrl: string) {
    if (!/^https?:\/\//.test(baseUrl))
      throw new Error(
        'Configurá EXPO_PUBLIC_API_URL con la URL HTTP(S) del backend.',
      );
  }

  // Actualiza la credencial usada en las siguientes solicitudes.
  setToken(token: string | null) {
    this.token = token;
  }

  // Envía JSON o multipart, controla timeout y sesión y extrae data o el error de la API.
  async post<T>(
    path: string,
    body: object = {},
    multipart = false,
  ): Promise<T> {
    // Se conserva la credencial de salida para detectar si la sesión cambió durante la consulta.
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
            // En multipart el navegador o runtime agrega Content-Type con el boundary del formulario.
            ...(multipart ? {} : { 'Content-Type': 'application/json' }),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: multipart ? (body as FormData) : JSON.stringify(body),
          signal: controller.signal,
          cache: 'no-store',
        },
      );
      const payload = await response.json();
      // Una respuesta tardía de otra sesión no debe actualizar los datos del usuario actual.
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

  // Recorre páginas de cien registros y falla si no puede garantizar un resultado completo.
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
