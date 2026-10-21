import {
  lazy,
  Suspense,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

const Provider = lazy(() => import('./social-auth0'));
const subscribe = () => () => {};
export function SocialProvider({ children }: PropsWithChildren) {
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const domain = process.env.EXPO_PUBLIC_AUTH0_DOMAIN?.trim();
  const clientId =
    Platform.OS === 'web'
      ? process.env.EXPO_PUBLIC_AUTH0_WEB_CLIENT_ID?.trim()
      : process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID?.trim();
  if (
    !ready ||
    !domain ||
    !clientId ||
    (Platform.OS !== 'web' &&
      Constants.executionEnvironment === ExecutionEnvironment.StoreClient)
  )
    return children;
  return (
    <Suspense fallback={null}>
      <Provider domain={domain} clientId={clientId}>
        {children}
      </Provider>
    </Suspense>
  );
}
