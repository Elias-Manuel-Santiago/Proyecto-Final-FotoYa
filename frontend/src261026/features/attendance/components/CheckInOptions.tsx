import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Feedback } from '../../../components/ui/Feedback';
import { Icon } from '../../../components/ui/Icon';
import { useTheme } from '../../../components/ui/theme';
import { useAction } from '../../../hooks/useAction';
import { useWorkspace } from '../../../providers/AppProvider';

export function CheckInOptions({
  disabled,
  onOpen,
}: {
  disabled: boolean;
  onOpen: () => void;
}) {
  const { styles, colors, mode, toggle } = useTheme();
  const { logoutCheckIn } = useWorkspace();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<'menu' | 'logout' | null>(null);
  const [password, setPassword] = useState('');
  const action = useAction();
  const close = () => {
    if (action.busy) return;
    setView(null);
    setPassword('');
    action.clear();
  };
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Opciones de Check-in"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => {
          onOpen();
          setView('menu');
        }}
        style={({ pressed }) => ({
          position: 'absolute',
          bottom: insets.bottom + 16,
          left: insets.left + 16,
          width: 44,
          height: 44,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 6,
          boxShadow: '0 4px 16px #00000030',
          opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
        })}
      >
        <Icon name="opciones" />
      </Pressable>
      <Modal
        visible={view !== null}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: '#00000066',
            justifyContent: 'flex-end',
          }}
        >
          <ScrollView
            style={{ flexGrow: 0, maxHeight: '90%' }}
            contentContainerStyle={{ padding: 16 }}
          >
            <View style={styles.card}>
              <Text style={styles.heading}>
                {view === 'logout' ? 'Cerrar sesión' : 'Opciones de Check-in'}
              </Text>
              <Feedback error={action.error} />
              {view === 'menu' ? (
                <>
                  <Button
                    title="Cerrar sesión"
                    secondary
                    onPress={() => setView('logout')}
                  />
                  <Button
                    title={`Activar tema ${mode === 'light' ? 'oscuro' : 'claro'}`}
                    secondary
                    onPress={toggle}
                  />
                </>
              ) : (
                <>
                  <Field
                    label="Contraseña del encargado"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={128}
                    editable={!action.busy}
                  />
                  <Button
                    title="Confirmar cierre de sesión"
                    busy={action.busy}
                    disabled={!password}
                    onPress={() => {
                      void action.run(async () => {
                        try {
                          await logoutCheckIn(password);
                          setView(null);
                        } finally {
                          setPassword('');
                        }
                      });
                    }}
                  />
                </>
              )}
              <Button
                title="Cerrar opciones"
                secondary
                disabled={action.busy}
                onPress={close}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
