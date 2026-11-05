import React, { useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import {
  formatCEP,
  formatCNPJ,
  formatCPF,
  formatDocument,
  formatPhone,
  formatPixKeyByType,
  validateCEP,
  validateCNPJ,
  validateCPF,
  validateDocument,
  validateEmail,
  validatePhone,
} from '../../utils/validation';

export type MaskType = 'phone' | 'cpf' | 'cnpj' | 'document' | 'cep' | 'email' | 'pix';

export interface MaskedInputProps {
  label?: string;
  required?: boolean;
  mask: MaskType;
  pixKeyType?: string;
  value: string;
  onChange: (formattedValue: string) => void;
  placeholder?: string;
  helperText?: string;
  validateOnChange?: boolean;
  className?: string;
}

/**
 * Componente reutilizável para campos com máscara automática (Telefone, CPF, CNPJ, CPF/CNPJ, CEP, E-mail e Chave Pix)
 * e validação em tempo real.
 */
export const MaskedInput: React.FC<MaskedInputProps> = ({
  label,
  required = false,
  mask,
  pixKeyType = 'aleatoria',
  value,
  onChange,
  placeholder,
  helperText,
  validateOnChange = true,
  className = '',
}) => {
  const [touched, setTouched] = useState(false);

  const applyMask = (raw: string): string => {
    switch (mask) {
      case 'phone':
        return formatPhone(raw);
      case 'cpf':
        return formatCPF(raw);
      case 'cnpj':
        return formatCNPJ(raw);
      case 'document':
        return formatDocument(raw);
      case 'cep':
        return formatCEP(raw);
      case 'pix':
        return formatPixKeyByType(raw, pixKeyType);
      case 'email':
      default:
        return raw;
    }
  };

  const getValidation = (val: string) => {
    const trimmed = (val || '').trim();
    if (!trimmed) {
      return required
        ? { valid: false, message: 'Campo obrigatório.' }
        : { valid: true };
    }

    switch (mask) {
      case 'phone':
        return validatePhone(trimmed);
      case 'cpf':
        return validateCPF(trimmed);
      case 'cnpj':
        return validateCNPJ(trimmed);
      case 'document':
        return validateDocument(trimmed);
      case 'cep':
        return validateCEP(trimmed);
      case 'email':
        return validateEmail(trimmed);
      case 'pix': {
        const pType = (pixKeyType || '').toLowerCase();
        if (pType === 'cpf') return validateCPF(trimmed);
        if (pType === 'cnpj') return validateCNPJ(trimmed);
        if (pType === 'telefone' || pType === 'celular') return validatePhone(trimmed);
        if (pType === 'email') return validateEmail(trimmed);
        return { valid: trimmed.length >= 5, message: 'Informe uma chave Pix válida.' };
      }
      default:
        return { valid: true };
    }
  };

  const validation = getValidation(value);
  const showValidation = (touched || (validateOnChange && value.trim().length > 3)) && value.trim().length > 0;

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-slate-700">
            {label} {required && <span className="text-red-600">*</span>}
          </label>
          {showValidation && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                validation.valid ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {validation.valid ? (
                <>
                  <CheckCircle2 className="w-3 h-3" />
                  Válido
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3" />
                  Incompleto / Inválido
                </>
              )}
            </span>
          )}
        </div>
      )}

      <input
        type="text"
        value={value}
        onBlur={() => setTouched(true)}
        onChange={(e) => onChange(applyMask(e.target.value))}
        placeholder={placeholder}
        className={`w-full px-3.5 py-2 rounded-xl bg-white border text-xs font-medium transition focus:outline-none focus:ring-2 ${
          showValidation && !validation.valid
            ? 'border-amber-300 focus:ring-amber-500'
            : 'border-slate-200 focus:ring-[#166534]'
        }`}
      />

      {showValidation && !validation.valid && validation.message ? (
        <p className="text-[10px] font-semibold text-amber-700">{validation.message}</p>
      ) : helperText ? (
        <p className="text-[10px] text-slate-500">{helperText}</p>
      ) : null}
    </div>
  );
};
