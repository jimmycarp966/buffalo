import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductsTable } from "@/components/shared/ProductsTable";

const mockRefresh = jest.fn();
const mockAddNotification = jest.fn();
const mockConfirm = jest.fn();
const mockUpdateProduct = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

jest.mock("@/actions/productActions", () => ({
  deleteProduct: jest.fn(),
  updateProduct: (...args: unknown[]) => mockUpdateProduct(...args),
}));

jest.mock("@/store/notificationStore", () => ({
  useNotificationStore: (selector: (state: { addNotification: typeof mockAddNotification }) => unknown) =>
    selector({ addNotification: mockAddNotification }),
}));

jest.mock("@/components/providers/ConfirmProvider", () => ({
  useConfirm: () => mockConfirm,
}));

jest.mock("@/store/authStore", () => ({
  useAuthStore: (selector: (state: { user: { role: string } }) => unknown) =>
    selector({ user: { role: "admin" } }),
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

jest.mock("@/components/ui/input", () => ({
  Input: ({ ...props }: any) => <input {...props} />,
}));

jest.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

jest.mock("@/components/shared/ProductModal", () => ({
  ProductModal: () => null,
}));

jest.mock("@/components/shared/PriceHistoryModal", () => ({
  PriceHistoryModal: () => null,
}));

jest.mock("@/components/shared/ImportPDFModal", () => ({
  ImportPDFModal: () => null,
}));

jest.mock("lucide-react", () => ({
  Plus: () => <span>plus</span>,
  Search: () => <span>search</span>,
  Edit: () => <span>edit</span>,
  Package: () => <span>package</span>,
  History: () => <span>history</span>,
  ChevronLeft: () => <span>left</span>,
  ChevronRight: () => <span>right</span>,
  Upload: () => <span>upload</span>,
  Trash2: () => <span>trash</span>,
  ArrowUpDown: () => <span>sort</span>,
  ArrowUp: () => <span>up</span>,
  ArrowDown: () => <span>down</span>,
}));

describe("ProductsTable", () => {
  const product = {
    id: "product-1",
    name: "Coca Cola",
    code: "CC1",
    description: "Gaseosa",
    cost_price: 1000,
    sale_price: 1500,
    profit_margin: 50,
    use_auto_price: false,
    stock: 20,
    min_stock: 5,
    category: { name: "Bebidas" },
    supplier: { name: "Proveedor" },
    is_active: true,
    unlimited_stock: false,
    cocina_only: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateProduct.mockResolvedValue({
      success: true,
      data: {
        ...product,
        sale_price: 1750,
      },
    });
  });

  it("permite editar rapido el precio de venta con doble click y Enter", async () => {
    const user = userEvent.setup();

    render(<ProductsTable products={[product]} />);

    await user.dblClick(screen.getByText("$ 1.500,00"));

    const input = screen.getByDisplayValue("1500");
    await user.clear(input);
    await user.type(input, "1750{enter}");

    await waitFor(() => {
      expect(mockUpdateProduct).toHaveBeenCalledWith("product-1", {
        sale_price: 1750,
      });
    });

    expect(mockAddNotification).toHaveBeenCalledWith("success", "Precio actualizado correctamente");
    expect(mockRefresh).toHaveBeenCalled();
  });
});
