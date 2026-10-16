import { Text } from 'react-native';
import { Screen } from '../../components/ui/Screen';
import { styles } from '../../components/ui/theme';

export function NewSaleScreen() {
  return (
    <Screen title="Registrar venta">
      <Text style={styles.text}>
        El registro de ventas todavía no está habilitado.
      </Text>
      <Text style={styles.muted}>
        Falta definir las ventas repetidas o copias y el período de las fotos
        incluidas. Podés consultar las ventas existentes desde Ventas.
      </Text>
    </Screen>
  );
}
