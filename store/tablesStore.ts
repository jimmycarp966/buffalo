import { create } from 'zustand';

interface LayoutTable {
  table_number: number;
  zone: string;
  position_x: number;
  position_y: number;
  width?: number;
  height?: number;
  shape?: string;
  size_variant?: string;
  area?: "salon" | "vereda";

}

interface PendingSale {
  id: string;
  sale_number: string;
  table_number: number;
  total_amount: number;
  created_at: string;
  user?: {
    name: string;
  } | { name: string }[] | null;
  sale_items: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    product: { name: string } | { name: string }[] | null;
  }>;
}

interface TablesStore {
  pendingTables: PendingSale[];
  layouts: Record<'salon' | 'vereda', LayoutTable[]>;
  isLoading: boolean;
  lastUpdated: Date | null;
  activeTableNumber: number | null;
  isCreatingNewSale: boolean;
  refreshTables: () => Promise<void>;
  addTable: (table: PendingSale) => void;
  removeTable: (tableId: string) => void;
  updateTable: (tableId: string, updates: Partial<PendingSale>) => void;
  setActiveTable: (tableNumber: number | null) => void;
  setIsCreatingNewSale: (isCreating: boolean) => void;
  setLayout: (area: 'salon' | 'vereda', layout: LayoutTable[]) => void;
  getLayoutByArea: (area: 'salon' | 'vereda') => LayoutTable[];
}

export const useTablesStore = create<TablesStore>((set, get) => ({
  pendingTables: [],
  layouts: { salon: [], vereda: [] },
  isLoading: false,
  lastUpdated: null,
  activeTableNumber: null,
  isCreatingNewSale: false,

  refreshTables: async () => {
    set({ isLoading: true });
    try {
      // Import dinámico para evitar problemas de circularidad
      const { getOpenTables } = await import('@/actions/barActions');
      const result = await getOpenTables();

      if (result.success) {
        set({
          pendingTables: result.data || [],
          lastUpdated: new Date(),
          isLoading: false
        });
      } else {
        console.error('Error refreshing tables:', result.message);
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Error refreshing tables:', error);
      set({ isLoading: false });
    }
  },

  addTable: (table: PendingSale) => {
    set((state) => ({
      pendingTables: [...state.pendingTables, table],
      lastUpdated: new Date()
    }));
  },

  removeTable: (tableId: string) => {
    set((state) => ({
      pendingTables: state.pendingTables.filter(table => table.id !== tableId),
      lastUpdated: new Date()
    }));
  },

  updateTable: (tableId: string, updates: Partial<PendingSale>) => {
    set((state) => ({
      pendingTables: state.pendingTables.map(table =>
        table.id === tableId ? { ...table, ...updates } : table
      ),
      lastUpdated: new Date()
    }));
  },

  setActiveTable: (tableNumber: number | null) => {
    set({ activeTableNumber: tableNumber });
  },

  setIsCreatingNewSale: (isCreating: boolean) => {
    set({ isCreatingNewSale: isCreating });
  },

  setLayout: (area, layout) => {
    set((state) => ({
      layouts: {
        ...state.layouts,
        [area]: layout,
      },
    }));
  },
  getLayoutByArea: (area) => get().layouts[area] || [],
}));
