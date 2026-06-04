export const brand = {
  name: "Buffalo",
  shortName: "Buffalo",
  descriptor: "Coffee & Food",
  platformName: "Sistema de Gestión",
  publicTagline: "Café de especialidad & Bar",
  dashboardTagline: "Backoffice de Buffalo",
  onlineOrderingLabel: "Carta y pedidos online",
  designer: "SiriuS",
  defaultStoreName: "Buffalo",
  logo: {
    src: "/buffalo-logo.png",
    icon: "/buffalo-icon-192.png",
    alt: "Logo de Buffalo Coffee & Food",
  },
  seo: {
    title: "Buffalo Coffee & Food | Sistema de Gestión",
    description:
      "Backoffice y carta pública de Buffalo Coffee & Food: barra, cocina, caja y pedidos online.",
  },
  colors: {
    background: "#EDF0FA",
    surface: "#FCFDFF",
    primary: "#2424CC",
    accent: "#3B82F6",
    text: "#16162E",
  },
} as const;

/** Nombre completo, p.ej. "Buffalo Coffee & Food". Para PWA, tickets, headers. */
export const brandFullName = `${brand.name} ${brand.descriptor}`;
/** Mensaje de agradecimiento por defecto en tickets. */
export const brandTicketThanks = `¡Gracias por elegir ${brand.name}!`;

export type BrandConfig = typeof brand;
