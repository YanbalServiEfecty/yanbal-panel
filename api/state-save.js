export const config = {
  maxDuration: 10,
  api: { bodyParser: { sizeLimit: '10mb' } }
};

// Límite seguro por debajo del máximo de Upstash (10MB en pago, 1MB en free).
// Usamos 900KB como umbral "saludable" para dejar margen amplio.
const MAX_STATE_BYTES = 900 * 1024; // 900 KB
const WARN_STATE_BYTES = 500 * 1024; // 500 KB

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userId, state } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    if (!state)  return res.status(400).json({ error: 'Missing state' });

    const url  = process.env.KV_REST_API_URL  || process.env.UPSTASH_REDIS_REST_URL;
    const token= process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      return res.status(500).json({
        error: 'Redis no configurado',
        hint: 'Faltan variables KV_REST_API_URL y KV_REST_API_TOKEN en Vercel',
      });
    }

    const stateStr = JSON.stringify(state);
    const sizeBytes = new TextEncoder().encode(stateStr).length;

    // VALIDACIÓN CRÍTICA (nueva en v13): si supera el límite, rechazar con mensaje claro.
    // En v12 se mandaba ciegamente y Upstash devolvía error que el frontend ignoraba.
    if (sizeBytes > MAX_STATE_BYTES) {
      return res.status(413).json({
        error: 'Estado demasiado grande para Upstash',
        sizeBytes,
        sizeMB: (sizeBytes / 1024 / 1024).toFixed(2),
        limitKB: (MAX_STATE_BYTES / 1024).toFixed(0),
        hint: 'El catalogo probablemente tiene imagenes en base64 en vez de URLs del Blob. Revisa que el Blob este publico y las imagenes se suban correctamente.',
      });
    }

    const r = await fetch(`${url}/set/yanbal:${userId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: stateStr, ex: 7776000 })
    });

    if (!r.ok) {
      const errText = await r.text();
      return res.status(500).json({
        error: 'Upstash rechazo el guardado',
        upstashStatus: r.status,
        upstashMessage: errText.slice(0, 500),
      });
    }

    return res.status(200).json({
      ok: true,
      sizeBytes,
      sizeKB: (sizeBytes / 1024).toFixed(1),
      warning: sizeBytes > WARN_STATE_BYTES ? `Estado grande (${(sizeBytes/1024).toFixed(0)} KB de ${(MAX_STATE_BYTES/1024).toFixed(0)} KB limite).` : null,
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Error desconocido',
      stack: err.stack ? err.stack.split('\n').slice(0,3).join(' | ') : null,
    });
  }
}
