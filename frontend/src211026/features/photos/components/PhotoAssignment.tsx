/**
 * @file
 * Guarda el correo para una foto sin cuenta enlazada. Distingue asignación en galería/venta y
 * muestra el vínculo confirmado.
 */
import { useState } from 'react';
import { Text, View } from 'react-native';
import type { Photo, SalePhoto } from '../../../domain/models';
import { useWorkspace } from '../../../providers/AppProvider';
import { useAction } from '../../../hooks/useAction';
import { Field } from '../../../components/ui/Field';
import { Button } from '../../../components/ui/Button';
import { Feedback } from '../../../components/ui/Feedback';
import { styles } from '../../../components/ui/theme';

// Muestra el destinatario confirmado o guarda un correo por la ruta de galería o venta.
export function PhotoAssignment({
  photo,
  sale = false,
  onSaved,
}: {
  photo: Photo | SalePhoto;
  sale?: boolean;
  onSaved?: (photo: Pick<Photo, 'clientId' | 'clientEmail'>) => void;
}) {
  const { employee, repository } = useWorkspace();
  const [saved, setSaved] = useState<Pick<Photo, 'clientId' | 'clientEmail'>>();
  const current = saved ?? photo;
  const [clientEmail, setClientEmail] = useState(photo.clientEmail ?? '');
  const action = useAction();
  if (employee.roleId === 'client') return null;
  if (current.clientId)
    return (
      <Text style={styles.muted}>
        Cliente: {current.clientEmail ?? 'Asignado'}
      </Text>
    );
  if (!employee.permissions?.includes(sale ? 'sales.create' : 'photos.assign'))
    return <Text style={styles.muted}>Sin cliente asignado</Text>;
  return (
    <View style={styles.stack}>
      {!!current.clientEmail && (
        <Text style={styles.muted}>
          Mail guardado: {current.clientEmail}. Pendiente de asociar a una
          cuenta cliente.
        </Text>
      )}
      <Field
        label="Mail del cliente"
        value={clientEmail}
        onChangeText={setClientEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!action.busy}
      />
      <Button
        title="Guardar mail del cliente"
        busy={action.busy}
        disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim())}
        onPress={() => {
          void action.run(async () => {
            const result = await repository.assignPhoto(
              photo.id,
              clientEmail,
              sale,
            );
            setSaved(result);
            onSaved?.(result);
          }, 'Mail del cliente guardado.');
        }}
      />
      <Feedback error={action.error} success={action.success} />
    </View>
  );
}
