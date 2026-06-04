/**
 * Script para generar certificado digital para ARCA/AFIP
 * Este script genera la clave privada y el CSR usando Node.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// CONFIGURACIÓN - Modifica estos valores
const CUIT = '20317657634'; // Tu CUIT sin guiones
const EMPRESA = 'BUFFO JUAN IGNACIO'; // Nombre de tu empresa
const ALIAS = 'Buffalo'; // Alias para el certificado

console.log('🔐 Generador de Certificado Digital para ARCA/AFIP\n');
console.log('📋 Configuración:');
console.log(`   CUIT: ${CUIT}`);
console.log(`   Empresa: ${EMPRESA}`);
console.log(`   Alias: ${ALIAS}\n`);

// Crear directorio para certificados si no existe
const certDir = path.join(__dirname, 'certificados');
if (!fs.existsSync(certDir)) {
  fs.mkdirSync(certDir, { recursive: true });
  console.log('✅ Directorio de certificados creado\n');
}

try {
  // 1. Generar clave privada RSA 2048 bits
  console.log('🔑 Generando clave privada...');
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  const keyPath = path.join(certDir, `${CUIT}.key`);
  fs.writeFileSync(keyPath, privateKey);
  console.log(`✅ Clave privada guardada: ${keyPath}\n`);

  // 2. Generar CSR (Certificate Signing Request)
  console.log('📝 Generando solicitud de certificado (CSR)...');
  
  // Crear subject para el CSR
  const subject = `/C=AR/O=${EMPRESA}/CN=LOCALHOST/serialNumber=CUIT ${CUIT}`;
  
  // Usar OpenSSL si está disponible, sino usar Node.js
  const opensslPath = findOpenSSL();
  
  if (opensslPath) {
    // Usar OpenSSL para generar CSR (más estándar)
    const { execSync } = require('child_process');
    const csrPath = path.join(certDir, `${CUIT}.csr`);
    
    // Guardar clave privada temporalmente en formato PEM para OpenSSL
    const tempKeyPath = path.join(certDir, 'temp.key');
    fs.writeFileSync(tempKeyPath, privateKey);
    
    try {
      execSync(
        `"${opensslPath}" req -new -key "${tempKeyPath}" -subj "${subject}" -out "${csrPath}"`,
        { stdio: 'inherit' }
      );
      
      // Eliminar archivo temporal
      fs.unlinkSync(tempKeyPath);
      
      console.log(`✅ CSR generado: ${csrPath}\n`);
      
      // Mostrar contenido del CSR
      const csrContent = fs.readFileSync(csrPath, 'utf8');
      console.log('📄 Contenido del CSR:');
      console.log('─'.repeat(60));
      console.log(csrContent);
      console.log('─'.repeat(60));
      
    } catch (error) {
      console.error('❌ Error al generar CSR con OpenSSL:', error.message);
      console.log('\n⚠️ Intentando método alternativo...\n');
      generateCSRWithNode(certDir, CUIT, subject, privateKey);
    }
  } else {
    console.log('⚠️ OpenSSL no encontrado, usando método alternativo...\n');
    generateCSRWithNode(certDir, CUIT, subject, privateKey);
  }

  console.log('\n✅ Proceso completado!\n');
  console.log('📋 Próximos pasos:');
  console.log('   1. Ve a ARCA: https://www.afip.gob.ar/');
  console.log('   2. Accede a "Administración de Certificados Digitales"');
  console.log(`   3. Sube el archivo: ${path.join(certDir, `${CUIT}.csr`)}`);
  console.log(`   4. Usa el alias: ${ALIAS}`);
  console.log('   5. Descarga el certificado .crt');
  console.log(`   6. Ejecuta el siguiente comando para crear el .p12:`);
  console.log(`      openssl pkcs12 -export -out certificados/${CUIT}.p12 -inkey certificados/${CUIT}.key -in certificados/${CUIT}.crt -passout pass:TU_CONTRASEÑA`);
  console.log('\n⚠️ IMPORTANTE: Guarda la clave privada (.key) de forma segura!');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

function findOpenSSL() {
  const possiblePaths = [
    'openssl', // En PATH
    'C:\\Program Files\\Git\\usr\\bin\\openssl.exe', // Git Bash
    'C:\\Program Files (x86)\\Git\\usr\\bin\\openssl.exe', // Git Bash 32-bit
    'C:\\OpenSSL-Win64\\bin\\openssl.exe',
    'C:\\OpenSSL-Win32\\bin\\openssl.exe',
  ];

  const { execSync } = require('child_process');
  
  for (const opensslPath of possiblePaths) {
    try {
      if (opensslPath === 'openssl') {
        execSync('openssl version', { stdio: 'ignore' });
        return 'openssl';
      } else if (fs.existsSync(opensslPath)) {
        return opensslPath;
      }
    } catch (e) {
      // Continuar buscando
    }
  }
  
  return null;
}

function generateCSRWithNode(certDir, CUIT, subject, privateKey) {
  console.log('⚠️ Método alternativo: Node.js puede generar la clave pero no el CSR directamente.');
  console.log('   Necesitas OpenSSL para generar el CSR.');
  console.log('\n💡 Opciones:');
  console.log('   1. Instalar Git Bash (incluye OpenSSL): https://git-scm.com/download/win');
  console.log('   2. Usar una herramienta online (solo para desarrollo):');
  console.log('      https://www.sslshopper.com/csr-generator.html');
  console.log('   3. Usar PowerShell con certificados (más complejo)');
  console.log('\n📄 La clave privada ya está guardada, puedes usarla después.');
}




