import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Feedback } from '../../components/ui/Feedback';
import { styles } from '../../components/ui/theme';
import { money, errorMessage } from '../../domain/format';
import type { Price } from '../../domain/models';
import { useWorkspace } from '../../providers/AppProvider';
import { useAction } from '../../hooks/useAction';

export function StationPrices({ stationId }: { stationId: string }) {
  const { repository } = useWorkspace();
  const action = useAction();
  const [prices, setPrices] = useState<Price[]>([]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    repository
      .salePrices(stationId)
      .then((rows) => {
        if (active) setPrices(rows);
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [repository, stationId]);
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.heading}>Precios del puesto</Text>
      <Feedback error={error || action.error} success={action.success} />
      {prices.map((price) => (
        <Text key={price.id} style={styles.text}>
          {price.name}: {money(Number(price.amount))}
        </Text>
      ))}
      {!prices.length && (
        <Text style={styles.muted}>Sin tarifas disponibles.</Text>
      )}
      <Field
        label="Nombre de la tarifa"
        value={name}
        onChangeText={setName}
        maxLength={100}
        editable={!action.busy}
      />
      <Field
        label="Precio por copia"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        editable={!action.busy}
      />
      <Button
        title="Agregar precio"
        busy={action.busy}
        disabled={!name.trim() || !/^\d{1,10}([.,]\d{1,2})?$/.test(amount)}
        onPress={() => {
          void action.run(async () => {
            await repository.createPrice(
              stationId,
              name.trim(),
              amount.replace(',', '.'),
            );
            setName('');
            setAmount('');
            setPrices(await repository.salePrices(stationId));
            setError('');
          }, 'Precio agregado.');
        }}
      />
    </View>
  );
}
