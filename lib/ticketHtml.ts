// Diseño HTML de tickets (80mm) para impresión por navegador (Windows print).
// Mantiene el formato ESC/POS aparte (lib/localPrinter, lib/kitchenPrinter) para
// la impresión térmica directa. Estas funciones devuelven el HTML del cuerpo
// (incluye <style>) para pasarlo a openBrowserPrintWindow.

import { brand } from "./brand";

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return "$" + Math.round(v).toLocaleString("es-AR");
}

const SALE_TYPE_LABEL: Record<string, string> = {
  table: "MESA",
  counter: "MOSTRADOR",
  delivery: "DELIVERY",
};

// Todo en negro puro: las térmicas no imprimen grises (salen tenues/ilegibles).
// La jerarquía se logra con peso y tamaño, no con color.
const RECEIPT_STYLES = `
  <style>
    .rcpt { width: 76mm; max-width: 76mm; margin: 0 auto; padding: 3mm 2mm 5mm;
      font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #000; font-size: 13px; line-height: 1.4; }
    .rcpt * { box-sizing: border-box; color: #000; }
    .rcpt .brand { text-align: center; }
    .rcpt .brand .name { font-size: 26px; font-weight: 800; letter-spacing: .14em; line-height: 1; }
    .rcpt .brand .tag { font-size: 9.5px; font-weight: 700; letter-spacing: .42em; margin-top: 3px; }
    .rcpt .biz { text-align: center; font-size: 11px; margin-top: 4px; }
    .rcpt .biz div { line-height: 1.3; }
    .rcpt .hr { border: 0; border-top: 1px dashed #000; margin: 7px 0; }
    .rcpt .badge { text-align: center; margin: 6px 0; }
    .rcpt .badge span { display: inline-block; border: 1.5px solid #000; border-radius: 5px;
      padding: 2px 12px; font-size: 14px; font-weight: 800; letter-spacing: .12em; }
    .rcpt .meta { font-size: 12px; }
    .rcpt .meta .row { display: flex; justify-content: space-between; gap: 8px; }
    .rcpt .meta .row span:first-child { font-weight: 700; }
    .rcpt .meta .who { font-weight: 700; margin-top: 2px; }
    .rcpt .items .it { display: flex; justify-content: space-between; gap: 8px; margin: 4px 0; }
    .rcpt .items .it .nm { flex: 1; min-width: 0; }
    .rcpt .items .it .nm b { font-weight: 700; }
    .rcpt .items .it .nm small { display: block; font-size: 11px; font-weight: 600; }
    .rcpt .items .it .amt { font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .rcpt .sum .row { display: flex; justify-content: space-between; gap: 8px; font-size: 12.5px; margin: 2px 0; }
    .rcpt .sum .row .v { font-variant-numeric: tabular-nums; }
    .rcpt .sum .muted { font-weight: 600; }
    .rcpt .sum .total { font-size: 19px; font-weight: 800; margin-top: 5px; padding-top: 5px;
      border-top: 2px solid #000; }
    .rcpt .pay .row { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; margin: 2px 0; }
    .rcpt .pay .row .v { font-variant-numeric: tabular-nums; font-weight: 700; }
    .rcpt .foot { text-align: center; margin-top: 8px; }
    .rcpt .foot .thanks { font-size: 13.5px; font-weight: 800; letter-spacing: .03em; }
    .rcpt .foot .alias { font-size: 11px; margin-top: 4px; }
    .rcpt .foot .alias b { font-weight: 800; letter-spacing: .04em; }
  </style>
`;

export interface ReceiptData {
  header: string;
  businessInfo?: { address?: string; phone?: string; cuit?: string };
  saleType?: "table" | "counter" | "delivery";
  tableNumber?: number | null;
  customerName?: string;
  deliveryAddress?: string;
  lines: Array<{ label: string; value: string }>;
  items: Array<{ quantity: number; name: string; unit_price: number }>;
  total: number;
  totalLabel?: string;
  subtotal?: number;
  discount?: number;
  surcharge?: number;
  discountPercent?: number;
  surchargePercent?: number;
  payments?: Array<{ method: string; amount: number }>;
  footer?: string;
  transferAlias?: string;
}

export function buildReceiptHtml(data: ReceiptData): string {
  const biz = data.businessInfo || {};
  const bizLines = [biz.address, biz.phone ? `Tel: ${biz.phone}` : "", biz.cuit ? `CUIT: ${biz.cuit}` : ""]
    .filter(Boolean)
    .map((l) => `<div>${esc(l)}</div>`)
    .join("");

  const typeLabel = data.saleType ? SALE_TYPE_LABEL[data.saleType] : "";
  const badge =
    typeLabel
      ? `<div class="badge"><span>${esc(typeLabel)}${
          data.saleType === "table" && data.tableNumber != null ? " " + esc(data.tableNumber) : ""
        }</span></div>`
      : "";

  // Meta (fecha, ticket) — omitimos "Mesa" porque ya va en el badge
  const metaRows = data.lines
    .filter((l) => l.label.toLowerCase() !== "mesa")
    .map((l) => `<div class="row"><span>${esc(l.label)}</span><span>${esc(l.value)}</span></div>`)
    .join("");
  const who: string[] = [];
  if (data.customerName) who.push(`Cliente: ${esc(data.customerName)}`);
  if (data.saleType === "delivery" && data.deliveryAddress) who.push(`Dirección: ${esc(data.deliveryAddress)}`);
  const whoHtml = who.length ? `<div class="who">${who.join("<br/>")}</div>` : "";

  const items = data.items
    .map((it) => {
      const lineTotal = (it.unit_price || 0) * (it.quantity || 0);
      const detail = it.quantity > 1 ? `<small>${it.quantity} × ${esc(money(it.unit_price))}</small>` : "";
      return `<div class="it"><div class="nm"><b>${esc(it.quantity)}×</b> ${esc(
        it.name
      )}${detail}</div><div class="amt">${esc(money(lineTotal))}</div></div>`;
    })
    .join("");

  const discount = Math.max(0, data.discount || 0);
  const surcharge = Math.max(0, data.surcharge || 0);
  const hasAdjust = discount > 0 || surcharge > 0;
  let sumRows = "";
  if (hasAdjust) {
    const subtotal = typeof data.subtotal === "number" ? data.subtotal : data.total + discount - surcharge;
    sumRows += `<div class="row muted"><span>Subtotal</span><span class="v">${esc(money(subtotal))}</span></div>`;
    if (discount > 0) {
      const lbl = data.discountPercent ? `Descuento (${esc(data.discountPercent)}%)` : "Descuento";
      sumRows += `<div class="row muted"><span>${lbl}</span><span class="v">-${esc(money(discount))}</span></div>`;
    }
    if (surcharge > 0) {
      const lbl = data.surchargePercent ? `Recargo (${esc(data.surchargePercent)}%)` : "Recargo";
      sumRows += `<div class="row muted"><span>${lbl}</span><span class="v">+${esc(money(surcharge))}</span></div>`;
    }
  }
  const totalLabel = data.totalLabel || "TOTAL";
  sumRows += `<div class="row total"><span>${esc(totalLabel)}</span><span class="v">${esc(money(data.total))}</span></div>`;

  const payHtml =
    data.payments && data.payments.length
      ? `<hr class="hr"/><div class="pay">${data.payments
          .map((p) => `<div class="row"><span>${esc(p.method)}</span><span class="v">${esc(money(p.amount))}</span></div>`)
          .join("")}</div>`
      : "";

  const aliasHtml = data.transferAlias
    ? `<div class="alias">Transferencias · Alias: <b>${esc(data.transferAlias)}</b></div>`
    : "";

  return `${RECEIPT_STYLES}
  <div class="rcpt">
    <div class="brand">
      <div class="name">${esc((data.header || brand.name.toUpperCase()).toUpperCase())}</div>
      <div class="tag">${esc(brand.descriptor.toUpperCase())}</div>
    </div>
    ${bizLines ? `<div class="biz">${bizLines}</div>` : ""}
    <hr class="hr"/>
    ${badge}
    <div class="meta">${metaRows}${whoHtml}</div>
    <hr class="hr"/>
    <div class="items">${items}</div>
    <hr class="hr"/>
    <div class="sum">${sumRows}</div>
    ${payHtml}
    <div class="foot">
      <div class="thanks">${esc(data.footer || "¡Gracias por tu visita!")}</div>
      ${aliasHtml}
    </div>
  </div>`;
}

export interface KitchenReceiptData {
  header: string;
  tableNumber: number | null;
  timestamp: string;
  saleType?: "table" | "counter" | "delivery";
  customerName?: string;
  items: Array<{ quantity: number; name: string; customization?: string }>;
  footer?: string;
}

export function buildKitchenReceiptHtml(data: KitchenReceiptData): string {
  const typeLabel = data.saleType ? SALE_TYPE_LABEL[data.saleType] : "";
  const where =
    data.tableNumber != null
      ? `MESA ${esc(data.tableNumber)}`
      : typeLabel || "PEDIDO";
  const items = data.items
    .map(
      (it, i) =>
        `<div class="kit"><div class="q">${esc(it.quantity)}×</div><div class="n"><b>${esc(
          it.name
        )}</b>${it.customization ? `<small>▸ ${esc(it.customization)}</small>` : ""}</div></div>`
    )
    .join("");

  return `
  <style>
    .kt { width: 76mm; max-width: 76mm; margin: 0 auto; padding: 3mm 2mm 5mm;
      font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #000; }
    .kt * { color: #000; }
    .kt .hd { text-align: center; font-size: 15px; font-weight: 800; letter-spacing: .18em; }
    .kt .where { text-align: center; font-size: 21px; font-weight: 800; margin: 4px 0; }
    .kt .ts { text-align: center; font-size: 12px; }
    .kt .who { text-align: center; font-size: 12px; font-weight: 700; margin-top: 2px; }
    .kt .hr { border: 0; border-top: 1px dashed #000; margin: 7px 0; }
    .kt .kit { display: flex; gap: 8px; align-items: baseline; margin: 6px 0; }
    .kt .kit .q { font-size: 18px; font-weight: 800; min-width: 32px; }
    .kt .kit .n { font-size: 15px; font-weight: 700; }
    .kt .kit .n small { display: block; font-size: 12.5px; font-weight: 600; margin-top: 1px; }
    .kt .ft { text-align: center; font-size: 12px; margin-top: 8px; }
  </style>
  <div class="kt">
    <div class="hd">${esc((data.header || "COCINA").toUpperCase())}</div>
    <div class="where">${where}</div>
    <div class="ts">${esc(data.timestamp)}</div>
    ${data.customerName ? `<div class="who">${esc(data.customerName)}</div>` : ""}
    <hr class="hr"/>
    <div class="items">${items}</div>
    <hr class="hr"/>
    ${data.footer ? `<div class="ft">${esc(data.footer)}</div>` : ""}
  </div>`;
}
