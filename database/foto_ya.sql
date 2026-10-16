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
  disponible BOOLEAN NOT NULL DEFAULT TRUE,
  id_ciudad BIGINT UNSIGNED NOT NULL,
  id_evento BIGINT UNSIGNED NULL,
  CONSTRAINT fk_puesto_ciudad FOREIGN KEY (id_ciudad) REFERENCES ciudad (id_ciudad),
  CONSTRAINT fk_puesto_evento FOREIGN KEY (id_evento) REFERENCES evento (id_evento)
) ENGINE = InnoDB;

CREATE TABLE rol (
  id_rol SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL,
  CONSTRAINT uq_rol_nombre UNIQUE (nombre)
) ENGINE = InnoDB;

CREATE TABLE permisos (
  id_permisos BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tipo_de_permiso VARCHAR(100) NOT NULL,
  CONSTRAINT uq_permisos_tipo UNIQUE (tipo_de_permiso)
) ENGINE = InnoDB;

CREATE TABLE permisos_rol (
  id_permisos_rol BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_permiso BIGINT UNSIGNED NOT NULL,
  id_rol SMALLINT UNSIGNED NOT NULL,
  CONSTRAINT uq_permisos_rol UNIQUE (id_permiso, id_rol),
  CONSTRAINT fk_permisos_rol_permiso FOREIGN KEY (id_permiso) REFERENCES permisos (id_permisos),
  CONSTRAINT fk_permisos_rol_rol FOREIGN KEY (id_rol) REFERENCES rol (id_rol)
) ENGINE = InnoDB;

CREATE TABLE usuarios (
  id_usuario BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(254) NOT NULL,
  dni VARCHAR(20) NOT NULL,
  id_rol SMALLINT UNSIGNED NOT NULL,
  id_puesto BIGINT UNSIGNED NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  disponible BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT uq_usuarios_email UNIQUE (email),
  CONSTRAINT uq_usuarios_dni UNIQUE (dni),
  CONSTRAINT fk_usuarios_rol FOREIGN KEY (id_rol) REFERENCES rol (id_rol),
  CONSTRAINT fk_usuarios_puesto FOREIGN KEY (id_puesto) REFERENCES puesto (id_puesto),
  CONSTRAINT ck_usuarios_disponible CHECK (disponible IN (0, 1))
) ENGINE = InnoDB;

CREATE TABLE dias (
  id_dias BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fecha DATE NOT NULL,
  fotos INT UNSIGNED NOT NULL DEFAULT 0,
  descartes INT UNSIGNED NOT NULL DEFAULT 0,
  venta_total DECIMAL(26,2) NOT NULL DEFAULT 0,
  id_puesto BIGINT UNSIGNED NOT NULL,
  CONSTRAINT uq_dias_puesto_fecha UNIQUE (id_puesto, fecha),
  CONSTRAINT uq_dias_id_puesto UNIQUE (id_dias, id_puesto),
  CONSTRAINT fk_dias_puesto FOREIGN KEY (id_puesto) REFERENCES puesto (id_puesto),
  CONSTRAINT ck_dias_descartes CHECK (descartes <= fotos),
  CONSTRAINT ck_dias_venta_total CHECK (venta_total >= 0)
) ENGINE = InnoDB;

CREATE TABLE fotos (
  id_fotos BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_archivo VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  id_dia BIGINT UNSIGNED NOT NULL,
  id_cliente BIGINT UNSIGNED NULL,
  id_puesto BIGINT UNSIGNED NOT NULL,
  CONSTRAINT uq_fotos_archivo UNIQUE (id_archivo),
  CONSTRAINT fk_fotos_dia_puesto FOREIGN KEY (id_dia, id_puesto) REFERENCES dias (id_dias, id_puesto),
  CONSTRAINT fk_fotos_cliente FOREIGN KEY (id_cliente) REFERENCES usuarios (id_usuario),
  CONSTRAINT fk_fotos_puesto FOREIGN KEY (id_puesto) REFERENCES puesto (id_puesto),
  CONSTRAINT ck_fotos_archivo CHECK (CHAR_LENGTH(TRIM(id_archivo)) > 0)
) ENGINE = InnoDB;

CREATE TABLE venta (
  id_venta BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cantidad INT UNSIGNED NOT NULL,
  precio_total DECIMAL(26,2) NOT NULL,
  id_dias BIGINT UNSIGNED NOT NULL,
  CONSTRAINT fk_venta_dia FOREIGN KEY (id_dias) REFERENCES dias (id_dias),
  CONSTRAINT ck_venta_cantidad CHECK (cantidad > 0),
  CONSTRAINT ck_venta_precio_total CHECK (precio_total >= 0)
) ENGINE = InnoDB;

CREATE TABLE fotos_venta (
  id_fotos_venta BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_foto BIGINT UNSIGNED NOT NULL,
  id_venta BIGINT UNSIGNED NOT NULL,
  CONSTRAINT uq_fotos_venta UNIQUE (id_foto, id_venta),
  CONSTRAINT fk_fotos_venta_foto FOREIGN KEY (id_foto) REFERENCES fotos (id_fotos),
  CONSTRAINT fk_fotos_venta_venta FOREIGN KEY (id_venta) REFERENCES venta (id_venta)
) ENGINE = InnoDB;

CREATE TABLE precios (
  id_precios BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  CONSTRAINT ck_precios_monto CHECK (monto >= 0)
) ENGINE = InnoDB;

CREATE TABLE precios_venta (
  id_precio_venta BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_venta BIGINT UNSIGNED NOT NULL,
  id_precio BIGINT UNSIGNED NOT NULL,
  precio_unitario_aplicado DECIMAL(12,2) NOT NULL,
  cantidad INT UNSIGNED NOT NULL,
  CONSTRAINT fk_precios_venta_venta FOREIGN KEY (id_venta) REFERENCES venta (id_venta),
  CONSTRAINT fk_precios_venta_precio FOREIGN KEY (id_precio) REFERENCES precios (id_precios),
  CONSTRAINT ck_precios_venta_precio CHECK (precio_unitario_aplicado >= 0),
  CONSTRAINT ck_precios_venta_cantidad CHECK (cantidad > 0)
) ENGINE = InnoDB;

CREATE TABLE tokens_autenticacion (
  id_tokens BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_usuario BIGINT UNSIGNED NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  token VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  used_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT uq_tokens_token UNIQUE (token),
  CONSTRAINT fk_tokens_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario),
  CONSTRAINT ck_tokens_expiracion CHECK (expires_at > created_at),
  CONSTRAINT ck_tokens_uso CHECK (used_at IS NULL OR used_at >= created_at)
) ENGINE = InnoDB;

CREATE TABLE sesiones_usuario (
  id_sesiones_usuario BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_usuario BIGINT UNSIGNED NOT NULL,
  token VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  last_seen_at DATETIME(6) NULL,
  revoked_at DATETIME(6) NULL,
  user_agent VARCHAR(512) NULL,
  ip_address VARCHAR(45) CHARACTER SET ascii NULL,
  CONSTRAINT uq_sesiones_token UNIQUE (token),
  CONSTRAINT fk_sesiones_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario),
  CONSTRAINT ck_sesiones_expiracion CHECK (expires_at > created_at),
  CONSTRAINT ck_sesiones_actividad CHECK (last_seen_at IS NULL OR last_seen_at >= created_at),
  CONSTRAINT ck_sesiones_revocacion CHECK (revoked_at IS NULL OR revoked_at >= created_at)
) ENGINE = InnoDB;

CREATE TABLE horarios (
  id_horario BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_dias BIGINT UNSIGNED NOT NULL,
  id_usuario BIGINT UNSIGNED NOT NULL,
  check_in DATETIME(6) NOT NULL,
  check_out DATETIME(6) NULL,
  CONSTRAINT fk_horarios_dia FOREIGN KEY (id_dias) REFERENCES dias (id_dias),
  CONSTRAINT fk_horarios_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario),
  CONSTRAINT ck_horarios_orden CHECK (check_out IS NULL OR check_out >= check_in)
) ENGINE = InnoDB;

