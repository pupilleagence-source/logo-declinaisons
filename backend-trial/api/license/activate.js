/**
 * API Endpoint: /api/license/activate
 * Active une licence Lemon Squeezy sur un poste (HWID), sans jamais créer
 * d'instance en double : voir lib/license-flow.js.
 *
 * POST Body: { licenseKey: string, email: string, hwid: string, previousHwid?: string }
 * Response: { success: boolean, licenseType: string, message: string, reused: boolean }
 */

import { getRedisClient, preamble } from '../../lib/redis.js';
import { createLemonClient } from '../../lib/lemonsqueezy.js';
import { activateLicense } from '../../lib/license-flow.js';

export default async function handler(req, res) {
    if (preamble(req, res, ['POST'])) return;
    try {
        const store = await getRedisClient();
        const result = await activateLicense(req.body, { ls: createLemonClient(), store });
        return res.status(result.status).json(result.body);
    } catch (error) {
        console.error('Erreur /api/license/activate:', error);
        return res.status(500).json({ success: false, message: 'Erreur serveur lors de l\'activation' });
    }
}
