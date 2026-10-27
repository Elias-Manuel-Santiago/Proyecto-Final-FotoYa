import { Link, usePathname } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { roleLabels } from '../../domain/permissions';
import { useWorkspace } from '../../providers/AppProvider';
import { useNavigationMode } from '../../hooks/useNavigationMode';
import { Icon } from '../ui/Icon';
import { ScreenLayoutContext } from '../ui/Screen';
import { useTheme } from '../ui/theme';
import { ClientPrintContact } from './ClientPrintContact';
import {
  isNavigationActive,
  navigationFor,
  type NavigationItem,
} from './workspace-navigation';

function NavigationLink({
  item,
  placement,
  expanded = true,
}: {
  item: NavigationItem;
  placement: 'rail' | 'tab';
  expanded?: boolean;
}) {
  const { colors } = useTheme();
  const pathname = usePathname();
  const active = isNavigationActive(pathname, item.href);
  const tab = placement === 'tab';
  const showLabel = tab || expanded;
  return (
    <Link href={item.href} asChild>
      <Pressable
        accessibilityRole={tab ? 'tab' : 'link'}
        accessibilityLabel={item.label}
        accessibilityState={{ selected: active }}
        style={{
          minWidth: tab ? 104 : 0,
          flexShrink: 0,
          flexDirection: tab ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: showLabel && !tab ? 'flex-start' : 'center',
          gap: tab ? 8 : 12,
          paddingHorizontal: tab || expanded ? 16 : 12,
          paddingVertical: 12,
          minHeight: tab ? 76 : 56,
          borderRadius: tab ? 14 : 12,
          backgroundColor: active
            ? tab
              ? colors.lavender
              : colors.accent
            : 'transparent',
        }}
      >
        <View
          style={{
            width: tab ? 24 : 28,
            height: tab ? 24 : 28,
            flexShrink: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon
            name={item.icon}
            selected={active}
            size={tab ? 24 : 28}
            color={active ? colors.primary : colors.muted}
          />
        </View>
        {showLabel && (
          <Text
            style={{
              flexShrink: 1,
              color: active ? colors.primary : colors.text,
              fontSize: tab ? 12 : 15,
              lineHeight: tab ? 18 : 22,
              fontWeight: active ? '700' : '500',
              textAlign: tab ? 'center' : 'left',
            }}
          >
            {item.label}
          </Text>
        )}
      </Pressable>
    </Link>
  );
}

export function WorkspaceHeader({ children }: { children: ReactNode }) {
  const { colors, styles } = useTheme();
  const { employee, data } = useWorkspace();
  const { bottom, width } = useNavigationMode();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(true);
  const station = data.stations.find((row) => row.id === employee.stationId);
  const showStation = !['owner', 'client'].includes(employee.roleId);
  const navigation = navigationFor(employee);
  const brand = (
    <Image
      source={require('../../../assets/images/ui-svg/foto-ya-logo-texto.png')}
      accessibilityLabel="Foto Ya"
      contentFit="contain"
      style={{ width: bottom ? 100 : 140, height: 44, flexShrink: 0 }}
    />
  );
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
      }}
    >
      <View
        style={{
          paddingTop: insets.top,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View
          style={{
            minHeight: 64,
            paddingHorizontal: bottom ? 16 : 28,
            paddingVertical: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
          }}
        >
          {brand}
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            {showStation && (
              <Text numberOfLines={1} style={styles.muted}>
                {roleLabels[employee.roleId]}
              </Text>
            )}
          </View>
        </View>
      </View>
      {employee.roleId === 'client' && bottom && <ClientPrintContact />}
      <View style={{ flex: 1, minHeight: 0, flexDirection: 'row' }}>
        {!bottom && (
          <View
            style={{
              width: (expanded ? 248 : 80) + insets.left,
              paddingTop: 16,
              paddingBottom: Math.max(insets.bottom, 16),
              paddingLeft: insets.left + 12,
              paddingRight: 12,
              gap: 20,
              backgroundColor: colors.surface,
              borderRightWidth: 1,
              borderColor: colors.border,
            }}
          >
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 6 }}>
              {navigation.map((item) => (
                <NavigationLink
                  key={String(item.href)}
                  item={item}
                  placement="rail"
                  expanded={expanded}
                />
              ))}
            </ScrollView>
            {expanded && (
              <Text style={[styles.muted, { paddingHorizontal: 12 }]}>
                Foto Ya · {roleLabels[employee.roleId]}
              </Text>
            )}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: expanded ? 'flex-end' : 'center',
                gap: 8,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  expanded ? 'Contraer navegación' : 'Expandir navegación'
                }
                accessibilityState={{ expanded }}
                onPress={() => setExpanded(!expanded)}
                style={({ pressed }) => ({
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: pressed ? colors.accent : 'transparent',
                })}
              >
                <Icon
                  name={expanded ? 'flecha-izq' : 'flecha-der'}
                  size={20}
                  color={colors.muted}
                />
              </Pressable>
            </View>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <ScreenLayoutContext.Provider
            value={{ embedded: true, bottomNavigation: bottom }}
          >
            {children}
          </ScreenLayoutContext.Provider>
        </View>
      </View>
      {employee.roleId === 'client' && !bottom && <ClientPrintContact />}
      {bottom && (
        <View
          style={{
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderColor: colors.border,
          }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            contentContainerStyle={[
              { padding: 12, gap: 12 },
              navigation.length < 4 && {
                flexGrow: 1,
                justifyContent: 'center',
              },
            ]}
          >
            {navigation.map((item) => (
              <NavigationLink
                key={String(item.href)}
                item={item}
                placement="tab"
              />
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
