/**
 * Checkout Lemon Squeezy avec le bon plan présélectionné ET les autres plans
 * commutables sur la page de paiement.
 *
 * Servi par /api/checkout?plan=annual|lifetime|studio[&code=PROMO], qui est une
 * route vercel.json vers /api/version/latest.js?checkout=1 (plafond de 12 fonctions
 * du plan Hobby, toutes prises).
 *
 * Pourquoi passer par l'API : le lien public « buy » n'accepte que `enabled=…`, qui
 * LIMITE la page aux variantes listées sans en présélectionner une. L'API Checkouts,
 * elle, prend une variante (relationship `variant`) + une liste `enabled_variants` :
 * la variante est cochée d'office, les autres restent au choix. Chaque clic crée un
 * checkout (sans expiration) et redirige dessus. Si l'API échoue (clé absente,
 * Lemon Squeezy injoignable), repli sur le lien public de la variante seule : le
 * bouton du site marche toujours.
 */

const API = 'https://api.lemonsqueezy.com/v1/checkouts';
const STORE_ID = '240133';
const PUBLIC_BUY = 'https://logotyps.lemonsqueezy.com/checkout/buy/31470257-06a8-4239-9d09-a3e119eed69e';

// Variantes du produit « License » (communes aux modes test et réel).
export const PLANS = {
    annual: 1077121,
    lifetime: 1077127,
    studio: 1077131
};
export const DEFAULT_PLAN = 'lifetime';
const DOWNLOAD_PAGE = 'https://logotyps.fr/download';
// Après paiement, Lemon Squeezy remplace [license_key], [email], [order_id] par les vraies
// valeurs (variables de lien) : la page /download affiche la clé tout de suite. Le bouton
// du reçu (e-mail) mène au même endroit. Sans ça, la redirection court-circuite la page
// de confirmation de Lemon Squeezy et le client ne voit jamais sa clé.
const THANK_YOU_URL = DOWNLOAD_PAGE + '?achat=1&key=[license_key]&email=[email]&order=[order_id]';

export function normalizePlan(value) {
    const p = String(value || '').toLowerCase();
    if (p === 'annual' || p === 'annuel' || p === 'year' || p === 'yearly') return 'annual';
    if (p === 'lifetime' || p === 'life' || p === 'vie') return 'lifetime';
    if (p === 'studio' || p === 'team' || p === 'agence') return 'studio';
    return null;
}

export function fallbackUrl(plan, code) {
    const u = PUBLIC_BUY + '?enabled=' + PLANS[plan];
    return code ? u + '&checkout[discount_code]=' + encodeURIComponent(code) : u;
}

export function buildCheckoutBody(plan, code) {
    const attributes = {
        product_options: {
            enabled_variants: Object.values(PLANS),
            redirect_url: THANK_YOU_URL,
            receipt_button_text: 'Télécharger le plugin',
            receipt_link_url: THANK_YOU_URL,
            receipt_thank_you_note: 'Merci ! Installez le plugin depuis logotyps.fr/download, puis collez votre clé de licence dans le panneau Logotyps d\'Illustrator. Vos clés restent consultables sur app.lemonsqueezy.com/my-orders.'
        },
        checkout_options: { embed: false, logo: true, media: true, desc: true, discount: true, button_color: '#FF6B35' },
        expires_at: null,
        preview: false
    };
    if (code) attributes.checkout_data = { discount_code: code };
    return {
        data: {
            type: 'checkouts',
            attributes,
            relationships: {
                store: { data: { type: 'stores', id: STORE_ID } },
                variant: { data: { type: 'variants', id: String(PLANS[plan]) } }
            }
        }
    };
}

// Crée le checkout ; renvoie son URL, ou null si l'API refuse / ne répond pas.
export async function createCheckoutUrl(plan, code, { fetchImpl, apiKey, timeoutMs = 6000 } = {}) {
    const key = apiKey === undefined ? process.env.LEMONSQUEEZY_API_KEY : apiKey;
    const doFetch = fetchImpl || ((...a) => fetch(...a));
    if (!key) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await doFetch(API, {
            method: 'POST',
            headers: { 'Accept': 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json', 'Authorization': 'Bearer ' + key },
            body: JSON.stringify(buildCheckoutBody(plan, code)),
            signal: controller.signal
        });
        const data = await res.json().catch(() => ({}));
        const url = data && data.data && data.data.attributes && data.data.attributes.url;
        return res.ok && typeof url === 'string' && url.startsWith('https://') ? url : null;
    } catch (e) {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

// Code promo : lettres, chiffres, tirets, 32 caractères max. Tout le reste est ignoré.
function cleanCode(value) {
    const c = String(value || '').trim().toUpperCase();
    return /^[A-Z0-9_-]{1,32}$/.test(c) ? c : '';
}

export async function handleCheckout(req, res, deps) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed', message: 'Utilisez GET pour cet endpoint' });
    const query = req.query || {};
    const plan = query.plan ? normalizePlan(query.plan) : DEFAULT_PLAN;
    if (!plan) return res.status(400).json({ error: 'Unknown plan', message: 'Précisez ?plan=annual, lifetime ou studio' });
    const code = cleanCode(query.code);
    const url = (await createCheckoutUrl(plan, code, deps)) || fallbackUrl(plan, code);
    res.setHeader('Location', url);
    return res.status(302).end();
}
