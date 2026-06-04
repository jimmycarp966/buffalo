import Link from "next/link";
import { brandFullName } from "@/lib/brand";

export default function NotFound() {
  return (
    <div className="brand-shell flex min-h-screen flex-col items-center justify-center px-6">
      <div className="brand-panel max-w-md space-y-4 text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-primary/70">{brandFullName}</p>
        <h1 className="font-display text-5xl text-primary">404</h1>
        <p className="text-lg text-foreground">Pagina no encontrada</p>
        <p className="text-sm text-muted-foreground">
          Esta ruta no forma parte del circuito principal del bar.
        </p>
        <Link
          href="/"
          className="inline-flex rounded-full border border-primary/40 bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(168, 52, 28,0.35)]"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
