jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
  unstable_cache: (fn: unknown) => fn,
}));

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

jest.mock("@/lib/utils", () => ({
  getCurrentDate: jest.fn(),
}));

jest.mock("@/actions/permissionActions", () => ({
  checkUserPermission: jest.fn(),
}));

jest.mock("@/lib/cache", () => ({
  invalidateCashSessionsCache: jest.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentDate } from "@/lib/utils";
import { checkUserPermission } from "@/actions/permissionActions";
import { invalidateCashSessionsCache } from "@/lib/cache";
import { openCashRegister, closeCashRegister } from "@/actions/cashActions";

const mockCreateClient = createClient as unknown as jest.Mock;
const mockRevalidatePath = revalidatePath as unknown as jest.Mock;
const mockGetCurrentDate = getCurrentDate as unknown as jest.Mock;
const mockCheckUserPermission = checkUserPermission as unknown as jest.Mock;
const mockInvalidateCashSessionsCache = invalidateCashSessionsCache as unknown as jest.Mock;

const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(),
};

function createQueryStub() {
  const stub: any = {
    select: jest.fn(() => stub),
    eq: jest.fn(() => stub),
    is: jest.fn(() => stub),
    in: jest.fn(() => stub),
    not: jest.fn(() => stub),
    order: jest.fn(() => Promise.resolve({ data: [], error: null })),
    maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
    single: jest.fn(() => Promise.resolve({ data: null, error: null })),
    insert: jest.fn(() => stub),
    update: jest.fn(() => stub),
  };

  return stub;
}

describe("cashActions integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateClient.mockResolvedValue(mockSupabaseClient);
    mockGetCurrentDate.mockReturnValue(new Date("2024-01-15T10:00:00Z"));
    mockCheckUserPermission.mockResolvedValue({
      success: true,
      hasPermission: true,
    });
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "admin@almendra.com" } },
      error: null,
    });
    mockSupabaseClient.from.mockImplementation(() => createQueryStub());
  });

  it("denies opening cash register when user is not authenticated", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await openCashRegister({
      opening_amount: 1000,
      shift: "morning",
      area: "bar",
      opening_notes: "Inicio",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("No autenticado");
  });

  it("denies opening cash register when user lacks permission", async () => {
    mockCheckUserPermission.mockResolvedValue({
      success: true,
      hasPermission: false,
    });

    const result = await openCashRegister({
      opening_amount: 1000,
      shift: "morning",
      area: "bar",
      opening_notes: "Inicio",
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe("No tienes permisos para abrir caja.");
  });

  it("opens cash register successfully when auth and permissions are valid", async () => {
    const existingSessionQuery = createQueryStub();
    existingSessionQuery.maybeSingle.mockResolvedValue({ data: null, error: null });

    const cashRegisterQuery = createQueryStub();
    cashRegisterQuery.maybeSingle.mockResolvedValue({
      data: { id: "cash-bar-123", type: "bar" },
      error: null,
    });

    const createSessionQuery = {
      insert: jest.fn(() => ({
        select: jest.fn().mockResolvedValue({
          data: [{ id: "session-123", area: "bar" }],
          error: null,
        }),
      })),
    };

    const workShiftQuery = {
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
    };

    mockSupabaseClient.from
      .mockReturnValueOnce(existingSessionQuery)
      .mockReturnValueOnce(cashRegisterQuery)
      .mockReturnValueOnce(createSessionQuery)
      .mockReturnValueOnce(workShiftQuery);

    const result = await openCashRegister({
      cash_register_id: "8b54df7d-b559-40d7-9f95-df7568f31e4b",
      opening_amount: 1200,
      shift: "night",
      area: "bar",
      opening_notes: "Turno noche",
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual([{ id: "session-123", area: "bar" }]);
    expect(createSessionQuery.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        shift: "night",
      }),
    ]);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/caja-bar");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(mockInvalidateCashSessionsCache).toHaveBeenCalledTimes(1);
  });

  it("denies closing cash register when user lacks close permission", async () => {
    mockCheckUserPermission.mockResolvedValue({
      success: true,
      hasPermission: false,
    });

    const result = await closeCashRegister({
      session_id: "a7bdb2c9-3d2f-4f9a-8f4c-80f72f1532f2",
      closing_amount: 3000,
      closing_notes: "Cierre",
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe("No tienes permisos para cerrar caja");
  });
});
