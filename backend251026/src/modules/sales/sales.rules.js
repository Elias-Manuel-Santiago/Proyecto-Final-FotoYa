/**
 * @file
 * Define el día argentino y si la apertura de ventas corresponde a ese día. Una apertura de un
 * día anterior no habilita ventas nuevas.
 */
// Obtiene el día comercial con la zona horaria argentina.
export const businessDate = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires',
}).format(now);

// Considera abierta la venta solo si la apertura pertenece al día actual.
export const currentEvent = (event, now = new Date()) => Boolean(event?.open) && event.date === businessDate(now);
