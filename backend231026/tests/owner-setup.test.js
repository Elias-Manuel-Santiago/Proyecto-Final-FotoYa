/**
 * @file
 * Verifica preparación del dueño. Cubre validación y credenciales del asistente y modo JSON.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable, PassThrough, Writable } from 'node:stream';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readOwnerInput, validateOwnerInput, ownerErrorMessage, OwnerSetupError } from '../scripts/lib/owner-input.js';

const owner = { firstName: 'Persona', lastName: 'Prueba', email: 'persona@example.com', dni: '12345678', password: 'Test-password-1234' };
const sink = () => {
  let value = '';
  const output = new Writable({ write(chunk, _encoding, callback) { value += chunk.toString(); callback(); } });
  return { output, text: () => value };
};

test('entrada JSON conserva compatibilidad, normaliza DNI y fija rol/puesto', async () => {
  const { output, text } = sink();
  const result = await readOwnerInput({ input: Readable.from(['\uFEFF', JSON.stringify({ ...owner, dni: '12.345.678', roleId: '99', stationId: '4' })]), output });
  assert.equal(result.password, owner.password);
  assert.equal(result.dni, '12345678');
  assert.equal(result.roleId, '1');
  assert.equal(result.stationId, null);
  assert.match(text(), /Esperando JSON/);
  assert(!text().includes(owner.password));
});

test('entrada vacía, JSON inválido y datos incompletos tienen mensajes concretos sin filtrar contraseña', async () => {
  for (const [raw, expected] of [['', /No se recibieron datos/], ['{"password":"Secret-not-to-print"', /JSON no es válido/], [JSON.stringify({ password: 'Secret-not-to-print' }), /nombre.*apellido.*email.*DNI/]]) {
    const { output } = sink();
    await assert.rejects(readOwnerInput({ input: Readable.from([raw]), output }), error => {
      assert.match(error.message, expected);
      assert(!error.message.includes('Secret-not-to-print'));
      return true;
    });
  }
  assert.throws(() => validateOwnerInput({ ...owner, password: 'short' }), /contraseña.*12 a 128/);
});

test('entrada JSON demasiado grande falla antes de abrir MySQL', async () => {
  const { output } = sink();
  await assert.rejects(readOwnerInput({ input: Readable.from(['x'.repeat(8193)]), output }), /8192 bytes/);
});

function interactive(answers) {
  const input = new PassThrough();
  input.isTTY = true;
  input.setRawMode = value => { input.isRaw = value; return input; };
  let text = '', index = 0;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      text += chunk.toString();
      const answer = answers[index];
      if (answer && text.includes(answer[0])) {
        index++;
        queueMicrotask(() => input.write(answer[1]));
      }
      callback();
    },
  });
  output.isTTY = true;
  output.columns = 80;
  return { input, output, text: () => text };
}

const answers = confirmation => [
  ['Nombre: ', 'Persona\r'], ['Apellido: ', 'Prueba\r'], ['Email: ', 'persona@example.com\r'], ['DNI: ', '12345678\r'],
  ['Contraseña (12 a 128 caracteres; no se muestra): ', `${owner.password}\r`], ['Repetir contraseña: ', `${confirmation}\r`],
];

test('asistente interactivo pregunta todos los datos y no imprime contraseñas', { timeout: 3000 }, async () => {
  const terminal = interactive(answers(owner.password));
  const result = await readOwnerInput(terminal);
  assert.deepEqual(result, { ...owner, roleId: '1', stationId: null });
  assert(!terminal.text().includes(owner.password));
  assert.equal(terminal.input.isRaw, false);
});

test('confirmación incorrecta y Ctrl+C cancelan sin dejar la terminal en modo raw', { timeout: 3000 }, async () => {
  const mismatch = interactive(answers('Another-password-1234'));
  await assert.rejects(readOwnerInput(mismatch), /contraseñas no coinciden/);
  assert(!mismatch.text().includes(owner.password));
  assert(!mismatch.text().includes('Another-password-1234'));
  assert.equal(mismatch.input.isRaw, false);
  const canceled = interactive([['Nombre: ', '\x03']]);
  await assert.rejects(readOwnerInput(canceled), /cancelada/);
  assert.equal(canceled.input.isRaw, false);
});

test('errores de duplicados, esquema y conexión no muestran datos internos', () => {
  for (const code of ['ER_DUP_ENTRY', 'ER_NO_SUCH_TABLE', 'ER_ACCESS_DENIED_ERROR', 'ENOTFOUND', 'UNKNOWN']) {
    const message = ownerErrorMessage({ code, message: 'Secret-not-to-print' });
    assert(!message.includes('Secret-not-to-print'));
  }
  assert.match(ownerErrorMessage(new OwnerSetupError('Ya existe un dueño activo.')), /Ya existe/);
});

test('CLI ayuda sin conectar con MySQL; stdin vacío e inválido terminan con error legible', () => {
  const script = fileURLToPath(new URL('../scripts/create-owner.js', import.meta.url));
  const invoke = (args, input = '') => spawnSync(process.execPath, [script, ...args], { input, encoding: 'utf8', timeout: 5000 });
  const help = invoke(['--help']);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Pregunta los datos/);
  const empty = invoke([]);
  assert.equal(empty.status, 1);
  assert.match(empty.stderr, /No se recibieron datos/);
  const invalid = invoke(['--json'], '{"password":"Secret-not-to-print"');
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /JSON no es válido/);
  assert(!invalid.stderr.includes('Secret-not-to-print'));
  const args = invoke(['--password=Secret-not-to-print']);
  assert.equal(args.status, 1);
  assert.match(args.stderr, /Opción inválida/);
  assert(!args.stderr.includes('Secret-not-to-print'));
});
