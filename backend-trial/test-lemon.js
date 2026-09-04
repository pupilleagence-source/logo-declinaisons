/**
 * Script de test pour vérifier l'API Lemon Squeezy
 */

// La cle API est lue depuis l'environnement. Elle etait codee en dur ici, dans un
// fichier suivi par git : elle a donc fuite dans l'historique et DOIT etre revoquee
// puis regeneree dans le dashboard Lemon Squeezy.
// Usage : LEMONSQUEEZY_API_KEY=xxx node test-lemon.js
const API_KEY = process.env.LEMONSQUEEZY_API_KEY;

if (!API_KEY) {
    console.error('LEMONSQUEEZY_API_KEY manquante. Usage : LEMONSQUEEZY_API_KEY=xxx node test-lemon.js');
    process.exit(1);
}

async function testDeactivation() {
    console.log('🔍 Test de l\'endpoint de désactivation Lemon Squeezy...\n');

    // Test avec une fausse clé de licence pour voir la réponse
    const testLicenseKey = 'test-key-123';
    const testInstanceId = 'test-instance-456';

    try {
        const response = await fetch('https://api.lemonsqueezy.com/v1/licenses/deactivate', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                license_key: testLicenseKey,
                instance_id: testInstanceId
            })
        });

        console.log('Status:', response.status);
        console.log('Status Text:', response.statusText);

        const data = await response.json();
        console.log('\nResponse:', JSON.stringify(data, null, 2));

        if (response.status === 404 || response.status === 400) {
            console.log('\n✅ API Key et endpoint fonctionnent (erreur normale car test avec fausses données)');
        } else if (response.status === 401 || response.status === 403) {
            console.log('\n❌ Problème d\'authentification');
        } else {
            console.log('\n⚠️ Réponse inattendue');
        }

    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

testDeactivation();
