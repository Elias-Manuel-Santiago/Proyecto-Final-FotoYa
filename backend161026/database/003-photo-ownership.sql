ALTER TABLE fotos
  DROP FOREIGN KEY fk_fotos_cliente,
  MODIFY id_cliente BIGINT UNSIGNED NULL,
  ADD CONSTRAINT fk_fotos_cliente_optional FOREIGN KEY (id_cliente) REFERENCES usuarios (id_usuario);
CREATE INDEX ix_fotos_puesto_cliente ON fotos (id_puesto, id_cliente, id_fotos);

INSERT IGNORE INTO permisos (tipo_de_permiso) VALUES ('photos.assign');
INSERT IGNORE INTO permisos_rol (id_rol, id_permiso)
SELECT r.id_rol, p.id_permisos FROM rol r CROSS JOIN permisos p
WHERE r.nombre IN ('encargado', 'camarografo') AND p.tipo_de_permiso = 'photos.assign';
