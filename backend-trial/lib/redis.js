/**
 * Client Redis partagé par les endpoints de licence et le webhook.
 * (Les endpoints trial/* gardent leur propre copie : inchangés.)
 */
import { createClient } from 'redis';

let redis = null;

export async function getRedisClient() {
    if (!redis) {
        redis = createClient({
            url: process.env.KV_URL || process.env.REDIS_URL
        });
        await redis.connect();
    }
    return redis;
}

// Préambule CORS commun. Renvoie true si la requête est déjà traitée (OPTIONS / 405).
export function preamble(req, res, methods) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', methods.join(', ') + ', OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.status(200).end(); return true; }
    if (!methods.includes(req.method)) {
        res.status(405).json({ success: false, error: 'Method not allowed', message: 'Utilisez ' + methods.join('/') + ' pour cet endpoint' });
        return true;
    }
    return false;
}
