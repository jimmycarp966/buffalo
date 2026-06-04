export interface RequestedSaleItemInput {
  product_id: string;
  quantity: number;
  unit_price: number;
  customization?: string;
}

export interface ProductCatalogSnapshot {
  id: string;
  name: string;
  sale_price: number | null;
  stock: number | null;
  unlimited_stock: boolean | null;
  is_active: boolean | null;
}

export interface NormalizedSaleItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  customization?: string;
}

export interface PaymentSnapshot {
  payment_method_id: string;
  amount: number;
}

const roundCurrency = (value: number) => Number(value.toFixed(2));

export function normalizeItemsWithProductCatalog(
  items: RequestedSaleItemInput[],
  products: ProductCatalogSnapshot[]
) {
  const productMap = new Map(products.map((product) => [product.id, product]));

  const normalizedItems = items.map((item) => {
    const product = productMap.get(item.product_id);

    if (!product) {
      throw new Error(`Producto no encontrado (ID: ${item.product_id})`);
    }

    if (!product.is_active) {
      throw new Error(`El producto "${product.name}" ya no está activo`);
    }

    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Cantidad inválida para "${product.name}"`);
    }

    const availableStock = Number(product.stock ?? 0);
    if (!product.unlimited_stock && availableStock < quantity) {
      throw new Error(
        `Stock insuficiente para "${product.name}". Disponible: ${availableStock}, solicitado: ${quantity}`
      );
    }

    const authoritativePrice = Number(product.sale_price ?? item.unit_price ?? 0);
    if (!Number.isFinite(authoritativePrice) || authoritativePrice < 0) {
      throw new Error(`Precio inválido para "${product.name}"`);
    }

    return {
      product_id: item.product_id,
      quantity,
      unit_price: roundCurrency(authoritativePrice),
      subtotal: roundCurrency(authoritativePrice * quantity),
      ...(item.customization ? { customization: item.customization } : {}),
    };
  });

  const total = roundCurrency(
    normalizedItems.reduce((sum, item) => sum + item.subtotal, 0)
  );

  return { normalizedItems, total };
}

export function buildPaymentBucketKey(paymentMethodId: string, amount: number) {
  return `${paymentMethodId}::${roundCurrency(Number(amount))}`;
}

export function getMissingSalePayments(
  sourcePayments: PaymentSnapshot[],
  existingPayments: PaymentSnapshot[]
) {
  const availableBuckets = new Map<string, number>();

  existingPayments.forEach((payment) => {
    const key = buildPaymentBucketKey(payment.payment_method_id, payment.amount);
    availableBuckets.set(key, (availableBuckets.get(key) ?? 0) + 1);
  });

  return sourcePayments.filter((payment) => {
    const key = buildPaymentBucketKey(payment.payment_method_id, payment.amount);
    const currentCount = availableBuckets.get(key) ?? 0;

    if (currentCount > 0) {
      availableBuckets.set(key, currentCount - 1);
      return false;
    }

    return true;
  });
}
