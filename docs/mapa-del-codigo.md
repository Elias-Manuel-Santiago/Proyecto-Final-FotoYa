# Mapa del código vigente

[Guía](README.md) · [Flujos](flujos.md)

Cada archivo ejecutable de las carpetas vigentes tiene un comentario de responsabilidad. Este índice permite localizarlo sin recorrer respaldos. `routes` conecta HTTP, `schemas` valida, `service` coordina reglas y `repository` consulta persistencia. Las rutas simples pueden delegar directamente en repositorios.

## Backend: arranque, seguridad y utilidades

| Archivo | Responsabilidad |
| --- | --- |
| [backend/src/app.js](../backend/src/app.js) | Ensambla Express y la API. El orden de CORS, límites, autenticación, jornada, rutas y errores determina qué solicitudes llegan a cada operación. |
| [backend/src/config/database.js](../backend/src/config/database.js) | Construye el pool MySQL compartido. Configura representación de IDs, fechas y decimales, TLS y límites de conexiones por proceso. |
| [backend/src/config/env.js](../backend/src/config/env.js) | Carga y valida el entorno antes de iniciar servicios. Centraliza conexión, límites y configuración de almacenamiento, correo e identidad externa. |
| [backend/src/config/permissions.js](../backend/src/config/permissions.js) | Define roles y permisos iniciales para preparar la base. Los permisos de cada solicitud se leen de las relaciones persistidas. |
| [backend/src/integrations/auth0.js](../backend/src/integrations/auth0.js) | Valida la identidad externa y extrae sujeto/correo admitidos. registration.service la intercambia por una sesión propia de Foto Ya. |
| [backend/src/integrations/mail.js](../backend/src/integrations/mail.js) | Envía códigos mediante Mailtrap Sandbox. Traduce errores del proveedor sin entregar el código en la respuesta pública de la API. |
| [backend/src/integrations/storage.js](../backend/src/integrations/storage.js) | Accede al bucket privado con credenciales de servidor. Sube originales y genera previsualizaciones WebP con URL temporal tras la autorización del servicio. |
| [backend/src/security/access.js](../backend/src/security/access.js) | Aplica permisos, alcance por puesto y restricciones de asignación de roles. Tener alcance global no reemplaza el permiso requerido por una ruta. |
| [backend/src/security/authenticate.js](../backend/src/security/authenticate.js) | Resuelve el Bearer contra sesiones y usuarios vigentes. Deja en req.actor identidad, permisos, jornada y modo kiosco para las siguientes capas. |
| [backend/src/security/crypto.js](../backend/src/security/crypto.js) | Genera/verifica hashes scrypt, emite tokens aleatorios y normaliza identidad. Las contraseñas no se recuperan desde su hash. |
| [backend/src/security/work-access.js](../backend/src/security/work-access.js) | Bloquea operaciones en modo kiosco o sin jornada para los roles que la requieren. También protege peticiones directas y sesiones en otros dispositivos. |
| [backend/src/server.js](../backend/src/server.js) | Comprueba que los usuarios fueron migrados antes de arrancar HTTP. Coordina el cierre del servidor y del pool MySQL al recibir señales de terminación. |
| [backend/src/shared/errors.js](../backend/src/shared/errors.js) | Representa errores de negocio y traduce fallos conocidos a HTTP. Oculta detalles internos y vincula errores con el identificador de solicitud. |
| [backend/src/shared/transaction.js](../backend/src/shared/transaction.js) | Reserva una conexión para una unidad de trabajo. Confirma el resultado, revierte ante errores y siempre devuelve la conexión al pool. |
| [backend/src/shared/validation.js](../backend/src/shared/validation.js) | Comparte contratos Zod de IDs, paginación y períodos. validate produce req.input y endpoint envuelve resultados exitosos en data. |

## Backend: módulos de negocio

| Archivo | Responsabilidad |
| --- | --- |
| [backend/src/modules/attendance/attendance.repository.js](../backend/src/modules/attendance/attendance.repository.js) | Consulta horarios por período y alcance. La consulta propia conserva registros de puestos anteriores del usuario. |
| [backend/src/modules/attendance/attendance.routes.js](../backend/src/modules/attendance/attendance.routes.js) | Expone consultas de asistencia y operaciones del kiosco. Limita intentos con contraseña y distingue historial propio de consulta administrativa. |
| [backend/src/modules/attendance/kiosk.schemas.js](../backend/src/modules/attendance/kiosk.schemas.js) | Valida contraseña de salida y credenciales de marcación. Incluye acción y asistencia esperada para detectar listas desactualizadas. |
| [backend/src/modules/attendance/kiosk.service.js](../backend/src/modules/attendance/kiosk.service.js) | Activa/libera el modo kiosco de una sesión del encargado y registra entradas/salidas. Revalida credenciales, puesto y horario esperado bajo bloqueo. |
| [backend/src/modules/auth/auth.repository.js](../backend/src/modules/auth/auth.repository.js) | Reconstruye al actor desde una sesión vigente con permisos y jornada actuales. Actualiza last_seen_at y consulta/revoca sesiones propias. |
| [backend/src/modules/auth/auth.routes.js](../backend/src/modules/auth/auth.routes.js) | Separa login, registro y verificación públicos de las operaciones autenticadas. Aplica límites de intentos y contratos antes de delegar. |
| [backend/src/modules/auth/auth.schemas.js](../backend/src/modules/auth/auth.schemas.js) | Define entradas estrictas de login, registro local/social, códigos y credenciales. Es la referencia de campos y límites aceptados. |
| [backend/src/modules/auth/auth.service.js](../backend/src/modules/auth/auth.service.js) | Valida login local y crea sesiones con vencimiento. Cambiar contraseña verifica la anterior y revoca sesiones/tokens en una transacción. |
| [backend/src/modules/auth/registration.service.js](../backend/src/modules/auth/registration.service.js) | Coordina alta de clientes, identidad social y confirmación de correo. Guarda digests de desafío/código, limita intentos y emite sesiones propias. |
| [backend/src/modules/catalog/catalog.repository.js](../backend/src/modules/catalog/catalog.repository.js) | Consulta puestos, ciudades, eventos, roles y tarifas según recurso/actor. Conserva puestos inactivos para el historial y restringe tarifas por puesto. |
| [backend/src/modules/catalog/catalog.routes.js](../backend/src/modules/catalog/catalog.routes.js) | Publica catálogos y operaciones de puestos/tarifas. Los contratos y permisos distinguen lectura general de administración. |
| [backend/src/modules/catalog/prices.service.js](../backend/src/modules/catalog/prices.service.js) | Administra tarifas de un puesto activo para dueño/encargado autorizado. Conserva los precios históricos aplicados a ventas previas. |
| [backend/src/modules/catalog/stations.service.js](../backend/src/modules/catalog/stations.service.js) | Crea puestos reutilizando ciudad/evento y permite baja/reactivación. Revalida al dueño y evita duplicar también puestos inactivos. |
| [backend/src/modules/pending/pending.routes.js](../backend/src/modules/pending/pending.routes.js) | Rechaza las antiguas rutas de automarcación. Indica que la asistencia se registra desde el kiosco del encargado. |
| [backend/src/modules/photos/photos.assignment.js](../backend/src/modules/photos/photos.assignment.js) | Guarda el correo y enlaza una cuenta cliente activa si existe. Impide cambiar el cliente enlazado y exige evento vigente al asignar desde ventas. |
| [backend/src/modules/photos/photos.authorization.js](../backend/src/modules/photos/photos.authorization.js) | Revalida usuario, permiso, sesión y alcance dentro de la transacción. Comprueba que el cliente opcional exista y esté activo con rol cliente. |
| [backend/src/modules/photos/photos.files.js](../backend/src/modules/photos/photos.files.js) | Lee un multipart en memoria hasta 6 MiB. Reconoce JPG, PNG y WebP por firma binaria sin confiar en extensión o MIME declarado. |
| [backend/src/modules/photos/photos.repository.js](../backend/src/modules/photos/photos.repository.js) | Lee metadatos por período, puesto y cliente sin generar URLs. find admite conexión transaccional y bloqueo para escrituras coordinadas. |
| [backend/src/modules/photos/photos.routes.js](../backend/src/modules/photos/photos.routes.js) | Conecta consulta, detalle, acceso privado, asignación y carga. La carga recibe un archivo multipart y limita solicitudes adicionales. |
| [backend/src/modules/photos/photos.schemas.js](../backend/src/modules/photos/photos.schemas.js) | Valida filtros y correo de asignación. Normaliza el multipart para entregar un contrato definido al servicio. |
| [backend/src/modules/photos/photos.service.js](../backend/src/modules/photos/photos.service.js) | Autoriza metadatos y vistas previas por cliente o alcance del personal. Omite la ruta interna del archivo en los detalles públicos. |
| [backend/src/modules/photos/photos.upload.js](../backend/src/modules/photos/photos.upload.js) | Sube una foto y confirma metadatos y conteos en una transacción. Si falla, intenta retirar el archivo nuevo que no quedó registrado. |
| [backend/src/modules/reports/reports.queries.js](../backend/src/modules/reports/reports.queries.js) | Agrega ventas por día antes de unirlas con puestos. Conserva NULL en métricas incompletas/inconsistentes y evita duplicar ventas por joins. |
| [backend/src/modules/reports/reports.repository.js](../backend/src/modules/reports/reports.repository.js) | Ejecuta conteos e informes según alcance. Calcula el resumen sobre todo el filtro, sin depender de la página del listado. |
| [backend/src/modules/reports/reports.routes.js](../backend/src/modules/reports/reports.routes.js) | Publica conteos diarios, informes y resumen del período. Distingue permisos de conteos/informes y valida filtros inclusivos. |
| [backend/src/modules/sales/sales.repository.js](../backend/src/modules/sales/sales.repository.js) | Consulta ventas y detalle según alcance. Recupera fotos y precios históricos aplicados sin recalcular con tarifas actuales. |
| [backend/src/modules/sales/sales.routes.js](../backend/src/modules/sales/sales.routes.js) | Expone ventas, apertura del evento y acceso/asignación de fotos. Distingue permiso de creación de permiso de consulta histórica. |
| [backend/src/modules/sales/sales.rules.js](../backend/src/modules/sales/sales.rules.js) | Define el día argentino y si la apertura de ventas corresponde a ese día. Una apertura de un día anterior no habilita ventas nuevas. |
| [backend/src/modules/sales/sales.schemas.js](../backend/src/modules/sales/sales.schemas.js) | Valida UUID, foto, puesto, pago y copias por tarifa. Calcula importes aplicados usando tarifas vigentes del servidor. |
| [backend/src/modules/sales/sales.service.js](../backend/src/modules/sales/sales.service.js) | Coordina evento, fotos vendibles y registro idempotente de ventas. Serializa por evento, conserva importes y cuenta una familia en su primera compra. |
| [backend/src/modules/users/clients.routes.js](../backend/src/modules/users/clients.routes.js) | Busca clientes activos por correo/DNI en páginas de veinte. La baja lógica revalida autorización y revoca credenciales conservando el historial. |
| [backend/src/modules/users/users.repository.js](../backend/src/modules/users/users.repository.js) | Consulta usuarios y roles dentro del alcance del actor. Permite reutilizar búsquedas desde una conexión transaccional. |
| [backend/src/modules/users/users.routes.js](../backend/src/modules/users/users.routes.js) | Expone consulta, detalle, alta, edición y disponibilidad de usuarios. Aplica permisos y esquemas antes de llamar al servicio. |
| [backend/src/modules/users/users.schemas.js](../backend/src/modules/users/users.schemas.js) | Valida datos personales y asignaciones. Distingue campos de alta, edición, disponibilidad y búsqueda de usuarios. |
| [backend/src/modules/users/users.service.js](../backend/src/modules/users/users.service.js) | Gestiona usuarios con revalidación transaccional del administrador. Omite hashes en respuestas y revoca sesiones al editar o dar de baja. |

## Backend: mantenimiento

| Archivo | Responsabilidad |
| --- | --- |
| [backend/scripts/create-owner.js](../backend/scripts/create-owner.js) | Crea el primer dueño mediante asistente o JSON por stdin. Valida datos y evita sustituir una cuenta dueña activa existente. |
| [backend/scripts/lib/legacy-data.js](../backend/scripts/lib/legacy-data.js) | Reconoce y convierte datos heredados. Encapsula compatibilidad con valores cifrados y formatos anteriores para la migración. |
| [backend/scripts/lib/owner-input.js](../backend/scripts/lib/owner-input.js) | Lee y valida el asistente y el JSON de creación del dueño. Gestiona contraseña oculta, confirmación y cancelación. |
| [backend/scripts/lib/protect-users.js](../backend/scripts/lib/protect-users.js) | Normaliza datos y convierte contraseñas heredadas a scrypt. Rechaza formatos desconocidos en lugar de asumir que son válidos. |
| [backend/scripts/lib/seed-permissions.js](../backend/scripts/lib/seed-permissions.js) | Prepara roles, permisos y relaciones iniciales. Distingue la inicialización de las asignaciones ya administradas. |
| [backend/scripts/migrate.js](../backend/scripts/migrate.js) | Actualiza el esquema inspeccionando columnas/índices bajo bloqueo MySQL. --init importa la base vacía antes de aplicar extensiones y conversiones. |

## Frontend: rutas

| Archivo | Responsabilidad |
| --- | --- |
| [frontend/src/app/(workspace)/_layout.tsx](../frontend/src/app/(workspace)/_layout.tsx) | Protege el área de trabajo y monta su encabezado. Redirige a login sin sesión y a perfil cuando falta jornada requerida. |
| [frontend/src/app/(workspace)/attendance.tsx](../frontend/src/app/(workspace)/attendance.tsx) | Conecta la ruta del área de trabajo con AttendanceScreen. La lógica vive en features y las restricciones de navegación se completan en layouts y guardas. |
| [frontend/src/app/(workspace)/clients.tsx](../frontend/src/app/(workspace)/clients.tsx) | Conecta la ruta del área de trabajo con ClientsScreen. La lógica vive en features y las restricciones de navegación se completan en layouts y guardas. |
| [frontend/src/app/(workspace)/employees/[id].tsx](../frontend/src/app/(workspace)/employees/[id].tsx) | Conecta la ruta del área de trabajo con EmployeeDetailScreen. La lógica vive en features y las restricciones de navegación se completan en layouts y guardas. |
| [frontend/src/app/(workspace)/employees/index.tsx](../frontend/src/app/(workspace)/employees/index.tsx) | Conecta la ruta del área de trabajo con EmployeesScreen. La lógica vive en features y las restricciones de navegación se completan en layouts y guardas. |
| [frontend/src/app/(workspace)/employees/new.tsx](../frontend/src/app/(workspace)/employees/new.tsx) | Conecta la ruta del área de trabajo con NewEmployeeScreen. La lógica vive en features y las restricciones de navegación se completan en layouts y guardas. |
| [frontend/src/app/(workspace)/home.tsx](../frontend/src/app/(workspace)/home.tsx) | Conecta la ruta del área de trabajo con HomeScreen. La lógica vive en features y las restricciones de navegación se completan en layouts y guardas. |
| [frontend/src/app/(workspace)/my-attendance.tsx](../frontend/src/app/(workspace)/my-attendance.tsx) | Conecta la ruta del área de trabajo con MyAttendanceScreen. La lógica vive en features y las restricciones de navegación se completan en layouts y guardas. |
| [frontend/src/app/(workspace)/photos.tsx](../frontend/src/app/(workspace)/photos.tsx) | Conecta la ruta del área de trabajo con PhotosScreen. La lógica vive en features y las restricciones de navegación se completan en layouts y guardas. |
| [frontend/src/app/(workspace)/prices.tsx](../frontend/src/app/(workspace)/prices.tsx) | Conecta la ruta del área de trabajo con PricesScreen. La lógica vive en features y las restricciones de navegación se completan en layouts y guardas. |
| [frontend/src/app/(workspace)/profile.tsx](../frontend/src/app/(workspace)/profile.tsx) | Conecta la ruta del área de trabajo con ProfileScreen. La lógica vive en features y las restricciones de navegación se completan en layouts y guardas. |
| [frontend/src/app/(workspace)/reports.tsx](../frontend/src/app/(workspace)/reports.tsx) | Conecta la ruta del área de trabajo con ReportsScreen. La lógica vive en features y las restricciones de navegación se completan en layouts y guardas. |
| [frontend/src/app/(workspace)/sales/index.tsx](../frontend/src/app/(workspace)/sales/index.tsx) | Conecta la ruta del área de trabajo con SalesScreen. La lógica vive en features y las restricciones de navegación se completan en layouts y guardas. |
| [frontend/src/app/(workspace)/sales/new.tsx](../frontend/src/app/(workspace)/sales/new.tsx) | Conecta la ruta del área de trabajo con NewSaleScreen. La lógica vive en features y las restricciones de navegación se completan en layouts y guardas. |
| [frontend/src/app/(workspace)/stations.tsx](../frontend/src/app/(workspace)/stations.tsx) | Conecta la ruta del área de trabajo con StationsScreen. La lógica vive en features y las restricciones de navegación se completan en layouts y guardas. |
| [frontend/src/app/+not-found.tsx](../frontend/src/app/+not-found.tsx) | Presenta recuperación para direcciones sin pantalla. Mantiene el tratamiento de navegación desconocida dentro del router. |
| [frontend/src/app/_layout.tsx](../frontend/src/app/_layout.tsx) | Monta proveedores y navegación tras restaurar sesión. Separa rutas habituales del check-in mientras el kiosco está bloqueado. |
| [frontend/src/app/check-in.tsx](../frontend/src/app/check-in.tsx) | Expone check-in del encargado. El layout raíz controla disponibilidad según modo kiosco de la sesión. |
| [frontend/src/app/index.tsx](../frontend/src/app/index.tsx) | Expone la ruta inicial mediante LoginScreen. El formulario resuelve redirección si ya hay un usuario autenticado. |

## Frontend: sesión, datos y dominio

| Archivo | Responsabilidad |
| --- | --- |
| [frontend/src/data/api-client.ts](../frontend/src/data/api-client.ts) | Centraliza POST, Bearer, timeouts y errores. Detecta respuestas de otra sesión y pagina sin presentar resultados truncados como totales. |
| [frontend/src/data/http-repository.ts](../frontend/src/data/http-repository.ts) | Traduce HTTP a modelos de pantalla y concentra operaciones. Recupera permisos actuales, normaliza IDs/fechas y carga recursos permitidos. |
| [frontend/src/data/photo-form.ts](../frontend/src/data/photo-form.ts) | Construye el archivo multipart desde File web o URI móvil. El repositorio agrega puesto y cliente opcional al enviar cada foto. |
| [frontend/src/data/session-persistence.ts](../frontend/src/data/session-persistence.ts) | Define almacenamiento mínimo de sesión y ordena escrituras/borrados. Deriva una clave por URL de API para separar entornos. |
| [frontend/src/data/session-storage.native.ts](../frontend/src/data/session-storage.native.ts) | Persiste el token nativo con SecureStore. Comparte interfaz y orden de escrituras con web usando protección del dispositivo. |
| [frontend/src/data/session-storage.ts](../frontend/src/data/session-storage.ts) | Persiste el token web en localStorage. Tolera ausencia de window en exportación estática y serializa escrituras con el adaptador común. |
| [frontend/src/domain/amounts.ts](../frontend/src/domain/amounts.ts) | Suma importes de presentación acumulando centavos redondeados. El backend calcula y persiste los importes definitivos de ventas. |
| [frontend/src/domain/dates.ts](../frontend/src/domain/dates.ts) | Separa día argentino de instantes UTC. Valida períodos inclusivos, formatea horarios y calcula el siguiente cambio de día. |
| [frontend/src/domain/format.ts](../frontend/src/domain/format.ts) | Formatea importes, porcentajes y errores para las vistas. Comparte presentación sin mezclar HTTP con componentes. |
| [frontend/src/domain/metrics.ts](../frontend/src/domain/metrics.ts) | Filtra puestos/períodos y adapta indicadores. Prioriza informes remotos y conserva valores desconocidos ante días faltantes o inconsistentes. |
| [frontend/src/domain/models.ts](../frontend/src/domain/models.ts) | Define contratos de pantallas, repositorio y tests. Distingue fotos, ventas, copias, jornadas, períodos y métricas desconocidas. |
| [frontend/src/domain/permissions.ts](../frontend/src/domain/permissions.ts) | Resuelve visibilidad, alcance y roles asignables en la interfaz. Usa permisos del servidor y una matriz de respaldo si falta ese campo. |
| [frontend/src/domain/validation.ts](../frontend/src/domain/validation.ts) | Valida formularios antes del envío. Complementa los contratos obligatorios del servidor facilitando correcciones en la interfaz. |
| [frontend/src/features/photos/hooks/usePhotoQueue.ts](../frontend/src/features/photos/hooks/usePhotoQueue.ts) | Mantiene archivos con UUID y estado individual. Reenvía pendientes/errores y marca done tras la confirmación del servidor. |
| [frontend/src/hooks/useAction.ts](../frontend/src/hooks/useAction.ts) | Ejecuta acciones evitando envíos simultáneos desde el hook. Expone estado ocupado y mensajes, y captura errores para mostrarlos. |
| [frontend/src/hooks/useBusinessDate.ts](../frontend/src/hooks/useBusinessDate.ts) | Actualiza el día argentino al cruzar medianoche o reactivar la aplicación. Permite reiniciar ventas cuando cambia el día comercial. |
| [frontend/src/hooks/usePeriod.ts](../frontend/src/hooks/usePeriod.ts) | Mantiene filtros de período de las pantallas. Centraliza cambios de fechas y puesto para consultas y componentes de filtrado. |
| [frontend/src/hooks/usePeriodData.ts](../frontend/src/hooks/usePeriodData.ts) | Consulta un snapshot por período después de 350 ms. Invalida respuestas antiguas y vacía datos filtrados mientras espera el resultado actual. |
| [frontend/src/providers/AppProvider.tsx](../frontend/src/providers/AppProvider.tsx) | Coordina sesión, perfil y datos sobre el repositorio HTTP. Restaura token, refresca al reactivar y consulta jornada/kiosco cada quince segundos. |
| [frontend/src/providers/SocialProvider.tsx](../frontend/src/providers/SocialProvider.tsx) | Carga el proveedor social de forma diferida con configuración y entorno compatibles. Mantiene el acceso local si el proveedor no se habilita. |
| [frontend/src/providers/social-auth0.tsx](../frontend/src/providers/social-auth0.tsx) | Adapta identidad al contexto social y recupera el retorno web. Entrega un idToken al login para intercambiarlo por una sesión propia. |
| [frontend/src/providers/social-context.ts](../frontend/src/providers/social-context.ts) | Define el contrato social y un contexto predeterminado deshabilitado. Permite consumir su estado sin importar el SDK en pantallas. |

## Frontend: pantallas y componentes por función

| Archivo | Responsabilidad |
| --- | --- |
| [frontend/src/features/attendance/AttendanceScreen.tsx](../frontend/src/features/attendance/AttendanceScreen.tsx) | Consulta asistencia administrativa por período y alcance. Delega presentación del horario a AttendanceCard. |
| [frontend/src/features/attendance/CheckInScreen.tsx](../frontend/src/features/attendance/CheckInScreen.tsx) | Presenta empleados y pide credenciales para marcar en kiosco. Refresca asistencia y exige contraseña del encargado para salir. |
| [frontend/src/features/attendance/MyAttendanceScreen.tsx](../frontend/src/features/attendance/MyAttendanceScreen.tsx) | Consulta historial propio con attendance/mine. Conserva jornadas de puestos anteriores y permite cambiar período. |
| [frontend/src/features/attendance/components/AttendanceCard.tsx](../frontend/src/features/attendance/components/AttendanceCard.tsx) | Presenta entrada, salida y duración. Distingue turnos abiertos y muestra instantes en horario argentino. |
| [frontend/src/features/auth/LoginScreen.tsx](../frontend/src/features/auth/LoginScreen.tsx) | Coordina login, registro local/social y confirmación. Acepta sesiones mediante AppProvider y consume el retorno social una vez. |
| [frontend/src/features/auth/useLoginErrors.ts](../frontend/src/features/auth/useLoginErrors.ts) | Gestiona validación y errores por campo según modo de autenticación. Traduce errores de API y limpia mensajes al editar. |
| [frontend/src/features/clients/ClientsScreen.tsx](../frontend/src/features/clients/ClientsScreen.tsx) | Busca clientes por correo/DNI en páginas de veinte. Confirma la baja con un modal e ignora respuestas de búsquedas anteriores. |
| [frontend/src/features/employees/EmployeeDetailScreen.tsx](../frontend/src/features/employees/EmployeeDetailScreen.tsx) | Carga un usuario para edición y cambio de disponibilidad. Coordina confirmaciones y efectos sobre la sesión propia. |
| [frontend/src/features/employees/EmployeesScreen.tsx](../frontend/src/features/employees/EmployeesScreen.tsx) | Lista usuarios del alcance recibido. Expone acciones de alta y detalle según permisos. |
| [frontend/src/features/employees/NewEmployeeScreen.tsx](../frontend/src/features/employees/NewEmployeeScreen.tsx) | Coordina alta desde el formulario compartido. Guarda mediante el repositorio y actualiza datos al confirmar. |
| [frontend/src/features/employees/components/EmployeeForm.tsx](../frontend/src/features/employees/components/EmployeeForm.tsx) | Mantiene campos de alta/edición y asignación de rol/puesto. Valida y entrega la entrada a la pantalla controladora. |
| [frontend/src/features/home/HomeScreen.tsx](../frontend/src/features/home/HomeScreen.tsx) | Presenta inicio con accesos y métricas permitidos. Coordina actualización de datos y entrada del encargado al check-in. |
| [frontend/src/features/photos/PhotosScreen.tsx](../frontend/src/features/photos/PhotosScreen.tsx) | Une galería por período, carga y asignación según permisos. Consulta metadatos y delega acceso privado a PhotoPreview. |
| [frontend/src/features/photos/components/PhotoAssignment.tsx](../frontend/src/features/photos/components/PhotoAssignment.tsx) | Guarda el correo para una foto sin cuenta enlazada. Distingue asignación en galería/venta y muestra el vínculo confirmado. |
| [frontend/src/features/photos/components/PhotoPreview.tsx](../frontend/src/features/photos/components/PhotoPreview.tsx) | Solicita una URL temporal al abrir una foto autorizada. Mantiene carga, resultado y error de la previsualización en el componente. |
| [frontend/src/features/photos/components/UploadQueue.tsx](../frontend/src/features/photos/components/UploadQueue.tsx) | Presenta estados y acciones de la cola. Delega selección, envío y limpieza en el hook de la pantalla. |
| [frontend/src/features/photos/hooks/usePhotoQueue.ts](../frontend/src/features/photos/hooks/usePhotoQueue.ts) | Mantiene archivos con UUID y estado individual. Reenvía pendientes/errores y marca done tras la confirmación del servidor. |
| [frontend/src/features/profile/ProfileScreen.tsx](../frontend/src/features/profile/ProfileScreen.tsx) | Presenta perfil, jornada y sesiones propias. Coordina contraseña, revocación y actualización del estado de acceso. |
| [frontend/src/features/reports/ReportsScreen.tsx](../frontend/src/features/reports/ReportsScreen.tsx) | Presenta informes filtrados y resumen del servidor. Distingue días faltantes, inconsistencias e ingresos disponibles. |
| [frontend/src/features/reports/components/DailyEarnings.tsx](../frontend/src/features/reports/components/DailyEarnings.tsx) | Presenta ingresos diarios del período. Usa datos comerciales sin tratarlos como ganancias netas. |
| [frontend/src/features/sales/NewSaleScreen.tsx](../frontend/src/features/sales/NewSaleScreen.tsx) | Coordina evento del día, tarifas y páginas de doce fotos. Reinicia al cambiar día/puesto y bloquea refresco durante confirmación. |
| [frontend/src/features/sales/SalesScreen.tsx](../frontend/src/features/sales/SalesScreen.tsx) | Consulta ventas por período y presenta tarjetas. Habilita acceso al registro en evento según permiso. |
| [frontend/src/features/sales/components/SaleCard.tsx](../frontend/src/features/sales/components/SaleCard.tsx) | Presenta una venta y su detalle histórico. Solicita acceso autorizado a fotos vendidas y muestra precios aplicados. |
| [frontend/src/features/sales/components/SaleForm.tsx](../frontend/src/features/sales/components/SaleForm.tsx) | Recoge copias por tarifa y pago. Conserva UUID al reintentar el mismo cuerpo y marca guardado tras confirmar el servidor. |
| [frontend/src/features/sales/components/SalePhotoCard.tsx](../frontend/src/features/sales/components/SalePhotoCard.tsx) | Presenta una foto seleccionable del evento con vista previa privada. Contiene acciones de asignación/venta aportadas por la pantalla. |
| [frontend/src/features/stations/PricesScreen.tsx](../frontend/src/features/stations/PricesScreen.tsx) | Selecciona el contexto de puesto para administrar precios. Delega edición de tarifas a StationPrices. |
| [frontend/src/features/stations/StationPrices.tsx](../frontend/src/features/stations/StationPrices.tsx) | Consulta y administra tarifas de un puesto. Coordina nombre, importe, edición y disponibilidad mediante el repositorio. |
| [frontend/src/features/stations/StationsScreen.tsx](../frontend/src/features/stations/StationsScreen.tsx) | Presenta puestos y acciones de alta, baja y reactivación. Conserva acceso a historial y tarifas según permiso. |

## Frontend: componentes compartidos

| Archivo | Responsabilidad |
| --- | --- |
| [frontend/src/components/filters/PeriodFilters.tsx](../frontend/src/components/filters/PeriodFilters.tsx) | Presenta filtros de fechas, puesto y opciones del período. Delega cambios al estado de la pantalla que consulta datos. |
| [frontend/src/components/metrics/Metrics.tsx](../frontend/src/components/metrics/Metrics.tsx) | Presenta indicadores comerciales compartidos. Distingue métricas no disponibles de valores cero. |
| [frontend/src/components/navigation/Guard.tsx](../frontend/src/components/navigation/Guard.tsx) | Restringe vistas según permisos de interfaz. Cada solicitud sigue autorizándose en el servidor. |
| [frontend/src/components/navigation/WorkspaceHeader.tsx](../frontend/src/components/navigation/WorkspaceHeader.tsx) | Construye navegación según permisos y estado del usuario. Reúne accesos disponibles y cierre de sesión. |
| [frontend/src/components/ui/Button.tsx](../frontend/src/components/ui/Button.tsx) | Unifica botones, variantes y estado ocupado. Comparte interacción y accesibilidad entre formularios y pantallas. |
| [frontend/src/components/ui/ConfirmAction.tsx](../frontend/src/components/ui/ConfirmAction.tsx) | Presenta confirmación antes de ejecutar una acción. Comparte la interacción de confirmar/cancelar entre vistas. |
| [frontend/src/components/ui/Feedback.tsx](../frontend/src/components/ui/Feedback.tsx) | Presenta errores, confirmaciones y estados vacíos. Comparte mensajes sin incorporar reglas de negocio. |
| [frontend/src/components/ui/Field.tsx](../frontend/src/components/ui/Field.tsx) | Compone etiqueta, entrada y error reutilizables. Propaga propiedades de edición y accesibilidad del formulario. |
| [frontend/src/components/ui/PasswordField.tsx](../frontend/src/components/ui/PasswordField.tsx) | Especializa el campo para contraseña con control de visibilidad. Conserva valor controlado y propiedades de validación. |
| [frontend/src/components/ui/Screen.tsx](../frontend/src/components/ui/Screen.tsx) | Proporciona área segura, teclado, scroll y actualización por gesto. La pantalla decide cuándo habilitar refresco durante operaciones. |
| [frontend/src/components/ui/Select.tsx](../frontend/src/components/ui/Select.tsx) | Presenta selección de opciones con valor controlado. Cada formulario define etiquetas, valores y disponibilidad. |
| [frontend/src/components/ui/theme.ts](../frontend/src/components/ui/theme.ts) | Centraliza colores y estilos compartidos. Sirve de referencia visual para pantallas, formularios y tarjetas. |

## Frontend: configuración ejecutable

| Archivo | Responsabilidad |
| --- | --- |
| [frontend/app.config.js](../frontend/app.config.js) | Deriva configuración y registro nativo del proveedor social. Habilita su plugin al configurar dominio y cliente nativo. |
| [frontend/eslint.config.js](../frontend/eslint.config.js) | Configura análisis estático y exclusiones del frontend. Se ejecuta con npm run lint como parte de npm run check. |

## Base de datos

| Archivo | Responsabilidad |
| --- | --- |
| [backend/database/002-query-indexes.sql](../backend/database/002-query-indexes.sql) | Índices de consultas de usuarios, fotos, días, horarios y sesiones. migrate.js inspecciona índices antes de ejecutar definiciones pendientes. |
| [backend/database/003-photo-ownership.sql](../backend/database/003-photo-ownership.sql) | SQL de transición para cliente opcional y photos.assign. El migrador actual realiza esa adaptación por inspección y no ejecuta este archivo directamente. |
| [backend/database/005-event-sales.sql](../backend/database/005-event-sales.sql) | Define apertura por puesto/día. La clave foránea compuesta impide asociar una apertura con el día de otro puesto. |
| [backend/database/006-client-registration.sql](../backend/database/006-client-registration.sql) | Define desafíos con digests, vencimiento e intentos. Mantiene una sola verificación vigente por usuario. |
| [database/foto_ya.sql](../database/foto_ya.sql) | Esquema base para una instalación vacía. Define catálogos, usuarios, días, fotos, ventas y sesiones con restricciones y se completa con backend/scripts/migrate.js. |

## Pruebas del backend

| Archivo | Responsabilidad |
| --- | --- |
| [backend/tests/database.test.js](../backend/tests/database.test.js) | Verifica configuración y contratos de persistencia/esquema. Complementa la integración sin demostrar conectividad real por sí sola. |
| [backend/tests/fixtures.js](../backend/tests/fixtures.js) | Proporciona configuración y datos reutilizables. Mantiene entradas conocidas para validación y seguridad. |
| [backend/tests/integration/api.test.js](../backend/tests/integration/api.test.js) | Recorre la API con MySQL temporal al habilitar TEST_DB_PORT. Simula Storage, correo e identidad y elimina sólo su base aleatoria. |
| [backend/tests/owner-setup.test.js](../backend/tests/owner-setup.test.js) | Verifica preparación del dueño. Cubre validación y credenciales del asistente y modo JSON. |
| [backend/tests/photos-assignment.test.js](../backend/tests/photos-assignment.test.js) | Verifica contratos de asignación. Documenta validación de correo y reglas de la operación. |
| [backend/tests/photos-storage.test.js](../backend/tests/photos-storage.test.js) | Verifica archivos y acceso a Storage con dependencias de prueba. Cubre privacidad, formatos y errores del proveedor. |
| [backend/tests/registration.test.js](../backend/tests/registration.test.js) | Verifica contratos de alta y códigos. Cubre reglas de identidad sin enviar correo real. |
| [backend/tests/sales.test.js](../backend/tests/sales.test.js) | Verifica reglas de venta, día e importes. Protege diferencias entre familias, copias y total aplicado. |
| [backend/tests/security.test.js](../backend/tests/security.test.js) | Verifica contratos de seguridad, validación y alcance. Describe entradas y accesos admitidos/rechazados. |
| [backend/tests/setup.js](../backend/tests/setup.js) | Configura variables aisladas antes de importar el backend. Evita heredar credenciales del entorno real. |
| [backend/tests/work-access.test.js](../backend/tests/work-access.test.js) | Verifica bloqueo por jornada y kiosco. Documenta excepciones necesarias para perfil y check-in. |

## Pruebas y simulaciones del frontend

| Archivo | Responsabilidad |
| --- | --- |
| [frontend/tests/api-client-web.test.ts](../frontend/tests/api-client-web.test.ts) | Verifica solicitudes HTTP y errores web. Cubre transporte y contratos del cliente según los escenarios de la suite. |
| [frontend/tests/api-contract.test.ts](../frontend/tests/api-contract.test.ts) | Compara cuerpos del repositorio con validadores del backend. Detecta diferencias de campos y contratos entre capas. |
| [frontend/tests/employees-attendance.test.ts](../frontend/tests/employees-attendance.test.ts) | Verifica usuarios y asistencia. Cubre alcance por rol/puesto y transformaciones de datos. |
| [frontend/tests/fixtures.ts](../frontend/tests/fixtures.ts) | Proporciona usuarios y datos reutilizables de pruebas. Mantiene escenarios independientes de pantallas reales. |
| [frontend/tests/live-api.test.ts](../frontend/tests/live-api.test.ts) | Ejecuta comprobaciones HTTP opcionales con FOTO_YA_LIVE_TESTS. Requiere una API configurada y no reemplaza integración MySQL. |
| [frontend/tests/photos-access.test.ts](../frontend/tests/photos-access.test.ts) | Verifica privacidad y operaciones de fotos. Cubre permisos, acceso temporal y reintentos. |
| [frontend/tests/sales-metrics.test.ts](../frontend/tests/sales-metrics.test.ts) | Verifica ventas e indicadores. Distingue conteos completos, inconsistencias y valores desconocidos. |
| [frontend/tests/session-persistence.test.ts](../frontend/tests/session-persistence.test.ts) | Verifica recuperación de sesiones por rol. Cubre revocación, cierre sin conexión y carreras de restauración/borrado. |
| [frontend/tests/stations.test.ts](../frontend/tests/stations.test.ts) | Verifica catálogos y puestos/tarifas. Protege contratos y restricciones por puesto. |
| [frontend/tests/support/mock-repository.ts](../frontend/tests/support/mock-repository.ts) | Implementa el repositorio en memoria para pruebas. Las pantallas reales usan HttpFotoYaRepository. |
| [frontend/tests/support/operations/attendance.ts](../frontend/tests/support/operations/attendance.ts) | Simula asistencia sobre datos de prueba. Permite comprobar jornada e historial sin API real. |
| [frontend/tests/support/operations/employees.ts](../frontend/tests/support/operations/employees.ts) | Simula gestión de usuarios para tests. Modela permisos y asignaciones en memoria. |
| [frontend/tests/support/operations/photos.ts](../frontend/tests/support/operations/photos.ts) | Simula fotos y asignaciones. Aísla permisos y estado de los servicios externos. |
| [frontend/tests/support/operations/sales.ts](../frontend/tests/support/operations/sales.ts) | Simula registro y consulta de ventas. Mantiene escenarios de conteos e importes en memoria. |
| [frontend/tests/support/operations/stations.ts](../frontend/tests/support/operations/stations.ts) | Simula gestión de puestos y catálogos. Comprueba disponibilidad y alcance sin modificar una base real. |
| [frontend/tests/support/repository.ts](../frontend/tests/support/repository.ts) | Define el contrato del repositorio simulado. Mantiene soporte de tests separado del cliente HTTP real. |
| [frontend/tests/support/seed.ts](../frontend/tests/support/seed.ts) | Construye datos del repositorio simulado. No carga demostraciones en base ni pantallas reales. |

