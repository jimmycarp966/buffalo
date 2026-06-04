import { NextRequest, NextResponse } from "next/server";

import { getPrinterConfig } from "@/actions/configActions";
import { buildPrintBridgeBaseUrl } from "@/lib/printBridgeConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    action: string;
  }>;
};

function buildBridgeHeaders(baseUrl: string, includeJsonContentType = false) {
  const headers: Record<string, string> = {};

  if (includeJsonContentType) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const hostname = new URL(baseUrl).hostname;
    if (/\.ngrok(-free)?\.(app|dev)$/i.test(hostname)) {
      headers["ngrok-skip-browser-warning"] = "1";
    }
  } catch {
  }

  return headers;
}

async function getBridgeBaseUrl() {
  const configResult = await getPrinterConfig();
  if (!configResult.success || !configResult.data) {
    return null;
  }

  return buildPrintBridgeBaseUrl({
    enabled: configResult.data.localServer?.enabled,
    host: configResult.data.localServer?.host,
    port: configResult.data.localServer?.port,
    fallbackHost: undefined,
  });
}

function isSupportedAction(action: string) {
  return action === "status" || action === "printers" || action === "print";
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { action } = await context.params;
  if (!isSupportedAction(action) || action === "print") {
    return NextResponse.json(
      { success: false, message: "Accion no soportada." },
      { status: 404 }
    );
  }

  const baseUrl = await getBridgeBaseUrl();
  if (!baseUrl) {
    return NextResponse.json(
      { success: false, message: "La PC puente no esta habilitada." },
      { status: 400 }
    );
  }

  try {
    const upstreamResponse = await fetch(`${baseUrl}/${action}`, {
      method: "GET",
      headers: buildBridgeHeaders(baseUrl),
      cache: "no-store",
    });

    const text = await upstreamResponse.text();
    return new NextResponse(text, {
      status: upstreamResponse.status,
      headers: {
        "Content-Type":
          upstreamResponse.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "No se pudo contactar la PC puente.",
        baseUrl,
        action,
      },
      { status: 502 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { action } = await context.params;
  if (action !== "print") {
    return NextResponse.json(
      { success: false, message: "Accion no soportada." },
      { status: 404 }
    );
  }

  const baseUrl = await getBridgeBaseUrl();
  if (!baseUrl) {
    return NextResponse.json(
      { success: false, message: "La PC puente no esta habilitada." },
      { status: 400 }
    );
  }

  try {
    const payload = await request.text();
    const upstreamResponse = await fetch(`${baseUrl}/print`, {
      method: "POST",
      headers: buildBridgeHeaders(baseUrl, true),
      body: payload,
      cache: "no-store",
    });

    const text = await upstreamResponse.text();
    return new NextResponse(text, {
      status: upstreamResponse.status,
      headers: {
        "Content-Type":
          upstreamResponse.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "No se pudo contactar la PC puente.",
        baseUrl,
        action,
      },
      { status: 502 }
    );
  }
}
