// Endpoint: pule la composición de un flyer ya generado usando un modelo Gemini de imagen.
// v15: Prueba varios nombres de modelo en orden porque Google renombra con frecuencia.
// Primero intenta los modelos actuales (2026), y cae al preview viejo si los nuevos no existen en tu región.

export const config = {
  maxDuration: 90,
  api: { bodyParser: { sizeLimit: '15mb' } }
};

// Lista ordenada de modelos a probar. El primero que funcione se usa.
// IMPORTANTE (v15.1): Probamos PRIMERO los modelos con tier gratuito (500 req/día),
// luego los modelos de pago. Esto evita el error 429 "quota exceeded limit: 0"
// que aparece cuando se intenta usar Nano Banana Pro (3.1) en free tier.
// Referencia: https://ai.google.dev/gemini-api/docs/rate-limits (abril 2026)
const MODELOS_A_PROBAR = [
  'gemini-2.5-flash-image',              // ✅ Free tier: 500 req/día. Nano Banana clásico.
  'gemini-2.0-flash-exp-image-generation', // Experimental, puede tener tier gratuito
  'gemini-3.1-flash-image-preview',      // ❌ Solo tier pago. Nano Banana 2.
  'gemini-3-pro-image-preview',          // ❌ Solo tier pago. Nano Banana Pro.
];

const PROMPT_DEFAULT = `Eres un retocador profesional de catálogos de lujo Yanbal Colombia.
Recibes un flyer que ya tiene TODOS los elementos correctamente posicionados:
productos, textos (NIVEL X, precios, banda de descuento), sección GRATIS.

Tu tarea es SOLO refinar la calidad visual manteniendo EXACTAMENTE las mismas posiciones:
1. Unificar la iluminación (softbox lateral, sombras suaves bajo cada producto)
2. Agregar reflejos sutiles sobre la superficie
3. Hacer que los acabados dorados/metálicos luzcan más premium
4. Limpiar bordes rugosos de recortes de productos

NO MUEVAS productos. NO CAMBIES textos. NO AGREGUES elementos nuevos.
Solo pule la imagen para que se vea como un catálogo premium profesional.
Conserva la composición exacta que recibes.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageB64, mediaType = 'image/png', prompt, model } = req.body || {};
    if (!imageB64) return res.status(400).json({ error: 'Falta imageB64' });

    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'GOOGLE_AI_API_KEY no configurada',
        hint: 'Agrega GOOGLE_AI_API_KEY en Vercel. Obtén una gratis en https://aistudio.google.com/apikey',
      });
    }

    // Si el cliente especifica un modelo, probarlo primero
    const modelos = model ? [model, ...MODELOS_A_PROBAR.filter(m => m !== model)] : MODELOS_A_PROBAR;

    const intentos = [];
    let ultimoError = null;

    for (const modelo of modelos) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;

      const body = {
        contents: [{
          role: 'user',
          parts: [
            { text: prompt || PROMPT_DEFAULT },
            { inline_data: { mime_type: mediaType, data: imageB64 } },
          ],
        }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'], // 2026 requiere TEXT+IMAGE
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
        intentos.push({ modelo, status: resp.status, error: errText.slice(0, 200) });
        ultimoError = { httpStatus: resp.status, detalle: errText.slice(0, 500) };
        // 404 = modelo no existe, 403 = no autorizado, 429 con "limit: 0" = modelo sin tier gratuito.
        // En todos estos casos probar siguiente modelo.
        if (resp.status === 404 || resp.status === 403) continue;
        if (resp.status === 429 && errText.includes('limit: 0')) continue;
        // Otros 429 (rate limit temporal) y otros errores son reales — retornar
        return res.status(500).json({
          error: 'Gemini rechazó la petición',
          modeloIntentado: modelo,
          httpStatus: resp.status,
          detalle: errText.slice(0, 500),
          intentos,
        });
      }

      const data = await resp.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const imgPart = parts.find(p => p.inline_data || p.inlineData);
      const inline = imgPart?.inline_data || imgPart?.inlineData;

      if (!inline?.data) {
        intentos.push({ modelo, problema: 'no devolvió imagen, solo texto' });
        ultimoError = {
          mensaje: 'Modelo respondió pero sin imagen',
          textoRespuesta: parts.find(p => p.text)?.text?.slice(0,300) || null,
        };
        continue; // probar siguiente modelo
      }

      // ¡Éxito!
      return res.status(200).json({
        ok: true,
        imageB64: inline.data,
        mimeType: inline.mime_type || inline.mimeType || 'image/png',
        modeloUsado: modelo,
        intentosPrevios: intentos.length,
      });
    }

    // Ningún modelo funcionó
    return res.status(500).json({
      error: 'Ningún modelo Gemini de imagen está disponible',
      hint: 'Puede que tu API key no tenga acceso a modelos de imagen. Verifica en https://aistudio.google.com/apikey que tu cuenta esté habilitada. Los modelos de imagen no siempre están disponibles en todas las regiones.',
      intentos,
      ultimoError,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack?.split('\n').slice(0,4).join(' | ') });
  }
}
