"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNotificationStore } from "@/store/notificationStore";
import { useAuthStore } from "@/store/authStore";
import { createClient } from "@/lib/supabase/client";
import { brand } from "@/lib/brand";
import { OptimizedLogo } from "@/components/shared/OptimizedLogo";

function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const setUser = useAuthStore((state) => state.setUser);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const supabase = createClient();
      const trimmedEmail = email.trim();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error("No se pudo autenticar");
      }

      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, email, name, role, is_active")
        .eq("id", data.user.id)
        .single();

      if (userError) {
        await supabase.auth.signOut();
        throw new Error("No se pudo obtener el perfil del usuario");
      }

      if (!userData?.is_active) {
        await supabase.auth.signOut();
        throw new Error("Tu cuenta esta desactivada. Contacta al administrador");
      }

      setUser({
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
      });

      addNotification("success", `Bienvenido, ${userData.name}`);

      const urlParams = new URLSearchParams(window.location.search);
      let redirectTo = urlParams.get("redirectTo");

      if (!redirectTo) {
        if (userData.role === "kitchen") {
          redirectTo = "/cocina";
        } else if (userData.role === "cashier") {
          redirectTo = "/caja-bar";
        } else {
          redirectTo = "/dashboard";
        }
      }

      const redirectPath = redirectTo.startsWith("/") ? redirectTo : `/${redirectTo}`;

      setTimeout(() => {
        router.replace(redirectPath);
        router.refresh();
      }, 100);
    } catch (error: unknown) {
      let message = error instanceof Error ? error.message : "Error al iniciar sesion";
      if (message.includes("Invalid login credentials")) {
        message = "Email o contrasena incorrectos";
      }
      addNotification("error", message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="brand-shell relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8">
      <div className="brand-grid pointer-events-none absolute inset-0 opacity-20" />
      <div className="pointer-events-none absolute inset-x-0 top-12 mx-auto h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-[-10%] h-80 w-80 rounded-full bg-secondary/10 blur-3xl" />

      <Card className="brand-panel relative z-10 w-full max-w-xl overflow-hidden border-primary/25">
        <CardHeader className="border-b border-primary/15 bg-[radial-gradient(circle_at_top,rgba(168, 52, 28,0.06),transparent_50%)] pb-8 pt-8 text-center">
          <div className="mb-6 flex justify-center">
            <div className="rounded-full border border-secondary/30 bg-muted p-3 shadow-[0_0_40px_rgba(168, 52, 28,0.18)]">
              <OptimizedLogo width={132} height={132} priority className="h-28 w-28 object-contain sm:h-32 sm:w-32" />
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.45em] text-primary">{brand.descriptor}</p>
            <CardTitle className="font-brand text-4xl text-secondary sm:text-5xl">{brand.name}</CardTitle>
            <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-primary/25 bg-background/50 px-4 py-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>{brand.platformName}</span>
            </div>
            <CardDescription className="mx-auto max-w-md text-base text-muted-foreground">
              Barra, cocina, caja y operacion nocturna con una sola identidad visual.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-6 sm:p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="equipo@buffalo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                Contrasena
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="h-12"
              />
            </div>

            <Button type="submit" className="h-12 w-full text-base uppercase tracking-[0.24em]" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Ingresando
                </>
              ) : (
                "Ingresar"
              )}
            </Button>

            <div className="space-y-1 pt-3 text-center">
              <p className="text-xs text-muted-foreground">
                {brand.name} {brand.descriptor} - {brand.platformName}
              </p>
              <p className="text-xs text-muted-foreground">
                Disenado por <span className="font-semibold text-secondary">{brand.designer}</span>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="brand-shell flex min-h-screen items-center justify-center">
          <Card className="brand-panel w-full max-w-md">
            <CardContent className="p-12 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">Cargando acceso...</p>
            </CardContent>
          </Card>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
