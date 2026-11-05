import React, { useState } from 'react';
import {
  Bike,
  FlaskConical,
  Lock,
  RotateCcw,
  Shield,
  Smartphone,
  Store,
} from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { UserRole } from './types';
import { CustomerView } from './components/CustomerView';
import { MerchantView } from './components/MerchantView';
import { AdminView } from './components/AdminView';
import { DriverView } from './components/DriverView';
import { SessionReauthModal } from './components/SessionReauthModal';
import { TestProtocolModal } from './components/TestProtocolModal';

const WorkspaceShell: React.FC = () => {
  const {
    currentUser,
    switchDemoProfile,
    setSessionExpiredModalOpen,
    resetDemoDatabase,
    orders,
    rides,
  } = useApp();

  const [activePortal, setActivePortal] = useState<UserRole>('cliente');
  const [testModalOpen, setTestModalOpen] = useState(false);

  const pendingMerchantOrders = orders.filter(
    (o) => o.status === 'aguardando_confirmacao'
  ).length;

  const pendingDriverRides = rides.filter((r) => r.status === 'solicitada').length;

  const handlePortalSwitch = (role: UserRole) => {
    setActivePortal(role);
    switchDemoProfile(role);
  };

  return (
    <div className="min-h-screen bg-[#EEF2EF] text-slate-900">
      {/* Barra Superior de Alternância Rápida de Módulos / Perfis (RBAC + Ferramentas de Teste) */}
      <header className="sticky top-0 z-40 bg-[#0F2918] text-white border-b border-emerald-900/60 px-3 py-2 shadow-md">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => handlePortalSwitch('cliente')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                activePortal === 'cliente'
                  ? 'bg-[#1E7E3E] text-white shadow-xs'
                  : 'text-emerald-100 hover:bg-white/10'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>App do Cliente</span>
            </button>

            <button
              onClick={() => handlePortalSwitch('lojista')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                activePortal === 'lojista'
                  ? 'bg-[#1E7E3E] text-white shadow-xs'
                  : 'text-emerald-100 hover:bg-white/10'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Painel do Lojista</span>
              {pendingMerchantOrders > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[10px] font-extrabold">
                  {pendingMerchantOrders}
                </span>
              )}
            </button>

            <button
              onClick={() => handlePortalSwitch('administrador')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                activePortal === 'administrador'
                  ? 'bg-[#1E7E3E] text-white shadow-xs'
                  : 'text-emerald-100 hover:bg-white/10'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Administrador</span>
            </button>

            <button
              onClick={() => handlePortalSwitch('entregador')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                activePortal === 'entregador'
                  ? 'bg-[#1E7E3E] text-white shadow-xs'
                  : 'text-emerald-100 hover:bg-white/10'
              }`}
            >
              <Bike className="w-3.5 h-3.5" />
              <span>Entregador</span>
              {pendingDriverRides > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[10px] font-extrabold">
                  {pendingDriverRides}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setTestModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-800/80 hover:bg-emerald-700 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
              title="Executar Protocolo Obrigatório de Testes (DRS Seção 13)"
            >
              <FlaskConical className="w-3.5 h-3.5 text-emerald-300" />
              <span>Testes DRS</span>
            </button>

            <button
              onClick={() => setSessionExpiredModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
              title="Simular expiração de sessão sem perder formulário (RNF11)"
            >
              <Lock className="w-3 h-3 text-amber-300" />
              <span className="hidden sm:inline">Testar RNF11</span>
            </button>

            <button
              onClick={resetDemoDatabase}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-200 cursor-pointer"
              title="Restaurar banco de demonstração inicial"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal Protegido por Perfil (RBAC — RNF05) */}
      <main>
        {activePortal === 'cliente' && <CustomerView />}
        {activePortal === 'lojista' && <MerchantView />}
        {activePortal === 'administrador' && <AdminView />}
        {activePortal === 'entregador' && <DriverView />}
      </main>

      {/* Modais Globais */}
      <SessionReauthModal />
      <TestProtocolModal open={testModalOpen} onClose={() => setTestModalOpen(false)} />

      {/* Rodapé discreto de status RBAC */}
      <div className="hidden lg:flex fixed bottom-3 right-3 z-30 bg-white/90 backdrop-blur-xs border border-slate-200 px-3 py-1.5 rounded-full shadow-sm text-[11px] text-slate-600 items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#1E7E3E]" />
        <span>
          RBAC Ativo: <strong>{currentUser?.role || 'visitante'}</strong> (
          {currentUser?.firstName || 'Sem sessão'})
        </span>
      </div>
    </div>
  );
};

export function App() {
  return (
    <AppProvider>
      <WorkspaceShell />
    </AppProvider>
  );
}

export default App;
