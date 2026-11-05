// =============================================================================
// PedeUmTrem — Supabase Edge Function: enviar-push (Etapa 6, Seção 1 e 5)
// Acionada por Database Webhook quando um pedido é criado ou muda de status,
// ou quando uma nova corrida é disponibilizada para entregadores.
// Segredos usados apenas no servidor (nunca no frontend):
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY
//   - VAPID_PUBLIC_KEY
//   - VAPID_PRIVATE_KEY
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE';
  table: 'pedidos' | 'corridas';
  record: Record<string, unknown>;
  old_record?: Record<string, unknown> | null;
}

Deno.serve(async (req: Request) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ erro: 'Variáveis SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const payload = (await req.json()) as WebhookPayload;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const destinatariosIds: string[] = [];
    let titulo = 'PedeUmTrem';
    let corpo = 'Você tem uma atualização no PedeUmTrem.';

    if (payload.table === 'pedidos') {
      const pedidoId = payload.record.id;
      const statusNovo = String(payload.record.status || '');
      const clienteId = String(payload.record.cliente_id || '');
      const estabelecimentoId = String(payload.record.estabelecimento_id || '');

      if (payload.type === 'INSERT') {
        // Novo pedido -> notifica o dono da loja
        const { data: loja } = await supabaseAdmin
          .from('estabelecimentos')
          .select('dono_id, nome')
          .eq('id', estabelecimentoId)
          .single();

        if (loja?.dono_id) {
          destinatariosIds.push(loja.dono_id);
          titulo = `Novo pedido #${pedidoId}!`;
          corpo = `Um novo pedido acabou de chegar para ${loja.nome}.`;
        }
      } else if (payload.type === 'UPDATE') {
        // Mudança de status -> notifica o cliente
        if (clienteId) {
          destinatariosIds.push(clienteId);
          titulo = `Pedido #${pedidoId} atualizado`;
          corpo = `Novo status do seu pedido: ${statusNovo.replaceAll('_', ' ')}.`;
        }
      }
    } else if (payload.table === 'corridas' && payload.type === 'INSERT') {
      // Nova corrida solicitada -> notifica entregadores disponíveis
      const { data: entregadores } = await supabaseAdmin
        .from('entregadores')
        .select('perfil_id')
        .eq('situacao', 'aprovado')
        .eq('disponivel', true);

      for (const ent of entregadores ?? []) {
        destinatariosIds.push(ent.perfil_id);
      }
      titulo = 'Nova entrega disponível!';
      corpo = 'Uma loja parceira acabou de chamar entregador no PedeUmTrem.';
    }

    if (destinatariosIds.length === 0) {
      return new Response(
        JSON.stringify({ enviado: 0, mensagem: 'Nenhum destinatário elegível.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: inscricoes } = await supabaseAdmin
      .from('push_inscricoes')
      .select('id, usuario_id, endpoint, chaves')
      .in('usuario_id', destinatariosIds);

    return new Response(
      JSON.stringify({
        enviado: inscricoes?.length ?? 0,
        notificacao: { titulo, corpo },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ erro: err instanceof Error ? err.message : 'Erro interno' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
