-- Ejecutar después de foto_ya.sql, con la cuenta instaladora y sin otras
-- escrituras concurrentes. Todos los datos de prueba se revierten.
USE foto_ya;
SET SESSION time_zone = '+00:00';
SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

DELIMITER $$
CREATE PROCEDURE comprobar_foto_ya()
BEGIN
  DECLARE v_ciudad BIGINT UNSIGNED;
  DECLARE v_puesto BIGINT UNSIGNED;
  DECLARE v_otro_puesto BIGINT UNSIGNED;
  DECLARE v_caja BIGINT UNSIGNED;
  DECLARE v_admin BIGINT UNSIGNED;
  DECLARE v_dia BIGINT UNSIGNED;
  DECLARE v_otro_dia BIGINT UNSIGNED;
  DECLARE v_sin_conteo BIGINT UNSIGNED;
  DECLARE v_precio BIGINT UNSIGNED;
  DECLARE v_venta BIGINT UNSIGNED;
  DECLARE v_otra_venta BIGINT UNSIGNED;
  DECLARE v_error BOOLEAN DEFAULT FALSE;
  DECLARE v_fotos DECIMAL(20,6);
  DECLARE v_vendidas DECIMAL(20,6);
  DECLARE v_descartes DECIMAL(20,6);
  DECLARE v_importe DECIMAL(40,2);
  DECLARE v_porcentaje DECIMAL(10,2);
  DECLARE v_filas BIGINT;
  DECLARE v_prefijo VARCHAR(32);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SET v_prefijo = REPLACE(UUID(), '-', '');
  START TRANSACTION;
  INSERT INTO ciudad (nombre) VALUES ('Ciudad de prueba');
  SET v_ciudad = LAST_INSERT_ID();
  INSERT INTO puesto (nombre, direccion, id_ciudad) VALUES ('Puesto de prueba', 'Dirección de prueba', v_ciudad);
  SET v_puesto = LAST_INSERT_ID();
  INSERT INTO puesto (nombre, direccion, id_ciudad) VALUES ('Otro puesto de prueba', 'Dirección de prueba', v_ciudad);
  SET v_otro_puesto = LAST_INSERT_ID();
  INSERT INTO usuarios (nombre, apellido, password, email, dni, id_tipo_usuario, id_puesto)
  SELECT 'Caja', 'Prueba', 'hash-ficticio-no-utilizable', CONCAT(v_prefijo, '-caja@example.invalid'),
         CONCAT('C', LEFT(v_prefijo, 19)), id_tipo_usuario, v_puesto
    FROM tipo_usuario WHERE nombre = 'caja';
  SET v_caja = LAST_INSERT_ID();
  INSERT INTO usuarios (nombre, apellido, password, email, dni, id_tipo_usuario)
  SELECT 'Admin', 'Prueba', 'hash-ficticio-no-utilizable', CONCAT(v_prefijo, '-admin@example.invalid'),
         CONCAT('A', LEFT(v_prefijo, 19)), id_tipo_usuario
    FROM tipo_usuario WHERE nombre = 'administrador';
  SET v_admin = LAST_INSERT_ID();
  INSERT INTO administradores_puestos (id_usuario, id_puesto) VALUES (v_admin, v_puesto);
  INSERT INTO precios (nombre, monto) VALUES ('Precio de prueba', 10.00);
  SET v_precio = LAST_INSERT_ID();
  INSERT INTO dias (id_puesto, fecha, fotos) VALUES (v_puesto, '2026-10-08', 100);
  SET v_dia = LAST_INSERT_ID();
  INSERT INTO dias (id_puesto, fecha, fotos) VALUES (v_otro_puesto, '2026-10-08', 50);
  SET v_otro_dia = LAST_INSERT_ID();
  INSERT INTO dias (id_puesto, fecha) VALUES (v_puesto, '2026-10-09');
  SET v_sin_conteo = LAST_INSERT_ID();

  -- Día con cero ventas y día sin conteo son estados distintos.
  SELECT fotos_vendidas, descartes INTO v_vendidas, v_descartes FROM dias WHERE id_dias = v_dia;
  IF v_vendidas <> 0 OR v_descartes <> 100 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALLO: cero ventas debe producir 100 descartes';
  END IF;
  SELECT fotos_tomadas, descartes, porcentaje_vendido INTO v_fotos, v_descartes, v_porcentaje
    FROM v_rendimiento_puesto_dia WHERE id_dias = v_sin_conteo;
  IF v_fotos IS NOT NULL OR v_descartes IS NOT NULL OR v_porcentaje IS NOT NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALLO: un conteo ausente debe conservar NULL';
  END IF;

  INSERT INTO venta (id_dias, id_puesto, id_usuario, id_precios, cantidad, precio_unitario, clave_operacion)
  VALUES (v_dia, v_puesto, v_caja, v_precio, 70, 10.00, CONCAT(v_prefijo, '-venta-1'));
  SET v_venta = LAST_INSERT_ID();
  SELECT fotos_vendidas, descartes INTO v_vendidas, v_descartes FROM dias WHERE id_dias = v_dia;
  IF v_vendidas <> 70 OR v_descartes <> 30 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALLO: 100 tomadas y 70 vendidas deben producir 30 descartes';
  END IF;
  INSERT INTO venta (id_dias, id_puesto, id_usuario, cantidad, precio_unitario, clave_operacion)
  VALUES (v_dia, v_puesto, v_caja, 10, 10.00, CONCAT(v_prefijo, '-venta-2'));
  SET v_otra_venta = LAST_INSERT_ID();
  SELECT fotos_tomadas, fotos_vendidas, descartes, venta_total, porcentaje_vendido
    INTO v_fotos, v_vendidas, v_descartes, v_importe, v_porcentaje
    FROM v_rendimiento_puesto_dia WHERE id_dias = v_dia;
  IF v_fotos <> 100 OR v_vendidas <> 80 OR v_descartes <> 20 OR v_importe <> 800 OR v_porcentaje <> 80 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALLO: varias ventas deben sumar sin duplicar las fotos tomadas';
  END IF;

  -- Un reintento con la misma clave no puede incrementar dos veces.
  SET v_error = FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR 1062 SET v_error = TRUE;
    INSERT INTO venta (id_dias, id_puesto, id_usuario, cantidad, precio_unitario, clave_operacion)
    VALUES (v_dia, v_puesto, v_caja, 10, 10.00, CONCAT(v_prefijo, '-venta-2'));
  END;
  IF NOT v_error THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALLO: se acepto un reintento duplicado'; END IF;

  SET v_error = FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR SQLSTATE '45000' SET v_error = TRUE;
    INSERT INTO venta (id_dias, id_puesto, id_usuario, cantidad, precio_unitario)
    VALUES (v_dia, v_puesto, v_caja, 21, 10.00);
  END;
  IF NOT v_error THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALLO: se aceptaron ventas superiores al conteo'; END IF;
  SELECT COUNT(*), SUM(cantidad) INTO v_filas, v_vendidas FROM venta WHERE id_dias = v_dia;
  IF v_filas <> 2 OR v_vendidas <> 80 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALLO: una venta rechazada dejo datos persistidos';
  END IF;

  -- Cantidades negativas y fraccionarias; errores CHECK de MySQL (3819).
  SET v_error = FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR 3819 SET v_error = TRUE;
    UPDATE dias SET fotos = -1 WHERE id_dias = v_dia;
  END;
  IF NOT v_error THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALLO: se acepto un conteo negativo'; END IF;
  SET v_error = FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR 3819 SET v_error = TRUE;
    UPDATE dias SET fotos = 100.5 WHERE id_dias = v_dia;
  END;
  IF NOT v_error THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALLO: se acepto un conteo fraccionario'; END IF;
  SET v_error = FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR 3819 SET v_error = TRUE;
    INSERT INTO venta (id_dias, id_puesto, id_usuario, cantidad, precio_unitario)
    VALUES (v_dia, v_puesto, v_caja, -1, 10.00);
  END;
  IF NOT v_error THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALLO: se acepto una venta negativa'; END IF;
  SET v_error = FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR 3819 SET v_error = TRUE;
    INSERT INTO venta (id_dias, id_puesto, id_usuario, cantidad, precio_unitario)
    VALUES (v_dia, v_puesto, v_caja, 1.5, 10.00);
  END;
  IF NOT v_error THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALLO: se acepto una venta fraccionaria'; END IF;

  SET v_error = FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR 3819 SET v_error = TRUE;
    UPDATE dias SET fotos = 79 WHERE id_dias = v_dia;
  END;
  IF NOT v_error THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALLO: se redujo el conteo por debajo de lo vendido'; END IF;
  SET v_error = FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR SQLSTATE '45000' SET v_error = TRUE;
    UPDATE venta SET cantidad = 91 WHERE id_venta = v_venta;
  END;
  IF NOT v_error THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALLO: una correccion de venta supero el conteo'; END IF;

  UPDATE dias SET fotos = 120 WHERE id_dias = v_dia;
  SELECT descartes INTO v_descartes FROM dias WHERE id_dias = v_dia;
  IF v_descartes <> 40 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALLO: corregir fotos no recalculo descartes'; END IF;
  UPDATE venta SET cantidad = 60 WHERE id_venta = v_venta;
  SELECT fotos_vendidas, descartes INTO v_vendidas, v_descartes FROM dias WHERE id_dias = v_dia;
  IF v_vendidas <> 70 OR v_descartes <> 50 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALLO: corregir venta no recalculo descartes'; END IF;
  UPDATE precios SET monto = 99.00 WHERE id_precios = v_precio;
  SELECT venta_total INTO v_importe FROM v_rendimiento_puesto_dia WHERE id_dias = v_dia;
  IF v_importe <> 700 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALLO: cambiar catalogo altero precios historicos'; END IF;
  DELETE FROM venta WHERE id_venta = v_otra_venta;
  SELECT fotos_vendidas, descartes INTO v_vendidas, v_descartes FROM dias WHERE id_dias = v_dia;
  IF v_vendidas <> 60 OR v_descartes <> 60 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALLO: borrar venta no ajusto el resumen'; END IF;
  UPDATE venta SET cantidad = 120 WHERE id_venta = v_venta;
  SELECT descartes INTO v_descartes FROM dias WHERE id_dias = v_dia;
  IF v_descartes <> 0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALLO: vender todas las fotos debe dejar cero descartes'; END IF;

  SET v_error = FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR SQLSTATE '45000' SET v_error = TRUE;
    INSERT INTO venta (id_dias, id_puesto, id_usuario, cantidad, precio_unitario)
    VALUES (v_sin_conteo, v_puesto, v_caja, 1, 10.00);
  END;
  IF NOT v_error THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALLO: se acepto una venta sin conteo'; END IF;
  SET v_error = FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR 1452 SET v_error = TRUE;
    INSERT INTO venta (id_dias, id_puesto, id_usuario, cantidad, precio_unitario)
    VALUES (v_otro_dia, v_puesto, v_caja, 1, 10.00);
  END;
  IF NOT v_error THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALLO: una venta se asocio al dia de otro puesto'; END IF;
  SELECT fotos_vendidas, descartes INTO v_vendidas, v_descartes FROM dias WHERE id_dias = v_otro_dia;
  IF v_vendidas <> 0 OR v_descartes <> 50 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALLO: las ventas afectaron a otro puesto'; END IF;

  SET v_error = FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR 1062 SET v_error = TRUE;
    INSERT INTO dias (id_puesto, fecha, fotos) VALUES (v_puesto, '2026-10-08', 0);
  END;
  IF NOT v_error THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALLO: se acepto un dia duplicado para el puesto'; END IF;
  SET v_error = FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR SQLSTATE '45000' SET v_error = TRUE;
    UPDATE dias SET fecha = '2026-10-10' WHERE id_dias = v_dia;
  END;
  IF NOT v_error THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALLO: se altero la identidad historica del dia'; END IF;

  SELECT COUNT(*) INTO v_filas FROM v_rendimiento_administrador
   WHERE id_administrador = v_admin AND id_puesto = v_otro_puesto;
  IF v_filas <> 0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALLO: el informe incluyo un puesto no autorizado'; END IF;
  SELECT COUNT(*) INTO v_filas FROM v_rendimiento_administrador
   WHERE id_administrador = v_admin AND id_puesto = v_puesto;
  IF v_filas <> 2 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALLO: faltan dias del puesto autorizado'; END IF;
  INSERT INTO administradores_puestos (id_usuario, id_puesto) VALUES (v_caja, v_puesto);
  SELECT COUNT(*) INTO v_filas FROM v_puestos_administrador WHERE id_administrador = v_caja;
  IF v_filas <> 0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALLO: un usuario de caja obtuvo consulta de administrador'; END IF;

  -- Asistencia independiente del conteo; varios turnos y cruce de medianoche.
  INSERT INTO horarios (id_dias, id_usuario, check_in)
  VALUES (v_sin_conteo, v_caja, '2026-10-10 02:00:00');
  INSERT INTO horarios (id_dias, id_usuario, check_in, check_out)
  VALUES (v_sin_conteo, v_caja, '2026-10-09 23:00:00', '2026-10-10 01:00:00');
  SELECT COUNT(*) INTO v_filas FROM horarios WHERE id_usuario = v_caja AND id_dias = v_sin_conteo;
  IF v_filas <> 2 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALLO: no se conservaron turnos abiertos y nocturnos'; END IF;
  SET v_error = FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR 3819 SET v_error = TRUE;
    INSERT INTO horarios (id_dias, id_usuario, check_in, check_out)
    VALUES (v_sin_conteo, v_caja, '2026-10-10 02:00:00', '2026-10-10 01:00:00');
  END;
  IF NOT v_error THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALLO: se acepto salida anterior a entrada'; END IF;

  -- Conteo registrado en cero y porcentaje no aplicable.
  UPDATE dias SET fotos = 0 WHERE id_dias = v_sin_conteo;
  SELECT fotos_tomadas, descartes, porcentaje_vendido INTO v_fotos, v_descartes, v_porcentaje
    FROM v_rendimiento_puesto_dia WHERE id_dias = v_sin_conteo;
  IF v_fotos <> 0 OR v_descartes <> 0 OR v_porcentaje IS NOT NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FALLO: el conteo cero no conserva las metricas esperadas';
  END IF;

  ROLLBACK;
  SELECT 'OK: conteos, ventas, correcciones, grupos, reintentos, rendimiento y horarios' AS resultado;
END$$
DELIMITER ;

CALL comprobar_foto_ya();
DROP PROCEDURE comprobar_foto_ya;
