/**
 * Système de mise à jour automatique du plugin
 * Télécharge et remplace les fichiers du plugin depuis le serveur
 */

const AutoUpdater = {
    API_URL: 'https://logotyps.vercel.app/api/updates',

    // Fonction utilitaire pour obtenir le chemin de l'extension
    getExtensionPath: function() {
        // Dans CEP, __dirname pointe vers le dossier de l'extension
        if (typeof __dirname !== 'undefined') {
            return __dirname;
        }
        // Fallback si __dirname n'est pas disponible
        return window.cep.fs.showOpenDialog(false, false, "Select Extension Folder", "", []).data;
    },

    /**
     * Télécharge un fichier depuis une URL
     * @param {string} url - URL du fichier
     * @param {string} destPath - Chemin de destination
     * @returns {Promise<boolean>} - Succès ou échec
     */
    downloadFile: async function(url, destPath) {
        return new Promise((resolve, reject) => {
            try {
                const fs = require('fs');
                const path = require('path');
                const https = require('https');

                // Créer le dossier de destination si nécessaire
                const destDir = path.dirname(destPath);
                if (!fs.existsSync(destDir)) {
                    fs.mkdirSync(destDir, { recursive: true });
                }

                const file = fs.createWriteStream(destPath);

                https.get(url, (response) => {
                    if (response.statusCode !== 200) {
                        reject(new Error(`Failed to download: ${response.statusCode}`));
                        return;
                    }

                    response.pipe(file);

                    file.on('finish', () => {
                        file.close();
                        console.log(`✓ Downloaded: ${path.basename(destPath)}`);
                        resolve(true);
                    });
                }).on('error', (err) => {
                    fs.unlinkSync(destPath);
                    reject(err);
                });

                file.on('error', (err) => {
                    fs.unlinkSync(destPath);
                    reject(err);
                });
            } catch (error) {
                reject(error);
            }
        });
    },

    /**
     * Calcule le checksum SHA-256 d'un fichier
     * @param {string} filePath - Chemin du fichier
     * @returns {Promise<string>} - Checksum en hex
     */
    calculateChecksum: async function(filePath) {
        return new Promise((resolve, reject) => {
            try {
                const fs = require('fs');
                const crypto = require('crypto');

                const hash = crypto.createHash('sha256');
                const stream = fs.createReadStream(filePath);

                stream.on('data', (data) => hash.update(data));
                stream.on('end', () => resolve(hash.digest('hex')));
                stream.on('error', reject);
            } catch (error) {
                reject(error);
            }
        });
    },

    /**
     * Sauvegarde un fichier existant
     * @param {string} filePath - Chemin du fichier à sauvegarder
     * @returns {string|null} - Chemin de la sauvegarde ou null si erreur
     */
    backupFile: function(filePath) {
        try {
            const fs = require('fs');
            const path = require('path');

            if (!fs.existsSync(filePath)) {
                return null; // Fichier n'existe pas, pas besoin de backup
            }

            const backupPath = filePath + '.backup';
            fs.copyFileSync(filePath, backupPath);
            console.log(`✓ Backup created: ${path.basename(backupPath)}`);
            return backupPath;
        } catch (error) {
            console.error(`❌ Failed to backup: ${error.message}`);
            return null;
        }
    },

    /**
     * Remplace un fichier en toute sécurité
     * @param {string} sourcePath - Fichier source (nouveau)
     * @param {string} destPath - Fichier de destination (à remplacer)
     * @returns {Promise<'SUCCESS'|'RESTART_REQUIRED'|'FAILED'>}
     */
    replaceFile: async function(sourcePath, destPath) {
        return new Promise((resolve) => {
            try {
                const fs = require('fs');
                const path = require('path');

                // Vérifier que le fichier source existe
                if (!fs.existsSync(sourcePath)) {
                    throw new Error('Source file does not exist');
                }

                // Créer le dossier de destination si nécessaire
                const destDir = path.dirname(destPath);
                if (!fs.existsSync(destDir)) {
                    fs.mkdirSync(destDir, { recursive: true });
                }

                // Tenter le remplacement direct
                try {
                    if (fs.existsSync(destPath)) {
                        fs.unlinkSync(destPath);
                    }
                    fs.copyFileSync(sourcePath, destPath);
                    console.log(`✓ Replaced: ${path.basename(destPath)}`);
                    resolve('SUCCESS');
                } catch (error) {
                    // Fichier probablement locké (Windows)
                    if (error.code === 'EBUSY' || error.code === 'EPERM') {
                        console.warn(`⚠️ File locked: ${path.basename(destPath)} - restart required`);

                        // Marquer pour remplacement au prochain démarrage
                        const pendingPath = destPath + '.pending';
                        fs.copyFileSync(sourcePath, pendingPath);
                        resolve('RESTART_REQUIRED');
                    } else {
                        throw error;
                    }
                }
            } catch (error) {
                console.error(`❌ Failed to replace file: ${error.message}`);
                resolve('FAILED');
            }
        });
    },

    /**
     * Restaure un fichier depuis sa sauvegarde
     * @param {string} backupPath - Chemin de la sauvegarde
     * @param {string} originalPath - Chemin du fichier original
     * @returns {boolean} - Succès ou échec
     */
    rollback: function(backupPath, originalPath) {
        try {
            const fs = require('fs');

            if (!fs.existsSync(backupPath)) {
                console.warn('⚠️ Backup file not found, cannot rollback');
                return false;
            }

            if (fs.existsSync(originalPath)) {
                fs.unlinkSync(originalPath);
            }

            fs.copyFileSync(backupPath, originalPath);
            fs.unlinkSync(backupPath);
            console.log(`✓ Rolled back: ${originalPath}`);
            return true;
        } catch (error) {
            console.error(`❌ Rollback failed: ${error.message}`);
            return false;
        }
    },

    /**
     * Traite les fichiers en attente (créés lors de locks)
     * Appelé au démarrage du plugin
     */
    processPendingUpdates: function() {
        try {
            const fs = require('fs');
            const path = require('path');
            const extensionPath = this.getExtensionPath();

            // Chercher tous les fichiers .pending
            const findPendingFiles = (dir) => {
                const files = fs.readdirSync(dir);
                let pendingFiles = [];

                files.forEach(file => {
                    const fullPath = path.join(dir, file);
                    const stat = fs.statSync(fullPath);

                    if (stat.isDirectory()) {
                        pendingFiles = pendingFiles.concat(findPendingFiles(fullPath));
                    } else if (file.endsWith('.pending')) {
                        pendingFiles.push(fullPath);
                    }
                });

                return pendingFiles;
            };

            const pendingFiles = findPendingFiles(extensionPath);

            if (pendingFiles.length > 0) {
                console.log(`🔄 Processing ${pendingFiles.length} pending updates...`);

                pendingFiles.forEach(pendingPath => {
                    const originalPath = pendingPath.replace('.pending', '');

                    try {
                        if (fs.existsSync(originalPath)) {
                            fs.unlinkSync(originalPath);
                        }
                        fs.renameSync(pendingPath, originalPath);
                        console.log(`✓ Applied pending update: ${path.basename(originalPath)}`);
                    } catch (error) {
                        console.error(`❌ Failed to apply pending update: ${error.message}`);
                    }
                });
            }
        } catch (error) {
            console.error(`❌ Error processing pending updates: ${error.message}`);
        }
    },

    /**
     * Effectue la mise à jour complète
     * @param {object} manifest - Manifest de mise à jour depuis l'API
     * @param {function} onProgress - Callback de progression (file, current, total)
     * @returns {Promise<object>} - Résultat de la mise à jour
     */
    performUpdate: async function(manifest, onProgress) {
        const fs = require('fs');
        const path = require('path');
        const extensionPath = this.getExtensionPath();

        console.log(`🚀 Starting update to version ${manifest.version}...`);

        const results = {
            success: false,
            filesUpdated: [],
            filesFailed: [],
            needsRestart: false,
            backups: []
        };

        // Créer dossier temp pour téléchargements
        const tempDir = path.join(extensionPath, '.temp_update');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        try {
            const totalFiles = manifest.files.length;

            for (let i = 0; i < manifest.files.length; i++) {
                const fileInfo = manifest.files[i];
                const fileName = path.basename(fileInfo.path);

                if (onProgress) {
                    onProgress(fileName, i + 1, totalFiles);
                }

                console.log(`[${i + 1}/${totalFiles}] Processing: ${fileInfo.path}`);

                // Chemins
                const tempFilePath = path.join(tempDir, fileName);
                const targetFilePath = path.join(extensionPath, fileInfo.path);

                try {
                    // 1. Télécharger le fichier
                    await this.downloadFile(fileInfo.url, tempFilePath);

                    // 2. Vérifier le checksum
                    const downloadedChecksum = await this.calculateChecksum(tempFilePath);
                    if (downloadedChecksum !== fileInfo.checksum) {
                        throw new Error(`Checksum mismatch for ${fileName}`);
                    }

                    // 3. Sauvegarder l'ancien fichier
                    const backupPath = this.backupFile(targetFilePath);
                    if (backupPath) {
                        results.backups.push({ original: targetFilePath, backup: backupPath });
                    }

                    // 4. Remplacer le fichier
                    const replaceResult = await this.replaceFile(tempFilePath, targetFilePath);

                    if (replaceResult === 'SUCCESS') {
                        results.filesUpdated.push(fileInfo.path);
                    } else if (replaceResult === 'RESTART_REQUIRED') {
                        results.filesUpdated.push(fileInfo.path);
                        results.needsRestart = true;
                    } else {
                        throw new Error('Replace failed');
                    }

                } catch (error) {
                    console.error(`❌ Failed to update ${fileName}: ${error.message}`);
                    results.filesFailed.push({ path: fileInfo.path, error: error.message });

                    // En cas d'erreur, rollback tous les fichiers mis à jour
                    console.log('🔄 Rolling back updates...');
                    this.rollbackAll(results.backups);
                    throw new Error(`Update failed at ${fileName}`);
                }
            }

            // Nettoyer le dossier temp
            this.cleanupTempDir(tempDir);

            // Nettoyer les backups si tout s'est bien passé
            results.backups.forEach(({ backup }) => {
                try {
                    fs.unlinkSync(backup);
                } catch (error) {
                    // Ignore
                }
            });

            results.success = true;
            console.log(`✅ Update completed successfully! ${results.filesUpdated.length} files updated.`);

            return results;

        } catch (error) {
            console.error(`❌ Update failed: ${error.message}`);
            this.cleanupTempDir(tempDir);
            return results;
        }
    },

    /**
     * Rollback de tous les fichiers
     */
    rollbackAll: function(backups) {
        backups.forEach(({ original, backup }) => {
            this.rollback(backup, original);
        });
    },

    /**
     * Nettoie le dossier temporaire
     */
    cleanupTempDir: function(tempDir) {
        try {
            const fs = require('fs');
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
                console.log('✓ Temp directory cleaned');
            }
        } catch (error) {
            console.warn(`⚠️ Failed to cleanup temp directory: ${error.message}`);
        }
    }
};

// Traiter les updates en attente au chargement
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        AutoUpdater.processPendingUpdates();
    });
} else {
    AutoUpdater.processPendingUpdates();
}
