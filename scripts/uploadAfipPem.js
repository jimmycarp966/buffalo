/**
 * Script para subir archivos PEM de AFIP a Supabase Storage
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno requerida: ${name}`);
  }
  return value;
}

async function uploadPemFiles() {
  try {
    console.log('📤 Subiendo archivos PEM a Supabase Storage...\n');

    // Credenciales desde variables de entorno (nunca hardcodear secretos)
    const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
    const supabaseKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Leer los archivos PEM
    const certPath = path.join(__dirname, '..', 'certificados', '20316756734.cert.pem');
    const keyPath = path.join(__dirname, '..', 'certificados', '20316756734.key.pem');

    const certContent = fs.readFileSync(certPath, 'utf8');
    const keyContent = fs.readFileSync(keyPath, 'utf8');

    console.log('📄 Certificado leído:', certContent.length, 'caracteres');
    console.log('🔐 Clave privada leída:', keyContent.length, 'caracteres\n');

    // Subir certificado
    console.log('1️⃣  Subiendo certificado...');
    const { error: certError } = await supabase.storage
      .from('private-files')
      .upload('afip/cert.pem', certContent, {
        contentType: 'text/plain',
        upsert: true
      });

    if (certError) {
      throw new Error(`Error subiendo certificado: ${certError.message}`);
    }
    console.log('✅ Certificado subido\n');

    // Subir clave privada
    console.log('2️⃣  Subiendo clave privada...');
    const { error: keyError } = await supabase.storage
      .from('private-files')
      .upload('afip/key.pem', keyContent, {
        contentType: 'text/plain',
        upsert: true
      });

    if (keyError) {
      throw new Error(`Error subiendo clave: ${keyError.message}`);
    }
    console.log('✅ Clave privada subida\n');

    console.log('✨ ¡Archivos subidos exitosamente!\n');
    console.log('📋 SIGUIENTE PASO:');
    console.log('   El código ya está listo para usar los archivos PEM desde Storage.');
    console.log('   Compila y haz push:\n');
    console.log('   npm run build');
    console.log('   git add .');
    console.log('   git commit -m "feat: Usar archivos PEM válidos para AFIP"');
    console.log('   git push origin main\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

uploadPemFiles();

