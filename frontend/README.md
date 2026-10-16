# Foto Ya · Frontend

Aplicación Expo SDK 57 con TypeScript y Expo Router, conectada a la API Express existente. El backend conserva sus contratos y reglas.

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

Iniciar el backend siguiendo `../backend/README.md`: requiere MySQL configurado, esquema migrado, claves de cifrado y un dueño creado. Para web, `CORS_ORIGINS` del backend debe incluir el origen exacto del frontend, por ejemplo `http://localhost:8081`. Reiniciar Expo al cambiar la URL. El frontend no aplica migraciones ni crea datos de demostración.

## Comportamiento integrado

- Login con email/contraseña, perfil y permisos efectivos de `/auth/me`. El token permanece en memoria; recargar o reiniciar la app requiere ingresar nuevamente. Cerrar sesión revoca la sesión del servidor. Una respuesta `UNAUTHENTICATED` elimina el estado local. Se pueden consultar/revocar sesiones propias y cambiar la contraseña (revoca todas las sesiones).
- Seis roles: dueño, encargado, secretario, camarógrafo, vendedor y cliente. Navegación por permisos del servidor; alcance global para dueño/secretario y por puesto para el personal. El servidor autoriza cada solicitud. Los permisos se vuelven a consultar al cargar datos y al volver a la app.
- Usuarios: consulta, alta con contraseña inicial, edición y baja/reactivación. Los IDs de rol se resuelven con el catálogo; se admiten cuentas sin puesto cuando lo permite la API. La edición propia cierra la sesión porque el backend revoca sus credenciales. El secretario no gestiona usuarios ni consulta clientes.
- Fotos: selección múltiple JPG/PNG/WebP hasta 6 MiB, un multipart por foto. Cada archivo conserva un UUID durante los reintentos de la cola. Solo las confirmadas se muestran como cargadas. La galería vuelve a consultar metadatos persistidos; cada apertura solicita una nueva URL temporal al backend. No se guardan URLs privadas en el estado compartido.
- La carga deja la foto sin cliente. El camarógrafo/encargado puede asignar después el ID de una cuenta cliente activa. El dueño puede consultar ese ID en Usuarios; el cliente lo ve en Mi usuario. Las fotos asignadas no ofrecen reasignación. El cliente consulta únicamente sus fotos y no recibe listados internos.
- Consultas de fotos, ventas, conteos, horarios e informes por fechas inclusivas, máximo 367 días. Se recorre la paginación del backend (100 filas por solicitud, hasta su offset máximo); un límite o fallo no se presenta como un total completo. Los filtros no muestran resultados del período anterior mientras cargan.
- Los informes usan `/reports/query` y `/reports/summary`; el resumen viene del servidor y no suma una sola página. Los conteos diarios contienen las fotos vendidas incluso para el camarógrafo sin permiso de ventas. Los días incompletos y las inconsistencias conservan valores no disponibles, sin compensar diferencias entre días. Los importes se presentan como ingresos por ventas; faltan costos para calcular ganancias netas.
- Los DATETIME de horarios/sesiones se interpretan como UTC y se muestran en Argentina. La consulta de asistencia propia usa `/attendance/mine`, conservando registros de puestos anteriores.

## Operaciones pendientes del backend

El registro de ventas y las marcaciones de entrada/salida responden `501 BUSINESS_RULES_PENDING`. La interfaz explica la limitación y permite consultar datos existentes. No simula guardar ventas ni asistencia. Falta definir copias/ventas repetidas, alcance temporal de fotos vendidas y reglas de marcación/turnos. Iniciar/cerrar sesión no marca asistencia. Tampoco se incorporan pagos, recuperación de contraseña ni administración de catálogos.

## Organización y validación

`src/data/api-client.ts` implementa POST, Bearer, errores, timeouts y paginación. `http-repository.ts` adapta los contratos. `photo-form.ts` arma multipart para web y móvil. `AppProvider` gestiona la sesión y `usePeriodData` las consultas por período. `MockFotoYaRepository`, `seed` y sus operaciones quedan como fixtures aislados de tests; ninguna pantalla los utiliza. `src101026` es un backup excluido de los checks.

```powershell
npm run check
npx expo export --platform web
# Smoke HTTP opcional contra la API configurada (sin escrituras):
$env:FOTO_YA_LIVE_TESTS='1'
npm exec -- tsx --test tests/live-api.test.ts
```

Los tests de contratos verifican los cuerpos contra validadores del backend, permisos, paginación, roles, URLs de fotos, errores de sesión, reintentos multipart, horarios UTC e informes. La validación de MySQL y Storage reales requiere una API configurada y credenciales de prueba.
