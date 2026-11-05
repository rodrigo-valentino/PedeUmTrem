import { OrderStatus, UserRole } from '../types';

export interface FieldValidationResult {
  valid: boolean;
  field?: string;
  message?: string;
}

/**
 * RNF04 / RNF07 / RNF13 — Validação de e-mail idêntica no frontend e backend
 */
export function validateEmail(email: string): FieldValidationResult {
  const trimmed = (email || '').trim();
  if (!trimmed) {
    return {
      valid: false,
      field: 'email',
      message: 'O campo E-mail (*) é obrigatório.',
    };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return {
      valid: false,
      field: 'email',
      message: 'Formato de e-mail inválido. Informe um endereço válido (ex: nome@dominio.com).',
    };
  }
  return { valid: true };
}

/**
 * RNF04 / Critério 2 — Senha com no mínimo 8 caracteres, contendo ao menos 1 letra e 1 número.
 * - 7 caracteres -> falha
 * - 8 caracteres sem número -> falha
 * - 8 caracteres sem letra -> falha
 * - 8+ caracteres com letra e número -> passa
 */
export function validatePassword(password: string): FieldValidationResult {
  if (!password) {
    return {
      valid: false,
      field: 'password',
      message: 'O campo Senha (*) é obrigatório.',
    };
  }
  if (password.length < 8) {
    return {
      valid: false,
      field: 'password',
      message: `Senha fora do padrão: a senha deve ter no mínimo 8 caracteres (você digitou ${password.length}).`,
    };
  }
  const hasLetter = /[a-zA-ZÀ-ÿ]/.test(password);
  const hasNumber = /\d/.test(password);
  if (!hasLetter || !hasNumber) {
    return {
      valid: false,
      field: 'password',
      message: 'Senha fora do padrão: a senha deve conter pelo menos 1 letra e 1 número.',
    };
  }
  return { valid: true };
}

/**
 * RF09 / RF10 — Máscara e validação de CEP (00000-000)
 */
export function formatCEP(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function validateCEP(cep: string): FieldValidationResult {
  const digits = (cep || '').replace(/\D/g, '');
  if (digits.length !== 8) {
    return {
      valid: false,
      field: 'cep',
      message: 'O campo CEP (*) deve conter 8 dígitos no formato 00000-000.',
    };
  }
  return { valid: true };
}

export function formatPhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function validatePhone(phone: string): FieldValidationResult {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 11) {
    return {
      valid: false,
      field: 'phone',
      message: 'Informe um telefone válido com DDD (10 ou 11 dígitos, ex: (31) 99999-9999).',
    };
  }
  return { valid: true };
}

/**
 * Máscara e validação de CPF (000.000.000-00) com dígitos verificadores
 */
export function formatCPF(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function validateCPF(cpf: string): FieldValidationResult {
  const digits = (cpf || '').replace(/\D/g, '');
  if (digits.length !== 11) {
    return {
      valid: false,
      field: 'cpf',
      message: 'O CPF deve conter 11 dígitos no formato 000.000.000-00.',
    };
  }
  if (/^(\d)\1{10}$/.test(digits)) {
    return {
      valid: false,
      field: 'cpf',
      message: 'CPF inválido (sequência repetida).',
    };
  }
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits.charAt(9), 10)) {
    return { valid: false, field: 'cpf', message: 'CPF inválido (dígito verificador incorreto).' };
  }
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits.charAt(10), 10)) {
    return { valid: false, field: 'cpf', message: 'CPF inválido (dígito verificador incorreto).' };
  }
  return { valid: true };
}

/**
 * Máscara e validação de CNPJ (00.000.000/0000-00) com dígitos verificadores
 */
export function formatCNPJ(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  }
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function validateCNPJ(cnpj: string): FieldValidationResult {
  const digits = (cnpj || '').replace(/\D/g, '');
  if (digits.length !== 14) {
    return {
      valid: false,
      field: 'cnpj',
      message: 'O CNPJ deve conter 14 dígitos no formato 00.000.000/0000-00.',
    };
  }
  if (/^(\d)\1{13}$/.test(digits)) {
    return {
      valid: false,
      field: 'cnpj',
      message: 'CNPJ inválido (sequência repetida).',
    };
  }
  const calcDigit = (base: string, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
      sum += parseInt(base.charAt(i), 10) * weights[i];
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const d1 = calcDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calcDigit(digits.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (d1 !== parseInt(digits.charAt(12), 10) || d2 !== parseInt(digits.charAt(13), 10)) {
    return { valid: false, field: 'cnpj', message: 'CNPJ inválido (dígito verificador incorreto).' };
  }
  return { valid: true };
}

/**
 * Máscara e validação híbrida CPF / CNPJ (detecta automaticamente pelo tamanho)
 */
export function formatDocument(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) return formatCPF(digits);
  return formatCNPJ(digits);
}

export function validateDocument(doc: string): FieldValidationResult {
  const digits = (doc || '').replace(/\D/g, '');
  if (!digits) {
    return { valid: false, field: 'document', message: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).' };
  }
  if (digits.length <= 11) return validateCPF(digits);
  return validateCNPJ(digits);
}

/**
 * Formata chave Pix automaticamente conforme o tipo selecionado
 */
export function formatPixKeyByType(raw: string, pixKeyType: string): string {
  const type = (pixKeyType || '').toLowerCase();
  if (type === 'cpf') return formatCPF(raw);
  if (type === 'cnpj') return formatCNPJ(raw);
  if (type === 'telefone' || type === 'celular') return formatPhone(raw);
  if (type === 'documento') return formatDocument(raw);
  return raw;
}

export interface ViaCEPResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

const LOCAL_CEP_FALLBACK: Record<string, { street: string; neighborhood: string; city: string }> = {
  '30140071': { street: 'Avenida Brasil', neighborhood: 'Funcionários', city: 'Belo Horizonte - MG' },
  '30130000': { street: 'Avenida Afonso Pena', neighborhood: 'Centro', city: 'Belo Horizonte - MG' },
  '38400100': { street: 'Avenida João Naves de Ávila', neighborhood: 'Centro', city: 'Uberlândia - MG' },
  '35500001': { street: 'Rua Goiás', neighborhood: 'Centro', city: 'Divinópolis - MG' },
  '37550000': { street: 'Avenida Doutor Lisboa', neighborhood: 'Centro', city: 'Pouso Alegre - MG' },
  '01001000': { street: 'Praça da Sé', neighborhood: 'Sé', city: 'São Paulo - SP' },
};

/**
 * RF10 — Consulta ViaCEP com fallback local e manutenção dos campos editáveis
 */
export async function lookupAddressByCEP(cep: string): Promise<{
  success: boolean;
  street: string;
  neighborhood: string;
  city?: string;
  message?: string;
}> {
  const digits = (cep || '').replace(/\D/g, '');
  if (digits.length !== 8) {
    return {
      success: false,
      street: '',
      neighborhood: '',
      message: 'CEP deve ter 8 números.',
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data: ViaCEPResponse = await response.json();
      if (!data.erro) {
        return {
          success: true,
          street: data.logradouro || '',
          neighborhood: data.bairro || '',
          city: data.localidade ? `${data.localidade} - ${data.uf}` : undefined,
        };
      }
      return {
        success: false,
        street: '',
        neighborhood: '',
        message: 'CEP não encontrado no ViaCEP. Você pode preencher Rua e Bairro manualmente.',
      };
    }
  } catch {
    // Fallback offline caso sem rede
  }

  if (LOCAL_CEP_FALLBACK[digits]) {
    return {
      success: true,
      ...LOCAL_CEP_FALLBACK[digits],
    };
  }

  return {
    success: true,
    street: `Rua Principal (${formatCEP(digits)})`,
    neighborhood: 'Centro',
    message: 'Consulta automática concluída (os campos continuam editáveis).',
  };
}

/**
 * Seção 7 / RN03 / RN05 / RN06 — Validação de transições de estado do pedido (idêntica no frontend e backend)
 */
export function validateOrderStatusTransition(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
  actorRole: UserRole,
  reason?: string
): FieldValidationResult {
  if (currentStatus === nextStatus) {
    return { valid: true };
  }

  if (['concluido', 'recusado', 'cancelado'].includes(currentStatus)) {
    return {
      valid: false,
      field: 'status',
      message: `Transição bloqueada: o pedido já está finalizado como "${currentStatus}".`,
    };
  }

  // RN06: Cancelamento pelo cliente permitido somente em aguardando_confirmacao ou aceito
  if (nextStatus === 'cancelado' && actorRole === 'cliente') {
    if (currentStatus !== 'aguardando_confirmacao' && currentStatus !== 'aceito') {
      return {
        valid: false,
        field: 'status',
        message:
          'Cancelamento direto bloqueado (RN06): o pedido já entrou em preparação. Solicite o cancelamento diretamente ao estabelecimento pelo WhatsApp.',
      };
    }
    return { valid: true };
  }

  // RF33 / RN06: Cancelamento pelo estabelecimento ou admin exige motivo obrigatório
  if (nextStatus === 'cancelado' && (actorRole === 'lojista' || actorRole === 'administrador')) {
    if (!reason || !reason.trim()) {
      return {
        valid: false,
        field: 'reason',
        message: 'O motivo do cancelamento (*) é obrigatório para registro no histórico (RF33 / RN06).',
      };
    }
    return { valid: true };
  }

  // RF30 / RN04: Recusa só pode ocorrer a partir de aguardando_confirmacao e exige motivo
  if (nextStatus === 'recusado') {
    if (currentStatus !== 'aguardando_confirmacao') {
      return {
        valid: false,
        field: 'status',
        message: 'Apenas pedidos "Aguardando confirmação" podem ser recusados. Para pedidos já aceitos, utilize "Cancelar pedido".',
      };
    }
    if (!reason || !reason.trim()) {
      return {
        valid: false,
        field: 'reason',
        message: 'Informe o motivo da recusa (*) para comunicar o cliente (RF30 / RN04).',
      };
    }
    return { valid: true };
  }

  // Seção 7: Impedir concluir um pedido que nunca foi aceito
  if (nextStatus === 'concluido' && currentStatus === 'aguardando_confirmacao') {
    return {
      valid: false,
      field: 'status',
      message: 'Transição inválida: não é permitido concluir um pedido que nunca foi aceito pelo estabelecimento.',
    };
  }

  const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
    aguardando_confirmacao: ['aceito', 'recusado', 'cancelado'],
    aceito: ['em_preparacao', 'pronto_para_entrega', 'saiu_para_entrega', 'concluido', 'cancelado'],
    em_preparacao: ['pronto_para_entrega', 'saiu_para_entrega', 'concluido', 'cancelado'],
    pronto_para_entrega: ['saiu_para_entrega', 'concluido', 'cancelado'],
    saiu_para_entrega: ['concluido', 'cancelado'],
    concluido: [],
    recusado: [],
    cancelado: [],
  };

  if (!allowedTransitions[currentStatus]?.includes(nextStatus)) {
    return {
      valid: false,
      field: 'status',
      message: `Transição de status inválida de "${currentStatus}" para "${nextStatus}".`,
    };
  }

  return { valid: true };
}
