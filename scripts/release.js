#!/usr/bin/env node
// Sortir une version : bump des 7 chaines de version, changelog, tests, commit, push,
// declenchement du workflow GitHub Actions qui construit et publie les installeurs.
//
//   npm run release -- 1.3.0 "Premiere ligne du changelog" "Deuxieme ligne"
//
// Ne deploie PAS le backend : une fois la release en ligne, lancer
//   cd backend-trial && vercel --prod
// pour que les installations existantes voient la modale de mise a jour.
//
// Deux phases : tout est CALCULE et verifie en memoire d'abord ; rien n'est ecrit sur
// le disque tant qu'un seul anchor manque ou que latest.js ne parse pas. Un echec avant
// le commit laisse donc l'arbre git intact et le script relancable tel quel.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

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

function nodeSleep(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// --- execution --------------------------------------------------------------------
function main() {
    const [, , version, ...changelog] = process.argv;
    function die(msg) { console.error('\n  ERREUR : ' + msg + '\n'); process.exit(1); }
    function sh(cmd) { return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim(); }

    if (!version || !/^\d+\.\d+\.\d+$/.test(version)) die('version attendue au format x.y.z, ex. : npm run release -- 1.3.0 "changement 1" "changement 2"');
    if (!changelog.length) die('au moins une ligne de changelog est requise (elle s\'affiche dans la modale de mise a jour du panneau)');
    if (sh('git branch --show-current') !== 'master') die('se placer sur master avant de sortir une version');
    if (sh('git status --porcelain')) die('arbre git sale : committer ou remiser avant de sortir une version');

    const current = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
    if (current === version) die('la version ' + version + ' est deja celle du repo');
    console.log('\n  ' + current + '  ->  ' + version + '\n');

    // Phase 1 : tout calculer et verifier en memoire.
    let files;
    try {
        files = computeBumps(ROOT, current, version);
        const latestRel = 'backend-trial/api/version/latest.js';
        const latest = renderLatest(fs.readFileSync(path.join(ROOT, latestRel), 'utf8'), version, new Date().toISOString().slice(0, 10), changelog);
        execSync('node --input-type=module --check', { input: latest, stdio: ['pipe', 'ignore', 'inherit'] });
        files.push({ rel: latestRel, content: latest });
    } catch (e) {
        die((e.message || String(e)) + '\n  Rien n\'a ete modifie.');
    }

    // Phase 2 : ecrire, tester.
    for (const f of files) { fs.writeFileSync(path.join(ROOT, f.rel), f.content); console.log('  bump  ' + f.rel); }
    console.log('\n  npm test');
    try { execSync('npm test', { cwd: ROOT, stdio: 'inherit' }); }
    catch (e) { die('npm test en echec. Les fichiers sont bumpes mais rien n\'est committe : `git checkout -- .` pour revenir en arriere.'); }

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
    try { nodeSleep(8000); run = sh('gh run list --workflow=build-installers.yml --limit 1 --json url --jq ".[0].url"') || run; } catch (e) {}

    console.log(`
  Workflow lance : ${run}
  (5 a 40 min : build Windows, build + notarisation macOS, publication)

  Quand la release est en ligne :
    https://github.com/pupilleagence-source/logo-declinaisons-releases/releases/tag/v${version}

  Puis, pour que les installations existantes voient la mise a jour :
    cd backend-trial && vercel --prod
`);
}

if (require.main === module) {
    main();
} else {
    module.exports = { renderLatest, computeBumps };
}
