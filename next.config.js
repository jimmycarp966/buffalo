// Derivar el hostname de las imágenes de Supabase desde la env var pública.
// Evita hardcodear el ref del proyecto. Si la env var falta o es inválida,
// se usa el comodín **.supabase.co para no romper el build.
function getSupabaseImageHostname() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url) {
    try {
      return new URL(url).hostname;
    } catch {
      // URL inválida: caer al comodín
    }
  }
  return '**.supabase.co';
}
const supabaseImageHostname = getSupabaseImageHostname();

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactStrictMode: true,

  // Optimizaciones de compresión y minificación
  compress: true,
  poweredByHeader: false,

  // Configuraciones Experimentales (Estable en v15 pero configuraciones específicas aquí)
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb', // Aumentado para subida de imágenes/excel si fuera necesario
      // Permitir Server Actions solo desde orígenes locales para evitar CSRF mismatch.
      // Se quitaron wildcards e IPs de testing (testsprite, 192.168.*, 169.254.*, *.localhost).
      allowedOrigins: [
        'localhost:3000',
        '127.0.0.1:3000',
      ],
    },
  },

  // Headers de caché y seguridad
  async headers() {
    return [
      {
        // Headers de seguridad solo para páginas HTML, no para assets estáticos.
        // Se quitó el CORS global abierto (Access-Control-Allow-Origin: *) y los
        // headers Cookie/Authorization abiertos. La app es de uso local.
        source: '/((?!_next/static|_next/image|.*\\.(?:css|js|woff|woff2|png|jpg|jpeg|gif|webp|svg|ico)$).*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            // CSP razonable: como mínimo impedir que la app sea embebida en iframes.
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none'",
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
      {
        source: '/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, stale-while-revalidate=86400',
          },
        ],
      },
    ];
  },


  // Optimización de imágenes
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        // Derivar el hostname del proyecto Supabase desde la env var en lugar de hardcodearlo.
        // Fallback a comodín *.supabase.co para no romper si la env var no está definida.
        hostname: supabaseImageHostname,
      },
    ],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Webpack optimizations
  webpack: (config, { dev, isServer }) => {
    // Excluir archivos de test del build
    config.module.rules.push({
      test: /\.(test|spec)\.(ts|tsx|js|jsx)$/,
      use: 'ignore-loader',
    });

    return config;
  },
};

// Configuraciones condicionales para desarrollo
if (process.env.NODE_ENV === 'development') {
  // Deshabilitar caché agresivo en desarrollo
  nextConfig.onDemandEntries = {
    // Período de mantener páginas en memoria
    maxInactiveAge: 25 * 1000,
    // Número de páginas simultáneas en memoria
    pagesBufferLength: 2,
  };

  // Forzar webpack en desarrollo para estabilidad con Server Actions
  // Turbopack puede causar errores "Server Action not found" en desarrollo
  // En producción funciona correctamente con Turbopack
}

module.exports = nextConfig;
