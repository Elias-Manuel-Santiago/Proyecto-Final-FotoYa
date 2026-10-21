/**
 * @file
 * Guarda el correo y enlaza una cuenta cliente activa si existe. Impide cambiar el cliente
 * enlazado y exige evento vigente al asignar desde ventas.
 */
import { photoRepository } from './photos.repository.js';
import { transaction } from '../../shared/transaction.js';
import { ApiError } from '../../shared/errors.js';
import { stationScope } from '../../security/access.js';
import { requirePhotoOperator } from './photos.authorization.js';
import { businessDate, currentEvent } from '../sales/sales.rules.js';

export const photoAssignments = {
  // Revalida al operador y bloquea la foto antes de guardar el destinatario sin reemplazar un vínculo.
  assign(actor, input, permission = 'photos.assign') {
    return transaction(async connection => {
      const initial = await photoRepository.find(input.photoId, connection);
      if (!initial) throw new ApiError(404, 'La foto no existe.');
      stationScope(actor, initial.stationId);
      await requirePhotoOperator(connection, actor, permission, initial.stationId);
      if (permission === 'sales.create') {
        const [[event]] = await connection.execute(`SELECT e.abierta AS open, d.fecha AS date FROM event_sales e
          JOIN dias d ON d.id_dias = e.id_dia WHERE e.id_puesto = ? FOR UPDATE`, [initial.stationId]);
        if (initial.date !== businessDate() || !currentEvent(event))
          throw new ApiError(409, 'Las ventas del evento están cerradas.', 'EVENT_CLOSED');
      }
      const photo = await photoRepository.find(input.photoId, connection, true);
      if (!photo) throw new ApiError(404, 'La foto no existe.');
      stationScope(actor, photo.stationId);
      const [[client]] = await connection.execute(`SELECT u.id_usuario AS id, u.disponible AS active, r.nombre AS role FROM usuarios u JOIN rol r ON r.id_rol = u.id_rol
        WHERE u.email = ? LOCK IN SHARE MODE`, [input.clientEmail]);
      if (client && (!client.active || client.role !== 'cliente'))
        throw new ApiError(422, 'El mail no corresponde a una cuenta cliente disponible.', 'INVALID_CLIENT');
      // El correo puede guardarse sin cuenta existente; un cliente ya enlazado no se reemplaza.
      const clientId = client ? String(client.id) : null;
      if (photo.clientId && photo.clientId !== clientId)
        throw new ApiError(409, 'La foto ya está asignada a otro cliente.', 'PHOTO_ALREADY_ASSIGNED');
      await connection.execute('UPDATE fotos SET id_cliente = ?, email_cliente = ? WHERE id_fotos = ?', [clientId, input.clientEmail, input.photoId]);
      const { file, ...metadata } = await photoRepository.find(input.photoId, connection);
      return metadata;
    });
  },
};
