/** Unifica las verificaciones de correo sin invalidar desafíos pendientes. */
export async function migrateVerifications(connection, { hasColumn, hasIndex }) {
  for (const [name, definition] of [
    ['code_hash', 'CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL'],
    ['sent_at', 'DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)'],
    ['attempts', 'TINYINT UNSIGNED NOT NULL DEFAULT 0'],
    ['id_usuario_verificacion', "BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN tipo = 'email_verification' THEN id_usuario ELSE NULL END) STORED"],
  ]) {
    if (!await hasColumn('tokens_autenticacion', name))
      await connection.query(`ALTER TABLE tokens_autenticacion ADD ${name} ${definition}`);
  }
  // Los demás tipos conservan la posibilidad de tener varios tokens por usuario.
  if (!await hasIndex('tokens_autenticacion', 'uq_tokens_verificacion_usuario'))
    await connection.query('CREATE UNIQUE INDEX uq_tokens_verificacion_usuario ON tokens_autenticacion (id_usuario_verificacion)');
  if (!await hasColumn('client_verifications', 'id_usuario')) return;
  await connection.beginTransaction();
  try {
    // Repetible si el proceso se interrumpió después del commit y antes del DROP.
    await connection.query(`DELETE t FROM tokens_autenticacion t JOIN client_verifications v ON v.id_usuario = t.id_usuario
      WHERE t.tipo = 'email_verification'`);
    await connection.query(`INSERT INTO tokens_autenticacion
      (id_usuario, tipo, token, code_hash, expires_at, created_at, sent_at, attempts)
      SELECT id_usuario, 'email_verification', challenge, code_hash, expires_at, sent_at, sent_at, attempts
      FROM client_verifications`);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
  // MySQL confirma DDL implícitamente: eliminar sólo tras persistir la copia completa.
  await connection.query('DROP TABLE client_verifications');
}
