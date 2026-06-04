const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase (usa las mismas variables de entorno que tu app)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Variables de entorno no encontradas');
  console.log('Asegúrate de tener configuradas:');
  console.log('- NEXT_PUBLIC_SUPABASE_URL');
  console.log('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixCashRegisterSchema() {
  console.log('🔧 Reparando esquema de cash_register_sessions...');

  try {
    // SQL para agregar la columna 'area' faltante
    const addAreaColumnSQL = `
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'cash_register_sessions'
              AND column_name = 'area'
          ) THEN
              ALTER TABLE cash_register_sessions ADD COLUMN area TEXT;
              CREATE INDEX IF NOT EXISTS idx_cash_register_sessions_area ON cash_register_sessions(area);
              UPDATE cash_register_sessions SET area = 'bar' WHERE area IS NULL;
              RAISE NOTICE 'Columna area agregada exitosamente';
          ELSE
              RAISE NOTICE 'La columna area ya existe';
          END IF;
      END $$;
    `;

    console.log('📝 Ejecutando SQL para agregar columna area...');
    const { error: areaError } = await supabase.rpc('exec_sql', { sql: addAreaColumnSQL });

    if (areaError) {
      console.error('❌ Error agregando columna area:', areaError);
      throw areaError;
    }

    // Verificar que se agregó correctamente
    const { data: columns, error: checkError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'cash_register_sessions')
      .eq('column_name', 'area');

    if (checkError) {
      console.error('❌ Error verificando columna:', checkError);
      throw checkError;
    }

    if (columns && columns.length > 0) {
      console.log('✅ Columna area agregada correctamente:', columns[0]);
    } else {
      console.log('⚠️ No se pudo verificar la columna area');
    }

    console.log('🎉 Esquema reparado exitosamente!');
    console.log('Ahora puedes probar la aplicación sin el error de columna faltante.');

  } catch (error) {
    console.error('❌ Error reparando esquema:', error);
    console.log('');
    console.log('🔧 Solución alternativa: Ejecuta manualmente en Supabase SQL Editor:');
    console.log(`
-- Agregar columna 'area' faltante
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cash_register_sessions'
        AND column_name = 'area'
    ) THEN
        ALTER TABLE cash_register_sessions ADD COLUMN area TEXT;
        CREATE INDEX IF NOT EXISTS idx_cash_register_sessions_area ON cash_register_sessions(area);
        UPDATE cash_register_sessions SET area = 'bar' WHERE area IS NULL;
    END IF;
END $$;

-- Verificar
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'cash_register_sessions' AND column_name = 'area';
    `);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  fixCashRegisterSchema();
}

module.exports = { fixCashRegisterSchema };




