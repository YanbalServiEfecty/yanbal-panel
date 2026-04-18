// API de quitar fondo — proxy a remove.bg si hay REMOVE_BG_API_KEY,
// si no, devuelve error claro para que el frontend use su fallback local.
export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageB64 } = req.body || {};
    if (!imageB64) return res.status(400).json({ error: 'Falta imageB64' });

    const apiKey = process.env.REMOVE_BG_API_KEY;
    if (!apiKey) {
      // Sin API key de remove.bg — el cliente usará el fallback local (canvas chroma key)
      return res.status(501).json({
        error: 'REMOVE_BG_API_KEY no configurada',
        hint: 'Configura REMOVE_BG_API_KEY en Vercel → Environment Variables. Obtén una gratis en https://www.remove.bg/api (50 imágenes/mes). Mientras tanto el editor usa un quitar-fondo simple en el navegador.',
        fallback: 'local',
      });
    }

    // Llamar a remove.bg
    const form = new FormData();
    const buffer = Buffer.from(imageB64, 'base64');
    const blob = new Blob([buffer], { type: 'image/png' });
    form.append('image_file', blob, 'image.png');
    form.append('size', 'auto');
    form.append('format', 'png');

    const r = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey },
      body: form,
    });

    if (!r.ok) {
      const txt = await r.text();
      return res.status(500).json({ error: `remove.bg devolvió ${r.status}: ${txt.slice(0, 200)}` });
    }

    const ab = await r.arrayBuffer();
    const out = Buffer.from(ab).toString('base64');
    return res.status(200).json({ imageB64: out, mediaType: 'image/png' });
  } catch (err) {
    console.error('[remove-bg] ERROR:', err);
    return res.status(500).json({ error: err.message || 'Error desconocido' });
  }
}
