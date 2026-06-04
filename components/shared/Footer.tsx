import { brand } from "@/lib/brand";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-primary/15 brand-shell py-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-muted-foreground">
            (c) {currentYear} {brand.name} {brand.descriptor}. Todos los derechos reservados.
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Disenado por</span>{" "}
            <span className="font-semibold text-secondary">{brand.designer}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
