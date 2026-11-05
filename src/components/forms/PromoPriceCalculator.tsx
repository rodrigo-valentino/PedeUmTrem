import React from 'react';
import { Percent, Tag } from 'lucide-react';
import {
  calculateDiscountPercent,
  calculatePromotionalPrice,
  formatBRL,
  formatDecimalInput,
  parseBRLString,
} from '../../utils/currency';
import { CurrencyInput } from './CurrencyInput';

export interface PromoPriceCalculatorProps {
  priceInput: string;
  originalPriceInput: string;
  discountPercentInput: string;
  hasPromo: boolean;
  onTogglePromo: (enabled: boolean) => void;
  onChangePrice: (priceStr: string, originalPriceStr: string, discountStr: string) => void;
}

const QUICK_DISCOUNTS = [5, 10, 15, 20, 25];

/**
 * Calculadora reutilizável de Preço de Venda, Preço Original ("De R$") e Desconto Promocional (%).
 * Mantém o campo final `price` compatível com o banco de dados e com o cálculo de comissões (RN01).
 */
export const PromoPriceCalculator: React.FC<PromoPriceCalculatorProps> = ({
  priceInput,
  originalPriceInput,
  discountPercentInput,
  hasPromo,
  onTogglePromo,
  onChangePrice,
}) => {
  const finalPrice = parseBRLString(priceInput);
  const originalPrice = parseBRLString(originalPriceInput);
  const discountPercent = parseFloat(discountPercentInput) || 0;

  const handleRegularPriceChange = (masked: string) => {
    if (!hasPromo) {
      onChangePrice(masked, masked, '0');
    } else {
      const newFinal = parseBRLString(masked);
      const calcDisc = calculateDiscountPercent(originalPrice, newFinal);
      onChangePrice(masked, originalPriceInput, String(calcDisc));
    }
  };

  const handleOriginalPriceChange = (masked: string, numOrig: number) => {
    if (discountPercent > 0 && numOrig > 0) {
      const promo = calculatePromotionalPrice(numOrig, discountPercent);
      onChangePrice(formatDecimalInput(promo), masked, discountPercentInput);
    } else {
      const calcDisc = calculateDiscountPercent(numOrig, finalPrice);
      onChangePrice(priceInput, masked, String(calcDisc));
    }
  };

  const handleDiscountPercentChange = (rawPercent: string) => {
    const pct = Math.min(90, Math.max(0, parseFloat(rawPercent) || 0));
    const baseOrig = originalPrice > 0 ? originalPrice : finalPrice;
    const origStr = originalPrice > 0 ? originalPriceInput : formatDecimalInput(baseOrig);
    const promo = calculatePromotionalPrice(baseOrig, pct);
    onChangePrice(formatDecimalInput(promo), origStr, String(pct));
  };

  return (
    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-[#166534]" />
          Precificação & Desconto Promocional Automático
        </span>
        <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#166534] cursor-pointer">
          <input
            type="checkbox"
            checked={hasPromo}
            onChange={(e) => {
              const checked = e.target.checked;
              onTogglePromo(checked);
              if (checked && originalPrice <= finalPrice) {
                // Inicializa preço original com o valor atual e aplica 10% de sugestão
                const base = finalPrice > 0 ? finalPrice : 25;
                const promo = calculatePromotionalPrice(base, 10);
                onChangePrice(formatDecimalInput(promo), formatDecimalInput(base), '10');
              }
            }}
            className="rounded text-[#166534]"
          />
          Aplicar preço promocional
        </label>
      </div>

      {!hasPromo ? (
        <CurrencyInput
          label="Preço de Venda (R$ 0,00)"
          required
          value={priceInput}
          onChange={(masked) => handleRegularPriceChange(masked)}
          helperText={`Gravado com precisão decimal: ${formatBRL(finalPrice)}`}
        />
      ) : (
        <div className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <CurrencyInput
              label="Preço Original (De R$)"
              required
              value={originalPriceInput}
              onChange={handleOriginalPriceChange}
            />

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Desconto (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={90}
                  step="1"
                  value={discountPercentInput}
                  onChange={(e) => handleDiscountPercentChange(e.target.value)}
                  className="w-full pl-3 pr-8 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-extrabold text-amber-800 focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
                <Percent className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <CurrencyInput
              label="Preço Promocional (Por R$)"
              required
              value={priceInput}
              onChange={(masked) => handleRegularPriceChange(masked)}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-slate-500">Desconto rápido:</span>
              {QUICK_DISCOUNTS.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handleDiscountPercentChange(String(pct))}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold cursor-pointer ${
                    Math.round(discountPercent) === pct
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-amber-50'
                  }`}
                >
                  -{pct}%
                </button>
              ))}
            </div>

            {originalPrice > finalPrice && (
              <span className="text-[11px] font-extrabold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                Economia de {formatBRL(originalPrice - finalPrice)} (-{discountPercent}%)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
