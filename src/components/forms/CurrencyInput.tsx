import React from 'react';
import {
  formatBRL,
  formatDecimalInput,
  maskCurrencyInput,
  parseBRLString,
} from '../../utils/currency';

export interface CurrencyInputProps {
  label?: string;
  required?: boolean;
  value: string;
  onChange: (maskedValue: string, numericValue: number) => void;
  placeholder?: string;
  minAmount?: number;
  helperText?: string;
  quickValues?: number[];
  errorMessage?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Componente reutilizável de entrada monetária em R$ com máscara progressiva automática
 * ("1250" -> "12,50"), chips de preenchimento rápido e validação em tempo real.
 */
export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  label,
  required = false,
  value,
  onChange,
  placeholder = '0,00',
  minAmount,
  helperText,
  quickValues,
  errorMessage,
  disabled = false,
  className = '',
}) => {
  const numericValue = parseBRLString(value);
  const isBelowMin =
    minAmount !== undefined && value.trim() !== '' && numericValue < minAmount;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const masked = maskCurrencyInput(raw);
    const num = parseBRLString(masked);
    onChange(masked, num);
  };

  const handleQuickSelect = (amt: number) => {
    const formatted = formatDecimalInput(amt);
    onChange(formatted, amt);
  };

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="block text-xs font-bold text-slate-700">
          {label} {required && <span className="text-red-600">*</span>}
        </label>
      )}

      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-extrabold text-[#166534] select-none">
          R$
        </span>
        <input
          type="text"
          inputMode="numeric"
          disabled={disabled}
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={`w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border text-xs font-extrabold transition focus:outline-none focus:ring-2 ${
            errorMessage || isBelowMin
              ? 'border-red-300 focus:ring-red-500 text-red-900'
              : 'border-slate-200 focus:ring-[#166534] text-slate-900'
          }`}
        />
      </div>

      {quickValues && quickValues.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] font-semibold text-slate-400">Rápido:</span>
          {quickValues.map((amt) => (
            <button
              key={amt}
              type="button"
              disabled={disabled}
              onClick={() => handleQuickSelect(amt)}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                Math.abs(numericValue - amt) < 0.005
                  ? 'bg-[#166534] text-white'
                  : 'bg-[#E8F5EC] hover:bg-[#D5ECDD] text-[#166534]'
              }`}
            >
              {amt === 0 ? 'Grátis (R$ 0,00)' : formatBRL(amt)}
            </button>
          ))}
        </div>
      )}

      {errorMessage ? (
        <p className="text-[11px] font-semibold text-red-600">{errorMessage}</p>
      ) : isBelowMin && minAmount !== undefined ? (
        <p className="text-[11px] font-semibold text-amber-700">
          Valor mínimo exigido: {formatBRL(minAmount)} (atual: {formatBRL(numericValue)})
        </p>
      ) : helperText ? (
        <p className="text-[10px] text-slate-500">{helperText}</p>
      ) : null}
    </div>
  );
};
