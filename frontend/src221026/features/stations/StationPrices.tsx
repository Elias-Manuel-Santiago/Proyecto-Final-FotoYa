/**
 * @file
 * Consulta y administra tarifas de un puesto. Coordina nombre, importe, edición y
 * disponibilidad mediante el repositorio.
 */
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Feedback } from '../../components/ui/Feedback';
import { useTheme } from '../../components/ui/theme';
import { money, errorMessage } from '../../domain/format';
import type { Price } from '../../domain/models';
import { useWorkspace } from '../../providers/AppProvider';
import { useAction } from '../../hooks/useAction';

// Carga tarifas del puesto y permite crear, editar o cambiar disponibilidad.
export function StationPrices({ stationId }: { stationId: string }) {
  const { styles } = useTheme();
  const { repository } = useWorkspace();
  const action = useAction();
  const [prices, setPrices] = useState<Price[]>([]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [editing, setEditing] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    repository
      .stationPrices(stationId)
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
        <View key={price.id} style={{ gap: 8 }}>
          <Text style={styles.text}>
            {price.name}: {money(Number(price.amount))} ·{' '}
            {price.active ? 'Activo' : 'Inactivo'}
          </Text>
          <View style={styles.row}>
            <Button
              title={`Editar ${price.name}`}
              secondary
              disabled={action.busy}
              onPress={() => {
                setEditing(price.id);
                setName(price.name);
                setAmount(price.amount);
                action.clear();
              }}
            />
            <Button
              title={`${price.active ? 'Desactivar' : 'Reactivar'} ${price.name}`}
              secondary
              busy={action.busy}
              onPress={() => {
                void action.run(async () => {
                  await repository.setPriceActive(
                    stationId,
                    price.id,
                    !price.active,
                  );
                  setPrices(await repository.stationPrices(stationId));
                  setError('');
                }, 'Precio guardado.');
              }}
            />
          </View>
        </View>
      ))}
      {!prices.length && (
        <Text style={styles.muted}>No hay precios registrados.</Text>
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
        title={editing ? 'Guardar precio' : 'Agregar precio'}
        busy={action.busy}
        disabled={!name.trim() || !/^\d{1,10}([.,]\d{1,2})?$/.test(amount)}
        onPress={() => {
          void action.run(async () => {
            const normalized = amount.replace(',', '.');
            if (editing)
              await repository.updatePrice(
                stationId,
                editing,
                name.trim(),
                normalized,
              );
            else
              await repository.createPrice(stationId, name.trim(), normalized);
            setEditing('');
            setName('');
            setAmount('');
            setPrices(await repository.stationPrices(stationId));
            setError('');
          }, 'Precio guardado.');
        }}
      />
      {!!editing && (
        <Button
          title="Cancelar edición"
          secondary
          disabled={action.busy}
          onPress={() => {
            setEditing('');
            setName('');
            setAmount('');
            action.clear();
          }}
        />
      )}
    </View>
  );
}
