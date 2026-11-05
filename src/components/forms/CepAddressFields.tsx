import React, { useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { formatCEP, lookupAddressByCEP } from '../../utils/validation';

export interface CepAddressValue {
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
  complement?: string;
  referencePoint?: string;
}

export interface CepAddressFieldsProps {
  value: CepAddressValue;
  onChange: (next: CepAddressValue) => void;
  showReferencePoint?: boolean;
  compact?: boolean;
}

/**
 * Bloco reutilizável de Endereço Estruturado com autopreenchimento via CEP (ViaCEP + fallback local).
 * Utilizado no Checkout do Cliente e nas Configurações Operacionais do Estabelecimento.
 */
export const CepAddressFields: React.FC<CepAddressFieldsProps> = ({
  value,
  onChange,
  showReferencePoint = true,
  compact = false,
}) => {
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [loadingCep, setLoadingCep] = useState<boolean>(false);

  const handleCepInput = async (rawCep: string) => {
    const formatted = formatCEP(rawCep);
    onChange({ ...value, cep: formatted });

    const digits = formatted.replace(/\D/g, '');
    if (digits.length === 8) {
      setLoadingCep(true);
      setStatusMsg('Consultando CEP no ViaCEP...');
      const res = await lookupAddressByCEP(digits);
      setLoadingCep(false);

      if (res.success) {
        onChange({
          ...value,
          cep: formatted,
          street: res.street || value.street,
          neighborhood: res.neighborhood || value.neighborhood,
        });
        setStatusMsg(
          res.city
            ? `✓ Endereço preenchido automaticamente (${res.city}) — campos editáveis.`
            : res.message || '✓ CEP localizado (campos editáveis).'
        );
      } else {
        setStatusMsg(
          res.message || 'CEP não encontrado. Preencha Rua e Bairro manualmente.'
        );
      }
    } else {
      setStatusMsg('');
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-3 gap-2.5">
        <div className="col-span-1">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            CEP <span className="text-red-600">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={value.cep}
              onChange={(e) => handleCepInput(e.target.value)}
              placeholder="00000-000"
              maxLength={9}
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#166534]"
            />
            {loadingCep ? (
              <Loader2 className="w-3.5 h-3.5 text-[#166534] animate-spin absolute right-2.5 top-1/2 -translate-y-1/2" />
            ) : (
              <MapPin className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            )}
          </div>
        </div>

        <div className="col-span-2">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            Rua / Logradouro <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={value.street}
            onChange={(e) => onChange({ ...value, street: e.target.value })}
            placeholder="Ex: Avenida Brasil"
            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#166534]"
          />
        </div>
      </div>

      {statusMsg && (
        <p className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
          {statusMsg}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2.5">
        <div className="col-span-1">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            Número <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={value.number}
            onChange={(e) => onChange({ ...value, number: e.target.value })}
            placeholder="1420"
            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#166534]"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            Bairro <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={value.neighborhood}
            onChange={(e) => onChange({ ...value, neighborhood: e.target.value })}
            placeholder="Centro"
            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#166534]"
          />
        </div>
      </div>

      {!compact && (
        <div className={`grid ${showReferencePoint ? 'grid-cols-2' : 'grid-cols-1'} gap-2.5`}>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Complemento (opcional)
            </label>
            <input
              type="text"
              value={value.complement || ''}
              onChange={(e) => onChange({ ...value, complement: e.target.value })}
              placeholder="Apto, Sala, Loja..."
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#166534]"
            />
          </div>

          {showReferencePoint && (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Ponto de Referência (opcional)
              </label>
              <input
                type="text"
                value={value.referencePoint || ''}
                onChange={(e) => onChange({ ...value, referencePoint: e.target.value })}
                placeholder="Próximo à praça..."
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#166534]"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
