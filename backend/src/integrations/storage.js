/**
 * @file
 * Accede al bucket privado con credenciales de servidor. Sube originales y genera
 * previsualizaciones WebP con URL temporal tras la autorización del servicio.
 */
import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";
import { ApiError } from "../shared/errors.js";
import sharp from "sharp";
import { createHash } from "node:crypto";

// La clave secreta queda en el backend; los servicios comprueban permisos y alcance.
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    fetch: (url, options) =>
      fetch(url, {
        ...options,
        redirect: "error",
        signal: AbortSignal.timeout(env.STORAGE_TIMEOUT_MS),
      }),
  },
});
const bucket = supabase.storage.from(env.SUPABASE_STORAGE_BUCKET);
const pendingPreviews = new Map();

// Comparte la generación concurrente de la miniatura privada y firma su acceso temporal.
export async function signedPreviewUrl(path) {
  validatePath(path);
  const previewPath = `previews/v1/${createHash('sha256').update(path).digest('hex')}.webp`;
  let pending = pendingPreviews.get(path);
  if (!pending) {
    pending = (async () => {
      const { data: exists, error: checkError } = await bucket.exists(previewPath);
      if (checkError && ![400, 404].includes(Number(checkError.status ?? checkError.originalError?.status))) throw checkError;
      if (exists) return;
      const { data, error } = await bucket.download(path);
      if (error || !data || data.size > 6 * 1024 * 1024) throw error ?? new Error('Invalid image');
      const bytes = await sharp(Buffer.from(await data.arrayBuffer()), { limitInputPixels: 80000000 })
        .rotate().resize(960, 960, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 60 }).toBuffer();
      // Sólo se sobrescribe la versión derivada, nunca el original privado.
      const { error: uploadError } = await bucket.upload(previewPath, bytes, {
        contentType: 'image/webp', upsert: true, cacheControl: '3600',
      });
      if (uploadError) throw uploadError;
    })();
    // Las solicitudes simultáneas del mismo original esperan una sola generación en este proceso.
    pendingPreviews.set(path, pending);
  }
  try {
    await pending;
    return await signedUrl(previewPath);
  } catch {
    throw new ApiError(502, 'No se pudo generar la vista previa.', 'STORAGE_ERROR');
  } finally {
    if (pendingPreviews.get(path) === pending) pendingPreviews.delete(path);
  }
}

// Rechaza rutas vacías o relativas antes de enviar una operación al bucket.
function validatePath(path) {
  if (
    typeof path !== "string" ||
    !path ||
    path.includes("\\") ||
    path.split("/").some((part) => !part || part === "." || part === "..")
  )
    throw new ApiError(
      502,
      "La ruta de la foto no es válida.",
      "STORAGE_ERROR",
    );
}

// Guarda el original sin sobrescribir objetos y traduce fallos de almacenamiento.
export async function uploadFile(path, bytes, mime) {
  validatePath(path);
  try {
    const { data, error } = await bucket.upload(path, bytes, {
      contentType: mime,
      upsert: false,
      cacheControl: "0",
    });
    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Storage upload failed", {
      name: err?.name,
      message: err?.message,
      status: err?.status,
      statusCode: err?.statusCode,
      code: err?.code,
    });
    throw new ApiError(502, "No se pudo guardar la foto.", "STORAGE_ERROR");
  }
}

// Elimina el archivo nuevo cuando falla una carga.
export async function removeFile(path) {
  validatePath(path);
  try {
    const { data, error } = await bucket.remove([path]);
    if (error) throw error;
    return data;
  } catch {
    throw new ApiError(
      502,
      "No se pudo limpiar la carga de la foto.",
      "STORAGE_ERROR",
    );
  }
}

// Emite una URL con vencimiento después de que el servicio haya autorizado el acceso.
export async function signedUrl(path) {
  validatePath(path);
  try {
    const { data, error } = await bucket.createSignedUrl(
      path,
      env.PHOTO_URL_SECONDS,
    );
    if (error || !data?.signedUrl)
      throw error ?? new Error("Missing signed URL");
    return { url: data.signedUrl, expiresIn: env.PHOTO_URL_SECONDS };
  } catch {
    throw new ApiError(502, "No se pudo acceder a la foto.", "STORAGE_ERROR");
  }
}
