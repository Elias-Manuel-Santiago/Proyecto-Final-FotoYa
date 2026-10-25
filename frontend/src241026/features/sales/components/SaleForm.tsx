/**
 * @file
 * Recoge copias por tarifa y pago. Conserva UUID al reintentar el mismo cuerpo y marca
 * guardado tras confirmar el servidor.
 */
import { useState } from 'react';
import { Text, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Select } from '../../../components/ui/Select';
import { Feedback } from '../../../components/ui/Feedback';
import { useTheme } from '../../../components/ui/theme';
import { money } from '../../../domain/format';
import type { EventSaleInput, Price } from '../../../domain/models';
import { useAction } from '../../../hooks/useAction';
import { useWorkspace } from '../../../providers/AppProvider';

// Recoge copias y pago, conserva el UUID del intento y espera confirmación del guardado.
export function SaleForm({
  prices,
  photoId,
  stationId,
  onSaved,
  onBusy,
}: {
  prices: Price[];
  photoId: string;
  stationId: string;
  onSaved: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const { styles } = useTheme();
  const { repository } = useWorkspace();
  const action = useAction();
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [method, setMethod] =
    useState<EventSaleInput['paymentMethod']>('efectivo');
  const [attempt, setAttempt] = useState<{ body: string; id: string }>();
  const [saved, setSaved] = useState(false);
  const lines = prices
    .filter((row) => Number(quantities[row.id]) > 0)
    .map((row) => ({
      priceId: row.id,
      copies: Number(quantities[row.id]),
    }));
  const valid = Object.values(quantities).every(
    (value) => !value || (/^\d{1,5}$/.test(value) && Number(value) <= 10000),
  );
  // El total local orienta al usuario; el servidor recalcula con las tarifas vigentes.
  const totalCents = prices.reduce(
    (sum, row) =>
      sum +
      Math.round(Number(row.amount) * 100) * Number(quantities[row.id] || 0),
    0,
  );
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.heading}>Tarifas y copias</Text>
      {prices.map((price) => (
        <Field
          key={price.id}
          label={`${price.name} · ${money(Number(price.amount))} · Copias`}
          keyboardType="number-pad"
          value={quantities[price.id] ?? ''}
          placeholder="0"
          maxLength={5}
          editable={!action.busy && !saved}
          onChangeText={(value) =>
            setQuantities((current) => ({ ...current, [price.id]: value }))
          }
        />
      ))}
      <Select
        label="Método de pago"
        value={method}
        disabled={action.busy || saved}
        onChange={(value) =>
          setMethod(value as EventSaleInput['paymentMethod'])
        }
        options={['efectivo', 'transferencia', 'tarjeta'].map((value) => ({
          value,
          label: value[0].toUpperCase() + value.slice(1),
        }))}
      />
      <Text style={styles.heading}>Total: {money(totalCents / 100)}</Text>
      <Feedback error={action.error} success={action.success} />
      <Button
        title={saved ? 'Venta registrada' : 'Confirmar venta'}
        busy={action.busy}
        disabled={saved || !prices.length || !valid || !lines.length}
        onPress={() => {
          void action.run(async () => {
            const payload = {
              photoId,
              stationId,
              paymentMethod: method,
              prices: lines,
            };
            const body = JSON.stringify(payload);
            // Mismo cuerpo conserva UUID ante una respuesta perdida; cambiar datos inicia otra operación.
            const id = attempt?.body === body ? attempt.id : randomUUID();
            setAttempt({ body, id });
            onBusy(true);
            try {
              await repository.recordSale({ ...payload, operationId: id });
              // La interfaz marca la venta como guardada únicamente después de la confirmación de la API.
              setSaved(true);
              onSaved();
            } finally {
              onBusy(false);
            }
          }, 'Venta registrada.');
        }}
      />
    </View>
  );
}
