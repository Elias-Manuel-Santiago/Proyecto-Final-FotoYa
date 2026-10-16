import { Button } from '../../components/ui/Button';
import { Text, View } from 'react-native';
import { PeriodFilters } from '../../components/filters/PeriodFilters';
import { Metrics } from '../../components/metrics/Metrics';
import { EmptyState, Feedback } from '../../components/ui/Feedback';
import { Screen } from '../../components/ui/Screen';
import { styles } from '../../components/ui/theme';
import { displayDate } from '../../domain/dates';
import {
  matchesPeriod,
  reportRows,
  totalMetrics,
  visibleStations,
} from '../../domain/metrics';
import { can, hasStationAccess } from '../../domain/permissions';
import { usePeriodData } from '../../hooks/usePeriodData';
import { usePeriod } from '../../hooks/usePeriod';
import { useWorkspace } from '../../providers/AppProvider';
import { PhotoAssignment } from './components/PhotoAssignment';
import { PhotoPreview } from './components/PhotoPreview';
import { UploadQueue } from './components/UploadQueue';

export function PhotosScreen() {
  const { employee } = useWorkspace();
  const { period, update, error: periodError } = usePeriod();
  const { data, loading, reload, error: queryError } = usePeriodData(period);
  const error = periodError || queryError;
  const photos = error
    ? []
    : data.photos
        .filter(
          (photo) =>
            (employee.roleId === 'client' ||
              hasStationAccess(employee, photo.stationId)) &&
            matchesPeriod(photo, period),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <Screen title="Fotos">
      {can(employee, 'photos.upload') && <UploadQueue />}
      <PeriodFilters
        period={period}
        stations={visibleStations(data, employee)}
        onChange={update}
      />
      <Feedback error={error} />
      <Button
        title="Actualizar datos"
        secondary
        busy={loading}
        onPress={reload}
      />
      {loading && <Text style={styles.muted}>Consultando servidor…</Text>}
      {!error && !loading && (
        <>
          {employee.permissions?.includes('counts.read') && (
            <Metrics
              values={
                data.summary ?? totalMetrics(reportRows(data, employee, period))
              }
              showMoney={false}
            />
          )}
          <Text style={styles.heading}>Fotos cargadas</Text>
          {!photos.length && <EmptyState />}
          {photos.map((photo) => (
            <View key={photo.id} style={styles.card}>
              <Text style={styles.text}>{photo.name}</Text>
              <Text style={styles.muted}>{displayDate(photo.date)}</Text>
              <PhotoPreview photoId={photo.id} name={photo.name} />
              <PhotoAssignment photo={photo} />
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}
