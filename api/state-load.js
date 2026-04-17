export const config = {
  maxDuration: 10,
};

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

    // Upstash returns the raw stored string in data.result
    // Our state-save stored JSON.stringify(state), so parse it directly
    let state;
    if (typeof data.result === 'string') {
      state = JSON.parse(data.result);
    } else {
      state = data.result;
    }
    // Handle case where state was double-wrapped with {value: ...}
    if (state && state.value !== undefined) {
      state = typeof state.value === 'string' ? JSON.parse(state.value) : state.value;
    }

    return res.status(200).json({ state });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
