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

async function fixCashRegisterEnum() {
  console.log('🔧 Iniciando corrección del enum cash_register_type...');

  try {
    // Verificar valores actuales del enum
    console.log('📋 Verificando valores actuales del enum...');
    const { data: enumValues, error: enumError } = await supabase.rpc('get_enum_values', {
      enum_name: 'cash_register_type'
    });

    if (enumError) {
      console.log('⚠️ No se pudo verificar enum con RPC, intentando consulta directa...');

      // Intentar verificar directamente
      const { data: checkResult, error: checkError } = await supabase
        .from('cash_registers')
        .select('type')
        .limit(1);

      if (checkError) {
        console.error('❌ Error verificando tabla cash_registers:', checkError);
      } else {
        console.log('✅ Tabla cash_registers existe');
      }
    } else {
      console.log('📋 Valores actuales del enum:', enumValues);
    }

    // Ejecutar el script SQL para agregar 'bar' al enum
    console.log('🔄 Ejecutando actualización del enum...');

    const sqlScript = `
      -- Verificar y actualizar el enum cash_register_type para incluir 'bar'
      DO $$
      BEGIN
          -- Verificar si el enum ya incluye 'bar'
          IF NOT EXISTS (
              SELECT 1 FROM pg_enum e
              JOIN pg_type t ON e.enumtypid = t.oid
              WHERE t.typname = 'cash_register_type'
              AND e.enumlabel = 'bar'
          ) THEN
              -- Agregar 'bar' al enum existente
              ALTER TYPE cash_register_type ADD VALUE 'bar';
              RAISE NOTICE 'Valor ''bar'' agregado al enum cash_register_type';
          ELSE
              RAISE NOTICE 'El valor ''bar'' ya existe en el enum cash_register_type';
          END IF;
      END $$;

      -- Verificar el resultado
      SELECT
          e.enumlabel as value
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'cash_register_type'
      ORDER BY e.enumsortorder;
    `;

    // Ejecutar el SQL usando raw query
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: sqlScript
    });

    if (error) {
      console.error('❌ Error ejecutando SQL:', error);

      // Intentar método alternativo: probar directamente si podemos insertar un registro con type 'bar'
      console.log('🔄 Intentando método alternativo: probar inserción directa...');

      const { randomUUID } = require('crypto');
      const testInsert = await supabase
        .from('cash_registers')
        .insert({
          id: randomUUID(),
          name: 'Test Bar Register',
          type: 'bar',
          is_active: false
        });

      if (testInsert.error) {
        console.error('❌ Error en inserción de prueba:', testInsert.error);
        console.log('💡 Es posible que necesites ejecutar manualmente el SQL en Supabase Dashboard');
        console.log('📄 SQL a ejecutar:');
        console.log(sqlScript);
      } else {
        console.log('✅ Inserción de prueba exitosa, eliminando registro de prueba...');
        await supabase
          .from('cash_registers')
          .delete()
          .eq('id', 'test-bar-register');
      }
    } else {
      console.log('✅ SQL ejecutado exitosamente:', data);
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

// Ejecutar la función
fixCashRegisterEnum().then(() => {
  console.log('🏁 Script completado');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Error fatal:', error);
  process.exit(1);
});
