const express = require('express');
const cors = require('cors');
const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const os = require('os');

// Flag de depuración: solo loguea headers/contenido de tickets si DEBUG está activo
const DEBUG = process.env.PRINT_SERVER_DEBUG === '1' || process.env.PRINT_SERVER_DEBUG === 'true';

// Validaciones estrictas para evitar inyección de comandos en ping/nbtstat
const HOSTNAME_REGEX = /^[A-Za-z0-9._\\-]+$/;

function isValidHostname(name) {
  return typeof name === 'string' && name.length > 0 && name.length <= 255 && HOSTNAME_REGEX.test(name);
}

function isValidIPv4(ip) {
  if (typeof ip !== 'string') return false;
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const n = Number(part);
    return n >= 0 && n <= 255 && String(n) === String(Number(part));
  });
}

function isValidPort(port) {
  const n = Number(port);
  return Number.isInteger(n) && n >= 1 && n <= 65535;
}

// Intentar cargar el módulo printer, pero usar PowerShell si falla
let printer = null;
let usePowerShell = false;

try {
  printer = require('printer');
  console.log('✅ Módulo printer cargado correctamente');
} catch (error) {
  console.warn('⚠️ Módulo printer no disponible:', error.message);
  console.warn('🔄 Usando PowerShell para detección de impresoras');
  usePowerShell = true;
}

// Importar módulo net para conexiones TCP
const net = require('net');

const app = express();
const PORT = 3001;

// Middleware
// CORS restringido a los orígenes locales del dev/app (no abrir a todo el mundo)
const ALLOWED_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];
app.use(cors({
  origin: function (origin, callback) {
    // Permitir peticiones sin Origin (ej: curl, healthchecks locales) y orígenes locales permitidos
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origen no permitido por CORS'));
  },
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.text({ limit: '10mb' }));

// Logging a archivo
const logFile = path.join(__dirname, 'server.log');

function log(message) {
  console.log('LOG:', message);
}

function getLocalNetworkAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  Object.values(interfaces).forEach((networkInterface) => {
    (networkInterface || []).forEach((details) => {
      if (
        details &&
        details.family === 'IPv4' &&
        !details.internal &&
        details.address
      ) {
        addresses.push(details.address);
      }
    });
  });

  return Array.from(new Set(addresses));
}

// Obtener nombre de la impresora por defecto
function getDefaultPrinter() {
  if (!printer || usePowerShell) {
    // Usar PowerShell para detectar impresoras
    try {
      const output = execSync('"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Printer | Where-Object { $_.Name -like \'*cocina*\' -or $_.Name -like \'*Cocina*\' } | Select-Object -First 1 -ExpandProperty Name"', { encoding: 'utf8' }).trim();

      if (output) {
        log(`✅ Impresora de cocina detectada con PowerShell: ${output}`);
        return output;
      }
      // Fallback: buscar cualquier impresora
      const allOutput = execSync('"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Printer | Select-Object -First 1 -ExpandProperty Name"', { encoding: 'utf8' }).trim();
      return allOutput || 'Default Printer';
    } catch (error) {
      log(`❌ Error al usar PowerShell: ${error.message}`);
      return 'Default Printer';
    }
  }

  // Usar módulo printer si está disponible
  try {
    const printers = printer.getPrinters();
    const defaultPrinter = printers.find(p => p.isDefault);
    return defaultPrinter ? defaultPrinter.name : (printers.length > 0 ? printers[0].name : null);
  } catch (error) {
    log(`❌ Error al obtener impresora por defecto: ${error.message}`);
    return null;
  }
}

function resolveCashPrinter(preferredPrinterName) {
  const preferred = typeof preferredPrinterName === 'string' ? preferredPrinterName.trim() : '';
  if (preferred && !preferred.startsWith('\\\\') && !preferred.includes('\\\\')) {
    return preferred;
  }

  const cashPrinterNames = ['Caja', 'POS-80C', 'EPSON', '58mm', '80mm'];

  try {
    const output = execSync('"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Printer | Where-Object { $_.Type -eq \'Local\' } | Select-Object -ExpandProperty Name"', { encoding: 'utf8' });
    const localPrinters = output.trim().split('\n').map(p => p.trim()).filter(p => p);

    log('🖨️ [CASH] Impresoras locales encontradas: ' + localPrinters.join(', '));

    for (const printerName of localPrinters) {
      if (printerName.toLowerCase().includes('caja')) {
        return printerName;
      }
    }

    for (const printerName of localPrinters) {
      const matchingKeyword = cashPrinterNames
        .filter(k => k !== 'Caja')
        .find(keyword => printerName.toLowerCase().includes(keyword.toLowerCase()));
      if (matchingKeyword) {
        return printerName;
      }
    }

    if (localPrinters.length > 0) {
      return localPrinters[0];
    }
  } catch (error) {
    log('❌ [CASH] Error al buscar impresoras locales: ' + error.message);
  }

  const defaultPrinter = getDefaultPrinter();
  if (defaultPrinter && !defaultPrinter.startsWith('\\\\')) {
    return defaultPrinter;
  }

  return null;
}

// Endpoint de estado
app.get('/status', (req, res) => {
  let printers = [];
  let printerStatus = 'limited';

  if (printer && !usePowerShell) {
    try {
      printers = printer.getPrinters();
      printerStatus = 'full';
    } catch (error) {
      log(`⚠️ Error al obtener impresoras: ${error.message}`);
    }
  } else if (usePowerShell) {
    // Usar PowerShell para detectar impresoras
    try {
      const output = execSync('"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Printer | Select-Object Name, DriverName, PortName | ConvertTo-Json"', { encoding: 'utf8' });
      printers = JSON.parse(output);
      printerStatus = 'powershell';
    } catch (error) {
      log(`❌ Error al usar PowerShell para obtener impresoras: ${error.message}`);
    }
  }

  const defaultPrinter = getDefaultPrinter();

  res.json({
    success: true,
    status: 'online',
    port: PORT,
    networkUrls: getLocalNetworkAddresses().map((address) => `http://${address}:${PORT}`),
    printerModule: usePowerShell ? 'powershell' : (printer ? 'available' : 'unavailable'),
    printerStatus: printerStatus,
    defaultPrinter: defaultPrinter,
    availablePrinters: printers.map(p => ({
      name: p.name || p.Name,
      driver: p.driver || p.DriverName,
      port: p.port || p.PortName
    })),
    capabilities: {
      usbPrinting: true,
      networkPrinting: true,
      kitchenPrinter: true,
      cashPrinter: true
    }
  });
});

// Endpoint para listar impresoras
app.get('/printers', (req, res) => {
  if (!printer) {
    log('⚠️ Módulo printer no disponible, devolviendo lista vacía');
    res.json({
      success: true,
      printers: [],
      message: 'Módulo printer no disponible. Instale Node.js 18-20 para funcionalidad completa.'
    });
    return;
  }

  try {
    const printers = printer.getPrinters();
    log(`📋 Listando ${printers.length} impresoras disponibles`);

    res.json({
      success: true,
      printers: printers.map(p => ({
        name: p.name,
        isDefault: p.isDefault || false,
        status: p.status || 'unknown',
        driver: p.driver || 'unknown'
      }))
    });
  } catch (error) {
    log(`❌ Error al listar impresoras: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Endpoint de impresión mejorado
app.post('/print', async (req, res) => {
  // No volcar headers ni contenido del ticket salvo en modo DEBUG (datos sensibles del cliente)
  if (DEBUG) {
    console.log('🔥 ENDPOINT /print EJECUTADO!');
    console.log('🔍 [DEBUG SERVER] ============================================');
    console.log('🔍 [DEBUG SERVER] PETICIÓN DE IMPRESIÓN RECIBIDA');
    console.log('🔍 [DEBUG SERVER] ============================================');
    console.log('🔍 [DEBUG SERVER] Timestamp:', new Date().toISOString());
    console.log('🔍 [DEBUG SERVER] Headers:', JSON.stringify(req.headers, null, 2));
    console.log('🔍 [DEBUG SERVER] req.body tipo:', typeof req.body);
    console.log('🔍 [DEBUG SERVER] req.body keys:', req.body ? Object.keys(req.body) : 'null');
  }

  try {
    const { content, printerName, type = 'kitchen', width = 48 } = req.body;

    if (DEBUG) {
      console.log('🔍 [DEBUG SERVER] Parámetros extraídos:');
      console.log('  - type:', type, '(typeof:', typeof type, ')');
      console.log('  - printerName:', printerName, '(typeof:', typeof printerName, ')');
      console.log('  - width:', width, '(typeof:', typeof width, ')');
      console.log('  - content length:', content ? content.length : 0);
      console.log('  - content tiene ESC/POS:', content ? content.includes('\x1B') : false);
      console.log('  - content primeros 100 chars:', content ? content.substring(0, 100) : 'null');
    }

    // Validación básica de parámetros
    if (!content || typeof content !== 'string') {
      console.log('❌ [DEBUG SERVER] Validación fallida: contenido inválido o faltante');
      return res.status(400).json({
        success: false,
        message: 'Contenido inválido o faltante'
      });
    }

    console.log(`📨 PETICIÓN RECIBIDA: type='${type}' (${typeof type}), printerName='${printerName}'`);
    log('📨 PETICIÓN RECIBIDA: type=' + type + ', printerName=' + printerName + ', content_length=' + (content ? content.length : 0));

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'No se proporcionó contenido para imprimir'
      });
    }

    // Si es una ruta UNC (\\servidor\impresora), usar PowerShell
    if (printerName && (printerName.startsWith('\\\\') || printerName.includes('\\\\'))) {
      console.log('🖨️ [KITCHEN] ✅ DETECTADA ruta UNC: ' + printerName);
      return await tryPowerShellPrint(content, printerName, type, width, res);
    }

    if (type === 'cash') {
      const targetCashPrinter = resolveCashPrinter(printerName);

      if (targetCashPrinter) {
        log('🖨️ [CASH] Usando impresora local: ' + targetCashPrinter);
        return await tryPowerShellPrint(content, targetCashPrinter, type, width, res);
      }

      log('❌ [CASH] No se encontró impresora local para ticket de caja');
      return res.status(400).json({
        success: false,
        message: 'No se encontró impresora local para tickets de caja',
        type,
      });
    }

    // Intentar impresión por red para tipo kitchen
    // Si printerName es un nombre UNC (\\servidor\impresora), usar PowerShell
    // Si printerName es IP:puerto (formato "IP:puerto"), usar TCP directo
    // Si printerName es un nombre simple (ej: "Cocina"), usar PowerShell para impresora local
    if (type === 'kitchen') {
      console.log('🔍 [DEBUG SERVER KITCHEN] ============================================');
      console.log('🔍 [DEBUG SERVER KITCHEN] PROCESANDO TIPO KITCHEN');
      console.log('🔍 [DEBUG SERVER KITCHEN] ============================================');
      console.log('🔍 [DEBUG SERVER KITCHEN] printerName:', printerName);
      console.log('🔍 [DEBUG SERVER KITCHEN] printerName es truthy:', !!printerName);
      console.log('🔍 [DEBUG SERVER KITCHEN] startsWith \\\\\\\\:', printerName && printerName.startsWith('\\\\'));
      console.log('🔍 [DEBUG SERVER KITCHEN] includes \\\\\\\\:', printerName && printerName.includes('\\\\'));
      console.log('🔍 [DEBUG SERVER KITCHEN] matches IP:puerto regex:', printerName && /^\d+\.\d+\.\d+\.\d+:\d+$/.test(printerName));

      if (printerName && (printerName.startsWith('\\\\') || printerName.includes('\\\\'))) {
        console.log('🔍 [DEBUG SERVER KITCHEN] ➡️ RUTA: UNC - usando PowerShell');
        log(`🖨️ [${type.toUpperCase()}] Detectado nombre UNC, usando PowerShell para impresora compartida: ${printerName}`);
        return await tryPowerShellPrint(content, printerName, type, width, res);
      } else if (printerName && /^\d+\.\d+\.\d+\.\d+:\d+$/.test(printerName)) {
        console.log('🔍 [DEBUG SERVER KITCHEN] ➡️ RUTA: IP:puerto - usando TCP directo');
        // Formato IP:puerto (ej: "192.168.1.7:9100")
        log(`🖨️ [${type.toUpperCase()}] Detectado formato IP:puerto, usando TCP directo: ${printerName}`);
        return await tryNetworkPrint(content, printerName, width, res, type);
      } else if (printerName) {
        console.log('🔍 [DEBUG SERVER KITCHEN] ➡️ RUTA: Nombre simple - usando PowerShell local');
        // Nombre simple de impresora (ej: "Cocina") - usar PowerShell para impresora local
        log(`🖨️ [${type.toUpperCase()}] Detectado nombre de impresora local, usando PowerShell: ${printerName}`);
        return await tryPowerShellPrint(content, printerName, type, width, res);
      } else {
        console.log('🔍 [DEBUG SERVER KITCHEN] ➡️ RUTA: Sin printerName - detectando automáticamente');
        // Sin printerName - intentar detectar automáticamente
        log(`🖨️ [${type.toUpperCase()}] Sin nombre de impresora, intentando detectar automáticamente...`);
        const defaultPrinter = getDefaultPrinter();
        console.log('🔍 [DEBUG SERVER KITCHEN] Impresora por defecto detectada:', defaultPrinter);
        if (defaultPrinter) {
          return await tryPowerShellPrint(content, defaultPrinter, type, width, res);
        } else {
          console.log('❌ [DEBUG SERVER KITCHEN] No se pudo detectar impresora automáticamente');
          return res.status(400).json({
            success: false,
            message: 'No se especificó impresora y no se pudo detectar automáticamente'
          });
        }
      }
    }

    // Para otros tipos: intentar PowerShell si está disponible
    if (usePowerShell) {
      log(`🖨️ [${type.toUpperCase()}] Usando PowerShell para impresión`);
      return await tryPowerShellPrint(content, printerName, type, width, res);
    }

    // Fallback: simular impresión
    // NO reportar success:true en modo simulación: la impresión real no ocurrió.
    log(`🖨️ [${type.toUpperCase()}] SIMULANDO impresión (PowerShell no disponible)`);
    await new Promise(resolve => setTimeout(resolve, 500));

    return res.status(503).json({
      success: false,
      simulated: true,
      message: `Simulación: Ticket ${type} NO impreso (PowerShell no disponible)`,
      printer: 'Simulated Printer',
      type: type,
      mode: 'simulation',
      note: 'PowerShell no disponible. Verifique la instalación.'
    });

  } catch (error) {
    log(`❌ Error general al procesar impresión: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ FUNCIÓN CORREGIDA: Preserva formato ESC/POS existente
function ensureEscPosFormat(content, width = 48) {
  // Si ya tiene comandos ESC/POS, devolver SIN MODIFICAR
  if (content && typeof content === 'string' && content.includes('\x1B')) {
    log('✅ Contenido ya tiene formato ESC/POS, preservando original');
    return content;
  }

  log('⚠️ Contenido sin formato ESC/POS, aplicando formato básico');

  // Solo agregar líneas de corte al final si no las tiene
  // Usar CRLF (\r\n) para impresoras compartidas de Windows
  let formatted = content;
  if (!formatted.endsWith('\r\n\r\n\r\n')) {
    formatted += '\r\n\r\n\r\n';
  }

  return formatted;
}

// ✅ FUNCIÓN CORREGIDA: Preserva formato para térmicas
function ensureEscPosFormatForThermal(content, width = 48) {
  // Si ya tiene comandos ESC/POS, devolver SIN MODIFICAR
  if (content && typeof content === 'string' && content.includes('\x1B')) {
    log('✅ [THERMAL] Contenido ya tiene formato ESC/POS, preservando original');
    return content;
  }

  log('⚠️ [THERMAL] Contenido sin formato, aplicando básico');

  // Solo agregar líneas de corte al final si no las tiene
  // Usar CRLF (\r\n) para impresoras compartidas de Windows
  let formatted = content;
  if (!formatted.endsWith('\r\n\r\n\r\n')) {
    formatted += '\r\n\r\n\r\n';
  }

  return formatted;
}

// ✅ FUNCIÓN: Normalizar saltos de línea a CRLF para impresoras compartidas
// Convierte todos los \n que no estén precedidos por \r a \r\n
// Esto asegura que Windows Print Spooler interprete correctamente los saltos de línea
// IMPORTANTE: Si el contenido ya tiene CRLF correcto y formato ESC/POS, NO procesarlo
function normalizeLineBreaks(content) {
  if (!content || typeof content !== 'string') {
    return content;
  }

  // CRÍTICO: Si el contenido tiene comandos ESC/POS, NO normalizar
  // Los comandos ESC/POS deben enviarse exactamente como están
  // Cualquier modificación puede corromper los comandos y causar problemas de impresión
  const hasEscPos = content.includes('\x1B') || content.includes('\x1D');

  if (hasEscPos) {
    // Para contenido ESC/POS, NO hacer ninguna normalización
    // El contenido ya viene correctamente formateado desde kitchenPrinter.ts
    log('✅ Contenido ESC/POS detectado - omitiendo normalización para preservar comandos');
    return content;
  }

  // Solo normalizar contenido que NO tiene ESC/POS (contenido de texto plano)
  // Reemplazar \n por \r\n para Windows
  return content.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
}

// Función para impresión con módulo printer de Node.js (modo RAW)
async function tryPrinterModulePrint(content, printerName, type, width, res) {
  log(`🖨️ [CASH] tryPrinterModulePrint: INICIO - printerName='${printerName}', type='${type}'`);
  try {
    let processedContent;
    if (type === 'cash') {
      processedContent = ensureEscPosFormatForThermal(content, width);
    } else {
      processedContent = ensureEscPosFormat(content, width);
    }

    // Normalizar saltos de línea solo si es necesario (la función lo detectará automáticamente)
    const contentBeforeNormalization = processedContent;
    processedContent = normalizeLineBreaks(processedContent);

    // Log si se omitió la normalización
    if (contentBeforeNormalization === processedContent && (processedContent.includes('\x1B') || processedContent.includes('\x1D'))) {
      log(`✅ [CASH] Normalización omitida - contenido ESC/POS ya tiene formato correcto`);
    }

    log(`🖨️ [CASH] Contenido procesado (${processedContent.length} chars)`);
    log(`🖨️ [CASH] Contiene ESC: ${processedContent.includes('\x1B')}`);

    // ✅ CAMBIO: Usar 'binary' en lugar de 'ascii' para preservar comandos ESC/POS
    const buffer = Buffer.from(processedContent, 'binary');

    log(`🖨️ [CASH] Buffer creado (${buffer.length} bytes)`);
    log(`🖨️ [CASH] Enviando ${buffer.length} bytes en modo RAW a ${printerName}`);

    await new Promise((resolve, reject) => {
      printer.printDirect({
        data: buffer,
        printer: printerName,
        type: 'RAW',
        success: function (jobID) {
          log(`✅ [CASH] Impresión RAW exitosa - Job ID: ${jobID} en ${printerName}`);
          resolve(jobID);
        },
        error: function (err) {
          log(`❌ [CASH] Error en impresión RAW: ${err}`);
          reject(new Error(`Error de impresión RAW: ${err}`));
        }
      });
    });

    res.json({
      success: true,
      message: `Ticket ${type} enviado exitosamente a impresora (modo RAW)`,
      printer: printerName,
      type: type,
      mode: 'raw_module'
    });

  } catch (error) {
    log(`❌ Error en impresión con módulo printer: ${error.message}`);
    log(`🔄 Fallback: usando PowerShell en lugar de módulo printer`);
    return await tryPowerShellPrint(content, printerName, type, width, res);
  }
}

// ✅ FUNCIÓN CORREGIDA: PowerShell con encoding binario
async function tryPowerShellPrint(content, printerName, type, width, res) {
  log(`🔥 DEBUG tryPowerShellPrint: INICIO - printerName='${printerName}', type='${type}'`);
  try {
    // Normalizar el nombre de la impresora al inicio
    let normalizedPrinterName = printerName || '';

    // Para rutas UNC: normalizar correctamente las barras invertidas
    if (printerName && printerName.includes('\\')) {
      // Si ya tiene exactamente 2 barras al inicio, mantenerlo
      if (printerName.startsWith('\\\\') && !printerName.startsWith('\\\\\\')) {
        normalizedPrinterName = printerName;
        log(`✅ DEBUG: printerName UNC ya válido: '${printerName}'`);
      } else {
        // Normalizar: quitar barras extras al inicio, mantener exactamente 2
        const withoutExtraSlashes = printerName.replace(/^\\+/, '');
        const parts = withoutExtraSlashes.split('\\').filter(p => p);

        if (parts.length >= 2) {
          normalizedPrinterName = `\\\\${parts[0]}\\${parts[1]}`;
          log(`🔄 DEBUG: printerName UNC normalizado de '${printerName}' a '${normalizedPrinterName}'`);
        } else {
          normalizedPrinterName = `\\\\${withoutExtraSlashes}`;
          log(`⚠️ DEBUG: Intentando normalizar UNC: '${printerName}' -> '${normalizedPrinterName}'`);
        }
      }
    }

    // FASE 1: Preparar contenido sin destruir formato
    let tempFile = path.join(require('os').tmpdir(), `print_${Date.now()}.txt`);

    let processedContent;
    if (type === 'cash') {
      processedContent = ensureEscPosFormatForThermal(content, width);
    } else {
      processedContent = ensureEscPosFormat(content, width);
    }

    // ✅ CRÍTICO: Asegurar que el contenido comience con comandos ESC/POS de inicialización
    // Si el contenido ya tiene formato ESC/POS, verificar que comience con inicialización
    if (processedContent && (processedContent.includes('\x1B') || processedContent.includes('\x1D'))) {
      // Verificar si comienza con inicialización ESC/POS
      if (!processedContent.startsWith('\x1B\x40') && !processedContent.startsWith('\x1B')) {
        log(`⚠️ [${type.toUpperCase()}] Contenido ESC/POS no comienza con inicialización, agregando...`);
        processedContent = '\x1B\x40' + processedContent; // Agregar inicialización al inicio
      }
    }

    // ✅ NORMALIZAR saltos de línea a CRLF antes de escribir archivo
    // Esto es crítico para impresoras compartidas en Windows
    // PERO: Si el contenido ya tiene formato ESC/POS con CRLF correcto, la función lo detectará y no lo procesará
    const contentBeforeNormalization = processedContent;
    processedContent = normalizeLineBreaks(processedContent);

    // Log si se omitió la normalización
    if (contentBeforeNormalization === processedContent && (processedContent.includes('\x1B') || processedContent.includes('\x1D'))) {
      log(`✅ [${type.toUpperCase()}] Normalización omitida - contenido ESC/POS ya tiene formato correcto`);
    }

    log(`🔥 [${type.toUpperCase()}] Contenido procesado (${processedContent.length} chars)`);
    log(`🔥 [${type.toUpperCase()}] Contiene ESC: ${processedContent.includes('\x1B')}`);
    log(`🔥 [${type.toUpperCase()}] Saltos de línea normalizados a CRLF`);

    // 🔍 DEBUG DETALLADO: Analizar comandos ESC/POS en el contenido
    // Solo en modo DEBUG: este bloque vuelca contenido del ticket (datos del cliente).
    if (DEBUG && type === 'cash') {
      log(`🔍 DEBUG DETALLADO [CASH]:`);
      const hasCenter = processedContent.includes('\x1B\x61\x01');
      const hasLeftAlign = processedContent.includes('\x1B\x61\x00');
      const hasDoubleWidth = processedContent.includes('\x1D\x21\x01');
      const hasNormalSize = processedContent.includes('\x1D\x21\x00');
      const hasInit = processedContent.includes('\x1B\x40');
      const hasWidth = processedContent.includes('\x1D\x57');

      log(`  - Centrado (ESC a 01): ${hasCenter}`);
      log(`  - Alinear izquierda (ESC a 00): ${hasLeftAlign}`);
      log(`  - Tamaño doble ancho (GS ! 01): ${hasDoubleWidth}`);
      log(`  - Tamaño normal (GS ! 00): ${hasNormalSize}`);
      log(`  - Inicializar (ESC @): ${hasInit}`);
      log(`  - Configurar ancho (GS W): ${hasWidth}`);

      // Contar ocurrencias
      const countNormalSize = (processedContent.match(/\x1D\x21\x00/g) || []).length;
      const countDoubleWidth = (processedContent.match(/\x1D\x21\x01/g) || []).length;
      const countInit = (processedContent.match(/\x1B\x40/g) || []).length;

      log(`  - Ocurrencias tamaño normal (GS ! 00): ${countNormalSize}`);
      log(`  - Ocurrencias tamaño doble ancho (GS ! 01): ${countDoubleWidth}`);
      log(`  - Ocurrencias inicializar (ESC @): ${countInit}`);

      // Buscar secuencia del encabezado
      const headerIndex = processedContent.indexOf('Buffalo&CAFETERIA');
      if (headerIndex !== -1) {
        const beforeHeader = processedContent.substring(Math.max(0, headerIndex - 30), headerIndex);
        const afterHeader = processedContent.substring(headerIndex, Math.min(processedContent.length, headerIndex + 80));

        log(`  - Encabezado encontrado en posición: ${headerIndex}`);
        log(`  - Antes del encabezado (30 chars): ${Array.from(beforeHeader).map(c => {
          const code = c.charCodeAt(0);
          if (code < 32 || code > 126) return '\\x' + code.toString(16).padStart(2, '0');
          return c;
        }).join('')}`);
        log(`  - Encabezado + después (80 chars): ${Array.from(afterHeader).map(c => {
          const code = c.charCodeAt(0);
          if (code < 32 || code > 126) return '\\x' + code.toString(16).padStart(2, '0');
          return c;
        }).join('')}`);

        // Buscar comandos de tamaño alrededor del encabezado
        const sizeCommandsBefore = beforeHeader.match(/[\x1D\x21][\x00-\x11]/g);
        const sizeCommandsAfter = afterHeader.match(/[\x1D\x21][\x00-\x11]/g);
        if (sizeCommandsBefore) {
          log(`  - Comandos de tamaño ANTES del encabezado: ${sizeCommandsBefore.map(c => '\\x1D\\x21\\x' + c.charCodeAt(1).toString(16).padStart(2, '0')).join(', ')}`);
        }
        if (sizeCommandsAfter) {
          log(`  - Comandos de tamaño DESPUÉS del encabezado: ${sizeCommandsAfter.map(c => '\\x1D\\x21\\x' + c.charCodeAt(1).toString(16).padStart(2, '0')).join(', ')}`);
        }
      } else {
        log(`  - ⚠️ Encabezado "Buffalo&CAFETERIA" NO encontrado en el contenido`);
      }

      // Mostrar primeros bytes en hex
      const firstBytes = Array.from(processedContent.substring(0, 50))
        .map(c => '0x' + c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase())
        .join(' ');
      log(`  - Primeros 50 bytes (hex): ${firstBytes}`);
    }

    // ✅ CAMBIO CRÍTICO: Escribir usando Buffer para preservar todos los bytes correctamente
    // Usar Buffer.from con 'binary' encoding para asegurar que los bytes se preserven correctamente
    // Esto es crítico para comandos ESC/POS que contienen bytes especiales
    const fileBuffer = Buffer.from(processedContent, 'binary');
    fs.writeFileSync(tempFile, fileBuffer);
    log(`📄 Archivo temporal creado (binary): ${tempFile} (${fileBuffer.length} bytes)`);
    log(`📄 Verificación: Primeros 20 bytes del buffer: ${Array.from(fileBuffer.slice(0, 20)).map(b => '0x' + b.toString(16).padStart(2, '0').toUpperCase()).join(' ')}`);

    // FASE 2: Validar y normalizar nombre de impresora
    let psPrinterName = normalizedPrinterName || '';
    let isNetworkPrinter = false;

    if (normalizedPrinterName && normalizedPrinterName.startsWith('\\\\')) {
      isNetworkPrinter = true;
      psPrinterName = normalizedPrinterName;
      log(`✅ Impresora UNC detectada: '${psPrinterName}'`);
    } else {
      psPrinterName = normalizedPrinterName || printerName || '';
      log(`✅ psPrinterName asignado para impresora local: '${psPrinterName}'`);
    }

    let printCommand;
    let printMode = 'standard';

    if (psPrinterName) {
      log(`✅ Generando comando PowerShell para impresora: '${psPrinterName}'`);

      let printerNameInScript;
      const escapedFilePath = tempFile.replace(/\\/g, '\\\\').replace(/'/g, "''");

      if (psPrinterName.startsWith('\\\\')) {
        const escapedForDoubleQuotes = psPrinterName.replace(/"/g, '`"');
        printerNameInScript = `"${escapedForDoubleQuotes}"`;
      } else {
        const escapedPrinterName = psPrinterName.replace(/'/g, "''");
        printerNameInScript = `'${escapedPrinterName}'`;
      }

      const psScript = path.join(require('os').tmpdir(), `print_${Date.now()}.ps1`);

      // ✅ CAMBIO CRÍTICO: Usar APIs de Windows (winspool.drv) para enviar bytes RAW directamente
      // Esto evita Out-Printer que no respeta comandos ESC/POS y aplica su propio ancho
      const psScriptContent = `try {
  $printerName = ${printerNameInScript}
  $filePath = '${escapedFilePath}'
  
  Write-Host "DEBUG: Iniciando impresión. Impresora: $printerName, Archivo: $filePath"
  
  # Para impresoras UNC (compartidas en red), omitir verificación con Get-Printer
  # Get-Printer solo lista impresoras instaladas localmente, pero OpenPrinter puede acceder a impresoras compartidas
  $isUNCPrinter = $printerName -like "\\\\*"
  Write-Host "DEBUG: Es impresora UNC: $isUNCPrinter"
  
  if (-not $isUNCPrinter) {
    # Solo verificar con Get-Printer para impresoras locales
    Write-Host "DEBUG: Verificando impresora local con Get-Printer..."
  $printerExists = Get-Printer -Name $printerName -ErrorAction SilentlyContinue
  if (-not $printerExists) {
      Write-Host "ERROR: Impresora local no encontrada: $printerName"
      throw "Impresora local no encontrada: $printerName"
    }
    Write-Host "DEBUG: Impresora local verificada: $printerName"
  } else {
    Write-Host "DEBUG: Impresora UNC detectada, omitiendo verificación Get-Printer: $printerName"
    Write-Host "DEBUG: Intentando acceso directo con OpenPrinter (puede acceder a impresoras compartidas sin instalación local)"
  }
  
  # Leer bytes del archivo directamente - CRÍTICO: Leer como binario puro
  $bytes = [System.IO.File]::ReadAllBytes($filePath)
  Write-Host "DEBUG: Archivo leido, $($bytes.Length) bytes"
  
  # Verificar que los bytes se leyeron correctamente
  if ($bytes.Length -eq 0) {
    throw "ERROR: El archivo está vacío o no se pudo leer"
  }
  
  # Mostrar primeros bytes para verificación
  $firstBytesHex = ($bytes[0..19] | ForEach-Object { "0x{0:X2}" -f $_ }) -join " "
  Write-Host "DEBUG: Primeros 20 bytes (hex): $firstBytesHex"
  
  # Verificar que contiene comandos ESC/POS
  $hasEsc = ($bytes | Where-Object { $_ -eq 0x1B }).Count -gt 0
  $hasGS = ($bytes | Where-Object { $_ -eq 0x1D }).Count -gt 0
  Write-Host "DEBUG: Contiene ESC (0x1B): $hasEsc, Contiene GS (0x1D): $hasGS"
  
  # Definir clase helper para enviar bytes RAW directamente a la impresora
  $rawPrinterHelper = @'
using System;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;

public class RawPrinterHelper {
  [DllImport("winspool.drv", EntryPoint="OpenPrinterA", CharSet=CharSet.Ansi, SetLastError=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);
  
  [DllImport("winspool.drv", EntryPoint="ClosePrinter", CharSet=CharSet.Ansi, SetLastError=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  
  [DllImport("winspool.drv", EntryPoint="StartDocPrinterA", CharSet=CharSet.Ansi, SetLastError=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
  
  [DllImport("winspool.drv", EntryPoint="EndDocPrinter", CharSet=CharSet.Ansi, SetLastError=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  
  [DllImport("winspool.drv", EntryPoint="StartPagePrinter", CharSet=CharSet.Ansi, SetLastError=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  
  [DllImport("winspool.drv", EntryPoint="EndPagePrinter", CharSet=CharSet.Ansi, SetLastError=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  
  [DllImport("winspool.drv", EntryPoint="WritePrinter", CharSet=CharSet.Ansi, SetLastError=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
  
  [DllImport("kernel32.dll", SetLastError=true)]
  public static extern uint GetLastError();
  
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }
  
  private static string GetErrorMessage(uint errorCode) {
    switch (errorCode) {
      case 2: return "ERROR_2: El sistema no puede encontrar el archivo especificado (impresora no encontrada o no accesible)";
      case 5: return "ERROR_5: Acceso denegado (verifique permisos de red o credenciales)";
      case 53: return "ERROR_53: No se encontró la ruta de red (servidor no accesible o nombre incorrecto)";
      case 67: return "ERROR_67: No se encontró el nombre de red (servidor no encontrado en la red)";
      case 1223: return "ERROR_1223: La operación fue cancelada por el usuario";
      case 1801: return "ERROR_1801: El puerto de impresora especificado no existe";
      case 1802: return "ERROR_1802: La impresora especificada no existe";
      case 1803: return "ERROR_1803: El controlador de impresora no existe";
      case 1804: return "ERROR_1804: El procesador de impresora no existe";
      case 1805: return "ERROR_1805: El archivo de especificación de impresora especificado no es válido";
      case 1930: return "ERROR_1930: No se puede conectar a la impresora (verifique que esté encendida y compartida)";
      default: return "ERROR_" + errorCode + ": Error desconocido de Windows";
    }
  }
  
  public static string SendBytesToPrinter(string szPrinterName, byte[] bytes) {
    IntPtr hPrinter = IntPtr.Zero;
    try {
      // Validar entrada
      if (string.IsNullOrEmpty(szPrinterName)) {
        return "ERROR: El nombre de la impresora no puede estar vacío";
      }
      
      if (bytes == null || bytes.Length == 0) {
        return "ERROR: No hay datos para imprimir";
      }
      
      // Normalizar el nombre de la impresora
      string normalizedName = szPrinterName.Normalize();
      System.Console.WriteLine("DEBUG: Intentando abrir impresora: '" + normalizedName + "'");
      System.Console.WriteLine("DEBUG: Longitud del nombre: " + normalizedName.Length);
      System.Console.WriteLine("DEBUG: Es ruta UNC: " + normalizedName.StartsWith("\\\\"));
      
      // Intentar abrir la impresora
      bool openResult = OpenPrinter(normalizedName, out hPrinter, IntPtr.Zero);
      System.Console.WriteLine("DEBUG: OpenPrinter retornó: " + openResult);
      
      if (!openResult) {
        uint error = GetLastError();
        string errorMsg = GetErrorMessage(error);
        System.Console.WriteLine("DEBUG: OpenPrinter fallo. Error: " + error + " - " + errorMsg);
        System.Console.WriteLine("DEBUG: Nombre de impresora usado: '" + normalizedName + "'");
        return "ERROR: OpenPrinter fallo. " + errorMsg + " (Codigo: " + error + ")";
      }
      
      System.Console.WriteLine("DEBUG: OpenPrinter exitoso, handle: " + hPrinter);
      
      DOCINFOA di = new DOCINFOA();
      di.pDocName = "Raw Print Job";
      di.pOutputFile = null;
      di.pDataType = "RAW";
      
      if (!StartDocPrinter(hPrinter, 1, di)) {
        uint error = GetLastError();
        ClosePrinter(hPrinter);
        string errorMsg = GetErrorMessage(error);
        return "ERROR: StartDocPrinter fallo. " + errorMsg + " (Codigo: " + error + ")";
      }
      
      if (!StartPagePrinter(hPrinter)) {
        uint error = GetLastError();
        EndDocPrinter(hPrinter);
        ClosePrinter(hPrinter);
        string errorMsg = GetErrorMessage(error);
        return "ERROR: StartPagePrinter fallo. " + errorMsg + " (Codigo: " + error + ")";
      }
      
      // Enviar TODOS los bytes en un solo bloque - CRÍTICO para impresoras ESC/POS
      // NO dividir en chunks - enviar todo de una vez para preservar la integridad de los comandos ESC/POS
      int dwWritten = 0;
      IntPtr pBytes = Marshal.AllocHGlobal(bytes.Length);
      
      try {
        // Copiar todos los bytes al buffer no administrado
      Marshal.Copy(bytes, 0, pBytes, bytes.Length);
      
        System.Console.WriteLine("DEBUG: Enviando " + bytes.Length + " bytes a WritePrinter");
        System.Console.WriteLine("DEBUG: Primeros 20 bytes: " + string.Join(" ", bytes.Take(20).Select(b => "0x" + b.ToString("X2"))));
        
        // CRÍTICO: Enviar todos los bytes de una vez como un bloque único
        // NO usar múltiples llamadas a WritePrinter - esto puede hacer que la impresora interprete cada bloque por separado
      bool success = WritePrinter(hPrinter, pBytes, bytes.Length, out dwWritten);
      uint writeError = GetLastError();
        
        System.Console.WriteLine("DEBUG: WritePrinter retornó: " + success + ", bytes escritos: " + dwWritten + " de " + bytes.Length);
      
      if (!success) {
          string errorMsg = GetErrorMessage(writeError);
          return "ERROR: WritePrinter fallo. " + errorMsg + " (Codigo: " + writeError + "), bytes escritos: " + dwWritten;
        }
        
        // Verificar que se escribieron todos los bytes
        if (dwWritten != bytes.Length) {
          System.Console.WriteLine("DEBUG: ADVERTENCIA - Se esperaban " + bytes.Length + " bytes pero se escribieron " + dwWritten);
        }
      } finally {
        Marshal.FreeHGlobal(pBytes);
      }
      
      EndPagePrinter(hPrinter);
      EndDocPrinter(hPrinter);
      ClosePrinter(hPrinter);
      
      return "SUCCESS: " + dwWritten + " bytes escritos";
    } catch (Exception ex) {
      if (hPrinter != IntPtr.Zero) {
        ClosePrinter(hPrinter);
      }
      return "ERROR: Excepcion: " + ex.Message;
    }
  }
}
'@
  
  # Intentar agregar el tipo, si ya existe, continuar
  try {
    Add-Type -TypeDefinition $rawPrinterHelper -Language CSharp -ErrorAction Stop
  } catch {
    # Si el tipo ya existe, continuar
    if ($_.Exception.Message -notlike "*already exists*") {
      throw $_
    }
  }
  
  # Enviar bytes directamente a la impresora en modo RAW
  Write-Host "DEBUG: Enviando $($bytes.Length) bytes a impresora: $printerName"
  $result = [RawPrinterHelper]::SendBytesToPrinter($printerName, $bytes)
  Write-Host "DEBUG: Resultado de SendBytesToPrinter: $result"
  
  if ($result -like "ERROR:*") {
    Write-Host "ERROR: $result"
    throw $result
  }
  
  Write-Host "SUCCESS: $result"
  exit 0
} catch {
  $errorMessage = $_.Exception.Message
  $errorType = $_.Exception.GetType().FullName
  $errorStackTrace = $_.Exception.StackTrace
  
  Write-Host "DEBUG: Excepción capturada. Tipo: $errorType"
  Write-Host "DEBUG: Mensaje: $errorMessage"
  Write-Host "DEBUG: StackTrace: $errorStackTrace"
  
  # Si el error viene de SendBytesToPrinter, ya tiene el formato correcto
  if ($errorMessage -like "ERROR:*") {
    Write-Host "ERROR: $errorMessage"
  } else {
    # Formatear el error para que sea consistente
    Write-Host "ERROR: $errorMessage"
  }
  exit 1
}`;

      fs.writeFileSync(psScript, psScriptContent, 'utf8');

      log(`📝 Script PowerShell para impresora ${type} creado: ${psScript}`);

      printCommand = `"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -ExecutionPolicy Bypass -NoProfile -File "${psScript}"`;
      printMode = 'powershell_raw';

      setTimeout(() => {
        try {
          fs.unlinkSync(psScript);
        } catch (e) { }
      }, 5000);
    } else {
      throw new Error('No se pudo determinar el nombre de la impresora');
    }

    // Ejecutar comando de impresión
    if (printCommand) {
      log(`🖨️ Ejecutando comando (modo: ${printMode}): ${printCommand}`);

      try {
        const result = execSync(printCommand, { stdio: 'pipe', timeout: 30000, encoding: 'utf8' });
        const output = result.toString().trim();
        log(`✅ DEBUG: execSync completado. Salida: ${output}`);

        if (output.includes('InvalidPrinterException')) {
          throw new Error('Impresora UNC no accesible: InvalidPrinterException detectada en salida');
        }
        if (output.includes('ERROR:')) {
          // Extraer el mensaje de error detallado
          const errorMatch = output.match(/ERROR:\s*(.+)/);
          const errorMessage = errorMatch ? errorMatch[1] : output;
          log(`❌ Error detallado del script: ${errorMessage}`);
          throw new Error(`Error al imprimir: ${errorMessage}`);
        }
        if (!output.includes('SUCCESS')) {
          log(`⚠️ Salida inesperada del script: ${output}`);
        }
      } catch (execError) {
        log(`❌ Error en execSync: ${execError.message}`);

        // Capturar salida del script (stdout puede contener el mensaje de error)
        let errorOutput = '';
        if (execError.stdout) {
          errorOutput = execError.stdout.toString().trim();
          log(`❌ STDOUT: ${errorOutput}`);
        }
        if (execError.stderr) {
          const stderrOutput = execError.stderr.toString().trim();
          log(`❌ STDERR: ${stderrOutput}`);
          if (stderrOutput) errorOutput = stderrOutput;
        }

        // Si el stdout contiene un mensaje de error, usarlo
        if (errorOutput && errorOutput.includes('ERROR:')) {
          // Buscar todas las líneas que contengan ERROR: para obtener el mensaje completo
          const errorLines = errorOutput.split('\n').filter(line => line.includes('ERROR:'));
          if (errorLines.length > 0) {
            // Tomar la última línea de error (la más específica)
            const lastErrorLine = errorLines[errorLines.length - 1];
            const errorMatch = lastErrorLine.match(/ERROR:\s*(.+)/);
            if (errorMatch) {
              throw new Error(`Error al imprimir: ${errorMatch[1]}`);
            } else {
              throw new Error(`Error al imprimir: ${lastErrorLine}`);
            }
          }
        }

        if (execError.message.includes('ETIMEDOUT') || execError.code === 'ETIMEDOUT') {
          log(`⚠️ Timeout detectado - probablemente problema de red o impresora inaccesible`);
          throw new Error('Timeout: La impresora no responde o no está accesible en la red');
        }

        if (execError.message.includes('InvalidPrinterException') ||
          execError.message.includes('printer not found')) {
          log(`🔄 Detectado error de impresora inválida, intentando fallback`);
          throw new Error('Impresora no accesible o no encontrada');
        }
        throw new Error(`Error ejecutando comando PowerShell: ${execError.message}`);
      }
    }

    // Limpiar archivo temporal
    try {
      fs.unlinkSync(tempFile);
      log(`🗑️ Archivo temporal eliminado: ${tempFile}`);
    } catch (cleanupError) {
      log(`⚠️ No se pudo eliminar archivo temporal: ${cleanupError.message}`);
    }

    log(`✅ Impresión exitosa con PowerShell en ${psPrinterName} (modo: ${printMode})`);

    res.json({
      success: true,
      message: `Ticket ${type} enviado exitosamente a impresora`,
      printer: psPrinterName,
      type: type,
      mode: printMode
    });

  } catch (error) {
    log(`❌ Error en impresión PowerShell: ${error.message}`);

    const currentPrinterName = typeof normalizedPrinterName !== 'undefined' ? normalizedPrinterName : printerName;

    // Si es una impresora UNC de tipo kitchen y falla, intentar TCP directo
    if (currentPrinterName && currentPrinterName.startsWith('\\\\') && type === 'kitchen') {
      log(`🔄 Detectado error con impresora UNC kitchen, intentando impresión TCP directa`);
      try {
        const pathWithoutPrefix = currentPrinterName.substring(2);
        log(`🔍 DEBUG: Path sin prefijo \\\\: '${pathWithoutPrefix}'`);

        const parts = pathWithoutPrefix.split('\\').filter(p => p && p.length > 0);
        log(`🔍 DEBUG: Partes después del split: [${parts.join(', ')}]`);

        if (parts.length >= 1) {
          const serverName = parts[0];
          log(`🌐 Intentando resolver servidor NetBIOS '${serverName}' a IP para impresión TCP`);

          // Usar la nueva función de resolución NetBIOS con múltiples métodos
          const serverIP = await resolveNetBIOSName(serverName);

          if (serverIP) {
            log(`🖨️ Intentando impresión TCP directa a ${serverIP}:9100`);
            return await tryNetworkPrint(content, serverIP, width, res, type);
          } else {
            // Último recurso: intentar conexión TCP directa con el nombre del servidor
            // Algunos sistemas Windows resuelven NetBIOS automáticamente en conexiones TCP
            log(`⚠️ No se pudo resolver IP, intentando conexión TCP directa con nombre '${serverName}'`);
            try {
              return await tryNetworkPrint(content, serverName, width, res, type);
            } catch (directNameError) {
              log(`❌ Conexión TCP directa con nombre también falló: ${directNameError.message}`);
            }
          }
        } else {
          log(`❌ No se pudieron extraer partes de la ruta UNC: '${currentPrinterName}'`);
        }
      } catch (fallbackError) {
        log(`❌ Fallback TCP también falló: ${fallbackError.message}`);
      }
    }

    // Generar sugerencias específicas según el tipo de error
    let suggestion = '';
    if (currentPrinterName && currentPrinterName.startsWith('\\\\')) {
      const errorMsg = error.message.toLowerCase();
      if (errorMsg.includes('error_2') || errorMsg.includes('no encontrada')) {
        suggestion = 'La impresora compartida no fue encontrada. Verifique: 1) Que el servidor esté encendido y accesible en la red, 2) Que la impresora esté compartida correctamente, 3) Que el nombre de la impresora sea correcto (formato: \\\\SERVIDOR\\IMPRESORA)';
      } else if (errorMsg.includes('error_5') || errorMsg.includes('acceso denegado')) {
        suggestion = 'Acceso denegado. Verifique: 1) Que tenga permisos para acceder a la impresora compartida, 2) Que las credenciales de red sean correctas, 3) Que el firewall no esté bloqueando el acceso';
      } else if (errorMsg.includes('error_53') || errorMsg.includes('error_67') || errorMsg.includes('ruta de red')) {
        suggestion = 'No se puede acceder a la ruta de red. Verifique: 1) Que el servidor esté en la misma red, 2) Que el nombre del servidor sea correcto, 3) Que el servicio de red esté funcionando, 4) Intente usar la IP del servidor en lugar del nombre';
      } else {
        suggestion = 'Error al acceder a la impresora compartida. Verifique: 1) Que el servidor esté accesible (pruebe hacer ping al servidor), 2) Que la impresora esté compartida correctamente, 3) Que tenga permisos de red, 4) Consulte los logs para más detalles';
      }
    } else {
      suggestion = 'Verifique que la impresora esté conectada, encendida y configurada correctamente.';
    }

    res.status(500).json({
      success: false,
      message: `Error al imprimir con PowerShell: ${error.message}`,
      type: type,
      printer: printerName,
      mode: 'powershell_error',
      suggestion: suggestion
    });
  }
}

// Función para resolver nombres NetBIOS usando múltiples métodos
async function resolveNetBIOSName(serverName) {
  log(`🔍 Resolviendo nombre NetBIOS: '${serverName}'`);

  // Método 1: Intentar resolución DNS estándar (IPv4)
  try {
    const addresses4 = await dns.resolve4(serverName);
    if (addresses4 && addresses4.length > 0) {
      log(`✅ [DNS IPv4] Servidor '${serverName}' resuelto a: ${addresses4[0]}`);
      return addresses4[0];
    }
  } catch (dnsError4) {
    log(`⚠️ [DNS IPv4] Falló para '${serverName}': ${dnsError4.message}`);
  }

  // Método 2: Intentar resolución DNS IPv6
  try {
    const addresses6 = await dns.resolve6(serverName);
    if (addresses6 && addresses6.length > 0) {
      log(`✅ [DNS IPv6] Servidor '${serverName}' resuelto a: ${addresses6[0]}`);
      return addresses6[0];
    }
  } catch (dnsError6) {
    log(`⚠️ [DNS IPv6] Falló para '${serverName}': ${dnsError6.message}`);
  }

  // Método 3: Verificar si ya es una IP
  const ipv4Regex = /^\d+\.\d+\.\d+\.\d+$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
  if (ipv4Regex.test(serverName) || ipv6Regex.test(serverName)) {
    log(`✅ [IP Directa] El nombre es una IP: ${serverName}`);
    return serverName;
  }

  // Método 4: Usar ping para resolver nombres NetBIOS (Windows resuelve NetBIOS vía ping)
  // SEGURIDAD: validar serverName y usar execFileSync con array de args (sin shell) para evitar RCE
  if (!isValidHostname(serverName) && !isValidIPv4(serverName)) {
    log(`⛔ [PING] '${serverName}' no pasó validación de hostname/IP, se omite ping`);
  } else try {
    log(`🔍 [PING] Intentando resolver '${serverName}' usando ping...`);
    const pingOutput = execFileSync('ping', ['-n', '1', serverName], {
      timeout: 3000,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    // Extraer IP del output de ping (formato: "Respuesta desde 192.168.1.100:")
    const ipMatch = pingOutput.match(/Respuesta desde (\d+\.\d+\.\d+\.\d+):/i) ||
      pingOutput.match(/Reply from (\d+\.\d+\.\d+\.\d+):/i) ||
      pingOutput.match(/Pinging .+ \[(\d+\.\d+\.\d+\.\d+)\]/i);

    if (ipMatch && ipMatch[1]) {
      log(`✅ [PING] Servidor '${serverName}' resuelto a: ${ipMatch[1]}`);
      return ipMatch[1];
    }
  } catch (pingError) {
    log(`⚠️ [PING] Falló para '${serverName}': ${pingError.message}`);
  }

  // Método 5: Usar nbtstat para resolver nombres NetBIOS (si está disponible)
  // SEGURIDAD: validar serverName y usar execFileSync con array de args (sin shell) para evitar RCE
  if (!isValidHostname(serverName) && !isValidIPv4(serverName)) {
    log(`⛔ [NBTSTAT] '${serverName}' no pasó validación de hostname/IP, se omite nbtstat`);
  } else try {
    log(`🔍 [NBTSTAT] Intentando resolver '${serverName}' usando nbtstat...`);
    const nbtstatOutput = execFileSync('nbtstat', ['-A', serverName], {
      timeout: 3000,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    // Extraer IP del output de nbtstat (formato: "Dirección IP local. . . . . . . . : 192.168.1.100")
    const ipMatch = nbtstatOutput.match(/Dirección IP[^\d]*(\d+\.\d+\.\d+\.\d+)/i) ||
      nbtstatOutput.match(/IP Address[^\d]*(\d+\.\d+\.\d+\.\d+)/i);

    if (ipMatch && ipMatch[1]) {
      log(`✅ [NBTSTAT] Servidor '${serverName}' resuelto a: ${ipMatch[1]}`);
      return ipMatch[1];
    }
  } catch (nbtstatError) {
    log(`⚠️ [NBTSTAT] Falló para '${serverName}': ${nbtstatError.message}`);
  }

  // Método 6: Intentar conexión TCP directa con el nombre (algunos sistemas lo resuelven automáticamente)
  // Este método se intentará en tryNetworkPrint si todos los demás fallan
  log(`⚠️ Todos los métodos de resolución fallaron para '${serverName}'`);
  return null;
}

// Función para probar conectividad de red (mejorada con mejor manejo de errores)
async function testNetworkConnectivity(ip, port, timeout = 5000) {
  return new Promise((resolve) => {
    const client = net.createConnection({ host: ip, port: port }, () => {
      log(`✅ Test de conectividad exitoso para ${ip}:${port}`);
      client.end();
      resolve(true);
    });

    client.on('error', (err) => {
      log(`⚠️ Test de conectividad falló para ${ip}:${port} - ${err.message}`);
      client.destroy();
      resolve(false);
    });

    client.on('timeout', () => {
      log(`⚠️ Test de conectividad timeout para ${ip}:${port}`);
      client.destroy();
      resolve(false);
    });

    client.setTimeout(timeout);
  });
}

// ✅ FUNCIÓN CORREGIDA: Impresión TCP sin destruir formato
async function tryNetworkPrint(content, printerName, width, res, type = 'kitchen') {
  log(`🚀 INICIANDO tryNetworkPrint: content_length=${content?.length}, printerName=${printerName}, width=${width}, type=${type}`);

  // Parsear IP y puerto del printerName (formato: "192.168.1.100" o "192.168.1.100:9100")
  // Declarar fuera del try para que estén disponibles en el catch
  let ip, port;

  if (printerName && printerName.includes(':')) {
    [ip, port] = printerName.split(':');
    port = parseInt(port);
  } else if (printerName) {
    ip = printerName;
    port = 9100; // Puerto por defecto
  } else {
    ip = '192.168.1.100';
    port = 9100;
  }

  try {

    log(`🌐 Intentando conectar a impresora de red: ${ip}:${port}`);

    // SEGURIDAD: validar ip/hostname y puerto antes de cualquier operación de red.
    // ip puede ser una IPv4 o un nombre de servidor (que luego se resuelve a IPv4).
    if (!isValidIPv4(ip) && !isValidHostname(ip)) {
      log(`⛔ tryNetworkPrint rechazado: '${ip}' no es IPv4 ni hostname válido`);
      return res.status(400).json({
        success: false,
        message: 'Destino de impresora inválido',
        type,
      });
    }
    if (!isValidPort(port)) {
      log(`⛔ tryNetworkPrint rechazado: puerto inválido '${port}'`);
      return res.status(400).json({
        success: false,
        message: 'Puerto de impresora inválido (debe ser 1-65535)',
        type,
      });
    }

    // Verificar si es una IP válida o un nombre de servidor
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const isIP = ipRegex.test(ip);

    if (!isIP) {
      // Si no es una IP, intentar resolver el nombre primero
      log(`⚠️ '${ip}' no es una IP válida, intentando resolver como nombre de servidor...`);
      const resolvedIP = await resolveNetBIOSName(ip);
      if (resolvedIP) {
        log(`✅ Nombre '${ip}' resuelto a IP: ${resolvedIP}`);
        ip = resolvedIP;
      } else {
        // Si no se puede resolver, intentar conectar directamente con el nombre
        // Algunos sistemas Windows resuelven NetBIOS automáticamente en conexiones TCP
        log(`⚠️ No se pudo resolver '${ip}' a IP, intentando conexión directa con el nombre...`);
      }
    }

    // Probar conectividad antes de procesar contenido (pero no bloquear si falla)
    // Algunas impresoras no responden al test pero sí aceptan conexiones reales
    log(`🔍 Verificando conectividad con ${ip}:${port}...`);
    const isReachable = await testNetworkConnectivity(ip, port, 5000);
    if (!isReachable) {
      log(`⚠️ Test de conectividad falló, pero intentando enviar datos directamente...`);
      log(`💡 Nota: Si la impresora sigue sin responder, verifique:`);
      log(`   1. Que la IP ${ip} sea correcta`);
      log(`   2. Que la impresora esté encendida y conectada a la red`);
      log(`   3. Que el puerto ${port} sea el correcto (normalmente 9100 para impresoras de red)`);
      log(`   4. Que no haya firewall bloqueando el puerto ${port}`);
      // No lanzar error aquí, intentar enviar de todas formas
      // Muchas impresoras de red rechazan conexiones de test pero aceptan datos reales
    } else {
      log(`✅ Conectividad verificada para ${ip}:${port}`);
    }

    // ✅ CAMBIO: Preservar formato ESC/POS existente
    let processedContent;
    if (type === 'cash') {
      processedContent = ensureEscPosFormatForThermal(content, width);
    } else {
      processedContent = ensureEscPosFormat(content, width);
    }

    // Normalizar saltos de línea solo si es necesario (la función lo detectará automáticamente)
    const contentBeforeNormalization = processedContent;
    processedContent = normalizeLineBreaks(processedContent);

    // Log si se omitió la normalización
    if (contentBeforeNormalization === processedContent && (processedContent.includes('\x1B') || processedContent.includes('\x1D'))) {
      log(`✅ [NETWORK] Normalización omitida - contenido ESC/POS ya tiene formato correcto`);
    }

    log(`🌐 [NETWORK] Contenido procesado (${processedContent.length} chars)`);
    log(`🌐 [NETWORK] Contiene ESC: ${processedContent.includes('\x1B')}`);

    // ✅ CAMBIO: Usar 'binary' para preservar comandos ESC/POS
    const buffer = Buffer.from(processedContent, 'binary');
    log(`🌐 [NETWORK] Buffer creado (${buffer.length} bytes)`);

    // Enviar por TCP (con timeout más largo para impresoras de red)
    await new Promise((resolve, reject) => {
      let dataSent = false;
      let connectionEstablished = false;

      const client = net.createConnection({ host: ip, port: port }, () => {
        connectionEstablished = true;
        log(`✅ Conectado exitosamente a ${ip}:${port}`);

        // Intentar enviar datos
        try {
          client.write(buffer, (err) => {
            if (err) {
              log(`❌ Error al enviar datos: ${err.message}`);
              client.destroy();
              reject(err);
            } else {
              dataSent = true;
              log(`📤 Datos enviados exitosamente (${buffer.length} bytes)`);
              // Cerrar conexión después de un breve delay para asegurar que se envíen todos los datos
              setTimeout(() => {
                client.end();
                resolve();
              }, 500);
            }
          });
        } catch (writeError) {
          log(`❌ Error al escribir datos: ${writeError.message}`);
          client.destroy();
          reject(writeError);
        }
      });

      client.on('error', (err) => {
        // Siempre destruir el socket ante un error para no dejar conexiones colgadas
        client.destroy();
        if (!dataSent) {
          log(`❌ Error de conexión TCP: ${err.message} (código: ${err.code})`);

          // Mensajes de ayuda según el tipo de error
          let helpfulMessage = '';
          if (err.code === 'ECONNREFUSED') {
            helpfulMessage = ` La impresora rechazó la conexión. Verifique que esté encendida, que la IP (${ip}) sea correcta, y que el puerto (${port}) sea el correcto.`;
          } else if (err.code === 'ETIMEDOUT') {
            helpfulMessage = ` Timeout de conexión. Verifique que la IP (${ip}) sea accesible desde esta PC y que no haya firewall bloqueando.`;
          } else if (err.code === 'EHOSTUNREACH' || err.code === 'ENETUNREACH') {
            helpfulMessage = ` No se puede alcanzar la IP (${ip}). Verifique que esté en la misma red y que la IP sea correcta.`;
          }

          reject(new Error(`No se pudo conectar a la impresora ${ip}:${port}: ${err.message}${helpfulMessage}`));
        }
      });

      client.on('timeout', () => {
        log(`⏰ Timeout conectando a ${ip}:${port}`);
        client.destroy();
        if (!dataSent) {
          reject(new Error(`Timeout conectando a la impresora ${ip}:${port}`));
        }
      });

      // Asegurar liberación del socket al cerrarse la conexión
      client.on('close', () => {
        client.destroy();
      });

      // Timeout más largo para impresoras de red (10 segundos)
      client.setTimeout(10000);
    });

    log(`✅ Impresión enviada exitosamente a ${ip}:${port}`);

    res.json({
      success: true,
      message: `Ticket enviado exitosamente a impresora de red`,
      printer: `${ip}:${port}`,
      type: type,
      mode: 'network_tcp',
      bytesSent: buffer.length
    });

  } catch (error) {
    log(`❌ Error en impresión por red: ${error.message}`);

    // Intentar diagnóstico adicional
    log(`🔍 Realizando diagnóstico de red...`);
    // SEGURIDAD: validar ip/hostname y usar execFileSync con array de args (sin shell) para evitar RCE
    if (!isValidIPv4(ip) && !isValidHostname(ip)) {
      log(`⛔ Diagnóstico ping omitido: '${ip}' no pasó validación de IP/hostname`);
    } else try {
      log(`📡 Intentando hacer ping a ${ip}...`);
      const pingResult = execFileSync('ping', ['-n', '1', ip], { timeout: 3000, encoding: 'utf8', stdio: 'pipe' });
      if (pingResult.includes('TTL=')) {
        log(`✅ Ping exitoso a ${ip} - La IP es alcanzable`);
        log(`⚠️ Sin embargo, el puerto ${port} no responde. Posibles causas:`);
        log(`   - La impresora no está configurada para escuchar en el puerto ${port}`);
        log(`   - Hay un firewall bloqueando el puerto ${port}`);
        log(`   - La impresora necesita estar en modo "Network Printer" o "Raw Printing"`);
      } else {
        log(`❌ Ping falló o timeout - La IP ${ip} no es alcanzable`);
      }
    } catch (pingError) {
      log(`⚠️ No se pudo hacer ping a ${ip}: ${pingError.message}`);
      log(`💡 Esto puede indicar que la IP no es correcta o no está en la misma red`);
    }

    // Fallback: NO simular éxito. La impresión real falló; reportarlo claramente.
    log(`🔄 Fallback: impresión por red falló (no se simula éxito)`);

    res.status(502).json({
      success: false,
      simulated: true,
      message: `Error de conexión: ${error.message}`,
      printer: `${ip}:${port}`,
      type: type,
      mode: 'network_fallback',
      error: error.message,
      diagnostic: {
        ip: ip,
        port: port,
        suggestion: 'Verifique que la impresora esté encendida, conectada a la red, y que el puerto 9100 esté abierto. Pruebe hacer ping a la IP desde esta PC.'
      }
    });
  }
}

// Iniciar servidor
// Bind SOLO a loopback: el navegador local accede igual, pero no se expone en la red.
app.listen(PORT, '127.0.0.1', () => {
  log(`Servidor de impresion iniciado en http://localhost:${PORT}`);
  log(`🚀 Servidor de impresión iniciado en http://localhost:${PORT} (solo loopback 127.0.0.1)`);
  log(`🖨️ Impresora por defecto: ${getDefaultPrinter() || 'No configurada'}`);
});

// Manejo de errores
process.on('uncaughtException', (error) => {
  log(`❌ Error no capturado: ${error.message}`);
});

process.on('SIGINT', () => {
  log('🛑 Servidor detenido');
  process.exit(0);
});
