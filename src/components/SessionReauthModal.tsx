import React, { useState } from 'react';
import { Lock, ShieldCheck, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

/**
 * RNF11 / Critério 3 — Se a sessão expirar, um modal pede nova autenticação
 * sem recarregar a página e sem perder o progresso do formulário em preenchimento.
 */
export const SessionReauthModal: React.FC = () => {
  const {
    currentUser,
    sessionExpiredModalOpen,
    setSessionExpiredModalOpen,
    loginWithPassword,
  } = useApp();

  const [email, setEmail] = useState(currentUser?.email || 'cliente@pedeumtrem.com.br');
  const [password, setPassword] = useState(currentUser?.passwordHash || 'Trem2026');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!sessionExpiredModalOpen) return null;

  const handleReauth = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = loginWithPassword(email, password);
    if (!res.success) {
      setError(res.message);
      return;
    }
    setSuccessMsg('Sessão renovada com sucesso! Seus dados em preenchimento foram preservados.');
    setTimeout(() => {
      setSuccessMsg('');
      setSessionExpiredModalOpen(false);
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-emerald-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Renovar Sessão (RNF11)</h3>
              <p className="text-xs text-slate-500">
                Sua sessão expirou. Autentique-se abaixo sem perder os dados preenchidos na tela.
              </p>
            </div>
          </div>
          <button
            onClick={() => setSessionExpiredModalOpen(false)}
            className="text-slate-400 hover:text-slate-600 p-1"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleReauth} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              E-mail da conta <span className="text-red-600">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Senha <span className="text-red-600">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              {successMsg}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setSessionExpiredModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Continuar editando rascunho
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#166534] text-white hover:bg-[#14532d] shadow-sm"
            >
              Confirmar e Manter Progresso
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
