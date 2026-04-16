export const config = {
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
    const { apiKey, ...body } = req.body;

    const key = apiKey || process.env.ANTHROPIC_API_KEY || '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';
    if (!key) {
      return res.status(400).json({ error: { message: 'No API key provided' } });
    }

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
