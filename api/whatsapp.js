// Endpoint consolidado de WhatsApp. Reemplaza a whatsapp-send y whatsapp-test.
// Uso:
//   POST /api/whatsapp?action=test  → valida credenciales (Phone Number ID + Access Token)
//   POST /api/whatsapp?action=send  → envía mensaje (texto, plantilla o imagen)
//
// Si no se pasa action, se asume 'send' (compatibilidad).

export const config = {
  maxDuration: 30,
  api: { bodyParser: { sizeLimit: '6mb' } }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const action = req.query?.action || req.body?.action || 'send';

  if (action === 'test') return handleTest(req, res);
  return handleSend(req, res);
}

// ─── Prueba de credenciales ───
async function handleTest(req, res) {
  try {
    const { phoneNumberId, accessToken } = req.body;
    if (!phoneNumberId || !accessToken) {
      return res.status(400).json({ error: { message: 'phoneNumberId y accessToken son requeridos' } });
    }
    const r = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,status`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ ok: false, error: data.error || { message: 'Credenciales inválidas' } });
    }
    return res.status(200).json({
      ok: true,
      display_name: data.verified_name || data.display_phone_number,
      display_phone_number: data.display_phone_number,
      quality_rating: data.quality_rating,
      status: data.status,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: { message: err.message } });
  }
}

// ─── Envío de mensaje ───
async function handleSend(req, res) {
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
