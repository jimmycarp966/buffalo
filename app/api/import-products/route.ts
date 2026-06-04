import { NextResponse } from "next/server";
import { importProductsFromPDF } from "@/actions/productActions";

export async function POST() {
  try {
    console.log('API: Iniciando importación de productos desde PDF...');

    const result = await importProductsFromPDF();

    console.log('API: Resultado:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('API: Importación exitosa');
      return NextResponse.json(result);
    } else {
      console.log('API: Error en importación:', result.message);
      return NextResponse.json(result, { status: 400 });
    }

  } catch (error: any) {
    console.error('API: Error en importación:', error);
    console.error('API: Stack trace:', error.stack);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Error interno del servidor",
        stack: error.stack
      },
      { status: 500 }
    );
  }
}
