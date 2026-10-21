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
export const useSocial = () => useContext(SocialContext);
