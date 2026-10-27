# Foto Ya

## Requisitos

- Git, Node.js de la rama 22 desde la versión 22.13 y npm.
- MySQL 8.0.16 o superior, con una base de desarrollo y un usuario con permisos para crear y modificar sus tablas.
- Un proyecto de Supabase con un bucket privado y una clave secreta de servidor para almacenar las fotos.

Los comandos siguientes se ejecutan en PowerShell. Se utilizan las carpetas `backend` y `frontend`.

## Descargar el proyecto

```powershell
git clone https://github.com/Elias-Manuel-Santiago/Proyecto-Final-FotoYa.git
Set-Location Proyecto-Final-FotoYa
```

## Instalar y ejecutar el backend

Crear una base vacía desde un cliente de MySQL:

```sql
CREATE DATABASE foto_ya CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Desde la raíz del proyecto:

```powershell
Set-Location backend
npm ci
Copy-Item .env.example .env
```

Si ya existe `.env`, conservarlo. Completar las siguientes variables en ese archivo:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=foto_ya
DB_USER=tu_usuario_mysql
DB_PASSWORD=tu_contrasena_mysql
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_SECRET_KEY=TU_CLAVE_SECRETA_DE_SERVIDOR
SUPABASE_STORAGE_BUCKET=Fotos
CORS_ORIGINS=http://localhost:8081,http://localhost:19006
```

Crear previamente el bucket privado indicado en `SUPABASE_STORAGE_BUCKET`, respetando mayúsculas. Usar una clave `sb_secret_...` o `service_role` del mismo proyecto; las credenciales S3 y las claves públicas no sirven para este backend. La clave secreta se configura únicamente en el backend.

Preparar la base y crear la primera cuenta de dueño:

```powershell
npm run db:init
npm run owner:create
npm run dev
```

`db:init` se usa solo con una base vacía y carga `database/foto_ya.sql` de la raíz. Si la base ya contiene ese esquema, ejecutar `npm run db:migrate` en su lugar. Antes de actualizar una base con datos, hacer una copia y detener la API. El asistente `owner:create` solicita los datos y una contraseña de 12 a 128 caracteres.

El backend se ejecuta en `http://localhost:3000`. Para comprobarlo desde otra terminal:

```powershell
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/health' -ContentType 'application/json' -Body '{}'
```

Para ejecutarlo sin recarga automática, usar `npm start` en lugar de `npm run dev`.

## Instalar y ejecutar el frontend

En otra terminal, desde la raíz del proyecto:

```powershell
Set-Location frontend
npm ci
Copy-Item .env.example .env.local
npm run web
```

Si ya existe `.env.local`, conservarlo. Configurar allí la URL del backend, incluyendo `/api`:

```dotenv
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

Abrir la dirección que indique Expo, normalmente `http://localhost:8081`, e ingresar con la cuenta creada. Si cambia el puerto web, agregar ese origen exacto a `CORS_ORIGINS` y reiniciar el backend. Reiniciar Expo después de cambiar sus variables.

Para ejecutar en Android, instalar Android Studio, el SDK y el JDK compatibles con la compilación nativa; luego usar `npm run android` desde `frontend`. Para iOS, usar `npm run ios` en macOS con Xcode. Una vez instalado el cliente de desarrollo, `npm start` inicia Expo. El acceso social nativo requiere ese cliente de desarrollo.

En un emulador Android, usar `http://10.0.2.2:3000/api`. En un teléfono físico, usar `http://IP_LAN_DE_LA_PC:3000/api`, configurar `HOST=0.0.0.0` en el backend y conectar ambos equipos a la misma red.

## Configurar registro y acceso social

Para registrar clientes, verificar correos y recuperar contraseñas, completar `MAIL_API_KEY`, `MAIL_INBOX_ID` y `SENDER` en `backend/.env`. Los códigos se consultan en Mailtrap Email Sandbox.

Para habilitar acceso social, completar `AUTH0_DOMAIN` y `AUTH0_CLIENT_IDS` en el backend, y `EXPO_PUBLIC_AUTH0_DOMAIN`, `EXPO_PUBLIC_AUTH0_CLIENT_ID` y `EXPO_PUBLIC_AUTH0_WEB_CLIENT_ID` en el frontend. Usar aplicaciones Auth0 Native y SPA, con sus URLs de retorno configuradas, y regenerar el cliente nativo después de configurar Auth0.

La configuración completa de estos servicios y del entorno móvil está en [la guía de entorno de desarrollo](docs/FotoYa_Entorno_de_Desarrollo.docx).

Para detener el frontend o el backend, presionar `Ctrl+C` en su terminal.

