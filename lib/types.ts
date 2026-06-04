/**
 * Tipos compartidos para el sistema de ventas del POS
 * Este archivo centraliza los tipos para evitar el uso de `any`
 */

// =============================================================================
// Tipos de Supabase Client
// =============================================================================
import type { SupabaseClient } from "@supabase/supabase-js";
export type SupabaseClientType = SupabaseClient;

// =============================================================================
// Tipos de Error
// =============================================================================
/**
 * Tipo para errores capturados en catch blocks
 * Usar en lugar de `catch (error: any)`
 */
export interface AppError {
    message?: string;
    code?: string;
    details?: string;
}

/**
 * Helper para extraer mensaje de error de cualquier tipo de error
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === "string") {
        return error;
    }
    if (error && typeof error === "object" && "message" in error) {
        return String((error as AppError).message);
    }
    return "Error desconocido";
}

// =============================================================================
// Tipos de Items de Venta
// =============================================================================
export interface SaleItem {
    id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    customization?: string | null;
    product?: {
        id: string;
        name: string;
        cocina_only?: boolean | null;
    };
    sale_item_payments?: SaleItemPayment[];
}

export interface SaleItemPayment {
    id: string;
    sale_item_id: string;
    quantity_paid: number;
    amount_paid: number;
    payment_method_id: string;
}

// =============================================================================
// Tipos de Pagos
// =============================================================================
export interface SalePayment {
    id: string;
    sale_id: string;
    amount: number;
    payment_method_id: string;
    payment_method?: {
        id: string;
        name: string;
    };
}

export interface TablePayment {
    id: string;
    sale_id: string;
    amount: number;
    payment_method_id: string;
    payment_method?: {
        id: string;
        name: string;
    };
}

// =============================================================================
// Tipos de Ventas
// =============================================================================
export type SaleStatus = "pending" | "completed" | "cancelled";
export type SaleType = "table" | "counter" | "delivery";

export interface Sale {
    id: string;
    sale_number: string;
    status: SaleStatus;
    sale_type: SaleType;
    total_amount: number;
    table_number?: number | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    delivery_address?: string | null;
    delivery_notes?: string | null;
    created_at: string;
    updated_at?: string | null;
    cash_register_id: string;
    cash_register_session_id?: string | null;
    user_id?: string | null;
    sale_items?: SaleItem[];
    sale_payments?: SalePayment[];
    user?: {
        id: string;
        name: string;
    };
}

// =============================================================================
// Tipos de Mesas
// =============================================================================
export interface OpenTable {
    id: string;
    sale_number: string;
    table_number: number;
    total_amount: number;
    paid_amount?: number;
    remaining_amount?: number;
    created_at: string;
    has_kitchen_products?: boolean;
    sale_items?: SaleItem[];
    sale_payments?: SalePayment[];
    table_payments?: TablePayment[];
    user?: {
        name: string;
    };
}

// =============================================================================
// Tipos de Respuesta de Acciones
// =============================================================================
export interface ActionResult<T = unknown> {
    success: boolean;
    message?: string;
    data?: T;
}

// =============================================================================
// Tipos de Sesión de Caja
// =============================================================================
export interface CashRegisterSession {
    id: string;
    cash_register_id: string;
    opening_amount: number;
    closing_amount?: number | null;
    opened_at: string;
    closed_at?: string | null;
    user_id: string;
    shift?: "morning" | "afternoon" | "night";
    employees?: string[];
}

// =============================================================================
// Tipos para Normalización de Items
// =============================================================================
export interface NormalizedSaleItem {
    id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    customization?: string | null;
    paid_quantity: number;
    pending_quantity: number;
    paid_amount: number;
    pending_amount: number;
    product?: {
        id: string;
        name: string;
        cocina_only?: boolean | null;
    };
}

// =============================================================================
// Tipos para División/Unión de Cuentas
// =============================================================================
export interface SplitAccountItem {
    sale_item_id: string;
    quantity: number;
}

