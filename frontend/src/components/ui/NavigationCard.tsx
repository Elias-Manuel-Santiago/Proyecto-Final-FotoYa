import { Link, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Icon, type IconName } from './Icon';
import { useTheme } from './theme';

export function NavigationCard({
  href,
  title,
  description,
  icon,
}: {
  href: Href;
  title: string;
  description?: string;
  icon: IconName;
}) {
  const { colors, styles } = useTheme();
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={title}
        style={({ pressed }) => [
          styles.card,
          {
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: description ? 112 : 72,
            gap: 16,
            backgroundColor: pressed ? colors.accent : colors.surface,
          },
        ]}
      >
        <View
          style={{
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.accent,
            borderRadius: 12,
          }}
        >
          <Icon name={icon} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.label}>{title}</Text>
          {!!description && <Text style={styles.muted}>{description}</Text>}
        </View>
        <Icon name="flecha-der" size={18} color={colors.muted} />
      </Pressable>
    </Link>
  );
}
