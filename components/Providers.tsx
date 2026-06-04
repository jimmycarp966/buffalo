"use client";

import { useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { ReactQueryProvider } from "@/components/shared/ReactQueryProvider";
import { PWAInstaller } from "@/components/PWAInstaller";
import { ChunkErrorHandler } from "@/components/shared/ChunkErrorHandler";
import { ConfirmProvider } from "@/components/providers/ConfirmProvider";
import { useAuthStore, type User as AuthUser } from "@/store/authStore";
import { createClient } from "@/lib/supabase/client";


interface AuthProviderProps {
  children: React.ReactNode;
  initialUser?: AuthUser | null;
}

async function fetchUserProfile(): Promise<AuthUser | null> {
  try {
    const response = await fetch("/api/auth/user", { credentials: "same-origin" });
    if (!response.ok) {
      return null;
    }

    const { user } = await response.json();
    return user ?? null;
  } catch (error) {
    console.error("Error fetching auth profile:", error);
    return null;
  }
}

function AuthProvider({ children, initialUser }: AuthProviderProps) {
  const { setUser, setLoading } = useAuthStore();
  const hasBootstrapped = useRef(false);

  useEffect(() => {
    if (initialUser !== undefined) {
      setUser(initialUser);
      setLoading(false);
      hasBootstrapped.current = true;
      return;
    }

    const bootstrap = async () => {
      const profile = await fetchUserProfile();
      setUser(profile);
      setLoading(false);
      hasBootstrapped.current = true;
    };

    bootstrap();
  }, [initialUser, setUser, setLoading]);

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_IN") {
        const profile = await fetchUserProfile();
        setUser(profile);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
      }

      if (!hasBootstrapped.current) {
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser, setLoading]);

  return <>{children}</>;
}

interface ProvidersProps {
  children: React.ReactNode;
  initialUser?: AuthUser | null;
}

export function Providers({ children, initialUser }: ProvidersProps) {
  return (
    <ReactQueryProvider>
      <AuthProvider initialUser={initialUser}>
        <ConfirmProvider>
          <ChunkErrorHandler />
          {children}
          <Toaster />
          <PWAInstaller />
        </ConfirmProvider>
      </AuthProvider>
    </ReactQueryProvider>
  );
}


