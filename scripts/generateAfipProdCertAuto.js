/**
 * Script automático para generar certificado de PRODUCCIÓN
 * Versión sin prompts para ejecución rápida
 */

const Afip = require('@afipsdk/afip.js');
const fs = require('fs');
const path = require('path');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno requerida: ${name}`);
  }
  return value;
}

async function generateProductionCert() {
  try {
    console.log('🔐 GENERADOR DE CERTIFICADO DE PRODUCCIÓN AFIP\n');
    console.log('=' .repeat(60));

    // DATOS desde variables de entorno (nunca hardcodear token/credenciales del portal AFIP)
    const accessToken = requireEnv('AFIP_ACCESS_TOKEN');
    const cuit = requireEnv('AFIP_CUIT');
    const username = process.env.AFIP_USERNAME || cuit;
    const password = requireEnv('AFIP_PASSWORD');
    const alias = process.env.AFIP_ALIAS || 'afip-cert';

    console.log('📋 Configuración:');
    console.log(`   CUIT: ${cuit}`);
    console.log(`   Usuario: ${username}`);
    console.log(`   Alias: ${alias}`);
    console.log('=' .repeat(60) + '\n');

    console.log('⏳ Generando certificado de producción...\n');
    console.log('⚠️  Esto puede tardar 1-2 minutos, por favor espera...\n');

    // Inicializar SDK con access_token y CUIT
    const afip = new Afip({ 
      access_token: accessToken,
      CUIT: cuit,
      production: true  // Modo producción
    });

    console.log('🔄 Paso 1/4: Conectando con AFIP...');
    
    // Usar el método CreateCert (funciona mejor que CreateAutomation)
    try {
      const result = await afip.CreateCert(username, password, alias);
      console.log('✅ Certificado creado exitosamente!');
      console.log('Resultado:', JSON.stringify(result, null, 2));
    } catch (err) {
      console.error('❌ Error detallado:', err.message);
      console.error('Status:', err.status);
      console.error('StatusText:', err.statusText);
      console.error('Data:', JSON.stringify(err.data, null, 2));
      throw err;
    }
    
    console.log('✅ Paso 2/4: Certificado generado y autorizado en AFIP\n');
    console.log('📥 Paso 3/4: Descargando archivos...');

    // Crear directorio si no existe
    const certDir = path.join(process.cwd(), 'certificados');
    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir, { recursive: true });
    }

    // Los archivos se guardan automáticamente por el SDK en:
    // Afip_SDK/keys/{CUIT}.crt y {CUIT}.key
    const sdkKeysDir = path.join(process.cwd(), 'Afip_SDK', 'keys');
    
    // Esperar un momento para que se escriban los archivos
    await new Promise(resolve => setTimeout(resolve, 2000));

    const certPath = path.join(sdkKeysDir, `${cuit}.crt`);
    const keyPath = path.join(sdkKeysDir, `${cuit}.key`);

    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      // Leer certificados
      const cert = fs.readFileSync(certPath, 'utf8');
      const key = fs.readFileSync(keyPath, 'utf8');

      // Copiar a certificados/
      fs.copyFileSync(certPath, path.join(certDir, `${cuit}.crt`));
      fs.copyFileSync(keyPath, path.join(certDir, `${cuit}.key`));

      console.log(`✅ Certificado guardado: certificados/${cuit}.crt`);
      console.log(`✅ Clave privada guardada: certificados/${cuit}.key\n`);

      console.log('=' .repeat(60));
      console.log('✅ Paso 4/4: ¡CERTIFICADOS GENERADOS EXITOSAMENTE!');
      console.log('=' .repeat(60) + '\n');

      console.log('📋 PRÓXIMOS PASOS:\n');
      console.log('1️⃣  Ve a Vercel → Settings → Environment Variables\n');
      console.log('2️⃣  Actualiza estas variables:\n');
      
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║ Variable: AFIP_CERT_PEM                                    ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log(cert);
      console.log('');
      
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║ Variable: AFIP_KEY_PEM                                     ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log(key);
      console.log('');

      console.log('3️⃣  Guarda los cambios y haz Redeploy\n');
      console.log('=' .repeat(60));
      console.log('🎉 ¡TODO LISTO! La facturación electrónica funcionará después del deploy.');
      console.log('=' .repeat(60));

    } else {
      console.error('❌ Error: No se encontraron los archivos generados');
      console.log(`Buscando en: ${sdkKeysDir}`);
      console.log('Archivos disponibles:', fs.readdirSync(sdkKeysDir));
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.response) {
      console.error('Respuesta del servidor:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('\nStack:', error.stack);
  }
}

// Ejecutar
generateProductionCert()
  .then(() => {
    console.log('\n✅ Proceso completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });

