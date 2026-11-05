import React from 'react';
import { Clock, Copy, Plus, Sun, Trash2 } from 'lucide-react';
import { DaySchedule, ScheduleInterval } from '../../types';

const DEFAULT_DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export function normalizeSchedules(schedules?: DaySchedule[]): DaySchedule[] {
  if (!schedules || schedules.length === 0) {
    return DEFAULT_DAYS.map((day) => ({
      day,
      open: '18:00',
      close: '23:30',
      isOpen: day !== 'Seg',
      is24Hours: false,
      intervals: [{ open: '18:00', close: '23:30' }],
    }));
  }

  return DEFAULT_DAYS.map((dayName) => {
    const existing = schedules.find(
      (s) => s.day.toLowerCase().slice(0, 3) === dayName.toLowerCase().slice(0, 3)
    );
    if (!existing) {
      return {
        day: dayName,
        open: '18:00',
        close: '23:30',
        isOpen: false,
        is24Hours: false,
        intervals: [{ open: '18:00', close: '23:30' }],
      };
    }

    const intervals: ScheduleInterval[] =
      existing.intervals && existing.intervals.length > 0
        ? existing.intervals
        : [
            {
              open: existing.open && existing.open !== 'Fechado' ? existing.open : '18:00',
              close: existing.close && existing.close !== 'Fechado' ? existing.close : '23:30',
            },
          ];

    return {
      ...existing,
      day: dayName,
      open: existing.is24Hours
        ? '00:00'
        : existing.isOpen
        ? intervals[0].open
        : 'Fechado',
      close: existing.is24Hours
        ? '23:59'
        : existing.isOpen
        ? intervals[intervals.length - 1].close
        : 'Fechado',
      is24Hours: Boolean(existing.is24Hours),
      intervals,
    };
  });
}

/**
 * Converte a grade estruturada de horários em resumo legível para o campo openingHours do banco
 */
export function buildOpeningHoursSummary(schedules: DaySchedule[]): string {
  const normalized = normalizeSchedules(schedules);
  const openDays = normalized.filter((d) => d.isOpen);

  if (openDays.length === 0) {
    return 'Fechado temporariamente';
  }

  if (openDays.length === 7 && openDays.every((d) => d.is24Hours)) {
    return 'Aberto 24 horas (Todos os dias)';
  }

  const formatDayIntervals = (d: DaySchedule): string => {
    if (!d.isOpen) return 'Fechado';
    if (d.is24Hours) return '24h';
    const list = d.intervals && d.intervals.length > 0 ? d.intervals : [{ open: d.open, close: d.close }];
    return list.map((iv) => `${iv.open} às ${iv.close}`).join(' e ');
  };

  // Agrupa dias consecutivos com a mesma configuração
  const groups: Array<{ startDay: string; endDay: string; label: string }> = [];
  for (const day of normalized) {
    const label = formatDayIntervals(day);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.endDay = day.day;
    } else {
      groups.push({ startDay: day.day, endDay: day.day, label });
    }
  }

  return groups
    .map((g) => {
      const range = g.startDay === g.endDay ? g.startDay : `${g.startDay} a ${g.endDay}`;
      return `${range}: ${g.label}`;
    })
    .join(' • ');
}

export interface OpeningHoursSelectorProps {
  schedules: DaySchedule[];
  openingHoursText: string;
  onChange: (nextSchedules: DaySchedule[], summaryText: string) => void;
}

/**
 * Componente reutilizável para configuração de horários de funcionamento do estabelecimento:
 * - Suporta múltiplos turnos por dia (ex: Almoço 11:00–14:30 + Jantar 18:30–23:00)
 * - Dias fechados e funcionamento 24 horas
 * - Presets rápidos e geração automática do texto de resumo (compatível com openingHours)
 */
export const OpeningHoursSelector: React.FC<OpeningHoursSelectorProps> = ({
  schedules,
  openingHoursText,
  onChange,
}) => {
  const days = normalizeSchedules(schedules);

  const emitChange = (updated: DaySchedule[]) => {
    const normalized = updated.map((d) => {
      const ivs =
        d.intervals && d.intervals.length > 0
          ? d.intervals
          : [{ open: '18:00', close: '23:00' }];
      return {
        ...d,
        intervals: ivs,
        open: !d.isOpen ? 'Fechado' : d.is24Hours ? '00:00' : ivs[0].open,
        close: !d.isOpen ? 'Fechado' : d.is24Hours ? '23:59' : ivs[ivs.length - 1].close,
      };
    });
    const summary = buildOpeningHoursSummary(normalized);
    onChange(normalized, summary);
  };

  const toggleDayOpen = (idx: number) => {
    const next = days.map((d, i) =>
      i === idx ? { ...d, isOpen: !d.isOpen, is24Hours: false } : d
    );
    emitChange(next);
  };

  const toggleDay24Hours = (idx: number) => {
    const next = days.map((d, i) =>
      i === idx
        ? {
            ...d,
            isOpen: true,
            is24Hours: !d.is24Hours,
            intervals: [{ open: '00:00', close: '23:59' }],
          }
        : d
    );
    emitChange(next);
  };

  const updateInterval = (
    dayIdx: number,
    intervalIdx: number,
    field: 'open' | 'close',
    val: string
  ) => {
    const next = days.map((d, i) => {
      if (i !== dayIdx) return d;
      const currentIntervals = [...(d.intervals || [{ open: d.open, close: d.close }])];
      currentIntervals[intervalIdx] = {
        ...currentIntervals[intervalIdx],
        [field]: val,
      };
      return {
        ...d,
        is24Hours: false,
        intervals: currentIntervals,
      };
    });
    emitChange(next);
  };

  const addSecondShift = (dayIdx: number) => {
    const next = days.map((d, i) => {
      if (i !== dayIdx) return d;
      const currentIntervals = [...(d.intervals || [{ open: '11:00', close: '14:30' }])];
      if (currentIntervals.length >= 3) return d;
      return {
        ...d,
        isOpen: true,
        is24Hours: false,
        intervals: [...currentIntervals, { open: '18:00', close: '23:00' }],
      };
    });
    emitChange(next);
  };

  const removeShift = (dayIdx: number, intervalIdx: number) => {
    const next = days.map((d, i) => {
      if (i !== dayIdx) return d;
      const currentIntervals = (d.intervals || []).filter((_, idx) => idx !== intervalIdx);
      return {
        ...d,
        intervals:
          currentIntervals.length > 0
            ? currentIntervals
            : [{ open: '18:00', close: '23:00' }],
      };
    });
    emitChange(next);
  };

  const applyPreset = (preset: 'noturno' | 'almoco_jantar' | '24horas' | 'copiar_primeiro') => {
    if (preset === '24horas') {
      emitChange(
        days.map((d) => ({
          ...d,
          isOpen: true,
          is24Hours: true,
          intervals: [{ open: '00:00', close: '23:59' }],
        }))
      );
      return;
    }
    if (preset === 'almoco_jantar') {
      emitChange(
        days.map((d) => ({
          ...d,
          isOpen: d.day !== 'Seg',
          is24Hours: false,
          intervals: [
            { open: '11:00', close: '14:30' },
            { open: '18:30', close: '23:00' },
          ],
        }))
      );
      return;
    }
    if (preset === 'noturno') {
      emitChange(
        days.map((d) => ({
          ...d,
          isOpen: d.day !== 'Seg',
          is24Hours: false,
          intervals: [{ open: '18:00', close: '23:30' }],
        }))
      );
      return;
    }
    if (preset === 'copiar_primeiro') {
      const firstOpen = days.find((d) => d.isOpen) || days[0];
      emitChange(
        days.map((d) => ({
          ...d,
          isOpen: firstOpen.isOpen,
          is24Hours: firstOpen.is24Hours,
          intervals: firstOpen.intervals ? [...firstOpen.intervals] : [{ open: '18:00', close: '23:00' }],
        }))
      );
    }
  };

  return (
    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <label className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#166534]" />
            Horários de Funcionamento por Dia e Turno (RF28) *
          </label>
          <p className="text-[11px] text-slate-500">
            Configure múltiplos períodos (ex: Almoço e Jantar), dias fechados ou funcionamento 24 horas.
          </p>
        </div>

        {/* Presets Rápidos */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => applyPreset('almoco_jantar')}
            className="px-2.5 py-1 rounded-lg bg-[#E8F5EC] hover:bg-[#D5ECDD] text-[#166534] text-[11px] font-bold cursor-pointer"
          >
            ⚡ 2 Turnos (Almoço + Jantar)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('noturno')}
            className="px-2.5 py-1 rounded-lg bg-[#E8F5EC] hover:bg-[#D5ECDD] text-[#166534] text-[11px] font-bold cursor-pointer"
          >
            🌙 Turno Noturno (18h–23h30)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('24horas')}
            className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
          >
            <Sun className="w-3 h-3" />
            24 Horas
          </button>
          <button
            type="button"
            onClick={() => applyPreset('copiar_primeiro')}
            className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
            title="Replicar horário do 1º dia aberto para todos os dias"
          >
            <Copy className="w-3 h-3" />
            Replicar p/ Todos
          </button>
        </div>
      </div>

      {/* Lista de Dias */}
      <div className="space-y-2">
        {days.map((dayObj, dayIdx) => {
          const intervals =
            dayObj.intervals && dayObj.intervals.length > 0
              ? dayObj.intervals
              : [{ open: '18:00', close: '23:00' }];

          return (
            <div
              key={dayObj.day}
              className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition ${
                dayObj.isOpen
                  ? 'bg-white border-slate-200'
                  : 'bg-slate-100/80 border-slate-200/60 opacity-75'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-[160px]">
                <span className="w-10 text-xs font-extrabold text-slate-900">
                  {dayObj.day}
                </span>

                <button
                  type="button"
                  onClick={() => toggleDayOpen(dayIdx)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold cursor-pointer ${
                    dayObj.isOpen
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {dayObj.isOpen ? '🟢 Aberto' : '🔴 Fechado'}
                </button>

                {dayObj.isOpen && (
                  <button
                    type="button"
                    onClick={() => toggleDay24Hours(dayIdx)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                      dayObj.is24Hours
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    24h
                  </button>
                )}
              </div>

              {!dayObj.isOpen ? (
                <span className="text-xs font-semibold text-slate-400 italic">
                  Sem expediente neste dia
                </span>
              ) : dayObj.is24Hours ? (
                <span className="text-xs font-extrabold text-amber-800 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200">
                  ☀️ Funcionamento 24 horas (00:00 às 23:59)
                </span>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {intervals.map((iv, ivIdx) => {
                    const invalidOrder = iv.open >= iv.close;
                    return (
                      <div
                        key={ivIdx}
                        className="inline-flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200"
                      >
                        <span className="text-[10px] font-bold text-slate-500">
                          {ivIdx + 1}º turno:
                        </span>
                        <input
                          type="time"
                          value={iv.open}
                          onChange={(e) =>
                            updateInterval(dayIdx, ivIdx, 'open', e.target.value)
                          }
                          className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-xs font-bold text-slate-800"
                        />
                        <span className="text-[10px] text-slate-400">às</span>
                        <input
                          type="time"
                          value={iv.close}
                          onChange={(e) =>
                            updateInterval(dayIdx, ivIdx, 'close', e.target.value)
                          }
                          className={`px-1.5 py-0.5 rounded bg-white border text-xs font-bold ${
                            invalidOrder
                              ? 'border-amber-400 text-amber-800'
                              : 'border-slate-200 text-slate-800'
                          }`}
                        />
                        {intervals.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeShift(dayIdx, ivIdx)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                            title="Remover turno"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {intervals.length < 3 && (
                    <button
                      type="button"
                      onClick={() => addSecondShift(dayIdx)}
                      className="px-2 py-1 rounded-lg bg-[#E8F5EC] hover:bg-[#D5ECDD] text-[#166534] text-[10px] font-extrabold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      + Turno
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Resumo Gerado Automaticamente */}
      <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-white p-2.5 rounded-xl border border-emerald-200">
        <div>
          <span className="text-[10px] font-extrabold uppercase text-[#166534] block">
            Resumo Gerado Automaticamente (Exibido na Vitrine):
          </span>
          <strong className="text-slate-800">{openingHoursText}</strong>
        </div>
      </div>
    </div>
  );
};
