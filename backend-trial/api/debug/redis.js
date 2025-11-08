/**
 * API Endpoint: /api/debug/redis
 * Affiche toutes les licences stockées dans Redis pour debug
 */

import { createClient } from 'redis';

let redis = null;

async function getRedisClient() {
    if (!redis) {
        redis = createClient({
            url: process.env.KV_URL || process.env.REDIS_URL
        });
        await redis.connect();
    }
    return redis;
}

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({
            error: 'Method not allowed',
            message: 'Utilisez GET pour cet endpoint'
        });
    }

    try {
        const client = await getRedisClient();

        // Récupérer toutes les clés de licence
        const keys = await client.keys('license:*');

        const licenses = [];
        for (const key of keys) {
            const data = await client.get(key);
            if (data) {
                const licenseData = JSON.parse(data);
                licenses.push({
                    hwid: key.replace('license:', '').substring(0, 20) + '...',
                    licenseKey: licenseData.licenseKey?.substring(0, 15) + '...',
                    email: licenseData.email,
                    instanceId: licenseData.instanceId || '❌ MANQUANT',
                    activatedAt: licenseData.activatedAt ? new Date(licenseData.activatedAt).toISOString() : 'N/A'
                });
            }
        }

        return res.status(200).json({
            total: licenses.length,
            licenses: licenses
        });

    } catch (error) {
        console.error('Erreur /api/debug/redis:', error);

        return res.status(500).json({
            error: 'Erreur serveur',
            message: error.message
        });
    }
}
