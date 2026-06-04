/**
 * Script para subir el certificado .p12 a Supabase Storage
 * Ejecuta: node scripts/uploadAfipCert.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Cargar variables de entorno desde .env.local
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

// CONFIGURACIÓN
const CERT_PATH = path.join(__dirname, 'certificados', '20316756734.p12');

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  console.log('\n💡 Agrega estas variables a tu archivo .env.local:');
  console.log('   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co');
  console.log('   SUPABASE_SERVICE_ROLE_KEY=eyJxxx...');
  process.exit(1);
}

async function uploadCertificate() {
  try {
    console.log('🔐 Script para subir certificado AFIP a Supabase Storage\n');

    // Verificar que el archivo existe
    if (!fs.existsSync(CERT_PATH)) {
      console.error(`❌ Error: No se encontró el archivo: ${CERT_PATH}`);
      console.log('\n💡 Asegúrate de haber generado el certificado primero:');
      console.log('   node scripts/generate-certificate.js');
      process.exit(1);
    }

    console.log(`📄 Archivo encontrado: ${CERT_PATH}`);
    const stats = fs.statSync(CERT_PATH);
    console.log(`   Tamaño: ${(stats.size / 1024).toFixed(2)} KB\n`);

    // Crear cliente de Supabase con service role key (bypass RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log('🔍 Verificando bucket...');

    // Verificar/crear bucket
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Error listando buckets:', listError);
      process.exit(1);
    }

    const privateBucket = buckets.find((b) => b.name === 'private-files');

    if (!privateBucket) {
      console.log('📦 Creando bucket privado...');
      const { error: createError } = await supabase.storage.createBucket('private-files', {
        public: false,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['application/x-pkcs12', 'application/octet-stream'],
      });

      if (createError) {
        console.error('❌ Error creando bucket:', createError);
        process.exit(1);
      }
      console.log('✅ Bucket creado\n');
    } else {
      console.log('✅ Bucket ya existe\n');
    }

    // Leer archivo
    console.log('📤 Subiendo certificado...');
    const fileBuffer = fs.readFileSync(CERT_PATH);
    const fileName = path.basename(CERT_PATH);
    const storagePath = `afip/${fileName}`;

    // Subir archivo
    const { error: uploadError } = await supabase.storage
      .from('private-files')
      .upload(storagePath, fileBuffer, {
        contentType: 'application/x-pkcs12',
        upsert: true,
      });

    if (uploadError) {
      console.error('❌ Error subiendo certificado:', uploadError);
      process.exit(1);
    }

    console.log('✅ Certificado subido exitosamente!\n');
    console.log('📋 Información del certificado:');
    console.log(`   Ruta en Storage: ${storagePath}`);
    console.log(`   Bucket: private-files\n`);

    console.log('📝 Próximos pasos:');
    console.log('   1. Ejecuta el script SQL de configuración:');
    console.log('      Abre Supabase Dashboard > SQL Editor');
    console.log('      Copia y ejecuta: supabase/SETUP_AFIP_CONFIG.sql');
    console.log('   2. Ajusta los valores según tu configuración');
    console.log('   3. Verifica que el servicio wsfev1 esté autorizado en ARCA');
    console.log('   4. Prueba la integración desde la app\n');

    console.log('⚠️  IMPORTANTE: Guarda la contraseña del certificado de forma segura!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

uploadCertificate();

