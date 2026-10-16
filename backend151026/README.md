# Backend Foto Ya

Node.js 22+, Express 5, MySQL 8.0.16+ (InnoDB) y Supabase Storage. Conexiones HTTP mediante Axios; MySQL utiliza su protocolo nativo con `mysql2`. Todas las rutas de la API reciben `POST`: JSON, excepto la carga de fotos que utiliza `multipart/form-data`.

## Inicio

Ejecutar desde `backend`:

```powershell
npm ci
Copy-Item .env.example .env
```

Completar las credenciales de MySQL y `SUPABASE_SECRET_KEY`. No se necesitan claves de cifrado ni de búsqueda para instalaciones nuevas.

Crear previamente una base vacía con `utf8mb4`. Su usuario necesita permisos de DDL para las migraciones; para ejecutar la API basta una cuenta con SELECT, INSERT y UPDATE sobre las tablas de la aplicación. Usar una cuenta de migración separada en producción. `DB_SSL_CA_PATH` permite configurar TLS con un certificado CA para MySQL remoto.

```powershell
# Sólo sobre una base VACÍA: importa el esquema existente y aplica las extensiones.
npm run db:init
# Si ya se importó database/foto_ya.sql, usar EN SU LUGAR:
npm run db:migrate
```

El actualizador inspecciona columnas e índices existentes y aplica únicamente los cambios pendientes, sin tabla de historial. El esquema base permite `fotos.id_cliente = NULL`; también se crean las reservas persistentes de carga. Hacer copia de seguridad y detener la API antes de actualizar una base con datos. MySQL confirma DDL de manera implícita; el comando puede repetirse tras resolver un fallo.

Sólo las contraseñas se guardan hasheadas con scrypt. Nombre, apellido, email y DNI se guardan directamente; email se normaliza a minúsculas y DNI sin separadores, con índices únicos. La migración convierte contraseñas antiguas en texto a scrypt y rechaza hashes de formatos desconocidos.

La actualización adapta instalaciones anteriores: descifra los datos personales con la `DATA_ENCRYPTION_KEY` anterior (necesaria sólo para esa conversión), elimina hashes de búsqueda y cambia `token_hash` por `token`. Las sesiones y tokens anteriores se invalidan porque sus valores originales no se pueden recuperar; será necesario iniciar sesión otra vez. Las reservas de carga anteriores se conservan para reconciliación, pero sus UUID no pueden reutilizarse porque sólo guardaban hashes: requieren una nueva operación. No borrar la clave anterior hasta completar la conversión. Al terminar elimina `backend_locks` y `backend_migrations`; no vuelve a crearlas. Los cambios de usuarios se coordinan bloqueando las filas del catálogo de roles dentro de la transacción. Las asignaciones de permisos existentes se conservan.

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

## Organización

- `src/config`: entorno validado, conexiones y matriz inicial de permisos.
- `src/modules`: rutas, validaciones, consultas y servicios separados por función.
- `src/security`: hash de contraseñas, autenticación y alcance por puesto.
- `src/integrations`: Axios para Supabase Storage.
- `src/shared`: validación, errores y transacciones.
- `scripts`: migraciones y creación inicial del dueño; utilidades separadas en `scripts/lib`.
- `tests`: seguridad y pruebas de API con una base temporal independiente.

## Contrato de la API

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
| `/api/photos/upload` | Multipart: `photo` (archivo), `operationId` (UUID), `stationId` y `clientId` opcional |
| `/api/photos/assign` | JSON: `photoId`, `clientId`; asigna un cliente a una foto sin asignar |
| `/api/sales/query` | Período y paginación; cabeceras sin multiplicar totales |
| `/api/sales/detail` | `saleId`; cabecera, fotos y tarifas históricas consultadas por separado |
| `/api/attendance/query` | Período, paginación y `userId` opcional; usa el puesto histórico del día |
| `/api/attendance/mine` | Período y paginación; registros propios |
| `/api/reports/query` | Período, paginación y filtros opcionales `cityId`, `eventId`; rendimiento por puesto |
| `/api/reports/summary` | Mismos filtros; totales de todo el alcance, independientes de la paginación |
| `/api/reports/days/query` | Período y paginación; conteos diarios y descartes calculados |

Período: `from` y `to` en formato `YYYY-MM-DD`, inclusivos, máximo 367 días; `stationId` opcional. Las fechas de negocio provienen de `Dias.fecha`. Los instantes de sesiones y horarios se guardan y consultan en UTC; el frontend debe interpretar los DATETIME recibidos como UTC antes de convertirlos a Argentina.

Las consultas diarias calculan `descartes = fotos - SUM(venta.cantidad)`. Los informes incluyen puestos sin registros: `taken`, `discarded` y `percentage` son NULL cuando faltan días del período, mientras `registeredTaken` conserva las fotos de los días registrados. `revenue` son ingresos por ventas; no se presentan como ganancias netas sin una definición de costos. `invalidDays` señala días con ventas superiores a fotos; esa inconsistencia no se compensa con otros días. El porcentaje global se calcula sobre las sumas, sin promediar porcentajes.

## Seguridad y Supabase

Contraseñas con scrypt (sal aleatoria, N=131072, r=8, p=1). Tokens de sesión aleatorios de 256 bits guardados sin hash. Los demás datos de la aplicación se almacenan sin hashes ni cifrado. La API sigue validando permisos, disponibilidad, vencimiento y revocación de sesiones; los listados de sesiones no exponen tokens.

Los roles iniciales son `dueno`, `encargado`, `secretario`, `camarografo`, `vendedor` y `cliente`. Los permisos efectivos se consultan en `permisos_rol` en cada petición. Dueño y secretario tienen el alcance global definido para sus consultas; encargado y personal operativo quedan limitados a su puesto. El cliente sólo consulta sus fotos. Un puesto NULL nunca concede alcance global. El encargado no asigna roles globales ni administra usuarios fuera de su puesto. La API impide cambiar la propia asignación o desactivar la propia cuenta. Cambiar permisos en MySQL tiene efecto en la siguiente solicitud; el seed inicial no restablece asignaciones en cada migración.

El `.env.example` usa el proyecto Supabase **Foto Ya**, con bucket privado existente **Fotos**. La clave secreta sólo pertenece al backend. La autorización se hace en MySQL antes de pedir la firma; no crear políticas de lectura pública ni hacer público el bucket. Las URLs firmadas son capacidades temporales: duran 60 segundos por defecto (máximo configurable 300) y una URL ya emitida no se revoca al cerrar la sesión. La firma y carga usan POST con Axios; el navegador carga la imagen mediante GET propio de Supabase. Los archivos nuevos se suben con caché de cero segundos. [Referencia de acceso a archivos privados](https://supabase.com/docs/guides/storage/serving/downloads).

## Carga y asignación de fotos

El camarógrafo y el encargado cargan y asignan fotos dentro de su puesto. Se admiten JPG, PNG y WebP de hasta 6 MiB, verificando la firma binaria del contenido. El nombre enviado por el usuario no determina la ruta de almacenamiento: se genera una ruta aleatoria. Cada solicitud carga una foto.

El campo `clientId` puede omitirse o enviarse vacío: la foto queda con `id_cliente = NULL`. Si se envía, debe identificar una cuenta cliente existente y disponible; no se exige que el cliente tenga un puesto asignado. Una foto sin cliente permanece visible sólo al personal con permiso y alcance sobre su puesto. Ningún cliente puede listarla, ver sus metadatos ni obtener una URL.

Para localizar pendientes, usar `/photos/query` con `unassigned: true`. `/photos/assign` permite asignarlas después. Repetir la asignación al mismo cliente es válido; cambiarla a otro cliente responde 409 porque la reasignación no está definida. Dos asignaciones concurrentes a clientes distintos no se sobrescriben. Asignar no vuelve a cargar el archivo ni cambia conteos o ventas.

Enviar un `operationId` UUID nuevo por foto y conservarlo al reintentar, junto con el mismo archivo, puesto y cliente inicial. Cambiar estos datos con el mismo UUID devuelve 409. Una respuesta perdida o dos solicitudes concurrentes no crean dos fotos ni incrementan dos veces el conteo. La fecha se calcula después de que Storage confirme la carga, en `America/Argentina/Buenos_Aires`. La referencia, el incremento de fotos, los descartes y la confirmación de la reserva se guardan en una transacción MySQL; la carga no registra una venta.

Ejemplo del cuerpo multipart desde un cliente que usa Axios:

```javascript
const form = new FormData();
form.append('photo', file);
form.append('operationId', operationId); // Conservar este UUID para los reintentos.
form.append('stationId', stationId);
if (clientId) form.append('clientId', clientId);
await axios.post('/api/photos/upload', form, {
  headers: { Authorization: `Bearer ${token}` },
});
```

`photo_uploads` conserva la solicitud original (puesto, cliente, contenido en base64 y bucket) y la ruta reservada antes de contactar Storage, sin hashing. Esta comparación exacta conserva la detección de reintentos con archivos diferentes y supone guardar una copia adicional del contenido en la reserva. El archivo consultable sigue almacenado en Storage. Si falla el almacenamiento o MySQL, la carga no se presenta como exitosa. Un reintento reconcilia el archivo incompleto de esa reserva antes de volver a subirlo, bajo bloqueo. Si COMMIT se confirmó pero se perdió su respuesta, el reintento recupera la foto ya registrada.

Para reconciliar archivos parciales de operaciones que el cliente abandonó, ejecutar `npm run photos:reconcile`. Procesa hasta 100 reservas sin confirmar y sin intentos durante al menos cinco minutos; se puede repetir. Sólo elimina archivos de esas reservas, conserva su identificación para reintentos y nunca elimina una foto confirmada. No hay una tarea programada automáticamente. Ejecutar este comando con una cuenta de mantenimiento que pueda SELECT/UPDATE sobre estas tablas y con la misma configuración de bucket.

## Operaciones pendientes por decisión del usuario

Estas rutas están protegidas y responden **501 `BUSINESS_RULES_PENDING`**, sin escribir datos:

- `/api/sales/create`: falta definir las ventas repetidas/copias y el alcance temporal de las fotos vendidas; requerirá transacción con cabecera, fotos y tarifas históricas.
- `/api/attendance/check-in` y `/api/attendance/check-out`: falta definir quién marca, turnos/pausas y día de referencia al cruzar medianoche.

También quedan por definir ganancias netas, recuperación de contraseña y entrega de tokens de un solo uso, correcciones/auditoría de operaciones y administración de catálogos/permisos desde la API. El frontend conserva su adaptador de prueba actual; la conexión con esta API es un paso posterior.

## Pruebas

```powershell
npm test
# Contra un servidor de prueba: requiere permiso para crear y borrar bases.
$env:TEST_DB_PORT='33307'
$env:TEST_DB_USER='root'
$env:TEST_DB_PASSWORD=''
npm run test:integration
```

La integración crea una base `foto_ya_test_<aleatorio>` y la elimina al terminar; ignora `DB_NAME` del entorno de la aplicación. Sin `TEST_DB_PORT`, los casos de integración se omiten explícitamente. Se verifican permisos, aislamiento de clientes, sesiones, datos sin hash, bajas reversibles, precios históricos, conteos, migraciones, cargas con/sin cliente, asignación concurrente, reintentos y fallos parciales (incluida la pérdida de confirmación de COMMIT). Storage se simula en estas pruebas; no se afirma probar archivos reales en Supabase sin la clave de servidor. Se validó SQL sobre MariaDB 10.4.32 local compatible; resta ejecutar la suite en el servidor MySQL de destino.
