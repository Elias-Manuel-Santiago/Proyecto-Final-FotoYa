import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Screen } from '../../components/ui/Screen';
import { Button } from '../../components/ui/Button';
import { Feedback } from '../../components/ui/Feedback';
import { styles } from '../../components/ui/theme';
import { errorMessage } from '../../domain/format';
import { displayDate } from '../../domain/dates';
import type { Price, SalePhoto } from '../../domain/models';
import { useWorkspace } from '../../providers/AppProvider';
import { useAction } from '../../hooks/useAction';
import { SalePhotoCard } from './components/SalePhotoCard';
import { SaleForm } from './components/SaleForm';

export function NewSaleScreen() {
  const { repository, employee } = useWorkspace();
  const stationId = employee.stationId;
  const action = useAction();
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState('');
  const [selling, setSelling] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const key = JSON.stringify([stationId, offset, revision]);
  const [result, setResult] = useState<{
    key: string;
    event?: { open: boolean; date: string | null };
    prices: Price[];
    photos: SalePhoto[];
    error?: string;
  }>();
  const reload = () => {
    setSelected('');
    setSelling(false);
    setRevision((value) => value + 1);
  };
  useEffect(() => {
    let active = true;
    void Promise.all([
      repository.saleEvent(stationId),
      repository.salePrices(stationId),
      repository.salePhotos(stationId, offset),
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
  }, [repository, stationId, offset, key]);
  const current = result?.key === key ? result : undefined;
  const loading = !current,
    error = current?.error ?? '';
  const event = current?.event,
    prices = current?.prices ?? [],
    photos = current?.photos ?? [];
  const blocked = loading || !!error || action.busy;
  return (
    <Screen title="Venta en evento">
      <Feedback error={error || action.error} success={action.success} />
      <Button
        title="Actualizar"
        secondary
        disabled={action.busy || selling}
        busy={loading}
        onPress={() => {
          reload();
        }}
      />
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
          {employee.roleId === 'manager' && (
            <Button
              title={
                event?.open
                  ? 'Cerrar ventas del evento'
                  : 'Abrir ventas del evento'
              }
              disabled={blocked || selling}
              busy={action.busy}
              onPress={() => {
                void action.run(async () => {
                  await repository.setSaleEvent(stationId, !event?.open);
                  reload();
                });
              }}
            />
          )}
          {!event?.open && (
            <Text style={styles.text}>
              El encargado debe abrir las ventas del puesto para registrar
              ventas del evento.
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
              <Text style={styles.muted}>
                Tocá una foto para vender. Cada foto representa una familia; las
                copias no aumentan el porcentaje.
              </Text>
              {!photos.length && (
                <Text style={styles.text}>
                  No hay fotos en esta página del evento.
                </Text>
              )}
              {photos.map((photo) => (
                <SalePhotoCard
                  key={photo.id}
                  photo={photo}
                  selected={selected === photo.id}
                  onSelect={() => {
                    if (!selling) {
                      setSelected(photo.id);
                      action.clear();
                    }
                  }}
                >
                  {!selling ? (
                    <Button
                      title="Vender"
                      disabled={blocked || !prices.length}
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
              <View style={styles.row}>
                <Button
                  title="Anterior"
                  secondary
                  disabled={blocked || selling || offset === 0}
                  onPress={() => setOffset((value) => Math.max(0, value - 12))}
                />
                <Button
                  title="Siguiente"
                  secondary
                  disabled={blocked || selling || photos.length < 12}
                  onPress={() => setOffset((value) => value + 12)}
                />
              </View>
            </>
          )}
        </>
      )}
    </Screen>
  );
}
