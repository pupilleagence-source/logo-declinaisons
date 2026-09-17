/**
 * Logique de licence, indépendante de Vercel et de Redis : chaque fonction reçoit
 * `ls` (client Lemon Squeezy, cf. lemonsqueezy.js) et `store` ({ get, set, del, keys }).
 * Les handlers api/license/* et api/webhooks/* ne font que brancher les deux.
 *
 * Règle centrale : UNE instance Lemon Squeezy par poste (HWID). On n'appelle
 * `activate` (qui crée toujours une instance et consomme un slot) que si aucune
 * instance valide n'existe pour ce poste — ni dans Redis, ni chez Lemon Squeezy.
 * Avant le 2026-09-08, chaque clic sur « Activer » créait une instance.
 *
 * Couvert par tests/backend-license.test.js.
 */
import crypto from 'crypto';
import { humanizeLemonError, isInstanceError, isKeyDead } from './lemonsqueezy.js';

// IDs des variantes Lemon Squeezy (communs aux modes test et réel). Depuis le
// 2026-09-10 : LIFETIME = licence à vie 59 €, ANNUAL = licence annuelle 39 €/an
// (ex-abonnement mensuel, même variante re-tarifée), STUDIO = 149 € pour 15 postes
// (créée le 2026-09-10). Une variante inconnue est acceptée en 'unknown'.
export const VARIANT_IDS = { LIFETIME: 2138292, ANNUAL: 2138293, STUDIO: 2138295 };

export function licenseTypeFor(variantId) {
    if (variantId === VARIANT_IDS.LIFETIME) return 'lifetime';
    if (variantId === VARIANT_IDS.ANNUAL) return 'annual';
    if (VARIANT_IDS.STUDIO && variantId === VARIANT_IDS.STUDIO) return 'studio';
    return 'unknown';
}

const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

// L'API de licence de Lemon Squeezy (validate / activate) ne distingue pas les modes :
// une clé achetée en MODE TEST reste « valide » après le passage de la boutique en réel
// (constaté le 2026-09-17). Seul le propriétaire de la boutique peut en créer, mais elle
// ne doit pas déverrouiller le produit vendu : refusée à l'activation et à la vérification.
export const TEST_KEY_MESSAGE = 'Cette clé provient du mode test de la boutique et ne peut pas activer le plugin. Utilisez une clé achetée sur logotyps.fr.';
export function isTestModeKey(lsData) {
    return !!(lsData && lsData.license_key && lsData.license_key.test_mode === true);
}

function key(hwid) { return 'license:' + hwid; }

async function readRecord(store, hwid) {
    const raw = await store.get(key(hwid));
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
}

function buildRecord(base, lsData, instanceId, now) {
    const meta = (lsData && lsData.meta) || {};
    const lk = (lsData && lsData.license_key) || {};
    return {
        licenseKey: base.licenseKey,
        email: base.email,
        hwid: base.hwid,
        instanceId: instanceId || null,
        licenseKeyId: lk.id || base.licenseKeyId || null,
        variantId: meta.variant_id || base.variantId || null,
        licenseType: licenseTypeFor(meta.variant_id || base.variantId),
        customerEmail: meta.customer_email || base.customerEmail || null,
        activationLimit: lk.activation_limit === undefined ? (base.activationLimit ?? null) : lk.activation_limit,
        activationUsage: lk.activation_usage === undefined ? (base.activationUsage ?? null) : lk.activation_usage,
        activatedAt: base.activatedAt || now,
        lastValidated: now
    };
}

/**
 * POST /api/license/activate
 * body : { licenseKey, email, hwid, previousHwid? }
 * -> { status, body: { success, licenseType, message, reused } }
 */
export async function activateLicense(body, { ls, store, now = Date.now, log = console }) {
    const { licenseKey, email, hwid, previousHwid } = body || {};
    if (!licenseKey || !email || !hwid) {
        return { status: 400, body: { success: false, message: 'Paramètres manquants (licenseKey, email, hwid requis)' } };
    }
    const cleanKey = String(licenseKey).trim();
    const base = { licenseKey: cleanKey, email, hwid };

    // 1. Ce poste a-t-il déjà une instance connue et toujours valide ? Alors rien à créer.
    const existing = await readRecord(store, hwid);
    if (existing && existing.licenseKey === cleanKey && existing.instanceId) {
        const v = await ls.validate(cleanKey, existing.instanceId);
        if (isTestModeKey(v.data)) {
            await store.del(key(hwid));
            return { status: 400, body: { success: false, message: TEST_KEY_MESSAGE } };
        }
        if (v.data.valid) {
            const record = buildRecord(Object.assign({}, existing, base), v.data, existing.instanceId, now());
            await store.set(key(hwid), JSON.stringify(record));
            log.log('✓ Licence déjà active sur ce poste, instance réutilisée');
            return { status: 200, body: { success: true, licenseType: record.licenseType, message: 'Licence déjà active sur ce poste', reused: true } };
        }
        if (isKeyDead(v.data.error)) {
            await store.del(key(hwid));
            return { status: 400, body: { success: false, message: humanizeLemonError(v.data.error) } };
        }
        // Instance disparue (désactivée ailleurs) : on repart proprement.
        await store.del(key(hwid));
    }

    // 2. Changement de HWID (mise à jour d'Illustrator) : libérer l'ancienne instance.
    if (previousHwid && previousHwid !== hwid) {
        const prev = await readRecord(store, previousHwid);
        if (prev && prev.licenseKey === cleanKey) {
            if (prev.instanceId) {
                try { await ls.deactivate(cleanKey, prev.instanceId); log.log('🔓 Ancienne instance libérée (changement de HWID)'); }
                catch (e) { log.warn('⚠️ Libération de l\'ancienne instance impossible :', e.message); }
            }
            await store.del(key(previousHwid));
        }
    }

    // 3. La clé est-elle utilisable ? (validate sans instance : renseigne l'id de la clé.)
    //    Une clé jamais activée peut être rapportée non valide par cet appel : on ne
    //    bloque que sur une erreur qui condamne la clé, sinon activate tranchera.
    const v = await ls.validate(cleanKey);
    if (isTestModeKey(v.data)) {
        return { status: 400, body: { success: false, message: TEST_KEY_MESSAGE } };
    }
    if (!v.data.valid && isKeyDead(v.data.error)) {
        return { status: 400, body: { success: false, message: humanizeLemonError(v.data.error) } };
    }
    const licenseKeyId = v.data.license_key && v.data.license_key.id;

    // 4. Une instance porte déjà le nom de ce poste chez Lemon Squeezy (Redis perdu,
    //    réinstallation, anciennes versions du backend) ? La réutiliser.
    const instances = await ls.listInstances(licenseKeyId);
    if (instances) {
        const mine = instances.filter(i => i.name === hwid).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
        for (const inst of mine) {
            const vv = await ls.validate(cleanKey, inst.id);
            if (vv.data.valid) {
                const record = buildRecord(Object.assign({}, base, { licenseKeyId }), vv.data, inst.id, now());
                await store.set(key(hwid), JSON.stringify(record));
                log.log('✓ Instance existante réutilisée pour ce poste');
                return { status: 200, body: { success: true, licenseType: record.licenseType, message: 'Licence activée (instance existante réutilisée)', reused: true } };
            }
        }
    }

    // 5. Sinon, et seulement maintenant : créer l'instance.
    const a = await ls.activate(cleanKey, hwid);
    if (!a.data.activated) {
        return { status: 400, body: { success: false, message: humanizeLemonError(a.data.error, 'Impossible d\'activer la licence') } };
    }
    const instanceId = a.data.instance && a.data.instance.id;
    if (isTestModeKey(a.data)) {
        if (instanceId) { try { await ls.deactivate(cleanKey, instanceId); } catch (e) {} }
        return { status: 400, body: { success: false, message: TEST_KEY_MESSAGE } };
    }
    const record = buildRecord(Object.assign({}, base, { licenseKeyId }), a.data, instanceId, now());
    await store.set(key(hwid), JSON.stringify(record));
    log.log('✓ Licence activée, nouvelle instance créée (' + record.licenseType + ')');
    return { status: 200, body: { success: true, licenseType: record.licenseType, message: 'Licence activée avec succès', reused: false } };
}

/**
 * POST /api/license/validate
 * body : { hwid }
 * -> { status, body: { valid, licenseType?, email?, activatedAt?, offline?, message? } }
 */
export async function validateLicense(body, { ls, store, now = Date.now, log = console }) {
    const { hwid } = body || {};
    if (!hwid) return { status: 400, body: { valid: false, message: 'HWID manquant' } };

    const record = await readRecord(store, hwid);
    if (!record) return { status: 200, body: { valid: false, message: 'Aucune licence trouvée pour ce HWID' } };

    const ok = (r, extra) => ({ status: 200, body: Object.assign({ valid: true, licenseType: r.licenseType, email: r.email, activatedAt: r.activatedAt }, extra || {}) });

    try {
        const v = await ls.validate(record.licenseKey, record.instanceId || undefined);
        if (!v.data.valid) {
            await store.del(key(hwid));
            if (record.instanceId && isInstanceError(v.data.error)) {
                log.log('ℹ️ Instance désactivée côté Lemon Squeezy pour ce poste');
                return { status: 200, body: { valid: false, message: 'Licence désactivée sur ce poste. Réactivez-la avec votre clé.' } };
            }
            log.log('ℹ️ Licence non valide côté Lemon Squeezy : ' + (v.data.error || '?'));
            return { status: 200, body: { valid: false, message: 'Licence révoquée ou expirée' } };
        }

        if (isTestModeKey(v.data)) {
            await store.del(key(hwid));
            log.log('ℹ️ Clé de mode test refusée pour ce poste');
            return { status: 200, body: { valid: false, message: TEST_KEY_MESSAGE } };
        }

        let instanceId = record.instanceId;
        if (!instanceId) {
            // Enregistrement d'avant 2026-09-08, sans instance : tenter de la retrouver.
            const instances = await ls.listInstances(v.data.license_key && v.data.license_key.id);
            const mine = instances && instances.find(i => i.name === hwid);
            if (mine) instanceId = mine.id;
        }
        const updated = buildRecord(record, v.data, instanceId, now());
        updated.activatedAt = record.activatedAt;
        await store.set(key(hwid), JSON.stringify(updated));
        return ok(updated);
    } catch (e) {
        // Lemon Squeezy injoignable : tolérance de 7 jours depuis la dernière validation.
        log.warn('⚠️ Lemon Squeezy inaccessible, utilisation du cache :', e.message);
        const age = now() - (record.lastValidated || record.activatedAt || 0);
        if (age > OFFLINE_GRACE_MS) {
            return { status: 200, body: { valid: false, message: 'Cache expiré, connexion Internet requise pour valider la licence' } };
        }
        return ok(record, { offline: true });
    }
}

/**
 * POST /api/license/deactivate
 * body : { licenseKey, hwid }
 */
export async function deactivateLicense(body, { ls, store, log = console }) {
    const { licenseKey, hwid } = body || {};
    if (!licenseKey || !hwid) return { status: 400, body: { success: false, message: 'Paramètres manquants (licenseKey et hwid requis)' } };

    const record = await readRecord(store, hwid);
    if (!record) {
        // Pas d'enregistrement pour ce poste : déjà désactivé, ou enregistrement supprimé
        // côté serveur (clé de test refusée, révocation). Le but « ce poste n'a plus de
        // licence » est atteint : succès, idempotent. Avant le 2026-09-17 on répondait 404
        // et le panneau restait bloqué sur « Licensed » sans pouvoir se désactiver.
        // On libère tout de même une éventuelle instance orpheline au nom de ce poste.
        const cleanKey = String(licenseKey).trim();
        let released = false;
        try {
            const v = await ls.validate(cleanKey);
            const keyId = v.data && v.data.license_key && v.data.license_key.id;
            const instances = keyId ? await ls.listInstances(keyId) : null;
            if (instances) {
                for (const inst of instances.filter(i => i.name === hwid)) {
                    const d = await ls.deactivate(cleanKey, inst.id);
                    if (d.data.deactivated) released = true;
                }
            }
        } catch (e) {
            log.warn('⚠️ Recherche d\'instance orpheline impossible :', e.message);
        }
        log.log('ℹ️ Aucune licence enregistrée pour ce poste' + (released ? ', instance orpheline libérée' : ''));
        return { status: 200, body: { success: true, message: 'Aucune licence active sur ce poste : rien à désactiver.', deleted: false, released } };
    }

    if (record.instanceId) {
        const d = await ls.deactivate(record.licenseKey, record.instanceId);
        const gone = d.data.deactivated || isInstanceError(d.data.error) || /not found/i.test(String(d.data.error || ''));
        if (!gone) {
            log.warn('⚠️ Désactivation refusée par Lemon Squeezy :', d.data.error);
            return { status: 400, body: { success: false, message: humanizeLemonError(d.data.error, 'Impossible de désactiver la licence') } };
        }
    } else {
        log.warn('⚠️ Pas d\'instance connue pour ce poste : suppression locale seulement');
    }
    const deleted = await store.del(key(hwid));
    log.log('✓ Licence désactivée sur ce poste');
    return { status: 200, body: { success: true, message: 'Licence désactivée avec succès', deleted: deleted > 0 } };
}

/**
 * Révoque une clé partout où elle est active (webhook : remboursement, abonnement
 * terminé, clé désactivée). Renvoie le nombre de postes touchés.
 */
export async function revokeLicenseKey(licenseKey, { ls, store, log = console }, reason) {
    if (!licenseKey) return 0;
    const keys = await store.keys('license:*');
    let count = 0;
    for (const k of keys) {
        const raw = await store.get(k);
        if (!raw) continue;
        let rec = null;
        try { rec = JSON.parse(raw); } catch (e) { continue; }
        if (!rec || rec.licenseKey !== licenseKey) continue;
        if (rec.instanceId) {
            try { await ls.deactivate(licenseKey, rec.instanceId); }
            catch (e) { log.warn('⚠️ Libération du slot impossible :', e.message); }
        }
        await store.del(k);
        count++;
    }
    log.log('✓ ' + count + ' poste(s) révoqué(s) (' + (reason || 'webhook') + ')');
    return count;
}

/** Signature HMAC-SHA256 (hex) du corps brut, en-tête X-Signature de Lemon Squeezy. */
export function verifyWebhookSignature(rawBody, signature, secret) {
    if (!secret || !signature || !rawBody) return false;
    const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(String(signature).trim().toLowerCase(), 'utf8');
    const b = Buffer.from(digest, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

/** Extrait la clé de licence d'un événement webhook, selon son type. */
export function licenseKeyFromEvent(event) {
    const attrs = (event && event.data && event.data.attributes) || {};
    const name = event && event.meta && event.meta.event_name;
    if (name === 'order_refunded') {
        return (attrs.first_order_item && attrs.first_order_item.license_key)
            || (Array.isArray(attrs.license_keys) && attrs.license_keys[0])
            || (Array.isArray(attrs.order_items) && attrs.order_items[0] && attrs.order_items[0].product_variant_license_key)
            || null;
    }
    if (name === 'subscription_cancelled' || name === 'subscription_expired') return attrs.license_key || null;
    if (name === 'license_key_updated' || name === 'license_key_created') return attrs.key || null;
    return null;
}
