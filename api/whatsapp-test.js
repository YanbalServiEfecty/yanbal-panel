// Prueba la conexión a WhatsApp Cloud API verificando que el Phone Number ID + Access Token sean válidos
// GET /v{version}/{phoneNumberId} → devuelve display_phone_number, verified_name, quality_rating
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
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
