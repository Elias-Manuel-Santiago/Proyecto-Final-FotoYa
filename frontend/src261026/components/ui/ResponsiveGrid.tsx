import { Children, useState, type ReactNode } from 'react';
import { View } from 'react-native';
/** Fit more records into wider screens while keeping individual cards readable. */
export function ResponsiveGrid({
  children,
  minWidth = 300,
}: {
  children: ReactNode;
  minWidth?: number;
}) {
  const [width, setWidth] = useState(0);
  const gap = 12;
  const columns = Math.max(1, Math.floor((width + gap) / (minWidth + gap)));
  const cardWidth = width ? (width - gap * (columns - 1)) / columns : '100%';
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        gap,
      }}
    >
      {Children.toArray(children).map((child) => (
        <View
          key={
            typeof child === 'object' && 'key' in child
              ? child.key
              : String(child)
          }
          style={{ width: cardWidth }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}
