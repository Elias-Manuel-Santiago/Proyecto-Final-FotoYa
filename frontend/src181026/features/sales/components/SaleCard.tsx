import { useState } from 'react';
import { Text, View } from 'react-native';
import type { AppData, Sale } from '../../../domain/models';
import { displayDate } from '../../../domain/dates';
import { money } from '../../../domain/format';
import { styles } from '../../../components/ui/theme';
import { Button } from '../../../components/ui/Button';
import { Feedback } from '../../../components/ui/Feedback';
import { useAction } from '../../../hooks/useAction';
import { useWorkspace } from '../../../providers/AppProvider';

export function SaleCard({ sale, data }: { sale: Sale; data: AppData }) {
  const { repository } = useWorkspace();
  const [detail, setDetail] =
    useState<Awaited<ReturnType<typeof repository.saleDetail>>>();
  const action = useAction();
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>
        {sale.quantity} familias · {money(sale.total)}
      </Text>
      <Text style={styles.text}>
        {data.stations.find((row) => row.id === sale.stationId)?.name} ·{' '}
        {displayDate(sale.date)}
      </Text>
      <Button
        title="Consultar detalle"
        secondary
        busy={action.busy}
        onPress={() => {
          void action.run(async () =>
            setDetail(await repository.saleDetail(sale.id)),
          );
        }}
      />
      <Feedback error={action.error} />
      {detail?.copies != null && (
        <Text style={styles.text}>
          Copias: {detail.copies} · Pago: {detail.paymentMethod}
        </Text>
      )}
      {detail?.prices.map((price, index) => (
        <Text key={index} style={styles.text}>
          Tarifa {price.priceId}: {price.quantity} ×{' '}
          {money(Number(price.unitPrice))}
        </Text>
      ))}
      {detail && (
        <Text style={styles.muted}>
          Fotos vinculadas:{' '}
          {detail.photos.map((row) => row.photoId).join(', ') ||
            'Sin fotos vinculadas'}
        </Text>
      )}
    </View>
  );
}
