import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { Feedback } from '../../../components/ui/Feedback';
import { useTheme } from '../../../components/ui/theme';
import { useWorkspace } from '../../../providers/AppProvider';
import type { Attendance, Employee } from '../../../domain/models';
import { errorMessage } from '../../../domain/format';
import { AttendanceTable } from './AttendanceTable';
import { AttendanceExport } from './AttendanceExport';

export function EmployeeAttendance({ target }: { target: Employee }) {
  const { styles } = useTheme();
  const { employee, repository, data } = useWorkspace();
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify([
    target.id,
    employee.id,
    employee.roleId,
    employee.permissions,
    revision,
  ]);
  const [result, setResult] = useState<{
    key: string;
    records: Attendance[];
    error?: string;
  }>();
  useEffect(() => {
    let active = true;
    void repository
      .employeeAttendance(target.id)
      .then((records) => {
        if (active) setResult({ key, records });
      })
      .catch((cause: unknown) => {
        if (active) setResult({ key, records: [], error: errorMessage(cause) });
      });
    return () => {
      active = false;
    };
  }, [repository, target.id, key]);
  const current = result?.key === key ? result : undefined;
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.heading}>Historial completo de horarios</Text>
      <Button
        title="Actualizar horarios"
        secondary
        busy={!current}
        onPress={() => setRevision((value) => value + 1)}
      />
      <Feedback error={current?.error} />
      {current && !current.error && (
        <>
          <AttendanceTable records={current.records} data={data} />
          {employee.roleId === 'secretary' && (
            <AttendanceExport
              key={target.id}
              employee={target}
              records={current.records}
              data={data}
            />
          )}
        </>
      )}
    </View>
  );
}
