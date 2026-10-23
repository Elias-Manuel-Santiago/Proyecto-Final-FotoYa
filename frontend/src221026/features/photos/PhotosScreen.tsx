import { ResponsiveGrid } from '../../components/ui/ResponsiveGrid';
import { SortControl } from '../../components/filters/SortControl';
/**
 * @file
 * Une galería por período, carga y asignación según permisos. Consulta metadatos y delega
 * acceso privado a PhotoPreview.
 */
import { Button } from '../../components/ui/Button';
import { Text, View } from 'react-native';
import { PeriodFilters } from '../../components/filters/PeriodFilters';
import { Metrics } from '../../components/metrics/Metrics';
import { EmptyState, Feedback } from '../../components/ui/Feedback';
import { Screen } from '../../components/ui/Screen';
import { useTheme } from '../../components/ui/theme';
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
import { Link } from 'expo-router';
import { useBusinessDate } from '../../hooks/useBusinessDate';
import { useState } from 'react';

// Combina galería por período, carga y asignación según rol y permisos actuales.
export function PhotosScreen() {
  const [ascending, setAscending] = useState(false);
  const { styles } = useTheme();
  const today = useBusinessDate();
  const { employee } = useWorkspace();
  const { period, update, error: periodError } = usePeriod();
  const {
    data,
    loading,
    refreshing,
    reload,
    refreshError,
    error: queryError,
  } = usePeriodData(period);
  const periodKey = JSON.stringify({ period, ascending });
  const [page, setPage] = useState({ key: periodKey, offset: 0 });
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
        .sort(
          (a, b) =>
            (ascending ? 1 : -1) * a.createdAt.localeCompare(b.createdAt),
        );
  const offset =
    page.key === periodKey
      ? Math.min(
          page.offset,
          Math.max(0, Math.ceil(photos.length / 12) - 1) * 12,
        )
      : 0;
  return (
    <Screen title="Fotos" refreshing={refreshing} onRefresh={reload}>
      {can(employee, 'photos.upload') && <UploadQueue />}
      <PeriodFilters
        period={period}
        stations={visibleStations(data, employee)}
        onChange={update}
      />
      <SortControl ascending={ascending} onChange={setAscending} />
      <Feedback error={error || refreshError} />
      <Text style={styles.muted}>
        {loading ? 'Cargando…' : refreshing ? 'Actualizando…' : ' '}
      </Text>
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
          <ResponsiveGrid>
            {photos.slice(offset, offset + 12).map((photo) => (
              <View key={photo.id} style={styles.card}>
                <Text style={styles.text}>{photo.name}</Text>
                <Text style={styles.muted}>{displayDate(photo.date)}</Text>
                <PhotoPreview photoId={photo.id} name={photo.name}>
                  {(close) => (
                    <>
                      <PhotoAssignment photo={photo} />
                      {can(employee, 'sales.create') &&
                        photo.stationId === employee.stationId &&
                        photo.date === today && (
                          <Link
                            href={{
                              pathname: '/sales/new',
                              params: { photoId: photo.id },
                            }}
                            style={styles.text}
                            onPress={close}
                          >
                            Vender foto en el evento
                          </Link>
                        )}
                    </>
                  )}
                </PhotoPreview>
              </View>
            ))}
          </ResponsiveGrid>
          {photos.length > 12 && (
            <View style={styles.row}>
              <Button
                title="Anterior"
                secondary
                disabled={offset === 0}
                onPress={() => setPage({ key: periodKey, offset: offset - 12 })}
              />
              <Text style={styles.muted}>
                {offset + 1}–{Math.min(offset + 12, photos.length)} de{' '}
                {photos.length}
              </Text>
              <Button
                title="Siguiente"
                secondary
                disabled={offset + 12 >= photos.length}
                onPress={() => setPage({ key: periodKey, offset: offset + 12 })}
              />
            </View>
          )}
        </>
      )}
    </Screen>
  );
}
