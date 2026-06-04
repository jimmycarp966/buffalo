/**
 * Script para cambiar AFIP a modo PRODUCCIÓN
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

async function updateToProduction() {
  try {
    console.log('🔧 Actualizando AFIP a modo PRODUCCIÓN...\n');

    // Credenciales desde variables de entorno (nunca hardcodear secretos)
    const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
    const supabaseKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Actualizar a producción
    const { error } = await supabase
      .from('app_settings')
      .update({ value: 'production' })
      .eq('key', 'afip_environment');

    if (error) {
      throw error;
    }

    console.log('✅ AFIP actualizado a modo PRODUCCIÓN\n');
    console.log('⚠️  IMPORTANTE:');
    console.log('   - Ahora usarás el servidor REAL de AFIP');
    console.log('   - Las facturas generadas serán REALES y válidas');
    console.log('   - Asegúrate de tener el punto de venta correcto (actualmente: 3)\n');
    console.log('📋 Siguiente paso:');
    console.log('   Compila y haz push para aplicar en Vercel:\n');
    console.log('   npm run build && git add . && git commit -m "config: AFIP en producción" && git push\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateToProduction();

