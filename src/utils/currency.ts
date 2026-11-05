/**
 * RNF08 / RF26 — Cálculos monetários com precisão decimal estrita (em centavos inteiros)
 * e formatação no padrão brasileiro (R$ 0,00) aceitando vírgula decimal.
 */

export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return Number((Math.round(cents) / 100).toFixed(2));
}

export function roundMoney(amount: number): number {
  return fromCents(toCents(amount));
}

export function addMoney(a: number, b: number): number {
  return fromCents(toCents(a) + toCents(b));
}

export function multiplyMoney(unitPrice: number, quantity: number): number {
  return fromCents(toCents(unitPrice) * quantity);
}

/**
 * RN01 — Comissão padrão de 10% (ou percentual configurado) sobre o subtotal dos produtos,
 * nunca incluindo a taxa de entrega.
 */
export function calculateCommission(productsSubtotal: number, commissionPercent: number): number {
  const subtotalCents = toCents(productsSubtotal);
  const commissionCents = Math.round((subtotalCents * commissionPercent) / 100);
  return fromCents(commissionCents);
}

export function formatBRL(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDecimalInput(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toFixed(2).replace('.', ',');
}

/**
 * RF26 / RNF08 — Converte string digitada com vírgula ("R$ 12,50" ou "12,50" ou "12.5")
 * para número decimal com 2 casas sem erro de ponto flutuante.
 */
export function parseBRLString(raw: string): number {
  if (!raw || typeof raw !== 'string') return 0;
  const cleaned = raw.replace(/[R$\s]/g, '').trim();
  if (!cleaned) return 0;

  let normalized = cleaned;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // Ex: "1.250,50" -> "1250.50"
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    // Ex: "12,50" -> "12.50"
    normalized = cleaned.replace(',', '.');
  }

  const parsed = Number(normalized);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return roundMoney(parsed);
}

/**
 * Formata digitação progressiva em máscara de moeda brasileira ("1250" -> "12,50")
 */
export function maskCurrencyInput(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';
  const cents = parseInt(digits, 10);
  if (Number.isNaN(cents)) return '';
  const decimal = (cents / 100).toFixed(2);
  const [intPart, decPart] = decimal.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formattedInt},${decPart}`;
}

/**
 * Calcula automaticamente o preço promocional a partir do preço original e percentual de desconto
 */
export function calculatePromotionalPrice(
  originalPrice: number,
  discountPercent: number
): number {
  if (!Number.isFinite(originalPrice) || originalPrice <= 0) return 0;
  const clampedDiscount = Math.min(99, Math.max(0, Number.isFinite(discountPercent) ? discountPercent : 0));
  const originalCents = toCents(originalPrice);
  const discountCents = Math.round((originalCents * clampedDiscount) / 100);
  return fromCents(Math.max(1, originalCents - discountCents));
}

/**
 * Calcula automaticamente o percentual de desconto entre o preço original e o preço promocional
 */
export function calculateDiscountPercent(
  originalPrice: number,
  promotionalPrice: number
): number {
  if (
    !Number.isFinite(originalPrice) ||
    originalPrice <= 0 ||
    !Number.isFinite(promotionalPrice) ||
    promotionalPrice <= 0 ||
    promotionalPrice >= originalPrice
  ) {
    return 0;
  }
  const diff = originalPrice - promotionalPrice;
  return Number(((diff / originalPrice) * 100).toFixed(1));
}
