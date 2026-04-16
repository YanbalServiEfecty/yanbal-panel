import { put } from '@vercel/blob';

export const config = {
  api: { bodyParser: { sizeLimit: '5mb' } }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { imageB64, filename, mediaType } = req.body;
    if (!imageB64 || !filename) return res.status(400).json({ error: 'Missing data' });

    // Convert base64 to buffer
    const buffer = Buffer.from(imageB64, 'base64');
    const blob = await put(`yanbal/productos/${filename}`, buffer, {
      access: 'public',
      contentType: mediaType || 'image/jpeg',
    });

    return res.status(200).json({ url: blob.url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
