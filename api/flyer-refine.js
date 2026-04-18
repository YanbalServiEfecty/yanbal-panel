// Endpoint: pule la composición de un flyer ya generado usando Gemini 2.5 Flash Image.
// Recibe el PNG del flyer (editable por el usuario, drag&drop) y devuelve una versión
// con sombras, iluminación y coherencia mejoradas. El layout, textos y productos se
// mantienen — solo se ajustan detalles visuales.

export const config = {
  maxDuration: 90,
  api: { bodyParser: { sizeLimit: '15mb' } }
};

const GEMINI_MODEL = 'gemini-2.5-flash-image-preview';

const PROMPT_DEFAULT = `Eres un retocador profesional de catálogos de lujo Yanbal Colombia.
Recibes un flyer que ya tiene TODOS los elementos correctamente posicionados:
productos, textos (NIVEL X, precios, banda de descuento), sección GRATIS.

Tu tarea es SOLO refinar la calidad visual manteniendo EXACTAMENTE las mismas posiciones:
1. Unificar la iluminación (softbox lateral, sombras suaves bajo cada producto)
2. Agregar reflejos sutiles sobre la superficie (como mármol pulido)
3. Hacer que los acabados dorados/metálicos luzcan más premium
4. Limpiar bordes rugosos de recortes de productos
5. Asegurar que el fondo sea mármol blanco con textura suave

NO MUEVAS productos. NO CAMBIES textos. NO AGREGUES elementos nuevos.
Solo pule la imagen para que se vea como un catálogo premium profesional.
Conserva la composición exacta que recibes.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageB64, mediaType = 'image/png', prompt } = req.body || {};
    if (!imageB64) return res.status(400).json({ error: 'Falta imageB64' });

    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'GOOGLE_AI_API_KEY no configurada',
        hint: 'Agrega GOOGLE_AI_API_KEY en Vercel. Obtén una gratis en https://aistudio.google.com/apikey',
      });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const body = {
      contents: [{
        role: 'user',
        parts: [
          { text: prompt || PROMPT_DEFAULT },
          { inline_data: { mime_type: mediaType, data: imageB64 } },
        ],
      }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        temperature: 0.3,
      },
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(500).json({
        error: 'Gemini rechazó la petición',
        httpStatus: resp.status,
        detalle: errText.slice(0, 500),
      });
    }

    const data = await resp.json();
    // Buscar inline_data en la respuesta
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imgPart = parts.find(p => p.inline_data || p.inlineData);
    const inline = imgPart?.inline_data || imgPart?.inlineData;

    if (!inline?.data) {
      return res.status(500).json({
        error: 'Gemini no devolvió imagen',
        detalleTexto: parts.find(p => p.text)?.text?.slice(0,300) || null,
        detalle: data,
      });
    }

    return res.status(200).json({
      ok: true,
      imageB64: inline.data,
      mimeType: inline.mime_type || inline.mimeType || 'image/png',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack?.split('\n').slice(0,4).join(' | ') });
  }
}
