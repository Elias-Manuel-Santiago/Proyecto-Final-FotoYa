/**
 * @file
 * Define el contrato social y un contexto predeterminado deshabilitado. Permite consumir su
 * estado sin importar el SDK en pantallas.
 */
import { createContext, useContext } from 'react';

export interface SocialAuth {
  enabled: boolean;
  loading: boolean;
  error?: string;
  pendingToken?: string;
  consume: () => void;
  signIn: (connection: string) => Promise<string>;
}
export const SocialContext = createContext<SocialAuth>({
  enabled: false,
  loading: false,
  consume: () => {},
  signIn: async () => {
    throw new Error(
      'El acceso con servicios externos no está disponible por el momento.',
    );
  },
});
// Consume el contrato social compartido sin importar directamente el SDK.
export const useSocial = () => useContext(SocialContext);
