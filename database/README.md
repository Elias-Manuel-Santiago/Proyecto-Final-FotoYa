# Base de datos de Foto Ya

`foto_ya.sql` crea la base `foto_ya` para MySQL **8.0.16 o posterior**, preferentemente **8.4**. Usa InnoDB, claves foráneas, restricciones `CHECK`, `utf8mb4`, triggers y vistas. No es un script de MariaDB ni una migración de una instalación anterior.

## Importación

En MySQL Workbench, abrir `foto_ya.sql` y ejecutar el archivo completo. También se puede ejecutar desde el cliente MySQL:

```sql
SOURCE C:/Users/Elias/Documents/GitHub/Proyecto-Final-FotoYa/database/foto_ya.sql;
SHOW TABLES FROM foto_ya;
```

La cuenta instaladora necesita permisos para crear la base, tablas, triggers, vistas y el rol SQL, además de conceder los permisos de ese rol. No se incluyen contraseñas ni una conexión automática. Las tablas se crean sin `IF NOT EXISTS`: ejecutar el instalador una sola vez sobre una base nueva; no continuar después de un error. MySQL confirma el DDL automáticamente, por lo que una instalación incompleta requiere revisar los objetos antes de reintentar. El script no contiene `DROP DATABASE` ni `DROP TABLE`.

## Modelo

| Tabla | Función |
| --- | --- |
| `ciudad`, `evento`, `puesto` | Ubicación y evento asignado al puesto. |
| `tipo_usuario`, `usuarios` | Tipos registro, caja y administrador; usuario y puesto actual opcional. |
| `administradores_puestos` | Puestos que puede consultar cada administrador. |
| `dias` | Un registro por **puesto y fecha**, según la agrupación confirmada. |
| `precios`, `venta` | Catálogo sin precios inventados y detalle histórico de ventas. |
| `tokens_autenticacion`, `sesiones_usuario` | Hashes, caducidad, consumo y revocación. |
| `horarios` | Entrada y salida laboral vinculadas a un usuario y un día del puesto. |

Se eliminan las duplicaciones de `nombre` y `cantidad` del borrador. Se corrige `ip_adress` a `ip_address`. Se agrega `dias.id_puesto` y una clave única `(id_puesto, fecha)`; la relación compuesta de `venta` impide asociar una venta al día de otro puesto. `venta.id_usuario` identifica quién la registró. `venta.id_precios` es opcional; `precio_unitario` conserva el precio realmente usado, aunque cambie el catálogo.

`dias.fotos` es el **total** de fotos tomadas de ese puesto y fecha. `NULL` significa que todavía no se registró el conteo; `0` significa que sí se registró y fue cero. Una venta requiere un conteo registrado y una cantidad entera positiva. Los conteos admiten enteros no negativos. Se usa `DECIMAL(20,6)` junto con `CHECK` para detectar fracciones habituales sin el redondeo inmediato de una columna `INT`; el backend debe validar los valores originales como enteros antes de enviarlos, ya que MySQL convierte los tipos y redondea a la precisión de las columnas.

`fotos_vendidas` es un resumen interno actualizado por los triggers al insertar, corregir o eliminar ventas. **No se escribe desde la aplicación.** `descartes` es una columna generada: `fotos - fotos_vendidas`; se recalcula automáticamente, sin confirmación del usuario. Las ventas concurrentes actualizan bajo bloqueo el mismo día y no pueden superar las fotos tomadas. Reducir el conteo por debajo de las fotos vendidas también falla. El rol SQL incluido impide que la conexión del backend altere directamente el resumen.

`venta.precio_total` también es generado. `venta_total` aparece en la vista de rendimiento y significa **importe**, mientras que `fotos_vendidas` significa **cantidad de fotos**, nunca cantidad de operaciones. No se almacenan imágenes, conteos de edición, comisiones ni pagos integrados.

## Uso desde el backend

Todos los `DATETIME` se guardan en UTC; cada conexión debe ejecutar `SET time_zone = '+00:00'`. La `fecha` del día comercial se determina explícitamente en `America/Buenos_Aires`, independientemente de la fecha UTC. Entrada y salida son instantes completos, por lo que un turno puede cruzar medianoche. La salida permanece `NULL` mientras el horario esté abierto. La relación con `dias` conserva el puesto histórico aunque cambie `usuarios.id_puesto`.

El instalador crea el rol MySQL `foto_ya_backend`. Una vez creada una cuenta de conexión con credenciales propias, asignar y activar ese rol (sustituir los nombres por la cuenta real):

```sql
GRANT 'foto_ya_backend' TO 'usuario_backend'@'localhost';
SET DEFAULT ROLE 'foto_ya_backend' TO 'usuario_backend'@'localhost';
```

No concederle además permisos globales o permisos de escritura sobre todo `dias`, que permitirían modificar el resumen. El rol permite registrar conteos, ventas, horarios, tokens y sesiones. No concede administración de catálogos, usuarios ni asignaciones, cuyos permisos funcionales todavía deben definirse.

Este rol es la cuenta técnica del servidor. Los roles de personas siguen siendo `tipo_usuario`: el backend debe validar rol y puesto para cada operación. La asignación a `administradores_puestos` no concede acceso por sí sola si el usuario no es administrador. Las vistas muestran el alcance de cada administrador, pero el servidor debe filtrarlas usando **el ID del usuario autenticado**, nunca un ID suministrado libremente por el cliente.

Ejemplos de SQL parametrizado para `mysql2`:

```sql
-- Registrar o corregir un total de fotos; el rol no puede escribir descartes.
INSERT INTO dias (id_puesto, fecha, fotos) VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE fotos = ?;

-- Registrar una cantidad adicional vendida. El precio se guarda como histórico.
INSERT INTO venta
  (id_dias, id_puesto, id_usuario, id_precios, cantidad, precio_unitario, clave_operacion)
VALUES (?, ?, ?, ?, ?, ?, ?);

-- Consultar rendimiento usando el usuario autenticado y el período solicitado.
SELECT * FROM v_rendimiento_administrador
WHERE id_administrador = ? AND fecha BETWEEN ? AND ?
ORDER BY fecha, id_puesto;

-- Incluir también los puestos autorizados sin ningún día registrado.
SELECT * FROM v_puestos_administrador WHERE id_administrador = ?;
```

Al guardar una venta, enviar una `clave_operacion` estable para todos los reintentos de la misma acción. La clave única evita duplicados; ante una colisión, comprobar que el registro existente corresponde al mismo contenido. No generar otra clave para reintentar la misma venta. `horarios` admite el mismo mecanismo. Un error de bloqueo o deadlock requiere reintentar la transacción completa; no presentar como confirmada una operación fallida.

En el primer ejemplo, enviar el mismo total de fotos en el tercer y cuarto parámetro. Los ejemplos de corrección y borrado describen la consistencia de la base; no conceden permisos funcionales a ningún tipo de usuario. Los cambios en `dias.fecha`, `dias.id_puesto` y la reasignación de ventas se rechazan para preservar su identidad histórica. Todas las claves foráneas usan eliminación restrictiva: no hay borrados en cascada que omitan los triggers de ventas. [Referencia de claves foráneas de MySQL](https://dev.mysql.com/doc/refman/8.4/en/create-table-foreign-keys.html).

Los informes suman las ventas antes de unirlas a los días, evitando multiplicar fotos tomadas cuando hay varias ventas. Un día sin ventas muestra cero vendido; un día sin conteo muestra `NULL` en fotos tomadas y descartes. Al resumir períodos, usar `SUM(fotos_vendidas) / NULLIF(SUM(fotos_tomadas), 0) * 100`, sin promediar porcentajes diarios; mostrar por separado los días sin conteo.

Las contraseñas y tokens se guardan como hashes generados por el backend. El esquema no implementa inicio de sesión: el servidor debe comprobar caducidad, revocación y finalidad de los tokens, y consumir los de un solo uso mediante una actualización condicional atómica. Iniciar o cerrar sesión no modifica horarios.

## Comprobación

`pruebas.sql` contiene comprobaciones transaccionales sobre conteos, ventas, correcciones, agrupación, idempotencia, rendimiento, asignaciones y horarios. Ejecutarlo con la cuenta instaladora después del esquema:

```sql
SOURCE C:/Users/Elias/Documents/GitHub/Proyecto-Final-FotoYa/database/pruebas.sql;
```

En caso de éxito devuelve un mensaje `OK`. Hace `ROLLBACK` de todos sus datos y elimina su procedimiento auxiliar; los valores `AUTO_INCREMENT` consumidos no se recuperan. Ante un fallo revierte los datos y propaga el error; si el cliente se detiene, puede quedar el procedimiento auxiliar `comprobar_foto_ya`, que debe eliminarse antes de reintentar. Usar una base de desarrollo sin escrituras simultáneas al ejecutar estas pruebas.

El script de pruebas no simula concurrencia. Para verificarla en dos conexiones de desarrollo, usar un día con 100 fotos y sin ventas: en la primera iniciar una transacción e insertar una venta de 70 sin confirmar; en la segunda insertar otra de 40 para el mismo día. La segunda debe esperar hasta el `COMMIT` de la primera y luego rechazar la venta, conservando 70 vendidas y 30 descartes. Si la primera hace `ROLLBACK`, la segunda puede guardar 40 y dejar 60 descartes.

La revisión realizada al crear estos archivos fue estática: se verificaron 12 tablas, 14 relaciones, 6 triggers y 3 vistas, los tipos de las claves y los delimitadores. No había un servidor MySQL disponible en `127.0.0.1:3306`, por lo que la importación y las pruebas SQL quedan sin ejecutar. Las restricciones y el uso de bloqueos se basan en la documentación de [CHECK](https://dev.mysql.com/doc/refman/8.4/en/create-table-check-constraints.html), [columnas generadas](https://dev.mysql.com/doc/refman/8.4/en/create-table-generated-columns.html) y [bloqueos de InnoDB](https://dev.mysql.com/doc/refman/8.4/en/innodb-locks-set.html).

## Reglas pendientes

El backend todavía debe definir quién corrige ventas y horarios, quién administra catálogos y usuarios, quién registra asistencia, los turnos y pausas admitidos y la fecha de referencia de un turno nocturno. Por eso se permiten varios horarios por empleado y día sin imponer una política de turnos. También faltan la finalidad de cada tipo de token y la duración o renovación de sesiones. Se conserva el evento actual del puesto del borrador; el historial de cambios de evento requiere una definición adicional.
