// Endpoint keepalive : ping Redis pour empecher l'archivage Upstash
import { createClient } from 'redis';

export default async function handler(req, res) {
    let redis;
    try {
        redis = createClient({
            url: process.env.KV_URL || process.env.REDIS_URL
        });
        await redis.connect();
        await redis.set('_keepalive', new Date().toISOString());
        const val = await redis.get('_keepalive');
        await redis.quit();
        return res.status(200).json({ ok: true, ts: val });
    } catch (e) {
        if (redis) try { await redis.quit(); } catch (_) {}
        return res.status(500).json({ ok: false, error: e.message });
    }
}
