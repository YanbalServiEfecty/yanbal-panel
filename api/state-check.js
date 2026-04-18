// Endpoint de diagnóstico: verifica que el estado en Upstash existe y mide su tamaño.
// Se usa desde el Admin para chequear salud del guardado.
export const config = { maxDuration: 10 };

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const url  = process.env.KV_REST_API_URL  || process.env.UPSTASH_REDIS_REST_URL;
    const token= process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      return res.status(500).json({ error: 'Redis no configurado' });
    }

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
    // Desenvolver doble-wrap {value: ...}
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
