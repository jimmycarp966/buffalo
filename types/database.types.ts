export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = "admin" | "supervisor" | "cashier" | "waiter" | "kitchen";

export type CashRegisterType = "bar";

export type CashRegisterSessionStatus = "open" | "closed";

export type InventoryMovementType = "entry" | "exit" | "adjustment";

export type InventoryInternalMovementType = "entry" | "exit" | "adjustment";

export type InventoryInternalMovementTypeText = "entry" | "exit" | "adjustment";

export type SaleStatus = "completed" | "cancelled" | "pending";

export type ShiftType = "morning" | "afternoon";

export type InvoiceType = "C";

export type InvoiceStatus = "pending" | "approved" | "rejected" | "error";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          role: UserRole;
          is_active: boolean;
          dni: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name: string;
          role?: UserRole;
          is_active?: boolean;
          dni?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          role?: UserRole;
          is_active?: boolean;
          dni?: string | null;
          updated_at?: string;
        };
      };
      cash_registers: {
        Row: {
          id: string;
          name: string;
          type: CashRegisterType;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type: CashRegisterType;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          type?: CashRegisterType;
          is_active?: boolean;
        };
      };
      cash_register_sessions: {
        Row: {
          id: string;
          cash_register_id: string;
          user_id: string;
          opened_by: string;
          closed_by: string | null;
          area: string;
          opening_amount: number;
          closing_amount: number | null;
          expected_amount: number | null;
          difference: number | null;
          status: CashRegisterSessionStatus;
          shift: ShiftType | null;
          opened_at: string;
          closed_at: string | null;
          opening_notes: string | null;
          closing_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cash_register_id: string;
          user_id: string;
          opened_by: string;
          closed_by?: string | null;
          area: string;
          opening_amount?: number;
          closing_amount?: number | null;
          expected_amount?: number | null;
          difference?: number | null;
          status?: CashRegisterSessionStatus;
          shift?: ShiftType | null;
          opened_at?: string;
          closed_at?: string | null;
          opening_notes?: string | null;
          closing_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          area?: string;
          closing_amount?: number | null;
          expected_amount?: number | null;
          difference?: number | null;
          status?: CashRegisterSessionStatus;
          closed_by?: string | null;
          closed_at?: string | null;
          closing_notes?: string | null;
          updated_at?: string;
        };
      };
      products: {
        Row: {
          id: string;
          name: string;
          code: string | null;
          description: string | null;
          category_id: string | null;
          cost_price: number;
          sale_price: number;
          profit_margin: number | null;
          use_auto_price: boolean;
          stock: number;
          min_stock: number;
          supplier_id: string | null;
          is_active: boolean;
          show_in_menu: boolean;
          menu_description: string | null;
          menu_image_url: string | null;
          menu_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code?: string | null;
          description?: string | null;
          category_id?: string | null;
          cost_price: number;
          sale_price: number;
          profit_margin?: number | null;
          use_auto_price?: boolean;
          stock?: number;
          min_stock?: number;
          supplier_id?: string | null;
          is_active?: boolean;
          show_in_menu?: boolean;
          menu_description?: string | null;
          menu_image_url?: string | null;
          menu_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          code?: string | null;
          description?: string | null;
          category_id?: string | null;
          cost_price?: number;
          sale_price?: number;
          profit_margin?: number | null;
          use_auto_price?: boolean;
          stock?: number;
          min_stock?: number;
          supplier_id?: string | null;
          is_active?: boolean;
          show_in_menu?: boolean;
          menu_description?: string | null;
          menu_image_url?: string | null;
          menu_order?: number;
          updated_at?: string;
        };
      };
      inventory_items: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          category: string | null;
          unit: string;
          stock: number;
          min_stock: number;
          supplier_id: string | null;
          location: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          category?: string | null;
          unit?: string;
          stock?: number;
          min_stock?: number;
          supplier_id?: string | null;
          location?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          category?: string | null;
          unit?: string;
          stock?: number;
          min_stock?: number;
          supplier_id?: string | null;
          location?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      inventory_item_movements: {
        Row: {
          id: string;
          inventory_item_id: string;
          movement_type: InventoryInternalMovementTypeText;
          quantity: number;
          reason: string | null;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          inventory_item_id: string;
          movement_type: InventoryInternalMovementTypeText;
          quantity: number;
          reason?: string | null;
          user_id: string;
          created_at?: string;
        };
        Update: {
          inventory_item_id?: string;
          movement_type?: InventoryInternalMovementTypeText;
          quantity?: number;
          reason?: string | null;
          user_id?: string;
        };
      };
      product_inventory_items: {
        Row: {
          id: string;
          product_id: string;
          inventory_item_id: string;
          quantity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          inventory_item_id: string;
          quantity: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          product_id?: string;
          inventory_item_id?: string;
          quantity?: number;
          updated_at?: string;
        };
      };
      sales: {
        Row: {
          id: string;
          sale_number: string;
          cash_register_session_id: string;
          user_id: string;
          waiter_id: string | null;
          total_amount: number;
          status: SaleStatus;
          kitchen_ready: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          sale_number: string;
          cash_register_session_id: string;
          user_id: string;
          waiter_id?: string | null;
          total_amount: number;
          status?: SaleStatus;
          kitchen_ready?: boolean;
          created_at?: string;
        };
        Update: {
          waiter_id?: string | null;
          status?: SaleStatus;
          kitchen_ready?: boolean;
        };
      };
      invoices: {
        Row: {
          id: string;
          sale_id: string;
          invoice_type: InvoiceType;
          invoice_number: string;
          point_of_sale: number;
          cae: string;
          cae_expiration: string;
          thermal_content: string | null;
          status: InvoiceStatus;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sale_id: string;
          invoice_type?: InvoiceType;
          invoice_number: string;
          point_of_sale: number;
          cae: string;
          cae_expiration: string;
          thermal_content?: string | null;
          status?: InvoiceStatus;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          sale_id?: string;
          invoice_type?: InvoiceType;
          invoice_number?: string;
          point_of_sale?: number;
          cae?: string;
          cae_expiration?: string;
          thermal_content?: string | null;
          status?: InvoiceStatus;
          error_message?: string | null;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_sale: {
        Args: {
          p_sale_data: Json;
        };
        Returns: string;
      };
    };
    Enums: {
      user_role: UserRole;
      cash_register_type: CashRegisterType;
      cash_register_session_status: CashRegisterSessionStatus;
      inventory_movement_type: InventoryMovementType;
      sale_status: SaleStatus;
      shift_type: ShiftType;
      invoice_type: InvoiceType;
      invoice_status: InvoiceStatus;
    };
  };
}

