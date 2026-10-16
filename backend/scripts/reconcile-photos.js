import { loadEnv } from '../src/config/env.js';
import { createDatabase } from '../src/config/database.js';
import { createStorage } from '../src/integrations/storage.js';
import { reconcilePhotoUploads } from '../src/modules/photos/photos.reconciliation.js';

const env = loadEnv(), db = createDatabase(env);
try { console.log(await reconcilePhotoUploads(db, createStorage(env), env.SUPABASE_STORAGE_BUCKET)); }
catch (error) { console.error({ code: error.code ?? 'RECONCILIATION_ERROR', message: 'No se pudieron reconciliar las cargas pendientes.' }); process.exitCode = 1; }
finally { await db.end(); }
