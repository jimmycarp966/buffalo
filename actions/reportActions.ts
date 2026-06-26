"use server";

import { createClient } from "@/lib/supabase/server";
import { checkUserPermission } from "./permissionActions";
import { getBusinessDateString, getArgHour, getArgWeekday } from "@/lib/businessDay";

// Devuelve el primer elemento si es array, o el objeto si es to-one (embeds de Supabase)
const one = (x: any) => (Array.isArray(x) ? x[0] : x);

// Trae TODAS las filas paginando, para no truncar agregaciones por el tope por
// defecto de PostgREST (~1000 filas). buildQuery debe aplicar .range(from, to).
async function fetchAllRows(buildQuery: (from: number, to: number) => any): Promise<any[]> {
  const pageSize = 1000;
  let from = 0;
  const all: any[] = [];
  for (let i = 0; i < 200; i++) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

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

    const sales = await fetchAllRows((from, to) =>
      supabase
        .from("sales")
        .select("total_amount, created_at")
        .eq("status", "completed")
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .range(from, to)
    );

    const total_sales = sales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
    const total_transactions = sales.length;
    const average_ticket = total_transactions > 0 ? total_sales / total_transactions : 0;

    // Unidades vendidas reales (suma de cantidades de ítems de ventas completadas)
    const itemsData = await fetchAllRows((from, to) =>
      supabase
        .from("sale_items")
        .select("quantity, sales!inner(status, created_at)")
        .eq("sales.status", "completed")
        .gte("sales.created_at", startDate)
        .lte("sales.created_at", endDate)
        .range(from, to)
    );
    const total_products =
      itemsData.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0);

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
      const fallbackData = await fetchAllRows((from, to) =>
        supabase
          .from("sale_items")
          .select("product_id, quantity, subtotal, products(name), sales!inner(status, created_at)")
          .eq("sales.status", "completed")
          .gte("sales.created_at", startDate)
          .lte("sales.created_at", endDate)
          .range(from, to)
      );

      // Agrupar por producto
      const productMap = new Map();
      fallbackData.forEach(item => {
        const key = item.product_id;
        if (productMap.has(key)) {
          const existing = productMap.get(key);
          existing.total_quantity += item.quantity;
          existing.total_revenue += item.subtotal;
        } else {
          productMap.set(key, {
            product_id: item.product_id,
            product_name: one(item.products)?.name || "Producto desconocido",
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
      const fallbackData = await fetchAllRows((from, to) =>
        supabase
          .from("sale_payments")
          .select("amount, payment_methods(name), sales!inner(status, created_at)")
          .eq("sales.status", "completed")
          .gte("sales.created_at", startDate)
          .lte("sales.created_at", endDate)
          .range(from, to)
      );

      // Procesar datos del fallback
      const methodMap = new Map();
      fallbackData.forEach(payment => {
        const methodName = one(payment.payment_methods)?.name || "Desconocido";
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
      const fallbackData = await fetchAllRows((from, to) =>
        supabase
          .from("sales")
          .select(`
            total_amount,
            cash_register_sessions(area)
          `)
          .eq("status", "completed")
          .gte("created_at", startDate)
          .lte("created_at", endDate)
          .range(from, to)
      );

      // Procesar datos del fallback
      const areaMap = new Map();
      fallbackData.forEach(sale => {
        const area = one(sale.cash_register_sessions)?.area || "bar";
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

    const salesData = await fetchAllRows((from, to) =>
      supabase
        .from("sales")
        .select("total_amount")
        .eq("status", "completed")
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .range(from, to)
    );

    const expensesData = await fetchAllRows((from, to) =>
      supabase
        .from("expenses")
        .select("amount")
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .range(from, to)
    );

    // Compras del período (insumos/mercadería comprada a proveedores) — también
    // son un costo que debe descontarse del resultado, no solo los gastos de caja.
    const purchasesData = await fetchAllRows((from, to) =>
      supabase
        .from("purchases")
        .select("total_amount")
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .range(from, to)
    );

    // Ventas a Cuenta Corriente del período: NO entraron a la caja todavía (crédito por cobrar).
    // Hay que separarlas del "cobrado" para no inflar la plata disponible.
    const ccData = await fetchAllRows((from, to) =>
      supabase
        .from("sale_payments")
        .select("amount, payment_methods!inner(name), sales!inner(status, created_at)")
        .ilike("payment_methods.name", "%cuenta corriente%")
        .eq("sales.status", "completed")
        .gte("sales.created_at", startDate)
        .lte("sales.created_at", endDate)
        .range(from, to)
    );

    const total_income = salesData.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
    const total_expenses = expensesData.reduce((sum, expense) => sum + (expense.amount || 0), 0);
    const total_purchases = purchasesData.reduce((sum, p) => sum + (p.total_amount || 0), 0);
    const cuenta_corriente = ccData.reduce((sum, p) => sum + (p.amount || 0), 0);
    const total_costs = total_expenses + total_purchases;
    // Devengado: ventas facturadas (incluye crédito). Cobrado: lo que efectivamente entró (sin crédito CC).
    const collected_income = Math.max(0, total_income - cuenta_corriente);
    const net_profit = total_income - total_costs;            // resultado devengado
    const net_cash = collected_income - total_costs;          // resultado de caja (cobrado)
    const profit_margin = total_income > 0 ? (net_profit / total_income) * 100 : 0;

    return {
      success: true,
      data: {
        total_income,
        collected_income,
        cuenta_corriente,
        total_expenses,
        total_purchases,
        total_costs,
        net_profit,
        net_cash,
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

    const data = await fetchAllRows((from, to) =>
      supabase
        .from("sales")
        .select("total_amount, created_at")
        .eq("status", "completed")
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: true })
        .range(from, to)
    );

    const dayMap = new Map();
    data.forEach(sale => {
      try {
        // Agrupar por DÍA DE NEGOCIO en hora Argentina (no por día UTC).
        const date = getBusinessDateString(new Date(sale.created_at));
        if (dayMap.has(date)) {
          const existing = dayMap.get(date);
          existing.sales += sale.total_amount;
          existing.amount += sale.total_amount;
          existing.transactions += 1;
        } else {
          dayMap.set(date, {
            date,
            sales: sale.total_amount,
            amount: sale.total_amount,
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

    const data = await fetchAllRows((from, to) =>
      supabase
        .from("sales")
        .select(`
          total_amount,
          user_id,
          users!sales_user_id_fkey(name)
        `)
        .eq("status", "completed")
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .range(from, to)
    );

    const employeeMap = new Map();
    data.forEach(sale => {
      const userId = sale.user_id;
      if (employeeMap.has(userId)) {
        const existing = employeeMap.get(userId);
        existing.total_sales += sale.total_amount;
        existing.transaction_count += 1;
      } else {
        employeeMap.set(userId, {
          employee_id: userId,
          employee_name: one(sale.users)?.name || "Sin nombre",
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

    const data = await fetchAllRows((from, to) =>
      supabase
        .from("sale_items")
        .select("product_id, quantity, subtotal, products(name, cost_price), sales!inner(status, created_at)")
        .eq("sales.status", "completed")
        .gte("sales.created_at", startDate)
        .lte("sales.created_at", endDate)
        .range(from, to)
    );

    const productMap = new Map();
    data.forEach(item => {
      const key = item.product_id;
      const prod = one(item.products);
      const lineCost = (prod?.cost_price || 0) * item.quantity;
      if (productMap.has(key)) {
        const existing = productMap.get(key);
        existing.units_sold += item.quantity;
        existing.total_revenue += item.subtotal;
        existing.total_cost += lineCost;
      } else {
        productMap.set(key, {
          product_id: item.product_id,
          product_name: prod?.name || "Producto desconocido",
          units_sold: item.quantity,
          total_revenue: item.subtotal,
          total_cost: lineCost
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

    const data = await fetchAllRows((from, to) =>
      supabase
        .from("sales")
        .select("total_amount, created_at")
        .eq("status", "completed")
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .range(from, to)
    );

    const hourMap = new Map();
    data.forEach(sale => {
      // Hora REAL en zona Argentina (no la hora UTC del servidor de Vercel).
      const hour = getArgHour(new Date(sale.created_at));
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

    const data = await fetchAllRows((from, to) =>
      supabase
        .from("sale_items")
        .select("product_id, quantity, subtotal, products(category_id, cost_price, categories(name)), sales!inner(status, created_at)")
        .eq("sales.status", "completed")
        .gte("sales.created_at", startDate)
        .lte("sales.created_at", endDate)
        .range(from, to)
    );

    const categoryMap = new Map();
    const productsByCat = new Map<string, Set<string>>();
    data.forEach(item => {
      const prod = one(item.products);
      const categoryId = prod?.category_id;
      if (!categoryId) return;
      const lineCost = (prod?.cost_price || 0) * item.quantity;
      const set = productsByCat.get(categoryId) || new Set<string>();
      if (item.product_id) set.add(item.product_id);
      productsByCat.set(categoryId, set);
      if (categoryMap.has(categoryId)) {
        const existing = categoryMap.get(categoryId);
        existing.units_sold += item.quantity;
        existing.total_revenue += item.subtotal;
        existing.total_cost += lineCost;
      } else {
        categoryMap.set(categoryId, {
          category_id: categoryId,
          category_name: one(prod?.categories)?.name || "Categoría desconocida",
          units_sold: item.quantity,
          total_revenue: item.subtotal,
          total_cost: lineCost
        });
      }
    });

    const result = Array.from(categoryMap.values()).map(category => {
      const gross_profit = category.total_revenue - category.total_cost;
      return {
        ...category,
        product_count: productsByCat.get(category.category_id)?.size || 0,
        avg_price: category.units_sold > 0 ? category.total_revenue / category.units_sold : 0,
        gross_profit,
        margin_percentage: category.total_revenue > 0 ? (gross_profit / category.total_revenue) * 100 : 0
      };
    });

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
    // El período anterior termina 1ms antes del inicio del actual (sin solapar el límite).
    const previousEnd = new Date(start.getTime() - 1);

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

// ============================================
// REPORTES NUEVOS (Ola 2)
// ============================================

// Cuánto te deben hoy (cuenta corriente) + ranking de deudores. Es estado ACTUAL, no del período.
export async function getAccountsReceivable() {
  try {
    const supabase = await createClient();
    const access = await ensureReportsAccess(supabase);
    if (!access.ok) {
      return { success: false, message: access.message, data: null };
    }

    const customers = await fetchAllRows((from, to) =>
      supabase
        .from("customers")
        .select("id, name, current_balance, credit_limit")
        .gt("current_balance", 0)
        .order("current_balance", { ascending: false })
        .range(from, to)
    );

    const total_debt = customers.reduce((sum, c) => sum + (Number(c.current_balance) || 0), 0);

    return {
      success: true,
      data: {
        total_debt,
        debtor_count: customers.length,
        debtors: customers.map((c) => ({
          id: c.id,
          name: c.name,
          balance: Number(c.current_balance) || 0,
          credit_limit: Number(c.credit_limit) || 0,
        })),
      },
    };
  } catch (error: any) {
    console.error("Error fetching accounts receivable:", error);
    return { success: false, message: error.message || "Error al obtener cuentas por cobrar", data: null };
  }
}

// Mapa de calor: ventas por día de semana (0=Dom … 6=Sáb) × hora (0-23), en HORA ARGENTINA.
export async function getSalesHeatmap(startDate: string, endDate: string) {
  try {
    const supabase = await createClient();
    const access = await ensureReportsAccess(supabase);
    if (!access.ok) {
      return { success: false, message: access.message, data: [] };
    }

    const data = await fetchAllRows((from, to) =>
      supabase
        .from("sales")
        .select("total_amount, created_at")
        .eq("status", "completed")
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .range(from, to)
    );

    // matriz[weekday][hour] = { total, count }
    const cells = new Map<string, { weekday: number; hour: number; total: number; count: number }>();
    data.forEach((sale) => {
      const d = new Date(sale.created_at);
      const weekday = getArgWeekday(d);
      const hour = getArgHour(d);
      const key = `${weekday}-${hour}`;
      const cur = cells.get(key) || { weekday, hour, total: 0, count: 0 };
      cur.total += sale.total_amount || 0;
      cur.count += 1;
      cells.set(key, cur);
    });

    return { success: true, data: Array.from(cells.values()) };
  } catch (error: any) {
    console.error("Error fetching sales heatmap:", error);
    return { success: false, message: error.message || "Error al obtener mapa de calor", data: [] };
  }
}

// Ventas por tipo de operación: mesa / mostrador / delivery.
export async function getSalesByType(startDate: string, endDate: string) {
  try {
    const supabase = await createClient();
    const access = await ensureReportsAccess(supabase);
    if (!access.ok) {
      return { success: false, message: access.message, data: [] };
    }

    const data = await fetchAllRows((from, to) =>
      supabase
        .from("sales")
        .select("total_amount, sale_type")
        .eq("status", "completed")
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .range(from, to)
    );

    const labels: Record<string, string> = {
      table: "Mesa",
      counter: "Mostrador",
      delivery: "Delivery",
    };

    const typeMap = new Map<string, { type: string; label: string; total_sales: number; transaction_count: number }>();
    data.forEach((sale) => {
      const type = sale.sale_type || "table";
      const cur = typeMap.get(type) || { type, label: labels[type] || type, total_sales: 0, transaction_count: 0 };
      cur.total_sales += sale.total_amount || 0;
      cur.transaction_count += 1;
      typeMap.set(type, cur);
    });

    const result = Array.from(typeMap.values())
      .map((t) => ({ ...t, avg_ticket: t.transaction_count > 0 ? t.total_sales / t.transaction_count : 0 }))
      .sort((a, b) => b.total_sales - a.total_sales);

    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error fetching sales by type:", error);
    return { success: false, message: error.message || "Error al obtener ventas por tipo", data: [] };
  }
}