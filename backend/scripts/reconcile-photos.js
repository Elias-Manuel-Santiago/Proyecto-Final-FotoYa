import { db } from '../src/config/database.js';
import { reconcilePhotoUploads } from '../src/modules/photos/photos.reconciliation.js';

try { console.log(await reconcilePhotoUploads()); }
catch (error) { console.error({ code: error.code ?? 'RECONCILIATION_ERROR', message: 'No se pudieron reconciliar las cargas pendientes.' }); process.exitCode = 1; }
finally { await db.end(); }
