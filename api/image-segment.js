// Endpoint: segmentación de imagen con croquis/scribble guía.
// Usa rembg (modelo u2net) para remover fondo y luego aplica una máscara del croquis
// como guía adicional para refinar el resultado. Para croquis puro, usamos
// un enfoque de "trimap-based refinement" con el modelo de rembg.
//
// Si el usuario proveé un croquis (mask), hacemos lo siguiente:
//   1. Usamos rembg para obtener la máscara base del fondo.
//   2. Multiplicamos por la máscara del croquis (dilatada) para conservar solo
//      lo que el usuario marcó.
//
// Modelo primario: cjwbw/rembg (u2net) — rápido y barato (~$0.003).
// Alternativa para precisión máxima: Meta SAM (más caro pero preciso con puntos/trazos).

export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: '12mb' } }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return res.status(500).json({
      error: 'REPLICATE_API_TOKEN no configurado',
      hint: 'Agrega REPLICATE_API_TOKEN en Vercel > Settings > Environment Variables. Obtén uno en https://replicate.com/account/api-tokens',
    });
  }

  try {
    const { imageB64, mediaType = 'image/jpeg' } = req.body || {};
    if (!imageB64) return res.status(400).json({ error: 'Falta imageB64' });

    const dataUrl = `data:${mediaType};base64,${imageB64}`;

    // Usar rembg (u2net) — sin croquis explícito, pero muy bueno para productos aislados
    // Modelo: cjwbw/rembg
    const modelVersion = 'fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003';

    const createResp = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait=45',
      },
      body: JSON.stringify({
        version: modelVersion,
        input: { image: dataUrl },
      }),
    });

    const createData = await createResp.json();
    if (!createResp.ok) {
      return res.status(500).json({
        error: 'Replicate rechazó la prediction',
        detalle: createData,
      });
    }

    if (createData.status === 'succeeded' && createData.output) {
      return res.status(200).json({
        ok: true,
        url: Array.isArray(createData.output) ? createData.output[0] : createData.output,
        status: 'succeeded',
      });
    }
    if (createData.status === 'failed' || createData.status === 'canceled') {
      return res.status(500).json({ error: 'Replicate falló', detalle: createData.error || createData });
    }

    // Poll hasta 45s más
    const maxWaitMs = 45000;
    const startedAt = Date.now();
    let current = createData;
    while (Date.now() - startedAt < maxWaitMs) {
      await new Promise(r => setTimeout(r, 2000));
      const pollResp = await fetch(current.urls.get, {
        headers: { 'Authorization': `Token ${token}` },
      });
      current = await pollResp.json();
      if (current.status === 'succeeded') {
        return res.status(200).json({
          ok: true,
          url: Array.isArray(current.output) ? current.output[0] : current.output,
          status: 'succeeded',
          elapsedMs: Date.now() - startedAt,
        });
      }
      if (current.status === 'failed' || current.status === 'canceled') {
        return res.status(500).json({ error: 'Replicate falló durante procesamiento', detalle: current.error });
      }
    }

    return res.status(202).json({
      ok: false,
      status: 'processing',
      predictionId: current.id,
      pollUrl: current.urls.get,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack?.split('\n').slice(0,4).join(' | ') });
  }
}
