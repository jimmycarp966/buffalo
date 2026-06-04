/**
 * Script para autorizar el web service wsfev1 en AFIP
 * Esto permite usar facturación electrónica con el certificado
 */

const Afip = require('@afipsdk/afip.js');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno requerida: ${name}`);
  }
  return value;
}

async function authorizeWebService() {
  try {
    console.log('🔐 AUTORIZACIÓN DE WEB SERVICE EN AFIP\n');
    console.log('=' .repeat(60));

    // DATOS desde variables de entorno (nunca hardcodear token/credenciales del portal AFIP)
    const accessToken = requireEnv('AFIP_ACCESS_TOKEN');
    const cuit = requireEnv('AFIP_CUIT');
    const username = process.env.AFIP_USERNAME || cuit;
    const password = requireEnv('AFIP_PASSWORD');
    const alias = process.env.AFIP_ALIAS || 'afip-cert';
    const wsid = process.env.AFIP_WSID || 'wsfe'; // Web Service de Facturación Electrónica

    console.log('📋 Configuración:');
    console.log(`   CUIT: ${cuit}`);
    console.log(`   Web Service: ${wsid}`);
    console.log(`   Alias: ${alias}`);
    console.log('=' .repeat(60) + '\n');

    console.log('⏳ Autorizando web service en AFIP...\n');
    console.log('⚠️  Esto puede tardar 1-2 minutos, por favor espera...\n');

    // Inicializar SDK con access_token y CUIT
    const afip = new Afip({ 
      access_token: accessToken,
      CUIT: cuit,
      production: true
    });

    console.log('🔄 Paso 1/2: Conectando con AFIP...');
    
    // Autorizar el web service usando CreateWSAuth
    try {
      const result = await afip.CreateWSAuth(username, password, alias, wsid);
      console.log('✅ Web service autorizado exitosamente!');
      console.log('Resultado:', JSON.stringify(result, null, 2));
    } catch (err) {
      console.error('❌ Error detallado:', err.message);
      console.error('Status:', err.status);
      console.error('StatusText:', err.statusText);
      console.error('Data:', JSON.stringify(err.data, null, 2));
      throw err;
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ ¡AUTORIZACIÓN COMPLETADA!');
    console.log('=' .repeat(60) + '\n');

    console.log('📋 PRÓXIMOS PASOS:\n');
    console.log('1️⃣  Ve a tu aplicación en Vercel');
    console.log('2️⃣  Haz clic en "Test de Conexión AFIP"');
    console.log('3️⃣  Debería mostrar: ✅ Conexión exitosa\n');
    console.log('=' .repeat(60));
    console.log('🎉 ¡Ya puedes emitir Facturas C en producción!');
    console.log('=' .repeat(60));

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.response) {
      console.error('Respuesta del servidor:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('\nStack:', error.stack);
  }
}

// Ejecutar
authorizeWebService()
  .then(() => {
    console.log('\n✅ Proceso completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });

