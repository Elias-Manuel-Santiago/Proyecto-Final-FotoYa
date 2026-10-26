import { useState, type ReactNode } from 'react';
import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from './theme';

const services = [
  {
    provider: 'google-oauth2',
    label: 'Google',
    logo: require('../../../assets/images/ui-svg/google.svg'),
  },
  {
    provider: 'amazon',
    label: 'Amazon',
    logo: require('../../../assets/images/ui-svg/amazon.svg'),
  },
  {
    provider: 'apple',
    label: 'Apple',
    logo: require('../../../assets/images/ui-svg/apple.svg'),
  },
];

export function UserCard({
  name,
  email,
  providers,
  children,
}: {
  name: string;
  email: string;
  providers: string[];
  children: ReactNode;
}) {
  const { styles, colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.card, { padding: 0, gap: 0 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${email}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 16,
          minHeight: 76,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text numberOfLines={1} style={styles.label}>
            {name}
          </Text>
          <Text numberOfLines={1} style={styles.muted}>
            {email || 'Sin correo compartido'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {services
            .filter((service) => providers.includes(service.provider))
            .map((service) => (
              <Image
                key={service.provider}
                source={service.logo}
                accessibilityLabel={service.label}
                contentFit="contain"
                style={{ width: 24, height: 24 }}
                tintColor={
                  service.provider === 'apple' ? colors.text : undefined
                }
              />
            ))}
        </View>
      </Pressable>
      {open && (
        <View style={{ padding: 16, paddingTop: 0, gap: 12 }}>{children}</View>
      )}
    </View>
  );
}
