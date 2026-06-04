/**
 * Script para generar certificado de PRODUCCIÓN usando AFIP SDK
 * Requiere access_token de https://app.afipsdk.com/
 */

const Afip = require('@afipsdk/afip.js').default;
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function generateProductionCert() {
  try {
    console.log('🔐 GENERADOR DE CERTIFICADO DE PRODUCCIÓN AFIP\n');
    console.log('=' .repeat(60));
    console.log('\n📋 Necesitarás:\n');
    console.log('  1. Access Token de https://app.afipsdk.com/');
    console.log('  2. Tu CUIT (20317657634)');
    console.log('  3. Tu usuario de ARCA (normalmente el mismo CUIT)');
    console.log('  4. Tu contraseña de ARCA');
    console.log('  5. Un alias para el certificado\n');
    console.log('=' .repeat(60) + '\n');

    // Obtener datos del usuario
    const accessToken = await question('🔑 Access Token: ');
    const cuit = await question('👤 CUIT (default: 20317657634): ') || '20317657634';
    const username = await question('📧 Usuario ARCA (default: mismo CUIT): ') || cuit;
    const password = await question('🔒 Contraseña ARCA: ');
    const alias = await question('🏷️  Alias del certificado (default: buffalo): ') || 'buffalo';

    console.log('\n⏳ Generando certificado de producción...\n');
    console.log('⚠️  Esto puede tardar 1-2 minutos, por favor espera...\n');

    // Inicializar SDK con access_token
    const afip = new Afip({ access_token: accessToken });

    // Datos para la automatización
    const data = {
      cuit: cuit,
      username: username,
      password: password,
      alias: alias
    };

    // Ejecutar la automatización
    const response = await afip.CreateAutomation("create-cert-prod", data, true);

    console.log('✅ ¡Certificado generado exitosamente!\n');
    console.log('📋 Respuesta:\n');
    console.log(JSON.stringify(response, null, 2));

    if (response.status === 'complete' && response.data) {
      console.log('\n' + '='.repeat(60));
      console.log('\n📄 CERTIFICADO (cert):\n');
      console.log(response.data.cert);
      console.log('\n🔐 CLAVE PRIVADA (key):\n');
      console.log(response.data.key);
      console.log('\n' + '='.repeat(60));
      console.log('\n✨ SIGUIENTE PASO:\n');
      console.log('1. Guarda estos valores como variables de entorno en Vercel:');
      console.log('   - AFIP_CERT_PEM = (el certificado completo)');
      console.log('   - AFIP_KEY_PEM = (la clave privada completa)');
      console.log('   - AFIP_ACCESS_TOKEN = ' + accessToken);
      console.log('\n2. Haz un nuevo deploy en Vercel');
      console.log('\n3. Prueba el "Test de Conexión AFIP"\n');
    } else {
      console.log('\n⚠️  La automatización no se completó correctamente.');
      console.log('    Revisa los datos ingresados e intenta nuevamente.\n');
    }

    rl.close();

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('\nRespuesta del servidor:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('\n💡 Verifica:');
    console.error('   - Que el access_token sea válido');
    console.error('   - Que el usuario y contraseña de ARCA sean correctos');
    console.error('   - Que el CUIT esté correctamente autorizado\n');
    rl.close();
    process.exit(1);
  }
}

generateProductionCert();

