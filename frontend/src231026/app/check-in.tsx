/**
 * @file
 * Expone la pantalla de la cuenta Check-in. El layout raíz controla disponibilidad según modo kiosco de
 * la sesión.
 */
// El layout raíz habilita esta ruta cuando la sesión del encargado está en modo kiosco.
export { CheckInScreen as default } from '../features/attendance/CheckInScreen';
