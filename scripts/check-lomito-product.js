/**
 * Script para verificar y actualizar el producto "lomito comun con papas"
 * para que tenga stock ilimitado y muestre el campo de personalización
 */

const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno de Supabase no encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndUpdateLomito() {
  try {
    console.log('🔍 Buscando producto "lomito comun con papas"...');
    
    // Buscar el producto
    const { data: products, error: searchError } = await supabase
      .from('products')
      .select('id, name, unlimited_stock')
      .ilike('name', '%lomito%');
    
    if (searchError) {
      console.error('❌ Error buscando productos:', searchError);
      return;
    }
    
    console.log('📋 Productos encontrados:');
    products.forEach(product => {
      console.log(`- ${product.name} (ID: ${product.id}) - Stock Ilimitado: ${product.unlimited_stock}`);
    });
    
    // Buscar específicamente "lomito comun con papas"
    const lomitoProduct = products.find(p => 
      p.name.toLowerCase().includes('lomito') && 
      p.name.toLowerCase().includes('comun')
    );
    
    if (!lomitoProduct) {
      console.log('⚠️ No se encontró "lomito comun con papas"');
      console.log('💡 Productos similares encontrados:');
      products.forEach(p => console.log(`  - ${p.name}`));
      return;
    }
    
    console.log(`\n🎯 Producto encontrado: ${lomitoProduct.name}`);
    console.log(`   ID: ${lomitoProduct.id}`);
    console.log(`   Stock Ilimitado: ${lomitoProduct.unlimited_stock}`);
    
    if (lomitoProduct.unlimited_stock) {
      console.log('✅ El producto ya tiene stock ilimitado activado');
      console.log('💡 El campo de personalización debería aparecer en el carrito');
    } else {
      console.log('⚠️ El producto NO tiene stock ilimitado activado');
      console.log('🔧 Activando stock ilimitado...');
      
      // Actualizar el producto
      const { error: updateError } = await supabase
        .from('products')
        .update({ unlimited_stock: true })
        .eq('id', lomitoProduct.id);
      
      if (updateError) {
        console.error('❌ Error actualizando producto:', updateError);
        return;
      }
      
      console.log('✅ Stock ilimitado activado exitosamente');
      console.log('💡 Ahora el campo de personalización debería aparecer');
    }
    
  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

// Ejecutar el script
checkAndUpdateLomito();
