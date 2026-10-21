/**
 * @file
 * Valida la identidad externa y extrae sujeto/correo admitidos. registration.service la
 * intercambia por una sesión propia de Foto Ya.
 */
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../config/env.js';
import { ApiError } from '../shared/errors.js';

let keys;
// Reutiliza las claves públicas del proveedor para verificar la identidad antes del registro local.
export async function socialIdentity(idToken) {
  if (!env.AUTH0_DOMAIN || !env.AUTH0_CLIENT_IDS)
    throw new ApiError(503, 'Auth0 no está configurado.', 'SOCIAL_UNAVAILABLE');
  keys ??= createRemoteJWKSet(new URL(`https://${env.AUTH0_DOMAIN}/.well-known/jwks.json`), { timeoutDuration: 5000 });
  return verifySocialToken(idToken, keys);
}

// Comprueba firma, emisor, audiencia y proveedor; devuelve sujeto y correo normalizado.
export async function verifySocialToken(idToken, keySet) {
  try {
    const { payload } = await jwtVerify(idToken, keySet, { issuer: `https://${env.AUTH0_DOMAIN}/`,
      audience: env.AUTH0_CLIENT_IDS.split(',').map(v => v.trim()), algorithms: ['RS256'], requiredClaims: ['exp', 'iat', 'sub'] });
    if (!/^(google-oauth2|github|apple)\|/.test(payload.sub) || typeof payload.email !== 'string') throw new Error();
    return { subject: payload.sub, email: payload.email.trim().toLowerCase() };
  } catch {
    throw new ApiError(401, 'La identidad social no es válida o no incluye un correo. Volvé a ingresar.', 'INVALID_SOCIAL_IDENTITY');
  }
}
