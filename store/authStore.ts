import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserRole } from "@/types/database.types";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  dni?: string | null;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: true,
      setUser: (user) => set({ user, isLoading: false }),
      setLoading: (loading) => set({ isLoading: loading }),
      logout: () => set({ user: null }),
    }),
    {
      name: "auth-storage",
      // Manejar errores de localStorage gracefully
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Error rehydrating auth store:', error);
          // Limpiar localStorage corrupto
          if (typeof window !== 'undefined') {
            try {
              localStorage.removeItem('auth-storage');
            } catch (e) {
              console.error('Error clearing corrupted storage:', e);
            }
          }
        }
      },
    }
  )
);

