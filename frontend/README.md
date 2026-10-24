# Foto Ya · Frontend

Aplicación Expo SDK 58 con TypeScript y Expo Router, conectada a la API Express existente.

## Ejecutar

Desde `frontend`:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run web
# Android/iOS con Expo:
npm start
```

En `.env.local`, configurar `EXPO_PUBLIC_API_URL` incluyendo `/api`. Para web local: `http://localhost:3000/api`; emulador Android: `http://10.0.2.2:3000/api`; teléfono físico: `http://IP-LAN-DE-LA-PC:3000/api`. En teléfono, la API debe escuchar en `0.0.0.0` y ser accesible desde esa red. En producción usar HTTPS. Las variables `EXPO_PUBLIC_*` son públicas: nunca incluir claves de MySQL ni de Storage.

Iniciar el backend siguiendo `../backend/README.md`: requiere MySQL configurado, esquema migrado y un dueño creado. Para web, `CORS_ORIGINS` del backend debe incluir el origen exacto del frontend, por ejemplo `http://localhost:8081`. Reiniciar Expo al cambiar la URL. El frontend no aplica migraciones ni crea datos de demostración.

## Comportamiento integrado

- Login con email/contraseña, perfil y permisos efectivos de `/auth/me`. La sesión se conserva al recargar o reiniciar para los seis roles, incluido el login social y la confirmación de registro. En web se guarda únicamente el token en localStorage; en Android/iOS se usa expo-secure-store (Keychain/Keystore). Al abrir, se valida con /auth/me y se recuperan permisos, jornada y modo check-in antes de habilitar la navegación. Un fallo temporal permite reintentar sin borrar la sesión. No se guardan contraseñas, perfiles ni fotos. Cerrar sesión revoca la sesión del servidor. Una respuesta `UNAUTHENTICATED` elimina el token guardado y el estado local. El cierre de sesión también borra el token local si no hay conexión. La persistencia respeta el vencimiento del servidor (`SESSION_HOURS`, 8 horas por defecto); no prolonga ni renueva sesiones. Se pueden consultar/revocar sesiones propias y cambiar la contraseña (revoca todas las sesiones).
- Seis roles: dueño, encargado, secretario, camarógrafo, vendedor y cliente. Check-in es un modo de sesión del encargado. Navegación por permisos del servidor; alcance global para dueño/secretario y por puesto para el personal. El servidor autoriza cada solicitud. Los permisos se vuelven a consultar al cargar datos y al volver a la app.
- Usuarios: consulta, alta con contraseña inicial, edición y baja/reactivación. Los IDs de rol se resuelven con el catálogo; se admiten cuentas sin puesto cuando lo permite la API. La edición propia cierra la sesión porque el backend revoca sus credenciales. El secretario no gestiona usuarios ni consulta clientes.
- Fotos: selección múltiple JPG/PNG/WebP hasta 6 MiB, un multipart por foto. Cada envío es una carga nueva; reintentar una carga cuya respuesta se perdió puede duplicarla. Solo las confirmadas se muestran como cargadas. La galería vuelve a consultar metadatos persistidos; cada apertura solicita una nueva URL temporal al backend. No se guardan URLs privadas en el estado compartido.
- La carga deja la foto sin cliente. El camarógrafo/encargado puede asignar después el ID de una cuenta cliente activa. El dueño puede consultar ese ID en Usuarios; el cliente lo ve en Mi usuario. Las fotos asignadas no ofrecen reasignación. El cliente consulta únicamente sus fotos y no recibe listados internos.
- Consultas de fotos, ventas, conteos, horarios e informes por fechas inclusivas, máximo 367 días. Se recorre la paginación del backend (100 filas por solicitud, hasta su offset máximo); un límite o fallo no se presenta como un total completo. Los filtros no muestran resultados del período anterior mientras cargan.
- Los informes usan `/reports/query` y `/reports/summary`; el resumen viene del servidor y no suma una sola página. Los conteos diarios contienen las fotos vendidas incluso para el camarógrafo sin permiso de ventas. Los días incompletos y las inconsistencias conservan valores no disponibles, sin compensar diferencias entre días. Los importes se presentan como ingresos por ventas; faltan costos para calcular ganancias netas.
- Los DATETIME de horarios/sesiones se interpretan como UTC y se muestran en Argentina. La consulta de asistencia propia usa `/attendance/mine`, conservando registros de puestos anteriores.

En Android e iOS, las vistas Inicio, Fotos, Ventas, Venta en evento, Informes, Asistencia, Mi asistencia, Check-in y Mi usuario se actualizan deslizando hacia abajo desde el inicio del contenido con `RefreshControl`. El gesto conserva los filtros y queda bloqueado durante una venta o mientras se completa el check-in. React Native Web no implementa este control; el gesto de actualización está disponible en móvil.

Inicio, Fotos, Ventas, Informes y las consultas de asistencia mantienen los últimos datos visibles al actualizar el mismo período. Muestran «Actualizando…» y reemplazan el contenido al recibir la respuesta; si falla, conservan lo mostrado con un aviso. Cambiar filtros o el alcance de autorización limpia los resultados anteriores. `usePeriodData.ts` espera 350 ms tras los cambios de filtros; esa espera no es una actualización periódica. Los intervalos automáticos están en `AppProvider.tsx` (perfil cada 5000 ms para el encargado en modo normal, cada 60000 ms para los demás) y `CheckInScreen.tsx` (listado cada 60000 ms). Volver a la aplicación también refresca los datos.

## Operaciones pendientes del backend

La recuperación de contraseña y el procesamiento de cobros electrónicos siguen pendientes. Iniciar/cerrar sesión no marca asistencia.

## Check-in del puesto

Actualizar el backend con `npm run db:migrate` antes de usar esta función. En el dispositivo destinado a asistencia, iniciar sesión como encargado y activar «Activar vista de check-in» desde Inicio. Luego iniciar sesión con la misma cuenta en el dispositivo de trabajo. Cada dispositivo conserva su propio token al recargar o reiniciar.

Solo puede haber una sesión normal y una sesión Check-in por encargado. Un nuevo login normal reemplaza el dispositivo de trabajo anterior y conserva Check-in. El botón para activar Check-in se oculta mientras exista un kiosco vigente de la cuenta; el perfil se consulta cada cinco segundos y el servidor rechaza inmediatamente una segunda activación. Cerrar o vencer la sesión libera el acceso.

La vista usa el puesto asignado al encargado. No permite regresar al sistema: solo cerrar sesión con la contraseña del encargado, o alternar el tema sin contraseña. Cerrar Check-in no cierra el dispositivo de trabajo. Cada empleado selecciona su nombre e ingresa su propio mail y contraseña para registrar entrada o salida. No hay cuentas Check-in ni consulta de contraseñas.

## Ventas en eventos

Actualizar primero el backend con `npm run db:migrate` desde `backend`. El dueño y el encargado crean, editan, desactivan y reactivan tarifas desde **Precios**; el encargado sólo accede a su puesto. El dueño también dispone de **Puestos → Precios del puesto**. Cada precio pertenece a un puesto; las tarifas antiguas sin asignación no habilitan ventas. Los importes históricos de ventas se conservan al editar una tarifa.

Desde **Ventas → Registrar venta en evento**, el encargado abre o cierra las ventas del puesto manualmente. El vendedor ve únicamente fotos del día actual de Argentina con previsualización y páginas de 12 fotos. La pantalla se actualiza al cruzar medianoche y al reactivar la aplicación; las ventas de un día anterior deben abrirse nuevamente para el día actual. Al tocar una foto aparece **Vender**: se ingresan copias por cada tarifa elegida, se selecciona efectivo, transferencia o tarjeta y se confirma. Sin tarifas disponibles el botón queda bloqueado; la API también lo valida. Una foto representa una familia: comprar varias copias o comprar más copias después suma ingresos sin volver a contar la familia en el porcentaje. Se conservan UUID de reintento para el mismo contenido dentro del formulario. Las ventas fuera del evento tendrán otra interfaz y no se registran en este flujo.

## Organización y validación

### Gráficos interactivos

Antes de iniciar la API actualizada, ejecutar `npm run db:migrate` desde `backend`. Agrega autor y hora UTC a las nuevas cargas de fotos sin reconstruir datos históricos. La hora corresponde a la carga confirmada, no a una hora de captura inferida del archivo. Reiniciar Expo después de instalar dependencias.

`src/components/graphics/` contiene todos los gráficos de `react-native-gifted-charts`: evolución del período, distribución horaria y rendimiento por vendedor/camarógrafo. Comparten paleta clara/oscura, ancho adaptable, desplazamiento horizontal y listado accesible con acciones para valores cero o desconocidos. Los filtros de fechas admiten hasta 367 días. Las casillas de total, ciudades, eventos y puestos agregan series independientes; no se suman entre sí. El rendimiento del equipo usa la unión de los puestos seleccionados, sin duplicarlos por selecciones superpuestas.

Tocar un día abre `/reports/day` conservando indicador y series. Tocar una hora abre el personal por puesto cuyos turnos se superpusieron con esa hora, incluso turnos iniciados el día anterior. Los horarios se presentan en Argentina. El encargado recibe únicamente su puesto, sin selectores de ciudades, eventos o puestos en gráficos, consultas de períodos o asignación de empleados. El backend vuelve a validar su alcance.

Los agregados de `/reports/graphics/query` se calculan en MySQL sobre todos los registros del período, sin depender de páginas del listado de ventas. Ventas cuenta operaciones; familias compradoras respeta `familia_contada`; el precio promedio divide ingresos entre operaciones. Porcentajes y promedios globales se calculan sobre sumas, no promediando porcentajes. Los días sin conteo, bases cero o inconsistentes y horas históricas desconocidas conservan indicadores no disponibles.

En vendedores no se muestra producción fotográfica propia. Su porcentaje usa como base las familias cargadas en su puesto durante sus turnos (una foto se cuenta una sola vez por persona, aunque tenga turnos superpuestos). Si faltan horarios de fotos, no se estima el porcentaje. La misma base puede corresponder a varios vendedores presentes y los porcentajes individuales no se suman. En camarógrafos se atribuyen las cargas al usuario que las confirmó; ventas e ingresos provienen de sus fotos, distribuyendo proporcionalmente el importe si una venta histórica vincula varias fotos. Registros sin autor u hora permanecen en grupos separados.

`src/data/api-client.ts` implementa POST, Bearer, errores, timeouts y paginación. `http-repository.ts` adapta los contratos. `photo-form.ts` arma multipart para web y móvil. `AppProvider` gestiona la sesión y `usePeriodData` las consultas por período. `tests/support` contiene `MockFotoYaRepository`, `seed` y sus operaciones; ninguna pantalla los utiliza. `src101026` es un backup excluido de los checks.

```powershell
npm run check
npx expo export --platform web
# Smoke HTTP opcional contra la API configurada (sin escrituras):
$env:FOTO_YA_LIVE_TESTS='1'
npm exec -- tsx --test tests/live-api.test.ts
```

Los tests de contratos verifican los cuerpos contra validadores del backend, permisos, paginación, roles, URLs de fotos, errores de sesión, reintentos multipart, horarios UTC e informes. La validación de MySQL y Storage reales requiere una API configurada y credenciales de prueba.

## Registro y clientes

En **Estadísticas e ingresos**, el encargado consulta únicamente su puesto asignado: se muestra su nombre y sólo se permite cambiar las fechas, sin selectores de puesto, ciudad o evento. El listado y la gestión de **Usuarios** también se limitan a su puesto. El servidor valida este alcance en cada consulta. Dueño y secretario conservan sus filtros globales según sus permisos.

Desde el login se puede crear una cuenta local de cliente o continuar con Google, GitHub o Apple. El alta pide nombre, apellido y DNI; la local también pide correo y contraseña confirmada de 12–128 caracteres. Ambos registros exigen confirmar un código enviado mediante el sandbox de Mailtrap, con opción de reenvío. El backend debe tener aplicada la migración y configurado Mailtrap.

Configurar las variables de `frontend/.env.example`: `EXPO_PUBLIC_AUTH0_DOMAIN`, `EXPO_PUBLIC_AUTH0_CLIENT_ID` (aplicación Native) y `EXPO_PUBLIC_AUTH0_WEB_CLIENT_ID` (aplicación SPA). Sus IDs deben coincidir con `AUTH0_CLIENT_IDS` del backend. `app.config.js` habilita el plugin de Auth0 cuando hay configuración nativa; usa el esquema `fotoya`, bundle ID y package `com.fotoya.app`. Se incluyó `expo-dev-client`: Auth0 móvil requiere una nueva build de desarrollo, no Expo Go.

En Auth0, configurar callbacks/logout para Native:

```text
fotoya://TU_DOMINIO_AUTH0/ios/com.fotoya.app/callback
fotoya://TU_DOMINIO_AUTH0/android/com.fotoya.app/callback
```

En la aplicación SPA, agregar el origen web exacto (por ejemplo `http://localhost:8081`) a Allowed Callback URLs, Allowed Logout URLs, Allowed Web Origins y CORS. Los proveedores deben estar habilitados para las aplicaciones utilizadas; Apple requiere sus credenciales de desarrollador. El flujo web redirige al origen y el SDK procesa el callback con PKCE. Las sesiones propias de Foto Ya usan la persistencia común a todos los roles. Los tokens de identidad de Auth0 no se guardan en ese almacenamiento.

El dueño dispone de **Clientes**, con búsqueda por correo o DNI, páginas de 20 y confirmación de baja en un modal. El listado no muestra el ID interno. Los permisos efectivos se reciben del backend; una baja oculta al cliente del listado y bloquea su acceso conservando el historial.

La persistencia web requiere acceso a localStorage y comparte el alcance del origen del navegador; una vulnerabilidad XSS podría exponer el token. En móvil se debe regenerar la build de desarrollo para incorporar expo-secure-store. Las pruebas automatizadas cubren recuperación de los seis roles, check-in, revocación, cierre sin conexión y fallos temporales; no sustituyen una prueba en dispositivo.
