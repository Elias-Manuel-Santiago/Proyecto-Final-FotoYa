export function createAuthRepository(db) {
  return {
    async byEmail(hash) {
      const [rows] = await db.execute('SELECT id_usuario, password, disponible FROM usuarios WHERE email_hash = ?', [hash]);
      return rows[0];
    },
    async actor(hash) {
      const [rows] = await db.execute(`SELECT u.id_usuario AS id, u.id_puesto AS stationId, r.nombre AS role,
        s.id_sesiones_usuario AS sessionId FROM sesiones_usuario s
        JOIN usuarios u ON u.id_usuario = s.id_usuario JOIN rol r ON r.id_rol = u.id_rol
        WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP(6) AND u.disponible = 1`, [hash]);
      if (!rows[0]) return null;
      const [permissions] = await db.execute(`SELECT p.tipo_de_permiso AS name FROM permisos p
        JOIN permisos_rol pr ON pr.id_permiso = p.id_permisos JOIN usuarios u ON u.id_rol = pr.id_rol
        WHERE u.id_usuario = ?`, [rows[0].id]);
      await db.execute('UPDATE sesiones_usuario SET last_seen_at = UTC_TIMESTAMP(6) WHERE id_sesiones_usuario = ?', [rows[0].sessionId]);
      return { ...rows[0], permissions: permissions.map(p => p.name) };
    },
    async sessions(actor, { limit, offset }) {
      const [rows] = await db.execute(`SELECT id_sesiones_usuario AS id, created_at, expires_at, last_seen_at, revoked_at
        FROM sesiones_usuario WHERE id_usuario = ? ORDER BY id_sesiones_usuario DESC LIMIT ? OFFSET ?`, [actor.id, String(limit), String(offset)]);
      return rows;
    },
    async revoke(actor, sessionId) {
      await db.execute(`UPDATE sesiones_usuario SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP(6))
        WHERE id_sesiones_usuario = ? AND id_usuario = ?`, [sessionId, actor.id]);
      return { revoked: true };
    },
  };
}
