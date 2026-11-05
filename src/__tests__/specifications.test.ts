import { describe, expect, it } from 'vitest';
import {
  addMoney,
  calculateCommission,
  calculateDiscountPercent,
  calculatePromotionalPrice,
  formatBRL,
  maskCurrencyInput,
  multiplyMoney,
  parseBRLString,
} from '../utils/currency';
import {
  formatCEP,
  formatCNPJ,
  formatCPF,
  formatDocument,
  formatPhone,
  validateCEP,
  validateCNPJ,
  validateCPF,
  validateEmail,
  validateOrderStatusTransition,
  validatePassword,
  validatePhone,
} from '../utils/validation';
import {
  buildOpeningHoursSummary,
  normalizeSchedules,
} from '../components/forms/OpeningHoursSelector';
import { buildOrderWhatsAppSummary } from '../utils/whatsapp';
import { INITIAL_ORDERS } from '../data/seedData';

describe('PedeUmTrem — Protocolo de Testes Obrigatórios (DRS v1.1 Seção 13)', () => {
  describe('1. Autenticação e Senhas (RNF04, RNF07, RNF13)', () => {
    it('aceita e-mail válido e recusa e-mail inválido com mensagem clara', () => {
      expect(validateEmail('cliente@pedeumtrem.com.br').valid).toBe(true);
      const invalid = validateEmail('email_invalido');
      expect(invalid.valid).toBe(false);
      expect(invalid.field).toBe('email');
    });

    it('reprova senha com 7 caracteres', () => {
      const res = validatePassword('Trem123');
      expect(res.valid).toBe(false);
    });

    it('aprova senha com 8 caracteres contendo letras e números', () => {
      const res = validatePassword('Trem2026');
      expect(res.valid).toBe(true);
    });

    it('reprova senha com 8 caracteres sem números', () => {
      const res = validatePassword('ApenasLe');
      expect(res.valid).toBe(false);
    });
  });

  describe('2. Precisão Monetária, Campo de Preço e Comissão de 10% (RN01, RF26, RNF08)', () => {
    it('converte preço digitado com vírgula "R$ 12,50" exatamente para 12.50', () => {
      expect(parseBRLString('R$ 12,50')).toBe(12.5);
      expect(parseBRLString('89,90')).toBe(89.9);
      expect(formatBRL(12.5)).toContain('12,50');
    });

    it('calcula comissão de R$ 5,00 sobre pedido concluído de R$ 50,00 em produtos (sem incluir taxa de entrega)', () => {
      const productsSubtotal = 50.0;
      const deliveryFee = 5.0;
      const totalOrder = addMoney(productsSubtotal, deliveryFee);
      expect(totalOrder).toBe(55.0);

      const commission = calculateCommission(productsSubtotal, 10);
      expect(commission).toBe(5.0);
    });

    it('evita erros de ponto flutuante em multiplicações e somas de carrinho', () => {
      const itemSubtotal = multiplyMoney(19.9, 3);
      expect(itemSubtotal).toBe(59.7);
      expect(addMoney(0.1, 0.2)).toBe(0.3);
    });
  });

  describe('3. Máquina de Estados do Pedido e Regra de Cancelamento RN06 (Critério 9)', () => {
    it('permite que o cliente cancele em Aguardando confirmação e em Aceito', () => {
      expect(
        validateOrderStatusTransition('aguardando_confirmacao', 'cancelado', 'cliente').valid
      ).toBe(true);
      expect(validateOrderStatusTransition('aceito', 'cancelado', 'cliente').valid).toBe(
        true
      );
    });

    it('bloqueia o cancelamento direto pelo cliente quando o pedido está Em preparação', () => {
      const res = validateOrderStatusTransition('em_preparacao', 'cancelado', 'cliente');
      expect(res.valid).toBe(false);
      expect(res.message).toContain('RN06');
    });

    it('impede concluir um pedido que nunca foi aceito pelo estabelecimento (Seção 7)', () => {
      const res = validateOrderStatusTransition(
        'aguardando_confirmacao',
        'concluido',
        'lojista'
      );
      expect(res.valid).toBe(false);
    });

    it('exige motivo obrigatório quando o lojista recusa ou cancela um pedido (RF30, RF33)', () => {
      expect(
        validateOrderStatusTransition('aguardando_confirmacao', 'recusado', 'lojista', '')
          .valid
      ).toBe(false);
      expect(
        validateOrderStatusTransition(
          'aguardando_confirmacao',
          'recusado',
          'lojista',
          'Produto esgotado'
        ).valid
      ).toBe(true);
    });
  });

  describe('4. Endereço Estruturado com CEP e Resumo WhatsApp (RF09, RF19)', () => {
    it('formata e valida CEP no padrão 00000-000', () => {
      expect(formatCEP('30140071')).toBe('30140-071');
      expect(validateCEP('30140-071').valid).toBe(true);
      expect(validateCEP('3014').valid).toBe(false);
    });

    it('gera resumo completo para o botão Acompanhar pedido no WhatsApp (RF19)', () => {
      const summary = buildOrderWhatsAppSummary(INITIAL_ORDERS[1]);
      expect(summary).toContain('#1002');
      expect(summary).toContain('Vai Brasa');
      expect(summary).toContain('Picanha Angus na Brasa');
      expect(summary).toContain('Troco para');
      expect(summary).toContain('Rua da Bahia');
    });
  });

  describe('5. Máscaras de Formulários, Descontos Promocionais e Horários Múltiplos (UX)', () => {
    it('aplica máscara monetária progressiva e calcula descontos promocionais automaticamente', () => {
      expect(maskCurrencyInput('1250')).toBe('12,50');
      expect(maskCurrencyInput('10000')).toBe('100,00');
      expect(calculatePromotionalPrice(100, 15)).toBe(85);
      expect(calculateDiscountPercent(100, 80)).toBe(20);
    });

    it('formata e valida CPF, CNPJ e Telefone com precisão', () => {
      expect(formatCPF('52998224725')).toBe('529.982.247-25');
      expect(validateCPF('529.982.247-25').valid).toBe(true);
      expect(validateCPF('111.111.111-11').valid).toBe(false);

      expect(formatCNPJ('11222333000181')).toBe('11.222.333/0001-81');
      expect(validateCNPJ('11.222.333/0001-81').valid).toBe(true);
      expect(formatDocument('11222333000181')).toBe('11.222.333/0001-81');

      expect(formatPhone('31998765432')).toBe('(31) 99876-5432');
      expect(validatePhone('(31) 99876-5432').valid).toBe(true);
    });

    it('gera resumo automático de horários com múltiplos turnos, dias fechados e 24h', () => {
      const base = normalizeSchedules([]);
      // Configura Seg fechado e Ter a Dom com 2 turnos (Almoço e Jantar)
      const twoShifts = base.map((d) => ({
        ...d,
        isOpen: d.day !== 'Seg',
        is24Hours: false,
        intervals: [
          { open: '11:00', close: '14:30' },
          { open: '18:30', close: '23:00' },
        ],
      }));
      const summary = buildOpeningHoursSummary(twoShifts);
      expect(summary).toContain('Seg: Fechado');
      expect(summary).toContain('11:00 às 14:30 e 18:30 às 23:00');

      const all24h = base.map((d) => ({ ...d, isOpen: true, is24Hours: true }));
      expect(buildOpeningHoursSummary(all24h)).toContain('24 horas');
    });
  });
});
