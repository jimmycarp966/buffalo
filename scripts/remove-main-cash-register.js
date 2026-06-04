const { createClient } = require('@supabase/supabase-js');

// Cargar variables de entorno
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes:');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function removeMainCashRegister() {
  console.log('🔧 Eliminando caja "main" de la base de datos...');

  try {
    // Buscar la caja "main"
    console.log('🔍 Buscando caja de tipo "main"...');
    const { data: mainRegisters, error: findError } = await supabase
      .from('cash_registers')
      .select('*')
      .eq('type', 'main');

    if (findError) {
      console.error('❌ Error buscando cajas "main":', findError);
      return;
    }

    console.log('📋 Cajas "main" encontradas:', mainRegisters?.length || 0);

    if (!mainRegisters || mainRegisters.length === 0) {
      console.log('ℹ️ No hay cajas "main" para eliminar');
      return;
    }

    // Mostrar las cajas que se van a eliminar
    mainRegisters.forEach(register => {
      console.log(`🗑️ Preparando eliminación: ${register.name} (ID: ${register.id})`);
    });

    // Eliminar las cajas "main"
    console.log('🗑️ Eliminando cajas "main"...');
    const { data: deletedRegisters, error: deleteError } = await supabase
      .from('cash_registers')
      .delete()
      .eq('type', 'main')
      .select();

    if (deleteError) {
      console.error('❌ Error eliminando cajas "main":', deleteError);
      return;
    }

    console.log('✅ Cajas "main" eliminadas exitosamente:', deletedRegisters?.length || 0);

    // Verificar que solo queda "bar"
    console.log('🔍 Verificando cajas restantes...');
    const { data: remainingRegisters, error: remainingError } = await supabase
      .from('cash_registers')
      .select('*');

    if (remainingError) {
      console.error('❌ Error verificando cajas restantes:', remainingError);
      return;
    }

    console.log('📋 Cajas restantes:');
    remainingRegisters?.forEach(register => {
      console.log(`  • ${register.name} (${register.type}) - ID: ${register.id}`);
    });

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

// Ejecutar la función
removeMainCashRegister().then(() => {
  console.log('🏁 Script completado');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Error fatal:', error);
  process.exit(1);
});




