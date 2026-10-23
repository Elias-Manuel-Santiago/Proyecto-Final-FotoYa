/**
 * @file
 * Crea el primer dueño mediante asistente o JSON por stdin. Valida datos y evita sustituir una
 * cuenta dueña activa existente.
 */
import { hashPassword, normalizeEmail } from '../src/security/crypto.js';
import { readOwnerInput, ownerHelp, ownerErrorMessage, OwnerSetupError } from './lib/owner-input.js';

const args = process.argv.slice(2);
let db;
try {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(ownerHelp);
  } else {
    if (args.some(arg => !['--json', '--interactive'].includes(arg)) || args.length > 1)
      throw new OwnerSetupError('Opción inválida. Usá npm run owner:create -- --help. No pases la contraseña como argumento.');
    const input = await readOwnerInput({ mode: args[0] === '--json' ? 'json' : args[0] === '--interactive' ? 'interactive' : 'auto' });
    let transaction;
    try {
      ({ db } = await import('../src/config/database.js'));
      ({ transaction } = await import('../src/shared/transaction.js'));
    }
    catch { throw new OwnerSetupError('Configuración inválida. Completá backend/.env según .env.example y ejecutá el comando desde la carpeta backend.'); }
    console.log('Creando la cuenta Dueño en MySQL…');
    const password = await hashPassword(input.password);
    await transaction(async connection => {
      await connection.query('SELECT id_rol FROM rol ORDER BY id_rol FOR UPDATE');
      const [[existing]] = await connection.query("SELECT u.id_usuario FROM usuarios u JOIN rol r ON r.id_rol = u.id_rol WHERE r.nombre = 'dueno' AND u.disponible = 1 LIMIT 1");
      if (existing) throw new OwnerSetupError('Ya existe un dueño activo. Iniciá sesión con esa cuenta; el asistente no cambia su contraseña.');
      const [result] = await connection.execute(`INSERT INTO usuarios (nombre, apellido, email, dni, password, id_rol, id_puesto)
        SELECT ?, ?, ?, ?, ?, id_rol, NULL FROM rol WHERE nombre = 'dueno'`,
      [input.firstName, input.lastName, normalizeEmail(input.email), input.dni, password]);
      if (result.affectedRows !== 1) throw new OwnerSetupError('No existe el rol dueno. Revisá las migraciones antes de crear la cuenta.');
    });
    console.log('Dueño creado. Ya podés iniciar sesión en Foto Ya con el email y la contraseña que ingresaste.');
  }
} catch (error) { console.error(ownerErrorMessage(error)); process.exitCode = 1; }
finally { if (db) await db.end(); }
