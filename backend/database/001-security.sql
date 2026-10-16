CREATE TABLE IF NOT EXISTS backend_locks (
  name VARCHAR(30) PRIMARY KEY
) ENGINE = InnoDB;
INSERT IGNORE INTO backend_locks (name) VALUES ('users');

ALTER TABLE usuarios
  DROP INDEX uq_usuarios_email,
  DROP INDEX uq_usuarios_dni,
  MODIFY nombre VARCHAR(1024) NOT NULL,
  MODIFY apellido VARCHAR(1024) NOT NULL,
  MODIFY email VARCHAR(1024) NOT NULL,
  MODIFY dni VARCHAR(1024) NOT NULL,
  ADD email_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  ADD dni_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  ADD CONSTRAINT uq_usuarios_email_hash UNIQUE (email_hash),
  ADD CONSTRAINT uq_usuarios_dni_hash UNIQUE (dni_hash);
