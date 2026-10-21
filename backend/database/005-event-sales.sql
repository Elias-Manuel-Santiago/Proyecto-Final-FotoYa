-- Define apertura por puesto/día. La clave foránea compuesta impide asociar una apertura con
-- el día de otro puesto.

CREATE TABLE IF NOT EXISTS event_sales (
  id_puesto BIGINT UNSIGNED PRIMARY KEY,
  id_dia BIGINT UNSIGNED NOT NULL,
  abierta BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_event_sales_puesto FOREIGN KEY (id_puesto) REFERENCES puesto (id_puesto),
  CONSTRAINT fk_event_sales_dia FOREIGN KEY (id_dia, id_puesto) REFERENCES dias (id_dias, id_puesto)
) ENGINE = InnoDB;
