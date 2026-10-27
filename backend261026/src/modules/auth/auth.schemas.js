/**
 * @file
 * Define entradas estrictas de login, registro local/social, códigos y credenciales. Es la
 * referencia de campos y límites aceptados.
 */
import { z } from 'zod';
import { id } from '../../shared/validation.js';

export const email = z.email().trim().max(254);
// La contraseña nueva exige 12 caracteres; login admite credenciales existentes desde 1 carácter.
export const password = z.string().min(12).max(128);
export const login = z.object({ email, password: z.string().min(1).max(128) }).strict();
export const changePassword = z.object({ currentPassword: z.string().min(1).max(128), password }).strict();
export const session = z.object({ sessionId: id }).strict();
export const empty = z.object({}).strict();
// El registro local exige datos personales; el social usa los del proveedor.
export const clientFields = {
  firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().min(1).max(100),
  dni: z.string().regex(/^[\d.\s-]{5,20}$/).transform(v => v.replace(/[.\s-]/g, '')).pipe(z.string().regex(/^\d{5,15}$/)),
};
export const register = z.object({ ...clientFields, email, password }).strict();
export const social = z.object({ idToken: z.string().min(1).max(16000) }).strict();
// El desafío vincula reenvío y confirmación sin revelar el código enviado por correo.
export const challenge = z.object({ verificationToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict();
export const verify = challenge.extend({ code: z.string().regex(/^\d{6}$/) }).strict();
export const passwordResetStart = z.object({ email }).strict();
export const passwordResetConfirm = z.object({
  recoveryToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  code: z.string().regex(/^\d{6}$/), password,
}).strict();
