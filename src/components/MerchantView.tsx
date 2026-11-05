import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BellRing,
  Bike,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  DollarSign,
  Edit3,
  FileSpreadsheet,
  Image as ImageIcon,
  Layers,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  Store,
  Trash2,
  Upload,
  Volume2,
  XCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  DaySchedule,
  DeliveryMode,
  OrderStatus,
  PaymentMethod,
  Product,
  UnitOfMeasure,
} from '../types';
import { formatBRL, formatDecimalInput, parseBRLString } from '../utils/currency';
import {
  CompressedImageResult,
  compressAndConvertToWebP,
  generateSample5MBPngFile,
} from '../utils/imageCompressor';
import {
  playNewOrderSound,
  requestBrowserNotificationPermission,
} from '../utils/sound';
import { AutocompleteInput } from './forms/AutocompleteInput';
import { CepAddressFields } from './forms/CepAddressFields';
import { CurrencyInput } from './forms/CurrencyInput';
import { MaskedInput } from './forms/MaskedInput';
import {
  normalizeSchedules,
  OpeningHoursSelector,
} from './forms/OpeningHoursSelector';
import { PromoPriceCalculator } from './forms/PromoPriceCalculator';
import { QuantityUnitStockSelector } from './forms/QuantityUnitStockSelector';

type MerchantTab = 'pedidos' | 'cardapio' | 'destaques' | 'loja' | 'comissoes';

const PREP_TIME_OPTIONS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '60 min', minutes: 60 },
  { label: '75 min', minutes: 75 },
  { label: '90 min', minutes: 90 },
  { label: '120 min', minutes: 120 },
  { label: '150 min', minutes: 150 },
  { label: '180 min', minutes: 180 },
  { label: 'Mais de 180 min', minutes: 210 },
  { label: 'Personalizado', minutes: 0 },
];

const CATEGORY_SUGGESTIONS = [
  'Lanches',
  'Bebidas',
  'Saladas',
  'Molhos',
  'Acompanhamentos',
  'Pizzas Salgadas',
  'Pizzas Doces',
  'Sobremesas',
  'Porções',
  'Açaí',
];

const BRAND_SUGGESTIONS = [
  'Produção Própria / Artesanal',
  'Coca-Cola',
  'Guaraná Antarctica',
  'Heineken',
  'Ambev',
  'Catupiry Original',
  'Sadia',
  'Seara',
  'Heinz',
];

const NEIGHBORHOOD_SUGGESTIONS = [
  'Centro',
  'Bairro residencial',
  'Zona rural',
  'Todos os bairros',
  'Região norte',
  'Região sul',
  'Região leste',
  'Região oeste',
];

const ORDER_REJECT_SUGGESTIONS = [
  'Item esgotado no turno de hoje',
  'Endereço fora da área de cobertura da loja',
  'Cozinha encerrando expediente',
  'Pedido duplicado pelo cliente',
];

const REPEAT_RIDE_SUGGESTIONS = [
  'Item esquecido na bancada da loja',
  'Bebida faltante no pedido',
  'Complemento adicional solicitado',
];

const PRODUCT_DRAFT_STORAGE_KEY = 'pedeumtrem_merchant_product_draft_v1';

export const MerchantView: React.FC = () => {
  const {
    establishments,
    menuCategories,
    products,
    orders,
    commissions,
    settlements,
    rides,
    settings,
    merchantAudioUnlocked,
    startMerchantShift,
    acceptOrder,
    rejectOrder,
    updateOrderStatus,
    togglePauseEstablishment,
    updateEstablishmentData,
    createMenuCategory,
    moveMenuCategory,
    deleteMenuCategory,
    saveProduct,
    duplicateProduct,
    moveProductOrder,
    toggleProductFeatured,
    toggleProductAvailable,
    deleteProduct,
    requestPlatformDriver,
    resendDriverNotification,
    switchOrderToOwnDelivery,
  } = useApp();

  const [selectedStoreId, setSelectedStoreId] = useState<string>('est-vai-brasa');
  const [activeTab, setActiveTab] = useState<MerchantTab>('pedidos');
  const [orderFilter, setOrderFilter] = useState<'ativos' | 'novos' | 'historico'>('ativos');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
    type: 'product' | 'category';
    id: string;
    name: string;
  } | null>(null);

  // Estado de tempo de preparo e motivos por pedido
  const [prepSelectionByOrder, setPrepSelectionByOrder] = useState<Record<string, string>>({});
  const [customPrepMinutesByOrder, setCustomPrepMinutesByOrder] = useState<
    Record<string, string>
  >({});
  const [reasonInputByOrder, setReasonInputByOrder] = useState<Record<string, string>>({});
  const [repeatRideReasonByOrder, setRepeatRideReasonByOrder] = useState<
    Record<string, string>
  >({});

  // Rascunho salvo automaticamente para o editor de produtos
  const initialProductDraft = useMemo(() => {
    try {
      const raw = localStorage.getItem(PRODUCT_DRAFT_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  // Gestão de Categorias e Produtos
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [prodName, setProdName] = useState<string>(initialProductDraft?.prodName || '');
  const [prodCategoryId, setProdCategoryId] = useState<string>(
    initialProductDraft?.prodCategoryId || ''
  );
  const [prodDescription, setProdDescription] = useState<string>(
    initialProductDraft?.prodDescription || ''
  );
  const [prodPriceInput, setProdPriceInput] = useState<string>(
    initialProductDraft?.prodPriceInput || '12,50'
  );
  const [prodHasPromo, setProdHasPromo] = useState<boolean>(
    initialProductDraft?.prodHasPromo || false
  );
  const [prodOriginalPriceInput, setProdOriginalPriceInput] = useState<string>(
    initialProductDraft?.prodOriginalPriceInput || '15,00'
  );
  const [prodDiscountInput, setProdDiscountInput] = useState<string>(
    initialProductDraft?.prodDiscountInput || '0'
  );
  const [prodUnitOfMeasure, setProdUnitOfMeasure] = useState<UnitOfMeasure>(
    initialProductDraft?.prodUnitOfMeasure || 'un'
  );
  const [prodUnitQuantity, setProdUnitQuantity] = useState<number>(
    initialProductDraft?.prodUnitQuantity || 1
  );
  const [prodTrackStock, setProdTrackStock] = useState<boolean>(
    initialProductDraft?.prodTrackStock || false
  );
  const [prodStockQuantity, setProdStockQuantity] = useState<number>(
    initialProductDraft?.prodStockQuantity ?? 25
  );
  const [prodBrand, setProdBrand] = useState<string>(
    initialProductDraft?.prodBrand || 'Produção Própria / Artesanal'
  );
  const [prodServesPeople, setProdServesPeople] = useState<number>(
    initialProductDraft?.prodServesPeople || 1
  );
  const [prodPrepTimeEstimate, setProdPrepTimeEstimate] = useState<number>(
    initialProductDraft?.prodPrepTimeEstimate || 25
  );
  const [prodRequiresAgeCheck, setProdRequiresAgeCheck] = useState<boolean>(
    initialProductDraft?.prodRequiresAgeCheck || false
  );
  const [prodImageUrl, setProdImageUrl] = useState<string>(
    initialProductDraft?.prodImageUrl || ''
  );
  const [prodAvailable, setProdAvailable] = useState(true);
  const [prodFeatured, setProdFeatured] = useState(false);
  const [compressionStats, setCompressionStats] = useState<CompressedImageResult | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  const currentStore = useMemo(
    () => establishments.find((e) => e.id === selectedStoreId) || establishments[0],
    [establishments, selectedStoreId]
  );

  // Salva rascunho automaticamente enquanto o lojista preenche novo produto
  useEffect(() => {
    if (editingProductId) return;
    try {
      localStorage.setItem(
        PRODUCT_DRAFT_STORAGE_KEY,
        JSON.stringify({
          prodName,
          prodCategoryId,
          prodDescription,
          prodPriceInput,
          prodHasPromo,
          prodOriginalPriceInput,
          prodDiscountInput,
          prodUnitOfMeasure,
          prodUnitQuantity,
          prodTrackStock,
          prodStockQuantity,
          prodBrand,
          prodServesPeople,
          prodPrepTimeEstimate,
          prodRequiresAgeCheck,
          prodImageUrl,
        })
      );
      if (prodName.trim() || prodDescription.trim()) {
        setDraftSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      }
    } catch {
      // ignore storage errors
    }
  }, [
    editingProductId,
    prodName,
    prodCategoryId,
    prodDescription,
    prodPriceInput,
    prodHasPromo,
    prodOriginalPriceInput,
    prodDiscountInput,
    prodUnitOfMeasure,
    prodUnitQuantity,
    prodTrackStock,
    prodStockQuantity,
    prodBrand,
    prodServesPeople,
    prodPrepTimeEstimate,
    prodRequiresAgeCheck,
    prodImageUrl,
  ]);

  // Configurações da Loja
  const [storeDesc, setStoreDesc] = useState(currentStore.description);
  const [storeCep, setStoreCep] = useState(currentStore.cep || '30140-071');
  const [storeStreet, setStoreStreet] = useState(
    currentStore.street || currentStore.address.split(',')[0] || 'Avenida Brasil'
  );
  const [storeNumber, setStoreNumber] = useState(currentStore.number || '1500');
  const [storeComplement, setStoreComplement] = useState(currentStore.complement || '');
  const [storeNeighborhood, setStoreNeighborhood] = useState(
    currentStore.neighborhood || 'Centro'
  );
  const [storeDocument, setStoreDocument] = useState(
    currentStore.documentNumber || '12.345.678/0001-99'
  );
  const [storeAddress, setStoreAddress] = useState(currentStore.address);
  const [storePhone, setStorePhone] = useState(currentStore.phone);
  const [storeWhatsapp, setStoreWhatsapp] = useState(currentStore.whatsapp);
  const [storePixKeyType, setStorePixKeyType] = useState(
    currentStore.pixKeyType || 'CNPJ'
  );
  const [storePixKey, setStorePixKey] = useState(currentStore.pixKey);
  const [storeDeliveryFeeInput, setStoreDeliveryFeeInput] = useState(
    formatDecimalInput(currentStore.deliveryFee)
  );
  const [storeServiceArea, setStoreServiceArea] = useState(currentStore.serviceArea);
  const [storeOpeningHours, setStoreOpeningHours] = useState(currentStore.openingHours);
  const [storeSchedules, setStoreSchedules] = useState<DaySchedule[]>(
    normalizeSchedules(currentStore.schedules)
  );
  const [storeDeliveryMode, setStoreDeliveryMode] = useState<DeliveryMode>(
    currentStore.deliveryMode
  );
  const [storeAcceptedPayments, setStoreAcceptedPayments] = useState<PaymentMethod[]>(
    currentStore.acceptedPayments
  );
  const [coverCompressionStats, setCoverCompressionStats] =
    useState<CompressedImageResult | null>(null);

  const notify = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4500);
  };

  // RF29: Pedidos do estabelecimento em ESTRITA ORDEM DE CHEGADA (FIFO: mais antigo no topo, novos no fim da lista)
  const storeOrdersFIFO = useMemo(() => {
    return orders
      .filter((o) => o.establishmentId === currentStore.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [orders, currentStore.id]);

  const filteredOrders = useMemo(() => {
    if (orderFilter === 'novos') {
      return storeOrdersFIFO.filter((o) => o.status === 'aguardando_confirmacao');
    }
    if (orderFilter === 'ativos') {
      return storeOrdersFIFO.filter(
        (o) => !['concluido', 'recusado', 'cancelado'].includes(o.status)
      );
    }
    return storeOrdersFIFO.filter((o) =>
      ['concluido', 'recusado', 'cancelado'].includes(o.status)
    );
  }, [storeOrdersFIFO, orderFilter]);

  const storeMenuCategories = useMemo(
    () =>
      menuCategories
        .filter((c) => c.establishmentId === currentStore.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [menuCategories, currentStore.id]
  );

  const storeProducts = useMemo(
    () => products.filter((p) => p.establishmentId === currentStore.id),
    [products, currentStore.id]
  );

  const featuredProducts = useMemo(
    () => storeProducts.filter((p) => p.isFeatured),
    [storeProducts]
  );

  const storeCommissions = useMemo(
    () => commissions.filter((c) => c.establishmentId === currentStore.id),
    [commissions, currentStore.id]
  );

  const storeSettlements = useMemo(
    () => settlements.filter((s) => s.establishmentId === currentStore.id),
    [settlements, currentStore.id]
  );

  const handleAcceptOrder = (orderId: string) => {
    const selectedLabel = prepSelectionByOrder[orderId] || '30 min';
    let finalLabel = selectedLabel;
    let finalMinutes =
      PREP_TIME_OPTIONS.find((o) => o.label === selectedLabel)?.minutes || 30;

    if (selectedLabel === 'Personalizado') {
      const customMin = parseInt(customPrepMinutesByOrder[orderId] || '40', 10);
      if (!customMin || customMin <= 0) {
        notify('error', 'Informe um tempo personalizado válido em minutos.');
        return;
      }
      finalLabel = `${customMin} min (personalizado)`;
      finalMinutes = customMin;
    }

    const res = acceptOrder(orderId, finalLabel, finalMinutes);
    notify(res.success ? 'success' : 'error', res.message);
  };

  // RF25 / RNF16 / Seção 9: Compressão automática para WebP no upload
  const handleProductImageUpload = async (file: File) => {
    setIsCompressing(true);
    try {
      const result = await compressAndConvertToWebP(file, 'product');
      setCompressionStats(result);
      setProdImageUrl(result.dataUrl);
      notify(
        'success',
        `Imagem convertida para WebP (${result.width}x${result.height}px • ${result.sizeKB} KB, qualidade ${result.qualityUsed}%).`
      );
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Erro ao processar imagem.');
    } finally {
      setIsCompressing(false);
    }
  };

  // Critério 14: Simulador direto de upload de PNG de 5 MB -> WebP <= 800x800 e <= 200 KB
  const handleSimulate5MBPngUpload = async () => {
    setIsCompressing(true);
    try {
      const sample5MBFile = await generateSample5MBPngFile();
      const result = await compressAndConvertToWebP(sample5MBFile, 'product');
      setCompressionStats(result);
      setProdImageUrl(result.dataUrl);
      notify(
        'success',
        `Teste Critério 14 aprovado! PNG de ${result.originalSizeKB} KB (~5 MB) comprimido para WebP ${result.width}x${result.height}px com apenas ${result.sizeKB} KB (< 200 KB)!`
      );
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Erro no teste de 5 MB.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleCoverImageUpload = async (file: File) => {
    setIsCompressing(true);
    try {
      const result = await compressAndConvertToWebP(file, 'cover');
      setCoverCompressionStats(result);
      updateEstablishmentData(currentStore.id, { coverUrl: result.dataUrl });
      notify(
        'success',
        `Capa 16:9 convertida para WebP (${result.width}x${result.height}px • ${result.sizeKB} KB <= 300 KB).`
      );
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Erro ao processar capa.');
    } finally {
      setIsCompressing(false);
    }
  };

  const startEditProduct = (prod: Product) => {
    setEditingProductId(prod.id);
    setProdName(prod.name);
    setProdCategoryId(prod.categoryId);
    setProdDescription(prod.description);
    setProdPriceInput(formatDecimalInput(prod.price));
    const hasDiscount = Boolean(prod.originalPrice && prod.originalPrice > prod.price);
    setProdHasPromo(hasDiscount);
    setProdOriginalPriceInput(
      formatDecimalInput(prod.originalPrice && prod.originalPrice > prod.price ? prod.originalPrice : prod.price)
    );
    setProdDiscountInput(String(prod.discountPercent || 0));
    setProdUnitOfMeasure(prod.unitOfMeasure || 'un');
    setProdUnitQuantity(prod.unitQuantity || 1);
    setProdTrackStock(Boolean(prod.trackStock));
    setProdStockQuantity(prod.stockQuantity ?? 25);
    setProdBrand(prod.brand || 'Produção Própria / Artesanal');
    setProdServesPeople(prod.servesPeople || 1);
    setProdPrepTimeEstimate(prod.prepTimeEstimate || 25);
    setProdRequiresAgeCheck(Boolean(prod.requiresAgeCheck));
    setProdImageUrl(prod.imageUrl);
    setProdAvailable(prod.available);
    setProdFeatured(prod.isFeatured);
    setCompressionStats(null);
  };

  const resetProductForm = () => {
    setEditingProductId(null);
    setProdName('');
    setProdDescription('');
    setProdPriceInput('12,50');
    setProdHasPromo(false);
    setProdOriginalPriceInput('15,00');
    setProdDiscountInput('0');
    setProdUnitOfMeasure('un');
    setProdUnitQuantity(1);
    setProdTrackStock(false);
    setProdStockQuantity(25);
    setProdBrand('Produção Própria / Artesanal');
    setProdServesPeople(1);
    setProdPrepTimeEstimate(25);
    setProdRequiresAgeCheck(false);
    setProdImageUrl('');
    setProdAvailable(true);
    setProdFeatured(false);
    setCompressionStats(null);
    setDraftSavedAt(null);
    try {
      localStorage.removeItem(PRODUCT_DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = parseBRLString(prodPriceInput);
    const parsedOrig = prodHasPromo ? parseBRLString(prodOriginalPriceInput) : undefined;
    const parsedDisc = prodHasPromo ? parseFloat(prodDiscountInput) || 0 : undefined;
    const catId = prodCategoryId || storeMenuCategories[0]?.id || '';

    const res = saveProduct({
      id: editingProductId || undefined,
      establishmentId: currentStore.id,
      categoryId: catId,
      name: prodName,
      description: prodDescription,
      price: parsedPrice,
      originalPrice: parsedOrig,
      discountPercent: parsedDisc,
      unitOfMeasure: prodUnitOfMeasure,
      unitQuantity: prodUnitQuantity,
      trackStock: prodTrackStock,
      stockQuantity: prodTrackStock ? prodStockQuantity : null,
      brand: prodBrand,
      servesPeople: prodServesPeople,
      prepTimeEstimate: prodPrepTimeEstimate,
      requiresAgeCheck: prodRequiresAgeCheck,
      imageUrl: prodImageUrl,
      available: prodTrackStock && prodStockQuantity <= 0 ? false : prodAvailable,
      isFeatured: prodFeatured,
    });

    notify(res.success ? 'success' : 'error', res.message);
    if (res.success) {
      resetProductForm();
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-md ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-red-50 border-red-300 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs underline ml-4">
            Fechar
          </button>
        </div>
      )}

      {/* Cabeçalho Operacional do Lojista */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <img
            src={currentStore.logoUrl}
            alt={currentStore.name}
            className="w-16 h-16 rounded-2xl object-cover border border-slate-200"
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#166534]">
                Painel do Estabelecimento
              </span>
              <select
                value={currentStore.id}
                onChange={(e) => {
                  const next = establishments.find((st) => st.id === e.target.value);
                  setSelectedStoreId(e.target.value);
                  if (next) {
                    setStoreDesc(next.description);
                    setStoreCep(next.cep || '30140-071');
                    setStoreStreet(next.street || next.address.split(',')[0] || 'Avenida Brasil');
                    setStoreNumber(next.number || '1500');
                    setStoreComplement(next.complement || '');
                    setStoreNeighborhood(next.neighborhood || 'Centro');
                    setStoreDocument(next.documentNumber || '12.345.678/0001-99');
                    setStoreAddress(next.address);
                    setStorePhone(next.phone);
                    setStoreWhatsapp(next.whatsapp);
                    setStorePixKeyType(next.pixKeyType || 'CNPJ');
                    setStorePixKey(next.pixKey);
                    setStoreDeliveryFeeInput(formatDecimalInput(next.deliveryFee));
                    setStoreServiceArea(next.serviceArea);
                    setStoreOpeningHours(next.openingHours);
                    setStoreSchedules(normalizeSchedules(next.schedules));
                    setStoreDeliveryMode(next.deliveryMode);
                    setStoreAcceptedPayments(next.acceptedPayments);
                  }
                }}
                className="px-2.5 py-1 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50"
              >
                {establishments.map((st) => (
                  <option key={st.id} value={st.id}>
                    Loja: {st.name} ({st.approvalStatus})
                  </option>
                ))}
              </select>
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 mt-0.5">
              {currentStore.name}
            </h1>
            <p className="text-xs text-slate-500">
              Status operacional:{' '}
              <strong className="uppercase text-slate-800">
                {currentStore.operationStatus}
              </strong>{' '}
              • Comissão vigente:{' '}
              <strong>
                {currentStore.commissionPercent ?? settings.defaultCommissionPercent}%
              </strong>
            </p>
          </div>
        </div>

        {/* Botões RF49 (Iniciar expediente com som/push) e RF37 (Pausar pedidos) */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={async () => {
              startMerchantShift();
              await requestBrowserNotificationPermission();
              notify(
                'success',
                'Expediente iniciado! Alerta sonoro e notificações push ativados (RF49).'
              );
            }}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold inline-flex items-center gap-2 transition cursor-pointer ${
              merchantAudioUnlocked
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                : 'bg-[#166534] text-white hover:bg-[#14532d] animate-pulse-green'
            }`}
          >
            <BellRing className="w-4 h-4" />
            {merchantAudioUnlocked
              ? 'Expediente Ativo (Som e Push Liberados)'
              : 'Iniciar Expediente (Liberar Áudio e Push)'}
          </button>

          <button
            type="button"
            onClick={() => {
              playNewOrderSound();
              notify('success', 'Alerta sonoro de novo pedido reproduzido!');
            }}
            className="px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Volume2 className="w-4 h-4 text-[#166534]" />
            Testar Som
          </button>

          <button
            type="button"
            onClick={() => {
              const res = togglePauseEstablishment(currentStore.id);
              notify('success', res.message);
            }}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
              currentStore.operationStatus === 'pausado'
                ? 'bg-emerald-700 text-white'
                : 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
            }`}
          >
            {currentStore.operationStatus === 'pausado' ? (
              <>
                <PlayCircle className="w-4 h-4" />
                Reabrir Recebimento
              </>
            ) : (
              <>
                <PauseCircle className="w-4 h-4" />
                Pausar Novos Pedidos (RF37)
              </>
            )}
          </button>
        </div>
      </div>

      {/* Navegação por Abas do Lojista */}
      <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-slate-200">
        {[
          {
            id: 'pedidos' as MerchantTab,
            label: `Pedidos (Fila FIFO: ${
              storeOrdersFIFO.filter(
                (o) => !['concluido', 'recusado', 'cancelado'].includes(o.status)
              ).length
            })`,
            icon: Clock,
          },
          {
            id: 'cardapio' as MerchantTab,
            label: 'Cardápio, Categorias & WebP',
            icon: Layers,
          },
          {
            id: 'destaques' as MerchantTab,
            label: `Destaques 3x2 (${featuredProducts.length}/6)`,
            icon: Sparkles,
          },
          {
            id: 'loja' as MerchantTab,
            label: 'Configurações da Loja',
            icon: Settings,
          },
          {
            id: 'comissoes' as MerchantTab,
            label: 'Comissões e Fechamentos',
            icon: DollarSign,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-2 transition cursor-pointer ${
                active
                  ? 'bg-[#166534] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* =====================================================================
          ABA 1: PAINEL DE PEDIDOS (RF29 Ordem de Chegada FIFO, RF30, RF31, RF32, RF33)
      ===================================================================== */}
      {activeTab === 'pedidos' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50/80 border border-emerald-200 px-4 py-3 rounded-2xl">
            <div className="text-xs text-emerald-950">
              <strong>Ordem de chegada ativa (RF29):</strong> O pedido mais antigo fica no{' '}
              <strong>topo</strong> da fila e os pedidos novos entram no{' '}
              <strong>fim da lista</strong>.
            </div>
            <div className="flex gap-1.5">
              {[
                { id: 'ativos' as const, label: 'Fila Ativa (FIFO)' },
                { id: 'novos' as const, label: 'Aguardando Confirmação' },
                { id: 'historico' as const, label: 'Histórico Finalizados' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setOrderFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                    orderFilter === f.id
                      ? 'bg-[#166534] text-white'
                      : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center border border-slate-200">
              <p className="text-sm font-bold text-slate-600">
                Nenhum pedido neste filtro no momento.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order, index) => {
                const selectedPrep = prepSelectionByOrder[order.id] || '30 min';
                const orderRide = rides.find((r) => r.orderId === order.id);

                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 text-white text-xs font-extrabold">
                            Posição #{index + 1} na Fila
                          </span>
                          <span className="text-sm font-extrabold text-[#166534]">
                            Pedido #{order.orderNumber}
                          </span>
                          <span className="text-xs text-slate-400">
                            • Chegada: {new Date(order.createdAt).toLocaleTimeString('pt-BR')}
                          </span>
                        </div>
                        <h3 className="text-base font-extrabold text-slate-900 mt-1">
                          Cliente: {order.customerName} ({order.customerPhone})
                        </h3>
                        <p className="text-xs text-slate-600">
                          📍 {order.deliveryAddress.street}, nº {order.deliveryAddress.number} —{' '}
                          {order.deliveryAddress.neighborhood} (CEP {order.deliveryAddress.cep})
                          {order.deliveryAddress.complement
                            ? ` • ${order.deliveryAddress.complement}`
                            : ''}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-emerald-100 text-emerald-900">
                          {order.status.replace(/_/g, ' ')}
                        </span>
                        <p className="text-sm font-extrabold text-slate-900 mt-1">
                          Total: {formatBRL(order.total)}{' '}
                          <span className="text-xs font-normal text-slate-500">
                            (Produtos: {formatBRL(order.subtotal)} + Entrega:{' '}
                            {formatBRL(order.deliveryFee + (order.extraDeliveryFee || 0))})
                          </span>
                        </p>
                        <p className="text-xs font-semibold text-slate-600">
                          Pagamento: {order.paymentMethod.toUpperCase()}
                          {order.paymentMethod === 'dinheiro_entrega' &&
                            (order.needsChange
                              ? ` (Troco para ${formatBRL(order.changeFor || 0)})`
                              : ' (Sem troco)')}
                        </p>
                      </div>
                    </div>

                    {/* Itens do pedido */}
                    <div className="bg-slate-50 rounded-2xl p-3.5 space-y-1.5 text-xs">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex justify-between font-medium">
                          <span>
                            <strong>{item.quantity}x</strong> {item.productName}
                          </span>
                          <span>{formatBRL(item.subtotal)}</span>
                        </div>
                      ))}
                      {order.customerNotes && (
                        <p className="text-amber-800 font-semibold pt-1">
                          📝 Observação do cliente: {order.customerNotes}
                        </p>
                      )}
                    </div>

                    {/* Ações quando Aguardando Confirmação (RF30, RF31 — Aceitar com tempo de preparo até >180 min ou Recusar com motivo) */}
                    {order.status === 'aguardando_confirmacao' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2.5">
                          <label className="block text-xs font-extrabold text-emerald-950">
                            1. Tempo estimado de preparo (RF31 — inclui opções &gt; 90 min):
                          </label>
                          <div className="flex gap-2">
                            <select
                              value={selectedPrep}
                              onChange={(e) =>
                                setPrepSelectionByOrder((prev) => ({
                                  ...prev,
                                  [order.id]: e.target.value,
                                }))
                              }
                              className="flex-1 px-3 py-2 rounded-xl bg-white border border-emerald-300 text-xs font-bold"
                            >
                              {PREP_TIME_OPTIONS.map((opt) => (
                                <option key={opt.label} value={opt.label}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>

                            {selectedPrep === 'Personalizado' && (
                              <input
                                type="number"
                                min={5}
                                placeholder="Minutos (ex: 135)"
                                value={customPrepMinutesByOrder[order.id] || ''}
                                onChange={(e) =>
                                  setCustomPrepMinutesByOrder((prev) => ({
                                    ...prev,
                                    [order.id]: e.target.value,
                                  }))
                                }
                                className="w-36 px-3 py-2 rounded-xl bg-white border border-emerald-300 text-xs font-bold"
                              />
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAcceptOrder(order.id)}
                            className="w-full py-2.5 rounded-xl bg-[#166534] hover:bg-[#14532d] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                            Aceitar Pedido #{order.orderNumber}
                          </button>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-red-50/70 border border-red-200 space-y-2.5">
                          <label className="block text-xs font-extrabold text-red-950">
                            Ou recusar pedido informando o motivo obrigatório (RF30): *
                          </label>
                          <div className="flex flex-wrap gap-1">
                            {ORDER_REJECT_SUGGESTIONS.map((sug) => (
                              <button
                                key={sug}
                                type="button"
                                onClick={() =>
                                  setReasonInputByOrder((prev) => ({
                                    ...prev,
                                    [order.id]: sug,
                                  }))
                                }
                                className="px-2 py-0.5 rounded-md bg-white border border-red-200 text-[10px] font-bold text-red-800 hover:bg-red-100 cursor-pointer"
                              >
                                {sug}
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            placeholder="Ex: Produto esgotado ou endereço fora da área..."
                            value={reasonInputByOrder[order.id] || ''}
                            onChange={(e) =>
                              setReasonInputByOrder((prev) => ({
                                ...prev,
                                [order.id]: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 rounded-xl bg-white border border-red-200 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const res = rejectOrder(
                                order.id,
                                reasonInputByOrder[order.id] || ''
                              );
                              notify(res.success ? 'success' : 'error', res.message);
                            }}
                            className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" />
                            Recusar Pedido
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Ações quando pedido já foi Aceito (RF32 Atualizar status, RF33 Cancelar com motivo, RF55/RF60 Entregador Fase 2) */}
                    {['aceito', 'em_preparacao', 'pronto_para_entrega', 'saiu_para_entrega'].includes(
                      order.status
                    ) && (
                      <div className="space-y-3 pt-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-extrabold text-slate-700">
                            Avançar Status (RF32):
                          </span>
                          {(
                            [
                              { status: 'em_preparacao', label: '🍳 Em Preparação' },
                              { status: 'pronto_para_entrega', label: '🥡 Pronto p/ Entrega' },
                              { status: 'saiu_para_entrega', label: '🛵 Saiu p/ Entrega' },
                              { status: 'concluido', label: '✅ Marcar Concluído (Gera Comissão)' },
                            ] as Array<{ status: OrderStatus; label: string }>
                          ).map((btn) => (
                            <button
                              key={btn.status}
                              type="button"
                              onClick={() => {
                                const res = updateOrderStatus(order.id, btn.status);
                                notify(res.success ? 'success' : 'error', res.message);
                              }}
                              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                                order.status === btn.status
                                  ? 'bg-slate-900 text-white'
                                  : 'bg-[#E8F5EC] text-[#166534] hover:bg-[#D2EBD9]'
                              }`}
                            >
                              {btn.label}
                            </button>
                          ))}
                        </div>

                        {/* Solicitar Entregador da Plataforma (RF55), Reenviar Notificação / Assumir Entrega (RF57) e Nova Viagem (RF60) */}
                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                          <div className="text-xs">
                            <span className="font-extrabold text-slate-800 inline-flex items-center gap-1">
                              <Bike className="w-4 h-4 text-[#166534]" />
                              Módulo Híbrido de Entregadores:
                            </span>{' '}
                            {orderRide ? (
                              <span className="text-emerald-800 font-bold">
                                Corrida #{orderRide.id.slice(-4)} ({orderRide.status.toUpperCase()})
                                {orderRide.driverName ? ` • Motoboy: ${orderRide.driverName}` : ' • Aguardando entregador aceitar'}
                              </span>
                            ) : (
                              <span className="text-slate-500">
                                Solicite um entregador parceiro por valor variável.
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {!orderRide && (
                              <button
                                type="button"
                                onClick={() => {
                                  const res = requestPlatformDriver(order.id, 'inicial');
                                  notify(res.success ? 'success' : 'error', res.message);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-[#166534] text-white text-xs font-bold cursor-pointer"
                              >
                                Solicitar Entregador da Plataforma (RF55)
                              </button>
                            )}

                            {orderRide && orderRide.status === 'solicitada' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const res = resendDriverNotification(orderRide.id);
                                    notify(res.success ? 'success' : 'error', res.message);
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <BellRing className="w-3.5 h-3.5" />
                                  Reenviar Alerta Sonoro (RF57)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const res = switchOrderToOwnDelivery(order.id);
                                    notify(res.success ? 'success' : 'error', res.message);
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold cursor-pointer"
                                >
                                  Assumir Entrega Própria (RF57)
                                </button>
                              </>
                            )}

                            <div className="flex flex-wrap items-center gap-1.5">
                              {REPEAT_RIDE_SUGGESTIONS.map((sug) => (
                                <button
                                  key={sug}
                                  type="button"
                                  onClick={() =>
                                    setRepeatRideReasonByOrder((prev) => ({
                                      ...prev,
                                      [order.id]: sug,
                                    }))
                                  }
                                  className="px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-900 hover:bg-amber-100 cursor-pointer"
                                >
                                  {sug}
                                </button>
                              ))}
                              <input
                                type="text"
                                placeholder="Motivo nova viagem (RF60)"
                                value={repeatRideReasonByOrder[order.id] || ''}
                                onChange={(e) =>
                                  setRepeatRideReasonByOrder((prev) => ({
                                    ...prev,
                                    [order.id]: e.target.value,
                                  }))
                                }
                                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs w-44"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const res = requestPlatformDriver(
                                    order.id,
                                    'nova_viagem',
                                    repeatRideReasonByOrder[order.id]
                                  );
                                  notify(res.success ? 'success' : 'error', res.message);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Nova Viagem (+{formatBRL(settings.platformDeliveryFee)})
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* RF33: Cancelar pedido já aceito com motivo obrigatório */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <input
                            type="text"
                            placeholder="Motivo obrigatório para cancelar pedido aceito (RF33) *"
                            value={reasonInputByOrder[order.id] || ''}
                            onChange={(e) =>
                              setReasonInputByOrder((prev) => ({
                                ...prev,
                                [order.id]: e.target.value,
                              }))
                            }
                            className="flex-1 min-w-[240px] px-3 py-2 rounded-xl border border-slate-200 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const res = updateOrderStatus(
                                order.id,
                                'cancelado',
                                reasonInputByOrder[order.id]
                              );
                              notify(res.success ? 'success' : 'error', res.message);
                            }}
                            className="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold cursor-pointer"
                          >
                            Cancelar Pedido Aceito (RF33)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          ABA 2: CARDÁPIO, CATEGORIAS (ORDEM MANUAL) E PRODUTOS COM COMPRESSOR WEBP
      ===================================================================== */}
      {activeTab === 'cardapio' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Coluna Esquerda: Editor de Produto + Compressor WebP (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            <form
              onSubmit={handleSaveProduct}
              className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    {editingProductId ? 'Editar Produto' : 'Novo Produto no Cardápio'}
                  </h2>
                  {!editingProductId && draftSavedAt && (
                    <span className="text-[10px] font-bold text-emerald-700">
                      ✓ Rascunho salvo automaticamente às {draftSavedAt}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!editingProductId && draftSavedAt && (
                    <button
                      type="button"
                      onClick={resetProductForm}
                      className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
                    >
                      Limpar rascunho
                    </button>
                  )}
                  {editingProductId && (
                    <button
                      type="button"
                      onClick={resetProductForm}
                      className="text-xs font-bold text-slate-500 hover:underline cursor-pointer"
                    >
                      Cancelar edição
                    </button>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Nome do Produto <span className="text-red-600">*</span>
                  </label>
                  {prodName.trim().length > 0 && (
                    <span
                      className={`text-[10px] font-bold ${
                        prodName.trim().length >= 3 ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {prodName.trim().length >= 3 ? '✓ Nome válido' : 'Mínimo 3 caracteres'}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="Ex: Picanha na Brasa Completa"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Categoria no Cardápio <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={prodCategoryId || storeMenuCategories[0]?.id || ''}
                    onChange={(e) => setProdCategoryId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-white"
                  >
                    {storeMenuCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <AutocompleteInput
                  label="Marca / Origem do Produto"
                  value={prodBrand}
                  onChange={setProdBrand}
                  suggestions={BRAND_SUGGESTIONS}
                  placeholder="Ex: Produção Própria, Coca-Cola..."
                />
              </div>

              {/* Calculadora Automática de Preço e Desconto Promocional */}
              <PromoPriceCalculator
                priceInput={prodPriceInput}
                originalPriceInput={prodOriginalPriceInput}
                discountPercentInput={prodDiscountInput}
                hasPromo={prodHasPromo}
                onTogglePromo={setProdHasPromo}
                onChangePrice={(priceStr, origStr, discStr) => {
                  setProdPriceInput(priceStr);
                  setProdOriginalPriceInput(origStr);
                  setProdDiscountInput(discStr);
                }}
              />

              {/* Seletor de Quantidade, Unidade de Medida e Estoque */}
              <QuantityUnitStockSelector
                unitOfMeasure={prodUnitOfMeasure}
                unitQuantity={prodUnitQuantity}
                trackStock={prodTrackStock}
                stockQuantity={prodStockQuantity}
                onChange={(next) => {
                  setProdUnitOfMeasure(next.unitOfMeasure);
                  setProdUnitQuantity(next.unitQuantity);
                  setProdTrackStock(next.trackStock);
                  setProdStockQuantity(next.stockQuantity);
                }}
              />

              {/* Campos Condicionais conforme o Tipo de Estabelecimento */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2.5">
                <span className="text-[11px] font-extrabold text-[#14532d] block">
                  Campos Específicos p/ {currentStore.categoryName}:
                </span>
                {currentStore.categoryName.toLowerCase().includes('bebida') ? (
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prodRequiresAgeCheck}
                      onChange={(e) => setProdRequiresAgeCheck(e.target.checked)}
                      className="rounded text-[#166534]"
                    />
                    🔞 Bebida alcoólica — Venda proibida para menores de 18 anos
                  </label>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Serve quantas pessoas?
                      </label>
                      <select
                        value={prodServesPeople}
                        onChange={(e) => setProdServesPeople(parseInt(e.target.value, 10) || 1)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-emerald-200 text-xs font-bold"
                      >
                        <option value={1}>Individual (1 pessoa)</option>
                        <option value={2}>Casal (2 pessoas)</option>
                        <option value={3}>Família (3 a 4 pessoas)</option>
                        <option value={5}>Grupo (5+ pessoas)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Preparo médio (min)
                      </label>
                      <select
                        value={prodPrepTimeEstimate}
                        onChange={(e) =>
                          setProdPrepTimeEstimate(parseInt(e.target.value, 10) || 25)
                        }
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-emerald-200 text-xs font-bold"
                      >
                        <option value={10}>Rápido (10 min)</option>
                        <option value={25}>Padrão (25 min)</option>
                        <option value={40}>Artesanal (40 min)</option>
                        <option value={60}>Assado / Lento (60 min)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descrição e Ingredientes
                </label>
                <textarea
                  rows={2}
                  value={prodDescription}
                  onChange={(e) => setProdDescription(e.target.value)}
                  placeholder="Descreva os ingredientes e tamanho da porção..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              {/* Módulo de Otimização e Compressão Automática de Imagens WebP (Seção 9 / RNF16 / Critério 14) */}
              <div className="p-3.5 rounded-2xl bg-[#F4F8F5] border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#14532d] flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4" />
                    Imagem do Prato (WebP 80% • 1:1 • máx 800x800 e &le; 200 KB)
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <label className="flex-1 py-2 px-3 rounded-xl bg-white border border-emerald-300 text-xs font-bold text-[#166534] text-center cursor-pointer hover:bg-emerald-50 inline-flex items-center justify-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Enviar Foto do Computador</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleProductImageUpload(file);
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    disabled={isCompressing}
                    onClick={handleSimulate5MBPngUpload}
                    className="py-2 px-3 rounded-xl bg-[#166534] text-white text-xs font-bold hover:bg-[#14532d] cursor-pointer"
                  >
                    {isCompressing ? 'Comprimindo...' : '⚡ Testar PNG de 5 MB (Critério 14)'}
                  </button>
                </div>

                {compressionStats && (
                  <div className="p-2.5 rounded-xl bg-white border border-emerald-200 text-[11px] space-y-1">
                    <div className="flex justify-between font-bold text-emerald-900">
                      <span>✓ Conversão WebP no Navegador Concluída</span>
                      <span>Qualidade: {compressionStats.qualityUsed}%</span>
                    </div>
                    <p className="text-slate-600">
                      Original: <strong>{compressionStats.originalSizeKB} KB</strong> ➔ Final:{' '}
                      <strong className="text-[#166534]">{compressionStats.sizeKB} KB</strong>{' '}
                      (Limite &le; 200 KB) • Dimensão:{' '}
                      <strong>
                        {compressionStats.width}x{compressionStats.height} px
                      </strong>
                    </p>
                  </div>
                )}

                {prodImageUrl && (
                  <div className="flex items-center gap-3 pt-1">
                    <img
                      src={prodImageUrl}
                      alt="Preview"
                      className="w-16 h-16 rounded-xl object-cover border border-emerald-300"
                    />
                    <div className="space-y-1">
                      <p className="text-[11px] font-bold text-slate-700">
                        Pré-visualização antes de salvar (RF25)
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setProdImageUrl('');
                          setCompressionStats(null);
                        }}
                        className="text-[11px] text-red-600 font-bold hover:underline"
                      >
                        Remover imagem
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-4 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prodAvailable}
                    onChange={(e) => setProdAvailable(e.target.checked)}
                    className="rounded text-[#166534]"
                  />
                  Disponível para venda
                </label>

                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prodFeatured}
                    onChange={(e) => setProdFeatured(e.target.checked)}
                    className="rounded text-[#166534]"
                  />
                  Destaque no Topo ({featuredProducts.length}/6)
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#166534] hover:bg-[#14532d] text-white text-xs font-extrabold cursor-pointer"
              >
                {editingProductId ? 'Salvar Alterações do Produto' : 'Cadastrar Produto'}
              </button>
            </form>

            {/* Criador de Categorias com Sugestões e Bloqueio de Duplicatas (RF22, RN14) */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
              <h3 className="text-sm font-extrabold text-slate-900">
                Categorias do Cardápio (RF22 / RN14)
              </h3>
              <p className="text-xs text-slate-500">
                Clique em uma sugestão rápida ou digite um nome personalizado (duplicatas são bloqueadas):
              </p>

              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_SUGGESTIONS.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => {
                      const res = createMenuCategory(currentStore.id, sug);
                      notify(res.success ? 'success' : 'error', res.message);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#E8F5EC] hover:bg-[#D5ECDD] text-[#166534] text-[11px] font-bold cursor-pointer"
                  >
                    + {sug}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nova categoria personalizada..."
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    const res = createMenuCategory(currentStore.id, newCategoryName);
                    notify(res.success ? 'success' : 'error', res.message);
                    if (res.success) setNewCategoryName('');
                  }}
                  className="px-4 py-2 rounded-xl bg-[#166534] text-white text-xs font-bold cursor-pointer"
                >
                  Criar
                </button>
              </div>
            </div>
          </div>

          {/* Coluna Direita: Lista de Categorias e Produtos com Ordenação Manual (7 cols — RF23) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-xs text-emerald-950">
              <strong>Ordenação Natural Manual (RF23 / Critério 13):</strong> O cardápio respeita a
              sequência definida abaixo pelo lojista (ex: Cortes ➔ Marmitex ➔ Acompanhamentos ➔
              Molhos ➔ Bebidas), e nunca ordena alfabeticamente de forma automática.
            </div>

            {storeMenuCategories.map((cat, catIdx) => {
              const catProds = storeProducts
                .filter((p) => p.categoryId === cat.id)
                .sort((a, b) => a.sortOrder - b.sortOrder);

              return (
                <div
                  key={cat.id}
                  className="bg-white rounded-3xl p-4 border border-slate-200 shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-[#166534] text-white text-xs font-extrabold flex items-center justify-center">
                        {catIdx + 1}
                      </span>
                      <h3 className="text-sm font-extrabold text-slate-900">{cat.name}</h3>
                      <span className="text-xs text-slate-400">
                        ({catProds.length} produto{catProds.length === 1 ? '' : 's'})
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveMenuCategory(cat.id, 'up')}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700"
                        title="Subir categoria"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveMenuCategory(cat.id, 'down')}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700"
                        title="Descer categoria"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDeleteModal({
                            type: 'category',
                            id: cat.id,
                            name: cat.name,
                          })
                        }
                        className="p-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 ml-1 cursor-pointer"
                        title="Excluir categoria vazia"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {catProds.map((prod) => (
                      <div
                        key={prod.id}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-slate-50 border border-slate-200/70"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={prod.imageUrl}
                            alt={prod.name}
                            className="w-12 h-12 rounded-xl object-cover shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="text-xs font-extrabold text-slate-900 truncate">
                                {prod.name}
                              </p>
                              {prod.isFeatured && (
                                <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                                  ★ Destaque
                                </span>
                              )}
                              {prod.unitOfMeasure && (
                                <span className="px-1.5 py-0.5 rounded-md bg-slate-200/80 text-slate-700 text-[10px] font-bold">
                                  {prod.unitQuantity || 1} {prod.unitOfMeasure}
                                </span>
                              )}
                              {prod.trackStock && (
                                <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                  Estoque: {prod.stockQuantity ?? 0}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {prod.originalPrice && prod.originalPrice > prod.price && (
                                <span className="text-[10px] text-slate-400 line-through">
                                  {formatBRL(prod.originalPrice)}
                                </span>
                              )}
                              <p className="text-xs font-extrabold text-[#166534]">
                                {formatBRL(prod.price)}
                              </p>
                              {prod.discountPercent && prod.discountPercent > 0 ? (
                                <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded">
                                  -{prod.discountPercent}%
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => moveProductOrder(prod.id, 'up')}
                            className="p-1 rounded-lg bg-white border border-slate-200 text-slate-600 cursor-pointer"
                            title="Subir produto"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveProductOrder(prod.id, 'down')}
                            className="p-1 rounded-lg bg-white border border-slate-200 text-slate-600 cursor-pointer"
                            title="Descer produto"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleProductAvailable(prod.id)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                              prod.available
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {prod.available ? 'Ativo' : 'Indisponível'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const res = duplicateProduct(prod.id);
                              notify(res.success ? 'success' : 'error', res.message);
                              if (res.success && res.data) {
                                startEditProduct(res.data);
                              }
                            }}
                            className="p-1.5 rounded-lg bg-white border border-emerald-200 hover:bg-emerald-50 text-[#166534] cursor-pointer"
                            title="Duplicar produto para criar variação rápida"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditProduct(prod)}
                            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 cursor-pointer"
                            title="Editar produto"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDeleteModal({
                                type: 'product',
                                id: prod.id,
                                name: prod.name,
                              })
                            }
                            className="p-1.5 rounded-lg bg-white border border-red-200 hover:bg-red-50 text-red-600 cursor-pointer"
                            title="Remover produto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
          ABA 3: DESTAQUES EM GRADE 3x2 (RF27 / RN13 / Critério 16 — Limite de 6 itens)
      ===================================================================== */}
      {activeTab === 'destaques' && (
        <div className="space-y-5">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Produtos em Destaque — Grade 3 Colunas x 2 Linhas (RF27 / RN13)
                </h2>
                <p className="text-xs text-slate-500">
                  Selecione até 6 produtos. Ao tentar marcar o 7º produto, o sistema bloqueia e exibe um alerta visual.
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                  featuredProducts.length >= 6
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {featuredProducts.length} de 6 selecionados
              </span>
            </div>

            {/* Grade 3x2 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {featuredProducts.map((prod, idx) => (
                <div
                  key={prod.id}
                  className="rounded-2xl border-2 border-[#166534] bg-[#F4F8F5] p-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={prod.imageUrl}
                      alt={prod.name}
                      className="w-14 h-14 rounded-xl object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-[10px] font-extrabold uppercase text-[#166534]">
                        Slot #{idx + 1} (3x2)
                      </span>
                      <h4 className="text-xs font-extrabold text-slate-900 truncate">
                        {prod.name}
                      </h4>
                      <p className="text-xs font-bold text-slate-700">
                        {formatBRL(prod.price)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const res = toggleProductFeatured(prod.id);
                      notify(res.success ? 'success' : 'error', res.message);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold shrink-0 cursor-pointer"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>

            {/* Todos os produtos para testar adição do 7º item */}
            <div className="pt-3 border-t border-slate-200 space-y-2.5">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                Todos os produtos da loja (clique para adicionar/remover dos destaques):
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {storeProducts.map((prod) => (
                  <div
                    key={prod.id}
                    className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-slate-900 truncate">
                        {prod.name}
                      </p>
                      <p className="text-xs text-slate-500">{formatBRL(prod.price)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const res = toggleProductFeatured(prod.id);
                        notify(res.success ? 'success' : 'error', res.message);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                        prod.isFeatured
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-[#166534] text-white hover:bg-[#14532d]'
                      }`}
                    >
                      {prod.isFeatured ? '★ Em Destaque (Remover)' : '+ Marcar Destaque'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ABA 4: CONFIGURAÇÕES DA LOJA (RF21, RF28, Seção 16.1)
      ===================================================================== */}
      {activeTab === 'loja' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-5">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Store className="w-5 h-5 text-[#166534]" />
            Dados Operacionais, Horários por Turno, Endereço via CEP e Chave Pix (RF21 / RF28)
          </h2>

          {/* Seletor Estruturado de Horários de Funcionamento (Múltiplos Períodos, Fechado e 24h) */}
          <OpeningHoursSelector
            schedules={storeSchedules}
            openingHoursText={storeOpeningHours}
            onChange={(nextSchedules, summaryText) => {
              setStoreSchedules(nextSchedules);
              setStoreOpeningHours(summaryText);
            }}
          />

          {/* Endereço Físico com Autopreenchimento via CEP */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <h3 className="text-xs font-extrabold text-slate-800">
              Endereço Físico do Estabelecimento (Preenchimento Automático por CEP)
            </h3>
            <CepAddressFields
              showReferencePoint={false}
              value={{
                cep: storeCep,
                street: storeStreet,
                number: storeNumber,
                neighborhood: storeNeighborhood,
                complement: storeComplement,
              }}
              onChange={(addr) => {
                setStoreCep(addr.cep);
                setStoreStreet(addr.street);
                setStoreNumber(addr.number);
                setStoreNeighborhood(addr.neighborhood);
                setStoreComplement(addr.complement || '');
                const formattedAddr = `${addr.street}${addr.number ? `, ${addr.number}` : ''}${
                  addr.complement ? ` (${addr.complement})` : ''
                } - ${addr.neighborhood}`;
                setStoreAddress(formattedAddr);
              }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Descrição do Estabelecimento *
              </label>
              <textarea
                rows={2}
                value={storeDesc}
                onChange={(e) => setStoreDesc(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>

            <AutocompleteInput
              label="Área de Atendimento (Bairros atendidos)"
              required
              appendMode
              value={storeServiceArea}
              onChange={setStoreServiceArea}
              suggestions={NEIGHBORHOOD_SUGGESTIONS}
              placeholder="Clique nas sugestões ou digite os bairros separados por vírgula..."
            />

            <MaskedInput
              label="CPF ou CNPJ do Estabelecimento"
              required
              mask="document"
              value={storeDocument}
              onChange={setStoreDocument}
              placeholder="00.000.000/0001-00"
            />

            <CurrencyInput
              label="Taxa de Entrega Própria (R$ 0,00)"
              required
              value={storeDeliveryFeeInput}
              onChange={(masked) => setStoreDeliveryFeeInput(masked)}
              quickValues={[0, 5, 7, 10, 12]}
            />

            <MaskedInput
              label="Telefone Comercial"
              required
              mask="phone"
              value={storePhone}
              onChange={setStorePhone}
              placeholder="(31) 3333-4444"
            />

            <MaskedInput
              label="WhatsApp para Receber Resumo dos Pedidos (RF19)"
              required
              mask="phone"
              value={storeWhatsapp}
              onChange={setStoreWhatsapp}
              placeholder="(31) 99999-8888"
            />

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tipo de Chave Pix
                </label>
                <select
                  value={storePixKeyType}
                  onChange={(e) => setStorePixKeyType(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
                >
                  <option value="CNPJ">CNPJ</option>
                  <option value="CPF">CPF</option>
                  <option value="Telefone">Telefone</option>
                  <option value="Email">E-mail</option>
                  <option value="Aleatoria">Chave Aleatória</option>
                </select>
              </div>
              <div className="col-span-2">
                <MaskedInput
                  label="Chave Pix (Exibida após o aceite — RN07)"
                  required
                  mask="pix"
                  pixKeyType={storePixKeyType}
                  value={storePixKey}
                  onChange={setStorePixKey}
                  placeholder="Informe a chave Pix..."
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Modalidade de Entrega (Seção 16.1 — Modelo Híbrido)
              </label>
              <select
                value={storeDeliveryMode}
                onChange={(e) => setStoreDeliveryMode(e.target.value as DeliveryMode)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
              >
                <option value="propria">Entrega Própria da Loja</option>
                <option value="plataforma">
                  Entregadores da Plataforma (Valor variável • {formatBRL(settings.platformDeliveryFee)}/corrida)
                </option>
                <option value="ambos">Ambos (Híbrido — escolhe por pedido)</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Formas de Pagamento Aceitas
              </label>
              <div className="flex flex-wrap gap-3 pt-1.5">
                {(
                  [
                    { id: 'pix', label: 'Pix' },
                    { id: 'cartao_entrega', label: 'Cartão na entrega' },
                    { id: 'dinheiro_entrega', label: 'Dinheiro na entrega' },
                  ] as Array<{ id: PaymentMethod; label: string }>
                ).map((pm) => (
                  <label key={pm.id} className="inline-flex items-center gap-1.5 text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={storeAcceptedPayments.includes(pm.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setStoreAcceptedPayments((prev) => [...prev, pm.id]);
                        } else {
                          setStoreAcceptedPayments((prev) =>
                            prev.filter((item) => item !== pm.id)
                          );
                        }
                      }}
                    />
                    {pm.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Upload de Capa 16:9 com Compressor WebP */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-800">
                Imagem de Capa 16:9 (Convertida para WebP máx 1200x675px e &le; 300 KB)
              </span>
              <label className="px-3 py-1.5 rounded-xl bg-[#166534] text-white text-xs font-bold cursor-pointer">
                Trocar Capa (WebP 16:9)
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCoverImageUpload(file);
                  }}
                />
              </label>
            </div>
            {coverCompressionStats && (
              <p className="text-xs text-emerald-800 font-semibold">
                ✓ Capa comprimida em WebP: {coverCompressionStats.width}x
                {coverCompressionStats.height}px • {coverCompressionStats.sizeKB} KB
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              const res = updateEstablishmentData(currentStore.id, {
                description: storeDesc,
                cep: storeCep,
                street: storeStreet,
                number: storeNumber,
                complement: storeComplement,
                neighborhood: storeNeighborhood,
                documentNumber: storeDocument,
                address: storeAddress,
                phone: storePhone,
                whatsapp: storeWhatsapp,
                pixKeyType: storePixKeyType,
                pixKey: storePixKey,
                deliveryFee: parseBRLString(storeDeliveryFeeInput),
                serviceArea: storeServiceArea,
                openingHours: storeOpeningHours,
                schedules: storeSchedules,
                deliveryMode: storeDeliveryMode,
                acceptedPayments: storeAcceptedPayments,
              });
              notify('success', res.message);
            }}
            className="px-6 py-3 rounded-2xl bg-[#166534] text-white text-xs font-extrabold cursor-pointer"
          >
            Salvar Dados do Estabelecimento
          </button>
        </div>
      )}

      {/* =====================================================================
          ABA 5: COMISSÕES E FECHAMENTOS DO ESTABELECIMENTO (RF34, RF35, RF36)
      ===================================================================== */}
      {activeTab === 'comissoes' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-3xl p-5 border border-slate-200">
              <span className="text-xs text-slate-500 font-bold">
                Comissões Pendentes / Em Aberto
              </span>
              <p className="text-2xl font-extrabold text-amber-600 mt-1">
                {formatBRL(
                  storeCommissions
                    .filter((c) => c.status !== 'paga')
                    .reduce((acc, c) => acc + c.commissionAmount, 0)
                )}
              </p>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200">
              <span className="text-xs text-slate-500 font-bold">
                Total de Comissões Já Pagas
              </span>
              <p className="text-2xl font-extrabold text-[#166534] mt-1">
                {formatBRL(
                  storeSettlements
                    .filter((s) => s.status === 'pago')
                    .reduce((acc, s) => acc + s.totalCommissionAmount, 0)
                )}
              </p>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200">
              <span className="text-xs text-slate-500 font-bold">
                Taxa de Comissão Aplicada
              </span>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">
                {currentStore.commissionPercent ?? settings.defaultCommissionPercent}%
              </p>
              <span className="text-[11px] text-slate-400">
                Incide somente sobre os produtos (exclui entrega — RN01)
              </span>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#166534]" />
              Comissões por Pedido Concluído (RF35)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2">Pedido</th>
                    <th className="py-2">Base Produtos</th>
                    <th className="py-2">% Comissão</th>
                    <th className="py-2">Valor Comissão</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {storeCommissions.map((comm) => (
                    <tr key={comm.id}>
                      <td className="py-2.5 font-extrabold">#{comm.orderNumber}</td>
                      <td className="py-2.5">{formatBRL(comm.productsBaseAmount)}</td>
                      <td className="py-2.5">{comm.commissionPercent}%</td>
                      <td className="py-2.5 font-extrabold text-[#166534]">
                        {formatBRL(comm.commissionAmount)}
                      </td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                          {comm.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação ao Excluir Item ou Categoria do Cardápio */}
      {confirmDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Confirmar Exclusão no Cardápio
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Tem certeza que deseja excluir{' '}
                  {confirmDeleteModal.type === 'product' ? 'o produto' : 'a categoria'}{' '}
                  <strong className="text-slate-900">"{confirmDeleteModal.name}"</strong> do
                  cardápio? Esta ação não poderá ser desfeita.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteModal(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmDeleteModal.type === 'product') {
                    deleteProduct(confirmDeleteModal.id);
                    notify(
                      'success',
                      `Produto "${confirmDeleteModal.name}" removido do cardápio com sucesso.`
                    );
                  } else {
                    const res = deleteMenuCategory(confirmDeleteModal.id);
                    notify(res.success ? 'success' : 'error', res.message);
                  }
                  setConfirmDeleteModal(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Sim, Excluir do Cardápio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
