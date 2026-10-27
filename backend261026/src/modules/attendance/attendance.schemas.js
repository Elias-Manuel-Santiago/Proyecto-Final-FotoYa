import { z } from 'zod';
import { id } from '../../shared/validation.js';

export const durationInput = z.object({ attendanceId: id, hours: z.number().int().min(0).max(168), minutes: z.number().int().min(0).max(59) }).strict()
  .refine(input => input.hours * 60 + input.minutes > 0, 'Ingresá al menos un minuto trabajado.');

