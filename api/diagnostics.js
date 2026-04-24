// Endpoint consolidado de diagnósticos. Reemplaza a state-check y blob-diagnostico.
// Uso:
//   GET  /api/diagnostics?type=state&userId=xxx  → verifica estado guardado en Upstash
//   POST /api/diagnostics?type=blob              → sube imagen de prueba al Blob y verifica
import { put } from '@vercel/blob';

export const config = {
  maxDuration: 15,
  api: { bodyParser: { sizeLimit: '2mb' } }
};

// Imagen PNG 1x1 roja para prueba del Blob
const TEST_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

export default async function handler(req, res) {
  const type = req.query?.type || req.body?.type;

  if (type === 'state') return handleState(req, res);
  if (type === 'blob')  return handleBlob(req, res);

  return res.status(400).json({ error: 'Falta parametro type. Usa ?type=state o ?type=blob' });
}

// ─── Diagnóstico del estado en Upstash ───
async function handleState(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Usa GET para type=state' });
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const url  = process.env.KV_REST_API_URL  || process.env.UPSTASH_REDIS_REST_URL;
    const token= process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return res.status(500).json({ error: 'Redis no configurado' });

    const r = await fetch(`${url}/get/yanbal:${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await r.json();

    if (!data.result) {
      return res.status(200).json({
        exists: false,
        message: 'No hay estado guardado para este usuario en Upstash',
      });
    }

    let stateRaw = data.result;
    if (typeof stateRaw === 'string') {
      try { stateRaw = JSON.parse(stateRaw); } catch(e){}
    }
    if (stateRaw && stateRaw.value !== undefined) {
      stateRaw = typeof stateRaw.value === 'string' ? JSON.parse(stateRaw.value) : stateRaw.value;
    }

    const state = stateRaw || {};
    const sizeBytes = new TextEncoder().encode(JSON.stringify(state)).length;

    return res.status(200).json({
      exists: true,
      sizeBytes,
      sizeKB: (sizeBytes / 1024).toFixed(1),
      lastSaved: state.lastSaved || null,
      lastSavedDate: state.lastSaved ? new Date(state.lastSaved).toISOString() : null,
      counts: {
        productos: (state.productos || []).length,
        clientas: (state.clientas || []).length,
        paquetes: (state.paquetes || []).length,
        cobros: (state.cobros || []).length,
        rifas: (state.rifas || []).length,
        paginasUrls: Object.keys(state.paginasUrls || {}).length,
        productosMaestros: Object.keys(state.productosMaestros || {}).length,
      },
      ciclo: state.ciclo ? { nombre: state.ciclo.nombre, fecha: state.ciclo.fecha } : null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ─── Diagnóstico del Vercel Blob ───
async function handleBlob(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Usa POST para type=blob' });

  const diagnostico = {
    paso: 'inicio',
    hasToken: !!process.env.BLOB_READ_WRITE_TOKEN,
    tokenPreview: process.env.BLOB_READ_WRITE_TOKEN
      ? process.env.BLOB_READ_WRITE_TOKEN.slice(0, 20) + '...'
      : null,
    nodeVersion: process.version,
  };

  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({
        ok: false,
        diagnostico,
        error: 'BLOB_READ_WRITE_TOKEN no configurado',
        hint: 'Ve a Vercel > Storage > tu Blob Store > Connect Project, o revisa Settings > Environment Variables.',
      });
    }

    diagnostico.paso = 'subiendo_imagen_prueba';
    const buffer = Buffer.from(TEST_PNG_B64, 'base64');
    const hash = Math.random().toString(36).slice(2, 10);
    const filename = `yanbal/_diagnostico/test_${Date.now()}_${hash}.png`;

    let blob;
    try {
      blob = await put(filename, buffer, {
        access: 'public',
        contentType: 'image/png',
        addRandomSuffix: false,
      });
    } catch (err) {
      const msg = err?.message || '';
      if (msg.includes('private store') || msg.includes('Cannot use public access')) {
        return res.status(500).json({
          ok: false,
          diagnostico,
          error: 'Tu Vercel Blob Store esta configurado como PRIVADO',
          solucion: 'Las imagenes privadas NO pueden mostrarse en la app. Crea un Blob Store publico nuevo en Vercel > Storage > Create, borra el privado, y haz Redeploy del proyecto.',
          errorOriginal: msg,
        });
      }
      throw err;
    }

    diagnostico.paso = 'verificando_url';
    diagnostico.urlSubida = blob.url;

    let verificacion = { accesible: false };
    try {
      const headResp = await fetch(blob.url, { method: 'HEAD' });
      verificacion = {
        accesible: headResp.ok,
        status: headResp.status,
        contentType: headResp.headers.get('content-type'),
        contentLength: headResp.headers.get('content-length'),
      };
    } catch (e) {
      verificacion = { accesible: false, error: e.message };
    }

    diagnostico.paso = 'completado';

    return res.status(200).json({
      ok: verificacion.accesible,
      diagnostico,
      blobUrl: blob.url,
      verificacion,
      mensaje: verificacion.accesible
        ? 'Blob funcionando correctamente. Puedes procesar catalogos con seguridad.'
        : 'El Blob subio la imagen pero NO es accesible publicamente. Verifica que el store sea publico.',
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      diagnostico,
      error: err.message || String(err),
      stack: err.stack ? err.stack.split('\n').slice(0,4).join(' | ') : null,
    });
  }
}
