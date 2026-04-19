// Endpoint: reescalado de imagen con Real-ESRGAN via Replicate.
// Toma base64 de entrada, sube como data URL, corre modelo, devuelve URL resultado.
export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: '8mb' } }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return res.status(500).json({
      error: 'REPLICATE_API_TOKEN no configurado',
      hint: 'Ve a Vercel > Settings > Environment Variables y agrega REPLICATE_API_TOKEN con tu token de https://replicate.com/account/api-tokens',
    });
  }

  try {
    const { imageB64, mediaType = 'image/jpeg', scale = 2 } = req.body || {};
    if (!imageB64) return res.status(400).json({ error: 'Falta imageB64' });

    const dataUrl = `data:${mediaType};base64,${imageB64}`;

    // Modelo: Real-ESRGAN x2/x4 por nightmareai.
    // Version fija para estabilidad. Entrada acepta data URL directamente.
    const modelVersion = '42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b';

    // Crear prediction
    const createResp = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait=30', // espera hasta 30s, si no termina devuelve status
      },
      body: JSON.stringify({
        version: modelVersion,
        input: {
          image: dataUrl,
          scale: Math.max(2, Math.min(4, parseInt(scale) || 2)),
          face_enhance: false,
        },
      }),
    });

    const createData = await createResp.json();
    if (!createResp.ok) {
      return res.status(500).json({
        error: 'Replicate rechazó la prediction',
        detalle: createData,
      });
    }

    // Si ya terminó en los 30s de wait, devolver directo
    if (createData.status === 'succeeded' && createData.output) {
      return res.status(200).json({
        ok: true,
        url: Array.isArray(createData.output) ? createData.output[0] : createData.output,
        status: 'succeeded',
      });
    }
    if (createData.status === 'failed' || createData.status === 'canceled') {
      return res.status(500).json({
        error: 'Replicate falló',
        detalle: createData.error || createData,
      });
    }

    // Poll manual hasta 45s más
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
        return res.status(500).json({
          error: 'Replicate falló durante procesamiento',
          detalle: current.error || current,
        });
      }
    }

    // Timeout — devolver URL de polling para que el cliente reintente
    return res.status(202).json({
      ok: false,
      status: 'processing',
      predictionId: current.id,
      pollUrl: current.urls.get,
      hint: 'La prediction sigue procesando. Usa /api/image-poll para consultar.',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack?.split('\n').slice(0,4).join(' | ') });
  }
}
