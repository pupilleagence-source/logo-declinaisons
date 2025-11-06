================================================
  LOGO DÉCLINAISONS - PLUGIN ADOBE ILLUSTRATOR
  Installation pour macOS
  Version 1.0.0
================================================

PRÉREQUIS
---------
- macOS 10.14 (Mojave) ou plus récent
- Adobe Illustrator 2022, 2023, 2024 ou 2025


INSTALLATION AUTOMATIQUE (RECOMMANDÉ)
--------------------------------------

1. Décompressez l'archive téléchargée
2. Double-cliquez sur : install-mac.command
3. Si macOS affiche un avertissement de sécurité :
   - Allez dans Préférences Système > Sécurité et confidentialité
   - Cliquez sur "Ouvrir quand même"
   - Ou faites clic-droit > Ouvrir
4. Suivez les instructions à l'écran
5. Ouvrez Adobe Illustrator
6. Allez dans : Fenêtre > Extensions > Logo Déclinaisons


INSTALLATION MANUELLE
---------------------

Si le script automatique ne fonctionne pas :

1. Ouvrez le Finder
2. Allez dans : Aller > Aller au dossier... (Cmd+Shift+G)
3. Tapez : ~/Library/Application Support/Adobe/CEP/extensions
4. Appuyez sur Entrée
5. Créez un dossier nommé : logo-declinaisons
6. Copiez TOUS les fichiers du plugin dans ce dossier :
   - CSXS/
   - css/
   - js/
   - jsx/
   - lib/
   - media/
   - index.html

7. Double-cliquez sur : enable-cep-debug-mac.command
   (Active le mode debug CEP nécessaire)

8. Redémarrez Adobe Illustrator


DÉPANNAGE
---------

❌ Le plugin n'apparaît pas dans Extensions
   → Double-cliquez sur enable-cep-debug-mac.command
   → Redémarrez complètement Illustrator (Cmd+Q puis rouvrir)
   → Vérifiez que vous utilisez Illustrator 2022+

❌ Le panneau s'ouvre mais reste vide
   → Le mode debug CEP n'est pas activé
   → Lancez enable-cep-debug-mac.command
   → Redémarrez Illustrator

❌ macOS bloque le script install-mac.command
   → Clic-droit sur le fichier > Ouvrir
   → Ou : Préférences Système > Sécurité > "Ouvrir quand même"

❌ "Permission denied" dans le Terminal
   → Ouvrez le Terminal
   → Tapez : chmod +x /chemin/vers/install-mac.command
   → Puis double-cliquez à nouveau


DÉSINSTALLATION
---------------

1. Fermez Adobe Illustrator
2. Supprimez le dossier :
   ~/Library/Application Support/Adobe/CEP/extensions/logo-declinaisons


EMPLACEMENT DU PLUGIN
---------------------

Le plugin est installé dans :
~/Library/Application Support/Adobe/CEP/extensions/logo-declinaisons

(~ représente votre dossier utilisateur)


SUPPORT
-------

Pour toute question ou problème :
- Email : support@votre-site.com
- Site web : https://votre-site.com


NOTES TECHNIQUES
----------------

Mode Debug CEP :
Ce plugin nécessite que le mode debug CEP soit activé pour
fonctionner. Le script install-mac.command l'active automatiquement.

Si vous préférez l'activer manuellement, exécutez dans le Terminal :

defaults write com.adobe.CSXS.11 PlayerDebugMode 1
defaults write com.adobe.CSXS.12 PlayerDebugMode 1

Puis redémarrez Illustrator.


================================================
© 2024 Logo Déclinaisons - Tous droits réservés
================================================
