import { useWindowDimensions } from 'react-native';
export function useNavigationMode() {
  const { width } = useWindowDimensions();
  return { bottom: width < 900, width };
}
