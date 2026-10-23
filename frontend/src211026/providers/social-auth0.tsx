/**
 * @file
 * Adapta identidad al contexto social y recupera el retorno web. Entrega un idToken al login
 * para intercambiarlo por una sesión propia.
 */
import { useEffect, useState, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';
import { Auth0Provider, useAuth0 } from 'react-native-auth0';
import { SocialContext } from './social-context';

// Adapta el estado del SDK al contexto social y recupera el token al volver del acceso web.
function Bridge({ children }: PropsWithChildren) {
  const { authorize, getCredentials, user, isLoading, error } = useAuth0();
  const [pendingToken, setPendingToken] = useState<string>();
  const [localError, setLocalError] = useState('');
  useEffect(() => {
    if (
      Platform.OS !== 'web' ||
      isLoading ||
      !user ||
      !sessionStorage.getItem('foto-ya-social')
    )
      return;
    sessionStorage.removeItem('foto-ya-social');
    void getCredentials()
      .then((credentials) => setPendingToken(credentials?.idToken))
      .catch(() =>
        setLocalError(
          'No se pudo recuperar el acceso social. Volvé a intentarlo.',
        ),
      );
  }, [getCredentials, user, isLoading]);
  return (
    <SocialContext.Provider
      value={{
        enabled: true,
        loading: isLoading,
        error: localError || error?.message,
        pendingToken,
        consume: () => setPendingToken(undefined),
        signIn: async (connection) => {
          if (Platform.OS === 'web') {
            sessionStorage.setItem('foto-ya-social', '1');
            try {
              const credentials = await authorize({
                scope: 'openid profile email',
                connection,
                redirectUrl: window.location.origin,
              });
              return credentials.idToken;
            } catch (cause) {
              sessionStorage.removeItem('foto-ya-social');
              throw cause;
            }
          }
          const credentials = await authorize(
            { scope: 'openid profile email', connection },
            { customScheme: 'fotoya' },
          );
          return credentials.idToken;
        },
      }}
    >
      {children}
    </SocialContext.Provider>
  );
}
// Monta el SDK configurado alrededor del puente de identidad.
export default function Provider({
  children,
  domain,
  clientId,
}: PropsWithChildren<{ domain: string; clientId: string }>) {
  return (
    <Auth0Provider domain={domain} clientId={clientId}>
      <Bridge>{children}</Bridge>
    </Auth0Provider>
  );
}
