import React, { useMemo, useState } from 'react';
import {
  BellRing,
  Bike,
  CheckCircle2,
  Lock,
  MapPin,
  Navigation,
  Phone,
  Power,
  RotateCcw,
  Volume2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { VehicleType } from '../types';
import { formatBRL } from '../utils/currency';
import {
  playNewDeliveryRideSound,
  requestBrowserNotificationPermission,
} from '../utils/sound';
import { formatPhone } from '../utils/validation';
import { MaskedInput } from './forms/MaskedInput';

export const DriverView: React.FC = () => {
  const {
    drivers,
    rides,
    settings,
    driverAudioUnlocked,
    startDriverShift,
    toggleDriverAvailability,
    acceptDeliveryRide,
    updateDeliveryRideStatus,
    abandonDeliveryRide,
    registerDriver,
  } = useApp();

  const [selectedDriverId, setSelectedDriverId] = useState<string>('drv-carlos-1');
  const [activeTab, setActiveTab] = useState<'corridas' | 'historico' | 'cadastro'>(
    'corridas'
  );
  const [abandonReason, setAbandonReason] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // Cadastro de novo entregador (RF53)
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regVehicle, setRegVehicle] = useState<VehicleType>('moto');
  const [regPix, setRegPix] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const currentDriver = useMemo(
    () => drivers.find((d) => d.id === selectedDriverId) || drivers[0],
    [drivers, selectedDriverId]
  );

  const availableRidesQueue = useMemo(
    () => rides.filter((r) => r.status === 'solicitada'),
    [rides]
  );

  const activeDriverRides = useMemo(
    () =>
      rides.filter(
        (r) =>
          r.driverId === currentDriver.id &&
          (r.status === 'aceita' || r.status === 'retirada')
      ),
    [rides, currentDriver.id]
  );

  const completedDriverRides = useMemo(
    () =>
      rides.filter(
        (r) => r.driverId === currentDriver.id && r.status === 'entregue'
      ),
    [rides, currentDriver.id]
  );

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <div className="max-w-lg mx-auto bg-white min-h-screen shadow-xl border-x border-slate-200 pb-24">
      {toast && (
        <div className="m-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#166534] shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header do Entregador */}
      <div className="bg-[#14532d] text-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
              <Bike className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
                Central do Entregador Parceiro
              </span>
              <h1 className="text-lg font-extrabold">{currentDriver.name}</h1>
            </div>
          </div>

          <select
            value={currentDriver.id}
            onChange={(e) => setSelectedDriverId(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-white/15 text-white text-xs font-bold border border-white/25"
          >
            {drivers.map((d) => (
              <option key={d.id} value={d.id} className="text-slate-900">
                {d.name} ({d.approvalStatus})
              </option>
            ))}
          </select>
        </div>

        {/* Alerta Sonoro de Nova Entrega (Web Audio API) */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-white/10 rounded-2xl p-3 border border-white/15">
          <div className="text-xs">
            <span className="text-emerald-200 block">Alerta sonoro de nova entrega:</span>
            <strong className="text-xs">
              {driverAudioUnlocked
                ? '🔊 Som de Nova Corrida Ativo'
                : '🔇 Clique ao lado para ativar o som de chamada'}
            </strong>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={async () => {
                startDriverShift();
                await requestBrowserNotificationPermission();
                notify('Alerta sonoro de novas entregas ativado com sucesso!');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer ${
                driverAudioUnlocked
                  ? 'bg-emerald-400 text-slate-950'
                  : 'bg-amber-400 text-slate-950'
              }`}
            >
              <BellRing className="w-3.5 h-3.5" />
              {driverAudioUnlocked ? 'Som Ativo' : 'Ativar Som'}
            </button>
            <button
              type="button"
              onClick={() => {
                playNewDeliveryRideSound();
                notify('Tocando alerta sonoro de nova entrega para o entregador!');
              }}
              className="px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
              title="Ouvir toque de nova corrida"
            >
              <Volume2 className="w-3.5 h-3.5" />
              Testar Som
            </button>
          </div>
        </div>

        {/* Toggle Disponível / Indisponível (RF54) */}
        <div className="flex items-center justify-between bg-white/10 rounded-2xl p-3 border border-white/15">
          <div className="text-xs">
            <span className="text-emerald-200 block">Status para receber corridas (RF54):</span>
            <strong className="text-sm uppercase">
              {currentDriver.approvalStatus !== 'ativo'
                ? 'Aguardando Aprovação do Admin'
                : currentDriver.isAvailable
                ? '🟢 Disponível para Entregas'
                : '⚪ Indisponível'}
            </strong>
          </div>
          <button
            type="button"
            disabled={currentDriver.approvalStatus !== 'ativo'}
            onClick={() => toggleDriverAvailability(currentDriver.id)}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
              currentDriver.isAvailable
                ? 'bg-emerald-400 text-slate-950'
                : 'bg-white text-slate-900'
            }`}
          >
            <Power className="w-4 h-4" />
            {currentDriver.isAvailable ? 'Ficar Offline' : 'Ficar Disponível'}
          </button>
        </div>
      </div>

      {/* Abas */}
      <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50">
        {[
          {
            id: 'corridas' as const,
            label: `Corridas (${availableRidesQueue.length + activeDriverRides.length})`,
          },
          { id: 'historico' as const, label: 'Extrato Quinzenal' },
          { id: 'cadastro' as const, label: 'Novo Cadastro (RF53)' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`py-3 text-xs font-extrabold border-b-2 transition cursor-pointer ${
              activeTab === t.id
                ? 'border-[#166534] text-[#166534] bg-white'
                : 'border-transparent text-slate-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-5">
        {activeTab === 'corridas' && (
          <>
            {/* Corridas Ativas Aceitas por este Entregador (RN18: endereço completo e telefone liberados!) */}
            {activeDriverRides.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#166534]">
                  Sua Corrida Ativa (Endereço Completo Liberado — RN18)
                </h2>
                {activeDriverRides.map((ride) => (
                  <div
                    key={ride.id}
                    className="rounded-3xl border-2 border-[#166534] bg-[#F4F8F5] p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#166534] text-white text-[10px] font-extrabold uppercase">
                        Pedido #{ride.orderNumber} • {ride.status}
                      </span>
                      <span className="text-sm font-extrabold text-[#166534]">
                        Seu Repasse: {formatBRL(ride.driverPayout)}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <p className="font-bold text-slate-900">
                        🏪 Retirada: {ride.establishmentName} ({ride.pickupAddress} —{' '}
                        {ride.pickupNeighborhood})
                      </p>
                      <p className="font-bold text-emerald-950 bg-white p-2.5 rounded-xl border border-emerald-200">
                        📍 Entrega Liberada (RN18): {ride.fullCustomerAddress}
                        <span className="block text-slate-600 mt-0.5">
                          👤 Cliente: {ride.customerName} • <Phone className="w-3 h-3 inline" />{' '}
                          {ride.customerPhone}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {ride.status === 'aceita' && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              const res = updateDeliveryRideStatus(ride.id, 'retirada');
                              notify(res.message);
                            }}
                            className="flex-1 py-2.5 rounded-xl bg-[#166534] text-white text-xs font-extrabold cursor-pointer"
                          >
                            Confirmar Retirada na Loja (RF58)
                          </button>

                          <div className="w-full flex gap-2 pt-1">
                            <input
                              type="text"
                              value={abandonReason}
                              onChange={(e) => setAbandonReason(e.target.value)}
                              placeholder="Motivo para desistir antes da retirada (RF59) *"
                              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const res = abandonDeliveryRide(ride.id, abandonReason);
                                notify(res.message);
                                if (res.success) setAbandonReason('');
                              }}
                              className="px-3 py-2 rounded-xl bg-red-100 text-red-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Desistir
                            </button>
                          </div>
                        </>
                      )}

                      {ride.status === 'retirada' && (
                        <button
                          type="button"
                          onClick={() => {
                            const res = updateDeliveryRideStatus(ride.id, 'entregue');
                            notify(res.message);
                          }}
                          className="w-full py-3 rounded-xl bg-[#1E7E3E] text-white text-xs font-extrabold cursor-pointer"
                        >
                          ✅ Confirmar Entrega ao Cliente (+{formatBRL(ride.driverPayout)})
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Fila de Corridas Disponíveis (RN18: mostra APENAS os bairros e o valor antes de aceitar!) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Fila de Corridas Disponíveis (RF55 / RF56)
                </h2>
                <span className="text-[11px] text-slate-500">
                  Primeiro a aceitar leva
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                <Lock className="w-4 h-4 shrink-0" />
                <span>
                  <strong>Privacidade RN18:</strong> Antes de aceitar, você vê apenas os{' '}
                  <strong>bairros</strong> de retirada e entrega. O endereço completo e o
                  telefone do cliente só aparecem após o aceite.
                </span>
              </div>

              {availableRidesQueue.length === 0 ? (
                <div className="p-8 text-center rounded-3xl border border-slate-200 text-xs text-slate-500">
                  Nenhuma corrida aguardando na fila neste instante.
                </div>
              ) : (
                availableRidesQueue.map((ride) => (
                  <div
                    key={ride.id}
                    className="p-4 rounded-3xl border border-slate-200 bg-white shadow-2xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-900">
                        🏪 {ride.establishmentName} (Pedido #{ride.orderNumber})
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-[#166534] text-xs font-extrabold">
                        Ganho: {formatBRL(ride.driverPayout)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">
                          Bairro de Retirada
                        </span>
                        <strong className="text-slate-800 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-[#166534]" />
                          {ride.pickupNeighborhood}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">
                          Bairro de Entrega
                        </span>
                        <strong className="text-slate-800 flex items-center gap-1">
                          <Navigation className="w-3.5 h-3.5 text-[#166534]" />
                          {ride.dropoffNeighborhood}
                        </strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const res = acceptDeliveryRide(ride.id, currentDriver.id);
                        notify(res.message);
                      }}
                      className="w-full py-2.5 rounded-xl bg-[#166534] hover:bg-[#14532d] text-white text-xs font-extrabold cursor-pointer"
                    >
                      Aceitar Corrida ({formatBRL(ride.driverPayout)})
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* Extrato Quinzenal do Entregador (RF61) */}
        {activeTab === 'historico' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-[#E8F5EC] border border-emerald-200">
                <span className="text-[11px] font-bold text-emerald-900">
                  A Receber na Quinzena
                </span>
                <p className="text-xl font-extrabold text-[#166534] mt-1">
                  {formatBRL(
                    completedDriverRides
                      .filter((r) => !r.payoutSettled)
                      .reduce((acc, r) => acc + r.driverPayout, 0)
                  )}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500">
                  Total Já Recebido via Pix
                </span>
                <p className="text-xl font-extrabold text-slate-900 mt-1">
                  {formatBRL(
                    completedDriverRides
                      .filter((r) => r.payoutSettled)
                      .reduce((acc, r) => acc + r.driverPayout, 0)
                  )}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-extrabold uppercase text-slate-600">
                Histórico de Corridas Entregues ({completedDriverRides.length})
              </h3>
              {completedDriverRides.map((r) => (
                <div
                  key={r.id}
                  className="p-3 rounded-2xl border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-extrabold text-slate-900">
                      Pedido #{r.orderNumber} — {r.establishmentName}
                    </p>
                    <p className="text-slate-500">
                      {r.pickupNeighborhood} ➔ {r.dropoffNeighborhood}
                    </p>
                  </div>
                  <div className="text-right">
                    <strong className="text-[#166534]">
                      +{formatBRL(r.driverPayout)}
                    </strong>
                    <span className="block text-[10px] text-slate-400">
                      {r.payoutSettled ? 'Pago via Pix' : 'Pendente Quinzena'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cadastro de Entregador (RF53) */}
        {activeTab === 'cadastro' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const res = registerDriver({
                name: regName,
                email: regEmail,
                phone: regPhone,
                vehicle: regVehicle,
                pixKey: regPix,
                password: regPassword,
              });
              notify(res.message);
            }}
            className="space-y-3 bg-slate-50 p-4 rounded-3xl border border-slate-200"
          >
            <h2 className="text-sm font-extrabold text-slate-900">
              Cadastro de Entregador Parceiro (RF53)
            </h2>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nome completo <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Carlos Motoboy"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs"
              />
            </div>

            <MaskedInput
              label="E-mail"
              required
              mask="email"
              value={regEmail}
              onChange={setRegEmail}
              placeholder="entregador@email.com"
            />

            <MaskedInput
              label="Telefone / WhatsApp"
              required
              mask="phone"
              value={regPhone}
              onChange={(val) => setRegPhone(formatPhone(val))}
              placeholder="(31) 99999-9999"
            />

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tipo de Veículo <span className="text-red-600">*</span>
              </label>
              <select
                value={regVehicle}
                onChange={(e) => setRegVehicle(e.target.value as VehicleType)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold"
              >
                <option value="moto">Veículo: Moto</option>
                <option value="bicicleta">Veículo: Bicicleta</option>
                <option value="carro">Veículo: Carro</option>
              </select>
            </div>

            <MaskedInput
              label={`Chave Pix para Repasses (Valor variável • ${formatBRL(settings.driverPayoutAmount)}/corrida)`}
              required
              mask="pix"
              pixKeyType="documento"
              value={regPix}
              onChange={setRegPix}
              placeholder="CPF, CNPJ, celular ou chave aleatória *"
            />

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Senha (mín. 8 caracteres com letras e números) <span className="text-red-600">*</span>
              </label>
              <input
                type="password"
                placeholder="Ex: Trem2026"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[#166534] text-white text-xs font-extrabold cursor-pointer"
            >
              Enviar Cadastro para Aprovação (RF53)
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
