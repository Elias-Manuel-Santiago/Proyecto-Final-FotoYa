/** Directorio de solo lectura. Pagina cuentas pequeñas y exporta tenants de 1000 o más usuarios. */
import { gunzipSync } from 'node:zlib';
import { env } from '../config/env.js';
import { ApiError } from '../shared/errors.js';

const unavailable = () => new ApiError(502,
  'No se pudo consultar Auth0. Revisá la conexión y los permisos read:users de la aplicación de servidor.', 'AUTH0_DIRECTORY_UNAVAILABLE');

// Solo publica datos de perfil; nunca tokens de identidades, metadatos o credenciales.
export function directoryUser(row) {
  if (typeof row.user_id !== 'string' || !row.user_id) throw unavailable();
  const identities = (row.identities ?? []).map(identity => ({
    subject: `${identity.provider}|${identity.user_id}`,
    provider: identity.provider,
    connection: identity.connection,
  }));
  return {
    id: row.user_id, firstName: row.given_name || row.name || row.nickname || '',
    lastName: row.family_name || '', email: row.email || '', active: !row.blocked,
    identities, authenticationProviders: [...new Set(identities.map(identity => identity.provider))],
  };
}

// El estado y la credencial se comparten entre consultas del dueño durante un minuto.
export function createAuth0Directory({ fetchImpl = (...args) => fetch(...args), now = Date.now } = {}) {
  let credential, snapshot, progress, running;
  async function request(url, options = {}) {
    const response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(8000), redirect: 'error' });
    if (!response.ok) throw unavailable();
    return response;
  }
  async function token() {
    if (credential?.expires > now()) return credential.value;
    const response = await request(`https://${env.AUTH0_DOMAIN}/oauth/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'client_credentials',
        client_id: env.AUTH0_MANAGEMENT_CLIENT_ID, client_secret: env.AUTH0_MANAGEMENT_CLIENT_SECRET,
        audience: `https://${env.AUTH0_DOMAIN}/api/v2/` }),
    });
    const data = await response.json();
    if (typeof data.access_token !== 'string') throw unavailable();
    credential = { value: data.access_token, expires: now() + (Number(data.expires_in || 60) - 30) * 1000 };
    return credential.value;
  }
  async function management(path, body) {
    const response = await request(`https://${env.AUTH0_DOMAIN}/api/v2/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return response.json();
  }
  function complete(rows) {
    snapshot = { users: rows.map(directoryUser), expires: now() + 60000 };
    progress = undefined;
    return { status: 'complete', users: snapshot.users };
  }
  async function advance() {
    if (!env.AUTH0_DOMAIN || !env.AUTH0_MANAGEMENT_CLIENT_ID || !env.AUTH0_MANAGEMENT_CLIENT_SECRET)
      throw new ApiError(503, 'Falta configurar la aplicación de servidor de Auth0 para consultar los usuarios del tenant.', 'AUTH0_DIRECTORY_NOT_CONFIGURED');
    if (snapshot?.expires > now()) return { status: 'complete', users: snapshot.users };
    progress ??= { rows: [], page: 0, started: now() };
    if (now() - progress.started > 5 * 60000) {
      progress = undefined;
      throw unavailable();
    }
    if (progress.jobId) {
      const job = await management(`jobs/${encodeURIComponent(progress.jobId)}`);
      if (job.status === 'failed') throw unavailable();
      if (job.status !== 'completed') return { status: 'pending' };
      const location = new URL(job.location);
      if (location.protocol !== 'https:' || location.username || location.password) throw unavailable();
      // La URL firmada viene de Auth0; no se envía nuestra credencial al servidor del archivo.
      const response = await request(location.href);
      const compressed = Buffer.from(await response.arrayBuffer());
      const content = compressed[0] === 0x1f && compressed[1] === 0x8b
        ? gunzipSync(compressed, { maxOutputLength: 50 * 1024 * 1024 }).toString('utf8')
        : compressed.toString('utf8');
      return complete(content.split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line)));
    }
    const page = await management(`users?include_totals=true&per_page=100&page=${progress.page}&sort=user_id:1&fields=user_id,given_name,family_name,name,nickname,email,blocked,identities&include_fields=true`);
    if (!Array.isArray(page.users)) throw unavailable();
    // Auth0 limita las búsquedas a 1000 resultados, incluso el total informado.
    if (page.total >= 1000 || progress.rows.length + page.users.length >= 1000) {
      const job = await management('jobs/users-exports', { format: 'json', fields:
        ['user_id', 'given_name', 'family_name', 'name', 'nickname', 'email', 'blocked', 'identities'].map(name => ({ name })) });
      if (typeof job.id !== 'string') throw unavailable();
      progress.jobId = job.id;
      progress.rows = [];
      return { status: 'pending' };
    }
    progress.rows.push(...page.users);
    progress.page++;
    if (page.users.length < 100 || progress.rows.length >= page.total) return complete(progress.rows);
    return { status: 'pending' };
  }
  return {
    query() {
      // Evita lanzar exportaciones/páginas duplicadas por consultas concurrentes.
      running ??= advance().catch(error => {
        progress = undefined; credential = undefined;
        throw error instanceof ApiError ? error : unavailable();
      }).finally(() => { running = undefined; });
      return running;
    },
  };
}

export const auth0Directory = createAuth0Directory();
