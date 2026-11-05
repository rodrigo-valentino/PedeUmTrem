import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  AccountStatus,
  AuditLogEntry,
  BiweeklySettlement,
  CartItem,
  CommissionRecord,
  CustomerAddress,
  DeliveryDriver,
  DeliveryRide,
  Establishment,
  MenuCategory,
  Order,
  OrderStatus,
  PaymentMethod,
  PlatformSettings,
  Product,
  StoreCategory,
  StoreOperationStatus,
  UserProfile,
  UserRole,
  VehicleType,
} from '../types';
import {
  INITIAL_ADDRESSES,
  INITIAL_AUDIT_LOGS,
  INITIAL_COMMISSIONS,
  INITIAL_DRIVERS,
  INITIAL_ESTABLISHMENTS,
  INITIAL_MENU_CATEGORIES,
  INITIAL_ORDERS,
  INITIAL_PLATFORM_SETTINGS,
  INITIAL_PRODUCTS,
  INITIAL_RIDES,
  INITIAL_SETTLEMENTS,
  INITIAL_STORE_CATEGORIES,
  INITIAL_USERS,
} from '../data/seedData';
import {
  addMoney,
  calculateCommission,
  multiplyMoney,
  roundMoney,
} from '../utils/currency';
import {
  validateEmail,
  validateOrderStatusTransition,
  validatePassword,
} from '../utils/validation';
import {
  playNewDeliveryRideSound,
  playNewOrderSound,
  triggerPushNotification,
  unlockDriverAudio,
  unlockMerchantAudio,
} from '../utils/sound';

const STORAGE_KEY = 'pedeumtrem_db_v1_1';
const SESSION_KEY = 'pedeumtrem_session_v1_1';

interface OperationResult<T = void> {
  success: boolean;
  message: string;
  field?: string;
  data?: T;
}

interface AppContextType {
  // Sessão e Autenticação
  currentUser: UserProfile | null;
  sessionExpiredModalOpen: boolean;
  setSessionExpiredModalOpen: (open: boolean) => void;
  loginWithPassword: (email: string, password: string) => OperationResult<UserProfile>;
  loginWithGoogle: (email: string, firstName: string, lastName: string) => OperationResult<UserProfile>;
  registerCustomer: (input: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
  }) => OperationResult<UserProfile>;
  registerDriver: (input: {
    name: string;
    email: string;
    phone: string;
    vehicle: VehicleType;
    pixKey: string;
    password: string;
  }) => OperationResult<UserProfile>;
  switchDemoProfile: (role: UserRole) => void;
  logout: () => void;

  // Dados Globais
  settings: PlatformSettings;
  storeCategories: StoreCategory[];
  establishments: Establishment[];
  menuCategories: MenuCategory[];
  products: Product[];
  users: UserProfile[];
  addresses: CustomerAddress[];
  orders: Order[];
  commissions: CommissionRecord[];
  settlements: BiweeklySettlement[];
  drivers: DeliveryDriver[];
  rides: DeliveryRide[];
  auditLogs: AuditLogEntry[];
  favorites: string[];
  toggleFavorite: (establishmentId: string) => void;

  // Carrinho do Cliente
  cart: CartItem[];
  cartEstablishment: Establishment | null;
  addToCart: (product: Product, quantity?: number, notes?: string) => OperationResult;
  updateCartQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  cartSubtotal: number;

  // Endereços do Cliente
  saveCustomerAddress: (addr: Omit<CustomerAddress, 'id' | 'customerId'> & { id?: string }) => OperationResult<CustomerAddress>;
  setDefaultAddress: (addressId: string) => void;

  // Pedidos e Fluxo de Status
  placeOrder: (input: {
    idempotencyKey: string;
    address: CustomerAddress;
    phone: string;
    notes?: string;
    paymentMethod: PaymentMethod;
    needsChange: boolean;
    changeFor?: number;
  }) => OperationResult<Order>;
  acceptOrder: (orderId: string, prepTimeLabel: string, prepTimeMinutes: number) => OperationResult;
  rejectOrder: (orderId: string, reason: string) => OperationResult;
  updateOrderStatus: (orderId: string, nextStatus: OrderStatus, reason?: string) => OperationResult;
  cancelOrderByCustomer: (orderId: string, reason?: string) => OperationResult;

  // Lojista — Expediente, Loja, Cardápio e Destaques
  merchantAudioUnlocked: boolean;
  startMerchantShift: () => void;
  updateEstablishmentData: (establishmentId: string, patch: Partial<Establishment>) => OperationResult;
  togglePauseEstablishment: (establishmentId: string) => OperationResult;
  createMenuCategory: (establishmentId: string, name: string) => OperationResult<MenuCategory>;
  moveMenuCategory: (categoryId: string, direction: 'up' | 'down') => void;
  deleteMenuCategory: (categoryId: string) => OperationResult;
  saveProduct: (
    product: Omit<Product, 'id' | 'sortOrder'> & { id?: string; sortOrder?: number }
  ) => OperationResult<Product>;
  duplicateProduct: (productId: string) => OperationResult<Product>;
  moveProductOrder: (productId: string, direction: 'up' | 'down') => void;
  toggleProductFeatured: (productId: string) => OperationResult;
  toggleProductAvailable: (productId: string) => void;
  deleteProduct: (productId: string) => void;

  // Módulo de Entregadores e Corridas
  driverAudioUnlocked: boolean;
  startDriverShift: () => void;
  requestPlatformDriver: (orderId: string, rideType?: 'inicial' | 'nova_viagem', reason?: string) => OperationResult<DeliveryRide>;
  resendDriverNotification: (rideId: string) => OperationResult;
  switchOrderToOwnDelivery: (orderId: string) => OperationResult;
  toggleDriverAvailability: (driverId: string) => void;
  acceptDeliveryRide: (rideId: string, driverId: string) => OperationResult;
  updateDeliveryRideStatus: (rideId: string, nextStatus: 'retirada' | 'entregue') => OperationResult;
  abandonDeliveryRide: (rideId: string, reason: string) => OperationResult;
  cancelOrResolveRideByAdmin: (rideId: string, reason: string) => OperationResult;

  // Administrador — Aprovação, Destaques da Home, Quinzenas, Comissões e Configurações
  setEstablishmentApprovalStatus: (establishmentId: string, status: AccountStatus, justification?: string) => OperationResult;
  toggleEstablishmentFeatured: (establishmentId: string) => OperationResult;
  setDriverApprovalStatus: (driverId: string, status: AccountStatus) => OperationResult;
  setUserStatus: (userId: string, status: AccountStatus) => OperationResult;
  updatePlatformSettings: (newSettings: PlatformSettings) => OperationResult;
  setStoreCustomCommission: (establishmentId: string, commissionPercent: number | null, justification: string) => OperationResult;
  closeBiweeklyPeriod: (periodLabel: string, periodStart: string, periodEnd: string) => OperationResult;
  markSettlementPaid: (settlementId: string) => OperationResult;
  markDriverRidesSettled: (driverId: string) => OperationResult;
  resetDemoDatabase: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const persisted = loadPersistedState();

  const [settings, setSettings] = useState<PlatformSettings>(
    persisted?.settings ?? INITIAL_PLATFORM_SETTINGS
  );
  const [storeCategories] = useState<StoreCategory[]>(
    persisted?.storeCategories ?? INITIAL_STORE_CATEGORIES
  );
  const [establishments, setEstablishments] = useState<Establishment[]>(
    persisted?.establishments ?? INITIAL_ESTABLISHMENTS
  );
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>(
    persisted?.menuCategories ?? INITIAL_MENU_CATEGORIES
  );
  const [products, setProducts] = useState<Product[]>(
    persisted?.products ?? INITIAL_PRODUCTS
  );
  const [users, setUsers] = useState<UserProfile[]>(
    persisted?.users ?? INITIAL_USERS
  );
  const [addresses, setAddresses] = useState<CustomerAddress[]>(
    persisted?.addresses ?? INITIAL_ADDRESSES
  );
  const [orders, setOrders] = useState<Order[]>(
    persisted?.orders ?? INITIAL_ORDERS
  );
  const [commissions, setCommissions] = useState<CommissionRecord[]>(
    persisted?.commissions ?? INITIAL_COMMISSIONS
  );
  const [settlements, setSettlements] = useState<BiweeklySettlement[]>(
    persisted?.settlements ?? INITIAL_SETTLEMENTS
  );
  const [drivers, setDrivers] = useState<DeliveryDriver[]>(
    persisted?.drivers ?? INITIAL_DRIVERS
  );
  const [rides, setRides] = useState<DeliveryRide[]>(
    persisted?.rides ?? INITIAL_RIDES
  );
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(
    persisted?.auditLogs ?? INITIAL_AUDIT_LOGS
  );
  const [favorites, setFavorites] = useState<string[]>(
    persisted?.favorites ?? ['est-vai-brasa', 'est-trem-bao']
  );
  const [cart, setCart] = useState<CartItem[]>(persisted?.cart ?? []);

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const savedSession = localStorage.getItem(SESSION_KEY);
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_USERS[0]; // Logado como Rodrigo (Cliente) por padrão para facilitar navegação imediata
  });

  const [sessionExpiredModalOpen, setSessionExpiredModalOpen] = useState(false);
  const [merchantAudioUnlocked, setMerchantAudioUnlocked] = useState(false);
  const [driverAudioUnlocked, setDriverAudioUnlocked] = useState(false);

  // Persistência contínua e estável sem recarregar a página (RNF11)
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          settings,
          storeCategories,
          establishments,
          menuCategories,
          products,
          users,
          addresses,
          orders,
          commissions,
          settlements,
          drivers,
          rides,
          auditLogs,
          favorites,
          cart,
        })
      );
    } catch {
      // Ignore quota errors
    }
  }, [
    settings,
    storeCategories,
    establishments,
    menuCategories,
    products,
    users,
    addresses,
    orders,
    commissions,
    settlements,
    drivers,
    rides,
    auditLogs,
    favorites,
    cart,
  ]);

  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    } catch {
      // ignore
    }
  }, [currentUser]);

  const recordAudit = (
    actionType: string,
    targetEntity: string,
    targetId: string,
    description: string,
    justification?: string
  ) => {
    const entry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      actorId: currentUser?.id ?? 'system',
      actorName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Sistema',
      actorRole: currentUser?.role ?? 'administrador',
      actionType,
      targetEntity,
      targetId,
      description,
      justification,
      createdAt: new Date().toISOString(),
    };
    setAuditLogs((prev) => [entry, ...prev]);
  };

  // ---------------------------------------------------------------------------
  // 1. AUTENTICAÇÃO (RF01, RNF04, RNF11, RNF13)
  // ---------------------------------------------------------------------------
  const loginWithPassword = (email: string, password: string): OperationResult<UserProfile> => {
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return {
        success: false,
        field: emailValidation.field,
        message: emailValidation.message!,
      };
    }
    if (!password) {
      return {
        success: false,
        field: 'password',
        message: 'O campo Senha (*) é obrigatório.',
      };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = users.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (!user) {
      return {
        success: false,
        field: 'email',
        message: 'Nenhuma conta encontrada com este e-mail. Verifique o endereço ou crie sua conta.',
      };
    }
    if (user.passwordHash !== password) {
      return {
        success: false,
        field: 'password',
        message: 'Senha incorreta para este e-mail. Tente novamente.',
      };
    }
    if (user.status === 'suspenso') {
      return {
        success: false,
        field: 'email',
        message: 'Esta conta está temporariamente suspensa pelo administrador.',
      };
    }

    setCurrentUser(user);
    setSessionExpiredModalOpen(false);
    return {
      success: true,
      message: `Bem-vindo de volta, ${user.firstName}!`,
      data: user,
    };
  };

  // Critério 4: Login com Google não conflita com o cadastro por senha
  const loginWithGoogle = (
    email: string,
    firstName: string,
    lastName: string
  ): OperationResult<UserProfile> => {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = users.find((u) => u.email.toLowerCase() === normalizedEmail);

    if (existing) {
      const updatedUser: UserProfile = {
        ...existing,
        authProvider: existing.authProvider === 'password' ? 'both' : existing.authProvider,
      };
      setUsers((prev) => prev.map((u) => (u.id === existing.id ? updatedUser : u)));
      setCurrentUser(updatedUser);
      setSessionExpiredModalOpen(false);
      return {
        success: true,
        message: `Autenticado via Google (vinculado à sua conta existente sem conflito com sua senha).`,
        data: updatedUser,
      };
    }

    const newUser: UserProfile = {
      id: `user-${Date.now()}`,
      firstName: firstName || 'Cliente',
      lastName: lastName || 'Google',
      email: normalizedEmail,
      phone: '(31) 99000-0000',
      passwordHash: 'GoogleAuth2026',
      role: 'cliente',
      status: 'ativo',
      authProvider: 'google',
      createdAt: new Date().toISOString(),
    };
    setUsers((prev) => [...prev, newUser]);
    setCurrentUser(newUser);
    setSessionExpiredModalOpen(false);
    return {
      success: true,
      message: 'Conta criada e autenticada com sucesso via Google!',
      data: newUser,
    };
  };

  const registerCustomer = (input: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
  }): OperationResult<UserProfile> => {
    if (!input.firstName.trim()) {
      return {
        success: false,
        field: 'firstName',
        message: 'O campo Nome (*) é obrigatório.',
      };
    }
    if (!input.lastName.trim()) {
      return {
        success: false,
        field: 'lastName',
        message: 'O campo Sobrenome (*) é obrigatório.',
      };
    }

    const emailCheck = validateEmail(input.email);
    if (!emailCheck.valid) {
      return {
        success: false,
        field: 'email',
        message: emailCheck.message!,
      };
    }

    const normalizedEmail = input.email.trim().toLowerCase();
    const emailExists = users.some((u) => u.email.toLowerCase() === normalizedEmail);
    if (emailExists) {
      return {
        success: false,
        field: 'email',
        message: 'E-mail já cadastrado: já existe uma conta utilizando este endereço de e-mail.',
      };
    }

    const phoneDigits = input.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      return {
        success: false,
        field: 'phone',
        message: 'O campo Telefone (*) deve conter DDD + número válido (mínimo 10 dígitos).',
      };
    }

    const passCheck = validatePassword(input.password);
    if (!passCheck.valid) {
      return {
        success: false,
        field: 'password',
        message: passCheck.message!,
      };
    }

    const newUser: UserProfile = {
      id: `user-${Date.now()}`,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: normalizedEmail,
      phone: input.phone.trim(),
      passwordHash: input.password,
      role: 'cliente',
      status: 'ativo',
      authProvider: 'password',
      createdAt: new Date().toISOString(),
    };

    setUsers((prev) => [...prev, newUser]);
    setCurrentUser(newUser);
    return {
      success: true,
      message: 'Cadastro realizado com sucesso! Bem-vindo ao PedeUmTrem.',
      data: newUser,
    };
  };

  const registerDriver = (input: {
    name: string;
    email: string;
    phone: string;
    vehicle: VehicleType;
    pixKey: string;
    password: string;
  }): OperationResult<UserProfile> => {
    if (!input.name.trim()) {
      return { success: false, field: 'name', message: 'Informe seu nome completo (*).' };
    }
    const emailCheck = validateEmail(input.email);
    if (!emailCheck.valid) {
      return { success: false, field: 'email', message: emailCheck.message! };
    }
    const normalizedEmail = input.email.trim().toLowerCase();
    if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      return {
        success: false,
        field: 'email',
        message: 'E-mail já cadastrado no sistema.',
      };
    }
    if (!input.pixKey.trim()) {
      return {
        success: false,
        field: 'pixKey',
        message: 'Informe sua chave Pix (*) para recebimento dos repasses quinzenais.',
      };
    }
    const passCheck = validatePassword(input.password);
    if (!passCheck.valid) {
      return { success: false, field: 'password', message: passCheck.message! };
    }

    const driverId = `drv-${Date.now()}`;
    const userId = `user-drv-${Date.now()}`;
    const parts = input.name.trim().split(' ');
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ') || 'Entregador';

    const newDriver: DeliveryDriver = {
      id: driverId,
      userId,
      name: input.name.trim(),
      email: normalizedEmail,
      phone: input.phone.trim(),
      vehicle: input.vehicle,
      pixKey: input.pixKey.trim(),
      approvalStatus: 'pendente', // RF53: sujeito à aprovação do administrador
      isAvailable: false,
      createdAt: new Date().toISOString(),
    };

    const newUser: UserProfile = {
      id: userId,
      firstName,
      lastName,
      email: normalizedEmail,
      phone: input.phone.trim(),
      passwordHash: input.password,
      role: 'entregador',
      status: 'pendente',
      authProvider: 'password',
      driverId,
      createdAt: new Date().toISOString(),
    };

    setDrivers((prev) => [...prev, newDriver]);
    setUsers((prev) => [...prev, newUser]);
    setCurrentUser(newUser);
    return {
      success: true,
      message: 'Cadastro de entregador enviado! Aguardando aprovação do administrador (RF53).',
      data: newUser,
    };
  };

  const switchDemoProfile = (role: UserRole) => {
    const target = users.find((u) => u.role === role && u.status === 'ativo') || users.find((u) => u.role === role);
    if (target) {
      setCurrentUser(target);
    }
  };

  const logout = () => {
    setCurrentUser(null);
  };

  const toggleFavorite = (establishmentId: string) => {
    setFavorites((prev) =>
      prev.includes(establishmentId)
        ? prev.filter((id) => id !== establishmentId)
        : [...prev, establishmentId]
    );
  };

  // ---------------------------------------------------------------------------
  // 2. CARRINHO DE COMPRAS (RF07, RF08, RN09)
  // ---------------------------------------------------------------------------
  const cartEstablishment =
    cart.length > 0
      ? establishments.find((e) => e.id === cart[0].establishmentId) ?? null
      : null;

  const cartSubtotal = cart.reduce(
    (sum, item) => addMoney(sum, multiplyMoney(item.unitPrice, item.quantity)),
    0
  );

  const addToCart = (product: Product, quantity = 1, notes?: string): OperationResult => {
    if (!product.available) {
      return {
        success: false,
        message: 'Produto indisponível no momento (RN09).',
      };
    }

    const store = establishments.find((e) => e.id === product.establishmentId);
    if (!store || store.approvalStatus !== 'ativo') {
      return {
        success: false,
        message: 'Este estabelecimento não está disponível para pedidos.',
      };
    }
    if (store.operationStatus !== 'aberto') {
      return {
        success: false,
        message: `O estabelecimento "${store.name}" está ${
          store.operationStatus === 'pausado' ? 'com pedidos pausados temporariamente' : 'fechado'
        }.`,
      };
    }

    // Se o carrinho tiver itens de outra loja, substitui após aviso ou limpa
    if (cart.length > 0 && cart[0].establishmentId !== product.establishmentId) {
      setCart([
        {
          productId: product.id,
          establishmentId: product.establishmentId,
          productName: product.name,
          unitPrice: product.price,
          imageUrl: product.imageUrl,
          quantity,
          notes,
        },
      ]);
      return {
        success: true,
        message: `Carrinho atualizado para a loja "${store.name}" com ${product.name}.`,
      };
    }

    setCart((prev) => {
      const existingIndex = prev.findIndex((i) => i.productId === product.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
          notes: notes || updated[existingIndex].notes,
        };
        return updated;
      }
      return [
        ...prev,
        {
          productId: product.id,
          establishmentId: product.establishmentId,
          productName: product.name,
          unitPrice: product.price,
          imageUrl: product.imageUrl,
          quantity,
          notes,
        },
      ];
    });

    return {
      success: true,
      message: `${product.name} adicionado ao seu carrinho!`,
    };
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, quantity } : item))
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const clearCart = () => setCart([]);

  // ---------------------------------------------------------------------------
  // 3. ENDEREÇOS DO CLIENTE (RF09, RF10)
  // ---------------------------------------------------------------------------
  const saveCustomerAddress = (
    addrInput: Omit<CustomerAddress, 'id' | 'customerId'> & { id?: string }
  ): OperationResult<CustomerAddress> => {
    if (!currentUser) {
      return { success: false, message: 'Faça login para salvar seu endereço.' };
    }
    if (!addrInput.cep || addrInput.cep.replace(/\D/g, '').length !== 8) {
      return {
        success: false,
        field: 'cep',
        message: 'O campo CEP (*) é obrigatório e deve ter 8 dígitos (00000-000).',
      };
    }
    if (!addrInput.street.trim()) {
      return {
        success: false,
        field: 'street',
        message: 'O campo Rua / Logradouro (*) é obrigatório.',
      };
    }
    if (!addrInput.number.trim()) {
      return {
        success: false,
        field: 'number',
        message: 'O campo Número (*) é obrigatório.',
      };
    }
    if (!addrInput.neighborhood.trim()) {
      return {
        success: false,
        field: 'neighborhood',
        message: 'O campo Bairro (*) é obrigatório.',
      };
    }

    const newAddr: CustomerAddress = {
      id: addrInput.id || `addr-${Date.now()}`,
      customerId: currentUser.id,
      label: addrInput.label || 'Casa',
      cep: addrInput.cep,
      street: addrInput.street.trim(),
      number: addrInput.number.trim(),
      neighborhood: addrInput.neighborhood.trim(),
      complement: addrInput.complement?.trim() || undefined,
      referencePoint: addrInput.referencePoint?.trim() || undefined,
      isDefault: addrInput.isDefault,
    };

    setAddresses((prev) => {
      const others = prev
        .filter((a) => a.id !== newAddr.id)
        .map((a) =>
          a.customerId === currentUser.id && newAddr.isDefault ? { ...a, isDefault: false } : a
        );
      return [newAddr, ...others];
    });

    return {
      success: true,
      message: 'Endereço salvo com sucesso!',
      data: newAddr,
    };
  };

  const setDefaultAddress = (addressId: string) => {
    if (!currentUser) return;
    setAddresses((prev) =>
      prev.map((a) =>
        a.customerId === currentUser.id ? { ...a, isDefault: a.id === addressId } : a
      )
    );
  };

  // ---------------------------------------------------------------------------
  // 4. REALIZAÇÃO E FLUXO DO PEDIDO (RF11 a RF19, RF29 a RF33, RN01 a RN12)
  // ---------------------------------------------------------------------------
  const placeOrder = (input: {
    idempotencyKey: string;
    address: CustomerAddress;
    phone: string;
    notes?: string;
    paymentMethod: PaymentMethod;
    needsChange: boolean;
    changeFor?: number;
  }): OperationResult<Order> => {
    if (!currentUser) {
      return { success: false, message: 'Você precisa estar logado para confirmar o pedido.' };
    }
    if (cart.length === 0 || !cartEstablishment) {
      return { success: false, message: 'Seu carrinho está vazio.' };
    }

    // RNF09: Prevenção de pedidos duplicados por chave de idempotência
    const existingDuplicate = orders.find((o) => o.idempotencyKey === input.idempotencyKey);
    if (existingDuplicate) {
      return {
        success: true,
        message: 'Pedido já registrado anteriormente (proteção contra envio duplicado ativa).',
        data: existingDuplicate,
      };
    }

    // Validação do endereço estruturado (RF09)
    if (
      !input.address.cep ||
      !input.address.street.trim() ||
      !input.address.number.trim() ||
      !input.address.neighborhood.trim()
    ) {
      return {
        success: false,
        field: 'address',
        message: 'Preencha todos os campos obrigatórios do endereço: CEP (*), Rua (*), Número (*) e Bairro (*).',
      };
    }

    if (!input.phone.trim() || input.phone.replace(/\D/g, '').length < 10) {
      return {
        success: false,
        field: 'phone',
        message: 'Informe um Telefone de contato (*) válido.',
      };
    }

    // Cálculo com precisão decimal (RNF08, Seção 16.2)
    const subtotal = cartSubtotal;
    const isPlatformDelivery = cartEstablishment.deliveryMode === 'plataforma';
    const deliveryFee = isPlatformDelivery
      ? settings.platformDeliveryFee
      : cartEstablishment.deliveryFee;
    const total = addMoney(subtotal, deliveryFee);

    // RF11: Se pagamento na entrega em dinheiro e precisa de troco, deve ser >= total
    if (input.paymentMethod === 'dinheiro_entrega' && input.needsChange) {
      if (!input.changeFor || input.changeFor < total) {
        return {
          success: false,
          field: 'changeFor',
          message: `O valor para troco deve ser igual ou maior que o total do pedido (R$ ${total
            .toFixed(2)
            .replace('.', ',')}).`,
        };
      }
    }

    const nextOrderNumber =
      orders.reduce((max, o) => Math.max(max, o.orderNumber), 1000) + 1;

    const effectiveCommissionPercent =
      cartEstablishment.commissionPercent ?? settings.defaultCommissionPercent;

    const now = new Date().toISOString();
    const newOrder: Order = {
      id: `ord-${nextOrderNumber}-${Date.now()}`,
      orderNumber: nextOrderNumber,
      idempotencyKey: input.idempotencyKey,
      customerId: currentUser.id,
      customerName: `${currentUser.firstName} ${currentUser.lastName}`,
      customerPhone: input.phone.trim(),
      establishmentId: cartEstablishment.id,
      establishmentName: cartEstablishment.name,
      establishmentPhone: cartEstablishment.phone,
      establishmentWhatsapp: cartEstablishment.whatsapp,
      establishmentPixKey: cartEstablishment.pixKey,
      establishmentNeighborhood: cartEstablishment.neighborhood,
      deliveryAddress: { ...input.address }, // Cópia congelada no momento do pedido (RN10)
      customerNotes: input.notes?.trim() || undefined,
      paymentMethod: input.paymentMethod,
      needsChange: input.paymentMethod === 'dinheiro_entrega' ? input.needsChange : false,
      changeFor:
        input.paymentMethod === 'dinheiro_entrega' && input.needsChange
          ? roundMoney(input.changeFor!)
          : undefined,
      items: cart.map((c, idx) => ({
        id: `item-${nextOrderNumber}-${idx + 1}`,
        productId: c.productId,
        productName: c.productName,
        unitPrice: c.unitPrice,
        quantity: c.quantity,
        subtotal: multiplyMoney(c.unitPrice, c.quantity),
        notes: c.notes,
      })),
      subtotal,
      deliveryFee,
      extraDeliveryFee: 0,
      total,
      commissionPercent: effectiveCommissionPercent,
      commissionAmount: 0, // RN05: Só gera comissão definitiva quando marcado como Concluído!
      deliveryResponsibility: isPlatformDelivery ? 'plataforma' : 'estabelecimento',
      status: 'aguardando_confirmacao',
      statusHistory: [
        {
          id: `hist-${Date.now()}`,
          previousStatus: null,
          newStatus: 'aguardando_confirmacao',
          changedByRole: 'cliente',
          changedByName: `${currentUser.firstName} ${currentUser.lastName}`,
          timestamp: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    // RF29: Novos pedidos entram no FIM da lista (ordem de chegada: mais antigo no topo)
    setOrders((prev) => [...prev, newOrder]);
    clearCart();

    // RF49: Dispara som e notificação push para o estabelecimento
    playNewOrderSound();
    triggerPushNotification(
      `🔔 Novo Pedido #${newOrder.orderNumber} — ${cartEstablishment.name}`,
      `${newOrder.customerName} pediu ${newOrder.items.length} item(ns) • Total R$ ${newOrder.total
        .toFixed(2)
        .replace('.', ',')}`
    );

    return {
      success: true,
      message: `Pedido #${newOrder.orderNumber} enviado! Aguardando confirmação do restaurante.`,
      data: newOrder,
    };
  };

  // RF30 / RF31: Lojista aceita o pedido e informa tempo estimado de preparo
  const acceptOrder = (
    orderId: string,
    prepTimeLabel: string,
    prepTimeMinutes: number
  ): OperationResult => {
    const target = orders.find((o) => o.id === orderId);
    if (!target) return { success: false, message: 'Pedido não encontrado.' };

    const check = validateOrderStatusTransition(target.status, 'aceito', 'lojista');
    if (!check.valid) return { success: false, message: check.message! };

    const now = new Date().toISOString();
    const store = establishments.find((e) => e.id === target.establishmentId);
    const shouldAutoDispatchDriver =
      store?.deliveryMode === 'plataforma' &&
      !rides.some((r) => r.orderId === target.id && r.status !== 'cancelada');

    let autoCreatedRideId: string | undefined;
    if (shouldAutoDispatchDriver) {
      const addr = target.deliveryAddress;
      const autoRide: DeliveryRide = {
        id: `ride-${Date.now()}`,
        orderId: target.id,
        orderNumber: target.orderNumber,
        establishmentId: target.establishmentId,
        establishmentName: target.establishmentName,
        pickupAddress: store?.address || 'Endereço da Loja',
        pickupNeighborhood: target.establishmentNeighborhood || 'Centro',
        dropoffNeighborhood: addr.neighborhood,
        fullCustomerAddress: `${addr.street}, nº ${addr.number} — ${addr.neighborhood} (CEP: ${addr.cep})${
          addr.complement ? ` — ${addr.complement}` : ''
        }`,
        customerName: target.customerName,
        customerPhone: target.customerPhone,
        rideType: 'inicial',
        chargedFee: settings.platformDeliveryFee,
        driverPayout: settings.driverPayoutAmount,
        platformRetention: settings.platformDeliveryRetention,
        status: 'solicitada',
        requestedAt: now,
        payoutSettled: false,
      };
      autoCreatedRideId = autoRide.id;
      setRides((prev) => [autoRide, ...prev]);
      playNewDeliveryRideSound();
      triggerPushNotification(
        `🛵 Nova Entrega Disponível — R$ ${settings.driverPayoutAmount
          .toFixed(2)
          .replace('.', ',')}`,
        `Retirada: ${autoRide.pickupNeighborhood} ➔ Entrega: ${autoRide.dropoffNeighborhood}`
      );
    }

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'aceito',
              prepTimeLabel,
              prepTimeMinutes,
              activeRideId: autoCreatedRideId ?? o.activeRideId,
              updatedAt: now,
              statusHistory: [
                ...o.statusHistory,
                {
                  id: `hist-${Date.now()}`,
                  previousStatus: o.status,
                  newStatus: 'aceito',
                  changedByRole: 'lojista',
                  changedByName: o.establishmentName,
                  reason: `Aceito com tempo estimado de preparo: ${prepTimeLabel}`,
                  timestamp: now,
                },
              ],
            }
          : o
      )
    );

    triggerPushNotification(
      `✅ Pedido #${target.orderNumber} Aceito!`,
      `${target.establishmentName} confirmou seu pedido. Tempo estimado: ${prepTimeLabel}.`
    );

    return {
      success: true,
      message: `Pedido #${target.orderNumber} aceito! Tempo estimado: ${prepTimeLabel}. ${
        target.paymentMethod === 'pix'
          ? 'A chave Pix já foi liberada para o cliente. '
          : ''
      }${
        shouldAutoDispatchDriver
          ? 'Os entregadores disponíveis foram notificados automaticamente!'
          : ''
      }`,
    };
  };

  // RF30 / RN04: Lojista recusa o pedido com motivo obrigatório (não gera comissão)
  const rejectOrder = (orderId: string, reason: string): OperationResult => {
    const target = orders.find((o) => o.id === orderId);
    if (!target) return { success: false, message: 'Pedido não encontrado.' };

    const check = validateOrderStatusTransition(target.status, 'recusado', 'lojista', reason);
    if (!check.valid) {
      return { success: false, field: check.field, message: check.message! };
    }

    const now = new Date().toISOString();
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'recusado',
              rejectionOrCancelReason: reason.trim(),
              commissionAmount: 0, // RN04: Pedidos recusados nunca geram comissão
              updatedAt: now,
              statusHistory: [
                ...o.statusHistory,
                {
                  id: `hist-${Date.now()}`,
                  previousStatus: o.status,
                  newStatus: 'recusado',
                  changedByRole: 'lojista',
                  changedByName: o.establishmentName,
                  reason: reason.trim(),
                  timestamp: now,
                },
              ],
            }
          : o
      )
    );

    return {
      success: true,
      message: `Pedido #${target.orderNumber} recusado. O motivo foi enviado ao cliente (sem geração de comissão).`,
    };
  };

  // RF32 / RF33 / RN05: Atualização de status e geração de comissão na conclusão
  const updateOrderStatus = (
    orderId: string,
    nextStatus: OrderStatus,
    reason?: string
  ): OperationResult => {
    const target = orders.find((o) => o.id === orderId);
    if (!target) return { success: false, message: 'Pedido não encontrado.' };

    const role: UserRole = currentUser?.role === 'administrador' ? 'administrador' : 'lojista';
    const check = validateOrderStatusTransition(target.status, nextStatus, role, reason);
    if (!check.valid) {
      return { success: false, field: check.field, message: check.message! };
    }

    const now = new Date().toISOString();
    // RN01 / RN05: Somente pedidos concluídos geram comissão sobre o subtotal dos produtos (taxa de entrega não entra!)
    const calculatedCommission =
      nextStatus === 'concluido'
        ? calculateCommission(target.subtotal, target.commissionPercent)
        : 0;

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: nextStatus,
              commissionAmount: calculatedCommission,
              rejectionOrCancelReason:
                nextStatus === 'cancelado' ? reason?.trim() : o.rejectionOrCancelReason,
              cancelledByRole: nextStatus === 'cancelado' ? role : o.cancelledByRole,
              updatedAt: now,
              statusHistory: [
                ...o.statusHistory,
                {
                  id: `hist-${Date.now()}`,
                  previousStatus: o.status,
                  newStatus: nextStatus,
                  changedByRole: role,
                  changedByName:
                    role === 'administrador' ? 'Administrador' : o.establishmentName,
                  reason: reason?.trim(),
                  timestamp: now,
                },
              ],
            }
          : o
      )
    );

    if (nextStatus === 'concluido') {
      const newComm: CommissionRecord = {
        id: `comm-${target.orderNumber}-${Date.now()}`,
        establishmentId: target.establishmentId,
        establishmentName: target.establishmentName,
        orderId: target.id,
        orderNumber: target.orderNumber,
        productsBaseAmount: target.subtotal,
        commissionPercent: target.commissionPercent,
        commissionAmount: calculatedCommission,
        status: 'pendente',
        generatedAt: now,
      };
      setCommissions((prev) => {
        if (prev.some((c) => c.orderId === target.id)) return prev;
        return [newComm, ...prev];
      });
    }

    if (nextStatus === 'cancelado') {
      // RN06: Pedidos cancelados não geram comissão
      setCommissions((prev) => prev.filter((c) => c.orderId !== target.id));
    }

    return {
      success: true,
      message:
        nextStatus === 'concluido'
          ? `Pedido #${target.orderNumber} concluído! Comissão de R$ ${calculatedCommission
              .toFixed(2)
              .replace('.', ',')} (${target.commissionPercent}% sobre R$ ${target.subtotal
              .toFixed(2)
              .replace('.', ',')} em produtos) registrada.`
          : `Status do Pedido #${target.orderNumber} atualizado com sucesso.`,
    };
  };

  // RF17 / RN06 / Critério 9: Cancelamento pelo cliente (permitido em Aguardando confirmação ou Aceito; bloqueado em Em preparação)
  const cancelOrderByCustomer = (orderId: string, reason?: string): OperationResult => {
    const target = orders.find((o) => o.id === orderId);
    if (!target) return { success: false, message: 'Pedido não encontrado.' };

    const check = validateOrderStatusTransition(
      target.status,
      'cancelado',
      'cliente',
      reason || 'Cancelado pelo cliente'
    );
    if (!check.valid) {
      return {
        success: false,
        field: check.field,
        message: check.message!,
      };
    }

    const now = new Date().toISOString();
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'cancelado',
              rejectionOrCancelReason: reason?.trim() || 'Cancelado diretamente pelo cliente',
              cancelledByRole: 'cliente',
              commissionAmount: 0,
              updatedAt: now,
              statusHistory: [
                ...o.statusHistory,
                {
                  id: `hist-${Date.now()}`,
                  previousStatus: o.status,
                  newStatus: 'cancelado',
                  changedByRole: 'cliente',
                  changedByName: o.customerName,
                  reason: reason?.trim() || 'Cancelado diretamente pelo cliente antes do preparo',
                  timestamp: now,
                },
              ],
            }
          : o
      )
    );

    return {
      success: true,
      message: `Pedido #${target.orderNumber} cancelado com sucesso.`,
    };
  };

  // ---------------------------------------------------------------------------
  // 5. PAINEL DO LOJISTA — EXPEDIENTE, CARDÁPIO, CATEGORIAS E DESTAQUES
  // ---------------------------------------------------------------------------
  const startMerchantShift = () => {
    unlockMerchantAudio();
    setMerchantAudioUnlocked(true);
  };

  const updateEstablishmentData = (
    establishmentId: string,
    patch: Partial<Establishment>
  ): OperationResult => {
    setEstablishments((prev) =>
      prev.map((e) => (e.id === establishmentId ? { ...e, ...patch } : e))
    );
    return {
      success: true,
      message: 'Configurações do estabelecimento salvas com sucesso!',
    };
  };

  const togglePauseEstablishment = (establishmentId: string): OperationResult => {
    const current = establishments.find((e) => e.id === establishmentId);
    const nextState: StoreOperationStatus =
      current?.operationStatus === 'pausado' ? 'aberto' : 'pausado';
    setEstablishments((prev) =>
      prev.map((e) => (e.id === establishmentId ? { ...e, operationStatus: nextState } : e))
    );
    return {
      success: true,
      message:
        nextState === 'pausado'
          ? 'Recebimento de novos pedidos pausado temporariamente (RF37).'
          : 'Estabelecimento reaberto para novos pedidos!',
    };
  };

  // RF22 / RN14: Criar categorias de cardápio sem permitir duplicidade (case-insensitive)
  const createMenuCategory = (
    establishmentId: string,
    name: string
  ): OperationResult<MenuCategory> => {
    const trimmed = name.trim();
    if (!trimmed) {
      return {
        success: false,
        field: 'categoryName',
        message: 'Informe o nome da categoria (*).',
      };
    }

    const duplicate = menuCategories.some(
      (c) =>
        c.establishmentId === establishmentId &&
        c.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      return {
        success: false,
        field: 'categoryName',
        message: `Categoria duplicada bloqueada (RN14): a categoria "${trimmed}" já existe neste cardápio.`,
      };
    }

    const storeCats = menuCategories.filter((c) => c.establishmentId === establishmentId);
    const maxOrder = storeCats.reduce((max, c) => Math.max(max, c.sortOrder), 0);

    const newCat: MenuCategory = {
      id: `mcat-${Date.now()}`,
      establishmentId,
      name: trimmed,
      sortOrder: maxOrder + 1,
    };

    setMenuCategories((prev) => [...prev, newCat]);
    return {
      success: true,
      message: `Categoria "${trimmed}" adicionada ao final do cardápio.`,
      data: newCat,
    };
  };

  // RF23: Definir manualmente a ordem das categorias (nunca alfabética)
  const moveMenuCategory = (categoryId: string, direction: 'up' | 'down') => {
    const target = menuCategories.find((c) => c.id === categoryId);
    if (!target) return;

    const siblings = menuCategories
      .filter((c) => c.establishmentId === target.establishmentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const idx = siblings.findIndex((c) => c.id === categoryId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;

    const currentCat = siblings[idx];
    const swapCat = siblings[swapIdx];

    setMenuCategories((prev) =>
      prev.map((c) => {
        if (c.id === currentCat.id) return { ...c, sortOrder: swapCat.sortOrder };
        if (c.id === swapCat.id) return { ...c, sortOrder: currentCat.sortOrder };
        return c;
      })
    );
  };

  const deleteMenuCategory = (categoryId: string): OperationResult => {
    const hasProducts = products.some((p) => p.categoryId === categoryId);
    if (hasProducts) {
      return {
        success: false,
        message: 'Remova ou mova os produtos desta categoria antes de excluí-la.',
      };
    }
    setMenuCategories((prev) => prev.filter((c) => c.id !== categoryId));
    return { success: true, message: 'Categoria removida.' };
  };

  // RF24 a RF27: Cadastrar/Editar produto com verificação do limite de 6 destaques
  const saveProduct = (
    input: Omit<Product, 'id' | 'sortOrder'> & { id?: string; sortOrder?: number }
  ): OperationResult<Product> => {
    if (!input.name.trim()) {
      return {
        success: false,
        field: 'name',
        message: 'O campo Nome do produto (*) é obrigatório.',
      };
    }
    if (!input.categoryId) {
      return {
        success: false,
        field: 'categoryId',
        message: 'Selecione uma Categoria (*) para o produto.',
      };
    }
    if (!input.price || input.price <= 0) {
      return {
        success: false,
        field: 'price',
        message: 'Informe um Preço (*) válido maior que R$ 0,00.',
      };
    }

    // RF27 / RN13: Máximo de 6 produtos em destaque por estabelecimento
    if (input.isFeatured) {
      const currentFeaturedCount = products.filter(
        (p) =>
          p.establishmentId === input.establishmentId &&
          p.isFeatured &&
          p.id !== input.id
      ).length;

      if (currentFeaturedCount >= 6) {
        return {
          success: false,
          field: 'isFeatured',
          message:
            'Limite atingido (RN13 / RF27): cada estabelecimento pode marcar no máximo 6 produtos em destaque (grade 3x2). Remova um destaque atual para escolher outro.',
        };
      }
    }

    const catProducts = products.filter(
      (p) => p.establishmentId === input.establishmentId && p.categoryId === input.categoryId
    );
    const maxSort = catProducts.reduce((max, p) => Math.max(max, p.sortOrder), 0);

    const saved: Product = {
      ...input,
      id: input.id || `prod-${Date.now()}`,
      establishmentId: input.establishmentId,
      categoryId: input.categoryId,
      name: input.name.trim(),
      description: input.description.trim(),
      price: roundMoney(input.price), // Precisão decimal (RNF08)
      originalPrice: input.originalPrice ? roundMoney(input.originalPrice) : undefined,
      discountPercent: input.discountPercent || undefined,
      imageUrl:
        input.imageUrl ||
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80',
      available: input.available,
      sortOrder: input.sortOrder ?? maxSort + 1,
      isFeatured: input.isFeatured,
    };

    setProducts((prev) => {
      const exists = prev.some((p) => p.id === saved.id);
      if (exists) {
        return prev.map((p) => (p.id === saved.id ? saved : p));
      }
      return [...prev, saved];
    });

    return {
      success: true,
      message: `Produto "${saved.name}" salvo com preço R$ ${saved.price
        .toFixed(2)
        .replace('.', ',')}!`,
      data: saved,
    };
  };

  const moveProductOrder = (productId: string, direction: 'up' | 'down') => {
    const target = products.find((p) => p.id === productId);
    if (!target) return;

    const siblings = products
      .filter(
        (p) => p.establishmentId === target.establishmentId && p.categoryId === target.categoryId
      )
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const idx = siblings.findIndex((p) => p.id === productId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;

    const currentProd = siblings[idx];
    const swapProd = siblings[swapIdx];

    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === currentProd.id) return { ...p, sortOrder: swapProd.sortOrder };
        if (p.id === swapProd.id) return { ...p, sortOrder: currentProd.sortOrder };
        return p;
      })
    );
  };

  // RF27 / Critério 16: Seis destaques são aceitos e o 7º é bloqueado com aviso visual
  const toggleProductFeatured = (productId: string): OperationResult => {
    const target = products.find((p) => p.id === productId);
    if (!target) return { success: false, message: 'Produto não encontrado.' };

    if (!target.isFeatured) {
      const count = products.filter(
        (p) => p.establishmentId === target.establishmentId && p.isFeatured
      ).length;
      if (count >= 6) {
        return {
          success: false,
          message:
            'Limite de 6 produtos em destaque atingido (grade 3x2 — RF27). Remova um item do destaque para adicionar outro.',
        };
      }
    }

    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, isFeatured: !p.isFeatured } : p))
    );

    return {
      success: true,
      message: !target.isFeatured
        ? `"${target.name}" adicionado aos Destaques (grade 3x2).`
        : `"${target.name}" removido dos Destaques.`,
    };
  };

  const toggleProductAvailable = (productId: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, available: !p.available } : p))
    );
  };

  const deleteProduct = (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  const duplicateProduct = (productId: string): OperationResult<Product> => {
    const source = products.find((p) => p.id === productId);
    if (!source) {
      return { success: false, message: 'Produto de origem não encontrado.' };
    }

    const catProducts = products.filter(
      (p) =>
        p.establishmentId === source.establishmentId &&
        p.categoryId === source.categoryId
    );
    const maxSort = catProducts.reduce((max, p) => Math.max(max, p.sortOrder), 0);

    const copy: Product = {
      ...source,
      id: `prod-${Date.now()}`,
      name: `${source.name} (Cópia)`,
      sortOrder: maxSort + 1,
      isFeatured: false, // Evita estourar o limite de 6 destaques automaticamente
    };

    setProducts((prev) => [...prev, copy]);
    return {
      success: true,
      message: `Produto "${source.name}" duplicado como "${copy.name}"! Você já pode editá-lo.`,
      data: copy,
    };
  };

  // ---------------------------------------------------------------------------
  // 6. FASE 2 — MÓDULO DE ENTREGADORES (MODELO HÍBRIDO — Seção 16)
  // ---------------------------------------------------------------------------
  const requestPlatformDriver = (
    orderId: string,
    rideType: 'inicial' | 'nova_viagem' = 'inicial',
    reason?: string
  ): OperationResult<DeliveryRide> => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return { success: false, message: 'Pedido não encontrado.' };

    if (order.status === 'aguardando_confirmacao') {
      return {
        success: false,
        message: 'Aceite o pedido primeiro antes de solicitar um entregador (RF55).',
      };
    }

    if (rideType === 'nova_viagem' && (!reason || !reason.trim())) {
      return {
        success: false,
        message: 'Informe o motivo para registrar uma nova viagem (RF60).',
      };
    }

    const store = establishments.find((e) => e.id === order.establishmentId);
    const addr = order.deliveryAddress;

    const newRide: DeliveryRide = {
      id: `ride-${Date.now()}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      establishmentId: order.establishmentId,
      establishmentName: order.establishmentName,
      pickupAddress: store?.address || 'Endereço da Loja',
      pickupNeighborhood: order.establishmentNeighborhood || 'Centro',
      dropoffNeighborhood: addr.neighborhood,
      fullCustomerAddress: `${addr.street}, nº ${addr.number} — ${addr.neighborhood} (CEP: ${addr.cep})${
        addr.complement ? ` — ${addr.complement}` : ''
      }`,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      rideType,
      reason: reason?.trim(),
      chargedFee: settings.platformDeliveryFee, // R$ 3,00
      driverPayout: settings.driverPayoutAmount, // R$ 2,50
      platformRetention: settings.platformDeliveryRetention, // R$ 0,50
      status: 'solicitada',
      requestedAt: new Date().toISOString(),
      payoutSettled: false,
    };

    setRides((prev) => [newRide, ...prev]);

    // Se for nova viagem (RF60 / RN17), adiciona R$ 3,00 ao pedido do cliente
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        const extra =
          rideType === 'nova_viagem'
            ? addMoney(o.extraDeliveryFee || 0, settings.platformDeliveryFee)
            : o.extraDeliveryFee || 0;
        const baseDelivery = settings.platformDeliveryFee;
        return {
          ...o,
          deliveryResponsibility: 'plataforma',
          deliveryFee: baseDelivery,
          extraDeliveryFee: extra,
          total: addMoney(o.subtotal, addMoney(baseDelivery, extra)),
          activeRideId: newRide.id,
        };
      })
    );

    // RF55 / RN15: Dispara alerta sonoro e notificação push para os entregadores disponíveis
    playNewDeliveryRideSound();
    triggerPushNotification(
      `🛵 Nova Entrega Disponível — R$ ${settings.driverPayoutAmount.toFixed(2).replace('.', ',')}`,
      `Retirada: ${newRide.pickupNeighborhood} ➔ Entrega: ${newRide.dropoffNeighborhood}`
    );

    return {
      success: true,
      message:
        rideType === 'nova_viagem'
          ? `Nova viagem solicitada (+R$ ${settings.platformDeliveryFee
              .toFixed(2)
              .replace('.', ',')})! Alerta sonoro e notificação enviados aos entregadores disponíveis.`
          : 'Entregadores disponíveis foram notificados por som e push com os bairros de retirada e entrega (RF55).',
      data: newRide,
    };
  };

  const startDriverShift = () => {
    unlockDriverAudio();
    setDriverAudioUnlocked(true);
  };

  // RF57: Reenviar notificação caso nenhum entregador tenha aceitado no prazo
  const resendDriverNotification = (rideId: string): OperationResult => {
    const ride = rides.find((r) => r.id === rideId);
    if (!ride) return { success: false, message: 'Corrida não encontrada.' };
    if (ride.status !== 'solicitada') {
      return {
        success: false,
        message: 'Esta corrida já foi aceita ou finalizada.',
      };
    }

    const now = new Date().toISOString();
    setRides((prev) =>
      prev.map((r) => (r.id === rideId ? { ...r, requestedAt: now } : r))
    );

    playNewDeliveryRideSound();
    triggerPushNotification(
      `🔔 Chamada Reenviada — Ganho R$ ${ride.driverPayout.toFixed(2).replace('.', ',')}`,
      `Retirada: ${ride.pickupNeighborhood} ➔ Entrega: ${ride.dropoffNeighborhood}`
    );

    return {
      success: true,
      message: 'Solicitação reenviada com alerta sonoro para todos os entregadores disponíveis (RF57)!',
    };
  };

  // RF57: Alternar pedido para entrega própria caso o estabelecimento prefira não aguardar entregador
  const switchOrderToOwnDelivery = (orderId: string): OperationResult => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return { success: false, message: 'Pedido não encontrado.' };

    const store = establishments.find((e) => e.id === order.establishmentId);
    const ownFee = store ? store.deliveryFee : order.deliveryFee;

    setRides((prev) =>
      prev.map((r) =>
        r.orderId === orderId && r.status === 'solicitada'
          ? { ...r, status: 'cancelada', reason: 'Estabelecimento assumiu com entrega própria (RF57)' }
          : r
      )
    );

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              deliveryResponsibility: 'estabelecimento',
              deliveryFee: ownFee,
              total: addMoney(o.subtotal, addMoney(ownFee, o.extraDeliveryFee || 0)),
              activeRideId: undefined,
            }
          : o
      )
    );

    return {
      success: true,
      message: 'Modalidade alterada para Entrega Própria da loja e chamada de corrida encerrada (RF57).',
    };
  };

  const toggleDriverAvailability = (driverId: string) => {
    unlockDriverAudio();
    setDriverAudioUnlocked(true);
    setDrivers((prev) =>
      prev.map((d) => (d.id === driverId ? { ...d, isAvailable: !d.isAvailable } : d))
    );
  };

  // RF56: O primeiro entregador a aceitar fica com a corrida e as demais notificações são encerradas
  const acceptDeliveryRide = (rideId: string, driverId: string): OperationResult => {
    const ride = rides.find((r) => r.id === rideId);
    if (!ride) return { success: false, message: 'Corrida não encontrada.' };
    if (ride.status !== 'solicitada') {
      return {
        success: false,
        message: 'Esta corrida já foi aceita por outro entregador (RF56).',
      };
    }

    const driver = drivers.find((d) => d.id === driverId);
    if (!driver || driver.approvalStatus !== 'ativo') {
      return {
        success: false,
        message: 'Apenas entregadores aprovados e ativos podem aceitar corridas (RN19).',
      };
    }

    const now = new Date().toISOString();
    setRides((prev) =>
      prev.map((r) =>
        r.id === rideId
          ? {
              ...r,
              driverId: driver.id,
              driverName: driver.name,
              status: 'aceita',
              acceptedAt: now,
            }
          : r
      )
    );

    return {
      success: true,
      message: 'Corrida aceita! O endereço completo e o telefone do cliente foram liberados (RN18).',
    };
  };

  // RF58: Entregador atualiza corrida (retirou, entregue)
  const updateDeliveryRideStatus = (
    rideId: string,
    nextStatus: 'retirada' | 'entregue'
  ): OperationResult => {
    const ride = rides.find((r) => r.id === rideId);
    if (!ride) return { success: false, message: 'Corrida não encontrada.' };

    const now = new Date().toISOString();
    setRides((prev) =>
      prev.map((r) =>
        r.id === rideId
          ? {
              ...r,
              status: nextStatus,
              pickedUpAt: nextStatus === 'retirada' ? now : r.pickedUpAt,
              deliveredAt: nextStatus === 'entregue' ? now : r.deliveredAt,
            }
          : r
      )
    );

    if (nextStatus === 'retirada') {
      updateOrderStatus(ride.orderId, 'saiu_para_entrega', 'Retirado pelo entregador parceiro');
    } else if (nextStatus === 'entregue') {
      updateOrderStatus(ride.orderId, 'concluido', 'Entregue pelo entregador parceiro');
    }

    return {
      success: true,
      message:
        nextStatus === 'entregue'
          ? `Entrega concluída! Seu repasse de R$ ${ride.driverPayout
              .toFixed(2)
              .replace('.', ',')} foi creditado no seu extrato quinzenal.`
          : 'Retirada confirmada! Pedido marcado como "Saiu para entrega".',
    };
  };

  // RF59: Entregador pode desistir antes da retirada com motivo registrado, e ela volta para a fila
  const abandonDeliveryRide = (rideId: string, reason: string): OperationResult => {
    const ride = rides.find((r) => r.id === rideId);
    if (!ride) return { success: false, message: 'Corrida não encontrada.' };
    if (ride.status !== 'aceita') {
      return {
        success: false,
        message: 'A desistência só é permitida antes da retirada do pedido no estabelecimento (RF59).',
      };
    }
    if (!reason.trim()) {
      return {
        success: false,
        message: 'Informe o motivo da desistência (*) para registro (RF59).',
      };
    }

    setRides((prev) =>
      prev.map((r) =>
        r.id === rideId
          ? {
              ...r,
              driverId: undefined,
              driverName: undefined,
              status: 'solicitada',
              acceptedAt: undefined,
              reason: `Devolvida à fila (${reason.trim()})`,
            }
          : r
      )
    );

    return {
      success: true,
      message: 'Você desistiu da corrida. Ela voltou para a fila de entregadores disponíveis (RF59).',
    };
  };

  // RN19: Administrador resolve corridas pendentes (devolve para a fila ou cancela sem cobrança)
  const cancelOrResolveRideByAdmin = (rideId: string, reason: string): OperationResult => {
    const ride = rides.find((r) => r.id === rideId);
    if (!ride) return { success: false, message: 'Corrida não encontrada.' };

    setRides((prev) =>
      prev.map((r) =>
        r.id === rideId
          ? {
              ...r,
              driverId: undefined,
              driverName: undefined,
              status: 'solicitada',
              acceptedAt: undefined,
              reason: reason.trim() || 'Reencaminhada para a fila pelo administrador (RN19)',
            }
          : r
      )
    );

    playNewDeliveryRideSound();
    recordAudit(
      'RESOLUCAO_CORRIDA_ADMIN',
      'DeliveryRide',
      rideId,
      `Administrador devolveu a corrida do Pedido #${ride.orderNumber} para a fila de entregadores disponíveis.`,
      reason
    );

    return {
      success: true,
      message: `Corrida do Pedido #${ride.orderNumber} devolvida para a fila de entregadores disponíveis (RN19).`,
    };
  };

  // ---------------------------------------------------------------------------
  // 7. ÁREA ADMINISTRATIVA (RF38 a RF48, RF62)
  // ---------------------------------------------------------------------------
  const toggleEstablishmentFeatured = (establishmentId: string): OperationResult => {
    const store = establishments.find((e) => e.id === establishmentId);
    if (!store) return { success: false, message: 'Estabelecimento não encontrado.' };

    const nextFeatured = !store.featured;
    setEstablishments((prev) =>
      prev.map((e) => (e.id === establishmentId ? { ...e, featured: nextFeatured } : e))
    );

    recordAudit(
      nextFeatured ? 'DESTAQUE_HOME_ATIVADO' : 'DESTAQUE_HOME_REMOVIDO',
      'Establishment',
      establishmentId,
      nextFeatured
        ? `Administrador definiu "${store.name}" como Loja em Destaque na tela inicial do cliente.`
        : `Administrador removeu "${store.name}" da seção Lojas em Destaque na tela inicial do cliente.`
    );

    return {
      success: true,
      message: nextFeatured
        ? `"${store.name}" agora aparece em "Lojas em destaque" na tela inicial do cliente!`
        : `"${store.name}" foi removida de "Lojas em destaque".`,
    };
  };

  const setEstablishmentApprovalStatus = (
    establishmentId: string,
    status: AccountStatus,
    justification?: string
  ): OperationResult => {
    const store = establishments.find((e) => e.id === establishmentId);
    if (!store) return { success: false, message: 'Estabelecimento não encontrado.' };

    setEstablishments((prev) =>
      prev.map((e) => (e.id === establishmentId ? { ...e, approvalStatus: status } : e))
    );

    recordAudit(
      `STATUS_LOJA_${status.toUpperCase()}`,
      'Establishment',
      establishmentId,
      `Alterou situação cadastral de "${store.name}" para "${status}".`,
      justification
    );

    return {
      success: true,
      message: `Situação da loja "${store.name}" atualizada para "${status}".`,
    };
  };

  const setDriverApprovalStatus = (
    driverId: string,
    status: AccountStatus
  ): OperationResult => {
    const drv = drivers.find((d) => d.id === driverId);
    if (!drv) return { success: false, message: 'Entregador não encontrado.' };

    setDrivers((prev) =>
      prev.map((d) =>
        d.id === driverId
          ? {
              ...d,
              approvalStatus: status,
              isAvailable: status === 'ativo' ? d.isAvailable : false,
            }
          : d
      )
    );
    setUsers((prev) =>
      prev.map((u) => (u.driverId === driverId ? { ...u, status } : u))
    );

    recordAudit(
      `STATUS_ENTREGADOR_${status.toUpperCase()}`,
      'DeliveryDriver',
      driverId,
      `Alterou situação do entregador "${drv.name}" para "${status}".`
    );

    return {
      success: true,
      message: `Entregador "${drv.name}" atualizado para "${status}".`,
    };
  };

  const setUserStatus = (userId: string, status: AccountStatus): OperationResult => {
    const usr = users.find((u) => u.id === userId);
    if (!usr) return { success: false, message: 'Usuário não encontrado.' };

    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status } : u)));
    recordAudit(
      `STATUS_USUARIO_${status.toUpperCase()}`,
      'UserProfile',
      userId,
      `Alterou situação do usuário "${usr.firstName} ${usr.lastName}" (${usr.email}) para "${status}".`
    );
    return {
      success: true,
      message: `Status de ${usr.firstName} alterado para "${status}".`,
    };
  };

  const updatePlatformSettings = (newSettings: PlatformSettings): OperationResult => {
    setSettings(newSettings);
    recordAudit(
      'ATUALIZACAO_CONFIG_COMERCIAL',
      'PlatformSettings',
      'global',
      `Atualizou comissão padrão para ${newSettings.defaultCommissionPercent}%, prazo de vencimento para ${newSettings.settlementDueDays} dias e taxa de entrega da plataforma para R$ ${newSettings.platformDeliveryFee.toFixed(2)}.`
    );
    return {
      success: true,
      message: 'Regras comerciais e parâmetros globais atualizados com sucesso!',
    };
  };

  const setStoreCustomCommission = (
    establishmentId: string,
    commissionPercent: number | null,
    justification: string
  ): OperationResult => {
    const store = establishments.find((e) => e.id === establishmentId);
    if (!store) return { success: false, message: 'Estabelecimento não encontrado.' };
    if (!justification.trim()) {
      return {
        success: false,
        message: 'Informe uma justificativa para registrar a alteração na auditoria (RF47 / RF48).',
      };
    }

    setEstablishments((prev) =>
      prev.map((e) => (e.id === establishmentId ? { ...e, commissionPercent } : e))
    );

    recordAudit(
      'EXCECAO_COMISSAO_LOJA',
      'Establishment',
      establishmentId,
      commissionPercent === null
        ? `Restaurou comissão padrão (${settings.defaultCommissionPercent}%) para "${store.name}".`
        : `Definiu comissão específica de ${commissionPercent}% para "${store.name}".`,
      justification.trim()
    );

    return {
      success: true,
      message: `Comissão de "${store.name}" atualizada com registro na auditoria.`,
    };
  };

  // RN11 / RN16: Fechamento Quinzenal (soma comissões de pedidos concluídos + taxas de corrida da plataforma)
  const closeBiweeklyPeriod = (
    periodLabel: string,
    periodStart: string,
    periodEnd: string
  ): OperationResult => {
    const dueDateObj = new Date(periodEnd);
    dueDateObj.setDate(dueDateObj.getDate() + settings.settlementDueDays);
    const dueDate = dueDateObj.toISOString().split('T')[0];

    const newSettlements: BiweeklySettlement[] = [];

    for (const store of establishments.filter((e) => e.approvalStatus === 'ativo')) {
      const storePendingComms = commissions.filter(
        (c) => c.establishmentId === store.id && c.status === 'pendente'
      );
      const storeDeliveredRides = rides.filter(
        (r) =>
          r.establishmentId === store.id &&
          r.status === 'entregue' &&
          !r.payoutSettled
      );

      if (storePendingComms.length === 0 && storeDeliveredRides.length === 0) continue;

      const totalProductsAmount = storePendingComms.reduce(
        (acc, c) => addMoney(acc, c.productsBaseAmount),
        0
      );
      const totalCommissionAmount = storePendingComms.reduce(
        (acc, c) => addMoney(acc, c.commissionAmount),
        0
      );
      const totalPlatformDeliveryFees = storeDeliveredRides.reduce(
        (acc, r) => addMoney(acc, r.chargedFee),
        0
      );
      const totalDriverPayouts = storeDeliveredRides.reduce(
        (acc, r) => addMoney(acc, r.driverPayout),
        0
      );
      const totalDueToPlatform = addMoney(totalCommissionAmount, totalPlatformDeliveryFees);

      const settlementId = `settle-${store.id}-${Date.now()}`;
      newSettlements.push({
        id: settlementId,
        establishmentId: store.id,
        establishmentName: store.name,
        periodLabel,
        periodStart,
        periodEnd,
        dueDate,
        ordersCount: storePendingComms.length,
        totalProductsAmount,
        totalCommissionAmount,
        totalPlatformDeliveryFees,
        totalDriverPayouts,
        totalDueToPlatform,
        status: 'fechado',
      });

      setCommissions((prev) =>
        prev.map((c) =>
          c.establishmentId === store.id && c.status === 'pendente'
            ? { ...c, status: 'fechada', settlementId }
            : c
        )
      );
    }

    if (newSettlements.length === 0) {
      return {
        success: false,
        message: 'Não há comissões ou corridas pendentes para fechar neste período.',
      };
    }

    setSettlements((prev) => [...newSettlements, ...prev]);
    recordAudit(
      'FECHAMENTO_QUINZENAL',
      'BiweeklySettlement',
      periodLabel,
      `Gerou fechamento quinzenal "${periodLabel}" para ${newSettlements.length} estabelecimento(s).`
    );

    return {
      success: true,
      message: `Fechamento quinzenal "${periodLabel}" gerado para ${newSettlements.length} loja(s)!`,
    };
  };

  // RF44: Registrar baixa de pagamento da quinzena pelo estabelecimento
  const markSettlementPaid = (settlementId: string): OperationResult => {
    const target = settlements.find((s) => s.id === settlementId);
    if (!target) return { success: false, message: 'Fechamento não encontrado.' };

    const now = new Date().toISOString();
    setSettlements((prev) =>
      prev.map((s) =>
        s.id === settlementId ? { ...s, status: 'pago', paidAt: now } : s
      )
    );
    setCommissions((prev) =>
      prev.map((c) =>
        c.settlementId === settlementId ? { ...c, status: 'paga', paidAt: now } : c
      )
    );

    recordAudit(
      'BAIXA_PAGAMENTO_COMISSAO',
      'BiweeklySettlement',
      settlementId,
      `Registrou o pagamento de R$ ${target.totalDueToPlatform
        .toFixed(2)
        .replace('.', ',')} da loja "${target.establishmentName}" (${target.periodLabel}).`
    );

    return {
      success: true,
      message: `Pagamento da quinzena de "${target.establishmentName}" registrado como PAGO!`,
    };
  };

  const markDriverRidesSettled = (driverId: string): OperationResult => {
    const drv = drivers.find((d) => d.id === driverId);
    if (!drv) return { success: false, message: 'Entregador não encontrado.' };

    setRides((prev) =>
      prev.map((r) =>
        r.driverId === driverId && r.status === 'entregue'
          ? { ...r, payoutSettled: true }
          : r
      )
    );

    recordAudit(
      'REPASSE_PIX_ENTREGADOR',
      'DeliveryDriver',
      driverId,
      `Registrou baixa de repasse quinzenal via Pix para o entregador "${drv.name}".`
    );

    return {
      success: true,
      message: `Repasses de "${drv.name}" baixados como pagos!`,
    };
  };

  const resetDemoDatabase = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SESSION_KEY);
    window.location.reload();
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        sessionExpiredModalOpen,
        setSessionExpiredModalOpen,
        loginWithPassword,
        loginWithGoogle,
        registerCustomer,
        registerDriver,
        switchDemoProfile,
        logout,
        settings,
        storeCategories,
        establishments,
        menuCategories,
        products,
        users,
        addresses,
        orders,
        commissions,
        settlements,
        drivers,
        rides,
        auditLogs,
        favorites,
        toggleFavorite,
        cart,
        cartEstablishment,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        cartSubtotal,
        saveCustomerAddress,
        setDefaultAddress,
        placeOrder,
        acceptOrder,
        rejectOrder,
        updateOrderStatus,
        cancelOrderByCustomer,
        merchantAudioUnlocked,
        startMerchantShift,
        updateEstablishmentData,
        togglePauseEstablishment,
        createMenuCategory,
        moveMenuCategory,
        deleteMenuCategory,
        saveProduct,
        duplicateProduct,
        moveProductOrder,
        toggleProductFeatured,
        toggleProductAvailable,
        deleteProduct,
        driverAudioUnlocked,
        startDriverShift,
        requestPlatformDriver,
        resendDriverNotification,
        switchOrderToOwnDelivery,
        toggleDriverAvailability,
        acceptDeliveryRide,
        updateDeliveryRideStatus,
        abandonDeliveryRide,
        cancelOrResolveRideByAdmin,
        setEstablishmentApprovalStatus,
        toggleEstablishmentFeatured,
        setDriverApprovalStatus,
        setUserStatus,
        updatePlatformSettings,
        setStoreCustomCommission,
        closeBiweeklyPeriod,
        markSettlementPaid,
        markDriverRidesSettled,
        resetDemoDatabase,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp deve ser usado dentro de um AppProvider');
  }
  return ctx;
}
