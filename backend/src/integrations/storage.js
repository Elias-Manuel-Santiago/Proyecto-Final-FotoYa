import { env } from "node:process";

// Create Supabase client
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY);

const bucket = env.SUPABASE_STORAGE_BUCKET;
// Upload file using standard upload
export async function uploadFile(path, bytes, mime) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, bytes, {
      contentType: mime,
      upsert: false,
    });

  if (error) throw error;
  return data;
}

export async function removeFile(path) {
  const { data, error } = await supabase.storage.from(bucket).remove([path])

  if (error) throw error;
  return data;
}


export async function uploadFile(path, bytes, mime) {
  const { data, error } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .upload(path, bytes, {
      contentType: mime,
      upsert: false,
    });

  if (error) throw error;
  return data;
}
