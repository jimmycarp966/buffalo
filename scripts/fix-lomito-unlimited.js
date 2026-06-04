/**
 * Script para activar stock ilimitado en productos de lomito
 */

// Simular la conexión a Supabase usando fetch
async function fixLomitoProducts() {
  try {
    console.log('🔍 Buscando productos de lomito...');
    
    // Hacer una petición a la API de productos
    const response = await fetch('http://localhost:3000/api/products');
    const result = await response.json();
    
    if (!result.success) {
      console.error('❌ Error obteniendo productos:', result);
      return;
    }
    
    const products = result.data;
    console.log(`📋 Total de productos: ${products.length}`);
    
    // Buscar productos de lomito
    const lomitoProducts = products.filter(p => 
      p.name.toLowerCase().includes('lomito')
    );
    
    console.log('🍔 Productos de lomito encontrados:');
    lomitoProducts.forEach(product => {
      console.log(`- ${product.name} (ID: ${product.id}) - Stock Ilimitado: ${product.unlimited_stock}`);
    });
    
    // Verificar si "lomito comun con papas" tiene stock ilimitado
    const lomitoComun = lomitoProducts.find(p => 
      p.name.toLowerCase().includes('lomito comun con papas')
    );
    
    if (!lomitoComun) {
      console.log('⚠️ No se encontró "lomito comun con papas"');
      console.log('💡 Productos similares:');
      lomitoProducts.forEach(p => console.log(`  - ${p.name}`));
      return;
    }
    
    console.log(`\n🎯 Producto encontrado: ${lomitoComun.name}`);
    console.log(`   ID: ${lomitoComun.id}`);
    console.log(`   Stock Ilimitado: ${lomitoComun.unlimited_stock}`);
    
    if (lomitoComun.unlimited_stock) {
      console.log('✅ El producto ya tiene stock ilimitado activado');
      console.log('💡 El campo de personalización debería aparecer');
    } else {
      console.log('⚠️ El producto NO tiene stock ilimitado activado');
      console.log('🔧 Necesitas activarlo desde la interfaz:');
      console.log('   1. Ve a "Productos" en el menú');
      console.log('   2. Busca "lomito comun con papas"');
      console.log('   3. Haz click en "Editar"');
      console.log('   4. Marca la casilla "Stock Ilimitado"');
      console.log('   5. Guarda los cambios');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar el script
fixLomitoProducts();
