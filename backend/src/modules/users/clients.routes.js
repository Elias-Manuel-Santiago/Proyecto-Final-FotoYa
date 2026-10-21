/**
 * @file
 * Busca clientes activos por correo/DNI en páginas de veinte. La baja lógica revalida
 * autorización y revoca credenciales conservando el historial.
 */
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../config/database.js';
import { permit } from '../../security/access.js';
import { endpoint, validate, id } from '../../shared/validation.js';
import { transaction } from '../../shared/transaction.js';
import { ApiError } from '../../shared/errors.js';

export const clientQuery = z.object({ search: z.string().trim().max(254).default(''),
  offset: z.number().int().min(0).max(100000).multipleOf(20).default(0) }).strict();
// Expone búsqueda paginada y baja lógica de clientes con revocación de credenciales.
export function clientRoutes() {
  const router = Router();
  router.post('/query', permit('clients.read'), validate(clientQuery), endpoint(async req => {
    const search = req.input.search.toLowerCase();
    // LOCATE trata %, _ y barras como texto, no como comodines SQL.
    const [rows] = await db.execute(`SELECT u.id_usuario AS id, u.nombre AS firstName, u.apellido AS lastName, u.email, u.dni,
      u.email_verified AS verified FROM usuarios u JOIN rol r ON r.id_rol = u.id_rol
      WHERE r.nombre = 'cliente' AND u.disponible = TRUE AND (? = '' OR LOCATE(?, u.email) > 0 OR (? <> '' AND LOCATE(?, u.dni) > 0))
      ORDER BY u.id_usuario LIMIT 21 OFFSET ?`, [search, search, search.replace(/[.\s-]/g, ''), search.replace(/[.\s-]/g, ''), String(req.input.offset)]);
    // La fila adicional solo detecta otra página; se entregan como máximo veinte clientes.
    return { clients: rows.slice(0, 20), hasMore: rows.length > 20 };
  }));
  router.post('/deactivate', permit('clients.manage'), validate(z.object({ clientId: id }).strict()), endpoint(req => transaction(async connection => {
    await connection.query('SELECT id_rol FROM rol ORDER BY id_rol FOR UPDATE');
    const [[authorized]] = await connection.execute(`SELECT u.id_usuario FROM usuarios u
      JOIN sesiones_usuario s ON s.id_usuario = u.id_usuario JOIN permisos_rol pr ON pr.id_rol = u.id_rol
      JOIN permisos p ON p.id_permisos = pr.id_permiso WHERE u.id_usuario = ? AND u.disponible = TRUE
      AND s.id_sesiones_usuario = ? AND s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP(6)
      AND s.check_in_mode = FALSE AND p.tipo_de_permiso = 'clients.manage' FOR UPDATE`, [req.actor.id, req.actor.sessionId]);
    if (!authorized) throw new ApiError(403, 'La autorización cambió.');
    const [[client]] = await connection.execute(`SELECT u.id_usuario FROM usuarios u JOIN rol r ON r.id_rol = u.id_rol
      WHERE u.id_usuario = ? AND r.nombre = 'cliente' FOR UPDATE`, [req.input.clientId]);
    if (!client) throw new ApiError(404, 'El cliente no existe.');
    await connection.execute('UPDATE usuarios SET disponible = FALSE WHERE id_usuario = ?', [req.input.clientId]);
    await connection.execute('UPDATE sesiones_usuario SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP(6)) WHERE id_usuario = ?', [req.input.clientId]);
    await connection.execute('UPDATE tokens_autenticacion SET used_at = COALESCE(used_at, UTC_TIMESTAMP(6)) WHERE id_usuario = ?', [req.input.clientId]);
    return { deactivated: true };
  })));
  return router;
}
