import { Link } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../ui/theme';

export function ClientPrintContact() {
  const { colors, styles } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={[styles.text, { flexShrink: 1 }]}>
        Contactanos para tener tu foto impresa!
      </Text>
      <Link
        href="https://www.instagram.com/fotoya_impresiones/?hl=es"
        target="_blank"
        rel="noopener noreferrer"
        asChild
      >
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Contactar a Foto Ya Impresiones en Instagram"
          style={{
            minWidth: 44,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image
            source={require('../../../assets/images/ui-svg/instagram.svg')}
            style={{ width: 28, height: 28 }}
            contentFit="contain"
            accessible={false}
          />
        </Pressable>
      </Link>
    </View>
  );
}
