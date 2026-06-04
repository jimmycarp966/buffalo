import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    // Obtener datos adicionales del usuario desde la tabla users
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, email, name, role, is_active")
      .eq("id", user.id)
      .single();

    if (userError) {
      console.error("Error obteniendo datos del usuario:", userError);
      return NextResponse.json(
        { error: "Error obteniendo datos del usuario" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        is_active: userData.is_active,
      },
    });
  } catch (error) {
    console.error("Error en /api/auth/user:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}















