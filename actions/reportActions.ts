"use server";

import { createClient } from "@/lib/supabase/server";
import { checkUserPermission } from "./permissionActions";

// Verifica que haya sesión y permiso "reports.view" para leer reportes financieros
async function ensureReportsAccess(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ ok: true } | { ok: false; message: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "No autenticado" };
  }

  const { hasPermission } = await checkUserPermission(user.id, "reports.view");
  if (!hasPermission) {
    return { ok: false, message: "No tenés permisos para esta acción" };
  }

  return { ok: true };
}

// ============================================
// FUNCIONES BÁSICAS SIN JOINS COMPLEJOS
// ============================================

export async function getSalesStats(
  startDate: string, 
  endDate: string, 
  cashRegister?: string, 
  shift?: string
) {
  try {
    const supabase = await createClient();

    const access = await ensureReportsAccess(supabase);
    if (!access.ok) {
      return { success: false, message: access.message, data: null };
    }

    let query = supabase
      .from("sales")
      .select("total_amount, created_at")
      .eq("status", "completed")
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    const { data: sales, error } = await query;

    if (error) throw error;

    const total_sales = sales?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0;
    const total_transactions = sales?.length || 0;
    const average_ticket = total_transactions > 0 ? total_sales / total_transactions : 0;

    // Unidades vendidas reales (suma de cantidades de ítems de ventas completadas)
    const { data: itemsData } = await supabase
      .from("sale_items")
      .select("quantity, sales!inner(status, created_at)")
      .eq("sales.status", "completed")
      .gte("sales.created_at", startDate)
      .lte("sales.created_at", endDate)
      .limit(100000);
    const total_products =
      itemsData?.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0) || 0;

    return {
      success: true,
      data: {
        total_sales: total_sales.toString(),
        total_transactions,
        average_ticket: average_ticket.toString(),
        total_products,
        net_margin: 0,
        growth_percentage: 0
      }
    };
  } catch (error: any) {
    console.error("Error fetching sales stats:", error);
    return { success: false, message: error.message || "Error al obtener estadísticas", data: null };
  }
}

export async function getTopSellingProducts(startDate: string, endDate: string, limit: number = 10) {
  try {
    const supabase = await createClient();

    const access = await ensureReportsAccess(supabase);
    if (!access.ok) {
      return { success: false, message: access.message, data: [] };
    }

    // Intentar usar función RPC primero
    const { data, error } = await supabase.rpc("get_top_selling_products", {
      p_start_date: startDate,
      p_end_date: endDate,
      p_limit_count: limit
    });

    if (error) {
      console.warn("RPC get_top_selling_products no disponible, usando query directa:", error);
      // Fallback a query directa si la función RPC no existe
      const fallbackQuery = await supabase
        .from("sale_items")
        .select("product_id, quantity, subtotal, products(name)")
        .gte("sales.created_at", startDate)
        .lte("sales.created_at", endDate)
        .limit(1000);

      if (fallbackQuery.error) throw fallbackQuery.error;

      // Agrupar por producto
      const productMap = new Map();
      fallbackQuery.data?.forEach(item => {
        const key = item.product_id;
        if (productMap.has(key)) {
          const existing = productMap.get(key);
          existing.total_quantity += item.quantity;
          existing.total_revenue += item.subtotal;
        } else {
          productMap.set(key, {
            product_id: item.product_id,
            product_name: item.products?.[0]?.name || "Producto desconocido",
            total_quantity: item.quantity,
            total_revenue: item.subtotal
          });
        }
      });

      const result = Array.from(productMap.values())
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .slice(0, limit);

      return { success: true, data: result };
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error("Error fetching top products:", error);
    return { success: false, message: error.message || "Error al obtener productos", data: [] };
  }
}

export async function getSalesByPaymentMethod(startDate: string, endDate: string) {
  try {
    const supabase = await createClient();

    const access = await ensureReportsAccess(supabase);
    if (!access.ok) {
      return { success: false, message: access.message, data: [] };
    }

    // Intentar usar función RPC primero
    const { data, error } = await supabase.rpc("get_sales_by_payment_method", {
      p_start_date: startDate,
      p_end_date: endDate
    });

    if (error) {
      console.warn("RPC get_sales_by_payment_method no disponible, usando query directa:", error);
      // Fallback a query directa
      const fallbackQuery = await supabase
        .from("sale_payments")
        .select("amount, payment_methods(name), sales!inner(created_at)")
        .gte("sales.created_at", startDate)
        .lte("sales.created_at", endDate)
        .limit(1000);

      if (fallbackQuery.error) throw fallbackQuery.error;

      // Procesar datos del fallback
      const methodMap = new Map();
      fallbackQuery.data?.forEach(payment => {
        const methodName = payment.payment_methods?.[0]?.name || "Desconocido";
        if (methodMap.has(methodName)) {
          const existing = methodMap.get(methodName);
          existing.total_amount += payment.amount;
          existing.transaction_count += 1;
        } else {
          methodMap.set(methodName, {
            payment_method: methodName,
            total_amount: payment.amount,
            transaction_count: 1
          });
        }
      });

      const totalAmount = Array.from(methodMap.values()).reduce((sum, method) => sum + method.total_amount, 0);
      const result = Array.from(methodMap.values()).map(method => ({
        ...method,
        percentage: totalAmount > 0 ? (method.total_amount / totalAmount) * 100 : 0
      }));

      return { success: true, data: result };
    }

    // Si RPC funcionó, devolver datos directamente
    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error("Error fetching payment methods:", error);
    return { success: false, message: error.message || "Error al obtener métodos de pago", data: [] };
  }
}

export async function getSalesByCashRegister(startDate: string, endDate: string) {
  try {
    const supabase = await createClient();

    const access = await ensureReportsAccess(supabase);
    if (!access.ok) {
      return { success: false, message: access.message, data: [] };
    }

    // Usar la función RPC que creamos en la base de datos
    const { data, error } = await supabase.rpc("get_sales_by_cash_register", {
      p_start_date: startDate,
      p_end_date: endDate
    });

    if (error) {
      console.warn("RPC get_sales_by_cash_register no disponible, usando query directa:", error);
      // Fallback a query directa si la función RPC no existe
      const fallbackQuery = await supabase
        .from("sales")
        .select(`
          total_amount,
          cash_register_sessions(area)
        `)
        .eq("status", "completed")
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      if (fallbackQuery.error) throw fallbackQuery.error;

      // Procesar datos del fallback
      const areaMap = new Map();
      fallbackQuery.data?.forEach(sale => {
        const area = sale.cash_register_sessions?.[0]?.area || "bar";
        const areaName = area === "bar" ? "BAR" : "OTRO";

        if (areaMap.has(area)) {
          const existing = areaMap.get(area);
          existing.total_sales += sale.total_amount;
          existing.transaction_count += 1;
        } else {
          areaMap.set(area, {
            cash_register: areaName,
            total_sales: sale.total_amount,
            transaction_count: 1
          });
        }
      });

      const result = Array.from(areaMap.values()).map(area => ({
        ...area,
        avg_ticket: area.transaction_count > 0 ? area.total_sales / area.transaction_count : 0
      }));

      return { success: true, data: result };
    }

    // Si RPC funcionó, devolver datos directamente
    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error("Error fetching cash register sales:", error);
    return { success: false, message: error.message || "Error al obtener ventas por caja", data: [] };
  }
}

export async function getIncomeVsExpenses(startDate: string, endDate: string) {
  try {
    const supabase = await createClient();

    const access = await ensureReportsAccess(supabase);
    if (!access.ok) {
      return { success: false, message: access.message, data: null };
    }

    const { data: salesData, error: salesError } = await supabase
      .from("sales")
      .select("total_amount")
      .eq("status", "completed")
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (salesError) throw salesError;

    const { data: expensesData, error: expensesError } = await supabase
      .from("expenses")
      .select("amount")
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (expensesError) throw expensesError;

    // Compras del período (insumos/mercadería comprada a proveedores) — también
    // son un costo que debe descontarse del resultado, no solo los gastos de caja.
    const { data: purchasesData, error: purchasesError } = await supabase
      .from("purchases")
      .select("total_amount")
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (purchasesError) throw purchasesError;

    const total_income = salesData?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0;
    const total_expenses = expensesData?.reduce((sum, expense) => sum + expense.amount, 0) || 0;
    const total_purchases = purchasesData?.reduce((sum, p) => sum + (p.total_amount || 0), 0) || 0;
    const total_costs = total_expenses + total_purchases;
    const net_profit = total_income - total_costs;
    const profit_margin = total_income > 0 ? (net_profit / total_income) * 100 : 0;

    return {
      success: true,
      data: {
        total_income,
        total_expenses,
        total_purchases,
        total_costs,
        net_profit,
        profit_margin
      }
    };
  } catch (error: any) {
    console.error("Error fetching income vs expenses:", error);
    return { success: false, message: error.message || "Error al obtener ingresos vs gastos", data: null };
  }
}

export async function getDailySales(startDate: string, endDate: string) {
  try {
    const supabase = await createClient();

    const access = await ensureReportsAccess(supabase);
    if (!access.ok) {
      return { success: false, message: access.message, data: [] };
    }

    const { data, error } = await supabase
      .from("sales")
      .select("total_amount, created_at")
      .eq("status", "completed")
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const dayMap = new Map();
    data?.forEach(sale => {
      try {
        const date = new Date(sale.created_at).toISOString().split('T')[0];
        if (dayMap.has(date)) {
          const existing = dayMap.get(date);
          existing.sales += sale.total_amount;
          existing.transactions += 1;
        } else {
          dayMap.set(date, {
            date,
            sales: sale.total_amount,
            transactions: 1
          });
        }
      } catch (dateError) {
        console.error("Error parsing date:", sale.created_at, dateError);
      }
    });

    const result = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error fetching daily sales:", error);
    return { success: false, message: error.message || "Error al obtener ventas diarias", data: [] };
  }
}

export async function getSalesByShift(startDate: string, endDate: string) {
  try {
    const supabase = await createClient();

    const access = await ensureReportsAccess(supabase);
    if (!access.ok) {
      return { success: false, message: access.message, data: [] };
    }

    // Usar la función RPC que creamos en la base de datos
    const { data, error } = await supabase.rpc("get_sales_by_shift", {
      p_start_date: startDate,
      p_end_date: endDate
    });

    if (error) {
      console.warn("RPC get_sales_by_shift no disponible, usando query directa:", error);
      // Fallback a query directa si la función RPC no existe
      const fallbackQuery = await supabase
        .from("sales")
        .select(`
          total_amount,
          cash_register_sessions(area, shift)
        `)
        .eq("status", "completed")
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      if (fallbackQuery.error) throw fallbackQuery.error;

      // Procesar datos del fallback
      const shiftMap = new Map();
      fallbackQuery.data?.forEach(sale => {
        const shift = sale.cash_register_sessions?.[0]?.shift || "morning";
        const area = sale.cash_register_sessions?.[0]?.area || "bar";
        const key = `${shift}-${area}`;

        if (shiftMap.has(key)) {
          const existing = shiftMap.get(key);
          existing.total_sales += sale.total_amount;
          existing.transaction_count += 1;
        } else {
          shiftMap.set(key, {
            shift: shift,
            area: area,
            total_sales: sale.total_amount,
            transaction_count: 1
          });
        }
      });

      const result = Array.from(shiftMap.values()).map(shift => ({
        ...shift,
        avg_ticket: shift.transaction_count > 0 ? shift.total_sales / shift.transaction_count : 0
      }));

      return { success: true, data: result };
    }

    // Si RPC funcionó, devolver datos directamente
    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error("Error fetching sales by shift:", error);
    return { success: false, message: error.message || "Error al obtener ventas por turno", data: [] };
  }
}

export async function getSalesByEmployee(startDate: string, endDate: string) {
  try {
    const supabase = await createClient();

    const access = await ensureReportsAccess(supabase);
    if (!access.ok) {
      return { success: false, message: access.message, data: [] };
    }

    const { data, error } = await supabase
      .from("sales")
      .select(`
        total_amount,
        user_id,
        users!sales_user_id_fkey(name)
      `)
      .eq("status", "completed")
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .limit(100);

    if (error) throw error;

    const employeeMap = new Map();
    data?.forEach(sale => {
      const userId = sale.user_id;
      if (employeeMap.has(userId)) {
        const existing = employeeMap.get(userId);
        existing.total_sales += sale.total_amount;
        existing.transaction_count += 1;
      } else {
        employeeMap.set(userId, {
          employee_id: userId,
          employee_name: (Array.isArray(sale.users) ? sale.users[0]?.name : (sale.users as any)?.name) || "Sin nombre",
          total_sales: sale.total_amount,
          transaction_count: 1,
          areas_worked: ["BAR"]
        });
      }
    });

    const result = Array.from(employeeMap.values()).map(employee => ({
      ...employee,
      avg_ticket: employee.transaction_count > 0 ? employee.total_sales / employee.transaction_count : 0
    }));

    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error fetching sales by employee:", error);
    return { success: false, message: error.message || "Error al obtener ventas por empleado", data: [] };
  }
}

export async function getProfitabilityReport(startDate: string, endDate: string) {
  try {
    const supabase = await createClient();

    const access = await ensureReportsAccess(supabase);
    if (!access.ok) {
      return { success: false, message: access.message, data: [] };
    }

    const { data, error } = await supabase
      .from("sale_items")
      .select("product_id, quantity, subtotal, products(name, cost_price)")
      .limit(100);

    if (error) throw error;

    const productMap = new Map();
    data?.forEach(item => {
      const key = item.product_id;
      if (productMap.has(key)) {
        const existing = productMap.get(key);
        existing.units_sold += item.quantity;
        existing.total_revenue += item.subtotal;
        existing.total_cost += (item.products?.[0]?.cost_price || 0) * item.quantity;
      } else {
        productMap.set(key, {
          product_id: item.product_id,
          product_name: item.products?.[0]?.name || "Producto desconocido",
          units_sold: item.quantity,
          total_revenue: item.subtotal,
          total_cost: (item.products?.[0]?.cost_price || 0) * item.quantity
        });
      }
    });

    const result = Array.from(productMap.values()).map(product => {
      const gross_profit = product.total_revenue - product.total_cost;
      const margin_percentage = product.total_revenue > 0 ? (gross_profit / product.total_revenue) * 100 : 0;
      
    return {
        ...product,
        gross_profit,
        margin_percentage
      };
    }).sort((a, b) => b.gross_profit - a.gross_profit);

    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error fetching profitability report:", error);
    return { success: false, message: error.message || "Error al obtener reporte de rentabilidad", data: [] };
  }
}

export async function getHourlySalesDistribution(startDate: string, endDate: string) {
  try {
    const supabase = await createClient();

    const access = await ensureReportsAccess(supabase);
    if (!access.ok) {
      return { success: false, message: access.message, data: [] };
    }

    const { data, error } = await supabase
      .from("sales")
      .select("total_amount, created_at")
      .eq("status", "completed")
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (error) throw error;

    const hourMap = new Map();
    data?.forEach(sale => {
      const hour = new Date(sale.created_at).getHours();
      if (hourMap.has(hour)) {
        const existing = hourMap.get(hour);
        existing.total_sales += sale.total_amount;
        existing.transaction_count += 1;
      } else {
        hourMap.set(hour, {
          hour,
          total_sales: sale.total_amount,
          transaction_count: 1
        });
      }
    });

    const result = [];
    for (let hour = 0; hour < 24; hour++) {
      const hourData = hourMap.get(hour) || { hour, total_sales: 0, transaction_count: 0 };
      result.push({
        ...hourData,
        avg_ticket: hourData.transaction_count > 0 ? hourData.total_sales / hourData.transaction_count : 0
      });
    }

    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error fetching hourly distribution:", error);
    return { success: false, message: error.message || "Error al obtener distribución horaria", data: [] };
  }
}

export async function getCategoryPerformance(startDate: string, endDate: string) {
  try {
    const supabase = await createClient();

    const access = await ensureReportsAccess(supabase);
    if (!access.ok) {
      return { success: false, message: access.message, data: [] };
    }

    const { data, error } = await supabase
      .from("sale_items")
      .select("quantity, subtotal, products(category_id, categories(name))")
      .limit(100);

    if (error) throw error;

    const categoryMap = new Map();
    data?.forEach(item => {
      const categoryId = item.products?.[0]?.category_id;
      if (categoryId) {
        if (categoryMap.has(categoryId)) {
          const existing = categoryMap.get(categoryId);
          existing.units_sold += item.quantity;
          existing.total_revenue += item.subtotal;
          existing.product_count += 1;
        } else {
          categoryMap.set(categoryId, {
            category_id: categoryId,
            category_name: item.products?.[0]?.categories?.[0]?.name || "Categoría desconocida",
            units_sold: item.quantity,
            total_revenue: item.subtotal,
            product_count: 1
          });
        }
      }
    });

    const result = Array.from(categoryMap.values()).map(category => ({
      ...category,
      avg_price: category.units_sold > 0 ? category.total_revenue / category.units_sold : 0,
      margin_percentage: 25.0
    }));

    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error fetching category performance:", error);
    return { success: false, message: error.message || "Error al obtener rendimiento por categoría", data: [] };
  }
}

export async function getSalesComparison(periodType: 'daily' | 'weekly' | 'monthly', endDate?: string) {
  try {
    const supabase = await createClient();

    const access = await ensureReportsAccess(supabase);
    if (!access.ok) {
      return { success: false, message: access.message, data: null };
    }

    const end = endDate ? new Date(endDate) : new Date();
    const start = new Date(end);
    
    switch (periodType) {
      case 'daily':
        start.setDate(start.getDate() - 1);
        break;
      case 'weekly':
        start.setDate(start.getDate() - 7);
        break;
      case 'monthly':
        start.setMonth(start.getMonth() - 1);
        break;
    }

    const { data: currentData, error: currentError } = await supabase
      .from("sales")
      .select("total_amount")
      .eq("status", "completed")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    if (currentError) throw currentError;

    const previousStart = new Date(start);
    const previousEnd = new Date(start);
    
    switch (periodType) {
      case 'daily':
        previousStart.setDate(previousStart.getDate() - 1);
        break;
      case 'weekly':
        previousStart.setDate(previousStart.getDate() - 7);
        break;
      case 'monthly':
        previousStart.setMonth(previousStart.getMonth() - 1);
        break;
    }

    const { data: previousData, error: previousError } = await supabase
      .from("sales")
      .select("total_amount")
      .eq("status", "completed")
      .gte("created_at", previousStart.toISOString())
      .lte("created_at", previousEnd.toISOString());

    if (previousError) throw previousError;

    const current_sales = currentData?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0;
    const previous_sales = previousData?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0;
    const growth_amount = current_sales - previous_sales;
    const growth_percentage = previous_sales > 0 ? (growth_amount / previous_sales) * 100 : 0;

    return {
      success: true,
      data: {
        current_period: {
          total_sales: current_sales,
          transaction_count: currentData?.length || 0,
          avg_ticket: currentData?.length > 0 ? current_sales / currentData.length : 0
        },
        previous_period: {
          total_sales: previous_sales,
          transaction_count: previousData?.length || 0,
          avg_ticket: previousData?.length > 0 ? previous_sales / previousData.length : 0
        },
        sales_growth_percentage: growth_percentage,
        growth_amount
      }
    };
  } catch (error: any) {
    console.error("Error fetching sales comparison:", error);
    return { success: false, message: error.message || "Error al obtener comparación de ventas", data: null };
  }
}