export interface DefaultBarLayoutRow {
  table_number: number;
  zone: "principal" | "exterior";
  area: "salon" | "vereda";
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  shape: "square";
  size_variant: "normal";
  order_index: number;
  is_active: true;
}

const CANVAS_PADDING = 48;
const BASE_TABLE_SIZE = 80;
const TABLE_GAP = 22;
const GRID_SIZE = BASE_TABLE_SIZE + TABLE_GAP;

function toCanvasPosition(col: number, row: number) {
  return {
    x: CANVAS_PADDING + col * GRID_SIZE,
    y: CANVAS_PADDING + row * GRID_SIZE,
  };
}

function isLegacyGridCoordinate(value: number) {
  return value >= 0 && value <= 10;
}

export function needsBarLayoutNormalization(
  layout: Array<{ position_x: number; position_y: number }> | null | undefined,
) {
  if (!layout || layout.length === 0) return false;
  return layout.every(
    (table) =>
      isLegacyGridCoordinate(Number(table.position_x ?? 0)) &&
      isLegacyGridCoordinate(Number(table.position_y ?? 0)),
  );
}

export function buildDefaultSalonLayout(): DefaultBarLayoutRow[] {
  const principalRows = [
    [1, 0, 0], [2, 1, 0], [3, 2, 0], [4, 3, 0], [5, 4, 0],
    [6, 0, 1], [7, 1, 1], [8, 2, 1], [9, 3, 1], [10, 4, 1],
    [11, 0, 2], [12, 1, 2], [13, 2, 2], [14, 3, 2], [15, 4, 2],
    [16, 0, 3], [17, 1, 3], [18, 2, 3], [19, 3, 3], [20, 4, 3],
    [31, 0, 5], [32, 1, 5],
    [33, 0, 6], [34, 1, 6], [35, 2, 6], [36, 3, 6], [37, 4, 6],
  ] as const;

  const exteriorRows = [
    [21, 0, 0], [22, 1, 0], [23, 2, 0], [24, 3, 0], [25, 4, 0],
    [26, 0, 1], [27, 1, 1], [28, 2, 1], [29, 3, 1], [30, 4, 1],
  ] as const;

  const principal = principalRows.map(([table_number, col, row], index) => {
    const position = toCanvasPosition(col, row);
    return {
      table_number,
      zone: "principal" as const,
      area: "salon" as const,
      position_x: position.x,
      position_y: position.y,
      width: 1,
      height: 1,
      shape: "square" as const,
      size_variant: "normal" as const,
      order_index: index + 1,
      is_active: true as const,
    };
  });

  const exterior = exteriorRows.map(([table_number, col, row], index) => {
    const position = toCanvasPosition(col, row);
    return {
      table_number,
      zone: "exterior" as const,
      area: "salon" as const,
      position_x: position.x,
      position_y: position.y,
      width: 1,
      height: 1,
      shape: "square" as const,
      size_variant: "normal" as const,
      order_index: principal.length + index + 1,
      is_active: true as const,
    };
  });

  return [...principal, ...exterior];
}
