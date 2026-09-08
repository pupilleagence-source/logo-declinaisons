/**
 * API Endpoint: /api/license/force-deactivate
 * Désactivation « quoi qu'il arrive » : tente de libérer l'instance Lemon Squeezy
 * si elle est connue, puis supprime la licence de Redis dans tous les cas.
 * Utilisé par le panneau quand la désactivation normale échoue.
 *
 * POST Body: { hwid: string }
 * Response: { success: boolean, message: string, deleted: boolean }
 */

import { getRedisClient, preamble } from '../../lib/redis.js';
import { createLemonClient } from '../../lib/lemonsqueezy.js';

export default async function handler(req, res) {
    if (preamble(req, res, ['POST'])) return;
    try {
        const { hwid } = req.body || {};
        if (!hwid) return res.status(400).json({ success: false, message: 'HWID requis' });

        const store = await getRedisClient();
        const raw = await store.get('license:' + hwid);
        if (raw) {
            try {
                const rec = JSON.parse(raw);
                if (rec.licenseKey && rec.instanceId) {
                    const d = await createLemonClient().deactivate(rec.licenseKey, rec.instanceId);
                    if (d.data.deactivated) console.log('✅ Slot Lemon Squeezy libéré');
                    else console.warn('⚠️ Slot non libéré :', d.data.error || d.status);
                } else {
                    console.warn('⚠️ Pas d\'instance connue : suppression locale seulement');
                }
            } catch (e) {
                console.warn('⚠️ Erreur Lemon Squeezy (on supprime quand même) :', e.message);
            }
        }
        const deleted = await store.del('license:' + hwid);
        console.log('✓ FORCE DEACTIVATE ' + (deleted > 0 ? 'licence supprimée' : 'aucune licence'));
        return res.status(200).json({ success: true, message: 'Licence désactivée avec succès', deleted: deleted > 0 });
    } catch (error) {
        console.error('Erreur /api/license/force-deactivate:', error);
        return res.status(500).json({ success: false, message: 'Erreur serveur lors de la désactivation' });
    }
}
