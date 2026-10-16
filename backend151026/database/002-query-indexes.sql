CREATE INDEX ix_usuarios_puesto ON usuarios (id_puesto, disponible);
CREATE INDEX ix_fotos_cliente ON fotos (id_cliente, id_fotos);
CREATE INDEX ix_dias_fecha ON dias (fecha, id_puesto);
CREATE INDEX ix_horarios_usuario_fecha ON horarios (id_usuario, check_in);
CREATE INDEX ix_sesiones_usuario_estado ON sesiones_usuario (id_usuario, revoked_at, expires_at);
