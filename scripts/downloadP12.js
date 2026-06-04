/**
 * Script para descargar el .p12 de Supabase Storage
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Leer manualmente .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=:#]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let value = match[2].trim().replace(/^['"]|['"]$/g, '');
    // Quitar todos los espacios en blanco al final
    value = value.trim();
    env[key] = value;
  }
});

function requireSecret(name) {
  const value = process.env[name] || env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno requerida: ${name}`);
  }
  return value;
}

async function downloadP12() {
  try {
    console.log('📥 Descargando certificado .p12 desde Supabase...\n');

    // Credenciales desde variables de entorno / .env.local (nunca hardcodear secretos)
    const supabaseUrl = requireSecret('NEXT_PUBLIC_SUPABASE_URL');
    const supabaseKey = requireSecret('SUPABASE_SERVICE_ROLE_KEY');

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Descargar el archivo
    const { data, error } = await supabase.storage
      .from('private-files')
      .download('afip/20316756734.p12');

    if (error || !data) {
      throw new Error(`Error descargando: ${error?.message || 'No data'}`);
    }

    console.log('✅ Archivo descargado:', data.size, 'bytes');

    // Guardar localmente
    const certDir = path.join(__dirname, '..', 'certificados');
    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir, { recursive: true });
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    const p12Path = path.join(certDir, '20316756734.p12');
    fs.writeFileSync(p12Path, buffer);

    console.log('💾 Guardado en:', p12Path);
    console.log('\n✨ ¡Descarga exitosa!');
    console.log('\n📋 Siguiente paso:');
    console.log('   Ejecuta: node scripts/convertP12ToPem.js\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

downloadP12();

