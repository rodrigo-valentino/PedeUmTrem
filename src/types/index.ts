export type UserRole = 'cliente' | 'lojista' | 'administrador' | 'entregador';
export type AccountStatus = 'ativo' | 'pendente' | 'suspenso';
export type StoreOperationStatus = 'aberto' | 'fechado' | 'pausado';
export type DeliveryMode = 'propria' | 'plataforma' | 'ambos';
export type PaymentMethod = 'pix' | 'cartao_entrega' | 'dinheiro_entrega';

export type OrderStatus =
  | 'aguardando_confirmacao'
  | 'aceito'
  | 'em_preparacao'
  | 'pronto_para_entrega'
  | 'saiu_para_entrega'
  | 'concluido'
  | 'recusado'
  | 'cancelado';

export type CommissionStatus = 'pendente' | 'fechada' | 'paga' | 'cancelada';
export type SettlementStatus = 'aberto' | 'fechado' | 'pago' | 'vencido';
export type RideStatus = 'solicitada' | 'aceita' | 'retirada' | 'entregue' | 'cancelada';
export type RideType = 'inicial' | 'nova_viagem';
export type VehicleType = 'moto' | 'bicicleta' | 'carro';

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: UserRole;
  status: AccountStatus;
  authProvider: 'password' | 'google' | 'both';
  establishmentId?: string;
  driverId?: string;
  createdAt: string;
}

export interface CustomerAddress {
  id: string;
  customerId: string;
  label: string;
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
  complement?: string;
  referencePoint?: string;
  legacyFullAddress?: string; // Compatibilidade retroativa com endereços antigos em campo único
  isDefault: boolean;
}

export interface StoreCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string;
  active: boolean;
  sortOrder: number;
}

export interface ScheduleInterval {
  open: string;
  close: string;
}

export interface DaySchedule {
  day: string;
  open: string;
  close: string;
  isOpen: boolean;
  is24Hours?: boolean;
  intervals?: ScheduleInterval[];
}

export type UnitOfMeasure = 'un' | 'g' | 'kg' | 'ml' | 'l' | 'porcao' | 'combo';

export interface Establishment {
  id: string;
  ownerId: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string;
  logoUrl: string;
  coverUrl: string;
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  documentNumber?: string;
  address: string;
  neighborhood: string;
  phone: string;
  whatsapp: string;
  pixKey: string;
  pixKeyType: string;
  openingHours: string;
  schedules: DaySchedule[];
  deliveryFee: number;
  serviceArea: string;
  estimatedTimeMin: number;
  estimatedTimeMax: number;
  acceptedPayments: PaymentMethod[];
  deliveryMode: DeliveryMode;
  commissionPercent: number | null; // null usa o padrão da plataforma (10%)
  operationStatus: StoreOperationStatus;
  approvalStatus: AccountStatus;
  rating: number;
  featured: boolean;
  createdAt: string;
}

export interface MenuCategory {
  id: string;
  establishmentId: string;
  name: string;
  sortOrder: number;
}

export interface Product {
  id: string;
  establishmentId: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  unitOfMeasure?: UnitOfMeasure;
  unitQuantity?: number;
  trackStock?: boolean;
  stockQuantity?: number | null;
  brand?: string;
  servesPeople?: number;
  prepTimeEstimate?: number;
  requiresAgeCheck?: boolean;
  imageUrl: string;
  available: boolean;
  sortOrder: number;
  isFeatured: boolean;
}

export interface CartItem {
  productId: string;
  establishmentId: string;
  productName: string;
  unitPrice: number;
  imageUrl: string;
  quantity: number;
  notes?: string;
}

export interface OrderItemSnapshot {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  notes?: string;
}

export interface OrderStatusHistoryItem {
  id: string;
  previousStatus: OrderStatus | null;
  newStatus: OrderStatus;
  changedByRole: UserRole;
  changedByName: string;
  reason?: string;
  timestamp: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  idempotencyKey: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  establishmentId: string;
  establishmentName: string;
  establishmentPhone: string;
  establishmentWhatsapp: string;
  establishmentPixKey: string;
  establishmentNeighborhood: string;
  deliveryAddress: CustomerAddress;
  customerNotes?: string;
  paymentMethod: PaymentMethod;
  needsChange: boolean;
  changeFor?: number;
  items: OrderItemSnapshot[];
  subtotal: number;
  deliveryFee: number;
  extraDeliveryFee: number; // R$ 3,00 adicionais se houver repetição de viagem (Fase 2)
  total: number;
  prepTimeLabel?: string;
  prepTimeMinutes?: number;
  commissionPercent: number;
  commissionAmount: number;
  deliveryResponsibility: 'estabelecimento' | 'plataforma';
  status: OrderStatus;
  rejectionOrCancelReason?: string;
  cancelledByRole?: UserRole;
  statusHistory: OrderStatusHistoryItem[];
  activeRideId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommissionRecord {
  id: string;
  establishmentId: string;
  establishmentName: string;
  orderId: string;
  orderNumber: number;
  settlementId?: string;
  productsBaseAmount: number;
  commissionPercent: number;
  commissionAmount: number;
  status: CommissionStatus;
  generatedAt: string;
  paidAt?: string;
}

export interface BiweeklySettlement {
  id: string;
  establishmentId: string;
  establishmentName: string;
  periodLabel: string; // Ex: "1ª Quinzena Nov/2026 (01/11 a 15/11)"
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  ordersCount: number;
  totalProductsAmount: number;
  totalCommissionAmount: number;
  totalPlatformDeliveryFees: number; // R$ 3,00 por corrida entregue pela plataforma
  totalDriverPayouts: number;        // R$ 2,50 por corrida entregue
  totalDueToPlatform: number;        // Comissões + taxas de corrida da plataforma
  status: SettlementStatus;
  paidAt?: string;
}

export interface DeliveryDriver {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  vehicle: VehicleType;
  pixKey: string;
  approvalStatus: AccountStatus;
  isAvailable: boolean;
  createdAt: string;
}

export interface DeliveryRide {
  id: string;
  orderId: string;
  orderNumber: number;
  establishmentId: string;
  establishmentName: string;
  pickupAddress: string;
  pickupNeighborhood: string;
  dropoffNeighborhood: string;
  // Dados sensíveis protegidos por RN18 (exibidos na interface do entregador apenas após o aceite)
  fullCustomerAddress: string;
  customerName: string;
  customerPhone: string;
  driverId?: string;
  driverName?: string;
  rideType: RideType;
  reason?: string;
  chargedFee: number;        // R$ 3,00 padrão
  driverPayout: number;      // R$ 2,50 padrão
  platformRetention: number; // R$ 0,50 padrão
  status: RideStatus;
  requestedAt: string;
  acceptedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  payoutSettled: boolean;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  actionType: string;
  targetEntity: string;
  targetId: string;
  description: string;
  justification?: string;
  createdAt: string;
}

export interface PlatformSettings {
  defaultCommissionPercent: number;
  settlementDueDays: number;
  platformDeliveryFee: number;
  driverPayoutAmount: number;
  platformDeliveryRetention: number;
  driverAcceptTimeoutMinutes: number;
}
