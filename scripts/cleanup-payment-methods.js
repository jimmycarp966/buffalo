#!/usr/bin/env node

/**
 * Script para limpiar métodos de pago - Dejar solo Efectivo y Transferencia
 *
 * Este script ejecuta el SQL para:
 * 1. Desactivar todos los métodos de pago actuales
 * 2. Activar solo Efectivo y Transferencia
 * 3. Verificar el resultado
 *
 * Uso: node scripts/cleanup-payment-methods.js
 */

const fs = require('fs');
const path = require('path');

// Leer el archivo SQL
const sqlFile = path.join(__dirname, '..', 'supabase', 'CLEANUP_PAYMENT_METHODS.sql');

if (!fs.existsSync(sqlFile)) {
  console.error('❌ Error: No se encuentra el archivo SQL CLEANUP_PAYMENT_METHODS.sql');
  process.exit(1);
}

const sqlContent = fs.readFileSync(sqlFile, 'utf8');

console.log('🧹 LIMPIEZA DE MÉTODOS DE PAGO');
console.log('================================');
console.log('');
console.log('Este script ejecutará el siguiente SQL:');
console.log('');
console.log(sqlContent);
console.log('');
console.log('📋 INSTRUCCIONES:');
console.log('');
console.log('1. 🔄 Ejecuta este script en tu base de datos Supabase');
console.log('2. 📊 Verifica que solo queden Efectivo y Transferencia activos');
console.log('3. 🧪 Prueba el sistema para asegurar que funciona correctamente');
console.log('');
console.log('⚠️  IMPORTANTE:');
console.log('- Los métodos de pago eliminados quedarán inactivos (no se borran)');
console.log('- Las ventas existentes mantendrán sus referencias a métodos antiguos');
console.log('- Solo los nuevos pagos usarán Efectivo y Transferencia');
console.log('');
console.log('✅ COMPONENTES ACTUALIZADOS:');
console.log('- PaymentModal.tsx (botones rápidos)');
console.log('- SimplePaymentModal.tsx (botones rápidos)');
console.log('- PartialPaymentModal.tsx (iconos)');
console.log('- CloseTableModal.tsx (iconos)');
console.log('- CashHistoryTab.tsx (desglose por método)');
console.log('');
console.log('🎯 RESULTADO ESPERADO:');
console.log('- Solo 2 métodos de pago activos: Efectivo y Transferencia');
console.log('- Todos los demás métodos desactivados');
console.log('- El arqueo de caja funcionará normalmente');
console.log('');
