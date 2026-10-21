import { z } from 'zod';
import { id } from '../../shared/validation.js';
import { login } from '../auth/auth.schemas.js';

export const mark = login.extend({ userId: id, action: z.enum(['check-in', 'check-out']), attendanceId: id.nullable() }).strict();
export const exit = z.object({ password: z.string().min(1).max(128) }).strict();
