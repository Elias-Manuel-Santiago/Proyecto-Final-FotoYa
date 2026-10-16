import axios from 'axios';
import { ApiError } from '../shared/errors.js';

export function createStorage(env, transport) {
  const origin = env.SUPABASE_URL.replace(/\/$/, '');
  const client = axios.create({
    baseURL: `${origin}/storage/v1`, timeout: env.STORAGE_TIMEOUT_MS, maxRedirects: 0,
    headers: { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}` },
    ...(transport ? { adapter: transport } : {}),
  });
  const path = file => {
    if (typeof file !== 'string' || /[\\\x00-\x1f]/.test(file) || file.split('/').some(part => ['', '.', '..'].includes(part)))
      throw new Error('Invalid storage path');
    return `${encodeURIComponent(env.SUPABASE_STORAGE_BUCKET)}/${file.split('/').map(encodeURIComponent).join('/')}`;
  };
  return {
    async upload(file, bytes, mime) {
      try {
        await client.post(`/object/${path(file)}`, bytes, { headers: { 'Content-Type': mime, 'x-upsert': 'false', 'Cache-Control': 'max-age=0' },
          maxBodyLength: 6 * 1024 * 1024, maxContentLength: 64 * 1024 });
      } catch { throw new ApiError(502, 'No se pudo guardar la foto.', 'STORAGE_ERROR'); }
    },
    async remove(file) {
      try {
        path(file);
        await client.delete(`/object/${encodeURIComponent(env.SUPABASE_STORAGE_BUCKET)}`, { data: { prefixes: [file] } });
      } catch (error){ 
        throw new ApiError(502, error, 'STORAGE_ERROR'); 
      }
    },
    async signedUrl(file) {
      try {
        const { data } = await client.post(`/object/sign/${path(file)}`, { expiresIn: env.PHOTO_URL_SECONDS });
        if (typeof data.signedURL !== 'string' || !data.signedURL.startsWith('/object/sign/')) throw new Error('Invalid storage response');
        return { url: `${origin}/storage/v1${data.signedURL}`, expiresIn: env.PHOTO_URL_SECONDS };
      } catch { throw new ApiError(502, 'No se pudo obtener acceso a la foto.', 'STORAGE_ERROR'); }
    },
  };
}
