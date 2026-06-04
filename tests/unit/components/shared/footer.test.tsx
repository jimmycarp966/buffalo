import { render, screen } from "@testing-library/react";
import { Footer } from "@/components/shared/Footer";
import { brand } from "@/lib/brand";

describe("Footer Component", () => {
  beforeEach(() => {
    jest.spyOn(Date.prototype, "getFullYear").mockReturnValue(2024);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders semantic footer with expected container styles", () => {
    render(<Footer />);

    const footer = screen.getByRole("contentinfo");
    expect(footer.tagName).toBe("FOOTER");
    expect(footer).toHaveClass("border-t", "border-primary/15", "py-6", "mt-auto");
  });

  it("shows brand text with current year", () => {
    render(<Footer />);

    expect(screen.getByText(`(c) 2024 ${brand.name} ${brand.descriptor}. Todos los derechos reservados.`)).toBeInTheDocument();
  });

  it("shows designer information", () => {
    render(<Footer />);

    const designer = screen.getByText(brand.designer);
    expect(designer).toBeInTheDocument();
    expect(designer).toHaveClass("font-semibold", "text-secondary");
  });

  it("uses centered stacked layout", () => {
    render(<Footer />);

    const layout = screen.getByText(`(c) 2024 ${brand.name} ${brand.descriptor}. Todos los derechos reservados.`).closest("div");
    expect(layout).toHaveClass("flex", "flex-col", "items-center", "justify-center", "gap-2", "text-center");
  });

  it("shows the designer credit label", () => {
    render(<Footer />);

    expect(screen.getByText("Disenado por")).toBeInTheDocument();
  });

  it("updates year dynamically", () => {
    jest.restoreAllMocks();
    jest.spyOn(Date.prototype, "getFullYear").mockReturnValue(2025);

    render(<Footer />);

    expect(screen.getByText(`(c) 2025 ${brand.name} ${brand.descriptor}. Todos los derechos reservados.`)).toBeInTheDocument();
  });

  it("remains stable across rerenders", () => {
    const { rerender } = render(<Footer />);
    rerender(<Footer />);

    const footers = screen.getAllByRole("contentinfo");
    expect(footers).toHaveLength(1);
  });
});
