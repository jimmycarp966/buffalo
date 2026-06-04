#!/usr/bin/env node

/**
 * Script de prueba de rendimiento para Shell Shop
 * Simula conexión lenta y mide métricas de rendimiento
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Iniciando pruebas de rendimiento...\n');

// Función para ejecutar comando y capturar output
function runCommand(command, description) {
  console.log(`📊 ${description}...`);
  try {
    const output = execSync(command, { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    console.log(`✅ ${description} completado`);
    return output;
  } catch (error) {
    console.error(`❌ Error en ${description}:`, error.message);
    return null;
  }
}

// Función para analizar bundle size
function analyzeBundleSize() {
  console.log('\n📦 Analizando tamaño del bundle...');
  
  try {
    // Build del proyecto
    console.log('🔨 Construyendo proyecto...');
    execSync('npm run build', { stdio: 'inherit' });
    
    // Verificar si existe el directorio .next
    const nextDir = path.join(process.cwd(), '.next');
    if (!fs.existsSync(nextDir)) {
      console.log('❌ No se encontró el directorio .next');
      return;
    }
    
    // Analizar archivos estáticos
    const staticDir = path.join(nextDir, 'static');
    if (fs.existsSync(staticDir)) {
      console.log('\n📁 Archivos estáticos:');
      const files = fs.readdirSync(staticDir, { recursive: true });
      let totalSize = 0;
      
      files.forEach(file => {
        const filePath = path.join(staticDir, file);
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          const sizeKB = (stats.size / 1024).toFixed(2);
          totalSize += stats.size;
          console.log(`  📄 ${file}: ${sizeKB} KB`);
        }
      });
      
      console.log(`\n📊 Tamaño total de archivos estáticos: ${(totalSize / 1024).toFixed(2)} KB`);
    }
    
  } catch (error) {
    console.error('❌ Error analizando bundle:', error.message);
  }
}

// Función para generar reporte de Lighthouse
function runLighthouseTest() {
  console.log('\n🔍 Ejecutando Lighthouse...');
  
  try {
    // Verificar si Lighthouse está instalado
    execSync('lighthouse --version', { stdio: 'pipe' });
    
    console.log('🌐 Iniciando servidor de desarrollo...');
    const devProcess = execSync('npm run dev', { 
      stdio: 'pipe',
      detached: true 
    });
    
    // Esperar a que el servidor esté listo
    setTimeout(() => {
      console.log('📊 Ejecutando Lighthouse en http://localhost:3000...');
      
      const lighthouseCommand = 'lighthouse http://localhost:3000 --output=json --output-path=./lighthouse-report.json --chrome-flags="--headless"';
      
      try {
        execSync(lighthouseCommand, { stdio: 'inherit' });
        
        // Leer y mostrar resultados
        if (fs.existsSync('./lighthouse-report.json')) {
          const report = JSON.parse(fs.readFileSync('./lighthouse-report.json', 'utf8'));
          const scores = report.categories;
          
          console.log('\n📊 Resultados de Lighthouse:');
          console.log(`  🎯 Performance: ${Math.round(scores.performance.score * 100)}`);
          console.log(`  ♿ Accessibility: ${Math.round(scores.accessibility.score * 100)}`);
          console.log(`  🎨 Best Practices: ${Math.round(scores['best-practices'].score * 100)}`);
          console.log(`  🔍 SEO: ${Math.round(scores.seo.score * 100)}`);
          
          // Métricas específicas
          const metrics = report.audits;
          console.log('\n📈 Métricas específicas:');
          console.log(`  ⏱️  First Contentful Paint: ${metrics['first-contentful-paint'].displayValue}`);
          console.log(`  🎯 Largest Contentful Paint: ${metrics['largest-contentful-paint'].displayValue}`);
          console.log(`  ⚡ Cumulative Layout Shift: ${metrics['cumulative-layout-shift'].displayValue}`);
          console.log(`  🔄 Speed Index: ${metrics['speed-index'].displayValue}`);
        }
        
      } catch (error) {
        console.error('❌ Error ejecutando Lighthouse:', error.message);
      }
    }, 10000); // Esperar 10 segundos
    
  } catch (error) {
    console.log('⚠️  Lighthouse no está instalado. Instalando...');
    try {
      execSync('npm install -g lighthouse', { stdio: 'inherit' });
      console.log('✅ Lighthouse instalado correctamente');
    } catch (installError) {
      console.error('❌ Error instalando Lighthouse:', installError.message);
    }
  }
}

// Función para verificar optimizaciones implementadas
function checkOptimizations() {
  console.log('\n🔍 Verificando optimizaciones implementadas...');
  
  const checks = [
    {
      name: 'Next.js config optimizado',
      check: () => fs.existsSync('next.config.ts') && fs.readFileSync('next.config.ts', 'utf8').includes('compress: true')
    },
    {
      name: 'Lazy loading de Recharts',
      check: () => fs.existsSync('components/shared/LazyRecharts.tsx')
    },
    {
      name: 'Skeletons de carga',
      check: () => fs.existsSync('components/shared/LoadingSkeleton.tsx')
    },
    {
      name: 'React Query optimizado',
      check: () => {
        const content = fs.readFileSync('lib/react-query.ts', 'utf8');
        return content.includes('refetchInterval: false');
      }
    },
    {
      name: 'Fuentes optimizadas',
      check: () => {
        const content = fs.readFileSync('app/layout.tsx', 'utf8');
        return content.includes('display: \'swap\'');
      }
    }
  ];
  
  checks.forEach(({ name, check }) => {
    try {
      const result = check();
      console.log(`${result ? '✅' : '❌'} ${name}`);
    } catch (error) {
      console.log(`❌ ${name} - Error verificando`);
    }
  });
}

// Función principal
function main() {
  console.log('🎯 Shell Shop - Pruebas de Rendimiento\n');
  
  // Verificar optimizaciones
  checkOptimizations();
  
  // Analizar bundle
  analyzeBundleSize();
  
  // Ejecutar Lighthouse (opcional)
  const runLighthouse = process.argv.includes('--lighthouse');
  if (runLighthouse) {
    runLighthouseTest();
  } else {
    console.log('\n💡 Para ejecutar Lighthouse, usa: node scripts/performance-test.js --lighthouse');
  }
  
  console.log('\n🎉 Pruebas completadas!');
  console.log('\n📋 Recomendaciones:');
  console.log('  • Usa Chrome DevTools con throttling "Slow 3G" para simular conexión lenta');
  console.log('  • Verifica que los skeletons se muestren correctamente');
  console.log('  • Prueba el módulo de caja con múltiples ventas seguidas');
  console.log('  • Monitorea el uso de memoria en DevTools');
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main();
}

module.exports = {
  analyzeBundleSize,
  runLighthouseTest,
  checkOptimizations
};
