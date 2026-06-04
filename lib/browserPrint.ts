"use client";

const DEFAULT_PRINT_STYLES = `
  @page {
    size: 80mm auto;
    margin: 0;
  }

  html, body {
    margin: 0;
    padding: 0;
    width: 80mm;
    background: #ffffff;
  }

  body {
    font-family: "Courier New", monospace;
    color: #000000;
  }

  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
`;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function sanitizeThermalContentForBrowser(content: string) {
  return content
    .replace(/\x1B@/g, "")
    .replace(/\x1Ba./g, "")
    .replace(/\x1BE./g, "")
    .replace(/\x1Bd./g, "")
    .replace(/\x1D!./g, "")
    .replace(/\x1DV./g, "")
    .replace(/\x1D\x28.*?\x00/gs, "")
    .replace(/[^\S\r\n]+\n/g, "\n")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u024F]/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

export function buildThermalPreHtml(content: string) {
  const printableContent = escapeHtml(sanitizeThermalContentForBrowser(content));

  return `
    <pre style="margin:0;padding:5mm;white-space:pre-wrap;word-break:break-word;font-family:'Courier New',monospace;font-size:15px;line-height:1.45;font-weight:700;">${printableContent}</pre>
  `;
}

export async function openBrowserPrintWindow({
  title,
  html,
  styles,
}: {
  title: string;
  html: string;
  styles?: string;
}) {
  const documentHtml = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(title)}</title>
        <style>${DEFAULT_PRINT_STYLES}${styles ?? ""}</style>
      </head>
      <body>
        ${html}
      </body>
    </html>
  `;

  await new Promise<void>((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    // Iframe FUERA DE PANTALLA pero con ancho real de 80mm. Un iframe 0x0 hace que
    // muchas impresoras (sobre todo térmicas) saquen un papel diminuto o en blanco.
    iframe.style.position = "fixed";
    iframe.style.left = "-10000px";
    iframe.style.top = "0";
    iframe.style.width = "80mm";
    iframe.style.height = "auto";
    iframe.style.minHeight = "120mm";
    iframe.style.border = "0";
    iframe.style.background = "#ffffff";
    document.body.appendChild(iframe);

    const printWindow = iframe.contentWindow;
    const printDocument = iframe.contentDocument;

    const cleanup = () => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };

    if (!printWindow || !printDocument) {
      cleanup();
      reject(new Error("No se pudo preparar el documento de impresión."));
      return;
    }

    const finalize = () => {
      printWindow.removeEventListener("afterprint", finalize);
      cleanup();
      resolve();
    };

    const triggerPrint = () => {
      printWindow.addEventListener("afterprint", finalize);
      printWindow.focus();
      printWindow.print();
      // Limpieza de seguridad MUY tardía: nunca remover el iframe mientras el
      // diálogo de impresión sigue abierto (si no, el papel sale vacío/cortado).
      setTimeout(finalize, 120000);
    };

    iframe.addEventListener("load", triggerPrint, { once: true });
    printDocument.open();
    printDocument.write(documentHtml);
    printDocument.close();
  });
}
