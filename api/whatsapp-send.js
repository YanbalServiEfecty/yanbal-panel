// Envía un mensaje de WhatsApp usando la Cloud API de Meta
// IMPORTANTE: para mensajes iniciados por el negocio (recordatorios, marketing) fuera de la ventana
// de 24 horas, Meta requiere que uses una PLANTILLA pre-aprobada. Los mensajes de texto libre solo
// funcionan DENTRO de una conversación activa (la clienta te escribió en las últimas 24h).
//
// Este endpoint admite tres modos:
//  - mode: 'text' (default) → mensaje de texto libre. Solo funciona si la clienta escribió hace <24h.
//  - mode: 'template' → plantilla pre-aprobada, se envía fuera de ventana. Requiere templateName y languageCode.
//  - mode: 'image' → imagen con caption (ej. el flyer). Puede requerir plantilla si está fuera de ventana.
//
// POST body:
//   { accessToken, phoneNumberId, to, text, mode?, templateName?, languageCode?, imageUrl?, caption? }

export const config = {
  maxDuration: 30,
  api: { bodyParser: { sizeLimit: '6mb' } }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { accessToken, phoneNumberId, to, text, mode, templateName, languageCode, imageUrl, caption, templateComponents } = req.body;
    if (!accessToken || !phoneNumberId || !to) {
      return res.status(400).json({ error: { message: 'accessToken, phoneNumberId y to son requeridos' } });
    }

    let payload;
    const modo = mode || (templateName ? 'template' : (imageUrl ? 'image' : 'text'));

    if (modo === 'template') {
      payload = {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode || 'es_CO' },
          ...(templateComponents ? { components: templateComponents } : {}),
        },
      };
    } else if (modo === 'image') {
      payload = {
        messaging_product: 'whatsapp',
        to,
        type: 'image',
        image: {
          link: imageUrl,
          ...(caption ? { caption } : {}),
        },
      };
    } else {
      if (!text) return res.status(400).json({ error: { message: 'text es requerido en modo "text"' } });
      payload = {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text, preview_url: false },
      };
    }

    const r = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
}
