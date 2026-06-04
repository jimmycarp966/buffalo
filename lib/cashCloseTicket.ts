// Ticket de Arqueo / Cierre de Caja (80mm) para impresión por navegador.
// Mantiene el mismo estilo que lib/ticketHtml.ts: todo en negro puro (las
// térmicas no imprimen grises) y ancho 76mm para papel de 80mm.

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
  const s = Math.abs(v).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (v < 0 ? "-$" : "$") + s;
}

function isCash(method: string): boolean {
  const m = method.toLowerCase();
  return m.includes("efectivo") || m.includes("cash");
}

export interface CashCloseData {
  businessName: string;
  arqueoNumber?: number | null;
  cashRegisterName: string;
  openedAt: string; // ya formateado
  closedAt: string; // ya formateado
  openedBy: string;
  closedBy: string;
  paymentTotals: Record<string, number>; // ventas por método
  totalSales: number;
  totalIncomes: number;
  totalExpenses: number;
  openingAmount: number;
  expectedCash: number; // efectivo esperado
  countedCash: number; // efectivo contado
  difference: number;
  notes?: string;
}

const STYLES = `<style>
  .arq { width: 76mm; max-width: 76mm; margin: 0 auto; padding: 3mm 2mm 6mm;
    font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #000; font-size: 12.5px; line-height: 1.45; }
  .arq * { box-sizing: border-box; color: #000; }
  .arq .hd { text-align: center; }
  .arq .hd .name { font-size: 20px; font-weight: 800; letter-spacing: .04em; }
  .arq .hd .sub { font-size: 13px; font-weight: 800; letter-spacing: .06em; margin-top: 2px; }
  .arq .hd .caja { font-size: 11px; margin-top: 2px; }
  .arq .hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  .arq .sec { font-size: 11px; font-weight: 800; letter-spacing: .12em; margin-top: 4px; }
  .arq .row { display: flex; justify-content: space-between; gap: 8px; margin: 1px 0; }
  .arq .row.ind { padding-left: 10px; }
  .arq .row .v { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .arq .row.b { font-weight: 800; }
  .arq .big { font-size: 16px; font-weight: 800; margin-top: 3px; padding-top: 3px; border-top: 2px solid #000; }
  .arq .foot { text-align: center; font-size: 10.5px; margin-top: 8px; }
</style>`;

export function buildCashCloseHtml(d: CashCloseData): string {
  const methods = Object.entries(d.paymentTotals || {}).filter(([, a]) => a > 0);
  const cashEntry = methods.find(([m]) => isCash(m));
  const nonCash = methods.filter(([m]) => !isCash(m));

  const ventasRows = methods
    .map(([m, a]) => `<div class="row ind"><span>${esc(m)}</span><span class="v">${esc(money(a))}</span></div>`)
    .join("");
  const nonCashRows = nonCash
    .map(([m, a]) => `<div class="row"><span>${esc(m)}</span><span class="v">${esc(money(a))}</span></div>`)
    .join("");

  const diffLabel = d.difference > 0.01 ? "SOBRANTE" : d.difference < -0.01 ? "FALTANTE" : "DIFERENCIA";
  const arqNo = d.arqueoNumber != null ? ` #${esc(d.arqueoNumber)}` : "";
  const totalGeneral = d.openingAmount + d.totalSales + d.totalIncomes - d.totalExpenses;

  return `${STYLES}
  <div class="arq">
    <div class="hd">
      <div class="name">${esc((d.businessName || "ARQUEO").toUpperCase())}</div>
      <div class="sub">ARQUEO DE CAJA${arqNo}</div>
      <div class="caja">${esc(d.cashRegisterName)}</div>
    </div>
    <hr class="hr"/>
    <div class="sec">APERTURA</div>
    <div class="row"><span>Fecha</span><span>${esc(d.openedAt)}</span></div>
    <div class="row"><span>Responsable</span><span>${esc(d.openedBy)}</span></div>
    <div class="sec" style="margin-top:6px">CIERRE</div>
    <div class="row"><span>Fecha</span><span>${esc(d.closedAt)}</span></div>
    <div class="row"><span>Responsable</span><span>${esc(d.closedBy)}</span></div>
    <hr class="hr"/>
    <div class="row b"><span>INGRESOS</span><span class="v">${esc(money(d.totalSales + d.totalIncomes))}</span></div>
    <div class="row"><span>Ventas</span><span class="v">${esc(money(d.totalSales))}</span></div>
    ${ventasRows}
    ${d.totalIncomes > 0 ? `<div class="row"><span>Ingresos de dinero</span><span class="v">${esc(money(d.totalIncomes))}</span></div>` : ""}
    <hr class="hr"/>
    <div class="row b"><span>EGRESOS</span><span class="v">${esc(money(d.totalExpenses))}</span></div>
    <div class="row ind"><span>Movimientos de efectivo</span><span class="v">${esc(money(d.totalExpenses))}</span></div>
    <hr class="hr"/>
    <div class="sec">RESUMEN (EFECTIVO)</div>
    <div class="row"><span>Monto inicial</span><span class="v">${esc(money(d.openingAmount))}</span></div>
    <div class="row"><span>Ventas efectivo</span><span class="v">${esc(money(cashEntry ? cashEntry[1] : 0))}</span></div>
    ${d.totalIncomes > 0 ? `<div class="row"><span>Ingresos efectivo</span><span class="v">${esc(money(d.totalIncomes))}</span></div>` : ""}
    <div class="row"><span>Egresos efectivo</span><span class="v">-${esc(money(d.totalExpenses))}</span></div>
    <div class="row b"><span>Efectivo esperado</span><span class="v">${esc(money(d.expectedCash))}</span></div>
    <div class="row b"><span>Efectivo contado</span><span class="v">${esc(money(d.countedCash))}</span></div>
    <div class="row big"><span>${diffLabel}</span><span class="v">${esc(money(d.difference))}</span></div>
    ${nonCash.length ? `<hr class="hr"/><div class="sec">OTROS MEDIOS</div>${nonCashRows}` : ""}
    ${d.notes ? `<hr class="hr"/><div class="row"><span>Notas</span><span>${esc(d.notes)}</span></div>` : ""}
    <hr class="hr"/>
    <div class="foot">Total general manejado: ${esc(money(totalGeneral))}</div>
  </div>`;
}
