export const config = {
  maxDuration: 10,
  api: { bodyParser: { sizeLimit: '10mb' } }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { userId, state } = req.body;
    if (!userId || !state) return res.status(400).json({ error: 'Missing userId or state' });

    const url  = process.env.KV_REST_API_URL  || process.env.UPSTASH_REDIS_REST_URL;
    const token= process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return res.status(500).json({ error: 'Redis not configured' });

    // SET key value EX 7776000 (90 days)
    const r = await fetch(`${url}/set/yanbal:${userId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(state), ex: 7776000 })
    });
    if (!r.ok) throw new Error(await r.text());
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
