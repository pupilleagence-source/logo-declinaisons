const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('================================================');
console.log('  Construction du package ZXP');
console.log('  Logo Déclinaisons v1.0.0');
console.log('================================================\n');

// Chemins
const certPath = path.join(__dirname, 'certificate.p12');
const outputZXP = path.join(__dirname, 'dist', 'LogoDeclinaisons-1.0.0.zxp');
const password = 'logodeclinaisons2024'; // Mot de passe du certificat

// Créer le dossier dist s'il n'existe pas
if (!fs.existsSync(path.join(__dirname, 'dist'))) {
    fs.mkdirSync(path.join(__dirname, 'dist'));
    console.log('✓ Dossier dist créé');
}

// 1. Créer un certificat auto-signé (si n'existe pas)
if (!fs.existsSync(certPath)) {
    console.log('\n📜 Création du certificat auto-signé...');

    const certCmd = `npx zxp-sign-cmd -selfSignedCert FR "IDF" "Logo Declinaisons" "LogoDeclinaisons" "${password}" "${certPath}"`;

    try {
        execSync(certCmd, { stdio: 'inherit' });
        console.log('✓ Certificat créé : certificate.p12');
    } catch (error) {
        console.error('❌ Erreur lors de la création du certificat');
        process.exit(1);
    }
} else {
    console.log('✓ Certificat existant trouvé');
}

// 2. Créer le package ZXP
console.log('\n📦 Création du package ZXP...');

// Liste des fichiers/dossiers à inclure
const filesToInclude = [
    'index.html',
    'CSXS',
    'css',
    'js',
    'jsx',
    'lib',
    'media'
];

// Vérifier que tous les fichiers existent
let allFilesExist = true;
filesToInclude.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
        console.error(`❌ Fichier manquant : ${file}`);
        allFilesExist = false;
    }
});

if (!allFilesExist) {
    console.error('\n❌ Des fichiers nécessaires sont manquants');
    process.exit(1);
}

// Créer le ZXP
const signCmd = `npx zxp-sign-cmd -sign "${__dirname}" "${outputZXP}" "${certPath}" "${password}" -tsa http://time.certum.pl/`;

try {
    execSync(signCmd, { stdio: 'inherit' });
    console.log(`\n✅ ZXP créé avec succès !`);
    console.log(`📍 Emplacement : ${outputZXP}`);

    // Afficher la taille du fichier
    const stats = fs.statSync(outputZXP);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📊 Taille : ${fileSizeMB} MB`);

} catch (error) {
    console.error('\n❌ Erreur lors de la création du ZXP');
    console.error(error.message);
    process.exit(1);
}

console.log('\n================================================');
console.log('  DISTRIBUTION');
console.log('================================================');
console.log('\nCe fichier ZXP fonctionne sur Windows ET Mac !');
console.log('\nInstallation pour vos utilisateurs :');
console.log('1. Télécharger ZXP Installer (aescripts.com/learn/zxp-installer)');
console.log('2. Glisser-déposer le fichier .zxp dedans');
console.log('3. Redémarrer Illustrator\n');
