"use client";

import React, { useEffect, useRef } from "react";
import { Printer } from "lucide-react";
import { brand } from "@/lib/brand";

interface PrintInvoiceTicketProps {
  sale: {
    invoice: {
      invoiceType: string;
      invoiceNumber: string;
      cae: string;
      caeExpirationDate: string;
      clientType: string;
      clientName: string;
      clientCuit?: string;
      clientAddress?: string;
      totalAmount: number;
    };
    items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
    payments: Array<{
      payment_method_name: string;
      amount: number;
    }>;
    businessInfo?: {
      business_name?: string;
      business_legal_name?: string;
      business_address?: string;
      business_phone?: string;
      business_email?: string;
      business_start_date?: string;
      business_iva_condition?: string;
      business_iibb?: string;
      afip_cuit?: string;
      afip_point_of_sale?: string;
    };
    tableNumber?: number;
  };
  onClose: () => void;
}

export function PrintInvoiceTicket({ sale, onClose }: PrintInvoiceTicketProps) {
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-abrir diálogo de impresión después de 500ms
    const timer = setTimeout(() => {
      window.print();
      // Cerrar automáticamente después de imprimir
      setTimeout(() => {
        onClose();
      }, 1000);
    }, 500);

    return () => clearTimeout(timer);
  }, [onClose]);

  // Formatear fecha DD/MM/YYYY
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Formatear número de factura (extraer P.V. y Nro)
  const parseInvoiceNumber = (invoiceNumber: string, pointOfSale?: string) => {
    const parts = invoiceNumber.split('-');
    if (parts.length === 2) {
      return {
        pv: parts[0].padStart(5, '0'),
        nro: parts[1].padStart(8, '0'),
      };
    }
    // Si no hay separador, usar el punto de venta de la configuración
    const pv = pointOfSale ? pointOfSale.padStart(5, '0') : '00003';
    return {
      pv: pv,
      nro: invoiceNumber.padStart(8, '0'),
    };
  };

  // Formatear CUIT sin guiones
  const formatCuit = (cuit: string) => {
    if (!cuit) return '';
    return cuit.replace(/-/g, '');
  };

  // Datos del negocio con valores por defecto
  const businessLegalName = sale.businessInfo?.business_legal_name || 'BUFFO JUAN IGNACIO';
  const businessAddress = sale.businessInfo?.business_address || 'Leandro Araoz 95';
  const businessCuit = formatCuit(sale.businessInfo?.afip_cuit || '20317657634');
  const businessIvaCondition = sale.businessInfo?.business_iva_condition || 'MONOTRIBUTISTA';
  const businessIibb = sale.businessInfo?.business_iibb || businessCuit; // IIBB del negocio
  const businessStartDate = sale.businessInfo?.business_start_date || '2019-09-11';
  const businessFooterName = sale.businessInfo?.business_name || brand.name;

  // Obtener tipo de cliente
  const clientTypeLabel = sale.invoice.clientType === 'consumidor_final' 
    ? 'A CONSUMIDOR FINAL' 
    : sale.invoice.clientType.toUpperCase();

  // Obtener código de factura
  const invoiceCode = sale.invoice.invoiceType === 'A' ? '01' : sale.invoice.invoiceType === 'B' ? '06' : '11';

  // Obtener punto de venta de la configuración
  const pointOfSale = sale.businessInfo?.afip_point_of_sale || '3';

  // Parsear número de factura
  const invoiceNumber = parseInvoiceNumber(sale.invoice.invoiceNumber, pointOfSale);
  
  // Fecha actual
  const today = new Date();
  const todayFormatted = formatDate(today.toISOString());

  return (
    <>
      {/* Estilos de impresión */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #ticket-print-area,
          #ticket-print-area * {
            visibility: visible;
          }
          #ticket-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            margin: 0;
            padding: 10px;
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
        }
      `}</style>

      {/* Área de impresión (oculta en pantalla) */}
      <div
        id="ticket-print-area"
        ref={printRef}
        style={{
          width: '80mm',
          fontFamily: '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          fontSize: '11px',
          color: '#000',
          padding: '10px',
          display: 'none',
          lineHeight: '1.4',
        }}
        className="print:block"
      >
        {/* MARCA */}
        <div style={{ textAlign: 'center', marginBottom: '6px' }}>
          <div style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '0.14em', lineHeight: 1 }}>
            {brand.name.toUpperCase()}
          </div>
          <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.42em', marginTop: '3px' }}>
            {brand.descriptor.toUpperCase()}
          </div>
        </div>

        {/* 1. DATOS DEL NEGOCIO */}
        <div style={{ marginBottom: '8px', fontSize: '10px', color: '#222' }}>
          <div><strong>Razon social:</strong> {businessLegalName}</div>
          <div><strong>Direccion:</strong> {businessAddress}</div>
          <div><strong>C.U.I.T:</strong> {businessCuit}</div>
          <div><strong>IVA:</strong> {businessIvaCondition}</div>
          <div><strong>IIBB:</strong> {businessIibb}</div>
          <div><strong>Inicio de actividad:</strong> {formatDate(businessStartDate)}</div>
        </div>

        {/* Línea punteada */}
        <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>

        {/* 2. TIPO DE FACTURA */}
        <div style={{ textAlign: 'center', margin: '10px 0' }}>
          <div
            style={{
              display: 'inline-block',
              border: '1.5px solid #000',
              borderRadius: '5px',
              padding: '3px 14px',
              fontSize: '18px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              marginBottom: '5px',
            }}
          >
            FACTURA {sale.invoice.invoiceType}
          </div>
          <div style={{ fontSize: '10px', color: '#444' }}>
            Codigo {invoiceCode}
          </div>
        </div>

        {/* 3. DATOS DEL COMPROBANTE */}
        <div style={{ marginBottom: '8px', fontSize: '10px', color: '#222' }}>
          <div><strong>P.V.:</strong> {invoiceNumber.pv}</div>
          <div><strong>Nro:</strong> {invoiceNumber.nro}</div>
          <div><strong>Fecha:</strong> {todayFormatted}</div>
          <div><strong>Concepto:</strong> Productos</div>
        </div>

        {/* Línea punteada */}
        <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>

        {/* 4. DATOS DEL CLIENTE */}
        <div style={{ marginBottom: '8px', fontSize: '11px', fontWeight: 700 }}>
          <div>{clientTypeLabel}</div>
        </div>

        {/* Línea punteada */}
        <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>

        {/* 5. MESA (si aplica) */}
        {sale.tableNumber && (
          <div style={{ marginBottom: '8px', fontSize: '11px' }}>
            <div><strong>Mesa:</strong> {sale.tableNumber}</div>
          </div>
        )}

        {/* 6. DETALLE DE ITEMS */}
        <div style={{ marginBottom: '8px', fontSize: '11px' }}>
          {sale.items.map((item, idx) => (
            <div key={idx} style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              marginBottom: '5px',
              alignItems: 'baseline'
            }}>
              <div style={{ flex: 1 }}>
                <strong>{item.quantity}x </strong>
                <span>{item.description}</span>
              </div>
              <div style={{ textAlign: 'right', marginLeft: '10px', whiteSpace: 'nowrap' }}>
                <span style={{ marginRight: '10px', color: '#666' }}>21 %</span>
                <strong>{item.total.toFixed(2).replace('.', ',')}</strong>
              </div>
            </div>
          ))}
        </div>

        {/* 7. TOTAL */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '18px',
          fontWeight: 800,
          marginTop: '5px',
          paddingTop: '6px',
          borderTop: '2px solid #000',
          marginBottom: '8px',
        }}>
          <div>TOTAL</div>
          <div>${sale.invoice.totalAmount.toFixed(2).replace('.', ',')}</div>
        </div>

        {/* Línea punteada */}
        <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>

        {/* 8. CAE */}
        <div style={{ marginBottom: '8px', fontSize: '11px' }}>
          <div><strong>C.A.E:</strong> {sale.invoice.cae}</div>
          <div><strong>Vto.:</strong> {formatDate(sale.invoice.caeExpirationDate)}</div>
        </div>

        {/* 9. FOOTER DEL NEGOCIO */}
        <div style={{ textAlign: 'center', marginTop: '15px', fontSize: '13px', fontWeight: 800, letterSpacing: '0.03em' }}>
          {businessFooterName}
        </div>

        {/* 10. QR CODE PLACEHOLDER */}
        <div style={{ textAlign: 'center', marginTop: '15px' }}>
          <div
            style={{
              width: '120px',
              height: '120px',
              border: '2px solid #000',
              margin: '10px auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '8px',
              backgroundColor: '#f5f5f5',
            }}
          >
            [QR CODE]
          </div>
        </div>
      </div>

      {/* Indicador visual (no se imprime) */}
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 print:hidden">
        <div className="bg-white rounded-lg p-8 shadow-2xl text-center">
          <Printer className="h-16 w-16 text-blue-600 mx-auto mb-4 animate-pulse" />
          <h3 className="text-xl font-bold mb-2">Preparando Ticket Fiscal</h3>
          <p className="text-gray-600">Se abrirá el diálogo de impresión...</p>
        </div>
      </div>
    </>
  );
}

