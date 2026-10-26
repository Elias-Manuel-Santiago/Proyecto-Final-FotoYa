// Refuse ambiguous legacy data; an administrator must resolve it explicitly.
export async function migrateLocations(connection, { hasColumn, hasIndex }) {
  const [ambiguous] = await connection.query(`SELECT e.id_evento FROM evento e LEFT JOIN puesto p ON p.id_evento = e.id_evento
    GROUP BY e.id_evento HAVING COUNT(DISTINCT p.id_ciudad) <> 1`);
  if (!await hasColumn('evento', 'id_ciudad')) {
    if (ambiguous.length) throw new Error('Hay eventos sin ciudad o compartidos entre ciudades. Resolvé sus asociaciones antes de migrar.');
    await connection.query('ALTER TABLE evento ADD id_ciudad BIGINT UNSIGNED NULL, ADD CONSTRAINT fk_evento_ciudad FOREIGN KEY (id_ciudad) REFERENCES ciudad (id_ciudad)');
  }
  await connection.query(`UPDATE evento e JOIN (SELECT id_evento, MIN(id_ciudad) AS id_ciudad FROM puesto
    WHERE id_evento IS NOT NULL GROUP BY id_evento HAVING COUNT(DISTINCT id_ciudad) = 1) p ON p.id_evento = e.id_evento
    SET e.id_ciudad = p.id_ciudad WHERE e.id_ciudad IS NULL`);
  const [[unresolved]] = await connection.query('SELECT COUNT(*) AS total FROM evento WHERE id_ciudad IS NULL');
  if (Number(unresolved.total)) throw new Error('Asigná una ciudad a cada evento antes de continuar la migración.');
  await connection.query('ALTER TABLE evento MODIFY id_ciudad BIGINT UNSIGNED NOT NULL');
  if (!await hasIndex('evento', 'uq_evento_ciudad'))
    await connection.query('ALTER TABLE evento ADD UNIQUE KEY uq_evento_ciudad (id_evento, id_ciudad)');
  const [constraints] = await connection.query("SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = DATABASE() AND table_name = 'puesto' AND constraint_name = 'fk_puesto_evento_ciudad'");
  if (!constraints.length) await connection.query('ALTER TABLE puesto ADD CONSTRAINT fk_puesto_evento_ciudad FOREIGN KEY (id_evento, id_ciudad) REFERENCES evento (id_evento, id_ciudad) ON UPDATE CASCADE');
}
