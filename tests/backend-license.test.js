// Logique de licence du backend (backend-trial/lib/license-flow.js) avec un faux
// Lemon Squeezy et un faux Redis : une instance par poste, jamais deux.
const path = require('path');
const { pathToFileURL } = require('url');
const crypto = require('crypto');

let pass = 0, fail = 0;
function check(label, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log((ok ? '  OK   ' : '  ECHEC') + ' | ' + label + (ok ? '' : `  (obtenu ${JSON.stringify(actual)}, attendu ${JSON.stringify(expected)})`));
    ok ? pass++ : fail++;
}

// Faux Redis
function fakeStore() {
    const m = new Map();
    return {
        m,
        get: async (k) => (m.has(k) ? m.get(k) : null),
        set: async (k, v) => { m.set(k, v); return 'OK'; },
        del: async (k) => (m.delete(k) ? 1 : 0),
        keys: async (pattern) => [...m.keys()].filter(k => k.startsWith(pattern.replace('*', '')))
    };
}

// Faux Lemon Squeezy : une clé, des instances nommées, compteur d'activations.
function fakeLemon({ keyStatus = 'active', limit = 3, instances = [], keyId = 42, validateInactiveAsInvalid = false, apiKey = true, testMode = false } = {}) {
    const calls = { validate: 0, activate: 0, deactivate: 0, listInstances: 0 };
    const state = { instances: instances.map(i => Object.assign({}, i)), nextId: 1, keyStatus, testMode };
    const meta = { variant_id: 2138292, customer_email: 'c@x.fr' };
    const lk = () => ({ id: keyId, status: state.keyStatus, activation_limit: limit, activation_usage: state.instances.length, test_mode: state.testMode });
    const keyError = () => state.keyStatus === 'disabled' ? 'This license key is disabled.' : state.keyStatus === 'expired' ? 'This license key has expired.' : state.keyStatus === 'missing' ? 'license_key not found.' : null;
    return {
        calls, state,
        hasApiKey: apiKey,
        validate: async (key, instanceId) => {
            calls.validate++;
            const ke = keyError();
            if (ke) return { ok: true, status: 400, data: { valid: false, error: ke } };
            if (instanceId) {
                const inst = state.instances.find(i => i.id === instanceId);
                if (!inst) return { ok: true, status: 404, data: { valid: false, error: 'Instance ID not found.' } };
                return { ok: true, status: 200, data: { valid: true, error: null, license_key: lk(), instance: { id: inst.id, name: inst.name }, meta } };
            }
            if (validateInactiveAsInvalid && state.instances.length === 0) return { ok: true, status: 400, data: { valid: false, error: 'This license key is not active.' } };
            return { ok: true, status: 200, data: { valid: true, error: null, license_key: lk(), instance: null, meta } };
        },
        activate: async (key, name) => {
            calls.activate++;
            const ke = keyError();
            if (ke) return { ok: true, status: 400, data: { activated: false, error: ke } };
            if (state.instances.length >= limit) return { ok: true, status: 400, data: { activated: false, error: 'This license key has reached the activation limit.', license_key: lk() } };
            const inst = { id: 'inst-' + (state.nextId++), name, createdAt: new Date(2026, 0, state.nextId).toISOString() };
            state.instances.push(inst);
            return { ok: true, status: 200, data: { activated: true, error: null, license_key: lk(), instance: { id: inst.id, name }, meta } };
        },
        deactivate: async (key, instanceId) => {
            calls.deactivate++;
            const idx = state.instances.findIndex(i => i.id === instanceId);
            if (idx < 0) return { ok: true, status: 404, data: { deactivated: false, error: 'Instance ID not found.' } };
            state.instances.splice(idx, 1);
            return { ok: true, status: 200, data: { deactivated: true, error: null } };
        },
        listInstances: async (id) => { calls.listInstances++; if (!apiKey) return null; return state.instances.map(i => ({ id: i.id, name: i.name, createdAt: i.createdAt })); }
    };
}

const quiet = { log() {}, warn() {}, error() {} };

(async function () {
    const flow = await import(pathToFileURL(path.join(__dirname, '..', 'backend-trial', 'lib', 'license-flow.js')).href);
    const lemon = await import(pathToFileURL(path.join(__dirname, '..', 'backend-trial', 'lib', 'lemonsqueezy.js')).href);
    const { activateLicense, validateLicense, deactivateLicense, revokeLicenseKey, verifyWebhookSignature, licenseKeyFromEvent } = flow;
    const KEY = '38b1460a-5104-4067-a91d-77b872934d51';
    const HW = 'HWID-aaaa', HW2 = 'HWID-bbbb';
    const deps = (ls, store, now) => ({ ls, store, now: now || (() => 1_700_000_000_000), log: quiet });

    console.log('\n--- Première activation : une instance, une seule ---');
    let ls = fakeLemon(), store = fakeStore();
    let r = await activateLicense({ licenseKey: KEY, email: 'e', hwid: HW }, deps(ls, store));
    check('200 success', [r.status, r.body.success, r.body.licenseType, r.body.reused], [200, true, 'lifetime', false]);
    check('1 activation chez LS', ls.calls.activate, 1);
    check('1 instance chez LS, nommée HWID', ls.state.instances.map(i => i.name), [HW]);
    let rec = JSON.parse(store.m.get('license:' + HW));
    check('instanceId mémorisé', rec.instanceId, 'inst-1');
    check('licenseKeyId mémorisé', rec.licenseKeyId, 42);

    console.log('\n--- Re-clic sur Activer, même poste : AUCUNE nouvelle instance ---');
    r = await activateLicense({ licenseKey: KEY, email: 'e', hwid: HW }, deps(ls, store));
    check('200 reused', [r.status, r.body.success, r.body.reused], [200, true, true]);
    check('toujours 1 activation', ls.calls.activate, 1);
    check('toujours 1 instance', ls.state.instances.length, 1);
    for (let i = 0; i < 5; i++) await activateLicense({ licenseKey: KEY, email: 'e', hwid: HW }, deps(ls, store));
    check('5 clics de plus : toujours 1 instance (avant le fix : 6 slots consommés)', ls.state.instances.length, 1);

    console.log('\n--- Redis perdu, instance encore chez LS : réutilisée, pas recréée ---');
    store = fakeStore();
    r = await activateLicense({ licenseKey: KEY, email: 'e', hwid: HW }, deps(ls, store));
    check('200 reused', [r.status, r.body.reused], [200, true]);
    check('pas d activation', ls.calls.activate, 1);
    check('instance retrouvée', JSON.parse(store.m.get('license:' + HW)).instanceId, 'inst-1');

    console.log('\n--- Instance supprimée depuis le dashboard LS : réactivation propre ---');
    ls.state.instances = [];
    r = await activateLicense({ licenseKey: KEY, email: 'e', hwid: HW }, deps(ls, store));
    check('200 nouvelle instance', [r.status, r.body.reused], [200, false]);
    check('2 activations au total', ls.calls.activate, 2);
    check('instanceId mis à jour', JSON.parse(store.m.get('license:' + HW)).instanceId, 'inst-2');

    console.log('\n--- Sans clé API (listInstances indisponible) : on active quand même ---');
    ls = fakeLemon({ apiKey: false }); store = fakeStore();
    r = await activateLicense({ licenseKey: KEY, email: 'e', hwid: HW }, deps(ls, store));
    check('200', [r.status, r.body.success], [200, true]);

    console.log('\n--- Clé jamais activée rapportée « not active » par validate : activate tranche ---');
    ls = fakeLemon({ validateInactiveAsInvalid: true }); store = fakeStore();
    r = await activateLicense({ licenseKey: KEY, email: 'e', hwid: HW }, deps(ls, store));
    check('activation réussie malgré validate', [r.status, r.body.success], [200, true]);

    console.log('\n--- Clés mortes : refus clair, aucune activation tentée ---');
    for (const [status, frag] of [['missing', 'introuvable'], ['disabled', 'désactivée'], ['expired', 'expiré']]) {
        ls = fakeLemon({ keyStatus: status }); store = fakeStore();
        r = await activateLicense({ licenseKey: KEY, email: 'e', hwid: HW }, deps(ls, store));
        check(status + ' → 400 message « ' + frag + ' »', [r.status, r.body.success, r.body.message.includes(frag)], [400, false, true]);
        check(status + ' → aucun activate', ls.calls.activate, 0);
    }

    console.log('\n--- Limite d activations atteinte ---');
    ls = fakeLemon({ limit: 1, instances: [{ id: 'other', name: 'HWID-autre', createdAt: '2026-01-01' }] }); store = fakeStore();
    r = await activateLicense({ licenseKey: KEY, email: 'e', hwid: HW }, deps(ls, store));
    check('400 + remède', [r.status, /Limite d'activations/.test(r.body.message), /Désactivez/.test(r.body.message)], [400, true, true]);
    check('rien en Redis', store.m.size, 0);

    console.log('\n--- Changement de HWID (MAJ Illustrator) : l ancienne instance est libérée ---');
    ls = fakeLemon({ limit: 1 }); store = fakeStore();
    await activateLicense({ licenseKey: KEY, email: 'e', hwid: HW }, deps(ls, store));
    r = await activateLicense({ licenseKey: KEY, email: 'e', hwid: HW2, previousHwid: HW }, deps(ls, store));
    check('réactivé sur le nouveau HWID malgré limite = 1', [r.status, r.body.success], [200, true]);
    check('instance unique, au nom du nouveau poste', ls.state.instances.map(i => i.name), [HW2]);
    check('ancien enregistrement Redis supprimé', store.m.has('license:' + HW), false);

    console.log('\n--- Clé collée avec des espaces ---');
    ls = fakeLemon(); store = fakeStore();
    r = await activateLicense({ licenseKey: '  ' + KEY + ' ', email: 'e', hwid: HW }, deps(ls, store));
    check('clé nettoyée', JSON.parse(store.m.get('license:' + HW)).licenseKey, KEY);

    console.log('\n--- validate : par instance ---');
    ls = fakeLemon(); store = fakeStore();
    await activateLicense({ licenseKey: KEY, email: 'e', hwid: HW }, deps(ls, store));
    const T0 = 1_700_000_000_000;
    r = await validateLicense({ hwid: HW }, deps(ls, store, () => T0 + 1000));
    check('valide', [r.status, r.body.valid, r.body.licenseType], [200, true, 'lifetime']);
    check('lastValidated rafraîchi', JSON.parse(store.m.get('license:' + HW)).lastValidated, T0 + 1000);
    check('activatedAt conservé', JSON.parse(store.m.get('license:' + HW)).activatedAt, T0);
    r = await validateLicense({ hwid: 'HWID-inconnu' }, deps(ls, store));
    check('poste inconnu', [r.status, r.body.valid], [200, false]);
    ls.state.instances = []; // désactivée depuis le dashboard
    r = await validateLicense({ hwid: HW }, deps(ls, store));
    check('instance disparue → invalide + message poste', [r.body.valid, /poste/.test(r.body.message)], [false, true]);
    check('enregistrement supprimé', store.m.has('license:' + HW), false);

    console.log('\n--- validate : clé révoquée ---');
    ls = fakeLemon(); store = fakeStore();
    await activateLicense({ licenseKey: KEY, email: 'e', hwid: HW }, deps(ls, store));
    ls.state.keyStatus = 'disabled';
    r = await validateLicense({ hwid: HW }, deps(ls, store));
    check('invalide, message révoquée', [r.body.valid, /révoquée/.test(r.body.message)], [false, true]);
    check('supprimé de Redis', store.m.has('license:' + HW), false);

    console.log('\n--- validate : enregistrement ancien sans instanceId → rattrapé ---');
    ls = fakeLemon({ instances: [{ id: 'old-1', name: HW, createdAt: '2026-01-01' }] }); store = fakeStore();
    await store.set('license:' + HW, JSON.stringify({ licenseKey: KEY, email: 'e', hwid: HW, licenseType: 'lifetime', activatedAt: T0 }));
    r = await validateLicense({ hwid: HW }, deps(ls, store));
    check('valide', r.body.valid, true);
    check('instanceId rattrapé', JSON.parse(store.m.get('license:' + HW)).instanceId, 'old-1');

    console.log('\n--- validate : Lemon Squeezy injoignable ---');
    ls = fakeLemon(); store = fakeStore();
    await activateLicense({ licenseKey: KEY, email: 'e', hwid: HW }, deps(ls, store));
    const down = Object.assign({}, ls, { validate: async () => { throw new Error('ECONNRESET'); } });
    r = await validateLicense({ hwid: HW }, deps(down, store, () => T0 + 3 * 24 * 3600 * 1000));
    check('3 jours : valide hors ligne', [r.body.valid, r.body.offline], [true, true]);
    r = await validateLicense({ hwid: HW }, deps(down, store, () => T0 + 8 * 24 * 3600 * 1000));
    check('8 jours : refusé', [r.body.valid, /Internet/.test(r.body.message)], [false, true]);

    console.log('\n--- deactivate ---');
    ls = fakeLemon(); store = fakeStore();
    await activateLicense({ licenseKey: KEY, email: 'e', hwid: HW }, deps(ls, store));
    r = await deactivateLicense({ licenseKey: KEY, hwid: HW }, deps(ls, store));
    check('200 success', [r.status, r.body.success, r.body.deleted], [200, true, true]);
    check('instance libérée chez LS', ls.state.instances.length, 0);
    check('Redis vidé', store.m.size, 0);
    r = await deactivateLicense({ licenseKey: KEY, hwid: HW }, deps(ls, store));
    check('déjà désactivé → 200 idempotent, rien supprimé', [r.status, r.body.success, r.body.deleted, r.body.released], [200, true, false, false]);
    // Enregistrement serveur disparu (clé de test refusée, révocation) mais instance encore
    // chez LS au nom du poste : succès + instance libérée.
    ls = fakeLemon({ instances: [{ id: 'orph-1', name: HW, createdAt: '2026-01-01' }] }); store = fakeStore();
    r = await deactivateLicense({ licenseKey: KEY, hwid: HW }, deps(ls, store));
    check('sans enregistrement : succès et instance orpheline libérée', [r.status, r.body.success, r.body.released], [200, true, true]);
    check('instance retirée chez LS', ls.state.instances.length, 0);
    await activateLicense({ licenseKey: KEY, email: 'e', hwid: HW }, deps(ls, store));
    ls.state.instances = []; // instance déjà partie côté LS
    r = await deactivateLicense({ licenseKey: KEY, hwid: HW }, deps(ls, store));
    check('instance déjà absente → succès quand même', [r.status, r.body.success], [200, true]);
    check('Redis vidé', store.m.size, 0);

    console.log('\n--- revokeLicenseKey (webhook) ---');
    ls = fakeLemon({ limit: 5 }); store = fakeStore();
    await activateLicense({ licenseKey: KEY, email: 'e', hwid: HW }, deps(ls, store));
    await activateLicense({ licenseKey: KEY, email: 'e', hwid: HW2 }, deps(ls, store));
    await store.set('license:HWID-autre-cle', JSON.stringify({ licenseKey: 'autre', instanceId: 'x' }));
    const n = await revokeLicenseKey(KEY, deps(ls, store), 'order_refunded');
    check('2 postes révoqués', n, 2);
    check('instances LS libérées', ls.state.instances.length, 0);
    check('autre clé intacte', store.m.has('license:HWID-autre-cle'), true);

    console.log('\n--- Signature webhook ---');
    const secret = 's3cret';
    const body = Buffer.from('{"meta":{"event_name":"order_refunded"}}');
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    check('bonne signature', verifyWebhookSignature(body, sig, secret), true);
    check('majuscules tolérées', verifyWebhookSignature(body, sig.toUpperCase(), secret), true);
    check('mauvais secret', verifyWebhookSignature(body, sig, 'autre'), false);
    check('corps modifié', verifyWebhookSignature(Buffer.from('{}'), sig, secret), false);
    check('signature absente', verifyWebhookSignature(body, undefined, secret), false);
    check('longueur différente', verifyWebhookSignature(body, 'abc', secret), false);
    check('secret absent', verifyWebhookSignature(body, sig, ''), false);

    console.log('\n--- licenseKeyFromEvent ---');
    check('order_refunded (first_order_item)', licenseKeyFromEvent({ meta: { event_name: 'order_refunded' }, data: { attributes: { first_order_item: { license_key: 'K1' } } } }), 'K1');
    check('order_refunded (license_keys[])', licenseKeyFromEvent({ meta: { event_name: 'order_refunded' }, data: { attributes: { license_keys: ['K2'] } } }), 'K2');
    check('subscription_cancelled', licenseKeyFromEvent({ meta: { event_name: 'subscription_cancelled' }, data: { attributes: { license_key: 'K3' } } }), 'K3');
    check('license_key_updated', licenseKeyFromEvent({ meta: { event_name: 'license_key_updated' }, data: { attributes: { key: 'K4', status: 'disabled' } } }), 'K4');
    check('inconnu', licenseKeyFromEvent({ meta: { event_name: 'order_created' }, data: { attributes: {} } }), null);

    console.log('\n--- humanizeLemonError ---');
    check('limite', /Limite/.test(lemon.humanizeLemonError('This license key has reached the activation limit.')), true);
    check('introuvable', /introuvable/.test(lemon.humanizeLemonError('license_key not found.')), true);
    check('instance not found n est PAS « clé introuvable »', /introuvable/.test(lemon.humanizeLemonError('Instance ID not found.')), false);
    check('inconnu → texte LS', lemon.humanizeLemonError('Something else'), 'Something else');
    check('vide → fallback', lemon.humanizeLemonError('', 'Défaut'), 'Défaut');

    console.log('\n--- createLemonClient : requêtes réellement émises ---');
    const seen = [];
    const client = lemon.createLemonClient({ apiKey: 'K', fetchImpl: async (url, init) => { seen.push({ url, init }); return { ok: true, json: async () => ({ data: [{ attributes: { identifier: 'i1', name: 'n', created_at: 'd' } }] }) }; } });
    await client.validate(KEY, 'inst');
    check('validate → license_key + instance_id', JSON.parse(seen[0].init.body), { license_key: KEY, instance_id: 'inst' });
    await client.validate(KEY);
    check('validate sans instance → license_key seul', JSON.parse(seen[1].init.body), { license_key: KEY });
    check('License API : pas d Authorization', seen[1].init.headers.Authorization, undefined);
    const inst = await client.listInstances(42);
    check('listInstances → identifier comme id', inst, [{ id: 'i1', name: 'n', createdAt: 'd' }]);
    check('listInstances : Bearer + filtre', [seen[2].init.headers.Authorization, /license-key-instances\?filter\[license_key_id\]=42/.test(seen[2].url)], ['Bearer K', true]);
    const noKey = lemon.createLemonClient({ apiKey: '', fetchImpl: async () => { throw new Error('ne doit pas être appelé'); } });
    check('sans clé API → null sans appel', await noKey.listInstances(42), null);

    console.log('\n--- Clé de mode test : refusée à l activation et à la vérification ---');
    ls = fakeLemon({ testMode: true }); store = fakeStore();
    r = await activateLicense({ licenseKey: KEY, email: 'e', hwid: HW }, deps(ls, store));
    check('activation refusée (400) avec le message mode test', [r.status, r.body.success, /mode test/.test(r.body.message)], [400, false, true]);
    check('aucune instance créée chez LS', ls.state.instances.length, 0);
    check('rien en Redis', store.m.size, 0);
    // Clé activée à l époque du mode test, toujours enregistrée : la vérification périodique la refuse.
    ls = fakeLemon(); store = fakeStore();
    await activateLicense({ licenseKey: KEY, email: 'e', hwid: HW }, deps(ls, store));
    ls.state.testMode = true;
    r = await validateLicense({ hwid: HW }, deps(ls, store));
    check('vérification : invalide + message mode test', [r.status, r.body.valid, /mode test/.test(r.body.message)], [200, false, true]);
    check('enregistrement supprimé (retour en essai)', store.m.has('license:' + HW), false);
    // Re-clic sur Activer avec l enregistrement encore présent : refusé aussi, enregistrement purgé.
    ls = fakeLemon(); store = fakeStore();
    await activateLicense({ licenseKey: KEY, email: 'e', hwid: HW }, deps(ls, store));
    ls.state.testMode = true;
    r = await activateLicense({ licenseKey: KEY, email: 'e', hwid: HW }, deps(ls, store));
    check('réactivation refusée (400)', [r.status, /mode test/.test(r.body.message)], [400, true]);
    check('enregistrement purgé', store.m.has('license:' + HW), false);
    // Une clé réelle n est pas concernée.
    ls = fakeLemon(); store = fakeStore();
    r = await activateLicense({ licenseKey: KEY, email: 'e', hwid: HW }, deps(ls, store));
    check('clé réelle toujours acceptée', [r.status, r.body.success], [200, true]);

    console.log(`\n${pass} OK, ${fail} echec(s)\n`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
