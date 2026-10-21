import { useState } from 'react';
import { Pressable, StyleSheet, View, type TextInputProps } from 'react-native';
import { Field } from './Field';
import { colors } from './theme';

export function PasswordField({
  label,
  ...props
}: Omit<TextInputProps, 'secureTextEntry'> & { label: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      {...props}
      label={label}
      secureTextEntry={!visible}
      rightAccessory={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${visible ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`}
          accessibilityState={{ disabled: props.editable === false }}
          disabled={props.editable === false}
          onPress={() => setVisible((current) => !current)}
          style={({ pressed }) => [
            localStyles.button,
            { opacity: props.editable === false ? 0.4 : pressed ? 0.6 : 1 },
          ]}
        >
          <View accessible={false} style={localStyles.icon}>
            <View style={localStyles.eye}>
              <View style={localStyles.pupil} />
            </View>
            {!visible && <View style={localStyles.slash} />}
          </View>
        </Pressable>
      }
    />
  );
}

const localStyles = StyleSheet.create({
  button: {
    width: 46,
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eye: {
    width: 22,
    height: 14,
    borderWidth: 2,
    borderColor: colors.muted,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pupil: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.muted,
  },
  slash: {
    position: 'absolute',
    width: 26,
    height: 2,
    backgroundColor: colors.muted,
    transform: [{ rotate: '-45deg' }],
  },
});
