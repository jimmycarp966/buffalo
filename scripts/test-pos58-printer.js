/**
 * Script de prueba para la impresora térmica POS-58
 * Ejecutar con: node scripts/test-pos58-printer.js
 */

const { exec } = require('child_process');

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
  content += centerText("SHELL SHOP") + "\n";
  content += centerText("🍺 BAR - PEDIDO DE COCINA") + "\n";
  content += drawLine() + "\n";
  
  // Información de la mesa
  content += `MESA: ${tableNumber}\n`;
  content += `HORA: ${timestamp}\n`;
  content += drawLine() + "\n";
  
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
  
  content += drawLine() + "\n";
  content += "\n\n\n"; // Espacio para cortar
  
  return content;
}

function centerText(text, width = 32) {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return " ".repeat(padding) + text;
}

function drawLine(char = "-", width = 32) {
  return char.repeat(width);
}

// Función para imprimir usando PowerShell
function printToPOS58(content) {
  return new Promise((resolve, reject) => {
    // Crear un archivo temporal con el contenido
    const fs = require('fs');
    const path = require('path');
    const tempFile = path.join(__dirname, 'temp_ticket.txt');
    
    // Escribir contenido al archivo temporal
    fs.writeFileSync(tempFile, content, 'utf8');
    
    // Comando para imprimir en POS-58 (escapando comillas)
    const command = `Get-Content '${tempFile}' | Out-Printer -Name 'POS-58'`;
    
    console.log('🖨️ Enviando a impresora POS-58...');
    console.log('📄 Contenido del ticket:');
    console.log(content);
    
    exec(`powershell -Command "${command}"`, (error, stdout, stderr) => {
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
        console.log('📤 Salida:', stdout);
        if (stderr) console.log('⚠️ Advertencias:', stderr);
        resolve(stdout);
      }
    });
  });
}

// Ejecutar prueba
async function runTest() {
  console.log('🧪 Iniciando prueba de impresora POS-58...');
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
  }
}

runTest();
