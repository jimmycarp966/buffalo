import { z } from "zod";

// Validaciones de Autenticación
export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

// Validaciones de Productos
export const productSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  description: z.string().optional(),
  category_id: z.string().uuid("Categoría inválida").optional().nullable(),
  cost_price: z.number().min(0, "El costo debe ser mayor a 0"),
  sale_price: z.number().min(0, "El precio de venta debe ser mayor a 0"),
  profit_margin: z.number().min(0, "El margen no puede ser negativo").optional(),
  use_auto_price: z.boolean().default(false),
  stock: z.number().int().min(0, "El stock no puede ser negativo"),
  min_stock: z.number().int().min(0, "El stock mínimo no puede ser negativo"),
  supplier_id: z.string().uuid().optional(),
  unlimited_stock: z.boolean().default(false),
  cocina_only: z.preprocess((value) => value ?? false, z.boolean()).default(false),
  image_url: z.string().url("URL de imagen inválida").optional().or(z.literal("")).nullable(),
});

// Validaciones de Ventas
export const saleSchema = z.object({
  cash_register_id: z.string().uuid("Caja inválida"),
  area: z.enum(["bar"]).optional(), // Área de la caja (bar)
  sale_type: z.enum(["table", "counter", "delivery"]).default("table"),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.number().int().min(1),
        unit_price: z.number().min(0),
        customization: z.string().optional(), // ✅ Personalización del producto
      })
    )
    .min(1, "Debe agregar al menos un producto"),
  payments: z
    .array(
      z.object({
        payment_method_id: z.string().uuid(),
        amount: z.number().min(0),
      })
    )
    .default([]),
  table_number: z.number().int().min(1).max(100).optional(),
  status: z.enum(["completed", "pending"]).default("completed"),
  // Campos opcionales para delivery
  customer_name: z.string().min(1, "El nombre del cliente es requerido").optional(),
  customer_phone: z.string().min(1, "El teléfono del cliente es requerido").optional(),
  delivery_address: z.string().min(1, "La dirección de entrega es requerida").optional(),
  delivery_notes: z.string().optional(),
}).refine((data) => {
  // Solo validar pagos si la venta es completada
  if (data.status === "completed") {
    return data.payments.length > 0;
  }
  return true;
}, {
  message: "Debe agregar al menos un método de pago",
  path: ["payments"],
}).refine((data) => {
  // Validar que table tenga table_number
  if (data.sale_type === "table") {
    return data.table_number !== undefined;
  }
  return true;
}, {
  message: "El número de mesa es requerido para ventas de mesa",
  path: ["table_number"],
}).refine((data) => {
  // Validar que counter no tenga table_number
  if (data.sale_type === "counter") {
    return data.table_number === undefined;
  }
  return true;
}, {
  message: "Las ventas de mostrador no deben tener número de mesa",
  path: ["table_number"],
});

// Schema base para ventas (sin refines) - usado para crear otros schemas
const baseSaleSchema = z.object({
  cash_register_id: z.string().uuid("Caja inválida"),
  area: z.enum(["bar"]).optional(),
  sale_type: z.enum(["table", "counter", "delivery"]).default("table"),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.number().int().min(1),
        unit_price: z.number().min(0),
        customization: z.string().optional(),
      })
    )
    .min(1, "Debe agregar al menos un producto"),
  payments: z
    .array(
      z.object({
        payment_method_id: z.string().uuid(),
        amount: z.number().min(0),
      })
    )
    .default([]),
  table_number: z.number().int().min(1).max(100).optional(),
  status: z.enum(["completed", "pending"]).default("completed"),
  customer_name: z.string().min(1, "El nombre del cliente es requerido").optional(),
  customer_phone: z.string().min(1, "El teléfono del cliente es requerido").optional(),
  delivery_address: z.string().min(1, "La dirección de entrega es requerida").optional(),
  delivery_notes: z.string().optional(),
});

// Schema específico para ventas de delivery
export const deliverySaleSchema = baseSaleSchema.extend({
  sale_type: z.literal("delivery"),
  status: z.literal("pending"),
  customer_name: z.string().min(1, "El nombre del cliente es requerido").optional(),
  customer_phone: z.string().min(1, "El teléfono del cliente es requerido").optional(),
  delivery_address: z.string().min(1, "La dirección de entrega es requerida").optional(),
  delivery_notes: z.string().optional(),
}).omit({ table_number: true }).refine((data) => {
  return data.payments.length === 0; // Delivery no debe tener pagos al crear
}, {
  message: "Las ventas de delivery no deben tener pagos al crear",
  path: ["payments"],
});

// Validaciones de Compras a Proveedores
export const purchaseSchema = z.object({
  supplier_id: z.string().uuid("Proveedor inválido"),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid().optional().nullable(),
        ingredient_id: z.string().uuid().optional().nullable(),
        description: z.string().optional().nullable(),
        quantity: z.number().min(0.01),
        unit_cost: z.number().min(0),
      })
    )
    .min(1, "Debe agregar al menos un ítem"),
  payment_status: z.enum(["paid", "pending"]).optional().default("pending"),
  payment_method_id: z.string().uuid().optional().nullable(),
});

export type PurchaseInput = z.infer<typeof purchaseSchema>;

// Validaciones de Caja
export const openCashRegisterSchema = z.object({
  cash_register_id: z.string().uuid("Caja inválida"),
  opening_amount: z.number().min(0, "El monto inicial no puede ser negativo"),
  area: z.enum(["bar"]).optional(),
  opening_notes: z.string().optional(),
  shift: z.enum(["morning", "afternoon", "night"]).optional().default("night"),
});

export const closeCashRegisterSchema = z.object({
  session_id: z.string().uuid("Sesión inválida"),
  closing_amount: z.number().min(0, "El monto final no puede ser negativo"),
  closing_notes: z.string().optional(),
});

// Tipos y datos de empleados
export interface Employee {
  id: string;
  name: string;
  role: 'mozo' | 'cantinero' | 'cajero';
}

export const EMPLOYEES: Employee[] = [
  // Mozos
  { id: 'alexis', name: 'Alexis', role: 'mozo' },
  { id: 'silvana', name: 'Silvana', role: 'mozo' },
  { id: 'sol', name: 'Sol', role: 'mozo' },
  { id: 'angela', name: 'Ángela', role: 'mozo' },
  { id: 'belen', name: 'Belen', role: 'mozo' },
  { id: 'alejandra', name: 'Alejandro', role: 'mozo' },
  // Cantineros
  { id: 'jesus', name: 'Jesús', role: 'cantinero' },
  { id: 'santiago', name: 'Santiago', role: 'cantinero' },
  { id: 'facundo', name: 'Facundo', role: 'cantinero' },
  { id: 'veronica', name: 'Verónica', role: 'cantinero' },
  { id: 'jorge', name: 'Jorge', role: 'cantinero' },
  // Cajeros
  { id: 'joaquin', name: 'Joaquín', role: 'cajero' },
  { id: 'olga', name: 'Olga', role: 'cajero' },
  { id: 'viviana', name: 'Viviana', role: 'cajero' },
  { id: 'brisa', name: 'Brisa', role: 'cajero' },
  { id: 'alejandro', name: 'Alejandro', role: 'cajero' },
];

export const EMPLOYEES_BY_ROLE = {
  mozo: EMPLOYEES.filter(emp => emp.role === 'mozo'),
  cantinero: EMPLOYEES.filter(emp => emp.role === 'cantinero'),
  cajero: EMPLOYEES.filter(emp => emp.role === 'cajero'),
};

// Validaciones de Gastos
export const expenseSchema = z.object({
  description: z.string().min(1, "La descripción es requerida"),
  amount: z.number().min(0, "El monto debe ser mayor a 0"),
  category: z.enum(["services", "supplies", "maintenance", "other"], {
    errorMap: () => ({ message: "Categoría de gasto inválida" }),
  }),
  cash_register_session_id: z.string().uuid("Sesión de caja inválida"),
});

// Validaciones de Ingresos
export const incomeSchema = z.object({
  description: z.string().min(5, "La descripción debe tener al menos 5 caracteres"),
  amount: z.number().min(0.01, "El monto debe ser mayor a 0"),
  cash_register_session_id: z.string().uuid("Sesión de caja inválida"),
});

// Validaciones de Usuario
export const userSchema = z.object({
  email: z.string().email("Email inválido"),
  name: z.string().min(1, "El nombre es requerido"),
  role: z.enum(["admin", "supervisor", "cashier", "waiter", "kitchen"]),
  is_active: z.boolean().default(true),
  dni: z.string().optional().nullable(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type SaleInput = z.infer<typeof saleSchema>;
export type DeliverySaleInput = z.infer<typeof deliverySaleSchema>;
export type OpenCashRegisterInput = z.infer<typeof openCashRegisterSchema>;
export type CloseCashRegisterInput = z.infer<typeof closeCashRegisterSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type IncomeInput = z.infer<typeof incomeSchema>;
export type UserInput = z.infer<typeof userSchema>;

// Validaciones de Store Settings (Configuración de Tienda)
export const storeSettingsSchema = z.object({
  store_name: z.string().min(1, "El nombre de la tienda es requerido").optional(),
  estimated_delivery_time: z.number().min(0).optional(),
  is_open: z.boolean().optional(),
  daily_menu_content: z.string().optional().nullable(),
  daily_menu_active: z.boolean().optional(),
});

export type StoreSettingsInput = z.infer<typeof storeSettingsSchema>;

// Validaciones de Facturas
export const invoiceCustomerSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").optional(),
  cuit: z.string().optional(),
  dni: z.string().optional(),
  address: z.string().optional(),
});

export const arcaConfigSchema = z.object({
  arca_cuit: z.string().min(11, "CUIT inválido"),
  arca_point_of_sale: z.number().int().min(1, "Punto de venta inválido"),
  arca_api_key: z.string().min(1, "API Key requerida"),
  arca_service: z.enum(["tusfacturasapp", "facturear", "afipsdk"]).default("tusfacturasapp"),
  arca_environment: z.enum(["testing", "production"]).default("testing"),
});

export type InvoiceCustomerInput = z.infer<typeof invoiceCustomerSchema>;
export type ArcaConfigInput = z.infer<typeof arcaConfigSchema>;

