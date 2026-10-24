import { useEffect, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
export function useNavigationMode() {
  const { width } = useWindowDimensions();
  const [touch, setTouch] = useState(Platform.OS !== 'web');
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const query = window.matchMedia('(any-pointer: coarse)');
    const update = () => setTouch(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return { bottom: touch || width < 900, width };
}
