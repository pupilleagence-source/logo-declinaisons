/**
 * API Endpoint: /api/webhooks/lemonsqueezy
 * Reçoit les webhooks de Lemon Squeezy
 *
 * Événements gérés:
 * - order_refunded: Désactive la licence quand un refund est fait
 * - subscription_cancelled: Désactive la licence quand l'abonnement est annulé
 * - subscription_expired: Désactive la licence quand l'abonnement expire
 * - license_key_updated: Met à jour le statut de la licence
 *
 * POST Body: Webhook Lemon Squeezy
 * Response: { success: boolean }
 */

import { createClient } from 'redis';
import crypto from 'crypto';

// Créer le client Redis
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

/**
 * Vérifie la signature du webhook Lemon Squeezy
 */
function verifyWebhookSignature(payload, signature, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

export default async function handler(req, res) {
    // Accepter uniquement POST
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed'
        });
    }

    try {
        // NOTE: Vérification de signature désactivée car Vercel parse automatiquement le JSON
        // et nous n'avons pas accès au raw body nécessaire pour vérifier la signature HMAC.
        // Pour une meilleure sécurité en production, il faudrait :
        // 1. Utiliser une config Vercel spéciale pour garder le raw body
        // 2. Ou utiliser l'IP whitelisting de Lemon Squeezy
        // 3. Ou ajouter un secret token dans l'URL du webhook

        // const signature = req.headers['x-signature'];
        // const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

        console.log('📨 Webhook reçu de Lemon Squeezy');
        console.log('Headers:', JSON.stringify(req.headers, null, 2));

        const event = req.body;
        const eventName = event.meta?.event_name;

        console.log(`📨 Webhook reçu: ${eventName}`);
        console.log('Event data:', JSON.stringify(event, null, 2));

        const client = await getRedisClient();

        // Gérer les différents types d'événements
        switch (eventName) {
            case 'order_refunded': {
                console.log('🔍 Traitement order_refunded...');
                console.log('Event attributes:', JSON.stringify(event.data?.attributes, null, 2));

                // Essayer plusieurs chemins pour trouver la license key
                const licenseKey = event.data?.attributes?.first_order_item?.license_key
                                || event.data?.attributes?.license_keys?.[0]
                                || event.data?.attributes?.order_items?.[0]?.product_variant_license_key;

                console.log('License key trouvée:', licenseKey ? licenseKey.substring(0, 10) + '...' : 'AUCUNE');

                if (licenseKey) {
                    // Trouver toutes les licences avec cette clé
                    const keys = await client.keys('license:*');
                    console.log(`🔍 Scanning ${keys.length} licences...`);

                    let found = false;
                    for (const key of keys) {
                        const licenseData = await client.get(key);
                        if (licenseData) {
                            const license = JSON.parse(licenseData);
                            if (license.licenseKey === licenseKey) {
                                // IMPORTANT: Désactiver sur Lemon Squeezy AVANT de supprimer de Redis
                                // Pour libérer le slot d'activation
                                if (license.instanceId) {
                                    try {
                                        console.log(`🔓 Libération slot Lemon Squeezy: ${licenseKey.substring(0, 10)}...`);

                                        const deactivateResponse = await fetch('https://api.lemonsqueezy.com/v1/licenses/deactivate', {
                                            method: 'POST',
                                            headers: {
                                                'Accept': 'application/json',
                                                'Content-Type': 'application/json',
                                                'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`
                                            },
                                            body: JSON.stringify({
                                                license_key: licenseKey,
                                                instance_id: license.instanceId
                                            })
                                        });

                                        if (deactivateResponse.ok) {
                                            console.log(`✅ Slot Lemon Squeezy libéré: ${licenseKey.substring(0, 10)}...`);
                                        } else {
                                            const errorData = await deactivateResponse.json();
                                            console.warn(`⚠️ Échec libération slot:`, errorData);
                                        }
                                    } catch (deactivateError) {
                                        console.warn(`⚠️ Erreur désactivation Lemon Squeezy:`, deactivateError.message);
                                    }
                                }

                                // Supprimer de Redis
                                await client.del(key);
                                console.log(`✅ Licence désactivée suite à refund: ${licenseKey.substring(0, 10)}... (HWID: ${key})`);
                                found = true;
                            }
                        }
                    }

                    if (!found) {
                        console.warn(`⚠️ Aucune licence trouvée avec la clé ${licenseKey.substring(0, 10)}...`);
                    }
                } else {
                    console.error('❌ Impossible de trouver la license key dans le webhook order_refunded');
                }
                break;
            }

            case 'subscription_cancelled':
            case 'subscription_expired': {
                // Récupérer la license key depuis la subscription
                const licenseKey = event.data?.attributes?.license_key;

                if (licenseKey) {
                    const keys = await client.keys('license:*');

                    for (const key of keys) {
                        const licenseData = await client.get(key);
                        if (licenseData) {
                            const license = JSON.parse(licenseData);
                            if (license.licenseKey === licenseKey) {
                                // Désactiver sur Lemon Squeezy AVANT de supprimer
                                if (license.instanceId) {
                                    try {
                                        console.log(`🔓 Libération slot suite à ${eventName}: ${licenseKey.substring(0, 10)}...`);

                                        const deactivateResponse = await fetch('https://api.lemonsqueezy.com/v1/licenses/deactivate', {
                                            method: 'POST',
                                            headers: {
                                                'Accept': 'application/json',
                                                'Content-Type': 'application/json',
                                                'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`
                                            },
                                            body: JSON.stringify({
                                                license_key: licenseKey,
                                                instance_id: license.instanceId
                                            })
                                        });

                                        if (deactivateResponse.ok) {
                                            console.log(`✅ Slot libéré: ${licenseKey.substring(0, 10)}...`);
                                        }
                                    } catch (deactivateError) {
                                        console.warn(`⚠️ Erreur désactivation:`, deactivateError.message);
                                    }
                                }

                                await client.del(key);
                                console.log(`✓ Licence désactivée suite à ${eventName}: ${licenseKey.substring(0, 10)}...`);
                            }
                        }
                    }
                }
                break;
            }

            case 'license_key_updated': {
                // Mettre à jour les infos de la licence si nécessaire
                const licenseKey = event.data?.attributes?.key;
                const status = event.data?.attributes?.status;

                console.log(`ℹ️ License key updated: ${licenseKey?.substring(0, 10)}... → status: ${status}`);

                // Si la licence est désactivée ou révoquée, la supprimer
                if (status === 'disabled' || status === 'revoked') {
                    const keys = await client.keys('license:*');

                    for (const key of keys) {
                        const licenseData = await client.get(key);
                        if (licenseData) {
                            const license = JSON.parse(licenseData);
                            if (license.licenseKey === licenseKey) {
                                // Désactiver sur Lemon Squeezy AVANT de supprimer
                                if (license.instanceId) {
                                    try {
                                        console.log(`🔓 Libération slot (status: ${status}): ${licenseKey.substring(0, 10)}...`);

                                        const deactivateResponse = await fetch('https://api.lemonsqueezy.com/v1/licenses/deactivate', {
                                            method: 'POST',
                                            headers: {
                                                'Accept': 'application/json',
                                                'Content-Type': 'application/json',
                                                'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`
                                            },
                                            body: JSON.stringify({
                                                license_key: licenseKey,
                                                instance_id: license.instanceId
                                            })
                                        });

                                        if (deactivateResponse.ok) {
                                            console.log(`✅ Slot libéré: ${licenseKey.substring(0, 10)}...`);
                                        }
                                    } catch (deactivateError) {
                                        console.warn(`⚠️ Erreur désactivation:`, deactivateError.message);
                                    }
                                }

                                await client.del(key);
                                console.log(`✓ Licence supprimée (status: ${status}): ${licenseKey.substring(0, 10)}...`);
                            }
                        }
                    }
                }
                break;
            }

            default:
                console.log(`ℹ️ Événement non géré: ${eventName}`);
        }

        // Toujours répondre 200 pour confirmer la réception
        return res.status(200).json({
            success: true,
            message: 'Webhook traité'
        });

    } catch (error) {
        console.error('❌ Erreur webhook:', error);

        // Même en cas d'erreur, retourner 200 pour éviter les retry
        return res.status(200).json({
            success: false,
            error: error.message
        });
    }
}
