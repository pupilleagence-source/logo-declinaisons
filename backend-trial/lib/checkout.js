/**
 * Checkout Lemon Squeezy avec le bon plan présélectionné ET les autres plans
 * commutables sur la page de paiement.
 *
 * Servi par /api/checkout?plan=annual|lifetime|studio[&code=PROMO][&lang=fr|en], qui est une
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
const PUBLIC_BUY = 'https://logotyps.lemonsqueezy.com/checkout/buy/2abc04b9-663c-4a1d-ad3a-45bd95228691';

// Variantes du produit « License » en MODE RÉEL (produit 1368375, boutique activée le
// 2026-09-17). Les ids du mode test étaient 1077121 / 1077127 / 1077131 (produit 684890) :
// un checkout créé avec une clé API de test doit utiliser ceux-là, pas ceux-ci.
export const PLANS = {
    annual: 2138293,
    lifetime: 2138292,
    studio: 2138295
};
export const DEFAULT_PLAN = 'lifetime';
const DOWNLOAD_PAGE = 'https://logotyps.fr/download';
// Après paiement, Lemon Squeezy remplace [license_key], [email], [order_id] par les vraies
// valeurs (variables de lien) : la page /download affiche la clé tout de suite. Le bouton
// du reçu (e-mail) mène au même endroit. Sans ça, la redirection court-circuite la page
// de confirmation de Lemon Squeezy et le client ne voit jamais sa clé.
const THANK_YOU_URL = DOWNLOAD_PAGE + '?achat=1&key=[license_key]&email=[email]&order=[order_id]';

// Textes du checkout selon la langue du site (?lang=). Lemon Squeezy n'a qu'une seule
// description par produit ; l'API permet de la remplacer checkout par checkout, ainsi
// que le nom et les textes du reçu. Les noms et descriptions des VARIANTES, eux, ne
// sont pas remplaçables : ils doivent rester bilingues dans le dashboard.
export const TEXTS = {
    fr: {
        name: 'Logotyps, plugin Illustrator',
        description: 'Toutes les déclinaisons de votre logo, exportées et rangées, plus la charte graphique InDesign avec 9 mockups : un clic dans Illustrator. Licence à vie (3 postes), annuelle (3 postes, annulable à tout moment) ou Studio (15 postes). Prix TTC. Clé de licence affichée juste après le paiement et envoyée par e-mail. Satisfait ou remboursé 14 jours.\n\nConditions d\'utilisation : logotyps.fr/terms · Confidentialité : logotyps.fr/privacy',
        receiptButton: 'Télécharger le plugin',
        thankYou: 'Merci ! Installez le plugin depuis logotyps.fr/download, puis collez votre clé de licence dans le panneau Logotyps d\'Illustrator. Vos clés restent consultables sur app.lemonsqueezy.com/my-orders ; abonnement annuel gérable ou annulable à tout moment sur logotyps.lemonsqueezy.com/billing.'
    },
    en: {
        name: 'Logotyps, Illustrator plugin',
        description: 'Every variation of your logo, exported and organized, plus the InDesign brand guide with 9 mockups: one click in Illustrator. Lifetime (3 computers), annual (3 computers, cancel anytime) or Studio (15 computers) license. Prices include VAT. License key shown right after payment and sent by email. 14-day money-back guarantee.\n\nTerms of use: logotyps.fr/terms · Privacy: logotyps.fr/privacy',
        receiptButton: 'Download the plugin',
        thankYou: 'Thank you! Install the plugin from logotyps.fr/download, then paste your license key in the Logotyps panel inside Illustrator. Your keys stay available on app.lemonsqueezy.com/my-orders; the annual plan can be managed or cancelled at any time on logotyps.lemonsqueezy.com/billing.'
    }
};

export function normalizeLang(value) {
    return String(value || '').toLowerCase().slice(0, 2) === 'en' ? 'en' : 'fr';
}

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

export function buildCheckoutBody(plan, code, lang) {
    const t = TEXTS[normalizeLang(lang)];
    const attributes = {
        product_options: {
            name: t.name,
            description: t.description,
            enabled_variants: Object.values(PLANS),
            redirect_url: THANK_YOU_URL,
            receipt_button_text: t.receiptButton,
            receipt_link_url: THANK_YOU_URL,
            receipt_thank_you_note: t.thankYou
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
export async function createCheckoutUrl(plan, code, { fetchImpl, apiKey, timeoutMs = 6000, lang } = {}) {
    const key = apiKey === undefined ? process.env.LEMONSQUEEZY_API_KEY : apiKey;
    const doFetch = fetchImpl || ((...a) => fetch(...a));
    if (!key) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await doFetch(API, {
            method: 'POST',
            headers: { 'Accept': 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json', 'Authorization': 'Bearer ' + key },
            body: JSON.stringify(buildCheckoutBody(plan, code, lang)),
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
    const url = (await createCheckoutUrl(plan, code, Object.assign({}, deps, { lang: normalizeLang(query.lang) }))) || fallbackUrl(plan, code);
    res.setHeader('Location', url);
    return res.status(302).end();
}
