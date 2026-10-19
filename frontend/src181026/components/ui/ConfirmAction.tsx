import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from './Button';
import { styles } from './theme';

export function ConfirmAction({
  title,
  question,
  onConfirm,
  busy,
}: {
  title: string;
  question: string;
  onConfirm: () => Promise<void>;
  busy: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  return confirming ? (
    <View style={styles.card}>
      <Text style={styles.text}>{question}</Text>
      <View style={styles.row}>
        <Button
          title="Confirmar"
          danger
          busy={busy}
          onPress={() => {
            void onConfirm().then(() => setConfirming(false));
          }}
        />
        <Button
          title="Cancelar"
          secondary
          disabled={busy}
          onPress={() => setConfirming(false)}
        />
      </View>
    </View>
  ) : (
    <Button title={title} danger onPress={() => setConfirming(true)} />
  );
}
