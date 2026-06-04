import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ExportButtons } from "@/components/shared/ExportButtons";

jest.mock("@/store/notificationStore", () => ({
  useNotificationStore: jest.fn(() => ({
    addNotification: jest.fn(),
  })),
}));

jest.mock("@/lib/exportUtils", () => ({
  exportToExcel: jest.fn(),
  exportToPDF: jest.fn(),
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, variant, className, disabled, ...props }: any) => (
    <button onClick={onClick} data-variant={variant} className={className} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

jest.mock("lucide-react", () => ({
  FileSpreadsheet: () => <span data-testid="excel-icon">excel</span>,
  FileText: () => <span data-testid="pdf-icon">pdf</span>,
  Download: () => <span data-testid="download-icon">download</span>,
  Loader2: () => <span data-testid="loader-icon">loading</span>,
}));

describe("ExportButtons Component", () => {
  const mockData = {
    stats: {
      total_sales: "1500.50",
      total_transactions: 25,
      average_ticket: "60.02",
    },
    topProducts: [
      {
        product_name: "Producto A",
        total_quantity: 10,
        total_revenue: "300.00",
      },
    ],
  };

  const mockFilename = "reporte-ventas";
  const mockAddNotification = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    const mockUseNotificationStore = require("@/store/notificationStore").useNotificationStore;
    mockUseNotificationStore.mockImplementation((selector: any) =>
      selector({
        addNotification: mockAddNotification,
      })
    );

    require("@/lib/exportUtils").exportToExcel.mockResolvedValue({ success: true });
    require("@/lib/exportUtils").exportToPDF.mockResolvedValue({ success: true });
  });

  it("renders both export buttons", () => {
    render(<ExportButtons data={mockData} filename={mockFilename} />);

    expect(screen.getByText("Excel Completo")).toBeInTheDocument();
    expect(screen.getByText("PDF Profesional")).toBeInTheDocument();
    expect(screen.getByTestId("excel-icon")).toBeInTheDocument();
    expect(screen.getByTestId("pdf-icon")).toBeInTheDocument();
  });

  it("renders buttons with correct styling", () => {
    render(<ExportButtons data={mockData} filename={mockFilename} />);

    const excelButton = screen.getByText("Excel Completo");
    const pdfButton = screen.getByText("PDF Profesional");

    expect(excelButton).toHaveAttribute("data-variant", "outline");
    expect(pdfButton).toHaveAttribute("data-variant", "outline");
    expect(excelButton).toHaveClass("gap-2");
    expect(pdfButton).toHaveClass("gap-2");
  });

  it("handles Excel export successfully", async () => {
    const mockExportToExcel = require("@/lib/exportUtils").exportToExcel;

    render(<ExportButtons data={mockData} filename={mockFilename} />);

    fireEvent.click(screen.getByText("Excel Completo"));

    await waitFor(() => {
      expect(mockExportToExcel).toHaveBeenCalledWith(mockData, mockFilename);
      expect(mockAddNotification).toHaveBeenCalledWith("success", "Reporte exportado a Excel exitosamente");
    });
  });

  it("handles PDF export successfully", async () => {
    const mockExportToPDF = require("@/lib/exportUtils").exportToPDF;

    render(<ExportButtons data={mockData} filename={mockFilename} />);

    fireEvent.click(screen.getByText("PDF Profesional"));

    await waitFor(() => {
      expect(mockExportToPDF).toHaveBeenCalledWith(mockData, mockFilename);
      expect(mockAddNotification).toHaveBeenCalledWith("success", "Reporte exportado a PDF exitosamente");
    });
  });

  it("handles Excel export failure", async () => {
    const mockExportToExcel = require("@/lib/exportUtils").exportToExcel;
    mockExportToExcel.mockResolvedValue({ success: false });

    render(<ExportButtons data={mockData} filename={mockFilename} />);

    fireEvent.click(screen.getByText("Excel Completo"));

    await waitFor(() => {
      expect(mockAddNotification).toHaveBeenCalledWith("error", "Error al exportar a Excel");
    });
  });

  it("handles PDF export failure", async () => {
    const mockExportToPDF = require("@/lib/exportUtils").exportToPDF;
    mockExportToPDF.mockResolvedValue({ success: false });

    render(<ExportButtons data={mockData} filename={mockFilename} />);

    fireEvent.click(screen.getByText("PDF Profesional"));

    await waitFor(() => {
      expect(mockAddNotification).toHaveBeenCalledWith("error", "Error al exportar a PDF");
    });
  });

  it("handles Excel export exceptions", async () => {
    const mockExportToExcel = require("@/lib/exportUtils").exportToExcel;
    mockExportToExcel.mockRejectedValue(new Error("Export failed"));

    render(<ExportButtons data={mockData} filename={mockFilename} />);

    fireEvent.click(screen.getByText("Excel Completo"));

    await waitFor(() => {
      expect(mockAddNotification).toHaveBeenCalledWith("error", "Error al exportar a Excel");
    });
  });

  it("handles PDF export exceptions", async () => {
    const mockExportToPDF = require("@/lib/exportUtils").exportToPDF;
    mockExportToPDF.mockRejectedValue(new Error("Export failed"));

    render(<ExportButtons data={mockData} filename={mockFilename} />);

    fireEvent.click(screen.getByText("PDF Profesional"));

    await waitFor(() => {
      expect(mockAddNotification).toHaveBeenCalledWith("error", "Error al exportar a PDF");
    });
  });

  it("passes through arbitrary payloads", async () => {
    const emptyData = {};
    const mockExportToExcel = require("@/lib/exportUtils").exportToExcel;

    render(<ExportButtons data={emptyData} filename={mockFilename} />);

    fireEvent.click(screen.getByText("Excel Completo"));

    await waitFor(() => {
      expect(mockExportToExcel).toHaveBeenCalledWith(emptyData, mockFilename);
    });
  });

  it("renders in flex container with gap", () => {
    render(<ExportButtons data={mockData} filename={mockFilename} />);

    const container = screen.getByText("Excel Completo").closest("div");
    expect(container).toHaveClass("flex", "gap-2");
  });

  it("passes filename to export functions", async () => {
    const customFilename = "custom-report-name";
    const mockExportToExcel = require("@/lib/exportUtils").exportToExcel;
    const mockExportToPDF = require("@/lib/exportUtils").exportToPDF;

    render(<ExportButtons data={mockData} filename={customFilename} />);

    fireEvent.click(screen.getByText("Excel Completo"));

    await waitFor(() => {
      expect(mockExportToExcel).toHaveBeenCalledWith(mockData, customFilename);
    });

    fireEvent.click(screen.getByText("PDF Profesional"));

    await waitFor(() => {
      expect(mockExportToPDF).toHaveBeenCalledWith(mockData, customFilename);
    });
  });
});
