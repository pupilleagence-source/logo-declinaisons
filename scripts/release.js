#!/usr/bin/env node
// Sortir une version : bump des chaines de version, changelog, manifeste de mise a jour
// a chaud (signe), tests, commit, push, declenchement du workflow GitHub Actions qui
// construit et publie les installeurs.
//
//   npm run release -- 1.4.0 "Premiere ligne du changelog" "Deuxieme ligne"
//   npm run release -- 1.4.0 "..." --deploy             attend la release GitHub puis
//                                                        deploie le backend (vercel --prod)
//   npm run release -- 1.4.0 "..." --require-installer  cette version ne peut PAS etre
//                                                        appliquee a chaud (installeur,
//                                                        postinstall, templates...)
//
// Sans --deploy, une fois la release en ligne, lancer
//   cd backend-trial && vercel --prod
// pour que les installations existantes voient la mise a jour.
//
// Deux phases : tout est CALCULE et verifie en memoire d'abord ; rien n'est ecrit sur
// le disque tant qu'un seul anchor manque ou que latest.js ne parse pas. Un echec avant
// le commit laisse donc l'arbre git intact et le script relancable tel quel.
//
// Mise a jour a chaud (voir js/auto-updater.js) : les fichiers de HOT_FILES sont copies
// dans backend-trial/distribution/ (normalises en LF : leur SHA-256 est alors celui du
// blob git, et celui des fichiers livres par les installeurs) et decrits dans
// backend-trial/updates/manifest.json, signe avec apple-cert/update-manifest.key.
// Le panneau verifie la signature avec la cle publique embarquee dans
// js/auto-updater.js : sans la cle privee, pas de release.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PRIVATE_KEY_PATH = path.join(ROOT, 'apple-cert', 'update-manifest.key');
const DISTRIBUTION_DIR = path.join(ROOT, 'backend-trial', 'distribution');
const MANIFEST_PATH = path.join(ROOT, 'backend-trial', 'updates', 'manifest.json');

// Ce que la mise a jour a chaud couvre : tout ce que le panneau charge. Les templates
// InDesign, les PSD (400 Mo) et le binaire de notarisation macOS restent du ressort de
// l'installeur ; un changement de ces fichiers doit passer par --require-installer,
// et release.js le detecte pour les templates via assetsFingerprint.
const HOT_FILES = { roots: ['index.html', 'CSXS', 'css', 'js', 'jsx', 'lib', 'media'] };
const TEXT_EXT = new Set(['.js', '.jsx', '.html', '.css', '.xml', '.json', '.svg', '.txt']);
const ASSET_GLOBS = ['templates/template-1.idml', 'templates/mockups'];

// --- fonctions pures (testees par tests/release-script.test.js) ----------------

// Remplace version / releaseDate / changelog dans le source de latest.js.
// Le tableau changelog est reconnu par son crochet fermant SEUL sur sa ligne : un "]"
// dans une ligne de changelog (ex. "[BETA] …") ne peut donc pas tronquer le match.
// Les remplacements passent par des fonctions : "$'" ou "$&" dans une ligne ne sont
// jamais interpretes par String.replace.
function renderLatest(src, version, date, lines) {
    const eol = src.includes('\r\n') ? '\r\n' : '\n';
    let hits = 0;
    let out = src.replace(/version:\s*'[^']*'/, () => { hits++; return "version: '" + version + "'"; });
    out = out.replace(/releaseDate:\s*'[^']*'/, () => { hits++; return "releaseDate: '" + date + "'"; });
    out = out.replace(/changelog:\s*\[[\s\S]*?\r?\n\s*\]/, () => {
        hits++;
        return 'changelog: [' + eol + lines.map(l => '            ' + JSON.stringify(l)).join(',' + eol) + eol + '        ]';
    });
    if (hits !== 3) throw new Error('latest.js : ' + hits + '/3 champs reconnus (version, releaseDate, changelog)');
    return out;
}

// Calcule le contenu bumpe de chaque fichier, sans rien ecrire. Leve une erreur qui
// nomme le fichier et l'anchor manquant si une occurrence attendue est absente.
function computeBumps(root, current, version) {
    const spec = [
        ['CSXS/manifest.xml', [['ExtensionBundleVersion="' + current + '"', 'ExtensionBundleVersion="' + version + '"', 1],
                               ['Version="' + current + '" />', 'Version="' + version + '" />', 1]]],
        ['package.json',      [['"version": "' + current + '"', '"version": "' + version + '"', 3]]],
        ['js/updater.js',     [["CURRENT_VERSION: '" + current + "'", "CURRENT_VERSION: '" + version + "'", 1]]],
        ['jsx/hostscript.jsx', [["var HOSTSCRIPT_VERSION = '" + current + "';", "var HOSTSCRIPT_VERSION = '" + version + "';", 1]]],
        ['installer.iss',     [['#define MyAppVersion "' + current + '"', '#define MyAppVersion "' + version + '"', 1]]],
        ['installers/mac/build-pkg.sh', [['VERSION="${VERSION:-' + current + '}"', 'VERSION="${VERSION:-' + version + '}"', 1]]],
        ['.github/workflows/build-installers.yml', [["default: '" + current + "'", "default: '" + version + "'", 1]]],
    ];
    const results = [];
    for (const [rel, pairs] of spec) {
        let s = fs.readFileSync(path.join(root, rel), 'utf8');
        for (const [from, to, expected] of pairs) {
            const n = s.split(from).length - 1;
            if (n !== expected) {
                throw new Error(rel + ' : "' + from + '" trouve ' + n + ' fois, attendu ' + expected
                    + ' (ce fichier n\'est pas en ' + current + ' : l\'aligner a la main, puis relancer)');
            }
            s = s.split(from).join(to);
        }
        results.push({ rel, content: s });
    }
    return results;
}

// Forme canonique signee : cles triees recursivement, sans espaces, `signature` exclue.
// DOIT rester identique a AutoUpdater.canonicalManifest() (js/auto-updater.js).
function canonicalManifest(manifest) {
    function sort(v) {
        if (Array.isArray(v)) return v.map(sort);
        if (v && typeof v === 'object') {
            const out = {};
            Object.keys(v).sort().forEach(k => { out[k] = sort(v[k]); });
            return out;
        }
        return v;
    }
    const copy = Object.assign({}, manifest);
    delete copy.signature;
    return JSON.stringify(sort(copy));
}

function signManifest(manifest, privateKeyPem) {
    const s = crypto.createSign('RSA-SHA256');
    s.update(canonicalManifest(manifest), 'utf8');
    return Object.assign({}, manifest, { signature: s.sign(privateKeyPem, 'base64') });
}

function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

// Liste recursive des fichiers (chemins relatifs a root, slashes), triee.
function listFiles(root, roots) {
    const out = [];
    const walk = (rel) => {
        const full = path.join(root, rel);
        if (!fs.existsSync(full)) return;
        const st = fs.statSync(full);
        if (st.isDirectory()) {
            for (const name of fs.readdirSync(full).sort()) walk(rel ? rel + '/' + name : name);
        } else {
            out.push(rel.replace(/\\/g, '/'));
        }
    };
    for (const r of roots) walk(r);
    return out;
}

// Contenu tel qu'il sera servi ET hache : fichiers texte normalises en LF.
function distributionBytes(rel, buf) {
    if (!TEXT_EXT.has(path.extname(rel).toLowerCase())) return buf;
    return Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
}

// Empreinte des fichiers que la mise a jour a chaud ne couvre pas (templates, PSD).
function assetsFingerprint(root, globs) {
    const files = listFiles(root, globs);
    const h = crypto.createHash('sha256');
    for (const rel of files) {
        h.update(rel + '\n');
        h.update(sha256(fs.readFileSync(path.join(root, rel))) + '\n');
    }
    return h.digest('hex');
}

// Construit le manifeste (non signe) et la liste { rel, bytes } a deposer dans
// distribution/. `previous` est le manifeste precedent (ou null) : si l'empreinte des
// assets a change, ou si requireInstaller, hotUpdateFrom = version (tout le monde
// repasse par l'installeur) ; sinon la valeur precedente est conservee.
function buildManifest(root, opts) {
    const { version, date, changelog, previous, requireInstaller, fingerprint } = opts;
    const rels = listFiles(root, HOT_FILES.roots).filter(rel => !/\.(backup|pending)$/.test(rel) && !/(^|\/)\./.test(rel)).sort();
    const files = [];
    const payload = [];
    for (const rel of rels) {
        const bytes = distributionBytes(rel, fs.readFileSync(path.join(root, rel)));
        files.push({ path: rel, sha256: sha256(bytes), size: bytes.length });
        payload.push({ rel, bytes });
    }
    let hotUpdateFrom;
    if (requireInstaller || !previous || !previous.hotUpdateFrom || previous.assetsFingerprint !== fingerprint) hotUpdateFrom = version;
    else hotUpdateFrom = previous.hotUpdateFrom;
    const manifest = { version, releaseDate: date, changelog, hotUpdateFrom, assetsFingerprint: fingerprint, restartRequired: true, files };
    return { manifest, payload };
}

function nodeSleep(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// --- execution --------------------------------------------------------------------
function main() {
    const argv = process.argv.slice(2);
    const flags = new Set(argv.filter(a => a.startsWith('--')));
    const [version, ...changelog] = argv.filter(a => !a.startsWith('--'));
    const wantDeploy = flags.has('--deploy');
    const requireInstaller = flags.has('--require-installer');
    function die(msg) { console.error('\n  ERREUR : ' + msg + '\n'); process.exit(1); }
    function sh(cmd, cwd) { return execSync(cmd, { cwd: cwd || ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim(); }

    for (const f of flags) if (f !== '--deploy' && f !== '--require-installer') die('option inconnue : ' + f);
    if (!version || !/^\d+\.\d+\.\d+$/.test(version)) die('version attendue au format x.y.z, ex. : npm run release -- 1.4.0 "changement 1" "changement 2"');
    if (!changelog.length) die('au moins une ligne de changelog est requise (elle s\'affiche dans la modale de mise a jour du panneau)');
    if (sh('git branch --show-current') !== 'master') die('se placer sur master avant de sortir une version');
    if (sh('git status --porcelain')) die('arbre git sale : committer ou remiser avant de sortir une version');
    if (!fs.existsSync(PRIVATE_KEY_PATH)) die('cle de signature du manifeste introuvable : ' + PRIVATE_KEY_PATH + '\n  Sans elle, les installations existantes ne peuvent pas verifier la mise a jour a chaud.');

    const current = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
    if (current === version) die('la version ' + version + ' est deja celle du repo');
    console.log('\n  ' + current + '  ->  ' + version + (requireInstaller ? '   (installeur obligatoire)' : '') + '\n');

    // Phase 1 : tout calculer et verifier en memoire.
    const date = new Date().toISOString().slice(0, 10);
    let files, manifest, payload;
    try {
        files = computeBumps(ROOT, current, version);
        const latestRel = 'backend-trial/api/version/latest.js';
        const latest = renderLatest(fs.readFileSync(path.join(ROOT, latestRel), 'utf8'), version, date, changelog);
        execSync('node --input-type=module --check', { input: latest, stdio: ['pipe', 'ignore', 'inherit'] });
        files.push({ rel: latestRel, content: latest });

        // Le manifeste decrit les fichiers BUMPES : on hache le contenu calcule, pas le disque.
        console.log('  empreinte des templates et mockups (400 Mo, quelques secondes)...');
        const fingerprint = assetsFingerprint(ROOT, ASSET_GLOBS);
        const previous = fs.existsSync(MANIFEST_PATH) ? JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) : null;
        const bumped = new Map(files.map(f => [f.rel, f.content]));
        const realRead = fs.readFileSync;
        const built = withPatchedReads(bumped, () => buildManifest(ROOT, { version, date, changelog, previous, requireInstaller, fingerprint }));
        if (fs.readFileSync !== realRead) throw new Error('fs.readFileSync non restaure');
        const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
        manifest = signManifest(built.manifest, privateKey);
        payload = built.payload;

        // La signature doit passer avec la cle publique EMBARQUEE dans le panneau,
        // sinon aucune installation ne l'acceptera.
        const AutoUpdater = require(path.join(ROOT, 'js', 'auto-updater.js'));
        if (!AutoUpdater.verifyManifestSignature(manifest)) throw new Error('la cle privee ne correspond pas a AutoUpdater.PUBLIC_KEY_PEM');
        for (const f of manifest.files) if (!AutoUpdater.isAllowedPath(f.path)) throw new Error('chemin refuse par le client : ' + f.path);
    } catch (e) {
        die((e.message || String(e)) + '\n  Rien n\'a ete modifie.');
    }
    console.log('  manifeste : ' + manifest.files.length + ' fichiers, hotUpdateFrom = ' + manifest.hotUpdateFrom
        + (manifest.hotUpdateFrom === version ? '  (les versions < ' + version + ' passeront par l\'installeur)' : ''));

    // Phase 2 : ecrire, tester.
    for (const f of files) { fs.writeFileSync(path.join(ROOT, f.rel), f.content); console.log('  bump  ' + f.rel); }
    fs.rmSync(DISTRIBUTION_DIR, { recursive: true, force: true });
    for (const p of payload) {
        const dest = path.join(DISTRIBUTION_DIR, p.rel);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, p.bytes);
    }
    fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
    console.log('  sync  backend-trial/distribution/ (' + payload.length + ' fichiers) + backend-trial/updates/manifest.json');
    console.log('\n  npm test');
    try { execSync('npm test', { cwd: ROOT, stdio: 'inherit' }); }
    catch (e) { die('npm test en echec. Les fichiers sont bumpes mais rien n\'est committe : `git checkout -- . && git clean -fd backend-trial` pour revenir en arriere.'); }

    // Phase 3 : commit, push, workflow. Apres le commit, tout echec imprime ce qui reste a faire.
    sh('git add -A');
    sh('git commit -q -m "Release v' + version + '"');
    console.log('\n  commit OK');
    const remaining = [
        '    git push origin master',
        '    gh workflow run build-installers.yml -f version=' + version + ' -f publish=true',
    ];
    try {
        sh('git push -q origin master'); remaining.shift();
        sh('gh workflow run build-installers.yml -f version=' + version + ' -f publish=true'); remaining.shift();
    } catch (e) {
        die('le commit "Release v' + version + '" existe localement, mais il reste a faire :\n' + remaining.join('\n')
            + '\n  puis, la release en ligne :  cd backend-trial && vercel --prod');
    }

    let run = '(voir https://github.com/pupilleagence-source/logo-declinaisons/actions)';
    let runId = '';
    try {
        nodeSleep(8000);
        const info = JSON.parse(sh('gh run list --workflow=build-installers.yml --limit 1 --json url,databaseId') || '[]')[0];
        if (info) { run = info.url; runId = String(info.databaseId); }
    } catch (e) {}

    console.log(`
  Workflow lance : ${run}
  (5 a 40 min : build Windows, build + notarisation macOS, publication)

  Quand la release est en ligne :
    https://github.com/pupilleagence-source/logo-declinaisons-releases/releases/tag/v${version}
`);

    if (!wantDeploy) {
        console.log(`  Puis, pour que les installations existantes voient la mise a jour :
    cd backend-trial && vercel --prod
`);
        return;
    }

    // --deploy : attendre la release GitHub (les clients 1.3.0 y sont envoyes par
    // latest.js), puis deployer le backend qui sert manifeste + fichiers.
    if (!runId) die('impossible d\'identifier le run GitHub ; deployer a la main une fois la release en ligne : cd backend-trial && vercel --prod');
    console.log('  attente de la fin du workflow ' + runId + '...');
    try { execSync('gh run watch ' + runId + ' --exit-status --interval 30', { cwd: ROOT, stdio: 'inherit' }); }
    catch (e) { die('le workflow a echoue : le backend n\'a PAS ete deploye. Corriger, relancer le workflow, puis : cd backend-trial && vercel --prod'); }
    console.log('\n  release en ligne, deploiement du backend...');
    try { execSync('vercel --prod --yes', { cwd: path.join(ROOT, 'backend-trial'), stdio: 'inherit' }); }
    catch (e) { die('vercel --prod en echec : relancer a la main dans backend-trial/'); }
    console.log('\n  backend deploye : les installations >= 1.4.0 recevront la mise a jour a chaud, les autres l\'installeur.\n');
}

// buildManifest lit le disque ; pendant la phase 1 les fichiers bumpes n'y sont pas
// encore. On intercepte fs.readFileSync le temps de la construction.
function withPatchedReads(bumped, fn) {
    const real = fs.readFileSync;
    fs.readFileSync = function (p, ...rest) {
        const rel = path.relative(ROOT, String(p)).replace(/\\/g, '/');
        if (bumped.has(rel) && rest.length === 0) return Buffer.from(bumped.get(rel), 'utf8');
        return real.call(fs, p, ...rest);
    };
    try { return fn(); } finally { fs.readFileSync = real; }
}

if (require.main === module) {
    main();
} else {
    module.exports = { renderLatest, computeBumps, canonicalManifest, signManifest, buildManifest, distributionBytes, assetsFingerprint, listFiles, HOT_FILES };
}
