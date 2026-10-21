# Backend Foto Ya

Node.js 22+, Express 5, MySQL 8.0.16+ (InnoDB) y Supabase Storage. Supabase Storage utiliza su cliente oficial; MySQL utiliza su protocolo nativo con `mysql2`. Todas las rutas de la API reciben `POST`: JSON, excepto la carga de fotos que utiliza `multipart/form-data`.

## Inicio

Ejecutar desde `backend`:

```powershell
npm ci
Copy-Item .env.example .env
```

Completar las credenciales de MySQL y `SUPABASE_SECRET_KEY`. No se necesitan claves de cifrado ni de búsqueda para instalaciones nuevas.

### Error 403 al subir fotos en Render

Este backend usa `@supabase/supabase-js`, que necesita la URL del proyecto y una clave API de servidor. Las credenciales de S3 pertenecen a otro protocolo y no sirven para este cliente ([API keys](https://supabase.com/docs/guides/api/api-keys), [autenticación S3](https://supabase.com/docs/guides/storage/s3/authentication)). En Render → servicio del backend → Environment, configurar:

- `SUPABASE_URL=https://mjurenohqcxirsotdkrd.supabase.co` para el proyecto actual. No usar `https://mjurenohqcxirsotdkrd.storage.supabase.co/storage/v1/s3`.
- `SUPABASE_SECRET_KEY`: clave `sb_secret_...` del mismo proyecto, desde Settings → API Keys; también se admite la clave legacy `service_role`. No usar la Secret access key de S3 ni una clave publishable/anon.
- `SUPABASE_STORAGE_BUCKET=Fotos`, respetando exactamente el ID del bucket y sus mayúsculas.

Guardar las variables y volver a desplegar el backend. Editar el `.env` local no actualiza Render. El backend no requiere `SUPABASE_PUBLISHABLE_KEY`. La validación de inicio rechaza endpoints S3 y formatos de claves incompatibles sin mostrar el secreto; no comprueba si la clave existe o sigue vigente en Supabase. El bucket debe conservarse privado: la API autoriza cada operación y genera URLs temporales para las lecturas permitidas.

Crear previamente una base vacía con `utf8mb4`. Su usuario necesita permisos de DDL para las migraciones; para ejecutar la API basta una cuenta con SELECT, INSERT y UPDATE sobre las tablas de la aplicación. Usar una cuenta de migración separada en producción. `DB_SSL_CA_PATH` permite configurar TLS con un certificado CA para MySQL remoto.

```powershell
# Sólo sobre una base VACÍA: importa el esquema existente y aplica las extensiones.
npm run db:init
# Si ya se importó database/foto_ya.sql, usar EN SU LUGAR:
npm run db:migrate
```

El actualizador inspecciona columnas e índices existentes y aplica únicamente los cambios pendientes, sin tabla de historial. El esquema base permite `fotos.id_cliente = NULL`; también se crean las reservas persistentes de carga. Hacer copia de seguridad y detener la API antes de actualizar una base con datos. MySQL confirma DDL de manera implícita; el comando puede repetirse tras resolver un fallo.

Sólo las contraseñas se guardan hasheadas con scrypt. Nombre, apellido, email y DNI se guardan directamente; email se normaliza a minúsculas y DNI sin separadores, con índices únicos. La migración convierte contraseñas antiguas en texto a scrypt y rechaza hashes de formatos desconocidos.

La actualización adapta instalaciones anteriores: descifra los datos personales con la `DATA_ENCRYPTION_KEY` anterior (necesaria sólo para esa conversión), elimina hashes de búsqueda y cambia `token_hash` por `token`. Las sesiones y tokens anteriores se invalidan porque sus valores originales no se pueden recuperar; será necesario iniciar sesión otra vez. La antigua tabla de reservas de carga se elimina; las fotos confirmadas se conservan. No borrar la clave anterior hasta completar la conversión. Al terminar elimina `backend_locks` y `backend_migrations`; no vuelve a crearlas. Los cambios de usuarios se coordinan bloqueando las filas del catálogo de roles dentro de la transacción. Las asignaciones de permisos existentes se conservan.

Crear el primer dueño desde una terminal, dentro de `backend`:

```powershell
npm run owner:create
```

El asistente pide nombre, apellido, email, DNI y contraseña, y solicita repetir la contraseña. La contraseña no se muestra ni se guarda en el historial del asistente. Usar una contraseña de 12 a 128 caracteres y un DNI de 5 a 15 dígitos. `Ctrl+C` cancela antes de guardar. Al terminar muestra «Dueño creado» y permite ingresar con ese email y contraseña. Si algo falla, informa si faltan datos, si hay problemas de conexión/migraciones o si ya existe un dueño activo. No cambia contraseñas de cuentas existentes.

También sigue disponible el modo JSON por entrada estándar. Para ayuda: `npm run owner:create -- --help`. Por ejemplo, preparar un archivo temporal fuera del repositorio y luego eliminarlo:

```json
{"firstName":"Tu nombre","lastName":"Tu apellido","email":"tu-correo@example.com","dni":"12345678","password":"Reemplazar-esta-clave"}
```

```powershell
Get-Content -Raw 'C:\ruta\privada\dueno.json' | npm run owner:create -- --json
npm run dev
# Para ejecución sin recarga automática:
npm start
```

Si el comando solo mostraba una terminal en espera, la versión anterior estaba esperando un JSON y el fin de entrada sin mostrar instrucciones. Con el asistente, ejecutar `npm run owner:create` directamente en PowerShell muestra las preguntas. Si usás una terminal integrada sin TTY, abrí una terminal PowerShell normal o utilizá el archivo JSON.

El puerto predeterminado es 3000. Configurar `HOST=0.0.0.0` para acceder desde un dispositivo de la red. En producción servir la API detrás de HTTPS y configurar `CORS_ORIGINS` y el número exacto de proxies en `TRUST_PROXY`.

## Conexiones MySQL en Render

La API crea un único pool por proceso y lo comparte entre todas las rutas. `query`/`execute` devuelven la conexión automáticamente; las transacciones la liberan en `finally`. Varios clientes web o móviles comparten ese pool. Cada instancia, proceso local o comando de mantenimiento tiene su propio pool.

El valor predeterminado de `DB_CONNECTION_LIMIT` es **2 por proceso**. Las solicitudes adicionales esperan una conexión libre (cola máxima de 100). Se conserva como máximo una conexión ociosa, y `DB_IDLE_TIMEOUT_MS=10000` permite cerrar las restantes al quedar inactivas; la limpieza se revisa aproximadamente cada segundo. Con un límite de 1 también se activa la limpieza. Las conexiones ocupadas por consultas o transacciones no se cierran por inactividad.

`ER_TOO_MANY_USER_CONNECTIONS` indica que se alcanzó el límite de conexiones simultáneas del usuario de MySQL. El pool anterior permitía 10 por proceso y, al no configurar `maxIdle` por debajo del límite, mysql2 no activaba su limpieza de conexiones ociosas. Esto puede agotar una cuenta compartida entre Render, desarrollo y herramientas SQL. Render también puede mantener instancias viejas y nuevas durante un despliegue.

En el panel de Render, establecer explícitamente `DB_CONNECTION_LIMIT=2` y `DB_IDLE_TIMEOUT_MS=10000`, y volver a desplegar. Una variable existente con valor 10 prevalece sobre el nuevo valor predeterminado. Ajustar el límite según la cuota real del proveedor: `procesos simultáneos × DB_CONNECTION_LIMIT + conexiones de otras herramientas` debe dejar margen dentro de esa cuota, incluyendo instancias temporales de despliegue. Si la cuota es muy pequeña, usar 1 y limitar los otros procesos que comparten la cuenta.

Para confirmar el consumo, ejecutar con una herramienta SQL autorizada:

```sql
SHOW VARIABLES LIKE 'max_user_connections';
SHOW GRANTS FOR CURRENT_USER;
SHOW PROCESSLIST;
```

El proveedor puede aplicar una cuota específica de cuenta distinta del valor global. Revisar las sesiones visibles del mismo usuario, sus hosts y su estado `Sleep`; cerrar sólo sesiones identificadas como propias e innecesarias. No aumentar la cuota ni finalizar sesiones ajenas como solución automática. No hace falta modificar el esquema de datos.

Referencias: [pool de mysql2](https://sidorares.github.io/node-mysql2/docs/examples/connections/create-pool), [despliegues de Render](https://render.com/docs/deploys).

## Organización

- `src/config`: entorno validado, conexiones y matriz inicial de permisos.
- `src/modules`: rutas, validaciones, consultas y servicios separados por función.
- `src/security`: hash de contraseñas, autenticación y alcance por puesto.
- `src/integrations`: Axios para Supabase Storage.
- `src/shared`: validación, errores y transacciones.
- `scripts`: migraciones y creación inicial del dueño; utilidades separadas en `scripts/lib`.
- `tests`: seguridad y pruebas de API con una base temporal independiente.

## Contrato de la API

### Gestión de puestos

Después de actualizar, ejecutar `npm run db:migrate`: agrega `puesto.disponible` (los puestos existentes quedan activos) y el permiso `stations.manage` al dueño. La sección **Puestos** permite crear, dar de baja y reactivar puestos. La baja conserva usuarios asignados, fotos, ventas y horarios; bloquea nuevas cargas y nuevas asignaciones de usuarios al puesto. Los registros históricos siguen disponibles en las consultas y filtros.

- `POST /api/catalog/stations/create`: `{ name, address, city, event }`. Evento opcional; ciudad y evento se reutilizan por nombre o se crean si faltan. Rechaza duplicados del mismo nombre, dirección, ciudad y evento, incluso inactivos.
- `POST /api/catalog/stations/availability`: `{ stationId, active }`. Reversible e idempotente. Requiere dueño y permiso `stations.manage`, revalidados dentro de la transacción.
- `POST /api/catalog/query` con `resource: 'stations'` incluye `active` y conserva los puestos inactivos para consulta histórica.

Las respuestas exitosas usan `{ "data": ... }`; los errores `{ "error": { "code", "message", "requestId" } }`. Los listados devuelven un array. Paginación: `limit` (1–100, predeterminado 30), `offset` (predeterminado 0). Una página con menos elementos que `limit` indica el final. Los identificadores se envían como strings; los IDs de catálogo también deben convertirse a strings al usarlos como entrada. Los importes DECIMAL y algunos agregados se entregan como strings para conservar precisión.

Salvo `/api/health` y `/api/auth/login`, enviar `Authorization: Bearer <token>`. El actor siempre se obtiene de la sesión; nunca se acepta un actor enviado en el cuerpo. Los campos desconocidos se rechazan. `OPTIONS` queda disponible para CORS, y GET responde 405.

| Ruta POST | Cuerpo / función |
| --- | --- |
| `/api/health` | `{}`; confirma que el proceso atiende solicitudes, sin sondear servicios externos |
| `/api/auth/login` | `email`, `password`; entrega token de sesión una sola vez |
| `/api/auth/me` | `{}`; perfil y permisos efectivos |
| `/api/auth/logout` | `{}`; revoca la sesión actual |
| `/api/auth/sessions/query` | Paginación; lista sesiones propias sin tokens |
| `/api/auth/sessions/revoke` | `sessionId`; revoca una sesión propia |
| `/api/auth/password/change` | `currentPassword`, `password`; cambia contraseña y revoca todas las sesiones |
| `/api/users/query` | Paginación y filtros opcionales `stationId`, `email`, `dni`, `active` |
| `/api/users/detail` | `userId` |
| `/api/users/create` | `firstName`, `lastName`, `email`, `dni`, `password`, `roleId`, `stationId` (nullable) |
| `/api/users/update` | `userId` y todos los campos del alta excepto password; revoca sesiones del usuario modificado |
| `/api/users/availability` | `userId`, `active`; baja o reactivación preservando historial |
| `/api/catalog/query` | `resource`: `stations`, `cities`, `events`, `roles` o `prices`; paginación y `stationId` opcional |
| `/api/photos/query` | Período, paginación y `clientId` o `unassigned: true` opcionales; cliente siempre limitado a sí mismo |
| `/api/photos/detail` | `photoId`; metadatos sin ruta privada del archivo |
| `/api/photos/access` | `photoId`; autoriza y firma una URL temporal de consulta |
| `/api/photos/upload` | Multipart: `photo` (archivo), `stationId` y `clientId` opcional |
| `/api/photos/assign` | JSON: `photoId`, `clientEmail`; guarda el mail y asocia si existe una cuenta cliente activa |
| `/api/sales/query` | Período y paginación; cabeceras sin multiplicar totales |
| `/api/sales/detail` | `saleId`; cabecera, fotos y tarifas históricas consultadas por separado |
| `/api/sales/event` | `stationId`; estado y fecha del evento de ventas |
| `/api/sales/event/set` | `stationId`, `open`; apertura/cierre manual por el encargado del puesto |
| `/api/sales/photos` | `stationId`, `photoId` opcional, paginación; fotos del día actual argentino y del puesto, con ventas abiertas |
| `/api/sales/photos/access` | `photoId`; URL temporal para previsualizar con permiso `sales.create` y alcance por puesto |
| `/api/sales/photos/assign` | `photoId`, `clientEmail`; guardado desde el evento abierto con permiso `sales.create` |
| `/api/sales/photos/sold/access` | `saleId`, `photoId`; vista previa de una foto vinculada a una venta autorizada, con permiso `sales.read` |
| `/api/sales/create` | `operationId` UUID, `stationId`, `photoId`, `paymentMethod`, `prices: [{ priceId, copies }]` |
| `/api/catalog/prices/query` | `stationId`, paginación; precios activos e inactivos del puesto; requiere `prices.manage` |
| `/api/catalog/prices/create` | `stationId`, `name`, `amount` decimal como string; dueño o encargado con `prices.manage` |
| `/api/catalog/prices/update` | `stationId`, `priceId`, `name`, `amount`; conserva los importes de ventas anteriores |
| `/api/catalog/prices/availability` | `stationId`, `priceId`, `active`; baja y reactivación de tarifas |
| `/api/attendance/query` | Período, paginación y `userId` opcional; usa el puesto histórico del día |
| `/api/attendance/mine` | Período y paginación; registros propios |
| `/api/attendance/kiosk/enter` | Sin campos; encargado con puesto activa el modo de check-in en su sesión |
| `/api/attendance/kiosk/employees` | Paginación; empleados activos del puesto, nombre, apellido, `working` y `attendanceId` |
| `/api/attendance/kiosk/mark` | `userId`, `email`, `password`, `action` (`check-in`/`check-out`) y `attendanceId` esperado (null para entrada) |
| `/api/attendance/kiosk/exit` | `password` del encargado que activó la vista; desbloquea su sesión |
| `/api/reports/query` | Período, paginación y filtros opcionales `cityId`, `eventId`; rendimiento por puesto |
| `/api/reports/summary` | Mismos filtros; totales de todo el alcance, independientes de la paginación |
| `/api/reports/days/query` | Período y paginación; conteos diarios y descartes calculados |

Período: `from` y `to` en formato `YYYY-MM-DD`, inclusivos, máximo 367 días; `stationId` opcional. Las fechas de negocio provienen de `Dias.fecha`. Los instantes de sesiones y horarios se guardan y consultan en UTC; el frontend debe interpretar los DATETIME recibidos como UTC antes de convertirlos a Argentina.

Cada foto representa una familia. Las consultas diarias calculan `descartes = fotos - SUM(IF(venta.familia_contada, venta.cantidad, 0))`: las copias y las compras adicionales de una foto no incrementan las familias que compraron. Los informes incluyen puestos sin registros: `taken`, `discarded` y `percentage` son NULL cuando faltan días del período, mientras `registeredTaken` conserva las fotos de los días registrados. `revenue` son ingresos por ventas; no se presentan como ganancias netas sin una definición de costos. `invalidDays` señala días con ventas superiores a fotos; esa inconsistencia no se compensa con otros días. El porcentaje global se calcula sobre las sumas, sin promediar porcentajes.

## Ventas en eventos y tarifas por puesto

Ejecutar `npm run db:migrate` antes de iniciar esta versión. La migración agrega `precios.id_puesto`, disponibilidad de tarifas, pago/copias/vendedor e identificación de reintentos en las ventas. También elimina la antigua tabla `event_sales`: la apertura/cierre por puesto ahora vive en memoria del backend. Conserva las ventas y tarifas históricas sin reinterpretar sus cantidades. En bases anteriores, los precios sin puesto quedan con `id_puesto = NULL` y no se ofrecen para vender: asignar cada tarifa a su puesto explícitamente o crear las nuevas desde **Puestos → Precios del puesto**. En instalaciones nuevas `id_puesto` es obligatorio; la API exige puesto para todo precio nuevo. No se copian automáticamente tarifas a todos los puestos.

El dueño y el encargado administran tarifas desde **Precios** con el permiso `prices.manage`; el encargado sólo consulta y modifica las de su puesto. El dueño conserva el acceso desde **Puestos → Precios del puesto**. La migración agrega el permiso a estos dos roles al incorporarlo por primera vez, sin restablecerlo si se revoca después. Las consultas de usuarios, horarios, informes, fotos y ventas del encargado se limitan a su puesto; su asistencia propia también respeta ese alcance.

El encargado abre o cierra las ventas de su puesto desde **Registrar venta en evento**. La apertura se guarda en una caché en memoria por puesto y corresponde al día actual de Argentina. Al reiniciar o desplegar el backend, todos los puestos quedan cerrados. Ejecutar una sola instancia/proceso del backend: esta caché no se comparte entre réplicas. Las aperturas, cierres, ventas y asignaciones se coordinan por puesto; el estado se publica después de confirmar la transacción. Al cruzar medianoche, la apertura anterior deja de habilitar ventas: es necesario abrir las del nuevo día. Se listan, previsualizan y venden únicamente fotos de ese puesto tomadas el día actual. Este flujo no registra ventas fuera del evento; esa categoría e interfaz quedan para una implementación independiente.

El vendedor o encargado elige una foto, toca **Vender**, ingresa copias por tarifa y selecciona `efectivo`, `transferencia` o `tarjeta`. Se registra el método; no se procesa un cobro electrónico. La API rechaza eventos cerrados, puestos inactivos, fotos ajenas al evento, tarifas de otros puestos/no disponibles y ventas sin tarifas. Calcula el total en centavos enteros con los precios actuales del servidor y conserva cada importe unitario aplicado. Cabecera, foto, tarifas y conteos se confirman en una transacción. Las compras adicionales generan operaciones e ingresos, pero `familia_contada = false`, conservando el porcentaje. `quantity` en las consultas representa familias contabilizadas; `copies` informa las copias físicas.

Conservar el mismo `operationId` y contenido al reintentar una venta: recupera su resultado sin duplicar datos, incluso si el evento ya cerró. Reutilizarlo con otro contenido devuelve 409. Las ventas simultáneas de una foto contabilizan la familia una sola vez.

## Seguridad y Supabase

Contraseñas con scrypt (sal aleatoria, N=131072, r=8, p=1). Tokens de sesión aleatorios de 256 bits guardados sin hash. Los demás datos de la aplicación se almacenan sin hashes ni cifrado. La API sigue validando permisos, disponibilidad, vencimiento y revocación de sesiones; los listados de sesiones no exponen tokens.

Los roles iniciales son `dueno`, `encargado`, `secretario`, `camarografo`, `vendedor` y `cliente`. Los permisos efectivos se consultan en `permisos_rol` en cada petición. Dueño y secretario tienen el alcance global definido para sus consultas; encargado y personal operativo quedan limitados a su puesto. El cliente sólo consulta sus fotos. Un puesto NULL nunca concede alcance global. El encargado no asigna roles globales ni administra usuarios fuera de su puesto. La API impide cambiar la propia asignación o desactivar la propia cuenta. Cambiar permisos en MySQL tiene efecto en la siguiente solicitud; el seed inicial no restablece asignaciones en cada migración.

El `.env.example` usa el proyecto Supabase **Foto Ya**, con bucket privado existente **Fotos**. La clave secreta sólo pertenece al backend. La autorización se hace en MySQL antes de pedir la firma; no crear políticas de lectura pública ni hacer público el bucket. Las URLs firmadas son capacidades temporales: duran 60 segundos por defecto (máximo configurable 300) y una URL ya emitida no se revoca al cerrar la sesión. La firma y carga usan el cliente oficial de Supabase; el navegador carga la imagen mediante GET propio de Supabase. Los archivos nuevos se suben con caché de cero segundos. [Referencia de acceso a archivos privados](https://supabase.com/docs/guides/storage/serving/downloads).

## Carga y asignación de fotos

El camarógrafo y el encargado cargan y asignan fotos dentro de su puesto. Se admiten JPG, PNG y WebP de hasta 6 MiB, verificando la firma binaria del contenido. El nombre enviado por el usuario no determina la ruta de almacenamiento: se genera una ruta aleatoria. Cada solicitud carga una foto.

El campo `clientId` puede omitirse o enviarse vacío: la foto queda con `id_cliente = NULL`. Si se envía, debe identificar una cuenta cliente existente y disponible; no se exige que el cliente tenga un puesto asignado. Una foto sin cliente permanece visible sólo al personal con permiso y alcance sobre su puesto. Ningún cliente puede listarla, ver sus metadatos ni obtener una URL.

Para localizar pendientes, usar `/photos/query` con `unassigned: true`. `/photos/assign` permite asignarlas después. Repetir la asignación al mismo cliente es válido; cambiarla a otro cliente responde 409 porque la reasignación no está definida. Dos asignaciones concurrentes a clientes distintos no se sobrescriben. Asignar no vuelve a cargar el archivo ni cambia conteos o ventas.

Cada solicitud sube una foto nueva. La fecha se calcula después de que Storage confirme la carga, en `America/Argentina/Buenos_Aires`. La referencia, el incremento de fotos y los descartes se guardan en una transacción MySQL; la carga no registra una venta.

Ejemplo del cuerpo multipart desde un cliente que usa Axios:

```javascript
const form = new FormData();
form.append('photo', file);
form.append('stationId', stationId);
if (clientId) form.append('clientId', clientId);
await axios.post('/api/photos/upload', form, {
  headers: { Authorization: `Bearer ${token}` },
});
```

Las imágenes se guardan exclusivamente en Storage. MySQL conserva los metadatos en `fotos`, sin reservas de carga ni copias Base64. Se validan permisos, puesto, cliente y archivo antes de subir. Si falla Storage o el registro en MySQL, se intenta eliminar el archivo nuevo y se devuelve el error original. Antes de borrar se comprueba que la foto no haya quedado registrada, para proteger un COMMIT confirmado cuya respuesta se perdió. Si la comprobación o el borrado fallan, puede quedar un archivo suelto; no hay reconciliación automática.

Cada reenvío es una carga independiente: si se pierde la respuesta de una carga confirmada, repetirla puede duplicar la foto. `npm run db:migrate` elimina la antigua tabla `photo_uploads`, incluidas sus copias Base64; conserva las fotos registradas y no borra archivos de Storage. Aplicar con la API detenida. El comando `photos:reconcile` fue retirado.

## Operaciones pendientes por decisión del usuario

La asistencia se registra exclusivamente desde `/api/attendance/kiosk/*`. Las rutas anteriores `/api/attendance/check-in` y `/api/attendance/check-out` rechazan con `403 KIOSK_REQUIRED`.

Ejecutar `npm run db:migrate` antes de desplegar esta versión: agrega `sesiones_usuario.check_in_mode` y un índice de horarios abiertos. En modo check-in la sesión del encargado sólo puede consultar su perfil y operar la vista; tampoco permite logout, cambios de contraseña ni revocación de sesiones hasta validar su contraseña. Cada marcación verifica el mail y contraseña del empleado seleccionado, activo y del mismo puesto, sin cambiar de sesión. La transacción serializa marcaciones y cambios de asignación; los reintentos con estado anterior se rechazan con `409 ATTENDANCE_CHANGED`.

Las entradas usan el día de Argentina y horas UTC del servidor. Se permite volver a entrar después de una salida y un turno puede cruzar medianoche: su día y puesto siguen siendo los de entrada. Una jornada abierta en otro puesto debe cerrarse antes de abrir otra. Camarógrafos, vendedores y secretarios necesitan una jornada abierta en su puesto actual para acceder a operaciones; fuera de jornada conservan su perfil y administración de su cuenta. El dueño, encargado y cliente no requieren jornada para usar la aplicación. Un secretario sin puesto asignado necesita que el dueño se lo asigne para poder marcar. El estado se verifica en cada petición, incluyendo sesiones de otros dispositivos.


## Pruebas

Antes de desplegar los cambios de fotos, ejecutar `npm run db:migrate`: agrega `fotos.email_cliente` sin modificar las asociaciones existentes. `photos/assign` recibe `{ photoId, clientEmail }`; ya no recibe un ID de cliente. Guarda el mail normalizado aunque todavía no exista una cuenta. Si corresponde a un cliente activo, vincula la foto; si la cuenta se crea después, volver a guardar el mismo mail para asociarla. No se crean cuentas ni se envían correos desde este flujo. Una foto ya vinculada conserva su cliente.

Los vendedores guardan el mail mediante `sales/photos/assign`, con permiso `sales.create`, puesto autorizado y evento vigente abierto. No se amplían sus permisos sobre la galería general. `sales/photos/sold/access` autoriza la foto contra el detalle de una venta antes de generar su acceso temporal.

Las vistas previas de fotos nuevas y existentes se generan al primer acceso usando sharp: WebP de hasta 960 × 960 px, proporciones conservadas, calidad 60 y sin metadatos EXIF. Se almacenan en `previews/v1/` dentro del mismo bucket privado y se reutilizan. Las URLs temporales sólo entregan esa copia; el original se conserva sin cambios. No requiere las transformaciones de imágenes del plan Pro de Supabase.

```powershell
npm test
# Contra un servidor de prueba: requiere permiso para crear y borrar bases.
$env:TEST_DB_PORT='33307'
$env:TEST_DB_USER='root'
$env:TEST_DB_PASSWORD=''
npm run test:integration
```

La integración crea una base `foto_ya_test_<aleatorio>` y la elimina al terminar; ignora `DB_NAME` del entorno de la aplicación. Sin `TEST_DB_PORT`, los casos de integración se omiten explícitamente. Se verifican permisos, aislamiento de clientes, sesiones, datos sin hash, bajas reversibles, precios históricos, conteos, migraciones, cargas con/sin cliente, asignación concurrente, reintentos y fallos parciales (incluida la pérdida de confirmación de COMMIT). Storage se simula en estas pruebas; no se afirma probar archivos reales en Supabase sin la clave de servidor. Se validó SQL sobre MariaDB 10.4.32 local compatible; resta ejecutar la suite en el servidor MySQL de destino.

## Cómo seguir el código

`server.js` inicia el servidor y `app.js` conecta las rutas. Cada archivo de rutas importa el servicio que usa; los servicios importan sus repositorios. No hay que crear servicios ni pasar `db`, `storage` o `env` entre capas.

`src/config/env.js` valida y exporta la configuración una sola vez. `src/config/database.js` exporta el pool compartido `db`. `src/integrations/storage.js` exporta `uploadFile`, `removeFile` y `signedUrl`, siguiendo las operaciones del [cliente de Supabase](https://supabase.com/docs/reference/javascript/storage-from-upload).

`transaction(callback)` abre una transacción y entrega su conexión al callback. Esa conexión sí se pasa a las consultas que deben confirmarse juntas; es necesaria para la consistencia de los datos. Las migraciones también reciben la conexión sobre la que trabajan.

Los reemplazos de red, base de datos y reloj usados para probar pertenecen a `tests`; no se agregan parámetros a los servicios para permitirlos.

## Registro de clientes, Auth0 y Mailtrap

Ejecutar `npm run db:migrate` antes de iniciar esta versión. Agrega `usuarios.email_verified` (las cuentas existentes se conservan verificadas), `usuarios.auth0_sub`, los campos de verificación de correo en `tokens_autenticacion` y los permisos `clients.read`/`clients.manage`, inicialmente para el dueño. Las cuentas nuevas se crean exclusivamente como cliente y sin puesto; no reciben sesión hasta confirmar el correo.

Configurar `MAIL_API_KEY`, `MAIL_INBOX_ID` y `SENDER` según el sandbox de Mailtrap, como en RN1. El cliente usa siempre `sandbox: true`: los mensajes se consultan en el inbox de pruebas de Mailtrap y no se entregan a la casilla real. No hay credenciales de estos servicios en RN1 adjunto; sus `.env.example` son referencias, no configuraciones operativas.

Configurar `AUTH0_DOMAIN` (hostname sin protocolo) y `AUTH0_CLIENT_IDS` (IDs Native y SPA separados por coma). Habilitar las conexiones Google (`google-oauth2`), GitHub (`github`) y Apple (`apple`) en ambas aplicaciones de Auth0. El backend valida firma RS256/JWKS, issuer, audiencia y vencimiento del ID token; nunca toma correo, rol o ID social declarados por el frontend. Las identidades sociales se vinculan por `sub`, y no se fusionan automáticamente con cuentas existentes que compartan correo. El registro social pide nombre, apellido y DNI y también confirma correo mediante el código local.

Todas estas rutas usan POST y el envelope habitual:

| Ruta | Cuerpo y resultado |
| --- | --- |
| `auth/register` | `{ firstName, lastName, email, dni, password }` → `{ verificationToken, email, expiresIn }` |
| `auth/social` | `{ idToken, firstName?, lastName?, dni? }` → sesión, verificación o `{ registrationRequired: true, email }` |
| `auth/verification/start` | `{ email, password }` → reinicia verificación de una cuenta local pendiente |
| `auth/verification/resend` | `{ verificationToken }` → nuevo desafío; invalida el anterior |
| `auth/verification/confirm` | `{ verificationToken, code }` → confirma correo y crea sesión |
| `clients/query` | `{ search?: string, offset?: number }` → `{ clients, hasMore }`; 20 filas, offset múltiplo de 20 |
| `clients/deactivate` | `{ clientId }` → `{ deactivated: true }` |

El código tiene seis dígitos, vence en diez minutos y admite cinco intentos. El reenvío espera un minuto; estas rutas tienen límite por IP. Se guarda un digest del desafío y del código combinado con el desafío aleatorio; no se guarda el código en claro ni se devuelve en la API. Un fallo del correo revierte el registro/reenvío. Si se cierra el formulario, el usuario local puede continuar entrando con sus credenciales; el social puede volver a entrar con el mismo proveedor.

`clients/query` devuelve únicamente clientes disponibles, busca por coincidencia parcial de correo o DNI y usa una fila adicional para `hasMore`. La baja conserva la fila y el historial, pone `disponible=FALSE` y revoca sesiones y tokens, incluida la verificación pendiente. Se revalida el permiso dentro de la transacción.

Quedan pendientes ganancias netas, recuperación de contraseña, correcciones/auditoría de operaciones y administración de catálogos/permisos desde la API. El frontend se conecta por HTTP a esta API; las simulaciones sólo se usan en `frontend/tests/support`.

La verificación de correo usa `tokens_autenticacion` con `tipo = 'email_verification'`: `token` contiene el digest del desafío, `code_hash` el digest del código vinculado al desafío, y `sent_at`/`attempts` controlan reenvíos e intentos. Se conserva una fila por usuario para este tipo; los demás tipos admiten varias. La confirmación marca `used_at` y el reenvío reemplaza el desafío. `db:migrate` copia las verificaciones de la antigua `client_verifications`, conserva códigos, fechas e intentos y elimina esa tabla después de confirmar la copia. Ejecutar con la API detenida y respaldo previo.
