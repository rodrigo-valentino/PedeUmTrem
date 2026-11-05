import { createClient } from '@supabase/supabase-js';
import { OrderStatus, PaymentMethod } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('seu-projeto.supabase.co')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Chamadas RPC para as funções PostgreSQL com SECURITY DEFINER (Etapa 6, Seção 3):
 * - criar_pedido
 * - mudar_status_pedido
 * - solicitar_entregador
 * - aceitar_corrida
 * - fechar_quinzena
 */
export interface CriarPedidoRpcPayload {
  p_estabelecimento_id: string;
  p_itens: Array<{
    produto_id: string;
    quantidade: number;
    observacoes?: string;
  }>;
  p_cep: string;
  p_rua: string;
  p_numero: string;
  p_bairro: string;
  p_complemento?: string;
  p_referencia?: string;
  p_telefone_contato: string;
  p_observacoes?: string;
  p_forma_pagamento: PaymentMethod;
  p_valor_troco?: number | null;
  p_chave_idempotencia: string;
}

export async function rpcCriarPedido(payload: CriarPedidoRpcPayload): Promise<number | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('criar_pedido', payload);
  if (error) throw new Error(error.message);
  return Number(data);
}

export async function rpcMudarStatusPedido(params: {
  p_pedido_id: number;
  p_novo_status: OrderStatus;
  p_tempo_preparo_min?: number | null;
  p_motivo?: string | null;
}): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('mudar_status_pedido', params);
  if (error) throw new Error(error.message);
}

export async function rpcSolicitarEntregador(params: {
  p_pedido_id: number;
  p_tipo?: 'inicial' | 'nova_viagem';
  p_motivo?: string | null;
}): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('solicitar_entregador', params);
  if (error) throw new Error(error.message);
  return String(data);
}

export async function rpcAceitarCorrida(p_corrida_id: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('aceitar_corrida', { p_corrida_id });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function rpcFecharQuinzena(params?: {
  p_periodo_inicio?: string;
  p_periodo_fim?: string;
}): Promise<number> {
  if (!supabase) return 0;
  const { data, error } = await supabase.rpc('fechar_quinzena', params ?? {});
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}
