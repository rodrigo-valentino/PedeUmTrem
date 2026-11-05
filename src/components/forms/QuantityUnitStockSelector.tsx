import React from 'react';
import { Minus, Package, Plus } from 'lucide-react';
import { UnitOfMeasure } from '../../types';

export interface QuantityUnitStockSelectorProps {
  unitOfMeasure: UnitOfMeasure;
  unitQuantity: number;
  trackStock: boolean;
  stockQuantity: number;
  onChange: (next: {
    unitOfMeasure: UnitOfMeasure;
    unitQuantity: number;
    trackStock: boolean;
    stockQuantity: number;
  }) => void;
}

const UNIT_OPTIONS: Array<{ id: UnitOfMeasure; label: string; quickQtys: number[] }> = [
  { id: 'un', label: 'Unidade (un)', quickQtys: [1, 2, 6, 12] },
  { id: 'porcao', label: 'Porção', quickQtys: [1, 2] },
  { id: 'g', label: 'Gramas (g)', quickQtys: [200, 350, 500, 750] },
  { id: 'kg', label: 'Quilos (kg)', quickQtys: [1, 2, 5] },
  { id: 'ml', label: 'Mililitros (ml)', quickQtys: [269, 350, 500, 600] },
  { id: 'l', label: 'Litros (L)', quickQtys: [1, 1.5, 2] },
  { id: 'combo', label: 'Combo / Kit', quickQtys: [1, 2] },
];

/**
 * Componente reutilizável para seleção de Quantidade/Medida da porção e Controle de Estoque com steppers (-/+).
 */
export const QuantityUnitStockSelector: React.FC<QuantityUnitStockSelectorProps> = ({
  unitOfMeasure,
  unitQuantity,
  trackStock,
  stockQuantity,
  onChange,
}) => {
  const currentUnitConfig =
    UNIT_OPTIONS.find((u) => u.id === unitOfMeasure) || UNIT_OPTIONS[0];

  const adjustQuantity = (delta: number) => {
    const step = unitOfMeasure === 'g' || unitOfMeasure === 'ml' ? 50 : 1;
    const next = Math.max(1, Number((unitQuantity + delta * step).toFixed(2)));
    onChange({
      unitOfMeasure,
      unitQuantity: next,
      trackStock,
      stockQuantity,
    });
  };

  return (
    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-[#166534]" />
          Unidade de Medida, Quantidade e Estoque
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            Unidade de Medida
          </label>
          <select
            value={unitOfMeasure}
            onChange={(e) => {
              const nextUnit = e.target.value as UnitOfMeasure;
              const defQty =
                UNIT_OPTIONS.find((u) => u.id === nextUnit)?.quickQtys[0] || 1;
              onChange({
                unitOfMeasure: nextUnit,
                unitQuantity: defQty,
                trackStock,
                stockQuantity,
              });
            }}
            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800"
          >
            {UNIT_OPTIONS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            Quantidade / Peso ({unitOfMeasure})
          </label>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => adjustQuantity(-1)}
              className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <input
              type="number"
              min={0.1}
              step="any"
              value={unitQuantity}
              onChange={(e) =>
                onChange({
                  unitOfMeasure,
                  unitQuantity: Math.max(0.1, parseFloat(e.target.value) || 1),
                  trackStock,
                  stockQuantity,
                })
              }
              className="flex-1 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-center text-xs font-extrabold"
            />
            <button
              type="button"
              onClick={() => adjustQuantity(1)}
              className="w-8 h-8 rounded-xl bg-[#166534] text-white flex items-center justify-center hover:bg-[#14532d] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            {currentUnitConfig.quickQtys.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() =>
                  onChange({
                    unitOfMeasure,
                    unitQuantity: q,
                    trackStock,
                    stockQuantity,
                  })
                }
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer ${
                  unitQuantity === q
                    ? 'bg-[#166534] text-white'
                    : 'bg-white border border-slate-200 text-slate-600'
                }`}
              >
                {q}
                {unitOfMeasure}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Controle opcional de estoque */}
      <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={trackStock}
            onChange={(e) =>
              onChange({
                unitOfMeasure,
                unitQuantity,
                trackStock: e.target.checked,
                stockQuantity: e.target.checked ? Math.max(1, stockQuantity || 20) : 0,
              })
            }
            className="rounded text-[#166534]"
          />
          Controlar quantidade em estoque
        </label>

        {trackStock ? (
          <div className="inline-flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-600">Disponível:</span>
            <button
              type="button"
              onClick={() =>
                onChange({
                  unitOfMeasure,
                  unitQuantity,
                  trackStock,
                  stockQuantity: Math.max(0, stockQuantity - 1),
                })
              }
              className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
            >
              <Minus className="w-3 h-3" />
            </button>
            <input
              type="number"
              min={0}
              value={stockQuantity}
              onChange={(e) =>
                onChange({
                  unitOfMeasure,
                  unitQuantity,
                  trackStock,
                  stockQuantity: Math.max(0, parseInt(e.target.value, 10) || 0),
                })
              }
              className="w-16 px-2 py-1 rounded-lg bg-white border border-slate-200 text-center text-xs font-extrabold"
            />
            <button
              type="button"
              onClick={() =>
                onChange({
                  unitOfMeasure,
                  unitQuantity,
                  trackStock,
                  stockQuantity: stockQuantity + 5,
                })
              }
              className="px-2 py-1 rounded-lg bg-[#E8F5EC] text-[#166534] text-[10px] font-extrabold cursor-pointer"
            >
              +5 un
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-slate-500 font-medium">
            Produção sob demanda / Estoque livre
          </span>
        )}
      </div>
    </div>
  );
};
