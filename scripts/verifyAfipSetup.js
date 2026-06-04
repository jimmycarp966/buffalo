/**
 * Script para verificar la configuración de AFIP
 */

const { createClient } = require('@supabase/supabase-js');

// Cargar variables de entorno
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
let SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
let SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split(/\r?\n/);
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([^=]+)=(.+)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        
        if (key === 'NEXT_PUBLIC_SUPABASE_URL') {
          SUPABASE_URL = value;
        } else if (key === 'SUPABASE_SERVICE_ROLE_KEY') {
          SUPABASE_SERVICE_KEY = value;
        }
      }
    }
  }
}

async function verifySetup() {
  console.log('🔍 Verificando configuración de AFIP\n');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Faltan variables de entorno');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // 1. Verificar configuración en app_settings
  console.log('📋 1. Verificando app_settings...');
  const { data: settings, error: settingsError } = await supabase
    .from('app_settings')
    .select('*')
    .in('key', ['afip_cuit', 'afip_point_of_sale', 'afip_cert_path', 'afip_passphrase', 'afip_environment']);

  if (settingsError) {
    console.error('❌ Error:', settingsError.message);
    return;
  }

  if (!settings || settings.length === 0) {
    console.error('❌ No hay configuración de AFIP en app_settings');
    console.log('\n💡 Ejecuta el SQL: supabase/SETUP_AFIP_CONFIG.sql');
    return;
  }

  console.log('✅ Configuración encontrada:');
  const config = {};
  settings.forEach(s => {
    config[s.key] = s.value;
    if (s.key === 'afip_passphrase') {
      console.log(`   - ${s.key}: ******** (oculta)`);
    } else {
      console.log(`   - ${s.key}: ${s.value}`);
    }
  });

  // 2. Verificar certificado en Storage
  console.log('\n📦 2. Verificando certificado en Storage...');
  const certPath = config.afip_cert_path;
  
  if (!certPath) {
    console.error('❌ No hay ruta de certificado configurada');
    return;
  }

  const { data: fileData, error: fileError } = await supabase.storage
    .from('private-files')
    .list('afip');

  if (fileError) {
    console.error('❌ Error al listar archivos:', fileError.message);
    console.log('\n💡 ¿Existe el bucket "private-files"?');
    console.log('   Ve a Supabase Dashboard > Storage y verifica');
    return;
  }

  const fileName = certPath.split('/').pop();
  const certExists = fileData.some(f => f.name === fileName);

  if (!certExists) {
    console.error(`❌ Certificado NO encontrado: ${certPath}`);
    console.log('\n💡 Archivos en afip/:');
    fileData.forEach(f => console.log(`   - ${f.name}`));
    console.log('\n   Sube el certificado ejecutando: node scripts/uploadAfipCert.js');
    return;
  }

  console.log(`✅ Certificado encontrado: ${certPath}`);

  // 3. Intentar descargar certificado
  console.log('\n🔐 3. Verificando descarga de certificado...');
  const { data: downloadData, error: downloadError } = await supabase.storage
    .from('private-files')
    .download(certPath);

  if (downloadError) {
    console.error('❌ Error al descargar certificado:', downloadError.message);
    return;
  }

  const certSize = downloadData.size;
  console.log(`✅ Certificado descargado: ${(certSize / 1024).toFixed(2)} KB`);

  // Resumen
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN');
  console.log('='.repeat(60));
  console.log('✅ Configuración: OK');
  console.log('✅ Certificado en Storage: OK');
  console.log('✅ Certificado descargable: OK');
  console.log('\n🎯 Siguiente paso: Prueba el Test AFIP desde la app');
  console.log('   Si aún falla, verifica:');
  console.log('   1. La contraseña del certificado es correcta');
  console.log('   2. El certificado no está corrupto o vencido');
  console.log('   3. El servicio wsfev1 está autorizado en ARCA');
}

verifySetup().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

