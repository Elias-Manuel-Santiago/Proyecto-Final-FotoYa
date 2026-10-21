export const businessDate = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires',
}).format(now);

export const currentEvent = (event, now = new Date()) => Boolean(event?.open) && event.date === businessDate(now);
