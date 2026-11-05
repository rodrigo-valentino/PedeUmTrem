import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  FileText,
  Heart,
  Home,
  LayoutGrid,
  MapPin,
  MessageCircle,
  Minus,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Trash2,
  User,
  UtensilsCrossed,
  Wine,
  X,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CustomerAddress, Establishment, Order, PaymentMethod } from '../types';
import { BrandLogo, HeroBagIllustration } from './BrandLogo';
import { CepAddressFields } from './forms/CepAddressFields';
import { CurrencyInput } from './forms/CurrencyInput';
import { formatBRL, parseBRLString, roundMoney } from '../utils/currency';
import {
  formatCEP,
  formatPhone,
  lookupAddressByCEP,
} from '../utils/validation';
import { buildOrderWhatsAppSummary, getOrderWhatsAppUrl } from '../utils/whatsapp';

type CustomerTab = 'inicio' | 'pedidos' | 'favoritos' | 'perfil' | 'estabelecimento' | 'checkout';

const CHECKOUT_DRAFT_KEY = 'pedeumtrem_checkout_draft_v1';

export const CustomerView: React.FC = () => {
  const {
    currentUser,
    loginWithPassword,
    loginWithGoogle,
    registerCustomer,
    logout,
    establishments,
    menuCategories,
    products,
    addresses,
    orders,
    rides,
    favorites,
    toggleFavorite,
    cart,
    cartEstablishment,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    cartSubtotal,
    saveCustomerAddress,
    placeOrder,
    cancelOrderByCustomer,
    settings,
  } = useApp();

  const [activeTab, setActiveTab] = useState<CustomerTab>('inicio');
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>('todas');
  const [showMoreCategories, setShowMoreCategories] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [bannerSlide, setBannerSlide] = useState(0);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal de resumo do WhatsApp (RF19)
  const [whatsAppPreviewOrder, setWhatsAppPreviewOrder] = useState<Order | null>(null);
  const [copiedPixOrderId, setCopiedPixOrderId] = useState<string | null>(null);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [isEditingAddressInModal, setIsEditingAddressInModal] = useState(false);
  const [editingAddrId, setEditingAddrId] = useState<string | undefined>(undefined);
  const [modalAddrLabel, setModalAddrLabel] = useState<string>('Casa');
  const [modalAddrCep, setModalAddrCep] = useState<string>('');
  const [modalAddrStreet, setModalAddrStreet] = useState<string>('');
  const [modalAddrNumber, setModalAddrNumber] = useState<string>('');
  const [modalAddrNeighborhood, setModalAddrNeighborhood] = useState<string>('');
  const [modalAddrComplement, setModalAddrComplement] = useState<string>('');
  const [modalAddrReference, setModalAddrReference] = useState<string>('');
  const [modalAddrError, setModalAddrError] = useState<string>('');

  // Rascunho persistente do Checkout para estabilidade de sessão (RNF11)
  const savedDraft = useMemo(() => {
    try {
      const raw = localStorage.getItem(CHECKOUT_DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const customerAddresses = useMemo(
    () => addresses.filter((a) => a.customerId === currentUser?.id),
    [addresses, currentUser]
  );
  const defaultAddress =
    customerAddresses.find((a) => a.isDefault) || customerAddresses[0] || null;

  const [cep, setCep] = useState<string>(savedDraft?.cep ?? defaultAddress?.cep ?? '30140-071');
  const [street, setStreet] = useState<string>(
    savedDraft?.street ?? defaultAddress?.street ?? 'Avenida Brasil'
  );
  const [number, setNumber] = useState<string>(
    savedDraft?.number ?? defaultAddress?.number ?? '1420'
  );
  const [neighborhood, setNeighborhood] = useState<string>(
    savedDraft?.neighborhood ?? defaultAddress?.neighborhood ?? 'Funcionários'
  );
  const [complement, setComplement] = useState<string>(
    savedDraft?.complement ?? defaultAddress?.complement ?? 'Apto 302'
  );
  const [referencePoint, setReferencePoint] = useState<string>(
    savedDraft?.referencePoint ?? defaultAddress?.referencePoint ?? 'Próximo à Praça'
  );
  const [contactPhone, setContactPhone] = useState<string>(
    savedDraft?.contactPhone ?? currentUser?.phone ?? '(31) 99876-5432'
  );
  const [orderNotes, setOrderNotes] = useState<string>(savedDraft?.orderNotes ?? '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    savedDraft?.paymentMethod ?? 'pix'
  );
  const [needsChange, setNeedsChange] = useState<boolean>(savedDraft?.needsChange ?? true);
  const [changeForInput, setChangeForInput] = useState<string>(
    savedDraft?.changeForInput ?? '100,00'
  );
  const [cepStatusMsg, setCepStatusMsg] = useState<string>('');
  const [checkoutError, setCheckoutError] = useState<string>('');
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => `idem-${Date.now()}`);

  // Salva rascunho automaticamente (RNF11)
  useEffect(() => {
    try {
      localStorage.setItem(
        CHECKOUT_DRAFT_KEY,
        JSON.stringify({
          cep,
          street,
          number,
          neighborhood,
          complement,
          referencePoint,
          contactPhone,
          orderNotes,
          paymentMethod,
          needsChange,
          changeForInput,
        })
      );
    } catch {
      // ignore
    }
  }, [
    cep,
    street,
    number,
    neighborhood,
    complement,
    referencePoint,
    contactPhone,
    orderNotes,
    paymentMethod,
    needsChange,
    changeForInput,
  ]);

  // Estado de Login / Cadastro na aba Perfil
  const [authMode, setAuthMode] = useState<'login' | 'cadastro'>('login');
  const [loginEmail, setLoginEmail] = useState('cliente@pedeumtrem.com.br');
  const [loginPassword, setLoginPassword] = useState('Trem2026');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [authMessage, setAuthMessage] = useState<{
    type: 'error' | 'success';
    field?: string;
    text: string;
  } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3800);
  };

  // Apenas estabelecimentos aprovados pelo administrador aparecem publicamente (RF02, Decisão Seção 3)
  const publicEstablishments = useMemo(
    () => establishments.filter((e) => e.approvalStatus === 'ativo'),
    [establishments]
  );

  const filteredEstablishments = useMemo(() => {
    return publicEstablishments.filter((store) => {
      if (selectedCategorySlug !== 'todas') {
        const catMatch =
          store.categoryId.includes(selectedCategorySlug) ||
          store.categoryName.toLowerCase().includes(selectedCategorySlug);
        if (!catMatch) return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const nameMatch =
        store.name.toLowerCase().includes(q) ||
        store.categoryName.toLowerCase().includes(q) ||
        store.description.toLowerCase().includes(q);

      const storeProductsMatch = products.some(
        (p) =>
          p.establishmentId === store.id &&
          (p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
      );

      return nameMatch || storeProductsMatch;
    });
  }, [publicEstablishments, selectedCategorySlug, searchQuery, products]);

  const searchedProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return products.filter((p) => {
      const store = publicEstablishments.find((e) => e.id === p.establishmentId);
      if (!store) return false;
      return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    });
  }, [searchQuery, products, publicEstablishments]);

  // Lojas em destaque definidas pelo Administrador (ocultadas durante busca por texto para exibir apenas os resultados pesquisados)
  const featuredEstablishments = useMemo(() => {
    if (searchQuery.trim()) return [];
    return publicEstablishments.filter((store) => {
      if (!store.featured) return false;
      if (selectedCategorySlug !== 'todas') {
        return (
          store.categoryId.includes(selectedCategorySlug) ||
          store.categoryName.toLowerCase().includes(selectedCategorySlug)
        );
      }
      return true;
    });
  }, [publicEstablishments, searchQuery, selectedCategorySlug]);

  const selectedStore: Establishment | null = useMemo(
    () => publicEstablishments.find((e) => e.id === selectedStoreId) ?? null,
    [publicEstablishments, selectedStoreId]
  );

  const customerOrders = useMemo(() => {
    if (!currentUser) return orders;
    const own = orders.filter((o) => o.customerId === currentUser.id);
    return (own.length > 0 ? own : orders).slice().reverse();
  }, [orders, currentUser]);

  const openStorefront = (storeId: string) => {
    setSelectedStoreId(storeId);
    setActiveTab('estabelecimento');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // RF10: Consulta automática ViaCEP mantendo os campos editáveis
  const handleCepChange = async (rawValue: string) => {
    const formatted = formatCEP(rawValue);
    setCep(formatted);
    const digits = formatted.replace(/\D/g, '');
    if (digits.length === 8) {
      setCepStatusMsg('Consultando CEP no ViaCEP...');
      const result = await lookupAddressByCEP(digits);
      if (result.success) {
        if (result.street) setStreet(result.street);
        if (result.neighborhood) setNeighborhood(result.neighborhood);
        setCepStatusMsg(
          result.city
            ? `✓ Endereço preenchido via ViaCEP (${result.city}) — campos editáveis.`
            : result.message || '✓ CEP localizado (campos permanecem editáveis).'
        );
      } else {
        setCepStatusMsg(
          result.message || 'CEP não localizado. Preencha Rua e Bairro manualmente.'
        );
      }
    } else {
      setCepStatusMsg('');
    }
  };

  const applySavedAddress = (addr: CustomerAddress) => {
    setCep(addr.cep);
    setStreet(addr.street);
    setNumber(addr.number);
    setNeighborhood(addr.neighborhood);
    setComplement(addr.complement || '');
    setReferencePoint(addr.referencePoint || '');
    setIsEditingAddressInModal(false);
    setAddressModalOpen(false);
    showToast(
      'success',
      addr.legacyFullAddress
        ? 'Endereço antigo carregado com compatibilidade retroativa!'
        : `Endereço "${addr.label}" selecionado!`
    );
  };

  const openNewAddressForm = () => {
    setEditingAddrId(undefined);
    setModalAddrLabel('Casa');
    setModalAddrCep('');
    setModalAddrStreet('');
    setModalAddrNumber('');
    setModalAddrNeighborhood('');
    setModalAddrComplement('');
    setModalAddrReference('');
    setModalAddrError('');
    setIsEditingAddressInModal(true);
    setAddressModalOpen(true);
  };

  const openEditAddressForm = (addr: CustomerAddress) => {
    setEditingAddrId(addr.id);
    setModalAddrLabel(addr.label || 'Casa');
    setModalAddrCep(addr.cep);
    setModalAddrStreet(addr.street);
    setModalAddrNumber(addr.number);
    setModalAddrNeighborhood(addr.neighborhood);
    setModalAddrComplement(addr.complement || '');
    setModalAddrReference(addr.referencePoint || '');
    setModalAddrError('');
    setIsEditingAddressInModal(true);
    setAddressModalOpen(true);
  };

  const handleSaveAddressFromModal = (e: React.FormEvent) => {
    e.preventDefault();
    setModalAddrError('');

    const res = saveCustomerAddress({
      id: editingAddrId,
      label: modalAddrLabel.trim() || 'Casa',
      cep: modalAddrCep,
      street: modalAddrStreet,
      number: modalAddrNumber,
      neighborhood: modalAddrNeighborhood,
      complement: modalAddrComplement,
      referencePoint: modalAddrReference,
      isDefault: true,
    });

    if (!res.success || !res.data) {
      setModalAddrError(res.message);
      return;
    }

    // Atualiza também o endereço ativo para entrega sem redirecionar para o carrinho
    setCep(res.data.cep);
    setStreet(res.data.street);
    setNumber(res.data.number);
    setNeighborhood(res.data.neighborhood);
    setComplement(res.data.complement || '');
    setReferencePoint(res.data.referencePoint || '');
    setIsEditingAddressInModal(false);
    setAddressModalOpen(false);
    showToast('success', `Endereço "${res.data.label}" salvo e definido para entrega!`);
  };

  const handleConfirmOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError('');

    const addrRes = saveCustomerAddress({
      label: 'Entrega Atual',
      cep,
      street,
      number,
      neighborhood,
      complement,
      referencePoint,
      isDefault: true,
    });

    if (!addrRes.success || !addrRes.data) {
      setCheckoutError(addrRes.message);
      return;
    }

    const parsedChangeFor = parseBRLString(changeForInput);
    const orderRes = placeOrder({
      idempotencyKey,
      address: addrRes.data,
      phone: contactPhone,
      notes: orderNotes,
      paymentMethod,
      needsChange,
      changeFor: needsChange ? parsedChangeFor : undefined,
    });

    if (!orderRes.success || !orderRes.data) {
      setCheckoutError(orderRes.message);
      return;
    }

    setIdempotencyKey(`idem-${Date.now()}`);
    showToast('success', orderRes.message);
    setActiveTab('pedidos');
  };

  const copyPixKey = (order: Order) => {
    navigator.clipboard?.writeText(order.establishmentPixKey);
    setCopiedPixOrderId(order.id);
    setTimeout(() => setCopiedPixOrderId(null), 2500);
  };

  const cartItemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const currentDeliveryFee = cartEstablishment
    ? cartEstablishment.deliveryMode === 'plataforma'
      ? settings.platformDeliveryFee
      : cartEstablishment.deliveryFee
    : 0;
  const currentOrderTotal = roundMoney(cartSubtotal + currentDeliveryFee);

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen shadow-xl border-x border-slate-200/80 pb-28 relative">
      {/* Notificação Flutuante */}
      {toast && (
        <div
          className={`fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-lg text-xs font-bold flex items-center gap-2 max-w-sm w-[92%] animate-in fade-in slide-in-from-top-3 ${
            toast.type === 'success'
              ? 'bg-[#166534] text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* =====================================================================
          ABA 1: INÍCIO (Seguindo fielmente Modelo_App.png)
      ===================================================================== */}
      {activeTab === 'inicio' && (
        <div className="px-4 pt-4 pb-6 space-y-5">
          {/* Top Bar: Sacola + PedeUmTrem + Sino */}
          <div className="flex items-center justify-between pt-1">
            <div className="w-8" />
            <BrandLogo size="md" />
            <button
              onClick={() => setActiveTab('pedidos')}
              className="relative p-2 rounded-full text-slate-800 hover:bg-slate-100 transition"
              title="Meus Pedidos e Notificações"
            >
              <Bell className="w-6 h-6 stroke-[2.2]" />
              {customerOrders.some(
                (o) => !['concluido', 'recusado', 'cancelado'].includes(o.status)
              ) && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#1E7E3E] ring-2 ring-white" />
              )}
            </button>
          </div>

          {/* Seletor de Localização: Entregar em / Minha localização v */}
          <button
            onClick={() => setAddressModalOpen(true)}
            className="flex items-center gap-2.5 text-left group w-full py-1"
          >
            <div className="w-8 h-8 rounded-full bg-[#E8F5EC] flex items-center justify-center text-[#166534] shrink-0">
              <MapPin className="w-5 h-5 fill-[#166534] text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500 font-medium leading-none mb-0.5">
                Entregar em
              </p>
              <div className="flex items-center gap-1">
                <span className="text-[15px] font-extrabold text-slate-900 truncate">
                  {street ? `${street}, ${number} (${neighborhood})` : 'Minha localização'}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-700 shrink-0 group-hover:translate-y-0.5 transition" />
              </div>
            </div>
          </button>

          {/* Barra de Busca em Pílula: "Buscar lojas, produtos ou pratos" */}
          <div className="relative">
            <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar lojas, produtos ou pratos"
              className="w-full pl-12 pr-10 py-3.5 rounded-full bg-[#F4F6F5] border border-slate-200/80 text-sm text-slate-800 placeholder:text-slate-500 font-medium shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#166534] focus:bg-white transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* 5 Cards de Categorias (Restaurantes, Mercados, Bebidas, Farmácias, Mais) */}
          <div className="space-y-2.5">
            <div className="grid grid-cols-5 gap-2">
              {[
                {
                  slug: 'restaurantes',
                  label: 'Restaurantes',
                  renderIcon: () => (
                    <svg className="w-7 h-7 text-[#166534]" viewBox="0 0 28 28" fill="none">
                      <path
                        d="M5 19C5 14.0294 9.02944 10 14 10C18.9706 10 23 14.0294 23 19H5Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                      <path d="M14 7V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M3 22H25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  ),
                },
                {
                  slug: 'mercados',
                  label: 'Mercados',
                  renderIcon: () => <ShoppingCart className="w-6 h-6 text-[#166534]" />,
                },
                {
                  slug: 'bebidas',
                  label: 'Bebidas',
                  renderIcon: () => <Wine className="w-6 h-6 text-[#166534]" />,
                },
                {
                  slug: 'farmacias',
                  label: 'Farmácias',
                  renderIcon: () => (
                    <svg className="w-6 h-6 text-[#166534]" viewBox="0 0 24 24" fill="none">
                      <rect
                        x="3"
                        y="3"
                        width="18"
                        height="18"
                        rx="4"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M12 8V16M8 12H16"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                    </svg>
                  ),
                },
                {
                  slug: 'mais',
                  label: 'Mais',
                  renderIcon: () => <LayoutGrid className="w-6 h-6 text-[#166534]" />,
                },
              ].map((cat) => {
                const isSelected =
                  (cat.slug === 'mais' && showMoreCategories) ||
                  selectedCategorySlug === cat.slug;
                return (
                  <button
                    key={cat.slug}
                    onClick={() => {
                      if (cat.slug === 'mais') {
                        setShowMoreCategories((prev) => !prev);
                      } else {
                        setSelectedCategorySlug((prev) =>
                          prev === cat.slug ? 'todas' : cat.slug
                        );
                      }
                    }}
                    className={`flex flex-col items-center justify-center py-3 px-1 rounded-2xl transition border ${
                      isSelected
                        ? 'bg-[#D3EBD9] border-[#166534] shadow-xs'
                        : 'bg-[#E8F5EC] border-transparent hover:bg-[#DCF0E2]'
                    }`}
                  >
                    <div className="mb-1.5">{cat.renderIcon()}</div>
                    <span className="text-[11px] font-bold text-slate-800 tracking-tight leading-tight">
                      {cat.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Subcategorias extras quando clica em "Mais" */}
            {showMoreCategories && (
              <div className="flex flex-wrap gap-1.5 pt-1 animate-in fade-in duration-150">
                {[
                  { slug: 'todas', label: 'Todas as Categorias' },
                  { slug: 'lanchonete', label: '🍔 Lanchonetes' },
                  { slug: 'pizzaria', label: '🍕 Pizzarias' },
                  { slug: 'acai', label: '🍧 Açaiterias' },
                  { slug: 'churrascaria', label: '🥩 Churrascarias' },
                ].map((sub) => (
                  <button
                    key={sub.slug}
                    onClick={() => setSelectedCategorySlug(sub.slug)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                      selectedCategorySlug === sub.slug
                        ? 'bg-[#166534] text-white'
                        : 'bg-[#E8F5EC] text-[#166534] hover:bg-[#D5ECDD]'
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Banner Promocional Idêntico ao Modelo_App.png (Oculto durante pesquisa por texto) */}
          {!searchQuery.trim() && (
            <div>
              <div className="rounded-3xl bg-gradient-to-br from-[#E2F4E8] via-[#D5EFE0] to-[#BFE6CE] p-5 flex items-center justify-between gap-2 shadow-xs border border-emerald-200/60 relative overflow-hidden">
                <div className="space-y-3.5 z-10 max-w-[62%]">
                  <h2 className="text-[19px] leading-[1.22] font-extrabold text-[#0F2918] tracking-tight">
                    {bannerSlide === 0 && 'Tudo o que você precisa em um só lugar.'}
                    {bannerSlide === 1 && 'Churrasco, burger, pizza ou açaí sem sair de casa.'}
                    {bannerSlide === 2 && 'Pagamento direto por Pix ou na entrega, sem taxas ocultas.'}
                  </h2>
                  <button
                    onClick={() => {
                      if (featuredEstablishments[0]) {
                        openStorefront(featuredEstablishments[0].id);
                      } else if (publicEstablishments[0]) {
                        openStorefront(publicEstablishments[0].id);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#1E7E3E] hover:bg-[#166534] text-white text-xs font-bold shadow-sm transition cursor-pointer"
                  >
                    <span>Pede um trem agora!</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="z-10">
                  <HeroBagIllustration />
                </div>
              </div>

              {/* Indicadores do Carrossel (● • •) */}
              <div className="flex items-center justify-center gap-1.5 mt-2.5">
                {[0, 1, 2].map((idx) => (
                  <button
                    key={idx}
                    onClick={() => setBannerSlide(idx)}
                    aria-label={`Slide ${idx + 1}`}
                    className={`h-2 rounded-full transition-all ${
                      bannerSlide === idx
                        ? 'w-5 bg-[#1E7E3E]'
                        : 'w-2 bg-slate-300 hover:bg-slate-400'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Resultados de Produtos quando há pesquisa por nome de prato (RF04) */}
          {searchQuery.trim() && searchedProducts.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-sm font-extrabold text-slate-800">
                Pratos e Produtos encontrados ({searchedProducts.length})
              </h3>
              <div className="space-y-2">
                {searchedProducts.map((prod) => {
                  const store = publicEstablishments.find(
                    (e) => e.id === prod.establishmentId
                  );
                  return (
                    <div
                      key={prod.id}
                      onClick={() => store && openStorefront(store.id)}
                      className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200/80 cursor-pointer transition"
                    >
                      <img
                        src={prod.imageUrl}
                        alt={prod.name}
                        className="w-14 h-14 rounded-xl object-cover shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-extrabold text-slate-900 truncate">
                          {prod.name}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {store?.name} • {formatBRL(prod.price)}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-[#166534] shrink-0">
                        Ver loja →
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Seção: Lojas em destaque (Definidas pelo Administrador e ocultadas durante pesquisa) */}
          {!searchQuery.trim() && featuredEstablishments.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[19px] font-extrabold text-slate-900 tracking-tight">
                  Lojas em destaque
                </h2>
                <button
                  onClick={() => setSelectedCategorySlug('todas')}
                  className="inline-flex items-center gap-0.5 text-xs font-semibold text-slate-600 hover:text-[#166534]"
                >
                  <span>Ver todas</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3.5">
                {featuredEstablishments.map((store) => {
                  const isFav = favorites.includes(store.id);
                  return (
                    <div
                      key={store.id}
                      onClick={() => openStorefront(store.id)}
                      className="relative h-44 rounded-3xl overflow-hidden shadow-md cursor-pointer group select-none"
                    >
                      <img
                        src={store.coverUrl}
                        alt={store.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/15" />

                      {/* Badge de Situação se pausado/fechado */}
                      {store.operationStatus !== 'aberto' && (
                        <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-white">
                          {store.operationStatus === 'pausado'
                            ? 'Pedidos Pausados'
                            : 'Fechado'}
                        </span>
                      )}

                      <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3">
                        <div className="flex items-center gap-3.5 min-w-0">
                          {/* Emblema circular da loja */}
                          <div className="w-16 h-16 rounded-full border-2 border-white/90 bg-slate-900 overflow-hidden shrink-0 shadow-lg relative flex items-center justify-center">
                            <img
                              src={store.logoUrl}
                              alt={store.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 text-white">
                            <h3 className="text-xl font-extrabold leading-tight truncate drop-shadow-xs">
                              {store.name}
                            </h3>
                            <p className="text-sm text-slate-200 font-medium truncate">
                              {store.categoryName}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1 text-xs font-semibold text-white/95">
                              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                              <span>{store.rating.toFixed(1).replace('.', ',')}</span>
                              <span>•</span>
                              <span>
                                {store.estimatedTimeMin}–{store.estimatedTimeMax} min
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(store.id);
                          }}
                          className="p-2 rounded-full text-white hover:scale-110 transition"
                          aria-label="Favoritar loja"
                        >
                          <Heart
                            className={`w-6 h-6 ${
                              isFav ? 'fill-red-500 text-red-500' : 'text-white'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Todas as Lojas Aprovadas e Ativas (RF02, RF03, RF06) */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                {searchQuery.trim()
                  ? `Lojas encontradas para "${searchQuery}"`
                  : selectedCategorySlug === 'todas'
                  ? 'Todos os estabelecimentos'
                  : `Filtro: ${selectedCategorySlug}`}
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {filteredEstablishments.length} loja(s)
              </span>
            </div>

            {filteredEstablishments.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                Nenhum estabelecimento encontrado para esta busca.
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredEstablishments.map((store) => {
                const isFav = favorites.includes(store.id);
                const feeLabel =
                  store.deliveryMode === 'plataforma'
                    ? formatBRL(settings.platformDeliveryFee)
                    : formatBRL(store.deliveryFee);

                return (
                  <div
                    key={store.id}
                    onClick={() => openStorefront(store.id)}
                    className="flex items-center gap-3.5 p-3 rounded-2xl bg-white border border-slate-200/80 hover:border-emerald-500/60 shadow-2xs cursor-pointer transition"
                  >
                    <img
                      src={store.logoUrl}
                      alt={store.name}
                      className="w-16 h-16 rounded-2xl object-cover shrink-0 border border-slate-100"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-extrabold text-slate-900 truncate">
                          {store.name}
                        </h4>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            store.operationStatus === 'aberto'
                              ? 'bg-emerald-100 text-emerald-800'
                              : store.operationStatus === 'pausado'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {store.operationStatus}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {store.categoryName} • {store.openingHours}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs font-semibold text-slate-700">
                        <span className="inline-flex items-center gap-0.5 text-amber-600 font-bold">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          {store.rating.toFixed(1).replace('.', ',')}
                        </span>
                        <span>•</span>
                        <span>
                          {store.estimatedTimeMin}–{store.estimatedTimeMax} min
                        </span>
                        <span>•</span>
                        <span className="text-[#166534] font-bold">
                          Entrega {feeLabel}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(store.id);
                      }}
                      className="p-2 text-slate-400 hover:text-red-500"
                    >
                      <Heart
                        className={`w-5 h-5 ${
                          isFav ? 'fill-red-500 text-red-500' : ''
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          ABA ESTABELECIMENTO: Cardápio com Destaques 3x2 e Ordem Manual (RF05, RF23, RF27)
      ===================================================================== */}
      {activeTab === 'estabelecimento' && selectedStore && (
        <div className="pb-10">
          {/* Capa 16:9 */}
          <div className="relative h-48 w-full">
            <img
              src={selectedStore.coverUrl}
              alt={selectedStore.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/30" />
            <button
              onClick={() => setActiveTab('inicio')}
              className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow-md hover:bg-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => toggleFavorite(selectedStore.id)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow-md hover:bg-white"
            >
              <Heart
                className={`w-5 h-5 ${
                  favorites.includes(selectedStore.id)
                    ? 'fill-red-500 text-red-500'
                    : 'text-slate-700'
                }`}
              />
            </button>

            <div className="absolute bottom-3 left-4 right-4 flex items-end gap-3 text-white">
              <img
                src={selectedStore.logoUrl}
                alt={selectedStore.name}
                className="w-16 h-16 rounded-2xl border-2 border-white object-cover shadow-md"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-extrabold truncate">{selectedStore.name}</h1>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      selectedStore.operationStatus === 'aberto'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-amber-500 text-white'
                    }`}
                  >
                    {selectedStore.operationStatus}
                  </span>
                </div>
                <p className="text-xs text-slate-200 truncate">
                  {selectedStore.categoryName} • {selectedStore.openingHours}
                </p>
              </div>
            </div>
          </div>

          {/* Dados operacionais e Contato da Loja (RF06, RF16) */}
          <div className="px-4 py-3.5 bg-[#F4F8F5] border-b border-slate-200 space-y-2 text-xs">
            <p className="text-slate-700 leading-relaxed">{selectedStore.description}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600 font-medium">
              <span className="inline-flex items-center gap-1 text-slate-900 font-bold">
                <Clock className="w-3.5 h-3.5 text-[#166534]" />
                {selectedStore.estimatedTimeMin}–{selectedStore.estimatedTimeMax} min
              </span>
              <span>
                🛵 Taxa:{' '}
                <strong className="text-[#166534]">
                  {selectedStore.deliveryMode === 'plataforma'
                    ? `${formatBRL(settings.platformDeliveryFee)} (Entregador Parceiro)`
                    : formatBRL(selectedStore.deliveryFee)}
                </strong>
              </span>
              <span>📍 Área: {selectedStore.serviceArea}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/80 text-[11px] text-slate-600">
              <span className="inline-flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-[#166534]" />
                {selectedStore.phone} • {selectedStore.address}
              </span>
              <a
                href={`https://wa.me/55${selectedStore.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-bold text-[#166534] hover:underline"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Contato WhatsApp
              </a>
            </div>
          </div>

          <div className="p-4 space-y-6">
            {/* RF05 / RF27 / RN13: Produtos em Destaque no topo do cardápio em grade 3 colunas x 2 linhas (até 6 itens) */}
            {(() => {
              const storeFeatured = products
                .filter((p) => p.establishmentId === selectedStore.id && p.isFeatured)
                .slice(0, 6);

              if (storeFeatured.length === 0) return null;

              return (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      Destaques da Casa (Grade 3x2)
                    </h2>
                    <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                      {storeFeatured.length}/6 destaques
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    {storeFeatured.map((prod) => (
                      <div
                        key={prod.id}
                        className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs flex flex-col justify-between"
                      >
                        <div>
                          <div className="relative h-24 w-full bg-slate-100">
                            <img
                              src={prod.imageUrl}
                              alt={prod.name}
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute top-1.5 left-1.5 bg-amber-400 text-slate-950 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md">
                              ★ TOP
                            </span>
                          </div>
                          <div className="p-2">
                            <h3 className="text-[11px] font-bold text-slate-900 line-clamp-2 leading-tight">
                              {prod.name}
                            </h3>
                          </div>
                        </div>

                        <div className="px-2 pb-2 pt-1 flex items-center justify-between gap-1">
                          <span className="text-xs font-extrabold text-[#166534]">
                            {formatBRL(prod.price)}
                          </span>
                          <button
                            disabled={!prod.available}
                            onClick={() => {
                              const res = addToCart(prod, 1);
                              showToast(res.success ? 'success' : 'error', res.message);
                            }}
                            className={`w-7 h-7 rounded-xl flex items-center justify-center transition ${
                              prod.available
                                ? 'bg-[#166534] text-white hover:bg-[#14532d]'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                            title="Adicionar ao carrinho"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* RF05 / RF23: Categorias de cardápio na ordem manual definida pelo lojista (nunca alfabética) */}
            {menuCategories
              .filter((c) => c.establishmentId === selectedStore.id)
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((cat) => {
                const catProducts = products
                  .filter(
                    (p) =>
                      p.establishmentId === selectedStore.id && p.categoryId === cat.id
                  )
                  .sort((a, b) => a.sortOrder - b.sortOrder);

                if (catProducts.length === 0) return null;

                return (
                  <div key={cat.id} className="space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <h3 className="text-base font-extrabold text-slate-900">
                        {cat.name}
                      </h3>
                      <span className="text-[11px] text-slate-400 font-medium">
                        Ordem #{cat.sortOrder}
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {catProducts.map((prod) => (
                        <div
                          key={prod.id}
                          className={`flex items-center justify-between gap-3 p-3 rounded-2xl border transition ${
                            prod.available
                              ? 'bg-white border-slate-200/80 hover:border-emerald-600/40'
                              : 'bg-slate-50 border-slate-200 opacity-65'
                          }`}
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-sm font-extrabold text-slate-900">
                                {prod.name}
                              </h4>
                              {!prod.available && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                                  Indisponível
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                              {prod.description}
                            </p>
                            <div className="flex items-center gap-1.5 pt-0.5">
                              {prod.originalPrice && prod.originalPrice > prod.price && (
                                <span className="text-xs text-slate-400 line-through">
                                  {formatBRL(prod.originalPrice)}
                                </span>
                              )}
                              <p className="text-sm font-extrabold text-[#166534]">
                                {formatBRL(prod.price)}
                              </p>
                              {prod.discountPercent && prod.discountPercent > 0 ? (
                                <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-extrabold">
                                  -{prod.discountPercent}%
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="relative shrink-0">
                            <img
                              src={prod.imageUrl}
                              alt={prod.name}
                              className="w-20 h-20 rounded-2xl object-cover border border-slate-100"
                            />
                            <button
                              disabled={!prod.available}
                              onClick={() => {
                                const res = addToCart(prod, 1);
                                showToast(res.success ? 'success' : 'error', res.message);
                              }}
                              className={`absolute -bottom-2 right-1 px-2.5 py-1 rounded-xl text-xs font-extrabold shadow-md flex items-center gap-1 transition ${
                                prod.available
                                  ? 'bg-[#166534] text-white hover:bg-[#14532d]'
                                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Adicionar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* =====================================================================
          ABA CHECKOUT E CARRINHO (RF07 a RF13 — Endereço ViaCEP + Troco + Resumo)
      ===================================================================== */}
      {activeTab === 'checkout' && (
        <div className="p-4 space-y-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                selectedStoreId ? setActiveTab('estabelecimento') : setActiveTab('inicio')
              }
              className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900">
                Carrinho e Finalização
              </h1>
              <p className="text-xs text-slate-500">
                {cartEstablishment
                  ? `Pedido em ${cartEstablishment.name}`
                  : 'Revise seus itens e informe a entrega'}
              </p>
            </div>
          </div>

          {cart.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-16 h-16 rounded-full bg-[#E8F5EC] text-[#166534] flex items-center justify-center mx-auto">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <h2 className="text-base font-bold text-slate-800">
                Seu carrinho está vazio
              </h2>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Explore os estabelecimentos da sua cidade e adicione produtos deliciosos.
              </p>
              <button
                onClick={() => setActiveTab('inicio')}
                className="px-5 py-2.5 rounded-full bg-[#166534] text-white text-xs font-bold"
              >
                Explorar Restaurantes
              </button>
            </div>
          ) : (
            <form onSubmit={handleConfirmOrder} className="space-y-5">
              {/* 1. Itens do Carrinho (RF07) */}
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    1. Itens Selecionados ({cartItemsCount})
                  </h2>
                  <button
                    type="button"
                    onClick={() =>
                      cartEstablishment && openStorefront(cartEstablishment.id)
                    }
                    className="text-xs font-bold text-[#166534] hover:underline"
                  >
                    + Adicionar mais itens
                  </button>
                </div>

                <div className="space-y-2.5">
                  {cart.map((item) => (
                    <div
                      key={item.productId}
                      className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200/70"
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.productName}
                        className="w-12 h-12 rounded-lg object-cover shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {item.productName}
                        </p>
                        <p className="text-xs font-extrabold text-[#166534]">
                          {formatBRL(item.unitPrice * item.quantity)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1">
                        <button
                          type="button"
                          onClick={() =>
                            updateCartQuantity(item.productId, item.quantity - 1)
                          }
                          className="w-6 h-6 rounded-lg bg-white text-slate-700 flex items-center justify-center shadow-2xs"
                        >
                          {item.quantity === 1 ? (
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          ) : (
                            <Minus className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <span className="w-5 text-center text-xs font-extrabold">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateCartQuantity(item.productId, item.quantity + 1)
                          }
                          className="w-6 h-6 rounded-lg bg-[#166534] text-white flex items-center justify-center shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Endereço Estruturado com ViaCEP (RF09, RF10) */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    2. Endereço de Entrega (ViaCEP)
                  </h2>
                  {customerAddresses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setAddressModalOpen(true)}
                      className="text-xs font-bold text-[#166534] hover:underline"
                    >
                      Meus endereços ({customerAddresses.length})
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="col-span-1">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      CEP <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={cep}
                      onChange={(e) => handleCepChange(e.target.value)}
                      placeholder="00000-000"
                      maxLength={9}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#166534]"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Rua / Logradouro <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="Ex: Avenida Brasil"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#166534]"
                    />
                  </div>
                </div>

                {cepStatusMsg && (
                  <p className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                    {cepStatusMsg}
                  </p>
                )}

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="col-span-1">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Número <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
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
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      placeholder="Centro"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#166534]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Complemento (opcional)
                    </label>
                    <input
                      type="text"
                      value={complement}
                      onChange={(e) => setComplement(e.target.value)}
                      placeholder="Apto, Bloco, Casa..."
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#166534]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Ponto de Referência (opcional)
                    </label>
                    <input
                      type="text"
                      value={referencePoint}
                      onChange={(e) => setReferencePoint(e.target.value)}
                      placeholder="Próximo à praça..."
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#166534]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Telefone / WhatsApp <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(formatPhone(e.target.value))}
                      placeholder="(31) 99999-9999"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#166534]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Observações do Pedido
                    </label>
                    <input
                      type="text"
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="Ex: Tirar cebola, interfone..."
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#166534]"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Forma de Pagamento (RF11, RN07 — Pix após aceite, Cartão ou Dinheiro com Troco) */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  3. Forma de Pagamento (Direto ao Estabelecimento)
                </h2>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'pix' as PaymentMethod, label: '💠 Pix', sub: 'Chave após aceite' },
                    {
                      id: 'cartao_entrega' as PaymentMethod,
                      label: '💳 Cartão',
                      sub: 'Na entrega',
                    },
                    {
                      id: 'dinheiro_entrega' as PaymentMethod,
                      label: '💵 Dinheiro',
                      sub: 'Na entrega',
                    },
                  ].map((opt) => {
                    const accepted =
                      cartEstablishment?.acceptedPayments.includes(opt.id) ?? true;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={!accepted}
                        onClick={() => setPaymentMethod(opt.id)}
                        className={`p-2.5 rounded-xl border text-left transition ${
                          !accepted
                            ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-200'
                            : paymentMethod === opt.id
                            ? 'bg-[#E8F5EC] border-[#166534] ring-1 ring-[#166534]'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="text-xs font-extrabold text-slate-900">
                          {opt.label}
                        </div>
                        <div className="text-[10px] text-slate-500">{opt.sub}</div>
                      </button>
                    );
                  })}
                </div>

                {paymentMethod === 'pix' && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 leading-relaxed">
                    <strong>Regra de Segurança Pix (RN07 / RF18):</strong> A chave Pix e o
                    valor exato serão exibidos na tela do pedido assim que o restaurante{' '}
                    <strong>aceitar</strong> o pedido, evitando pagamentos de pedidos que
                    possam ser recusados.
                  </div>
                )}

                {paymentMethod === 'dinheiro_entrega' && (
                  <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        Precisa de troco na entrega? <span className="text-red-600">*</span>
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setNeedsChange(true)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold ${
                            needsChange
                              ? 'bg-[#166534] text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          Sim, preciso
                        </button>
                        <button
                          type="button"
                          onClick={() => setNeedsChange(false)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold ${
                            !needsChange
                              ? 'bg-[#166534] text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          Não preciso
                        </button>
                      </div>
                    </div>

                    {needsChange && (
                      <CurrencyInput
                        label={`Troco para quanto? (mínimo ${formatBRL(currentOrderTotal)})`}
                        required
                        value={changeForInput}
                        onChange={(masked) => setChangeForInput(masked)}
                        minAmount={currentOrderTotal}
                        quickValues={[50, 100, 150, 200]}
                        helperText={
                          parseBRLString(changeForInput) >= currentOrderTotal
                            ? `Troco a receber na entrega: ${formatBRL(
                                roundMoney(parseBRLString(changeForInput) - currentOrderTotal)
                              )}`
                            : undefined
                        }
                      />
                    )}
                  </div>
                )}
              </div>

              {/* 4. Resumo Financeiro do Pedido antes da confirmação (RF08, RF12) */}
              <div className="bg-[#F4F8F5] rounded-2xl p-4 border border-emerald-200 space-y-2 text-xs">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 mb-1">
                  4. Resumo do Pedido (RF12)
                </h2>
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal dos produtos ({cartItemsCount} itens)</span>
                  <span className="font-bold text-slate-800">
                    {formatBRL(cartSubtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>
                    Taxa de entrega ({cartEstablishment?.name})
                  </span>
                  <span className="font-bold text-slate-800">
                    {formatBRL(currentDeliveryFee)}
                  </span>
                </div>
                <div className="border-t border-emerald-200 pt-2 flex justify-between text-sm font-extrabold text-slate-900">
                  <span>Total a pagar</span>
                  <span className="text-[#166534]">{formatBRL(currentOrderTotal)}</span>
                </div>
              </div>

              {checkoutError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
                  {checkoutError}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-[#166534] hover:bg-[#14532d] text-white font-extrabold text-sm shadow-md transition cursor-pointer"
              >
                Confirmar Pedido • {formatBRL(currentOrderTotal)}
              </button>
            </form>
          )}
        </div>
      )}

      {/* =====================================================================
          ABA PEDIDOS: Acompanhamento, Chave Pix após Aceite, Cancelamento RN06 e WhatsApp RF19
      ===================================================================== */}
      {activeTab === 'pedidos' && (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-extrabold text-slate-900">
                Meus Pedidos
              </h1>
              <p className="text-xs text-slate-500">
                Acompanhe o status em tempo real, chave Pix e resumo via WhatsApp
              </p>
            </div>
          </div>

          {customerOrders.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <FileText className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">Nenhum pedido ainda</p>
            </div>
          ) : (
            <div className="space-y-4">
              {customerOrders.map((order) => {
                const canCustomerCancel =
                  order.status === 'aguardando_confirmacao' || order.status === 'aceito';
                const isPreparingOrLater = [
                  'em_preparacao',
                  'pronto_para_entrega',
                  'saiu_para_entrega',
                ].includes(order.status);
                const showPixDetails =
                  order.paymentMethod === 'pix' &&
                  order.status !== 'aguardando_confirmacao' &&
                  order.status !== 'recusado' &&
                  order.status !== 'cancelado';

                const statusBadgeMap: Record<
                  Order['status'],
                  { label: string; color: string }
                > = {
                  aguardando_confirmacao: {
                    label: '⏳ Aguardando confirmação',
                    color: 'bg-amber-100 text-amber-800 border-amber-200',
                  },
                  aceito: {
                    label: '✅ Aceito pelo restaurante',
                    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                  },
                  em_preparacao: {
                    label: '🍳 Em preparação',
                    color: 'bg-blue-100 text-blue-800 border-blue-200',
                  },
                  pronto_para_entrega: {
                    label: '🥡 Pronto para entrega',
                    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
                  },
                  saiu_para_entrega: {
                    label: '🛵 Saiu para entrega',
                    color: 'bg-purple-100 text-purple-800 border-purple-200',
                  },
                  concluido: {
                    label: '🎉 Concluído',
                    color: 'bg-emerald-700 text-white border-emerald-700',
                  },
                  recusado: {
                    label: '❌ Recusado pelo estabelecimento',
                    color: 'bg-red-100 text-red-800 border-red-200',
                  },
                  cancelado: {
                    label: '🚫 Cancelado',
                    color: 'bg-slate-200 text-slate-700 border-slate-300',
                  },
                };

                return (
                  <div
                    key={order.id}
                    className="rounded-3xl border border-slate-200 bg-white p-4 shadow-xs space-y-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-extrabold text-[#166534]">
                          Pedido #{order.orderNumber}
                        </span>
                        <h3 className="text-base font-extrabold text-slate-900">
                          {order.establishmentName}
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          {new Date(order.createdAt).toLocaleString('pt-BR')}
                          {order.prepTimeLabel && ` • Preparo: ${order.prepTimeLabel}`}
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          statusBadgeMap[order.status].color
                        }`}
                      >
                        {statusBadgeMap[order.status].label}
                      </span>
                    </div>

                    {/* Barra de progresso das 6 etapas quando ativo */}
                    {!['recusado', 'cancelado'].includes(order.status) && (
                      <div className="grid grid-cols-6 gap-1 pt-1">
                        {[
                          'aguardando_confirmacao',
                          'aceito',
                          'em_preparacao',
                          'pronto_para_entrega',
                          'saiu_para_entrega',
                          'concluido',
                        ].map((step, idx, arr) => {
                          const currentIdx = arr.indexOf(order.status);
                          const done = idx <= currentIdx;
                          return (
                            <div
                              key={step}
                              className={`h-1.5 rounded-full ${
                                done ? 'bg-[#1E7E3E]' : 'bg-slate-200'
                              }`}
                            />
                          );
                        })}
                      </div>
                    )}

                    {/* Motivo de recusa ou cancelamento (RN04, RN06, RF51) */}
                    {order.rejectionOrCancelReason && (
                      <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
                        <strong>Motivo registrado:</strong> {order.rejectionOrCancelReason}
                      </div>
                    )}

                    {/* RF58: Acompanhamento da corrida do entregador pelo cliente */}
                    {(() => {
                      const activeRide = rides.find(
                        (r) => r.orderId === order.id && r.status !== 'cancelada'
                      );
                      if (!activeRide) return null;

                      const rideLabels = {
                        solicitada: '🛵 Aguardando entregador parceiro aceitar a corrida...',
                        aceita: `🛵 Entregador ${activeRide.driverName || 'parceiro'} aceitou a entrega e está indo retirar na loja`,
                        retirada: `🛵 Pedido retirado por ${activeRide.driverName || 'entregador'} — a caminho do seu endereço!`,
                        entregue: `✅ Entrega realizada por ${activeRide.driverName || 'entregador parceiro'}`,
                        cancelada: 'Corrida cancelada',
                      };

                      return (
                        <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 flex items-center justify-between gap-2">
                          <span className="font-bold">{rideLabels[activeRide.status]}</span>
                          {activeRide.rideType === 'nova_viagem' && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold shrink-0">
                              Nova Viagem (+{formatBRL(activeRide.chargedFee)})
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    {/* RF18 / RN07 / Critério 10: Chave Pix exibida SOMENTE após o aceite */}
                    {order.paymentMethod === 'pix' &&
                      order.status === 'aguardando_confirmacao' && (
                        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                          🔒 <strong>Pagamento via Pix:</strong> A chave Pix e o valor para
                          transferência serão liberados assim que o restaurante aceitar seu
                          pedido (RN07).
                        </div>
                      )}

                    {showPixDetails && (
                      <div className="p-3.5 rounded-2xl bg-[#E8F5EC] border border-[#166534]/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-[#14532d]">
                            💠 Pagamento Pix Liberado (Pedido Aceito)
                          </span>
                          <span className="text-sm font-extrabold text-[#166534]">
                            {formatBRL(order.total)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-emerald-200">
                          <div className="min-w-0">
                            <p className="text-[10px] text-slate-500">
                              Chave Pix do Estabelecimento:
                            </p>
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {order.establishmentPixKey}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyPixKey(order)}
                            className="px-3 py-1.5 rounded-lg bg-[#166534] text-white text-xs font-bold inline-flex items-center gap-1 shrink-0"
                          >
                            {copiedPixOrderId === order.id ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                Copiada!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                Copiar Chave
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Lista de itens e valores congelados (RN10) */}
                    <div className="bg-slate-50 rounded-2xl p-3 space-y-1.5 text-xs">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex justify-between text-slate-700">
                          <span>
                            {item.quantity}x {item.productName}
                          </span>
                          <span className="font-semibold">{formatBRL(item.subtotal)}</span>
                        </div>
                      ))}
                      <div className="border-t border-slate-200/80 pt-1.5 flex justify-between text-slate-500">
                        <span>
                          Subtotal {formatBRL(order.subtotal)} + Entrega{' '}
                          {formatBRL(order.deliveryFee + (order.extraDeliveryFee || 0))}
                        </span>
                        <span className="font-extrabold text-slate-900">
                          Total: {formatBRL(order.total)}
                        </span>
                      </div>
                    </div>

                    {/* Botões de Ação: Acompanhar no WhatsApp (RF19) e Cancelar Pedido (RF17 / RN06) */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setWhatsAppPreviewOrder(order)}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-[#1E7E3E] hover:bg-[#166534] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Acompanhar pedido no WhatsApp
                      </button>

                      {canCustomerCancel && (
                        <button
                          type="button"
                          onClick={() => {
                            const res = cancelOrderByCustomer(
                              order.id,
                              'Cancelado diretamente pelo cliente no app'
                            );
                            showToast(res.success ? 'success' : 'error', res.message);
                          }}
                          className="py-2.5 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold cursor-pointer"
                        >
                          Cancelar Pedido
                        </button>
                      )}

                      {isPreparingOrLater && (
                        <button
                          type="button"
                          onClick={() => {
                            const res = cancelOrderByCustomer(order.id);
                            showToast('error', res.message);
                          }}
                          className="py-2 px-3 rounded-xl bg-slate-100 text-slate-500 border border-slate-200 text-[11px] font-semibold cursor-not-allowed"
                          title="Bloqueado conforme RN06: pedido já entrou em preparação"
                        >
                          🔒 Cancelamento direto bloqueado (Em preparo)
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          ABA FAVORITOS
      ===================================================================== */}
      {activeTab === 'favoritos' && (
        <div className="p-4 space-y-4">
          <h1 className="text-lg font-extrabold text-slate-900">Lojas Favoritas</h1>
          {publicEstablishments.filter((e) => favorites.includes(e.id)).length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Heart className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">
                Você ainda não marcou lojas favoritas
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {publicEstablishments
                .filter((e) => favorites.includes(e.id))
                .map((store) => (
                  <div
                    key={store.id}
                    onClick={() => openStorefront(store.id)}
                    className="flex items-center gap-3.5 p-3 rounded-2xl bg-white border border-slate-200 hover:border-emerald-600 cursor-pointer"
                  >
                    <img
                      src={store.logoUrl}
                      alt={store.name}
                      className="w-14 h-14 rounded-2xl object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-extrabold text-slate-900">
                        {store.name}
                      </h3>
                      <p className="text-xs text-slate-500">{store.categoryName}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          ABA PERFIL / AUTENTICAÇÃO (RF01, RNF04, RNF13 — Validação de Senha e E-mail)
      ===================================================================== */}
      {activeTab === 'perfil' && (
        <div className="p-4 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-extrabold text-slate-900">Minha Conta</h1>
              <p className="text-xs text-slate-500">
                Gerencie seu perfil, autenticação e endereços salvos
              </p>
            </div>
          </div>

          {currentUser && (
            <div className="p-4 rounded-3xl bg-[#E8F5EC] border border-emerald-200 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-[#166534] text-white">
                  Sessão Ativa • {currentUser.role}
                </span>
                <h2 className="text-base font-extrabold text-slate-900 mt-1">
                  {currentUser.firstName} {currentUser.lastName}
                </h2>
                <p className="text-xs text-slate-600 truncate">
                  {currentUser.email} • {currentUser.phone}
                </p>
              </div>
              <button
                onClick={logout}
                className="px-3.5 py-2 rounded-xl bg-white text-red-600 border border-red-200 text-xs font-bold shrink-0 hover:bg-red-50"
              >
                Sair
              </button>
            </div>
          )}

          {/* Gestão direta de Endereços por CEP fora do carrinho */}
          <div className="bg-white rounded-3xl p-4 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#166534]" />
                  Meus Endereços de Entrega (CEP)
                </h2>
                <p className="text-[11px] text-slate-500">
                  Cadastre ou edite seus endereços por CEP a qualquer momento
                </p>
              </div>
              <button
                type="button"
                onClick={openNewAddressForm}
                className="px-3 py-1.5 rounded-xl bg-[#166534] hover:bg-[#14532d] text-white text-xs font-extrabold cursor-pointer"
              >
                + Novo Endereço
              </button>
            </div>

            <div className="space-y-2">
              {customerAddresses.map((addr) => (
                <div
                  key={addr.id}
                  className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-slate-900">{addr.label}</span>
                      <span className="text-[10px] font-bold text-[#166534] bg-emerald-100 px-2 py-0.5 rounded-full">
                        CEP {addr.cep}
                      </span>
                    </div>
                    <p className="text-slate-600 truncate mt-0.5">
                      {addr.street}, nº {addr.number} — {addr.neighborhood}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditAddressForm(addr)}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => applySavedAddress(addr)}
                      className="px-2.5 py-1 rounded-lg bg-[#E8F5EC] text-[#166534] font-bold hover:bg-[#D5ECDD] cursor-pointer"
                    >
                      Usar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Formulário de Cadastro e Login (para testar RF01, RNF04, RNF13 diretamente) */}
          <div className="bg-slate-50 rounded-3xl p-4 border border-slate-200 space-y-4">
            <div className="flex rounded-xl bg-slate-200/80 p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setAuthMessage(null);
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-extrabold transition ${
                  authMode === 'login'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600'
                }`}
              >
                Entrar com E-mail
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('cadastro');
                  setAuthMessage(null);
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-extrabold transition ${
                  authMode === 'cadastro'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600'
                }`}
              >
                Criar Nova Conta (RF01)
              </button>
            </div>

            {authMode === 'login' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const res = loginWithPassword(loginEmail, loginPassword);
                  setAuthMessage({
                    type: res.success ? 'success' : 'error',
                    field: res.field,
                    text: res.message,
                  });
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    E-mail <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Senha <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres (letras e números)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-medium"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-[#166534] text-white text-xs font-extrabold hover:bg-[#14532d]"
                >
                  Entrar com E-mail e Senha
                </button>
              </form>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const res = registerCustomer({
                    firstName: regFirstName,
                    lastName: regLastName,
                    email: regEmail,
                    phone: regPhone,
                    password: regPassword,
                  });
                  setAuthMessage({
                    type: res.success ? 'success' : 'error',
                    field: res.field,
                    text: res.message,
                  });
                }}
                className="space-y-3"
              >
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nome <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={regFirstName}
                      onChange={(e) => setRegFirstName(e.target.value)}
                      placeholder="Ex: João"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Sobrenome <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={regLastName}
                      onChange={(e) => setRegLastName(e.target.value)}
                      placeholder="Ex: Santos"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    E-mail <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="joao@email.com"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Telefone / WhatsApp <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={regPhone}
                    onChange={(e) => setRegPhone(formatPhone(e.target.value))}
                    placeholder="(31) 99888-7766"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Senha (mín. 8 caracteres, ao menos 1 letra e 1 número){' '}
                    <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Ex: Trem2026"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-[#166534] text-white text-xs font-extrabold hover:bg-[#14532d]"
                >
                  Criar Conta de Cliente
                </button>
              </form>
            )}

            {/* Botão Google OAuth sem conflito com cadastro por senha (RF01 / Critério 4) */}
            <div className="pt-1 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  const res = loginWithGoogle(
                    'cliente@pedeumtrem.com.br',
                    'Rodrigo',
                    'Oliveira'
                  );
                  setAuthMessage({
                    type: res.success ? 'success' : 'error',
                    text: res.message,
                  });
                }}
                className="w-full py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center justify-center gap-2"
              >
                <span>G</span>
                <span>Continuar com Google (Sem conflito com senha)</span>
              </button>
            </div>

            {authMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold border ${
                  authMessage.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                {authMessage.field && (
                  <span className="uppercase text-[10px] font-extrabold block mb-0.5">
                    Campo [{authMessage.field}]:
                  </span>
                )}
                {authMessage.text}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          BARRA FLUTUANTE DO CARRINHO (quando há itens)
      ===================================================================== */}
      {cart.length > 0 && activeTab !== 'checkout' && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 max-w-md w-full px-4 z-30">
          <button
            onClick={() => setActiveTab('checkout')}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#166534] hover:bg-[#14532d] text-white shadow-xl flex items-center justify-between transition cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-white/20 text-xs font-extrabold flex items-center justify-center">
                {cartItemsCount}
              </span>
              <div className="text-left">
                <p className="text-xs font-extrabold leading-none">
                  Ver carrinho e finalizar
                </p>
                <p className="text-[10px] text-emerald-100 mt-0.5">
                  {cartEstablishment?.name}
                </p>
              </div>
            </div>
            <span className="text-sm font-extrabold">{formatBRL(cartSubtotal)} →</span>
          </button>
        </div>
      )}

      {/* =====================================================================
          MENU INFERIOR IDÊNTICO AO MODELO_APP.PNG (Início, Pedidos, Favoritos, Perfil)
      ===================================================================== */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 max-w-md w-full bg-white border-t border-slate-200 z-40 grid grid-cols-4">
        {[
          { id: 'inicio' as CustomerTab, label: 'Início', icon: Home },
          { id: 'pedidos' as CustomerTab, label: 'Pedidos', icon: FileText },
          { id: 'favoritos' as CustomerTab, label: 'Favoritos', icon: Heart },
          { id: 'perfil' as CustomerTab, label: 'Perfil', icon: User },
        ].map((item) => {
          const Icon = item.icon;
          const isActive =
            activeTab === item.id ||
            (item.id === 'inicio' &&
              (activeTab === 'estabelecimento' || activeTab === 'checkout'));
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="relative flex flex-col items-center justify-center py-2.5 gap-1 cursor-pointer"
            >
              {isActive && (
                <span className="absolute top-0 inset-x-4 h-0.5 bg-[#1E7E3E] rounded-full" />
              )}
              <Icon
                className={`w-5 h-5 ${
                  isActive ? 'text-[#1E7E3E] stroke-[2.5]' : 'text-slate-500'
                }`}
              />
              <span
                className={`text-[11px] ${
                  isActive ? 'font-extrabold text-[#1E7E3E]' : 'font-medium text-slate-600'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* =====================================================================
          MODAL: RESUMO DO PEDIDO NO WHATSAPP (RF19 / Critério 11)
      ===================================================================== */}
      {whatsAppPreviewOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#166534] flex items-center justify-center">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Resumo do Pedido para WhatsApp (RF19)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Mensagem gerada automaticamente com todos os dados exigidos
                  </p>
                </div>
              </div>
              <button
                onClick={() => setWhatsAppPreviewOrder(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <pre className="p-3.5 rounded-2xl bg-[#E8F5EC] border border-emerald-200 text-xs text-slate-800 whitespace-pre-wrap font-sans leading-relaxed max-h-72 overflow-y-auto">
              {buildOrderWhatsAppSummary(whatsAppPreviewOrder)}
            </pre>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(
                    buildOrderWhatsAppSummary(whatsAppPreviewOrder)
                  );
                  showToast('success', 'Resumo do pedido copiado!');
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Copiar Resumo
              </button>
              <a
                href={getOrderWhatsAppUrl(whatsAppPreviewOrder)}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#1E7E3E] hover:bg-[#166534] text-white text-xs font-extrabold text-center inline-flex items-center justify-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4" />
                Abrir Conversa no WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: SELETOR E CADASTRO DIRETO DE ENDEREÇOS POR CEP FORA DO CARRINHO (RF09, RF10)
      ===================================================================== */}
      {addressModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                {isEditingAddressInModal
                  ? editingAddrId
                    ? 'Editar Endereço por CEP'
                    : 'Cadastrar Novo Endereço por CEP'
                  : 'Meus Endereços de Entrega'}
              </h3>
              <button
                onClick={() => {
                  setIsEditingAddressInModal(false);
                  setAddressModalOpen(false);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!isEditingAddressInModal ? (
              <>
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-600">
                    Selecione um endereço salvo ou cadastre/edite diretamente abaixo:
                  </p>
                  {customerAddresses.map((addr) => (
                    <div
                      key={addr.id}
                      className="w-full p-3 rounded-2xl border border-slate-200 hover:border-[#166534] flex items-center justify-between gap-2 transition"
                    >
                      <button
                        type="button"
                        onClick={() => applySavedAddress(addr)}
                        className="text-left flex-1 min-w-0 space-y-0.5 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-slate-900">
                            {addr.label}
                          </span>
                          <span className="text-[11px] font-bold text-[#166534]">
                            CEP {addr.cep}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 truncate">
                          {addr.street}, nº {addr.number} — {addr.neighborhood}
                        </p>
                        {addr.legacyFullAddress && (
                          <p className="text-[10px] text-amber-700 font-semibold">
                            ⚡ {addr.legacyFullAddress}
                          </p>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditAddressForm(addr)}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold shrink-0 cursor-pointer"
                      >
                        Editar
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={openNewAddressForm}
                  className="w-full py-2.5 rounded-xl bg-[#166534] hover:bg-[#14532d] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Cadastrar Novo Endereço por CEP
                </button>
              </>
            ) : (
              <form onSubmit={handleSaveAddressFromModal} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Identificação do Endereço (Ex: Casa, Trabalho) *
                  </label>
                  <div className="flex gap-1.5 mb-2">
                    {['Casa', 'Trabalho', 'Outro'].map((lbl) => (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => setModalAddrLabel(lbl)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                          modalAddrLabel === lbl
                            ? 'bg-[#166534] text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={modalAddrLabel}
                    onChange={(e) => setModalAddrLabel(e.target.value)}
                    placeholder="Casa, Trabalho..."
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  />
                </div>

                <CepAddressFields
                  value={{
                    cep: modalAddrCep,
                    street: modalAddrStreet,
                    number: modalAddrNumber,
                    neighborhood: modalAddrNeighborhood,
                    complement: modalAddrComplement,
                    referencePoint: modalAddrReference,
                  }}
                  onChange={(next) => {
                    setModalAddrCep(next.cep);
                    setModalAddrStreet(next.street);
                    setModalAddrNumber(next.number);
                    setModalAddrNeighborhood(next.neighborhood);
                    setModalAddrComplement(next.complement || '');
                    setModalAddrReference(next.referencePoint || '');
                  }}
                />

                {modalAddrError && (
                  <p className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-700">
                    {modalAddrError}
                  </p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditingAddressInModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-[#166534] hover:bg-[#14532d] text-white text-xs font-extrabold cursor-pointer"
                  >
                    Salvar Endereço
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
