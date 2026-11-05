import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bike,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  Search,
  Settings,
  ShieldAlert,
  Star,
  Store,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AccountStatus, UserRole } from '../types';
import { formatBRL } from '../utils/currency';

type AdminTab =
  | 'painel'
  | 'estabelecimentos'
  | 'usuarios'
  | 'pedidos'
  | 'financeiro'
  | 'configuracoes'
  | 'auditoria'
  | 'entregadores';

export const AdminView: React.FC = () => {
  const {
    establishments,
    users,
    orders,
    commissions,
    settlements,
    drivers,
    rides,
    auditLogs,
    settings,
    setEstablishmentApprovalStatus,
    toggleEstablishmentFeatured,
    setDriverApprovalStatus,
    cancelOrResolveRideByAdmin,
    setUserStatus,
    updatePlatformSettings,
    setStoreCustomCommission,
    closeBiweeklyPeriod,
    markSettlementPaid,
    markDriverRidesSettled,
  } = useApp();

  const [activeTab, setActiveTab] = useState<AdminTab>('painel');
  const [toast, setToast] = useState<string | null>(null);

  // RF41 / Critério 21: Busca e filtro de usuários por nome, e-mail, perfil e situação
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<UserRole | 'todos'>('todos');
  const [userStatusFilter, setUserStatusFilter] = useState<AccountStatus | 'todos'>('todos');

  // Filtros de pedidos e vendas (RF42, RF45)
  const [orderStoreFilter, setOrderStoreFilter] = useState<string>('todas');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('todos');

  // Fechamento quinzenal
  const [periodLabel, setPeriodLabel] = useState('1ª Quinzena Nov/2026 (01/11 a 15/11)');
  const [periodStart, setPeriodStart] = useState('2026-11-01');
  const [periodEnd, setPeriodEnd] = useState('2026-11-15');

  // Configurações comerciais (RF48)
  const [defaultCommInput, setDefaultCommInput] = useState(
    String(settings.defaultCommissionPercent)
  );
  const [dueDaysInput, setDueDaysInput] = useState(String(settings.settlementDueDays));
  const [deliveryFeeInput, setDeliveryFeeInput] = useState(
    String(settings.platformDeliveryFee)
  );
  const [driverPayoutInput, setDriverPayoutInput] = useState(
    String(settings.driverPayoutAmount)
  );
  const [exceptionStoreId, setExceptionStoreId] = useState(establishments[0]?.id || '');
  const [exceptionPercentInput, setExceptionPercentInput] = useState('8.5');
  const [exceptionJustification, setExceptionJustification] = useState(
    'Condição comercial aprovada pela diretoria'
  );

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const filteredUsers = useMemo(() => {
    const q = userSearchQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (userRoleFilter !== 'todos' && u.role !== userRoleFilter) return false;
      if (userStatusFilter !== 'todos' && u.status !== userStatusFilter) return false;
      if (!q) return true;
      const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
      return (
        fullName.includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        u.status.toLowerCase().includes(q)
      );
    });
  }, [users, userSearchQuery, userRoleFilter, userStatusFilter]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (orderStoreFilter !== 'todas' && o.establishmentId !== orderStoreFilter)
        return false;
      if (orderStatusFilter !== 'todos' && o.status !== orderStatusFilter) return false;
      return true;
    });
  }, [orders, orderStoreFilter, orderStatusFilter]);

  const totalSalesConcluded = orders
    .filter((o) => o.status === 'concluido')
    .reduce((acc, o) => acc + o.subtotal, 0);

  const totalCommissionsGenerated = commissions.reduce(
    (acc, c) => acc + c.commissionAmount,
    0
  );

  const overdueSettlements = settlements.filter((s) => s.status === 'vencido');

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {toast && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-900 flex items-center justify-between shadow-sm">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#166534]" />
            {toast}
          </span>
          <button onClick={() => setToast(null)} className="underline">
            Fechar
          </button>
        </div>
      )}

      {/* Cabeçalho Administrativo */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
            Governança & Administração da Plataforma
          </span>
          <h1 className="text-2xl font-extrabold mt-0.5">
            PedeUmTrem — Central Administrativa
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Aprovação de estabelecimentos, fechamento quinzenal de comissões, auditoria e gestão de entregadores.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          <div className="bg-slate-800 px-4 py-2.5 rounded-2xl border border-slate-700">
            <span className="text-slate-400 block">Comissão Padrão</span>
            <strong className="text-base text-emerald-400">
              {settings.defaultCommissionPercent}%
            </strong>
          </div>
          <div className="bg-slate-800 px-4 py-2.5 rounded-2xl border border-slate-700">
            <span className="text-slate-400 block">Lojas Pendentes</span>
            <strong className="text-base text-amber-400">
              {establishments.filter((e) => e.approvalStatus === 'pendente').length}
            </strong>
          </div>
          <div className="bg-slate-800 px-4 py-2.5 rounded-2xl border border-slate-700">
            <span className="text-slate-400 block">Inadimplência</span>
            <strong className="text-base text-red-400">{overdueSettlements.length}</strong>
          </div>
        </div>
      </div>

      {/* Menu de Abas Admin (Etapa 5 — Seção 5) */}
      <div className="flex flex-wrap gap-1.5 bg-white p-2 rounded-2xl border border-slate-200">
        {[
          { id: 'painel' as AdminTab, label: 'Painel & Relatórios', icon: BarChart3 },
          {
            id: 'estabelecimentos' as AdminTab,
            label: `Estabelecimentos (${establishments.length})`,
            icon: Store,
          },
          {
            id: 'usuarios' as AdminTab,
            label: `Usuários & Busca (${users.length})`,
            icon: Users,
          },
          {
            id: 'pedidos' as AdminTab,
            label: `Pedidos (${orders.length})`,
            icon: ClipboardList,
          },
          {
            id: 'financeiro' as AdminTab,
            label: 'Comissões & Quinzenas',
            icon: DollarSign,
          },
          {
            id: 'configuracoes' as AdminTab,
            label: 'Regras & Exceções',
            icon: Settings,
          },
          {
            id: 'auditoria' as AdminTab,
            label: `Auditoria (${auditLogs.length})`,
            icon: ShieldAlert,
          },
          {
            id: 'entregadores' as AdminTab,
            label: `Entregadores (${drivers.length})`,
            icon: Bike,
          },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === t.id
                  ? 'bg-[#166534] text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* =====================================================================
          ABA 1: PAINEL GERAL E RELATÓRIOS DE VENDAS E INADIMPLÊNCIA (RF42, RF46)
      ===================================================================== */}
      {activeTab === 'painel' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-3xl p-5 border border-slate-200">
              <span className="text-xs font-bold text-slate-500">
                Vendas Concluídas (Produtos)
              </span>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">
                {formatBRL(totalSalesConcluded)}
              </p>
            </div>
            <div className="bg-white rounded-3xl p-5 border border-slate-200">
              <span className="text-xs font-bold text-slate-500">
                Comissões Geradas (10% / Exceções)
              </span>
              <p className="text-2xl font-extrabold text-[#166534] mt-1">
                {formatBRL(totalCommissionsGenerated)}
              </p>
            </div>
            <div className="bg-white rounded-3xl p-5 border border-slate-200">
              <span className="text-xs font-bold text-slate-500">
                Quinzenas Pagas à Plataforma
              </span>
              <p className="text-2xl font-extrabold text-emerald-700 mt-1">
                {formatBRL(
                  settlements
                    .filter((s) => s.status === 'pago')
                    .reduce((acc, s) => acc + s.totalDueToPlatform, 0)
                )}
              </p>
            </div>
            <div className="bg-white rounded-3xl p-5 border border-red-200 bg-red-50/40">
              <span className="text-xs font-bold text-red-700">
                Inadimplência Vencida (RN11)
              </span>
              <p className="text-2xl font-extrabold text-red-600 mt-1">
                {formatBRL(
                  overdueSettlements.reduce((acc, s) => acc + s.totalDueToPlatform, 0)
                )}
              </p>
            </div>
          </div>

          {/* Relatório de Vendas por Estabelecimento (RF42 / Critério 22) */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3">
            <h2 className="text-base font-extrabold text-slate-900">
              Relatório de Vendas e Comissões por Estabelecimento (RF42 / RF46)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2.5">Estabelecimento</th>
                    <th className="py-2.5">Situação</th>
                    <th className="py-2.5">% Comissão</th>
                    <th className="py-2.5">Pedidos Concluídos</th>
                    <th className="py-2.5">Volume Produtos</th>
                    <th className="py-2.5">Comissão Devida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {establishments.map((st) => {
                    const stOrders = orders.filter(
                      (o) => o.establishmentId === st.id && o.status === 'concluido'
                    );
                    const vol = stOrders.reduce((acc, o) => acc + o.subtotal, 0);
                    const comm = stOrders.reduce((acc, o) => acc + o.commissionAmount, 0);
                    return (
                      <tr key={st.id}>
                        <td className="py-3 font-extrabold text-slate-900">{st.name}</td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              st.approvalStatus === 'ativo'
                                ? 'bg-emerald-100 text-emerald-800'
                                : st.approvalStatus === 'pendente'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {st.approvalStatus}
                          </span>
                        </td>
                        <td className="py-3 font-bold">
                          {st.commissionPercent ?? settings.defaultCommissionPercent}%
                        </td>
                        <td className="py-3">{stOrders.length}</td>
                        <td className="py-3 font-semibold">{formatBRL(vol)}</td>
                        <td className="py-3 font-extrabold text-[#166534]">
                          {formatBRL(comm)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ABA 2: APROVAR, SUSPENDER, REATIVAR E ESCOLHER LOJAS EM DESTAQUE (RF39)
      ===================================================================== */}
      {activeTab === 'estabelecimentos' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2">
            <div>
              <strong>Governança do Catálogo (RF39 & Destaques da Home):</strong> O Administrador
              aprova as lojas e <strong>escolhe quais estabelecimentos ficam na vitrine "Lojas em destaque"</strong> na aba inicial do cliente.
            </div>
            <span className="px-3 py-1 rounded-full bg-amber-200/80 text-amber-950 font-extrabold">
              ★ {establishments.filter((e) => e.featured).length} loja(s) em destaque na Home
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {establishments.map((store) => (
              <div
                key={store.id}
                className={`bg-white rounded-3xl p-5 border flex flex-col justify-between gap-4 ${
                  store.featured ? 'border-amber-400 ring-1 ring-amber-300' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <img
                    src={store.logoUrl}
                    alt={store.name}
                    className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h3 className="text-base font-extrabold text-slate-900 truncate">
                          {store.name}
                        </h3>
                        {store.featured && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-extrabold shrink-0">
                            ★ Destaque
                          </span>
                        )}
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          store.approvalStatus === 'ativo'
                            ? 'bg-emerald-100 text-emerald-800'
                            : store.approvalStatus === 'pendente'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {store.approvalStatus}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {store.categoryName} • {store.address}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      Comissão:{' '}
                      <strong>
                        {store.commissionPercent ?? settings.defaultCommissionPercent}%
                      </strong>{' '}
                      • Entrega:{' '}
                      <strong>{store.deliveryMode.toUpperCase()}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      const res = toggleEstablishmentFeatured(store.id);
                      notify(res.message);
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition ${
                      store.featured
                        ? 'bg-amber-400 hover:bg-amber-500 text-slate-950'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${
                        store.featured ? 'fill-slate-950 text-slate-950' : 'text-slate-500'
                      }`}
                    />
                    {store.featured
                      ? 'Em Destaque na Home (Remover)'
                      : 'Colocar em Destaque na Home'}
                  </button>

                  {store.approvalStatus !== 'ativo' && (
                    <button
                      type="button"
                      onClick={() => {
                        const res = setEstablishmentApprovalStatus(
                          store.id,
                          'ativo',
                          'Aprovação administrativa para exibição no catálogo público'
                        );
                        notify(res.message);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-[#166534] text-white text-xs font-extrabold cursor-pointer"
                    >
                      ✓ Aprovar / Reativar Loja
                    </button>
                  )}

                  {store.approvalStatus !== 'suspenso' && (
                    <button
                      type="button"
                      onClick={() => {
                        const res = setEstablishmentApprovalStatus(
                          store.id,
                          'suspenso',
                          'Suspensão administrativa / inadimplência'
                        );
                        notify(res.message);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold cursor-pointer"
                    >
                      Suspender Loja
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          ABA 3: BUSCA E FILTRO DE USUÁRIOS (RF40, RF41 / Critério 21)
      ===================================================================== */}
      {activeTab === 'usuarios' && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Gerenciamento e Busca de Usuários (RF40 / RF41)
              </h2>
              <p className="text-xs text-slate-500">
                Filtre em tempo real por nome, e-mail, perfil de acesso ou situação cadastral
              </p>
            </div>
            <span className="text-xs font-extrabold text-[#166534]">
              {filteredUsers.length} usuário(s) encontrado(s)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Buscar por nome, sobrenome ou e-mail..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#166534]"
              />
            </div>

            <select
              value={userRoleFilter}
              onChange={(e) => setUserRoleFilter(e.target.value as UserRole | 'todos')}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-white"
            >
              <option value="todos">Todos os Perfis</option>
              <option value="cliente">Perfil: Cliente</option>
              <option value="lojista">Perfil: Lojista</option>
              <option value="administrador">Perfil: Administrador</option>
              <option value="entregador">Perfil: Entregador</option>
            </select>

            <select
              value={userStatusFilter}
              onChange={(e) =>
                setUserStatusFilter(e.target.value as AccountStatus | 'todos')
              }
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-white"
            >
              <option value="todos">Todas as Situações</option>
              <option value="ativo">Situação: Ativo</option>
              <option value="pendente">Situação: Pendente</option>
              <option value="suspenso">Situação: Suspenso</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5">Nome</th>
                  <th className="py-2.5">E-mail</th>
                  <th className="py-2.5">Telefone</th>
                  <th className="py-2.5">Perfil</th>
                  <th className="py-2.5">Situação</th>
                  <th className="py-2.5">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td className="py-3 font-extrabold text-slate-900">
                      {u.firstName} {u.lastName}
                    </td>
                    <td className="py-3 text-slate-600">{u.email}</td>
                    <td className="py-3 text-slate-600">{u.phone}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold uppercase text-[10px]">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          u.status === 'ativo'
                            ? 'bg-emerald-100 text-emerald-800'
                            : u.status === 'pendente'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => {
                          const next = u.status === 'ativo' ? 'suspenso' : 'ativo';
                          const res = setUserStatus(u.id, next);
                          notify(res.message);
                        }}
                        className="text-xs font-bold text-[#166534] hover:underline cursor-pointer"
                      >
                        {u.status === 'ativo' ? 'Suspender' : 'Ativar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          ABA 4: CONSULTA DE PEDIDOS INCLUSIVE RECUSADOS E CANCELADOS (RF40, RF45)
      ===================================================================== */}
      {activeTab === 'pedidos' && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-extrabold text-slate-900">
              Auditoria de Pedidos da Plataforma (RF40 / RF45)
            </h2>
            <div className="flex flex-wrap gap-2">
              <select
                value={orderStoreFilter}
                onChange={(e) => setOrderStoreFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
              >
                <option value="todas">Todos os Estabelecimentos</option>
                {establishments.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>

              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
              >
                <option value="todos">Todos os Status</option>
                <option value="aguardando_confirmacao">Aguardando confirmação</option>
                <option value="aceito">Aceito</option>
                <option value="em_preparacao">Em preparação</option>
                <option value="concluido">Concluído (Com comissão)</option>
                <option value="recusado">Recusado (Sem comissão)</option>
                <option value="cancelado">Cancelado (Sem comissão)</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2">Nº</th>
                  <th className="py-2">Loja</th>
                  <th className="py-2">Cliente</th>
                  <th className="py-2">Produtos</th>
                  <th className="py-2">Entrega</th>
                  <th className="py-2">Comissão</th>
                  <th className="py-2">Status / Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((o) => (
                  <tr key={o.id}>
                    <td className="py-2.5 font-extrabold">#{o.orderNumber}</td>
                    <td className="py-2.5 font-bold">{o.establishmentName}</td>
                    <td className="py-2.5">{o.customerName}</td>
                    <td className="py-2.5">{formatBRL(o.subtotal)}</td>
                    <td className="py-2.5">
                      {formatBRL(o.deliveryFee + (o.extraDeliveryFee || 0))}
                    </td>
                    <td className="py-2.5 font-extrabold text-[#166534]">
                      {formatBRL(o.commissionAmount)} ({o.commissionPercent}%)
                    </td>
                    <td className="py-2.5">
                      <span className="font-bold uppercase">{o.status}</span>
                      {o.rejectionOrCancelReason && (
                        <span className="block text-[10px] text-red-600">
                          Motivo: {o.rejectionOrCancelReason}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          ABA 5: FECHAMENTO QUINZENAL E BAIXA DE COMISSÕES (RF43, RF44, RN11, RN16)
      ===================================================================== */}
      {activeTab === 'financeiro' && (
        <div className="space-y-5">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-4">
            <h2 className="text-base font-extrabold text-slate-900">
              Executar Fechamento Quinzenal (RN11 / RN16 — Dias 1 a 15 e 16 ao fim do mês)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Identificação da Quinzena
                </label>
                <input
                  type="text"
                  value={periodLabel}
                  onChange={(e) => setPeriodLabel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Início
                </label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Fim
                </label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const res = closeBiweeklyPeriod(periodLabel, periodStart, periodEnd);
                notify(res.message);
              }}
              className="px-5 py-2.5 rounded-xl bg-[#166534] text-white text-xs font-extrabold cursor-pointer"
            >
              Fechar Quinzena e Apurar Comissões + Corridas
            </button>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900">
              Fechamentos Quinzenais e Controle de Inadimplência (RF44 / RF46)
            </h3>
            <div className="space-y-3">
              {settlements.map((s) => (
                <div
                  key={s.id}
                  className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-4 ${
                    s.status === 'vencido'
                      ? 'bg-red-50/60 border-red-300'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-extrabold text-slate-900">
                        {s.establishmentName}
                      </h4>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          s.status === 'pago'
                            ? 'bg-emerald-100 text-emerald-800'
                            : s.status === 'vencido'
                            ? 'bg-red-600 text-white'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      {s.periodLabel} • Vencimento: <strong>{s.dueDate}</strong>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Comissões produtos: {formatBRL(s.totalCommissionAmount)} + Taxas
                      Entregadores Plataforma: {formatBRL(s.totalPlatformDeliveryFees)} (Repasse
                      Motoboys: {formatBRL(s.totalDriverPayouts)})
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block">
                        Total devido à plataforma
                      </span>
                      <strong className="text-base font-extrabold text-[#166534]">
                        {formatBRL(s.totalDueToPlatform)}
                      </strong>
                    </div>

                    {s.status !== 'pago' && (
                      <button
                        type="button"
                        onClick={() => {
                          const res = markSettlementPaid(s.id);
                          notify(res.message);
                        }}
                        className="px-4 py-2 rounded-xl bg-[#166534] text-white text-xs font-extrabold cursor-pointer"
                      >
                        Registrar Baixa (Pago)
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ABA 6: CONFIGURAÇÕES DE COMISSÃO PADRÃO E EXCEÇÕES POR LOJA (RF48)
      ===================================================================== */}
      {activeTab === 'configuracoes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-4">
            <h2 className="text-base font-extrabold text-slate-900">
              Parâmetros Globais da Plataforma (RF48 / Seção 16.2)
            </h2>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Comissão Padrão sobre Produtos (%)
              </label>
              <input
                type="number"
                step="0.5"
                value={defaultCommInput}
                onChange={(e) => setDefaultCommInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Prazo de Pagamento após Fechamento Quinzenal (Dias corridos)
              </label>
              <input
                type="number"
                value={dueDaysInput}
                onChange={(e) => setDueDaysInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Taxa Corrida Plataforma (R$)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={deliveryFeeInput}
                  onChange={(e) => setDeliveryFeeInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Repasse ao Entregador (R$)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={driverPayoutInput}
                  onChange={(e) => setDriverPayoutInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const fee = parseFloat(deliveryFeeInput) || 3.0;
                const payout = parseFloat(driverPayoutInput) || 2.5;
                const res = updatePlatformSettings({
                  ...settings,
                  defaultCommissionPercent: parseFloat(defaultCommInput) || 10,
                  settlementDueDays: parseInt(dueDaysInput, 10) || 5,
                  platformDeliveryFee: fee,
                  driverPayoutAmount: payout,
                  platformDeliveryRetention: Math.max(0, Number((fee - payout).toFixed(2))),
                });
                notify(res.message);
              }}
              className="w-full py-2.5 rounded-xl bg-[#166534] text-white text-xs font-extrabold cursor-pointer"
            >
              Salvar Regras Globais
            </button>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-4">
            <h2 className="text-base font-extrabold text-slate-900">
              Exceção de Comissão por Estabelecimento (RF48)
            </h2>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Estabelecimento
              </label>
              <select
                value={exceptionStoreId}
                onChange={(e) => setExceptionStoreId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
              >
                {establishments.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} (Atual:{' '}
                    {st.commissionPercent === null
                      ? `Padrão ${settings.defaultCommissionPercent}%`
                      : `${st.commissionPercent}%`}
                    )
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Percentual Diferenciado (%)
              </label>
              <input
                type="number"
                step="0.5"
                value={exceptionPercentInput}
                onChange={(e) => setExceptionPercentInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Justificativa para Registro na Auditoria (RF47) *
              </label>
              <input
                type="text"
                value={exceptionJustification}
                onChange={(e) => setExceptionJustification(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const res = setStoreCustomCommission(
                    exceptionStoreId,
                    parseFloat(exceptionPercentInput),
                    exceptionJustification
                  );
                  notify(res.message);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#166534] text-white text-xs font-extrabold cursor-pointer"
              >
                Aplicar Exceção
              </button>
              <button
                type="button"
                onClick={() => {
                  const res = setStoreCustomCommission(
                    exceptionStoreId,
                    null,
                    'Retorno para a taxa padrão da plataforma'
                  );
                  notify(res.message);
                }}
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 cursor-pointer"
              >
                Usar Padrão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ABA 7: REGISTRO DE AUDITORIA ADMINISTRATIVA (RF47)
      ===================================================================== */}
      {activeTab === 'auditoria' && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3">
          <h2 className="text-base font-extrabold text-slate-900">
            Log de Auditoria Administrativa (RF47)
          </h2>
          <div className="space-y-2.5">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white text-[10px] font-extrabold mr-2">
                    {log.actionType}
                  </span>
                  <strong className="text-slate-900">{log.description}</strong>
                  {log.justification && (
                    <p className="text-slate-600 mt-0.5">
                      Justificativa: <em>{log.justification}</em>
                    </p>
                  )}
                </div>
                <div className="text-right text-[11px] text-slate-500">
                  <div>Responsável: {log.actorName}</div>
                  <div>{new Date(log.createdAt).toLocaleString('pt-BR')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          ABA 8: GESTÃO DE ENTREGADORES, CORRIDAS E REPASSES (RF53 A RF62 / RN16 / RN19)
      ===================================================================== */}
      {activeTab === 'entregadores' && (
        <div className="space-y-5">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-4">
            <h2 className="text-base font-extrabold text-slate-900">
              Entregadores Cadastrados e Repasses Quinzenais (RF62 / RN16)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {drivers.map((drv) => {
                const drvDelivered = rides.filter(
                  (r) => r.driverId === drv.id && r.status === 'entregue' && !r.payoutSettled
                );
                const pendingPayout = drvDelivered.reduce(
                  (acc, r) => acc + r.driverPayout,
                  0
                );

                return (
                  <div
                    key={drv.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900">
                          {drv.name} ({drv.vehicle.toUpperCase()})
                        </h3>
                        <p className="text-xs text-slate-500">
                          {drv.phone} • Chave Pix: <strong>{drv.pixKey}</strong>
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          drv.approvalStatus === 'ativo'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {drv.approvalStatus}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                      <span>
                        A receber na quinzena ({drvDelivered.length} corridas):{' '}
                        <strong className="text-[#166534]">
                          {formatBRL(pendingPayout)}
                        </strong>
                      </span>
                      <div className="flex gap-1.5">
                        {drv.approvalStatus !== 'ativo' ? (
                          <button
                            type="button"
                            onClick={() => {
                              const res = setDriverApprovalStatus(drv.id, 'ativo');
                              notify(res.message);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#166534] text-white text-xs font-bold cursor-pointer"
                          >
                            Aprovar Entregador
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              const res = setDriverApprovalStatus(drv.id, 'suspenso');
                              notify(res.message);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-red-100 text-red-700 text-xs font-bold cursor-pointer"
                          >
                            Suspender
                          </button>
                        )}
                        {pendingPayout > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const res = markDriverRidesSettled(drv.id);
                              notify(res.message);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                          >
                            Dar Baixa Pix
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Gestão de Corridas em Tempo Real e Exceções Pós-Retirada (RN19) */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Monitoramento de Corridas de Entrega e Resolução de Exceções (RN19)
              </h3>
              <p className="text-xs text-slate-500">
                Acompanhe todas as entregas solicitadas e trate imprevistos mesmo após a retirada do pedido na loja (RN19).
              </p>
            </div>

            <div className="space-y-2.5">
              {rides.map((r) => (
                <div
                  key={r.id}
                  className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900">
                        Pedido #{r.orderNumber} • {r.establishmentName}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[#166534] text-[10px] font-extrabold uppercase">
                        {r.status}
                      </span>
                    </div>
                    <p className="text-slate-600 mt-0.5">
                      Retirada: <strong>{r.pickupNeighborhood}</strong> ➔ Entrega:{' '}
                      <strong>{r.dropoffNeighborhood}</strong> • Motoboy:{' '}
                      <strong>{r.driverName || 'Aguardando na fila'}</strong>
                    </p>
                  </div>

                  {r.status !== 'entregue' && (
                    <button
                      type="button"
                      onClick={() => {
                        const res = cancelOrResolveRideByAdmin(
                          r.id,
                          'Intervenção administrativa para recolocar corrida na fila (RN19)'
                        );
                        notify(res.message);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold cursor-pointer"
                    >
                      Devolver p/ Fila (RN19)
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
