/**
 * @file
 * Expone Check-in del encargado. El layout raíz controla disponibilidad según modo kiosco de
 * la sesión.
 */
// El layout raíz habilita esta ruta cuando la sesión del encargado está en modo kiosco.
export { CheckInScreen as default } from '../features/attendance/CheckInScreen';
