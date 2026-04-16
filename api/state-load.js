export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const url  = process.env.KV_REST_API_URL  || process.env.UPSTASH_REDIS_REST_URL;
    const token= process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return res.status(200).json({ state: null });

    const r = await fetch(`${url}/get/yanbal:${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await r.json();
    if (!data.result) return res.status(200).json({ state: null });

    const state = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
    return res.status(200).json({ state });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
