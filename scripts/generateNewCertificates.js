/**
 * Script para generar nuevos certificados AFIP desde cero
 * Genera: clave privada (.key) + CSR (.csr)
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');

const execPromise = promisify(exec);

const CUIT = '20316756734';
const EMPRESA = 'Buffalo';
const OPENSSL_PATH = 'C:\\Program Files\\Git\\usr\\bin\\openssl.exe';

async function generateNewCertificates() {
  try {
    console.log('🔐 Generando nuevos certificados AFIP\n');

    const certDir = path.join(__dirname, '..', 'certificados');
    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir, { recursive: true });
    }

    // Archivos de salida
    const keyFile = path.join(certDir, `${CUIT}-NEW.key`);
    const csrFile = path.join(certDir, `${CUIT}-NEW.csr`);

    // 1. Generar clave privada RSA de 2048 bits
    console.log('1️⃣  Generando clave privada RSA (2048 bits)...');
    const keyCmd = `"${OPENSSL_PATH}" genrsa -out "${keyFile}" 2048`;
    await execPromise(keyCmd);
    console.log('✅ Clave privada generada:', keyFile);
    console.log('   Tamaño:', fs.statSync(keyFile).size, 'bytes\n');

    // 2. Generar CSR (Certificate Signing Request)
    console.log('2️⃣  Generando CSR (Certificate Signing Request)...');
    const subject = `/C=AR/O=${EMPRESA}/CN=${EMPRESA}/serialNumber=CUIT ${CUIT}`;
    const csrCmd = `"${OPENSSL_PATH}" req -new -key "${keyFile}" -out "${csrFile}" -subj "${subject}"`;
    await execPromise(csrCmd);
    console.log('✅ CSR generado:', csrFile);
    console.log('   Tamaño:', fs.statSync(csrFile).size, 'bytes\n');

    // 3. Mostrar el CSR para verificar
    console.log('📄 Contenido del CSR generado:\n');
    const csrContent = fs.readFileSync(csrFile, 'utf8');
    console.log(csrContent);

    console.log('\n✨ ¡Certificados base generados exitosamente!\n');
    console.log('📋 SIGUIENTE PASO:');
    console.log('   1. Ve a: https://www.afip.gob.ar/ws/WSASS/');
    console.log('   2. Inicia sesión con CUIT y Clave Fiscal');
    console.log('   3. Administrador de Relaciones de Clave Fiscal');
    console.log('   4. Nueva Relación → Web Service');
    console.log('   5. Busca: "Factura Electrónica - Comprobantes en línea (wsfev1)"');
    console.log('   6. Sube el archivo:', csrFile);
    console.log('   7. Descarga el certificado (.crt) que ARCA te dará');
    console.log('   8. Guárdalo como:', path.join(certDir, `${CUIT}-NEW.crt`));
    console.log('\n   Cuando tengas el .crt, ejecuta:');
    console.log('   node scripts/createP12FromCrt.js\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

generateNewCertificates();

