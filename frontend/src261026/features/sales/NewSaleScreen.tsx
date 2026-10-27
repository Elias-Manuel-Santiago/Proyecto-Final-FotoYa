/**
 * @file
 * Coordina evento del día, tarifas y páginas de doce fotos. Reinicia al cambiar día/puesto y
 * bloquea refresco durante confirmación.
 */
import { usePhotoVisibility } from '../photos/hooks/usePhotoVisibility';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Screen } from '../../components/ui/Screen';
import { Button } from '../../components/ui/Button';
import { Feedback } from '../../components/ui/Feedback';
import { useTheme } from '../../components/ui/theme';
import { errorMessage } from '../../domain/format';
import { displayDate } from '../../domain/dates';
import type { Price, SalePhoto } from '../../domain/models';
import { useWorkspace } from '../../providers/AppProvider';
import { useAction } from '../../hooks/useAction';
import { useBusinessDate } from '../../hooks/useBusinessDate';
import { SalePhotoCard } from './components/SalePhotoCard';
import { SaleForm } from './components/SaleForm';
import { PhotoAssignment } from '../photos/components/PhotoAssignment';
import { Link, useLocalSearchParams } from 'expo-router';
import { ResponsiveGrid } from '@/components/ui/ResponsiveGrid';

// Usa el día comercial para reiniciar el flujo de venta al cambiar la fecha.
export function NewSaleScreen() {
  const today = useBusinessDate();
  const { employee } = useWorkspace();
  return (
    <DailySaleScreen key={`${employee.stationId}:${today}`} today={today} />
  );
}

// Carga evento, tarifas y fotos del puesto y coordina selección y registro de venta.
function DailySaleScreen({ today }: { today: string }) {
  const { styles } = useTheme();
  const { photoId } = useLocalSearchParams<{ photoId?: string }>();
  const { repository, employee } = useWorkspace();
  const stationId = employee.stationId;
  const action = useAction();
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState(photoId ?? '');
  const [selling, setSelling] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [result, setResult] = useState<{
    key: string;
    event?: { open: boolean; date: string | null };
    prices: Price[];
    photos: SalePhoto[];
    error?: string;
  }>();
  // Limpia la foto seleccionada y solicita consultar nuevamente el evento.
  const reload = useCallback(() => {
    setSelected('');
    setSelling(false);
    setRevision((value) => value + 1);
  }, []);
  const visibility = usePhotoVisibility(
    JSON.stringify([employee.id, stationId, today]),
    reload,
  );
  const pageSize = 48;
  const [pageMode, setPageMode] = useState(false);
  const pageOffset = pageMode === visibility.showHidden ? offset : 0;
  const key = JSON.stringify([
    stationId,
    pageOffset,
    revision,
    today,
    photoId,
    visibility.showHidden,
  ]);
  useEffect(() => {
    let active = true;
    void Promise.all([
      repository.saleEvent(stationId),
      repository.salePrices(stationId),
      repository.salePhotos(
        stationId,
        pageOffset,
        photoId,
        pageSize,
        visibility.showHidden,
      ),
    ])
      .then(([event, prices, photos]) => {
        if (active) setResult({ key, event, prices, photos });
      })
      .catch((cause: unknown) => {
        if (active)
          setResult({
            key,
            prices: [],
            photos: [],
            error: errorMessage(cause),
          });
      });
    return () => {
      active = false;
    };
  }, [repository, stationId, pageOffset, key, photoId, visibility.showHidden]);
  // Solo se muestran resultados correspondientes al puesto, día y página actuales.
  const current = result?.key === key ? result : undefined;
  const loading = !current,
    error = current?.error ?? '';
  const event = current?.event,
    prices = current?.prices ?? [],
    photos = (current?.photos ?? []).filter(
      (photo) =>
        photo.date === today &&
        (selling ||
          visibility.showHidden ||
          !visibility.enabled ||
          !photo.sold),
    );
  const blocked = loading || !!error || action.busy;
  // Refleja aperturas/cierres desde Check-in sin interrumpir un formulario de venta.
  useEffect(() => {
    if (!event || selling) return;
    let active = true;
    let running = false;
    const timer = setInterval(() => {
      if (running) return;
      running = true;
      void repository
        .saleEvent(stationId)
        .then((latest) => {
          if (
            active &&
            (latest.open !== event.open || latest.date !== event.date)
          )
            reload();
        })
        .catch(() => undefined)
        .finally(() => {
          running = false;
        });
    }, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [repository, stationId, event, selling, reload]);
  return (
    <Screen
      fullWidth
      title="Venta en evento"
      refreshing={loading}
      onRefresh={reload}
      refreshEnabled={!action.busy && !selling}
    >
      <Feedback error={error || action.error} success={action.success} />
      {!!photoId && !selling && (
        <Link href="/sales/new" replace style={styles.text}>
          Ver todas las fotos del evento
        </Link>
      )}
      {!error && !loading && (
        <>
          <Text style={styles.heading}>
            Ventas {event?.open ? 'abiertas' : 'cerradas'}
          </Text>
          {!!event?.date && (
            <Text style={styles.muted}>
              Evento del {displayDate(event.date)}
            </Text>
          )}
          {!event?.open && (
            <Text style={styles.text}>
              Abrí las ventas del puesto desde la pantalla de Check-in para
              registrar ventas del evento.
            </Text>
          )}
          {!prices.length && (
            <Text style={styles.error}>
              No hay precios disponibles para vender en este puesto. Configurá
              las tarifas antes de registrar una venta.
            </Text>
          )}
          {event?.open && (
            <>
              {!selling && visibility.controls}
              {!photos.length && (
                <Text style={styles.text}>
                  No hay fotos en esta página del evento.
                </Text>
              )}
              <ResponsiveGrid minWidth={selling ? 340 : 300}>
                {photos
                  .filter((photo) => !selling || photo.id === selected)
                  .map((photo) => (
                    <SalePhotoCard
                      key={photo.id}
                      photo={photo}
                      selectionControl={
                        !selling
                          ? visibility.selectionControl(
                              photo.id,
                              `Foto ${photo.id}`,
                              photo.sold,
                            )
                          : undefined
                      }
                      selected={selected === photo.id}
                      onSelect={() => {
                        if (!selling) {
                          setSelected(photo.id);
                          action.clear();
                        }
                      }}
                    >
                      {!selling && !visibility.showHidden && (
                        <PhotoAssignment
                          photo={photo}
                          sale
                          onSaved={(assignment) =>
                            setResult((current) =>
                              current
                                ? {
                                    ...current,
                                    photos: current.photos.map((row) =>
                                      row.id === photo.id
                                        ? { ...row, ...assignment }
                                        : row,
                                    ),
                                  }
                                : current,
                            )
                          }
                        />
                      )}
                      {!selling ? (
                        <Button
                          title="Vender"
                          disabled={
                            blocked ||
                            !prices.length ||
                            visibility.showHidden ||
                            visibility.busy
                          }
                          onPress={() => setSelling(true)}
                        />
                      ) : (
                        <View style={{ gap: 12 }}>
                          <SaleForm
                            photoId={photo.id}
                            stationId={stationId}
                            prices={prices}
                            onBusy={setSubmitting}
                            onSaved={() =>
                              setResult((current) =>
                                current
                                  ? {
                                      ...current,
                                      photos: current.photos.map((row) =>
                                        row.id === photo.id
                                          ? { ...row, sold: true }
                                          : row,
                                      ),
                                    }
                                  : current,
                              )
                            }
                          />
                          <Button
                            title="Volver a las fotos"
                            secondary
                            disabled={submitting}
                            onPress={() => {
                              setSelling(false);
                              setSelected('');
                            }}
                          />
                        </View>
                      )}
                    </SalePhotoCard>
                  ))}
              </ResponsiveGrid>
              <View style={styles.row}>
                <Button
                  title="Anterior"
                  secondary
                  disabled={
                    blocked || selling || visibility.busy || pageOffset === 0
                  }
                  onPress={() => {
                    setPageMode(visibility.showHidden);
                    setOffset(Math.max(0, pageOffset - pageSize));
                  }}
                />
                <Button
                  title="Siguiente"
                  secondary
                  disabled={
                    blocked ||
                    selling ||
                    visibility.busy ||
                    (current?.photos.length ?? 0) < pageSize
                  }
                  onPress={() => {
                    setPageMode(visibility.showHidden);
                    setOffset(pageOffset + pageSize);
                  }}
                />
              </View>
            </>
          )}
        </>
      )}
    </Screen>
  );
}
