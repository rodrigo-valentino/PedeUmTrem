import React, { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';

export interface AutocompleteInputProps {
  label?: string;
  required?: boolean;
  value: string;
  onChange: (nextValue: string) => void;
  suggestions: string[];
  placeholder?: string;
  helperText?: string;
  appendMode?: boolean; // útil para bairros / área de atendimento separados por vírgula
  className?: string;
}

/**
 * Componente reutilizável de Autocomplete com sugestões filtráveis ao digitar e chips de seleção rápida
 * (para categorias, marcas, bairros recorrentes e motivos operacionais).
 */
export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  label,
  required = false,
  value,
  onChange,
  suggestions,
  placeholder,
  helperText,
  appendMode = false,
  className = '',
}) => {
  const [focused, setFocused] = useState(false);

  const filteredSuggestions = useMemo(() => {
    const q = (value || '').trim().toLowerCase();
    if (!q || appendMode) return suggestions;
    return suggestions.filter((s) => s.toLowerCase().includes(q));
  }, [value, suggestions, appendMode]);

  const handleSelectSuggestion = (item: string) => {
    if (!appendMode) {
      onChange(item);
      setFocused(false);
      return;
    }

    const parts = (value || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (!parts.some((p) => p.toLowerCase() === item.toLowerCase())) {
      onChange([...parts, item].join(', '));
    }
  };

  return (
    <div className={`space-y-1.5 relative ${className}`}>
      {label && (
        <label className="block text-xs font-bold text-slate-700">
          {label} {required && <span className="text-red-600">*</span>}
        </label>
      )}

      <input
        type="text"
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 180)}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#166534]"
      />

      {/* Chips rápidos sempre acessíveis para reduzir digitação */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 pt-0.5">
          <span className="text-[10px] font-bold text-slate-400 inline-flex items-center gap-0.5">
            <Sparkles className="w-2.5 h-2.5 text-[#166534]" />
            Sugestões:
          </span>
          {(focused ? filteredSuggestions : suggestions).slice(0, 8).map((sug) => (
            <button
              key={sug}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelectSuggestion(sug);
              }}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                value.toLowerCase().includes(sug.toLowerCase())
                  ? 'bg-[#166534] text-white'
                  : 'bg-[#E8F5EC] hover:bg-[#D5ECDD] text-[#166534]'
              }`}
            >
              {appendMode ? `+ ${sug}` : sug}
            </button>
          ))}
        </div>
      )}

      {helperText && <p className="text-[10px] text-slate-500">{helperText}</p>}
    </div>
  );
};
