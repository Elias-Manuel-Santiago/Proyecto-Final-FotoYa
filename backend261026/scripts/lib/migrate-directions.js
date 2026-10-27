// Preserve legacy station addresses; only infer an event address when all agree.
export async function migrateDirections(connection, { hasColumn }) {
  if (!await hasColumn('evento', 'direccion')) {
    await connection.query("ALTER TABLE evento ADD direccion VARCHAR(255) NOT NULL DEFAULT ''");
  }
  if (await hasColumn('puesto', 'direccion')) {
    await connection.query(`UPDATE evento e JOIN (
      SELECT id_evento, MIN(TRIM(direccion)) AS direccion FROM puesto
      WHERE id_evento IS NOT NULL AND TRIM(COALESCE(direccion, '')) <> ''
      GROUP BY id_evento HAVING COUNT(DISTINCT TRIM(direccion)) = 1
    ) p ON p.id_evento = e.id_evento
    SET e.direccion = p.direccion WHERE e.direccion = ''`);
    // Keep unmapped/conflicting historical addresses without requiring new ones.
    await connection.query('ALTER TABLE puesto MODIFY direccion VARCHAR(255) NULL DEFAULT NULL');
  }
}
