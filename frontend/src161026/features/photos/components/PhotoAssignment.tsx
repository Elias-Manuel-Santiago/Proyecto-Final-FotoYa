import { useState } from 'react';
import { Text, View } from 'react-native';
import type { Photo } from '../../../domain/models';
import { useWorkspace } from '../../../providers/AppProvider';
import { useAction } from '../../../hooks/useAction';
import { Field } from '../../../components/ui/Field';
import { Button } from '../../../components/ui/Button';
import { Feedback } from '../../../components/ui/Feedback';
import { styles } from '../../../components/ui/theme';

export function PhotoAssignment({ photo }: { photo: Photo }) {
  const { employee, repository, refresh } = useWorkspace();
  const [clientId, setClientId] = useState('');
  const action = useAction();
  if (employee.roleId === 'client') return null;
  if (photo.clientId)
    return <Text style={styles.muted}>Cliente: {photo.clientId}</Text>;
  if (!employee.permissions?.includes('photos.assign'))
    return <Text style={styles.muted}>Sin cliente asignado</Text>;
  return (
    <View style={styles.stack}>
      <Field
        label="ID de la cuenta cliente"
        value={clientId}
        onChangeText={setClientId}
        keyboardType="number-pad"
        editable={!action.busy}
      />
      <Button
        title="Asignar cliente"
        busy={action.busy}
        disabled={!/^[1-9]\d{0,19}$/.test(clientId)}
        onPress={() => {
          void action.run(async () => {
            await repository.assignPhoto(photo.id, clientId);
            await refresh();
          }, 'Cliente asignado.');
        }}
      />
      <Feedback error={action.error} success={action.success} />
    </View>
  );
}
