/**
 * @file
 * Envía códigos mediante Mailtrap Sandbox. Traduce errores del proveedor sin entregar el
 * código en la respuesta pública de la API.
 */
import { MailtrapClient } from 'mailtrap';
import { env } from '../config/env.js';
import { ApiError } from '../shared/errors.js';

// Envía el código al Sandbox configurado y convierte fallos del proveedor en un error de API.
export async function sendVerification(email, code) {
  if (!env.MAIL_API_KEY || !env.MAIL_INBOX_ID || !env.SENDER)
    throw new ApiError(503, 'El envío de correo no está configurado.', 'MAIL_UNAVAILABLE');
  const client = new MailtrapClient({ token: env.MAIL_API_KEY, sandbox: true, testInboxId: Number(env.MAIL_INBOX_ID) });
  try {
    await client.send({ from: { email: env.SENDER, name: 'Foto Ya' }, to: [{ email }],
      subject: 'Confirmá tu correo en Foto Ya', text: `Tu código de verificación es: ${code}\nVence en 10 minutos.`, category: 'Verificación de correo' });
  } catch {
    throw new ApiError(502, 'No pudimos enviar el código. Volvé a intentarlo.', 'MAIL_UNAVAILABLE');
  }
}
