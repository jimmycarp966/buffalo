import { buildDefaultSalonLayout } from "@/lib/barLayoutDefaults";

describe("buildDefaultSalonLayout", () => {
  it("returns the full default salon layout with active tables", () => {
    const layout = buildDefaultSalonLayout();

    expect(layout).toHaveLength(37);
    expect(layout.every((table) => table.area === "salon")).toBe(true);
    expect(layout.every((table) => table.is_active)).toBe(true);
  });

  it("includes both principal and exterior zones with stable table numbers", () => {
    const layout = buildDefaultSalonLayout();
    const tableNumbers = layout.map((table) => table.table_number);

    expect(tableNumbers).toEqual(
      expect.arrayContaining([1, 10, 20, 21, 30, 31, 37]),
    );
    expect(layout.some((table) => table.zone === "principal")).toBe(true);
    expect(layout.some((table) => table.zone === "exterior")).toBe(true);
  });

  it("uses pixel coordinates spaced for the canvas instead of collapsed grid indexes", () => {
    const layout = buildDefaultSalonLayout();
    const table1 = layout.find((table) => table.table_number === 1);
    const table2 = layout.find((table) => table.table_number === 2);
    const table6 = layout.find((table) => table.table_number === 6);

    expect(table1?.position_x).toBeGreaterThanOrEqual(40);
    expect(table1?.position_y).toBeGreaterThanOrEqual(40);
    expect((table2?.position_x ?? 0) - (table1?.position_x ?? 0)).toBeGreaterThanOrEqual(80);
    expect((table6?.position_y ?? 0) - (table1?.position_y ?? 0)).toBeGreaterThanOrEqual(80);
  });
});
