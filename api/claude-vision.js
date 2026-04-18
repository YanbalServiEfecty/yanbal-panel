// Endpoint para verificación visual de productos con Claude Opus 4.7
// Recibe: { apiKey, model, imageB64, mediaType, prompt, max_tokens }
// Devuelve la respuesta cruda de la API de Anthropic
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
    const { apiKey, model, imageB64, imageUrl, mediaType, prompt, max_tokens } = req.body;

    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      return res.status(400).json({ error: { message: 'No API key provided' } });
    }

    // Construir el content block: imagen + texto
    // Anthropic admite source.type = "base64" o "url"
    const content = [];
    if (imageB64) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType || 'image/jpeg',
          data: imageB64,
        },
      });
    } else if (imageUrl) {
      content.push({
        type: 'image',
        source: { type: 'url', url: imageUrl },
      });
    }
    content.push({ type: 'text', text: prompt });

    const body = {
      model: model || 'claude-opus-4-7',
      max_tokens: max_tokens || 1024,
      messages: [{ role: 'user', content }],
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
}
