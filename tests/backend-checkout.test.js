// /api/checkout : checkout Lemon Squeezy avec le plan présélectionné et les autres commutables.
const path = require('path');
const { pathToFileURL } = require('url');

let pass = 0, fail = 0;
function check(label, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log((ok ? '  OK   ' : '  ECHEC') + ' | ' + label + (ok ? '' : `  (obtenu ${JSON.stringify(actual)}, attendu ${JSON.stringify(expected)})`));
    ok ? pass++ : fail++;
}
function fakeRes() {
    const r = { headers: {}, code: 0, body: null };
    r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
    r.status = (c) => { r.code = c; return r; };
    r.json = (b) => { r.body = b; return r; };
    r.end = () => r;
    return r;
}

(async function () {
    const mod = await import(pathToFileURL(path.join(__dirname, '..', 'backend-trial', 'lib', 'checkout.js')).href);
    const latest = await import(pathToFileURL(path.join(__dirname, '..', 'backend-trial', 'api', 'version', 'latest.js')).href);

    console.log('\n--- corps envoyé à Lemon Squeezy ---');
    const body = mod.buildCheckoutBody('annual', 'LANCEMENT');
    check('variante présélectionnée = annuel', body.data.relationships.variant.data.id, '1077121');
    check('les 3 plans restent commutables', body.data.attributes.product_options.enabled_variants, [1077121, 1077127, 1077131]);
    check('code promo pré-rempli', body.data.attributes.checkout_data.discount_code, 'LANCEMENT');
    check('retour vers la page de téléchargement avec la clé (variables Lemon Squeezy)', body.data.attributes.product_options.redirect_url, 'https://logotyps.fr/download?achat=1&key=[license_key]&email=[email]&order=[order_id]');
    check('le bouton du reçu mène au même endroit', body.data.attributes.product_options.receipt_link_url, body.data.attributes.product_options.redirect_url);
    check('pas de checkout_data sans code', mod.buildCheckoutBody('lifetime').data.attributes.checkout_data, undefined);
    check('store', body.data.relationships.store.data.id, '240133');

    console.log('\n--- createCheckoutUrl avec un faux Lemon Squeezy ---');
    const calls = [];
    const okFetch = async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({ data: { attributes: { url: 'https://logotyps.lemonsqueezy.com/checkout/custom/abc?signature=x' } } }) }; };
    let url = await mod.createCheckoutUrl('studio', '', { fetchImpl: okFetch, apiKey: 'K' });
    check('URL du checkout créé', url, 'https://logotyps.lemonsqueezy.com/checkout/custom/abc?signature=x');
    check('POST sur /v1/checkouts avec Bearer', [calls[0].init.method, calls[0].init.headers.Authorization, calls[0].url], ['POST', 'Bearer K', 'https://api.lemonsqueezy.com/v1/checkouts']);
    check('variante studio dans le corps', JSON.parse(calls[0].init.body).data.relationships.variant.data.id, '1077131');
    check('sans clé API → null (repli)', await mod.createCheckoutUrl('annual', '', { fetchImpl: okFetch, apiKey: '' }), null);
    check('API en erreur → null', await mod.createCheckoutUrl('annual', '', { fetchImpl: async () => ({ ok: false, json: async () => ({ errors: [{}] }) }), apiKey: 'K' }), null);
    check('réseau en panne → null', await mod.createCheckoutUrl('annual', '', { fetchImpl: async () => { throw new Error('ECONNRESET'); }, apiKey: 'K' }), null);
    check('URL non https refusée', await mod.createCheckoutUrl('annual', '', { fetchImpl: async () => ({ ok: true, json: async () => ({ data: { attributes: { url: 'javascript:alert(1)' } } }) }), apiKey: 'K' }), null);

    console.log('\n--- handleCheckout via latest.js (?checkout=1, comme la route vercel.json) ---');
    const call = async (query, deps, method = 'GET') => { const r = fakeRes(); await latest.default({ method, query: Object.assign({ checkout: '1' }, query), headers: {} }, r, deps); return r; };
    let r = await call({ plan: 'annual' }, { fetchImpl: okFetch, apiKey: 'K' });
    check('annual → 302 vers le checkout créé', [r.code, r.headers.location], [302, 'https://logotyps.lemonsqueezy.com/checkout/custom/abc?signature=x']);
    r = await call({ plan: 'lifetime', code: 'lancement' }, { fetchImpl: async () => { throw new Error('down'); }, apiKey: 'K' });
    check('API en panne → repli sur le lien public de la variante + code', [r.code, r.headers.location], [302, 'https://logotyps.lemonsqueezy.com/checkout/buy/31470257-06a8-4239-9d09-a3e119eed69e?enabled=1077127&checkout[discount_code]=LANCEMENT']);
    r = await call({ plan: 'studio' }, { fetchImpl: okFetch, apiKey: '' });
    check('sans clé API → repli public studio', r.headers.location, 'https://logotyps.lemonsqueezy.com/checkout/buy/31470257-06a8-4239-9d09-a3e119eed69e?enabled=1077131');
    r = await call({}, { fetchImpl: okFetch, apiKey: 'K' });
    check('sans plan → lifetime par défaut', JSON.parse(calls[calls.length - 1].init.body).data.relationships.variant.data.id, '1077127');
    r = await call({ plan: 'gold' }, { fetchImpl: okFetch, apiKey: 'K' });
    check('plan inconnu → 400', r.code, 400);
    r = await call({ plan: 'annual', code: 'x"; DROP' }, { fetchImpl: okFetch, apiKey: 'K' });
    check('code promo malformé ignoré', JSON.parse(calls[calls.length - 1].init.body).data.attributes.checkout_data, undefined);
    check('jamais mis en cache', /no-store/.test(r.headers['cache-control']), true);
    r = await call({ plan: 'annual' }, { fetchImpl: okFetch, apiKey: 'K' }, 'POST');
    check('POST → 405', r.code, 405);
    const plain = fakeRes(); await latest.default({ method: 'GET', query: {}, headers: {} }, plain);
    check('sans ?checkout=1, latest.js répond toujours le JSON de version', [plain.code, typeof plain.body.version], [200, 'string']);

    console.log(`\n${pass} OK, ${fail} echec(s)\n`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
