import { normalizeText } from "./utils";

interface SearchableProduct {
  name?: string | null;
  code?: string | null;
}

type WithScore<T> = {
  item: T;
  score: number;
  index: number;
};

const SCORE = {
  EXACT_CODE: 0,
  EXACT_NAME: 1,
  STARTS_CODE: 2,
  STARTS_NAME: 3,
  CONTAINS_CODE: 4,
  CONTAINS_NAME: 5,
  NO_MATCH: 6,
} as const;

function getMatchScore(product: SearchableProduct, normalizedQuery: string): number {
  if (!normalizedQuery) {
    return SCORE.NO_MATCH;
  }

  const normalizedCode = normalizeText(product.code || "");
  const normalizedName = normalizeText(product.name || "");

  if (normalizedCode && normalizedCode === normalizedQuery) {
    return SCORE.EXACT_CODE;
  }

  if (normalizedName && normalizedName === normalizedQuery) {
    return SCORE.EXACT_NAME;
  }

  if (normalizedCode && normalizedCode.startsWith(normalizedQuery)) {
    return SCORE.STARTS_CODE;
  }

  if (normalizedName && normalizedName.startsWith(normalizedQuery)) {
    return SCORE.STARTS_NAME;
  }

  if (normalizedCode && normalizedCode.includes(normalizedQuery)) {
    return SCORE.CONTAINS_CODE;
  }

  if (normalizedName && normalizedName.includes(normalizedQuery)) {
    return SCORE.CONTAINS_NAME;
  }

  return SCORE.NO_MATCH;
}

/**
 * Ordena productos priorizando coincidencias exactas por código, luego nombre,
 * y finalmente coincidencias parciales. Si la query está vacía, devuelve la
 * lista original.
 */
export function sortProductsByQueryMatch<T extends SearchableProduct>(
  products: T[],
  query: string,
): T[] {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return products;
  }

  const scored: WithScore<T>[] = products.map((item, index) => ({
    item,
    score: getMatchScore(item, normalizedQuery),
    index,
  }));

  scored.sort((a, b) => {
    if (a.score === b.score) {
      return a.index - b.index;
    }
    return a.score - b.score;
  });

  return scored.map((entry) => entry.item);
}


