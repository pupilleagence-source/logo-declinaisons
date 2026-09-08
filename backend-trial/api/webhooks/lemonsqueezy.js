/**
 * API Endpoint: /api/webhooks/lemonsqueezy
 * Reçoit les webhooks de Lemon Squeezy. Canal de RÉVOCATION uniquement :
 *   order_refunded, subscription_cancelled, subscription_expired,
 *   license_key_updated (status disabled / revoked).
 * Un achat ne passe pas par ici : la licence ne devient active que quand
 * l'utilisateur colle sa clé dans le panneau.
 *
 * Signature : Lemon Squeezy envoie X-Signature = HMAC-SHA256(corps brut, secret du
 * webhook). Le body parser de Vercel est désactivé pour lire le corps brut ; toute
 * requête sans signature valide est rejetée (401). Le secret est
 * LEMONSQUEEZY_WEBHOOK_SECRET, celui affiché dans Settings > Webhooks.
 */

import { getRedisClient } from '../../lib/redis.js';
import { createLemonClient } from '../../lib/lemonsqueezy.js';
import { revokeLicenseKey, verifyWebhookSignature, licenseKeyFromEvent } from '../../lib/license-flow.js';

export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
    const chunks = [];
    for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    return Buffer.concat(chunks);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    if (!secret) {
        console.error('❌ LEMONSQUEEZY_WEBHOOK_SECRET absent : webhook refusé');
        return res.status(500).json({ success: false, error: 'webhook secret non configuré' });
    }

    let raw;
    try { raw = await readRawBody(req); }
    catch (e) { return res.status(400).json({ success: false, error: 'corps illisible' }); }

    if (!verifyWebhookSignature(raw, req.headers['x-signature'], secret)) {
        console.warn('🚫 Webhook rejeté : signature absente ou invalide');
        return res.status(401).json({ success: false, error: 'signature invalide' });
    }

    let event;
    try { event = JSON.parse(raw.toString('utf8')); }
    catch (e) { return res.status(400).json({ success: false, error: 'JSON invalide' }); }

    const eventName = event && event.meta && event.meta.event_name;
    console.log('📨 Webhook Lemon Squeezy :', eventName);

    try {
        const deps = { ls: createLemonClient(), store: await getRedisClient() };
        switch (eventName) {
            case 'order_refunded':
            case 'subscription_cancelled':
            case 'subscription_expired': {
                const licenseKey = licenseKeyFromEvent(event);
                if (licenseKey) await revokeLicenseKey(licenseKey, deps, eventName);
                else console.warn('⚠️ Clé de licence introuvable dans l\'événement', eventName);
                break;
            }
            case 'license_key_updated': {
                const status = event.data && event.data.attributes && event.data.attributes.status;
                const licenseKey = licenseKeyFromEvent(event);
                console.log('ℹ️ license_key_updated → status', status);
                if (licenseKey && (status === 'disabled' || status === 'revoked' || status === 'expired')) {
                    await revokeLicenseKey(licenseKey, deps, 'license_key_updated:' + status);
                }
                break;
            }
            default:
                console.log('ℹ️ Événement non géré :', eventName);
        }
        return res.status(200).json({ success: true, message: 'Webhook traité' });
    } catch (error) {
        console.error('❌ Erreur webhook:', error);
        // 200 quand même : l'événement est authentique, inutile que Lemon Squeezy le rejoue.
        return res.status(200).json({ success: false, error: error.message });
    }
}
