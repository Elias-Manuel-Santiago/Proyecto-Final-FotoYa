/**
 * @file
 * Lee y valida el asistente y el JSON de creación del dueño. Gestiona contraseña oculta,
 * confirmación y cancelación.
 */
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { create as schema } from '../../src/modules/users/users.schemas.js';

export class OwnerSetupError extends Error {}

export const ownerHelp = `Crear la primera cuenta Dueño de Foto Ya

Desde la carpeta backend:
  npm run owner:create          Pregunta los datos; oculta la contraseña.
  npm run owner:create -- --help

También admite un JSON por entrada estándar:
  Get-Content -Raw 'C:\\ruta\\privada\\dueno.json' | npm run owner:create -- --json

Campos del JSON: firstName, lastName, email, dni, password.
La contraseña debe tener entre 12 y 128 caracteres.
No se crea otra cuenta si ya existe un dueño activo.
`;

export function validateOwnerInput(raw) {
  const parsed = schema.safeParse({ ...raw, roleId: '1', stationId: null });
  if (!parsed.success) {
    const labels = {
      firstName: 'nombre (1 a 100 caracteres)', lastName: 'apellido (1 a 100 caracteres)',
      email: 'email (correo válido)', dni: 'DNI (5 a 15 dígitos)', password: 'contraseña (12 a 128 caracteres)',
    };
    const fields = [...new Set(parsed.error.issues.map(issue => labels[issue.path[0]] ?? 'campos no permitidos'))];
    throw new OwnerSetupError(`Revisá los datos: ${fields.join(', ')}.`);
  }
  return parsed.data;
}

export async function readOwnerInput({ input = process.stdin, output = process.stdout, mode = 'auto' } = {}) {
  if (mode === 'interactive' || (mode === 'auto' && input.isTTY)) {
    if (!input.isTTY || !output.isTTY) throw new OwnerSetupError('El asistente necesita una terminal interactiva. Abrí PowerShell y ejecutá npm run owner:create desde backend, o enviá un JSON con --json.');
    return readInteractive(input, output);
  }
  output.write('Esperando JSON por entrada estándar. Para responder preguntas, ejecutá npm run owner:create directamente en PowerShell.\n');
  let raw = '';
  input.setEncoding('utf8');
  for await (const chunk of input) {
    raw += chunk;
    if (Buffer.byteLength(raw, 'utf8') > 8192) throw new OwnerSetupError('El JSON supera el máximo de 8192 bytes.');
  }
  raw = raw.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new OwnerSetupError('No se recibieron datos. Ejecutá npm run owner:create en una terminal para abrir el asistente, o pasá un archivo JSON por entrada estándar.');
  let data;
  try { data = JSON.parse(raw); }
  catch { throw new OwnerSetupError('El JSON no es válido. Debe contener firstName, lastName, email, dni y password.'); }
  return validateOwnerInput(data);
}

async function readInteractive(input, output) {
  let muted = false;
  const terminalOutput = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) output.write(chunk, encoding);
      callback();
    },
  });
  terminalOutput.columns = output.columns;
  const rl = createInterface({ input, output: terminalOutput, terminal: true, historySize: 0 });
  const controller = new AbortController();
  const cancel = () => controller.abort();
  rl.once('SIGINT', cancel);
  rl.once('close', cancel);
  const question = async (label, secret = false) => {
    if (secret) { output.write(label); muted = true; }
    try { return await rl.question(secret ? '' : label, { signal: controller.signal }); }
    finally { if (secret) { muted = false; output.write('\n'); } }
  };
  try {
    output.write('Crear la primera cuenta Dueño de Foto Ya. Ctrl+C cancela sin guardar.\n');
    const firstName = await question('Nombre: ');
    const lastName = await question('Apellido: ');
    const email = await question('Email: ');
    const dni = await question('DNI: ');
    const password = await question('Contraseña (12 a 128 caracteres; no se muestra): ', true);
    const confirmation = await question('Repetir contraseña: ', true);
    if (password !== confirmation) throw new OwnerSetupError('Las contraseñas no coinciden. No se creó ninguna cuenta.');
    return validateOwnerInput({ firstName, lastName, email: email.trim(), dni, password });
  } catch (error) {
    if (controller.signal.aborted) throw new OwnerSetupError('Creación cancelada. No se guardaron datos.');
    throw error;
  } finally {
    muted = false;
    rl.close();
    terminalOutput.end();
  }
}

export function ownerErrorMessage(error) {
  if (error instanceof OwnerSetupError) return error.message;
  if (error?.code === 'ER_DUP_ENTRY') return 'El email o DNI ya está registrado. No se creó otra cuenta.';
  if (['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(error?.code)) return 'Faltan tablas o columnas. Revisá las migraciones del backend (npm run db:migrate).';
  if (error?.code === 'ER_ACCESS_DENIED_ERROR') return 'MySQL rechazó las credenciales. Revisá DB_USER y DB_PASSWORD en backend/.env.';
  if (['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH'].includes(error?.code)) return 'No se pudo conectar con MySQL. Revisá DB_HOST, DB_PORT, la red y que el servidor esté iniciado.';
  return 'No se pudo crear el dueño. Revisá la configuración de backend/.env y las migraciones. No se muestran detalles internos ni credenciales.';
}
