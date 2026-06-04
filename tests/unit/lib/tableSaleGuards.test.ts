import {
  getMissingSalePayments,
  normalizeItemsWithProductCatalog,
} from "@/lib/tableSaleGuards";

describe("tableSaleGuards", () => {
  describe("normalizeItemsWithProductCatalog", () => {
    it("replaces client prices with catalog prices and computes totals", () => {
      const result = normalizeItemsWithProductCatalog(
        [
          {
            product_id: "prod-1",
            quantity: 2,
            unit_price: 999,
            customization: "Sin hielo",
          },
        ],
        [
          {
            id: "prod-1",
            name: "Fernet",
            sale_price: 4500,
            stock: 8,
            unlimited_stock: false,
            is_active: true,
          },
        ]
      );

      expect(result.normalizedItems).toEqual([
        {
          product_id: "prod-1",
          quantity: 2,
          unit_price: 4500,
          subtotal: 9000,
          customization: "Sin hielo",
        },
      ]);
      expect(result.total).toBe(9000);
    });

    it("throws when stock is insufficient", () => {
      expect(() =>
        normalizeItemsWithProductCatalog(
          [
            {
              product_id: "prod-1",
              quantity: 3,
              unit_price: 1000,
            },
          ],
          [
            {
              id: "prod-1",
              name: "Papas",
              sale_price: 1000,
              stock: 1,
              unlimited_stock: false,
              is_active: true,
            },
          ]
        )
      ).toThrow('Stock insuficiente para "Papas"');
    });
  });

  describe("getMissingSalePayments", () => {
    it("returns only payments that are not already mirrored in sale_payments", () => {
      const missing = getMissingSalePayments(
        [
          { payment_method_id: "cash", amount: 1000 },
          { payment_method_id: "cash", amount: 1000 },
          { payment_method_id: "card", amount: 2500 },
        ],
        [
          { payment_method_id: "cash", amount: 1000 },
          { payment_method_id: "card", amount: 2500 },
        ]
      );

      expect(missing).toEqual([{ payment_method_id: "cash", amount: 1000 }]);
    });
  });
});
