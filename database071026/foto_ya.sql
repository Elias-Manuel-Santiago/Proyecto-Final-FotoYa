-- Foto Ya: instalación inicial para MySQL 8.0.16 o posterior (recomendado 8.4).
-- Ejecutar completo con mysql o MySQL Workbench. No elimina datos existentes.
-- Las tablas se crean sin IF NOT EXISTS para detectar instalaciones previas.
SET NAMES utf8mb4;
SET SESSION time_zone = '+00:00';
SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

CREATE DATABASE IF NOT EXISTS foto_ya
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE foto_ya;

CREATE TABLE ciudad (
  id_ciudad BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL
) ENGINE = InnoDB;

CREATE TABLE evento (
  id_evento BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL
) ENGINE = InnoDB;

CREATE TABLE puesto (
  id_puesto BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  direccion VARCHAR(255) NOT NULL,
  id_ciudad BIGINT UNSIGNED NOT NULL,
  id_evento BIGINT UNSIGNED NULL,
  CONSTRAINT fk_puesto_ciudad FOREIGN KEY (id_ciudad) REFERENCES ciudad (id_ciudad),
  CONSTRAINT fk_puesto_evento FOREIGN KEY (id_evento) REFERENCES evento (id_evento)
) ENGINE = InnoDB;

CREATE TABLE tipo_usuario (
  id_tipo_usuario SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL,
  CONSTRAINT uq_tipo_usuario_nombre UNIQUE (nombre)
) ENGINE = InnoDB;

CREATE TABLE usuarios (
  id_usuario BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  password VARCHAR(255) NOT NULL COMMENT 'Hash de contraseña; nunca texto plano',
  email VARCHAR(254) NOT NULL,
  dni VARCHAR(20) NOT NULL,
  id_tipo_usuario SMALLINT UNSIGNED NOT NULL,
  id_puesto BIGINT UNSIGNED NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT uq_usuarios_email UNIQUE (email),
  CONSTRAINT uq_usuarios_dni UNIQUE (dni),
  CONSTRAINT fk_usuarios_tipo FOREIGN KEY (id_tipo_usuario) REFERENCES tipo_usuario (id_tipo_usuario),
  CONSTRAINT fk_usuarios_puesto FOREIGN KEY (id_puesto) REFERENCES puesto (id_puesto)
) ENGINE = InnoDB;

-- Alcance explícito de consulta: un administrador puede tener varios puestos.
CREATE TABLE administradores_puestos (
  id_usuario BIGINT UNSIGNED NOT NULL,
  id_puesto BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id_usuario, id_puesto),
  CONSTRAINT fk_admin_puestos_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario),
  CONSTRAINT fk_admin_puestos_puesto FOREIGN KEY (id_puesto) REFERENCES puesto (id_puesto)
) ENGINE = InnoDB;

CREATE TABLE precios (
  id_precios BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  CONSTRAINT ck_precios_monto CHECK (monto >= 0)
) ENGINE = InnoDB;

-- Un registro por puesto y fecha local de negocio.
-- DECIMAL conserva fracciones habituales para que CHECK pueda rechazarlas.
-- La API también debe validar Number.isSafeInteger antes de la conversión SQL.
CREATE TABLE dias (
  id_dias BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_puesto BIGINT UNSIGNED NOT NULL,
  fecha DATE NOT NULL,
  fotos DECIMAL(20,6) NULL DEFAULT NULL COMMENT 'NULL: conteo todavía no registrado; 0: conteo registrado en cero',
  fotos_vendidas DECIMAL(20,6) NOT NULL DEFAULT 0 COMMENT 'Resumen interno mantenido exclusivamente por triggers de venta',
  descartes DECIMAL(20,6) GENERATED ALWAYS AS (fotos - fotos_vendidas) STORED,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT uq_dias_puesto_fecha UNIQUE (id_puesto, fecha),
  CONSTRAINT uq_dias_id_puesto UNIQUE (id_dias, id_puesto),
  KEY ix_dias_fecha (fecha),
  CONSTRAINT fk_dias_puesto FOREIGN KEY (id_puesto) REFERENCES puesto (id_puesto),
  CONSTRAINT ck_dias_fotos CHECK (fotos IS NULL OR (fotos >= 0 AND fotos = FLOOR(fotos))),
  CONSTRAINT ck_dias_vendidas CHECK (fotos_vendidas >= 0 AND fotos_vendidas = FLOOR(fotos_vendidas)),
  CONSTRAINT ck_dias_saldo CHECK (
    (fotos IS NULL AND fotos_vendidas = 0) OR (fotos IS NOT NULL AND fotos_vendidas <= fotos)
  )
) ENGINE = InnoDB;

CREATE TABLE venta (
  id_venta BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_dias BIGINT UNSIGNED NOT NULL,
  id_puesto BIGINT UNSIGNED NOT NULL,
  id_usuario BIGINT UNSIGNED NOT NULL COMMENT 'Usuario que registra la venta',
  id_precios BIGINT UNSIGNED NULL COMMENT 'Referencia opcional al catálogo; el precio histórico se conserva abajo',
  cantidad DECIMAL(20,6) NOT NULL,
  precio_unitario DECIMAL(12,2) NOT NULL,
  precio_total DECIMAL(26,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
  clave_operacion VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT 'Identificador estable del cliente para evitar duplicados por reintento',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT uq_venta_operacion UNIQUE (clave_operacion),
  CONSTRAINT fk_venta_dia_puesto FOREIGN KEY (id_dias, id_puesto) REFERENCES dias (id_dias, id_puesto),
  CONSTRAINT fk_venta_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario),
  CONSTRAINT fk_venta_precio FOREIGN KEY (id_precios) REFERENCES precios (id_precios),
  CONSTRAINT ck_venta_cantidad CHECK (cantidad > 0 AND cantidad = FLOOR(cantidad)),
  CONSTRAINT ck_venta_precio CHECK (precio_unitario >= 0)
) ENGINE = InnoDB;

CREATE TABLE tokens_autenticacion (
  id_tokens BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_usuario BIGINT UNSIGNED NOT NULL,
  tipo VARCHAR(50) NOT NULL COMMENT 'Finalidad definida por el backend',
  token_hash VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  used_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT uq_tokens_hash UNIQUE (token_hash),
  KEY ix_tokens_expires (expires_at),
  CONSTRAINT fk_tokens_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario),
  CONSTRAINT ck_tokens_expiracion CHECK (expires_at > created_at),
  CONSTRAINT ck_tokens_uso CHECK (used_at IS NULL OR used_at >= created_at)
) ENGINE = InnoDB;

CREATE TABLE sesiones_usuario (
  id_sesiones_usuario BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_usuario BIGINT UNSIGNED NOT NULL,
  token_hash VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  last_seen_at DATETIME(6) NULL,
  revoked_at DATETIME(6) NULL,
  user_agent VARCHAR(512) NULL,
  ip_address VARCHAR(45) CHARACTER SET ascii NULL,
  CONSTRAINT uq_sesiones_hash UNIQUE (token_hash),
  KEY ix_sesiones_expires (expires_at),
  CONSTRAINT fk_sesiones_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario),
  CONSTRAINT ck_sesiones_expiracion CHECK (expires_at > created_at),
  CONSTRAINT ck_sesiones_actividad CHECK (last_seen_at IS NULL OR last_seen_at >= created_at),
  CONSTRAINT ck_sesiones_revocacion CHECK (revoked_at IS NULL OR revoked_at >= created_at)
) ENGINE = InnoDB;

CREATE TABLE horarios (
  id_horario BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_dias BIGINT UNSIGNED NOT NULL COMMENT 'Conserva el puesto y la fecha de referencia históricos',
  id_usuario BIGINT UNSIGNED NOT NULL,
  check_in DATETIME(6) NOT NULL,
  check_out DATETIME(6) NULL,
  clave_operacion VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  CONSTRAINT uq_horarios_operacion UNIQUE (clave_operacion),
  KEY ix_horarios_usuario_entrada (id_usuario, check_in),
  CONSTRAINT fk_horarios_dia FOREIGN KEY (id_dias) REFERENCES dias (id_dias),
  CONSTRAINT fk_horarios_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario),
  CONSTRAINT ck_horarios_orden CHECK (check_out IS NULL OR check_out >= check_in)
) ENGINE = InnoDB;

DELIMITER $$

CREATE TRIGGER dias_bi BEFORE INSERT ON dias FOR EACH ROW
BEGIN
  IF NEW.fotos_vendidas <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las fotos vendidas se registran mediante ventas';
  END IF;
END$$

-- No cambiar la identidad de un día: afectaría ventas y asistencia históricas.
CREATE TRIGGER dias_bu BEFORE UPDATE ON dias FOR EACH ROW
BEGIN
  IF NEW.id_dias <> OLD.id_dias OR NEW.id_puesto <> OLD.id_puesto OR NEW.fecha <> OLD.fecha THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El puesto y la fecha de un dia son inmutables';
  END IF;
END$$

-- UPDATE toma un bloqueo exclusivo sobre el mismo día. Las ventas simultáneas
-- se serializan y validan contra el saldo confirmado, sin usar SUM obsoletos.
-- Un SIGNAL revierte tanto la venta como su actualización del resumen.
CREATE TRIGGER venta_ai AFTER INSERT ON venta FOR EACH ROW
BEGIN
  UPDATE dias
     SET fotos_vendidas = fotos_vendidas + NEW.cantidad
   WHERE id_dias = NEW.id_dias AND id_puesto = NEW.id_puesto
     AND fotos IS NOT NULL AND NEW.cantidad <= fotos - fotos_vendidas;
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Venta sin conteo registrado o superior a las fotos disponibles';
  END IF;
END$$

CREATE TRIGGER venta_bu BEFORE UPDATE ON venta FOR EACH ROW
BEGIN
  IF NEW.id_venta <> OLD.id_venta OR NEW.id_dias <> OLD.id_dias OR NEW.id_puesto <> OLD.id_puesto THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Una venta no puede cambiar de identificador, puesto o dia';
  END IF;
  IF NOT (NEW.clave_operacion <=> OLD.clave_operacion) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La clave de reintento de una venta es inmutable';
  END IF;
END$$

CREATE TRIGGER venta_au AFTER UPDATE ON venta FOR EACH ROW
BEGIN
  IF NEW.cantidad <> OLD.cantidad THEN
    UPDATE dias
       SET fotos_vendidas = fotos_vendidas - OLD.cantidad + NEW.cantidad
     WHERE id_dias = NEW.id_dias
       AND fotos IS NOT NULL
       AND fotos_vendidas >= OLD.cantidad
       AND fotos_vendidas - OLD.cantidad + NEW.cantidad <= fotos;
    IF ROW_COUNT() <> 1 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La correccion de venta supera las fotos disponibles';
    END IF;
  END IF;
END$$

CREATE TRIGGER venta_ad AFTER DELETE ON venta FOR EACH ROW
BEGIN
  UPDATE dias SET fotos_vendidas = fotos_vendidas - OLD.cantidad WHERE id_dias = OLD.id_dias;
END$$

DELIMITER ;

-- Las ventas se agregan antes de la unión para no multiplicar fotos tomadas.
-- venta_total se expresa como importe; fotos_vendidas siempre es una cantidad.
CREATE VIEW v_rendimiento_puesto_dia AS
SELECT d.id_dias, d.id_puesto, p.nombre AS puesto, p.id_ciudad, p.id_evento,
       d.fecha, d.fotos AS fotos_tomadas, d.fotos_vendidas, d.descartes,
       COALESCE(v.venta_total, 0.00) AS venta_total,
       ROUND(d.fotos_vendidas / NULLIF(d.fotos, 0) * 100, 2) AS porcentaje_vendido
  FROM dias AS d
  JOIN puesto AS p ON p.id_puesto = d.id_puesto
  LEFT JOIN (
    SELECT id_dias, SUM(precio_total) AS venta_total FROM venta GROUP BY id_dias
  ) AS v ON v.id_dias = d.id_dias;

CREATE VIEW v_rendimiento_administrador AS
SELECT ap.id_usuario AS id_administrador, r.*
  FROM administradores_puestos AS ap
  JOIN usuarios AS u ON u.id_usuario = ap.id_usuario
  JOIN tipo_usuario AS t ON t.id_tipo_usuario = u.id_tipo_usuario AND t.nombre = 'administrador'
  JOIN v_rendimiento_puesto_dia AS r ON r.id_puesto = ap.id_puesto;

-- Puestos sin días registrados también aparecen; no se inventa un conteo cero.
CREATE VIEW v_puestos_administrador AS
SELECT ap.id_usuario AS id_administrador, p.*
  FROM administradores_puestos AS ap
  JOIN usuarios AS u ON u.id_usuario = ap.id_usuario
  JOIN tipo_usuario AS t ON t.id_tipo_usuario = u.id_tipo_usuario AND t.nombre = 'administrador'
  JOIN puesto AS p ON p.id_puesto = ap.id_puesto;

INSERT INTO tipo_usuario (nombre) VALUES ('registro'), ('caja'), ('administrador');

-- Rol de conexión para el futuro backend. Los triggers se ejecutan con los
-- permisos del creador, mientras la API no puede editar el resumen interno.
-- Este rol NO reemplaza los permisos y filtros por usuario de la aplicación.
CREATE ROLE IF NOT EXISTS 'foto_ya_backend';
GRANT SELECT ON foto_ya.* TO 'foto_ya_backend';
GRANT INSERT (id_puesto, fecha, fotos), UPDATE (fotos) ON foto_ya.dias TO 'foto_ya_backend';
GRANT INSERT, UPDATE, DELETE ON foto_ya.venta TO 'foto_ya_backend';
GRANT INSERT, UPDATE ON foto_ya.horarios TO 'foto_ya_backend';
GRANT INSERT, UPDATE, DELETE ON foto_ya.tokens_autenticacion TO 'foto_ya_backend';
GRANT INSERT, UPDATE, DELETE ON foto_ya.sesiones_usuario TO 'foto_ya_backend';
