import { z } from 'zod';
import { id } from '../../shared/validation.js';

export const email = z.email().trim().max(254);
export const password = z.string().min(12).max(128);
export const login = z.object({ email, password: z.string().min(1).max(128) }).strict();
export const changePassword = z.object({ currentPassword: z.string().min(1).max(128), password }).strict();
export const session = z.object({ sessionId: id }).strict();
export const empty = z.object({}).strict();
