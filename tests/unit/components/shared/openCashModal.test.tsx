import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { OpenCashModal } from "@/components/shared/OpenCashModal";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    refresh: jest.fn(),
  })),
}));

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: jest.fn(() => ({
    invalidateQueries: jest.fn(),
  })),
}));

jest.mock("@/store/notificationStore", () => ({
  useNotificationStore: jest.fn((selector: any) =>
    selector({
      addNotification: jest.fn(),
    })
  ),
}));

jest.mock("@/actions/cashActions", () => ({
  openCashRegister: jest.fn(),
}));

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  DialogFooter: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  DialogHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  DialogTitle: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

jest.mock("@/components/ui/input", () => ({
  Input: ({ ...props }: any) => <input {...props} />,
}));

jest.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor, ...props }: any) => (
    <label htmlFor={htmlFor} {...props}>
      {children}
    </label>
  ),
}));

jest.mock("lucide-react", () => ({
  Loader2: () => <span data-testid="loader" />,
  LogIn: () => <span data-testid="login-icon" />,
  Wallet: () => <span data-testid="wallet-icon" />,
}));

describe("OpenCashModal", () => {
  const mockOnClose = jest.fn();
  const mockOpenCashRegister = require("@/actions/cashActions").openCashRegister as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenCashRegister.mockResolvedValue({
      success: true,
      data: [{ id: "session-1" }],
    });
  });

  it("does not ask the user for shift selection and communicates night-only flow", () => {
    render(
      <OpenCashModal
        open={true}
        onClose={mockOnClose}
        cashRegisterId="8b54df7d-b559-40d7-9f95-df7568f31e4b"
      />
    );

    expect(screen.queryByLabelText(/turno/i)).not.toBeInTheDocument();
    expect(screen.getByText(/turno noche/i)).toBeInTheDocument();
  });

  it("submits the opening using the fixed night shift", async () => {
    const user = userEvent.setup();

    render(
      <OpenCashModal
        open={true}
        onClose={mockOnClose}
        cashRegisterId="8b54df7d-b559-40d7-9f95-df7568f31e4b"
      />
    );

    await user.type(screen.getByLabelText(/monto inicial/i), "1500");
    await user.type(screen.getByLabelText(/notas/i), "Apertura");
    await user.click(screen.getByRole("button", { name: /abrir caja/i }));

    await waitFor(() => {
      expect(mockOpenCashRegister).toHaveBeenCalledWith({
        cash_register_id: "8b54df7d-b559-40d7-9f95-df7568f31e4b",
        opening_amount: 1500,
        area: "bar",
        opening_notes: "Apertura",
        shift: "night",
      });
    });
  });
});

