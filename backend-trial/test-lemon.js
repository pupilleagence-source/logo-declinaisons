/**
 * Script de test pour vérifier l'API Lemon Squeezy
 */

const API_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI5NGQ1OWNlZi1kYmI4LTRlYTUtYjE3OC1kMjU0MGZjZDY5MTkiLCJqdGkiOiJlZjNkNjE3OGFjYzFiYWI2MmNjMTI2YWE5NDhlZTE2MTc2OWE2NjM2ZGMwNDVjZDBjNGM4NWZiNDZmYjU0ODI0ZDVhYjk4NDVjOGRjYTUzOSIsImlhdCI6MTc2MjQ3MzczNS4zNDA3MTcsIm5iZiI6MTc2MjQ3MzczNS4zNDA3MiwiZXhwIjoyMDc4MDA2NTM1LjMyNzI1OCwic3ViIjoiNTkwOTQ1NyIsInNjb3BlcyI6W119.vIUmsH0L6miAdAkuU6h5YmHd8IM0PCQkdcFflNNVxnayeuCTiNItH63UPB22jwUYFp42dZcXUJpg-KvOWN2NpmGhmc5AhhIAqCNefnsuXgf_2SpJ4xZuvulYajJ3LmV0RXhDlvWx3Wk5CUxlut8W5tc9xFmgxrY1M7ixJRbgP5rCvYEgKGfp_uC1XdsucBr7-34BhSz3NikJ9Ome7WEbrLD_qPkwYWqQqlt5hgs1saLENeNoFviapozJL0K9_Yf-PXLBgOIxKc4AThu_-mpRmqVAU_V-NaYYJyDRa6XdVPmO_5e3lg9CsCVaAcd_l-mi2tWiuYGGhyTj_T5YvvXICHfO3Su1YPYZ1Rpy7PJdv_oLezVxrYSRuJiYWhL3u4UZnWzVuvpBKUawf462fU-wuFUc7NZ1axKes2681G8VN_uQVTgWeIxY8Lq2X252rksLrDAMNkLIZas6_lAvf-w1-QCdvRr6R4Cu9unKOvRtpRggHvgg0KfH8HASxmUWUysoWRKTc1eA962m-8RUV_84nzlf7HcMny7XVGObp5Vj-Iy423yX0WVGQqlNm7W7w2TdtxRtlOgRbdUhk3-Z-QYJRSUPXhGJbfN6bDTglN2xXs7PAnAM5yAMTjWnqq39HsKFCn_4MgtF2Fcuvq7TPY0V822vZ9sWSvFu02Jz-JB6Fyg';

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
