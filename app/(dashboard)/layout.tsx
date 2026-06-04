import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { KeyboardShortcutsProvider } from "@/components/shared/KeyboardShortcutsProvider";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("id, is_active, role")
    .eq("id", user.id)
    .maybeSingle();

  if (userError || !userData || !userData.is_active) {
    redirect("/login");
  }

  return (
    <div className="brand-shell min-h-screen flex flex-col">
      <KeyboardShortcutsProvider />
      <Navbar />
      <main
        id="main-content"
        className="container mx-auto flex-1 px-3 py-4 sm:px-4 sm:py-6 lg:px-6 lg:py-8"
      >
        {children}
      </main>
      <Footer />
    </div>
  );
}

