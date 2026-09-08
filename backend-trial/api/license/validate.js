/**
 * API Endpoint: /api/license/validate
 * Valide la licence d'un poste (HWID) auprès de Lemon Squeezy, par instance.
 *
 * POST Body: { hwid: string }
 * Response: { valid: boolean, licenseType?, email?, activatedAt?, offline?, message? }
 */

import { getRedisClient, preamble } from '../../lib/redis.js';
import { createLemonClient } from '../../lib/lemonsqueezy.js';
import { validateLicense } from '../../lib/license-flow.js';

export default async function handler(req, res) {
    if (preamble(req, res, ['POST'])) return;
    try {
        const store = await getRedisClient();
        const result = await validateLicense(req.body, { ls: createLemonClient(), store });
        return res.status(result.status).json(result.body);
    } catch (error) {
        console.error('Erreur /api/license/validate:', error);
        return res.status(500).json({ valid: false, message: 'Erreur serveur lors de la validation' });
    }
}
