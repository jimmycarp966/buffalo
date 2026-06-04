/**
 * Script de prueba para la impresora térmica Gadnic IMP30
 * Ejecutar con: node scripts/test-thermal-printer.js
 */

// Simular datos de prueba
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
    },
    {
      name: "Pizza Margherita",
      quantity: 1,
      customization: "Sin aceitunas, bien cocida"
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

// Ejecutar prueba
console.log("🧪 Iniciando prueba de impresora térmica...");
console.log("📋 Datos de prueba:");
console.log(JSON.stringify(testOrder, null, 2));

console.log("\n🖨️ Contenido del ticket:");
console.log("=" * 40);
console.log(generateTicketContent(testOrder));
console.log("=" * 40);

console.log("\n✅ Prueba completada. Revisa el contenido del ticket arriba.");
console.log("💡 Para probar con impresora real, ejecuta el sistema y agrega un producto con opciones.");
