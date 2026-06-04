"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  openCashRegisterSchema,
  closeCashRegisterSchema,
  incomeSchema,
  type OpenCashRegisterInput,
  type CloseCashRegisterInput,
  type IncomeInput,
} from "@/lib/validations";
import { getCurrentDate } from "@/lib/utils";
import { randomUUID } from "crypto";
import { checkUserPermission } from "./permissionActions";
import { invalidateCashSessionsCache } from "@/lib/cache";

export async function openCashRegister(data: OpenCashRegisterInput) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("❌ openCashRegister - Auth fail:", authError);
      return { success: false, message: `Autenticación fallida: ${authError?.message || "No autenticado"}` };
    }

    // 1. Verificar permisos (Verificación robusta v3.4.8)
    const { success: permSuccess, hasPermission } = await checkUserPermission(user.id, "cash.open");

    if (!permSuccess || !hasPermission) {
      console.error(`❌ openCashRegister - Permiso denegado para: ${user.id} (${user.email})`);
      return {
        success: false,
        message: `No tienes permisos para abrir caja.`,
      };
    }

    // Validar con Zod
    const validated = openCashRegisterSchema.parse(data);
    const activeShift = "night";

    // Sistema de caja: verificar si ya hay una sesión abierta
    const { data: existingSession, error: sessionError } = await supabase
      .from("cash_register_sessions")
      .select("*")
      .eq("area", validated.area)
      .is("closed_at", null)
      .maybeSingle();

    if (sessionError) {
      console.error("❌ openCashRegister - Session check error:", sessionError);
      throw sessionError;
    }

    if (existingSession) {
      return {
        success: false,
        message: `Ya hay una sesión abierta para CAJA BAR`,
      };
    }

    // Obtener la caja del bar
    const { data: cashRegister, error: registerError } = await supabase
      .from("cash_registers")
      .select("*")
      .eq("type", validated.area)
      .maybeSingle();

    if (registerError || !cashRegister) {
      console.error("❌ openCashRegister - Cash register not found:", registerError);
      return {
        success: false,
        message: `Error: No se encontró CAJA BAR configurada`,
      };
    }

    // Crear sesión para la caja con su monto inicial
    const sessionToCreate = {
      cash_register_id: cashRegister.id,
      user_id: user.id,
      opened_by: user.id,
      opening_amount: validated.opening_amount, // Monto inicial de la caja
      area: validated.area, // 'bar'
      shift: activeShift, // Este bar opera solo en turno noche
      opening_notes: validated.opening_notes || `Sesión - CAJA BAR`,
      opened_at: getCurrentDate().toISOString(),
    };

    // Insertar la sesión de la caja
    const { data: sessions, error } = await supabase
      .from("cash_register_sessions")
      .insert([sessionToCreate])
      .select();

    if (error) {
      console.error("❌ openCashRegister - Insert session error:", error);
      throw error;
    }

    // Registrar turno de trabajo para esta sesión
    const session = sessions?.[0];
    if (session) {
      await supabase.from("work_shifts").insert([
        {
          id: randomUUID(),
          user_id: user.id,
          cash_register_session_id: session.id,
          check_in: getCurrentDate().toISOString(),
        },
      ]);
    }

    // Invalidar caché de Next.js
    revalidatePath("/caja-bar");
    revalidatePath("/dashboard");

    // Invalidar queries de React Query para sesiones de caja
    invalidateCashSessionsCache();

    return { success: true, data: sessions };
  } catch (error: any) {
    console.error("❌ ERROR openCashRegister:", error);
    return {
      success: false,
      message: error.message || "Error al abrir la caja",
    };
  }
}

export async function closeCashRegister(data: CloseCashRegisterInput) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    // Verificar permisos granulares
    const { hasPermission } = await checkUserPermission(user.id, "cash.close");
    if (!hasPermission) {
      return { success: false, message: "No tienes permisos para cerrar caja" };
    }

    // Validar con Zod
    const validated = closeCashRegisterSchema.parse(data);

    // Obtener sesión actual con información completa
    const { data: session, error: sessionError } = await supabase
      .from("cash_register_sessions")
      .select(`
        *,
        cash_register:cash_registers(type, name)
      `)
      .eq("id", validated.session_id)
      .single();

    if (sessionError) throw sessionError;

    // Sistema de caja: cerrar la sesión
    const totalOpeningAmount = session.opening_amount;

    // Obtener ventas SOLO de esta sesión específica
    const { data: sales, error: salesError } = await supabase
      .from("sales")
      .select(`
        id,
        total_amount,
        status,
        created_at,
        cash_register_session_id,
        sale_payments!left(
          amount,
          payment_method:payment_methods!inner(name)
        )
      `)
      .eq("status", "completed")
      .eq("cash_register_session_id", validated.session_id);

    if (salesError) throw salesError;

    // Obtener gastos SOLO de esta sesión específica
    const { data: expenses, error: expensesError } = await supabase
      .from("expenses")
      .select("amount, created_at")
      .eq("cash_register_session_id", validated.session_id);

    if (expensesError) throw expensesError;

    // Obtener ingresos SOLO de esta sesión específica
    const { data: incomes, error: incomesError } = await supabase
      .from("cash_incomes")
      .select("amount, created_at, description")
      .eq("cash_register_session_id", validated.session_id);

    if (incomesError) throw incomesError;

    // Calcular totales por método de pago
    const paymentTotals: Record<string, number> = {};
    let totalSales = 0;
    let totalExpenses = 0;
    let totalIncomes = 0;
    let cashSales = 0; // Solo ventas en efectivo
    let cashExpenses = 0; // Solo gastos en efectivo
    let cashIncomes = 0; // Solo ingresos en efectivo

    if (sales) {
      sales.forEach((sale: any) => {
        totalSales += sale.total_amount;
        if (sale.sale_payments && sale.sale_payments.length > 0) {
          sale.sale_payments.forEach((payment: any) => {
            const methodName = Array.isArray(payment.payment_method)
              ? payment.payment_method[0]?.name || 'Desconocido'
              : (payment.payment_method as any)?.name || 'Desconocido';
            const oldAmount = paymentTotals[methodName] || 0;
            paymentTotals[methodName] = oldAmount + payment.amount;

            // Solo contar efectivo para el monto esperado
            if (methodName.toLowerCase().includes('efectivo') || methodName.toLowerCase().includes('cash')) {
              cashSales += payment.amount;
            }
          });
        } else {
          // Si la venta no tiene pagos pero tiene un monto, asumir que es efectivo por defecto
          const assumedMethodName = 'Efectivo';
          const oldAmount = paymentTotals[assumedMethodName] || 0;
          paymentTotals[assumedMethodName] = oldAmount + sale.total_amount;
          cashSales += sale.total_amount;
        }
      });
    }

    if (expenses) {
      totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      // Asumir que todos los gastos son en efectivo por ahora
      cashExpenses = totalExpenses;
    }

    if (incomes) {
      totalIncomes = incomes.reduce((sum, income) => sum + income.amount, 0);
      // Todos los ingresos son en efectivo
      cashIncomes = totalIncomes;
    }

    // Calcular monto esperado SOLO para EFECTIVO (monto inicial + ventas efectivo + ingresos efectivo - gastos efectivo)
    const expected_amount = totalOpeningAmount + cashSales + cashIncomes - cashExpenses;
    const difference = validated.closing_amount - expected_amount;

    // Cerrar SOLO esta sesión específica (no todas las del turno)
    const closedAtIso = getCurrentDate().toISOString();
    const { data: closedSessions, error } = await supabase
      .from("cash_register_sessions")
      .update({
        closing_amount: validated.closing_amount,
        expected_amount: expected_amount,
        difference: difference,
        status: "closed",
        closed_by: user.id, // Usuario que cierra la caja
        closed_at: closedAtIso,
        closing_notes: validated.closing_notes,
      })
      .eq("id", validated.session_id)
      .select();

    if (error) throw error;

    // Cerrar solo los turnos de trabajo asociados a esta sesión
    const { data: workShifts } = await supabase
      .from("work_shifts")
      .select("*")
      .eq("cash_register_session_id", validated.session_id)
      .is("check_out", null);

    if (workShifts && workShifts.length > 0) {
      await supabase
        .from("work_shifts")
        .update({
          check_out: getCurrentDate().toISOString(),
        })
        .in("id", workShifts.map(ws => ws.id));
    }

    // Invalidar caché de Next.js
    revalidatePath("/caja-bar");
    revalidatePath("/dashboard");

    // Invalidar queries de React Query para sesiones de caja
    invalidateCashSessionsCache();

    // ---- Datos para el ticket de arqueo (cierre de caja) ----
    let openedByName = "—";
    let closedByName = "—";
    let arqueoNumber: number | null = null;
    try {
      const admin = createAdminClient();
      const ids = Array.from(new Set([session.opened_by, user.id].filter(Boolean)));
      if (ids.length) {
        const { data: userRows } = await admin
          .from("users")
          .select("id, name")
          .in("id", ids);
        const nameById = new Map((userRows || []).map((u: any) => [u.id, u.name]));
        openedByName = nameById.get(session.opened_by) || "—";
        closedByName = nameById.get(user.id) || "—";
      }
      const { count } = await supabase
        .from("cash_register_sessions")
        .select("id", { count: "exact", head: true })
        .eq("cash_register_id", session.cash_register_id)
        .eq("status", "closed");
      arqueoNumber = count ?? null;
    } catch (e) {
      console.error("Error preparando datos de arqueo:", e);
    }

    return {
      success: true,
      data: {
        sessions: closedSessions,
        sales: sales || [],
        expenses: expenses || [],
        incomes: incomes || [],
        paymentTotals,
        totalSales,
        totalExpenses,
        totalIncomes,
        expected_amount,
        difference,
        totalOpeningAmount,
        // Datos extra para el ticket de arqueo
        closing_amount: validated.closing_amount,
        cashSales,
        cashExpenses,
        cashIncomes,
        arqueo_number: arqueoNumber,
        opened_at: session.opened_at,
        closed_at: closedAtIso,
        opened_by_name: openedByName,
        closed_by_name: closedByName,
        cash_register_name: session.cash_register?.name || "Caja",
        closing_notes: validated.closing_notes || "",
      }
    };
  } catch (error: any) {
    console.error("Error closing cash register:", error);
    return {
      success: false,
      message: error.message || "Error al cerrar la caja",
    };
  }
}

export async function getActiveCashSession(cashRegisterId?: string) {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("cash_register_sessions")
      .select(
        `
        *,
        cash_register:cash_registers(id, name, type),
        opened_by:users!opened_by(id, full_name),
        closed_by:users!closed_by(id, full_name)
      `
      )
      .is("closed_at", null);

    // Si se especifica cashRegisterId, filtrar por él
    // Si no, traer todas las sesiones abiertas
    if (cashRegisterId) {
      query = query.eq("cash_register_id", cashRegisterId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error en query de cash session:", error);
      throw error;
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error("Error fetching active cash session:", error);
    return {
      success: false,
      message: error.message || "Error al obtener sesión de caja",
      data: [],
    };
  }
}

export async function getCashRegisters() {
  try {
    const supabase = await createClient();

    // Obtener la caja del bar
    const { data: cashRegisters, error: cashError } = await supabase
      .from("cash_registers")
      .select("*")
      .eq("type", "bar")
      .eq("is_active", true);

    if (cashError) {
      console.error("❌ Error obteniendo cajas registradoras:", cashError);
      throw cashError;
    }

    // Si no existe la caja del bar, devolver error claro
    if (!cashRegisters || cashRegisters.length === 0) {
      return {
        success: false,
        message: "No se encontró CAJA BAR en la base de datos. Por favor, contacta al administrador para crear la caja o ejecuta el script FIX_CAJA_BAR_ISSUE.sql en Supabase.",
        data: [],
      };
    }

    const registersToUse = cashRegisters;

    // Obtener sesiones abiertas para la caja
    const { data: activeSessions, error: sessionsError } = await supabase
      .from("cash_register_sessions")
      .select("area, cash_register_id, shift, closed_at")
      .in("cash_register_id", registersToUse.map(r => r.id))
      .is("closed_at", null); // Sesiones activas son las que no tienen closed_at

    if (sessionsError) throw sessionsError;

    // Agregar información de sesiones activas a la caja
    const enrichedRegisters = registersToUse?.map(cashRegister => ({
      ...cashRegister,
      activeAreas: activeSessions?.filter(session => session.cash_register_id === cashRegister.id)
        .map(session => ({ area: session.area, shift: session.shift, isActive: session.closed_at === null })) || []
    })) || [];

    return { success: true, data: enrichedRegisters };
  } catch (error: any) {
    console.error("Error fetching cash registers:", error);
    return {
      success: false,
      message: error.message || "Error al obtener cajas",
      data: [],
    };
  }
}

export async function getCashHistory(cashRegisterId: string) {
  try {
    const supabase = await createClient();

    // Obtener sesiones cerradas con estadísticas
    const { data, error } = await supabase
      .from("cash_register_sessions")
      .select(
        `
        id,
        shift,
        opening_amount,
        closing_amount,
        difference,
        opened_at,
        closed_at,
        opened_by:users!opened_by(id, full_name),
        closed_by:users!closed_by(id, full_name)
      `
      )
      .eq("cash_register_id", cashRegisterId)
      .not("closed_at", "is", null)
      .order("opened_at", { ascending: false });

    if (error) throw error;

    // Para cada sesión, obtener estadísticas de ventas, gastos y desglose por método de pago
    const sessionsWithStats = await Promise.all(
      (data || []).map(async (session) => {
        // Obtener ventas con sus pagos y facturas para calcular el desglose por método
        const { data: salesData } = await supabase
          .from("sales")
          .select(`
            id,
            total_amount,
            sale_payments!left(
              amount,
              payment_method:payment_methods!inner(name)
            ),
            invoice:invoices!left(
              id
            )
          `)
          .eq("cash_register_session_id", session.id)
          .eq("status", "completed");

        const sales_count = salesData?.length || 0;
        const sales_total = salesData?.reduce((sum, sale) => sum + parseFloat(sale.total_amount as any), 0) || 0;

        // Calcular totales por método de pago
        const paymentTotals: Record<string, number> = {};
        let totalInvoiced = 0;

        if (salesData) {
          salesData.forEach((sale: any) => {
            // Calcular pagos por método
            if (sale.sale_payments && sale.sale_payments.length > 0) {
              sale.sale_payments.forEach((payment: any) => {
                const methodName = Array.isArray(payment.payment_method)
                  ? payment.payment_method[0]?.name || 'Efectivo'
                  : (payment.payment_method as any)?.name || 'Efectivo';
                paymentTotals[methodName] = (paymentTotals[methodName] || 0) + payment.amount;
              });
            } else {
              // Si no tiene pagos registrados, asumir efectivo
              paymentTotals['Efectivo'] = (paymentTotals['Efectivo'] || 0) + sale.total_amount;
            }

            // Calcular total facturado (si tiene factura, usar el total_amount de la venta)
            if (sale.invoice) {
              const invoice = Array.isArray(sale.invoice) ? sale.invoice[0] : sale.invoice;
              if (invoice && invoice.id) {
                // Si tiene factura, sumar el total de la venta
                totalInvoiced += parseFloat(sale.total_amount as any);
              }
            }
          });
        }

        // Contar gastos
        const { data: expensesData } = await supabase
          .from("expenses")
          .select("amount", { count: "exact" })
          .eq("cash_register_session_id", session.id);

        const expenses_count = expensesData?.length || 0;
        const expenses_total = expensesData?.reduce((sum, expense) => sum + parseFloat(expense.amount as any), 0) || 0;

        return {
          ...session,
          sales_count,
          sales_total,
          expenses_count,
          expenses_total,
          payment_totals: paymentTotals, // Agregar el desglose por método de pago
          total_invoiced: totalInvoiced, // Total facturado
        };
      })
    );

    return { success: true, data: sessionsWithStats };
  } catch (error: any) {
    console.error("Error fetching cash history:", error);
    return {
      success: false,
      message: error.message || "Error al obtener historial",
      data: [],
    };
  }
}

export async function createIncome(data: IncomeInput) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "No autenticado" };
    }

    // Verificar permisos granulares
    const { hasPermission } = await checkUserPermission(user.id, "cash.deposit");
    if (!hasPermission) {
      return { success: false, message: "No tenés permisos para esta acción" };
    }

    // Validar con Zod
    const validated = incomeSchema.parse(data);

    // Verificar que la sesión exista y esté abierta
    const { data: session, error: sessionError } = await supabase
      .from("cash_register_sessions")
      .select("*")
      .eq("id", validated.cash_register_session_id)
      .is("closed_at", null)
      .maybeSingle();

    if (sessionError) throw sessionError;

    if (!session) {
      return {
        success: false,
        message: "No hay una sesión de caja abierta para registrar el ingreso",
      };
    }

    // Crear el ingreso
    const { data: income, error } = await supabase
      .from("cash_incomes")
      .insert({
        cash_register_session_id: validated.cash_register_session_id,
        amount: validated.amount,
        description: validated.description,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    // Invalidar caché de Next.js
    revalidatePath("/caja-bar");
    revalidatePath("/dashboard");

    // Invalidar queries de React Query para sesiones de caja
    invalidateCashSessionsCache();

    return { success: true, data: income };
  } catch (error: any) {
    console.error("Error creating income:", error);
    return {
      success: false,
      message: error.message || "Error al registrar el ingreso",
    };
  }
}

export async function getCashSummaryPreview(sessionId: string) {
  try {
    const supabase = await createClient();

    // Obtener sesión actual con información completa
    const { data: session, error: sessionError } = await supabase
      .from("cash_register_sessions")
      .select(`
        *,
        cash_register:cash_registers(type, name),
        status
      `)
      .eq("id", sessionId)
      .single();

    if (sessionError) throw sessionError;

    // Sistema de caja: calcular para esta sesión
    const totalOpeningAmount = session.opening_amount;

    // Consulta con pagos SOLO de esta sesión específica
    const { data: sales, error: salesError } = await supabase
      .from("sales")
      .select(`
        id,
        total_amount,
        status,
        created_at,
        cash_register_session_id,
        sale_payments!left(
          amount,
          payment_method:payment_methods!inner(name)
        )
      `)
      .eq("status", "completed")
      .eq("cash_register_session_id", sessionId);

    if (salesError) throw salesError;

    // Obtener gastos SOLO de esta sesión específica
    const { data: expenses, error: expensesError } = await supabase
      .from("expenses")
      .select("amount, created_at")
      .eq("cash_register_session_id", sessionId);

    if (expensesError) throw expensesError;

    // Obtener ingresos SOLO de esta sesión específica
    const { data: incomes, error: incomesError } = await supabase
      .from("cash_incomes")
      .select("amount, created_at, description")
      .eq("cash_register_session_id", sessionId);

    if (incomesError) throw incomesError;

    // Calcular totales por método de pago
    const paymentTotals: Record<string, number> = {};
    let totalSales = 0;
    let totalExpenses = 0;
    let totalIncomes = 0;
    let cashSales = 0; // Solo ventas en efectivo
    let cashExpenses = 0; // Solo gastos en efectivo
    let cashIncomes = 0; // Solo ingresos en efectivo

    if (sales) {
      sales.forEach((sale: any) => {
        totalSales += sale.total_amount;
        if (sale.sale_payments && sale.sale_payments.length > 0) {
          sale.sale_payments.forEach((payment: any) => {
            const methodName = Array.isArray(payment.payment_method)
              ? payment.payment_method[0]?.name || 'Desconocido'
              : (payment.payment_method as any)?.name || 'Desconocido';
            const oldAmount = paymentTotals[methodName] || 0;
            paymentTotals[methodName] = oldAmount + payment.amount;

            // Solo contar efectivo para el monto esperado
            if (methodName.toLowerCase().includes('efectivo') || methodName.toLowerCase().includes('cash')) {
              cashSales += payment.amount;
            }
          });
        } else {
          // Si la venta no tiene pagos pero tiene un monto, asumir que es efectivo por defecto
          const assumedMethodName = 'Efectivo';
          const oldAmount = paymentTotals[assumedMethodName] || 0;
          paymentTotals[assumedMethodName] = oldAmount + sale.total_amount;
          cashSales += sale.total_amount;
        }
      });
    }

    if (expenses) {
      totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      // Asumir que todos los gastos son en efectivo por ahora
      cashExpenses = totalExpenses;
    }

    if (incomes) {
      totalIncomes = incomes.reduce((sum, income) => sum + income.amount, 0);
      // Todos los ingresos son en efectivo
      cashIncomes = totalIncomes;
    }

    // Calcular monto esperado SOLO para EFECTIVO (monto inicial + ventas efectivo + ingresos efectivo - gastos efectivo)
    const expected_amount = totalOpeningAmount + cashSales + cashIncomes - cashExpenses;

    // ---- Metadatos para la vista previa del arqueo ----
    let openedByName = "—";
    let closedByName = "—";
    let arqueoNumber: number | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const admin = createAdminClient();
      const ids = Array.from(new Set([session.opened_by, user?.id].filter(Boolean)));
      if (ids.length) {
        const { data: userRows } = await admin.from("users").select("id, name").in("id", ids);
        const nameById = new Map((userRows || []).map((u: any) => [u.id, u.name]));
        openedByName = nameById.get(session.opened_by) || "—";
        closedByName = (user?.id ? nameById.get(user.id) : null) || "—";
      }
      const { count } = await supabase
        .from("cash_register_sessions")
        .select("id", { count: "exact", head: true })
        .eq("cash_register_id", session.cash_register_id)
        .eq("status", "closed");
      arqueoNumber = (count ?? 0) + 1;
    } catch (e) {
      console.error("Error preparando metadatos de arqueo (preview):", e);
    }

    return {
      success: true,
      data: {
        sessions: [session], // Solo la sesión actual
        sales: sales || [],
        expenses: expenses || [],
        incomes: incomes || [],
        paymentTotals,
        totalSales,
        totalExpenses,
        totalIncomes,
        expected_amount,
        difference: 0, // Para preview, la diferencia se calcula cuando se ingresa el monto real
        totalOpeningAmount,
        // Metadatos para la vista previa del arqueo
        opened_at: session.opened_at,
        cash_register_name: session.cash_register?.name || "Caja",
        opened_by_name: openedByName,
        closed_by_name: closedByName,
        arqueo_number: arqueoNumber,
      }
    };
  } catch (error: any) {
    console.error("Error getting cash summary preview:", error);
    return {
      success: false,
      message: error.message || "Error al calcular resumen de caja",
    };
  }
}



