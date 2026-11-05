import { Order } from '../types';
import { formatBRL, roundMoney } from './currency';

/**
 * RF19 / Critério 11 — Gera o resumo estruturado do pedido e link para o botão
 * "Acompanhar pedido no WhatsApp".
 * Contém obrigatoriamente:
 * - Número do pedido
 * - Itens e quantidades
 * - Subtotal, taxa de entrega e total
 * - Forma de pagamento (com valor para troco, se for dinheiro)
 * - Endereço completo de entrega
 */
export function buildOrderWhatsAppSummary(order: Order): string {
  const paymentLabels = {
    pix: 'Pix (pagamento direto ao estabelecimento)',
    cartao_entrega: 'Cartão na entrega',
    dinheiro_entrega: 'Dinheiro na entrega',
  };

  let paymentLine = `💳 *Forma de pagamento:* ${paymentLabels[order.paymentMethod]}`;
  if (order.paymentMethod === 'dinheiro_entrega') {
    if (order.needsChange && order.changeFor && order.changeFor >= order.total) {
      const changeAmount = roundMoney(order.changeFor - order.total);
      paymentLine += ` (Troco para ${formatBRL(order.changeFor)} -> levar ${formatBRL(changeAmount)} de troco)`;
    } else {
      paymentLine += ' (Não precisa de troco)';
    }
  }

  const itemsText = order.items
    .map(
      (item) =>
        `• ${item.quantity}x ${item.productName} — ${formatBRL(item.subtotal)}${
          item.notes ? ` _(${item.notes})_` : ''
        }`
    )
    .join('\n');

  const addr = order.deliveryAddress;
  const addressParts = [
    `${addr.street}, nº ${addr.number}`,
    addr.neighborhood,
    `CEP: ${addr.cep}`,
    addr.complement ? `Compl.: ${addr.complement}` : '',
    addr.referencePoint ? `Ref.: ${addr.referencePoint}` : '',
  ].filter(Boolean);

  const totalDelivery = roundMoney(order.deliveryFee + (order.extraDeliveryFee || 0));

  const lines = [
    `🟢 *PedeUmTrem — Resumo do Pedido #${order.orderNumber}*`,
    `🏪 *Estabelecimento:* ${order.establishmentName}`,
    `👤 *Cliente:* ${order.customerName} (${order.customerPhone})`,
    '',
    '📦 *Itens do Pedido:*',
    itemsText,
    '',
    `🧾 *Subtotal dos produtos:* ${formatBRL(order.subtotal)}`,
    `🛵 *Taxa de entrega:* ${formatBRL(totalDelivery)}`,
    `💰 *Total do pedido:* *${formatBRL(order.total)}*`,
    paymentLine,
    '',
    `📍 *Endereço de entrega:*`,
    addressParts.join(' — '),
    order.customerNotes ? `📝 *Observações:* ${order.customerNotes}` : '',
  ].filter((l) => l !== undefined);

  return lines.join('\n').trim();
}

export function getOrderWhatsAppUrl(order: Order): string {
  const summary = buildOrderWhatsAppSummary(order);
  const digits = (order.establishmentWhatsapp || order.establishmentPhone || '').replace(/\D/g, '');
  const phoneWithCountry = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(summary)}`;
}
