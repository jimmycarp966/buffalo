import fs from 'fs';
import path from 'path';

export interface ProductFromPDF {
  code: string;
  name: string;
}

/**
 * Lee el archivo ARTICULOS.pdf y extrae códigos y nombres de productos
 * Nota: Para evitar problemas de compilación, esta función actualmente
 * simula la lectura del PDF. En producción, implementaremos la lectura real.
 */
export async function extractProductsFromPDF(): Promise<ProductFromPDF[]> {
  try {
    // En Next.js, necesitamos usar una ruta absoluta
    const pdfPath = path.join(process.cwd(), 'ARTICULOS.pdf');

    if (!fs.existsSync(pdfPath)) {
      throw new Error('El archivo ARTICULOS.pdf no se encuentra en la raíz del proyecto');
    }

    console.log('Archivo PDF encontrado. Procesando...');

    // Por ahora, simulamos la lectura del PDF para evitar problemas de compilación
    // TODO: Implementar lectura real del PDF cuando se resuelva el conflicto con pdfjs-dist
    const mockProducts: ProductFromPDF[] = [
      { code: '001', name: 'Producto de ejemplo 1' },
      { code: '002', name: 'Producto de ejemplo 2' },
      { code: '003', name: 'Producto de ejemplo 3' },
    ];

    console.log(`Se encontraron ${mockProducts.length} productos simulados en el PDF`);
    console.log('Nota: La lectura real del PDF está temporalmente deshabilitada por problemas de compilación.');

    return mockProducts;

  } catch (error) {
    console.error('Error al leer el PDF:', error);
    throw new Error(`Error al procesar el archivo PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}

/**
 * Función auxiliar para procesar texto extraído del PDF
 */
function processPDFText(text: string): ProductFromPDF[] {
  const products: ProductFromPDF[] = [];
  const lines = text.split('\n').filter(line => line.trim());

  // Patrón para detectar líneas que contienen código y nombre
  const productPattern = /^(\d+)\s+(.+)$/;

  for (const line of lines) {
    const trimmedLine = line.trim();
    const match = trimmedLine.match(productPattern);

    if (match) {
      const code = match[1].trim();
      const name = match[2].trim();

      if (code && name && /^\d+$/.test(code)) {
        products.push({ code, name });
      }
    }
  }

  return products;
}
