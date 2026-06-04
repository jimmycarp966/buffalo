/**
 * Script para mostrar las variables de entorno que deben configurarse en Vercel
 */

const fs = require('fs');
const path = require('path');

console.log('📋 VARIABLES DE ENTORNO PARA CONFIGURAR EN VERCEL\n');
console.log('=' . repeat(60));
console.log('\n🔧 Ve a: https://vercel.com/tu-proyecto/settings/environment-variables\n');

// Leer certificados PEM
const certPath = path.join(__dirname, '..', 'certificados', '20316756734.cert.pem');
const keyPath = path.join(__dirname, '..', 'certificados', '20316756734.key.pem');

const certContent = fs.readFileSync(certPath, 'utf8');
const keyContent = fs.readFileSync(keyPath, 'utf8');

console.log('1️⃣  AFIP_CERT_PEM');
console.log('   Valor:\n');
console.log(certContent);
console.log('\n' + '─'.repeat(60) + '\n');

console.log('2️⃣  AFIP_KEY_PEM');
console.log('   Valor:\n');
console.log(keyContent);
console.log('\n' + '─'.repeat(60) + '\n');

console.log('⚠️  IMPORTANTE:');
console.log('   - Copia EXACTAMENTE el contenido (incluyendo -----BEGIN y -----END)');
console.log('   - NO agregues espacios ni saltos de línea adicionales');
console.log('   - Configura ambas variables en el ambiente "Production"');
console.log('   - Después de guardar, haz un nuevo deploy desde Vercel dashboard\n');

