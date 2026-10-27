import { usePhotoVisibility } from './hooks/usePhotoVisibility';
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
  const visibility = usePhotoVisibility(
    JSON.stringify([employee.id, period]),
    reload,
    true,
  );
  const periodKey = JSON.stringify({
    period,
    ascending,
    hidden: visibility.showHidden,
  });
  const pageSize = 48;
  const [page, setPage] = useState({ key: periodKey, offset: 0 });
  const error = periodError || queryError;
  const photos = error
    ? []
    : data.photos
        .filter(
          (photo) =>
            (employee.roleId === 'client' ||
              hasStationAccess(employee, photo.stationId)) &&
            matchesPeriod(photo, period) &&
            (!visibility.enabled ||
              (!!photo.hidden || !!photo.sold) === visibility.showHidden),
        )
        .sort(
          (a, b) =>
            (ascending ? 1 : -1) * a.createdAt.localeCompare(b.createdAt),
        );
  const offset =
    page.key === periodKey
      ? Math.min(
          page.offset,
          Math.max(0, Math.ceil(photos.length / pageSize) - 1) * pageSize,
        )
      : 0;
  return (
    <Screen fullWidth title="Fotos" refreshing={refreshing} onRefresh={reload}>
      {can(employee, 'photos.upload') && <UploadQueue />}
      <PeriodFilters
        period={period}
        stations={visibleStations(data, employee)}
        onChange={update}
      >
        <SortControl ascending={ascending} onChange={setAscending} />
      </PeriodFilters>
      <Feedback error={error || refreshError} />
      {(loading || refreshing) && (
        <Text accessibilityLiveRegion="polite" style={styles.muted}>
          {loading ? 'Cargando…' : 'Actualizando…'}
        </Text>
      )}
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
          <Text style={styles.heading}>
            {visibility.showHidden ? 'Fotos ocultas' : 'Fotos cargadas'}
          </Text>
          {visibility.controls}
          {!photos.length && <EmptyState />}
          <ResponsiveGrid minWidth={160}>
            {photos.slice(offset, offset + pageSize).map((photo) => (
              <View
                key={photo.id}
                style={[styles.card, { padding: 8, gap: 6 }]}
              >
                <Text style={styles.text} numberOfLines={1}>
                  {photo.name}
                </Text>
                <Text style={styles.muted}>{displayDate(photo.date)}</Text>
                {visibility.selectionControl(photo.id, photo.name, photo.sold)}
                <PhotoPreview
                  photoId={photo.id}
                  name={photo.name}
                  showOpenButton={false}
                  thumbnailHeight={130}
                >
                  {(close) => (
                    <>
                      <PhotoAssignment photo={photo} />
                      {!photo.hidden &&
                        can(employee, 'sales.create') &&
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
          {photos.length > pageSize && (
            <View style={styles.row}>
              <Button
                title="Anterior"
                secondary
                disabled={offset === 0}
                onPress={() =>
                  setPage({ key: periodKey, offset: offset - pageSize })
                }
              />
              <Text style={styles.muted}>
                {offset + 1}–{Math.min(offset + pageSize, photos.length)} de{' '}
                {photos.length}
              </Text>
              <Button
                title="Siguiente"
                secondary
                disabled={offset + pageSize >= photos.length}
                onPress={() =>
                  setPage({ key: periodKey, offset: offset + pageSize })
                }
              />
            </View>
          )}
        </>
      )}
    </Screen>
  );
}
