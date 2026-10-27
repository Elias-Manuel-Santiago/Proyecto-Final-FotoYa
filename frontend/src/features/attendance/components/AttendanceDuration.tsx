import { useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Feedback } from '../../../components/ui/Feedback';
import { useTheme } from '../../../components/ui/theme';
import { useAction } from '../../../hooks/useAction';
import { useWorkspace } from '../../../providers/AppProvider';
import { duration } from '../../../domain/dates';
import { hoursLabel } from '../../../domain/attendance-payroll';
import type { Attendance } from '../../../domain/models';

export function AttendanceDuration({
  record,
  onSaved,
}: {
  record: Attendance;
  onSaved: () => void;
}) {
  const { repository } = useWorkspace();
  const { styles } = useTheme();
  const action = useAction();
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState(
    String(Math.floor((record.manualMinutes ?? 0) / 60)),
  );
  const [minutes, setMinutes] = useState(
    String((record.manualMinutes ?? 0) % 60),
  );
  const valid =
    /^\d{1,3}$/.test(hours) &&
    /^\d{1,2}$/.test(minutes) &&
    Number(hours) <= 168 &&
    Number(minutes) <= 59 &&
    Number(hours) * 60 + Number(minutes) > 0;
  return (
    <>
      <Button
        title={
          record.manualMinutes != null
            ? `${hoursLabel(record.manualMinutes * 60)} · Informada`
            : `${duration(record.checkIn, record.checkOut, record.closedAt)} · Definir duración`
        }
        secondary
        onPress={() => {
          setOpen(true);
          action.clear();
        }}
      />
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!action.busy) setOpen(false);
        }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
            backgroundColor: '#0008',
          }}
        >
          <View
            style={[styles.card, { width: '100%', maxWidth: 420, gap: 12 }]}
          >
            <Text style={styles.heading}>Completar duración trabajada</Text>
            <Text style={styles.muted}>
              La duración informada queda guardada con tu usuario y se usa en el
              cálculo de pago y el CSV. Las marcaciones originales se conservan.
            </Text>
            <Field
              label="Horas trabajadas (0 a 168)"
              value={hours}
              onChangeText={setHours}
              keyboardType="number-pad"
              maxLength={3}
              editable={!action.busy}
            />
            <Field
              label="Minutos trabajados (0 a 59)"
              value={minutes}
              onChangeText={setMinutes}
              keyboardType="number-pad"
              maxLength={2}
              editable={!action.busy}
            />
            <Feedback error={action.error} />
            <Button
              title="Guardar duración"
              busy={action.busy}
              disabled={!valid}
              onPress={() => {
                void action.run(async () => {
                  await repository.defineAttendanceDuration(
                    record.id,
                    Number(hours),
                    Number(minutes),
                  );
                  setOpen(false);
                  onSaved();
                });
              }}
            />
            <Button
              title="Cancelar"
              secondary
              disabled={action.busy}
              onPress={() => setOpen(false)}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}
