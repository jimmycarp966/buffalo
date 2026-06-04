import { brand } from "@/lib/brand";
import { OptimizedLogo } from "@/components/shared/OptimizedLogo";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="brand-shell min-h-screen text-foreground">
      <header className="sticky top-0 z-40 border-b border-primary/15 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-4">
            <OptimizedLogo width={68} height={68} priority className="h-16 w-16 object-contain" />
            <div>
              <p className="font-brand text-xl leading-none text-secondary sm:text-2xl">{brand.name}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.35em] text-primary">{brand.descriptor}</p>
            </div>
          </div>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-foreground">{brand.onlineOrderingLabel}</p>
            <p className="text-xs text-muted-foreground">{brand.publicTagline}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

      <footer className="mt-12 border-t border-primary/15 bg-background/60 px-6 py-6 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {brand.name} {brand.descriptor}. Carta, caja y pedidos en un mismo sistema.
          </p>
        </div>
      </footer>
    </div>
  );
}
