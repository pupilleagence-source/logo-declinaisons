/**
 * Système d'internationalisation simple
 * Utilisation : t('key') ou t('key', { count: 3 })
 * HTML : <span data-i18n="key">Fallback</span>
 */

const I18N = {
    currentLang: 'fr',
    supportedLangs: ['fr', 'en', 'es', 'it'],

    translations: {
        fr: {
            // Header / Reset
            reset_tooltip: 'Réinitialiser',
            reset_btn: 'Reset',
            language_label: 'Langue',

            // Trial badge
            trial_free_generations: '🎁 {remaining}/{total} générations gratuites',
            trial_connection_required: '❌ Connexion requise (Trial)',
            trial_exhausted: '🔒 Trial épuisé - Activez une license',

            // Tabs
            tab_selection: 'Sélection',
            tab_colors: 'Couleur',
            tab_export: 'Export',

            // Selection tab
            sel_heading: 'Sélection des variantes du logo',
            sel_instruction: 'sélectionne chaque élément correspondant aux variantes',
            sel_icon_label: 'Icône seule',
            sel_text_label: 'Typographie seule',
            sel_horizontal_label: 'Version horizontale',
            sel_vertical_label: 'Version verticale',
            sel_not_selected: 'Pas sélect',
            sel_selected: 'Sélectionné ✓',
            sel_validate: 'Valider',
            sel_auto_generate: 'Génération auto',
            sel_add_custom: '+ Ajouter un custom',

            // Colors tab
            col_doc_settings: 'Paramètres du document',
            col_mode_label: 'Mode couleur:',
            col_ppi_label: 'Résolution (PPI):',
            col_ppi_help: 'Valeurs courantes: 72 (Web), 150, 300 (Print)',
            col_section_heading: 'Couleurs',
            col_original: "Couleurs d'origine",
            col_grayscale: 'Nuances de gris',
            col_monochrome: 'Monochromie',
            col_monochrome_light: 'Monochromie light (avec fond noir pour PDF)',
            col_picker_tooltip: 'Cliquer pour ouvrir le sélecteur de couleur (avec pipette)',
            col_customs: 'Couleurs customs',
            col_analyze: 'Analyser les couleurs',

            // Export tab
            exp_artboard_types: 'Types de plans de travail',
            exp_fit_content: 'Fit-content (adapté au contenu)',
            exp_square: 'Carré',
            exp_margins: 'Marges',
            exp_margin_fit: 'Marge Fit-content',
            exp_margin_square: 'Marge Carré',
            exp_options: "Options d'export",
            exp_output_folder: 'Dossier de sortie :',
            exp_folder_placeholder: 'Choisir un dossier...',
            exp_browse: 'Parcourir',
            exp_sizes_label: "Tailles d'export (PNG & JPG) :",
            exp_size_small: 'Petit (1000 px)',
            exp_size_medium: 'Moyen (2000 px)',
            exp_size_large: 'Grand (4000 px)',
            exp_size_custom: 'Personnalisé',
            exp_width_label: 'Largeur (px) :',
            exp_height_label: 'Hauteur (px) :',
            exp_lock_ratio: 'Conserver le ratio',
            exp_favicon: 'Favicon (32×32 px - uniquement icône)',
            exp_favicon_desc: "Exporte l'icône en 32×32 pixels dans toutes les variantes de couleurs",
            exp_presentation: 'Présentation InDesign (.idml)',
            exp_tpl_minimal: 'Minimaliste',
            exp_tpl_classic: 'Classique',
            exp_tpl_detailed: 'Détaillé',
            exp_brand_name: 'Nom de la marque :',
            exp_brand_placeholder: 'Ma Marque',
            exp_font_primary: 'Police principale :',
            exp_font_secondary: 'Police secondaire :',
            exp_protection_zone: 'Zone de protection :',

            // Actions
            act_generate: 'Générer',
            act_export: 'Exporter',
            act_artboards_count: 'Plans de travail :',

            // License modal
            lic_title: '🔑 License Key',
            lic_description: "Entrez votre clé de licence pour débloquer l'accès illimité et le mode offline.",
            lic_key_label: 'Clé de licence :',
            lic_active: '✅ Licence active',
            lic_type: 'Type :',
            lic_key: 'Clé :',
            lic_deactivate_notice: 'Désactiver la licence libérera une activation pour l\'utiliser sur un autre appareil.',
            lic_close: 'Fermer',
            lic_activate: 'Activer',
            lic_deactivate: 'Désactiver',
            lic_lifetime: 'Lifetime (à vie)',
            lic_monthly: 'Mensuelle',
            lic_licensed: '✓ Licensed',
            lic_license_key_btn: 'License Key',

            // Update modal
            upd_title: '🎉 Mise à jour disponible',
            upd_current_version: 'Version actuelle :',
            upd_new_version: 'Nouvelle version :',
            upd_release_date: 'Date de sortie :',
            upd_changelog: 'Nouveautés :',
            upd_notice: '💡 Le téléchargement ouvrira votre navigateur. Installez le nouveau .zxp avec ZXP Installer.',
            upd_skip: 'Plus tard',
            upd_download: 'Télécharger la mise à jour',

            // Status messages
            stat_init_error: "Erreur d'initialisation",
            stat_reset_done: 'Paramètres réinitialisés.',
            stat_trial_reset_confirm: 'Réinitialiser le trial ?\n\nCela va remettre le compteur à 7/7 (local + serveur).',
            stat_trial_reset_progress: 'Réinitialisation en cours...',
            stat_trial_reset_success: '✓ Trial réinitialisé ! 7/7 générations disponibles',
            stat_trial_reset_error: '⚠️ Erreur lors de la réinitialisation',

            // Selection messages
            stat_max_custom: 'Maximum 3 variations custom',
            stat_no_document: 'Aucun document ouvert dans Illustrator. Ouvrez un fichier .ai avant de continuer.',
            stat_no_selection: 'Aucun élément sélectionné dans Illustrator. Sélectionnez un élément puis cliquez sur Sélectionner.',
            stat_selection_success: '{name} sélectionné',
            stat_selection_error: 'Erreur lors de la sélection',

            // Generation
            stat_horiz_progress: 'Génération de la version horizontale...',
            stat_horiz_success: 'Version horizontale générée !',
            stat_horiz_success_selected: 'Version horizontale générée et sélectionnée !',
            stat_vert_progress: 'Génération de la version verticale...',
            stat_vert_success: 'Version verticale générée !',
            stat_vert_success_selected: 'Version verticale générée et sélectionnée !',
            stat_gen_error: 'Erreur lors de la génération',
            stat_vert_gen_error: 'Erreur lors de la génération verticale',

            // Artboards & export
            stat_too_many_artboards: "⚠️ Attention : Trop d'artboards peuvent faire crasher Illustrator",
            stat_high_artboards: '⚠️ Attention : Nombre élevé d\'artboards',
            stat_generation_progress: 'Génération des plans de travail...',
            stat_generation_success: '{count} plans de travail créés !',
            stat_export_progress: 'Exportation en cours...',
            stat_export_success: 'Exportation terminée ! {count} plans de travail exportés.',
            stat_export_done: 'Exportation terminée !',

            // Variation names
            name_horizontal: 'Version horizontale',
            name_vertical: 'Version verticale',
            name_icon: 'Icône',
            name_text: 'Typographie',

            // Presentation
            stat_presentation_progress: 'Génération de la présentation InDesign...',
            stat_presentation_no_folder: "Veuillez d'abord générer les logos (dossier de sortie requis).",
            stat_mockups_processing: 'Traitement des mockups Photoshop ({count})...',
            stat_presentation_mockups_success: 'Présentation avec mockups ouverte dans InDesign : {filename}',
            stat_presentation_success: 'Présentation générée : {filename}',
            stat_presentation_opened: 'Présentation ouverte dans InDesign : {filename}',
            stat_presentation_opening: 'Présentation InDesign générée, ouverture dans InDesign...',
            stat_presentation_error: 'Erreur présentation : {error}',

            // License
            stat_license_empty: 'Veuillez entrer une clé de licence.',
            stat_license_activating: 'Activation en cours...',
            stat_license_activated: '✓ Licence activée avec succès ! Vous avez maintenant un accès illimité.',
            stat_license_activated_status: '✓ Licence activée ! Générations illimitées',
            stat_license_activation_error: "Erreur lors de l'activation de la licence.",
            stat_license_server_error: 'Erreur de connexion au serveur. Vérifiez votre connexion Internet.',
            stat_license_deactivate_confirm: "Êtes-vous sûr de vouloir désactiver cette licence sur cet appareil ?\n\nCela libérera une activation pour l'utiliser sur un autre appareil.",
            stat_license_deactivating: 'Désactivation...',
            stat_license_not_found: 'Aucune licence trouvée',
            stat_license_deactivated: '✓ Licence désactivée avec succès.',
            stat_license_deactivated_status: 'Licence désactivée. Retour au mode trial.',
            stat_license_deactivate_error: 'Erreur lors de la désactivation.',

            // Color picker / analysis
            stat_color_picker_error: 'Erreur: {error}',
            stat_color_picker_cancelled: 'Sélection de couleur annulée',
            stat_color_no_selection: 'Aucune variation sélectionnée. Sélectionnez au moins une variation (horizontal, vertical, icône, texte, etc.) pour analyser ses couleurs.',
            stat_color_not_found: 'Aucune couleur trouvée dans les variations sélectionnées',
            stat_color_detected: '{count} couleur(s) détectée(s) sur {variations}. Vous pouvez maintenant les personnaliser ci-dessous.',
            stat_color_analysis_error: 'Impossible d\'analyser les couleurs. Vérifiez que vos variations contiennent des formes colorées.',

            // Trial errors
            stat_trial_offline: 'Connexion Internet requise pour utiliser le trial gratuit.\n\nActivez une license pour un accès offline illimité.',
            stat_license_revoked: 'Votre licence a été révoquée.\n\nVeuillez contacter le support.',
            stat_license_too_long_offline: 'Connexion Internet requise pour valider votre licence.\n\n(Offline depuis plus de 7 jours)',
            stat_trial_exhausted: 'Vos 7 générations gratuites sont épuisées.\n\nActivez une license pour un accès illimité et offline.',

            // Generic
            err_unknown: 'Erreur inconnue',
            err_generic: 'Erreur: {message}',
        },

        en: {
            reset_tooltip: 'Reset',
            reset_btn: 'Reset',
            language_label: 'Language',

            trial_free_generations: '🎁 {remaining}/{total} free generations',
            trial_connection_required: '❌ Connection required (Trial)',
            trial_exhausted: '🔒 Trial expired - Activate a license',

            tab_selection: 'Selection',
            tab_colors: 'Colors',
            tab_export: 'Export',

            sel_heading: 'Select logo variations',
            sel_instruction: 'select each element corresponding to the variants',
            sel_icon_label: 'Icon only',
            sel_text_label: 'Text only',
            sel_horizontal_label: 'Horizontal version',
            sel_vertical_label: 'Vertical version',
            sel_not_selected: 'Not selected',
            sel_selected: 'Selected ✓',
            sel_validate: 'Confirm',
            sel_auto_generate: 'Auto-generate',
            sel_add_custom: '+ Add custom',

            col_doc_settings: 'Document settings',
            col_mode_label: 'Color mode:',
            col_ppi_label: 'Resolution (PPI):',
            col_ppi_help: 'Common values: 72 (Web), 150, 300 (Print)',
            col_section_heading: 'Colors',
            col_original: 'Original colors',
            col_grayscale: 'Grayscale',
            col_monochrome: 'Monochrome',
            col_monochrome_light: 'Light monochrome (with black background for PDF)',
            col_picker_tooltip: 'Click to open color picker (with eyedropper)',
            col_customs: 'Custom colors',
            col_analyze: 'Analyze colors',

            exp_artboard_types: 'Artboard types',
            exp_fit_content: 'Fit-content (content-adapted)',
            exp_square: 'Square',
            exp_margins: 'Margins',
            exp_margin_fit: 'Fit-content margin',
            exp_margin_square: 'Square margin',
            exp_options: 'Export options',
            exp_output_folder: 'Output folder:',
            exp_folder_placeholder: 'Choose a folder...',
            exp_browse: 'Browse',
            exp_sizes_label: 'Export sizes (PNG & JPG):',
            exp_size_small: 'Small (1000 px)',
            exp_size_medium: 'Medium (2000 px)',
            exp_size_large: 'Large (4000 px)',
            exp_size_custom: 'Custom',
            exp_width_label: 'Width (px):',
            exp_height_label: 'Height (px):',
            exp_lock_ratio: 'Lock aspect ratio',
            exp_favicon: 'Favicon (32×32 px - icon only)',
            exp_favicon_desc: 'Exports the icon at 32×32 pixels in all color variants',
            exp_presentation: 'InDesign presentation (.idml)',
            exp_tpl_minimal: 'Minimalist',
            exp_tpl_classic: 'Classic',
            exp_tpl_detailed: 'Detailed',
            exp_brand_name: 'Brand name:',
            exp_brand_placeholder: 'My Brand',
            exp_font_primary: 'Primary font:',
            exp_font_secondary: 'Secondary font:',
            exp_protection_zone: 'Protection zone:',

            act_generate: 'Generate',
            act_export: 'Export',
            act_artboards_count: 'Artboards:',

            lic_title: '🔑 License Key',
            lic_description: 'Enter your license key to unlock unlimited access and offline mode.',
            lic_key_label: 'License key:',
            lic_active: '✅ Active license',
            lic_type: 'Type:',
            lic_key: 'Key:',
            lic_deactivate_notice: 'Deactivating the license will free an activation to use on another device.',
            lic_close: 'Close',
            lic_activate: 'Activate',
            lic_deactivate: 'Deactivate',
            lic_lifetime: 'Lifetime',
            lic_monthly: 'Monthly',
            lic_licensed: '✓ Licensed',
            lic_license_key_btn: 'License Key',

            upd_title: '🎉 Update available',
            upd_current_version: 'Current version:',
            upd_new_version: 'New version:',
            upd_release_date: 'Release date:',
            upd_changelog: 'Changelog:',
            upd_notice: '💡 The download will open your browser. Install the new .zxp with ZXP Installer.',
            upd_skip: 'Later',
            upd_download: 'Download update',

            stat_init_error: 'Initialization error',
            stat_reset_done: 'Settings reset.',
            stat_trial_reset_confirm: 'Reset trial?\n\nThis will reset the counter to 7/7 (local + server).',
            stat_trial_reset_progress: 'Resetting...',
            stat_trial_reset_success: '✓ Trial reset! 7/7 generations available',
            stat_trial_reset_error: '⚠️ Error during reset',

            stat_max_custom: 'Maximum 3 custom variations',
            stat_no_document: 'No document open in Illustrator. Open an .ai file before continuing.',
            stat_no_selection: 'No element selected in Illustrator. Select an element then click Confirm.',
            stat_selection_success: '{name} selected',
            stat_selection_error: 'Selection error',

            stat_horiz_progress: 'Generating horizontal version...',
            stat_horiz_success: 'Horizontal version generated!',
            stat_horiz_success_selected: 'Horizontal version generated and selected!',
            stat_vert_progress: 'Generating vertical version...',
            stat_vert_success: 'Vertical version generated!',
            stat_vert_success_selected: 'Vertical version generated and selected!',
            stat_gen_error: 'Generation error',
            stat_vert_gen_error: 'Vertical generation error',

            stat_too_many_artboards: '⚠️ Warning: Too many artboards may crash Illustrator',
            stat_high_artboards: '⚠️ Warning: High artboard count',
            stat_generation_progress: 'Generating artboards...',
            stat_generation_success: '{count} artboards created!',
            stat_export_progress: 'Exporting...',
            stat_export_success: 'Export complete! {count} artboards exported.',
            stat_export_done: 'Export complete!',

            name_horizontal: 'Horizontal version',
            name_vertical: 'Vertical version',
            name_icon: 'Icon',
            name_text: 'Typography',

            stat_presentation_progress: 'Generating InDesign presentation...',
            stat_presentation_no_folder: 'Please generate the logos first (output folder required).',
            stat_mockups_processing: 'Processing Photoshop mockups ({count})...',
            stat_presentation_mockups_success: 'Presentation with mockups opened in InDesign: {filename}',
            stat_presentation_success: 'Presentation generated: {filename}',
            stat_presentation_opened: 'Presentation opened in InDesign: {filename}',
            stat_presentation_opening: 'InDesign presentation generated, opening in InDesign...',
            stat_presentation_error: 'Presentation error: {error}',

            stat_license_empty: 'Please enter a license key.',
            stat_license_activating: 'Activating...',
            stat_license_activated: '✓ License successfully activated! You now have unlimited access.',
            stat_license_activated_status: '✓ License activated! Unlimited generations',
            stat_license_activation_error: 'Error activating the license.',
            stat_license_server_error: 'Server connection error. Check your Internet connection.',
            stat_license_deactivate_confirm: 'Are you sure you want to deactivate this license on this device?\n\nThis will free an activation to use on another device.',
            stat_license_deactivating: 'Deactivating...',
            stat_license_not_found: 'No license found',
            stat_license_deactivated: '✓ License successfully deactivated.',
            stat_license_deactivated_status: 'License deactivated. Returning to trial mode.',
            stat_license_deactivate_error: 'Deactivation error.',

            stat_color_picker_error: 'Error: {error}',
            stat_color_picker_cancelled: 'Color selection cancelled',
            stat_color_no_selection: 'No variation selected. Select at least one variation (horizontal, vertical, icon, text, etc.) to analyze its colors.',
            stat_color_not_found: 'No color found in the selected variations',
            stat_color_detected: '{count} color(s) detected on {variations}. You can now customize them below.',
            stat_color_analysis_error: 'Unable to analyze colors. Make sure your variations contain colored shapes.',

            stat_trial_offline: 'Internet connection required to use the free trial.\n\nActivate a license for unlimited offline access.',
            stat_license_revoked: 'Your license has been revoked.\n\nPlease contact support.',
            stat_license_too_long_offline: 'Internet connection required to validate your license.\n\n(Offline for more than 7 days)',
            stat_trial_exhausted: 'Your 7 free generations are exhausted.\n\nActivate a license for unlimited offline access.',

            err_unknown: 'Unknown error',
            err_generic: 'Error: {message}',
        },

        es: {
            reset_tooltip: 'Restablecer',
            reset_btn: 'Reset',
            language_label: 'Idioma',

            trial_free_generations: '🎁 {remaining}/{total} generaciones gratuitas',
            trial_connection_required: '❌ Conexión requerida (Trial)',
            trial_exhausted: '🔒 Trial agotado - Activa una licencia',

            tab_selection: 'Selección',
            tab_colors: 'Color',
            tab_export: 'Exportar',

            sel_heading: 'Selección de variantes del logo',
            sel_instruction: 'selecciona cada elemento correspondiente a las variantes',
            sel_icon_label: 'Solo icono',
            sel_text_label: 'Solo tipografía',
            sel_horizontal_label: 'Versión horizontal',
            sel_vertical_label: 'Versión vertical',
            sel_not_selected: 'No selec.',
            sel_selected: 'Seleccionado ✓',
            sel_validate: 'Confirmar',
            sel_auto_generate: 'Auto-generar',
            sel_add_custom: '+ Añadir custom',

            col_doc_settings: 'Configuración del documento',
            col_mode_label: 'Modo de color:',
            col_ppi_label: 'Resolución (PPI):',
            col_ppi_help: 'Valores comunes: 72 (Web), 150, 300 (Print)',
            col_section_heading: 'Colores',
            col_original: 'Colores originales',
            col_grayscale: 'Escala de grises',
            col_monochrome: 'Monocromo',
            col_monochrome_light: 'Monocromo claro (fondo negro para PDF)',
            col_picker_tooltip: 'Clic para abrir el selector de color (con cuentagotas)',
            col_customs: 'Colores personalizados',
            col_analyze: 'Analizar colores',

            exp_artboard_types: 'Tipos de mesas de trabajo',
            exp_fit_content: 'Fit-content (adaptado al contenido)',
            exp_square: 'Cuadrado',
            exp_margins: 'Márgenes',
            exp_margin_fit: 'Margen Fit-content',
            exp_margin_square: 'Margen Cuadrado',
            exp_options: 'Opciones de exportación',
            exp_output_folder: 'Carpeta de salida:',
            exp_folder_placeholder: 'Elegir una carpeta...',
            exp_browse: 'Examinar',
            exp_sizes_label: 'Tamaños de exportación (PNG & JPG):',
            exp_size_small: 'Pequeño (1000 px)',
            exp_size_medium: 'Mediano (2000 px)',
            exp_size_large: 'Grande (4000 px)',
            exp_size_custom: 'Personalizado',
            exp_width_label: 'Ancho (px):',
            exp_height_label: 'Alto (px):',
            exp_lock_ratio: 'Bloquear proporción',
            exp_favicon: 'Favicon (32×32 px - solo icono)',
            exp_favicon_desc: 'Exporta el icono en 32×32 píxeles en todas las variantes de color',
            exp_presentation: 'Presentación InDesign (.idml)',
            exp_tpl_minimal: 'Minimalista',
            exp_tpl_classic: 'Clásico',
            exp_tpl_detailed: 'Detallado',
            exp_brand_name: 'Nombre de la marca:',
            exp_brand_placeholder: 'Mi Marca',
            exp_font_primary: 'Fuente principal:',
            exp_font_secondary: 'Fuente secundaria:',
            exp_protection_zone: 'Zona de protección:',

            act_generate: 'Generar',
            act_export: 'Exportar',
            act_artboards_count: 'Mesas de trabajo:',

            lic_title: '🔑 Clave de licencia',
            lic_description: 'Ingresa tu clave de licencia para desbloquear acceso ilimitado y modo offline.',
            lic_key_label: 'Clave de licencia:',
            lic_active: '✅ Licencia activa',
            lic_type: 'Tipo:',
            lic_key: 'Clave:',
            lic_deactivate_notice: 'Desactivar la licencia liberará una activación para usarla en otro dispositivo.',
            lic_close: 'Cerrar',
            lic_activate: 'Activar',
            lic_deactivate: 'Desactivar',
            lic_lifetime: 'De por vida',
            lic_monthly: 'Mensual',
            lic_licensed: '✓ Con licencia',
            lic_license_key_btn: 'Clave de licencia',

            upd_title: '🎉 Actualización disponible',
            upd_current_version: 'Versión actual:',
            upd_new_version: 'Nueva versión:',
            upd_release_date: 'Fecha de lanzamiento:',
            upd_changelog: 'Novedades:',
            upd_notice: '💡 La descarga abrirá tu navegador. Instala el nuevo .zxp con ZXP Installer.',
            upd_skip: 'Más tarde',
            upd_download: 'Descargar actualización',

            stat_init_error: 'Error de inicialización',
            stat_reset_done: 'Configuración restablecida.',
            stat_trial_reset_confirm: '¿Restablecer el trial?\n\nEsto reseteará el contador a 7/7 (local + servidor).',
            stat_trial_reset_progress: 'Restableciendo...',
            stat_trial_reset_success: '✓ ¡Trial restablecido! 7/7 generaciones disponibles',
            stat_trial_reset_error: '⚠️ Error durante el restablecimiento',

            stat_max_custom: 'Máximo 3 variaciones personalizadas',
            stat_no_document: 'No hay documento abierto en Illustrator. Abre un archivo .ai antes de continuar.',
            stat_no_selection: 'No hay elemento seleccionado en Illustrator. Selecciona un elemento y haz clic en Confirmar.',
            stat_selection_success: '{name} seleccionado',
            stat_selection_error: 'Error de selección',

            stat_horiz_progress: 'Generando versión horizontal...',
            stat_horiz_success: '¡Versión horizontal generada!',
            stat_horiz_success_selected: '¡Versión horizontal generada y seleccionada!',
            stat_vert_progress: 'Generando versión vertical...',
            stat_vert_success: '¡Versión vertical generada!',
            stat_vert_success_selected: '¡Versión vertical generada y seleccionada!',
            stat_gen_error: 'Error de generación',
            stat_vert_gen_error: 'Error de generación vertical',

            stat_too_many_artboards: '⚠️ Advertencia: Demasiadas mesas pueden hacer que Illustrator falle',
            stat_high_artboards: '⚠️ Advertencia: Número alto de mesas',
            stat_generation_progress: 'Generando mesas de trabajo...',
            stat_generation_success: '¡{count} mesas de trabajo creadas!',
            stat_export_progress: 'Exportando...',
            stat_export_success: '¡Exportación completada! {count} mesas exportadas.',
            stat_export_done: '¡Exportación completada!',

            name_horizontal: 'Versión horizontal',
            name_vertical: 'Versión vertical',
            name_icon: 'Icono',
            name_text: 'Tipografía',

            stat_presentation_progress: 'Generando presentación InDesign...',
            stat_presentation_no_folder: 'Por favor genera primero los logos (carpeta de salida requerida).',
            stat_mockups_processing: 'Procesando mockups de Photoshop ({count})...',
            stat_presentation_mockups_success: 'Presentación con mockups abierta en InDesign: {filename}',
            stat_presentation_success: 'Presentación generada: {filename}',
            stat_presentation_opened: 'Presentación abierta en InDesign: {filename}',
            stat_presentation_opening: 'Presentación InDesign generada, abriendo en InDesign...',
            stat_presentation_error: 'Error de presentación: {error}',

            stat_license_empty: 'Por favor ingresa una clave de licencia.',
            stat_license_activating: 'Activando...',
            stat_license_activated: '✓ ¡Licencia activada con éxito! Ahora tienes acceso ilimitado.',
            stat_license_activated_status: '✓ ¡Licencia activada! Generaciones ilimitadas',
            stat_license_activation_error: 'Error al activar la licencia.',
            stat_license_server_error: 'Error de conexión al servidor. Verifica tu conexión a Internet.',
            stat_license_deactivate_confirm: '¿Seguro que quieres desactivar esta licencia en este dispositivo?\n\nEsto liberará una activación para usarla en otro dispositivo.',
            stat_license_deactivating: 'Desactivando...',
            stat_license_not_found: 'No se encontró licencia',
            stat_license_deactivated: '✓ Licencia desactivada con éxito.',
            stat_license_deactivated_status: 'Licencia desactivada. Volviendo al modo trial.',
            stat_license_deactivate_error: 'Error de desactivación.',

            stat_color_picker_error: 'Error: {error}',
            stat_color_picker_cancelled: 'Selección de color cancelada',
            stat_color_no_selection: 'Ninguna variación seleccionada. Selecciona al menos una variación (horizontal, vertical, icono, texto, etc.) para analizar sus colores.',
            stat_color_not_found: 'Ningún color encontrado en las variaciones seleccionadas',
            stat_color_detected: '{count} color(es) detectado(s) en {variations}. Ahora puedes personalizarlos abajo.',
            stat_color_analysis_error: 'Imposible analizar los colores. Verifica que tus variaciones contengan formas con color.',

            stat_trial_offline: 'Conexión a Internet requerida para usar el trial gratuito.\n\nActiva una licencia para acceso offline ilimitado.',
            stat_license_revoked: 'Tu licencia ha sido revocada.\n\nPor favor contacta con soporte.',
            stat_license_too_long_offline: 'Conexión a Internet requerida para validar tu licencia.\n\n(Offline desde hace más de 7 días)',
            stat_trial_exhausted: 'Tus 7 generaciones gratuitas están agotadas.\n\nActiva una licencia para acceso ilimitado y offline.',

            err_unknown: 'Error desconocido',
            err_generic: 'Error: {message}',
        },

        it: {
            reset_tooltip: 'Reimposta',
            reset_btn: 'Reset',
            language_label: 'Lingua',

            trial_free_generations: '🎁 {remaining}/{total} generazioni gratuite',
            trial_connection_required: '❌ Connessione richiesta (Trial)',
            trial_exhausted: '🔒 Trial esaurito - Attiva una licenza',

            tab_selection: 'Selezione',
            tab_colors: 'Colore',
            tab_export: 'Esporta',

            sel_heading: 'Selezione delle varianti del logo',
            sel_instruction: 'seleziona ogni elemento corrispondente alle varianti',
            sel_icon_label: 'Solo icona',
            sel_text_label: 'Solo tipografia',
            sel_horizontal_label: 'Versione orizzontale',
            sel_vertical_label: 'Versione verticale',
            sel_not_selected: 'Non selez.',
            sel_selected: 'Selezionato ✓',
            sel_validate: 'Conferma',
            sel_auto_generate: 'Auto-genera',
            sel_add_custom: '+ Aggiungi custom',

            col_doc_settings: 'Impostazioni documento',
            col_mode_label: 'Modalità colore:',
            col_ppi_label: 'Risoluzione (PPI):',
            col_ppi_help: 'Valori comuni: 72 (Web), 150, 300 (Stampa)',
            col_section_heading: 'Colori',
            col_original: 'Colori originali',
            col_grayscale: 'Scala di grigi',
            col_monochrome: 'Monocromatico',
            col_monochrome_light: 'Monocromatico chiaro (sfondo nero per PDF)',
            col_picker_tooltip: 'Clicca per aprire il selettore colori (con contagocce)',
            col_customs: 'Colori personalizzati',
            col_analyze: 'Analizza colori',

            exp_artboard_types: 'Tipi di tavole da disegno',
            exp_fit_content: 'Fit-content (adattato al contenuto)',
            exp_square: 'Quadrato',
            exp_margins: 'Margini',
            exp_margin_fit: 'Margine Fit-content',
            exp_margin_square: 'Margine Quadrato',
            exp_options: 'Opzioni di esportazione',
            exp_output_folder: 'Cartella di uscita:',
            exp_folder_placeholder: 'Scegli una cartella...',
            exp_browse: 'Sfoglia',
            exp_sizes_label: 'Dimensioni di esportazione (PNG & JPG):',
            exp_size_small: 'Piccolo (1000 px)',
            exp_size_medium: 'Medio (2000 px)',
            exp_size_large: 'Grande (4000 px)',
            exp_size_custom: 'Personalizzato',
            exp_width_label: 'Larghezza (px):',
            exp_height_label: 'Altezza (px):',
            exp_lock_ratio: 'Mantieni proporzioni',
            exp_favicon: 'Favicon (32×32 px - solo icona)',
            exp_favicon_desc: 'Esporta l\'icona a 32×32 pixel in tutte le varianti di colore',
            exp_presentation: 'Presentazione InDesign (.idml)',
            exp_tpl_minimal: 'Minimalista',
            exp_tpl_classic: 'Classico',
            exp_tpl_detailed: 'Dettagliato',
            exp_brand_name: 'Nome del marchio:',
            exp_brand_placeholder: 'Il mio marchio',
            exp_font_primary: 'Font principale:',
            exp_font_secondary: 'Font secondario:',
            exp_protection_zone: 'Zona di protezione:',

            act_generate: 'Genera',
            act_export: 'Esporta',
            act_artboards_count: 'Tavole da disegno:',

            lic_title: '🔑 Chiave di licenza',
            lic_description: 'Inserisci la tua chiave di licenza per sbloccare l\'accesso illimitato e la modalità offline.',
            lic_key_label: 'Chiave di licenza:',
            lic_active: '✅ Licenza attiva',
            lic_type: 'Tipo:',
            lic_key: 'Chiave:',
            lic_deactivate_notice: 'Disattivare la licenza libererà un\'attivazione da usare su un altro dispositivo.',
            lic_close: 'Chiudi',
            lic_activate: 'Attiva',
            lic_deactivate: 'Disattiva',
            lic_lifetime: 'A vita',
            lic_monthly: 'Mensile',
            lic_licensed: '✓ Con licenza',
            lic_license_key_btn: 'Chiave di licenza',

            upd_title: '🎉 Aggiornamento disponibile',
            upd_current_version: 'Versione attuale:',
            upd_new_version: 'Nuova versione:',
            upd_release_date: 'Data di rilascio:',
            upd_changelog: 'Novità:',
            upd_notice: '💡 Il download aprirà il tuo browser. Installa il nuovo .zxp con ZXP Installer.',
            upd_skip: 'Più tardi',
            upd_download: 'Scarica l\'aggiornamento',

            stat_init_error: 'Errore di inizializzazione',
            stat_reset_done: 'Impostazioni ripristinate.',
            stat_trial_reset_confirm: 'Reimpostare il trial?\n\nQuesto ripristinerà il contatore a 7/7 (locale + server).',
            stat_trial_reset_progress: 'Ripristino in corso...',
            stat_trial_reset_success: '✓ Trial ripristinato! 7/7 generazioni disponibili',
            stat_trial_reset_error: '⚠️ Errore durante il ripristino',

            stat_max_custom: 'Massimo 3 variazioni personalizzate',
            stat_no_document: 'Nessun documento aperto in Illustrator. Apri un file .ai prima di continuare.',
            stat_no_selection: 'Nessun elemento selezionato in Illustrator. Seleziona un elemento e fai clic su Conferma.',
            stat_selection_success: '{name} selezionato',
            stat_selection_error: 'Errore di selezione',

            stat_horiz_progress: 'Generazione versione orizzontale...',
            stat_horiz_success: 'Versione orizzontale generata!',
            stat_horiz_success_selected: 'Versione orizzontale generata e selezionata!',
            stat_vert_progress: 'Generazione versione verticale...',
            stat_vert_success: 'Versione verticale generata!',
            stat_vert_success_selected: 'Versione verticale generata e selezionata!',
            stat_gen_error: 'Errore di generazione',
            stat_vert_gen_error: 'Errore di generazione verticale',

            stat_too_many_artboards: '⚠️ Attenzione: Troppe tavole possono far crashare Illustrator',
            stat_high_artboards: '⚠️ Attenzione: Numero elevato di tavole',
            stat_generation_progress: 'Generazione tavole da disegno...',
            stat_generation_success: '{count} tavole create!',
            stat_export_progress: 'Esportazione in corso...',
            stat_export_success: 'Esportazione completata! {count} tavole esportate.',
            stat_export_done: 'Esportazione completata!',

            name_horizontal: 'Versione orizzontale',
            name_vertical: 'Versione verticale',
            name_icon: 'Icona',
            name_text: 'Tipografia',

            stat_presentation_progress: 'Generazione presentazione InDesign...',
            stat_presentation_no_folder: 'Prima genera i logo (cartella di uscita richiesta).',
            stat_mockups_processing: 'Elaborazione mockup Photoshop ({count})...',
            stat_presentation_mockups_success: 'Presentazione con mockup aperta in InDesign: {filename}',
            stat_presentation_success: 'Presentazione generata: {filename}',
            stat_presentation_opened: 'Presentazione aperta in InDesign: {filename}',
            stat_presentation_opening: 'Presentazione InDesign generata, apertura in InDesign...',
            stat_presentation_error: 'Errore presentazione: {error}',

            stat_license_empty: 'Inserisci una chiave di licenza.',
            stat_license_activating: 'Attivazione in corso...',
            stat_license_activated: '✓ Licenza attivata con successo! Ora hai accesso illimitato.',
            stat_license_activated_status: '✓ Licenza attivata! Generazioni illimitate',
            stat_license_activation_error: 'Errore durante l\'attivazione della licenza.',
            stat_license_server_error: 'Errore di connessione al server. Verifica la tua connessione Internet.',
            stat_license_deactivate_confirm: 'Sei sicuro di voler disattivare questa licenza su questo dispositivo?\n\nQuesto libererà un\'attivazione da usare su un altro dispositivo.',
            stat_license_deactivating: 'Disattivazione...',
            stat_license_not_found: 'Nessuna licenza trovata',
            stat_license_deactivated: '✓ Licenza disattivata con successo.',
            stat_license_deactivated_status: 'Licenza disattivata. Ritorno alla modalità trial.',
            stat_license_deactivate_error: 'Errore di disattivazione.',

            stat_color_picker_error: 'Errore: {error}',
            stat_color_picker_cancelled: 'Selezione colore annullata',
            stat_color_no_selection: 'Nessuna variazione selezionata. Seleziona almeno una variazione (orizzontale, verticale, icona, testo, ecc.) per analizzarne i colori.',
            stat_color_not_found: 'Nessun colore trovato nelle variazioni selezionate',
            stat_color_detected: '{count} colore/i rilevato/i su {variations}. Ora puoi personalizzarli qui sotto.',
            stat_color_analysis_error: 'Impossibile analizzare i colori. Verifica che le tue variazioni contengano forme colorate.',

            stat_trial_offline: 'Connessione Internet richiesta per usare il trial gratuito.\n\nAttiva una licenza per accesso offline illimitato.',
            stat_license_revoked: 'La tua licenza è stata revocata.\n\nContatta il supporto.',
            stat_license_too_long_offline: 'Connessione Internet richiesta per validare la tua licenza.\n\n(Offline da più di 7 giorni)',
            stat_trial_exhausted: 'Le tue 7 generazioni gratuite sono esaurite.\n\nAttiva una licenza per accesso illimitato e offline.',

            err_unknown: 'Errore sconosciuto',
            err_generic: 'Errore: {message}',
        }
    },

    init: function() {
        try {
            var saved = localStorage.getItem('_lang');
            if (saved && this.supportedLangs.indexOf(saved) !== -1) {
                this.currentLang = saved;
            }
        } catch (e) {}
        this.applyToDOM();
    },

    setLang: function(lang) {
        if (this.supportedLangs.indexOf(lang) === -1) return;
        this.currentLang = lang;
        try { localStorage.setItem('_lang', lang); } catch (e) {}
        this.applyToDOM();
    },

    t: function(key, vars) {
        var dict = this.translations[this.currentLang] || this.translations.fr;
        var str = dict[key];
        if (str === undefined) {
            // Fallback FR
            str = this.translations.fr[key];
            if (str === undefined) return key;
        }
        if (vars) {
            for (var k in vars) {
                str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
            }
        }
        return str;
    },

    applyToDOM: function() {
        // Textes
        var els = document.querySelectorAll('[data-i18n]');
        for (var i = 0; i < els.length; i++) {
            var key = els[i].getAttribute('data-i18n');
            els[i].textContent = this.t(key);
        }
        // Placeholders
        var phEls = document.querySelectorAll('[data-i18n-placeholder]');
        for (var j = 0; j < phEls.length; j++) {
            var pkey = phEls[j].getAttribute('data-i18n-placeholder');
            phEls[j].setAttribute('placeholder', this.t(pkey));
        }
        // Titles (tooltips)
        var tEls = document.querySelectorAll('[data-i18n-title]');
        for (var k = 0; k < tEls.length; k++) {
            var tkey = tEls[k].getAttribute('data-i18n-title');
            tEls[k].setAttribute('title', this.t(tkey));
        }
    }
};

// Raccourci global
function t(key, vars) { return I18N.t(key, vars); }
