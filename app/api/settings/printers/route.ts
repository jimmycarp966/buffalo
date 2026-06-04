import { NextResponse } from "next/server";
import { getPrinterConfig, getKitchenPrinterString } from "@/actions/configActions";

export async function GET() {
  try {
    const [configResult, printerStringResult] = await Promise.all([
      getPrinterConfig(),
      getKitchenPrinterString(),
    ]);

    if (!configResult.success || !configResult.data) {
      return NextResponse.json(
        {
          success: false,
          message: configResult.message || "No se pudo obtener la configuración de impresoras",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        config: configResult.data,
        kitchenPrinterString: printerStringResult.success ? printerStringResult.data : null,
      },
    });
  } catch (error: any) {
    console.error("Error obteniendo configuración de impresoras:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Error interno del servidor",
      },
      { status: 500 },
    );
  }
}

