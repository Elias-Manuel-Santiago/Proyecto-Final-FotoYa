-- Define reservas por UUID con actor, contenido, bucket y posible foto confirmada. El índice
-- de pendientes facilita la reconciliación.

CREATE TABLE IF NOT EXISTS photo_uploads (
  operation_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  id_actor BIGINT UNSIGNED NOT NULL,
  id_puesto BIGINT UNSIGNED NOT NULL,
  request_data LONGTEXT CHARACTER SET ascii COLLATE ascii_bin NULL,
  bucket VARCHAR(63) NOT NULL,
  id_archivo VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL UNIQUE,
  id_foto BIGINT UNSIGNED NULL UNIQUE,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  last_attempt_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  cleaned_at DATETIME(6) NULL,
  CONSTRAINT fk_upload_actor FOREIGN KEY (id_actor) REFERENCES usuarios (id_usuario),
  CONSTRAINT fk_upload_puesto FOREIGN KEY (id_puesto) REFERENCES puesto (id_puesto),
  CONSTRAINT fk_upload_foto FOREIGN KEY (id_foto) REFERENCES fotos (id_fotos),
  INDEX ix_upload_pending (id_foto, cleaned_at, last_attempt_at)
) ENGINE = InnoDB;
