import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";
import { ApiError } from "../shared/errors.js";

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
