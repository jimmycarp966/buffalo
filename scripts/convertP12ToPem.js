/**
 * Script para convertir .p12 a PEM usando OpenSSL
 * Se ejecuta LOCALMENTE, no en Vercel
 */

const pem = require('pem');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

// Configurar ruta de OpenSSL (Git Bash en Windows)
pem.config({
  pathOpenSSL: 'C:\\Program Files\\Git\\usr\\bin\\openssl.exe'
});

const readPkcs12 = promisify(pem.readPkcs12);

async function convertP12ToPem() {
  try {
    console.log('🔑 Convirtiendo certificado .p12 a PEM...\n');

    // Leer el archivo .p12
    const p12Path = path.join(__dirname, '..', 'certificados', '20316756734.p12');
    
    if (!fs.existsSync(p12Path)) {
      throw new Error(`Archivo no encontrado: ${p12Path}`);
    }
    
    const p12Buffer = fs.readFileSync(p12Path);
    console.log('✅ Archivo .p12 leído:', p12Buffer.length, 'bytes');

    // Contraseña del certificado desde variable de entorno (nunca hardcodear la passphrase del .p12)
    const passphrase = process.env.AFIP_P12_PASSWORD;
    if (!passphrase) {
      throw new Error('Falta la variable de entorno requerida: AFIP_P12_PASSWORD');
    }

    // Convertir usando pem (usa OpenSSL local)
    console.log('⚙️  Extrayendo certificado y clave...');
    const pemData = await readPkcs12(p12Buffer, { p12Password: passphrase });

    if (!pemData.cert || !pemData.key) {
      throw new Error('No se pudo extraer el certificado o la clave');
    }

    console.log('✅ Certificado extraído:', pemData.cert.length, 'caracteres');
    console.log('✅ Clave privada extraída:', pemData.key.length, 'caracteres\n');

    // Guardar los archivos PEM
    const certPath = path.join(__dirname, '..', 'certificados', '20316756734.cert.pem');
    const keyPath = path.join(__dirname, '..', 'certificados', '20316756734.key.pem');

    fs.writeFileSync(certPath, pemData.cert);
    fs.writeFileSync(keyPath, pemData.key);

    console.log('💾 Archivos PEM guardados:');
    console.log('  📄', certPath);
    console.log('  🔐', keyPath);
    console.log('\n✨ ¡Conversión exitosa!');
    console.log('\n📋 Siguiente paso:');
    console.log('   Ejecuta: node scripts/uploadAfipPem.js\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

convertP12ToPem();

