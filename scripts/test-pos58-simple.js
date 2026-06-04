/**
 * Script de prueba simple para la impresora POS-58
 * Usa el mismo enfoque que el sistema existente
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Datos de prueba
const testOrder = {
  tableNumber: 5,
  items: [
    {
      name: "Lomito Especial",
      quantity: 2,
      customization: "Picante, sin lechuga, extra tomate"
    },
    {
      name: "Hamburguesa Clásica",
      quantity: 1,
      customization: "Extra queso, sin cebolla"
    }
  ],
  timestamp: new Date().toLocaleString('es-ES')
};

// Función para generar contenido del ticket
function generateTicketContent(printData) {
  const { tableNumber, items, timestamp } = printData;
  
  let content = "";
  
  // Encabezado
  content += "           SHELL SHOP\n";
  content += "   🍺 BAR - PEDIDO DE COCINA\n";
  content += "--------------------------------\n";
  
  // Información de la mesa
  content += `MESA: ${tableNumber}\n`;
  content += `HORA: ${timestamp}\n`;
  content += "--------------------------------\n";
  
  // Items del pedido
  content += "PEDIDO:\n";
  items.forEach((item, index) => {
    content += `${index + 1}. ${item.name} x${item.quantity}\n`;
    
    // Mostrar personalizaciones si las hay
    if (item.customization && item.customization.trim()) {
      content += `   NOTA: ${item.customization}\n`;
    }
    content += "\n";
  });
  
  content += "--------------------------------\n";
  content += "\n\n\n"; // Espacio para cortar
  
  return content;
}

// Función para imprimir usando el comando lpr de Windows
function printToPOS58(content) {
  return new Promise((resolve, reject) => {
    // Crear un archivo temporal con el contenido
    const tempFile = path.join(__dirname, 'temp_ticket.txt');
    
    // Escribir contenido al archivo temporal
    fs.writeFileSync(tempFile, content, 'utf8');
    
    console.log('🖨️ Enviando a impresora POS-58...');
    console.log('📄 Contenido del ticket:');
    console.log(content);
    
    // Usar el comando lpr de Windows
    const command = `lpr -P "POS-58" "${tempFile}"`;
    
    exec(command, (error, stdout, stderr) => {
      // Limpiar archivo temporal
      try {
        fs.unlinkSync(tempFile);
      } catch (cleanupError) {
        console.warn('⚠️ No se pudo eliminar archivo temporal:', cleanupError.message);
      }
      
      if (error) {
        console.error('❌ Error al imprimir:', error.message);
        reject(error);
      } else {
        console.log('✅ Ticket enviado a POS-58');
        if (stdout) console.log('📤 Salida:', stdout);
        if (stderr) console.log('⚠️ Advertencias:', stderr);
        resolve(stdout);
      }
    });
  });
}

// Ejecutar prueba
async function runTest() {
  console.log('🧪 Iniciando prueba simple de impresora POS-58...');
  console.log('📋 Datos de prueba:');
  console.log(JSON.stringify(testOrder, null, 2));
  
  const ticketContent = generateTicketContent(testOrder);
  
  try {
    await printToPOS58(ticketContent);
    console.log('\n✅ ¡Prueba completada! Revisa si salió el ticket de la impresora POS-58.');
  } catch (error) {
    console.error('\n❌ Error en la prueba:', error.message);
    console.log('\n💡 Sugerencias:');
    console.log('1. Verifica que la impresora POS-58 esté encendida');
    console.log('2. Verifica que esté conectada por USB');
    console.log('3. Verifica que el driver esté instalado correctamente');
    console.log('4. Prueba imprimir un documento de prueba desde Windows');
  }
}

runTest();
