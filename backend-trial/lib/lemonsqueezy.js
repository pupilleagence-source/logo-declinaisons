/**
 * Client minimal pour Lemon Squeezy.
 *
 * Deux API distinctes :
 *  - la License API (/v1/licenses/{validate,activate,deactivate}) : SANS clé API,
 *    c'est la clé de licence du client qui fait foi ;
 *  - l'API principale (/v1/license-key-instances) : avec la clé API du store
 *    (LEMONSQUEEZY_API_KEY), utilisée seulement pour retrouver une instance déjà
 *    créée pour un poste et éviter d'en créer une deuxième.
 *
 * Testable : `fetchImpl` est injectable.
 */

const LICENSE_API = 'https://api.lemonsqueezy.com/v1/licenses';
const MAIN_API = 'https://api.lemonsqueezy.com/v1';

export function createLemonClient({ fetchImpl, apiKey, timeoutMs = 6000 } = {}) {
    const doFetch = fetchImpl || ((...a) => fetch(...a));
    const key = apiKey === undefined ? process.env.LEMONSQUEEZY_API_KEY : apiKey;

    async function request(url, init) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await doFetch(url, Object.assign({ signal: controller.signal }, init));
            let data = {};
            try { data = await res.json(); } catch (e) { data = {}; }
            return { ok: res.ok, status: res.status, data };
        } finally {
            clearTimeout(timer);
        }
    }

    function license(path, body) {
        return request(LICENSE_API + path, {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    }

    return {
        hasApiKey: !!key,
        validate: (licenseKey, instanceId) => license('/validate', instanceId ? { license_key: licenseKey, instance_id: instanceId } : { license_key: licenseKey }),
        activate: (licenseKey, instanceName) => license('/activate', { license_key: licenseKey, instance_name: instanceName }),
        deactivate: (licenseKey, instanceId) => license('/deactivate', { license_key: licenseKey, instance_id: instanceId }),

        // Instances existantes d'une clé : [{ id, name, createdAt }]. `id` est
        // l'identifiant attendu par la License API (attribut `identifier`).
        // null si pas de clé API ou si l'appel échoue : l'appelant se rabat sur activate.
        listInstances: async (licenseKeyId) => {
            if (!key || !licenseKeyId) return null;
            try {
                const r = await request(MAIN_API + '/license-key-instances?filter[license_key_id]=' + encodeURIComponent(licenseKeyId) + '&page[size]=100', {
                    method: 'GET',
                    headers: { 'Accept': 'application/vnd.api+json', 'Authorization': 'Bearer ' + key }
                });
                if (!r.ok || !Array.isArray(r.data.data)) return null;
                return r.data.data.map(d => ({
                    id: d.attributes && d.attributes.identifier,
                    name: d.attributes && d.attributes.name,
                    createdAt: d.attributes && d.attributes.created_at
                })).filter(i => i.id);
            } catch (e) {
                return null;
            }
        }
    };
}

// Message français, avec le remède, pour les erreurs connues de la License API.
export function humanizeLemonError(error, fallback) {
    const e = String(error || '');
    if (/activation limit/i.test(e)) return 'Limite d\'activations atteinte pour cette clé. Désactivez le plugin sur un autre poste (bouton Désactiver), puis réessayez.';
    if (/disabled/i.test(e)) return 'Cette clé de licence a été désactivée.';
    if (/expired/i.test(e)) return 'Cette clé de licence a expiré.';
    if (/license_key not found/i.test(e) || /not found/i.test(e) && !/instance/i.test(e)) return 'Clé de licence introuvable. Vérifiez la clé reçue par e-mail (sans espaces).';
    return e || fallback || 'Clé de licence invalide';
}

// L'erreur concerne-t-elle l'instance (poste) et non la clé elle-même ?
export function isInstanceError(error) {
    return /instance/i.test(String(error || ''));
}

// La clé elle-même est-elle définitivement inutilisable ?
export function isKeyDead(error) {
    const e = String(error || '');
    return /disabled/i.test(e) || /expired/i.test(e) || /license_key not found/i.test(e);
}
