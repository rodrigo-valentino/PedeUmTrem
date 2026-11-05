-- =============================================================================
-- PedeUmTrem — Projeto Técnico (Etapa 6)
-- Arquitetura: Cloudflare Pages (PWA) + Supabase (PostgreSQL, RLS, Auth, Storage, Realtime, Edge Functions)
-- Modelo de dados 100% em português (snake_case), dinheiro em numeric(10,2),
-- chaves uuid exceto pedidos (sequencial para fácil citação no WhatsApp).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. TABELAS DE CONFIGURAÇÃO, PESSOAS E LOJAS (Seção 2 da Etapa 6)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS configuracoes (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO configuracoes (chave, valor) VALUES
  ('comissao_padrao', '10.00'),
  ('prazo_pagamento_dias', '5'),
  ('taxa_entrega_plataforma', '3.00'),
  ('repasse_entregador', '2.50'),
  ('retencao_plataforma', '0.50')
ON CONFLICT (chave) DO NOTHING;

CREATE TABLE IF NOT EXISTS perfis (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  sobrenome TEXT NOT NULL DEFAULT '',
  telefone TEXT NOT NULL,
  papel TEXT NOT NULL DEFAULT 'cliente' CHECK (papel IN ('cliente', 'lojista', 'admin', 'entregador')),
  situacao TEXT NOT NULL DEFAULT 'ativo' CHECK (situacao IN ('ativo', 'suspenso')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS enderecos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
  apelido TEXT NOT NULL DEFAULT 'Casa',
  cep VARCHAR(9) NOT NULL,
  rua TEXT NOT NULL,
  numero TEXT NOT NULL,
  bairro TEXT NOT NULL,
  complemento TEXT,
  referencia TEXT,
  padrao BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS categorias_estabelecimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  ativa BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS estabelecimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dono_id UUID NOT NULL REFERENCES perfis(id) ON DELETE RESTRICT,
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria_id UUID REFERENCES categorias_estabelecimento(id),
  telefone TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  cep VARCHAR(9) NOT NULL,
  rua TEXT NOT NULL,
  numero TEXT NOT NULL,
  bairro TEXT NOT NULL,
  capa_url TEXT,
  taxa_entrega NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (taxa_entrega >= 0),
  areas_atendimento TEXT[] NOT NULL DEFAULT ARRAY['Centro']::TEXT[],
  tempo_estimado_min INT NOT NULL DEFAULT 35 CHECK (tempo_estimado_min > 0),
  aceita_pix BOOLEAN NOT NULL DEFAULT TRUE,
  aceita_cartao BOOLEAN NOT NULL DEFAULT TRUE,
  aceita_dinheiro BOOLEAN NOT NULL DEFAULT TRUE,
  chave_pix TEXT,
  comissao_percentual NUMERIC(5,2) DEFAULT NULL CHECK (comissao_percentual IS NULL OR (comissao_percentual >= 0 AND comissao_percentual <= 100)),
  modo_entrega TEXT NOT NULL DEFAULT 'propria' CHECK (modo_entrega IN ('propria', 'plataforma', 'ambos')),
  situacao TEXT NOT NULL DEFAULT 'pendente' CHECK (situacao IN ('pendente', 'aprovado', 'suspenso')),
  pausado BOOLEAN NOT NULL DEFAULT FALSE,
  destaque BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS horarios_funcionamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estabelecimento_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  abre TIME NOT NULL,
  fecha TIME NOT NULL
);

CREATE TABLE IF NOT EXISTS fechamentos_temporarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estabelecimento_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  inicio TIMESTAMPTZ NOT NULL,
  fim TIMESTAMPTZ NOT NULL,
  motivo TEXT
);

-- -----------------------------------------------------------------------------
-- 2. CARDÁPIO E GATILHO DE DESTAQUES (Seção 2 e Seção 3 da Etapa 6)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS categorias_cardapio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estabelecimento_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ordem INT NOT NULL DEFAULT 0
);

-- Índice único em (estabelecimento_id, nome em minúsculas) para impedir duplicadas (RN14)
CREATE UNIQUE INDEX IF NOT EXISTS idx_categorias_cardapio_unicas
  ON categorias_cardapio (estabelecimento_id, LOWER(nome));

CREATE TABLE IF NOT EXISTS produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estabelecimento_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  categoria_id UUID NOT NULL REFERENCES categorias_cardapio(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco NUMERIC(10,2) NOT NULL CHECK (preco >= 0),
  preco_original NUMERIC(10,2) DEFAULT NULL CHECK (preco_original IS NULL OR preco_original >= preco),
  unidade_medida TEXT NOT NULL DEFAULT 'un',
  estoque INT DEFAULT NULL CHECK (estoque IS NULL OR estoque >= 0),
  marca TEXT,
  imagem_url TEXT,
  disponivel BOOLEAN NOT NULL DEFAULT TRUE,
  ordem INT NOT NULL DEFAULT 0,
  destaque BOOLEAN NOT NULL DEFAULT FALSE
);

-- Gatilho em produtos que bloqueia o sétimo destaque da loja (RN13 / Seção 3)
CREATE OR REPLACE FUNCTION bloquear_setimo_destaque_produto()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_total_destaques INT;
BEGIN
  IF NEW.destaque = TRUE AND (TG_OP = 'INSERT' OR OLD.destaque = FALSE) THEN
    SELECT COUNT(*) INTO v_total_destaques
    FROM produtos
    WHERE estabelecimento_id = NEW.estabelecimento_id
      AND destaque = TRUE
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);

    IF v_total_destaques >= 6 THEN
      RAISE EXCEPTION 'Limite atingido: cada estabelecimento pode destacar no máximo 6 produtos (RN13).';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_setimo_destaque ON produtos;
CREATE TRIGGER trg_bloquear_setimo_destaque
BEFORE INSERT OR UPDATE ON produtos
FOR EACH ROW EXECUTE FUNCTION bloquear_setimo_destaque_produto();

-- -----------------------------------------------------------------------------
-- 3. PEDIDOS, DINHEIRO, AUDITORIA, PUSH E ENTREGADORES (Seção 2 da Etapa 6)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pedidos (
  id BIGSERIAL PRIMARY KEY, -- Sequencial para ser fácil de citar no WhatsApp
  cliente_id UUID NOT NULL REFERENCES perfis(id) ON DELETE RESTRICT,
  cliente_nome TEXT NOT NULL,
  estabelecimento_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'aguardando_confirmacao' CHECK (
    status IN (
      'aguardando_confirmacao',
      'aceito',
      'em_preparacao',
      'pronto_para_entrega',
      'saiu_para_entrega',
      'concluido',
      'recusado',
      'cancelado'
    )
  ),
  -- Cópia congelada do endereço no momento do pedido (RN10)
  cep VARCHAR(9) NOT NULL,
  rua TEXT NOT NULL,
  numero TEXT NOT NULL,
  bairro TEXT NOT NULL,
  complemento TEXT,
  referencia TEXT,
  telefone_contato TEXT NOT NULL,
  observacoes TEXT,
  forma_pagamento TEXT NOT NULL CHECK (forma_pagamento IN ('pix', 'cartao_entrega', 'dinheiro_entrega')),
  valor_troco NUMERIC(10,2) CHECK (valor_troco IS NULL OR valor_troco >= total),
  subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
  taxa_entrega NUMERIC(10,2) NOT NULL CHECK (taxa_entrega >= 0),
  total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  percentual_comissao NUMERIC(5,2) NOT NULL,
  valor_comissao NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  tempo_preparo_min INT,
  motivo_recusa TEXT,
  chave_idempotencia VARCHAR(120) NOT NULL UNIQUE,
  responsavel_entrega TEXT NOT NULL DEFAULT 'estabelecimento' CHECK (responsavel_entrega IN ('estabelecimento', 'plataforma')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS itens_pedido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id BIGINT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES produtos(id) ON DELETE SET NULL,
  nome_produto TEXT NOT NULL,
  preco_unitario NUMERIC(10,2) NOT NULL CHECK (preco_unitario >= 0),
  quantidade INT NOT NULL CHECK (quantidade > 0),
  subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
  observacoes TEXT
);

CREATE TABLE IF NOT EXISTS historico_pedido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id BIGINT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  responsavel_id UUID REFERENCES perfis(id),
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fechamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estabelecimento_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE RESTRICT,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  total_comissoes NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  total_taxas_entrega NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  vencimento DATE NOT NULL,
  situacao TEXT NOT NULL DEFAULT 'aberto' CHECK (situacao IN ('aberto', 'pago', 'vencido')),
  pago_em TIMESTAMPTZ,
  UNIQUE (estabelecimento_id, periodo_inicio, periodo_fim)
);

CREATE TABLE IF NOT EXISTS comissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estabelecimento_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE RESTRICT,
  pedido_id BIGINT NOT NULL UNIQUE REFERENCES pedidos(id) ON DELETE RESTRICT,
  valor NUMERIC(10,2) NOT NULL CHECK (valor >= 0),
  situacao TEXT NOT NULL DEFAULT 'pendente' CHECK (situacao IN ('pendente', 'paga')),
  fechamento_id UUID REFERENCES fechamentos(id) ON DELETE SET NULL,
  gerada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paga_em TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS registro_administrativo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES perfis(id),
  acao TEXT NOT NULL,
  tabela TEXT NOT NULL,
  registro_id TEXT NOT NULL,
  detalhes JSONB NOT NULL DEFAULT '{}'::JSONB,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS push_inscricoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  chaves JSONB NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entregadores (
  perfil_id UUID PRIMARY KEY REFERENCES perfis(id) ON DELETE CASCADE,
  veiculo TEXT NOT NULL DEFAULT 'moto' CHECK (veiculo IN ('moto', 'bicicleta', 'carro')),
  chave_pix TEXT NOT NULL,
  situacao TEXT NOT NULL DEFAULT 'pendente' CHECK (situacao IN ('pendente', 'aprovado', 'suspenso')),
  disponivel BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS corridas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id BIGINT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  estabelecimento_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE RESTRICT,
  entregador_id UUID REFERENCES entregadores(perfil_id) ON DELETE SET NULL,
  estado TEXT NOT NULL DEFAULT 'solicitada' CHECK (estado IN ('solicitada', 'aceita', 'retirada', 'entregue', 'cancelada')),
  tipo TEXT NOT NULL DEFAULT 'inicial' CHECK (tipo IN ('inicial', 'nova_viagem')),
  motivo TEXT,
  valor_cobrado NUMERIC(10,2) NOT NULL DEFAULT 3.00,
  valor_repasse NUMERIC(10,2) NOT NULL DEFAULT 2.50,
  valor_retido NUMERIC(10,2) NOT NULL DEFAULT 0.50,
  solicitada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  aceita_em TIMESTAMPTZ,
  entregue_em TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- 4. FUNÇÕES AUXILIARES DE SEGURANÇA (Seção 4 da Etapa 6)
-- Evitam leitura recursiva de perfis nas políticas RLS
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION eh_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM perfis
    WHERE id = auth.uid() AND papel = 'admin' AND situacao = 'ativo'
  );
$$;

CREATE OR REPLACE FUNCTION dono_da_loja(p_estabelecimento_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM estabelecimentos
    WHERE id = p_estabelecimento_id AND dono_id = auth.uid()
  );
$$;

-- -----------------------------------------------------------------------------
-- 5. REGRAS NO BANCO — FUNÇÕES RPC COM SECURITY DEFINER (Seção 3 da Etapa 6)
-- -----------------------------------------------------------------------------

-- 5.1 criar_pedido (chamada pelo cliente via supabase.rpc('criar_pedido', ...))
CREATE OR REPLACE FUNCTION criar_pedido(
  p_estabelecimento_id UUID,
  p_itens JSONB, -- [{ "produto_id": "uuid", "quantidade": 2, "observacoes": "..." }]
  p_cep VARCHAR(9),
  p_rua TEXT,
  p_numero TEXT,
  p_bairro TEXT,
  p_complemento TEXT,
  p_referencia TEXT,
  p_telefone_contato TEXT,
  p_observacoes TEXT,
  p_forma_pagamento TEXT,
  p_valor_troco NUMERIC(10,2),
  p_chave_idempotencia VARCHAR(120)
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido_existente BIGINT;
  v_cliente perfis%ROWTYPE;
  v_loja estabelecimentos%ROWTYPE;
  v_item JSONB;
  v_produto produtos%ROWTYPE;
  v_qtd INT;
  v_subtotal NUMERIC(10,2) := 0.00;
  v_total NUMERIC(10,2);
  v_comissao_padrao NUMERIC(5,2);
  v_percentual_comissao NUMERIC(5,2);
  v_novo_pedido_id BIGINT;
BEGIN
  -- 1. Idempotência (RNF09): se a mesma chave chegar de novo, devolve o pedido já criado
  SELECT id INTO v_pedido_existente
  FROM pedidos
  WHERE chave_idempotencia = p_chave_idempotencia;

  IF v_pedido_existente IS NOT NULL THEN
    RETURN v_pedido_existente;
  END IF;

  -- 2. Validar cliente autenticado
  SELECT * INTO v_cliente FROM perfis WHERE id = auth.uid() AND situacao = 'ativo';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não autenticado ou conta suspensa.';
  END IF;

  -- 3. Validar que a loja está aprovada, não suspensa e não pausada
  SELECT * INTO v_loja FROM estabelecimentos WHERE id = p_estabelecimento_id;
  IF NOT FOUND OR v_loja.situacao <> 'aprovado' OR v_loja.pausado = TRUE THEN
    RAISE EXCEPTION 'Estabelecimento indisponível para receber pedidos no momento.';
  END IF;

  -- 4. Validar forma de pagamento aceita pela loja
  IF (p_forma_pagamento = 'pix' AND NOT v_loja.aceita_pix) OR
     (p_forma_pagamento = 'cartao_entrega' AND NOT v_loja.aceita_cartao) OR
     (p_forma_pagamento = 'dinheiro_entrega' AND NOT v_loja.aceita_dinheiro) THEN
    RAISE EXCEPTION 'Forma de pagamento (%) não aceita por este estabelecimento.', p_forma_pagamento;
  END IF;

  -- 5. Validar itens e calcular subtotal a partir dos preços do banco (o cliente nunca envia valores)
  IF jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'O pedido deve conter ao menos um item.';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_qtd := (v_item->>'quantidade')::INT;
    IF v_qtd IS NULL OR v_qtd <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida para item do pedido.';
    END IF;

    SELECT * INTO v_produto
    FROM produtos
    WHERE id = (v_item->>'produto_id')::UUID
      AND estabelecimento_id = p_estabelecimento_id
      AND disponivel = TRUE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Um ou mais produtos estão indisponíveis ou não pertencem a esta loja.';
    END IF;

    v_subtotal := v_subtotal + ROUND(v_produto.preco * v_qtd, 2);
  END LOOP;

  v_total := ROUND(v_subtotal + v_loja.taxa_entrega, 2);

  -- 6. Validar troco (RN08)
  IF p_forma_pagamento = 'dinheiro_entrega' AND p_valor_troco IS NOT NULL AND p_valor_troco < v_total THEN
    RAISE EXCEPTION 'O valor para troco deve ser igual ou maior que o total do pedido.';
  END IF;

  -- 7. Obter percentual de comissão vigente (RN01 / RN10)
  SELECT COALESCE(valor::NUMERIC(5,2), 10.00) INTO v_comissao_padrao
  FROM configuracoes WHERE chave = 'comissao_padrao';

  v_percentual_comissao := COALESCE(v_loja.comissao_percentual, v_comissao_padrao, 10.00);

  -- 8. Gravar pedido
  INSERT INTO pedidos (
    cliente_id,
    cliente_nome,
    estabelecimento_id,
    status,
    cep,
    rua,
    numero,
    bairro,
    complemento,
    referencia,
    telefone_contato,
    observacoes,
    forma_pagamento,
    valor_troco,
    subtotal,
    taxa_entrega,
    total,
    percentual_comissao,
    chave_idempotencia,
    responsavel_entrega
  ) VALUES (
    v_cliente.id,
    TRIM(v_cliente.nome || ' ' || v_cliente.sobrenome),
    p_estabelecimento_id,
    'aguardando_confirmacao',
    p_cep,
    p_rua,
    p_numero,
    p_bairro,
    p_complemento,
    p_referencia,
    p_telefone_contato,
    p_observacoes,
    p_forma_pagamento,
    p_valor_troco,
    v_subtotal,
    v_loja.taxa_entrega,
    v_total,
    v_percentual_comissao,
    p_chave_idempotencia,
    CASE WHEN v_loja.modo_entrega = 'plataforma' THEN 'plataforma' ELSE 'estabelecimento' END
  ) RETURNING id INTO v_novo_pedido_id;

  -- 9. Gravar itens congelados
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    SELECT * INTO v_produto FROM produtos WHERE id = (v_item->>'produto_id')::UUID;
    v_qtd := (v_item->>'quantidade')::INT;

    INSERT INTO itens_pedido (
      pedido_id,
      produto_id,
      nome_produto,
      preco_unitario,
      quantidade,
      subtotal,
      observacoes
    ) VALUES (
      v_novo_pedido_id,
      v_produto.id,
      v_produto.nome,
      v_produto.preco,
      v_qtd,
      ROUND(v_produto.preco * v_qtd, 2),
      v_item->>'observacoes'
    );
  END LOOP;

  -- 10. Gravar primeiro histórico
  INSERT INTO historico_pedido (
    pedido_id,
    status_anterior,
    status_novo,
    responsavel_id,
    observacao
  ) VALUES (
    v_novo_pedido_id,
    NULL,
    'aguardando_confirmacao',
    v_cliente.id,
    'Pedido enviado pelo cliente'
  );

  RETURN v_novo_pedido_id;
END;
$$;

-- 5.2 mudar_status_pedido (lojista, cliente ou administrador)
CREATE OR REPLACE FUNCTION mudar_status_pedido(
  p_pedido_id BIGINT,
  p_novo_status TEXT,
  p_tempo_preparo_min INT DEFAULT NULL,
  p_motivo TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido pedidos%ROWTYPE;
  v_eh_admin BOOLEAN;
  v_eh_lojista BOOLEAN;
  v_eh_cliente BOOLEAN;
  v_valor_comissao NUMERIC(10,2);
BEGIN
  SELECT * INTO v_pedido FROM pedidos WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido #% não encontrado.', p_pedido_id;
  END IF;

  v_eh_admin := eh_admin();
  v_eh_lojista := dono_da_loja(v_pedido.estabelecimento_id);
  v_eh_cliente := (v_pedido.cliente_id = auth.uid());

  IF NOT (v_eh_admin OR v_eh_lojista OR v_eh_cliente) THEN
    RAISE EXCEPTION 'Sem permissão para alterar o status deste pedido.';
  END IF;

  -- Estados finais: Concluído, Recusado e Cancelado (exceto correção excepcional do admin)
  IF v_pedido.status IN ('concluido', 'recusado', 'cancelado') AND NOT v_eh_admin THEN
    RAISE EXCEPTION 'Não é permitido alterar um pedido que já está finalizado (%).', v_pedido.status;
  END IF;

  -- Nenhum pedido chega a Concluído sem ter sido aceito
  IF p_novo_status = 'concluido' AND v_pedido.status = 'aguardando_confirmacao' THEN
    RAISE EXCEPTION 'Nenhum pedido pode chegar a Concluído sem ter sido aceito.';
  END IF;

  -- Regras para Cliente: só cancela em aguardando_confirmacao ou aceito
  IF v_eh_cliente AND NOT v_eh_admin AND NOT v_eh_lojista THEN
    IF p_novo_status <> 'cancelado' OR v_pedido.status NOT IN ('aguardando_confirmacao', 'aceito') THEN
      RAISE EXCEPTION 'O cliente só pode cancelar o pedido enquanto estiver aguardando confirmação ou aceito (RN06).';
    END IF;
  END IF;

  -- Regras para Lojista
  IF v_eh_lojista AND NOT v_eh_admin THEN
    IF p_novo_status IN ('recusado', 'cancelado') AND (p_motivo IS NULL OR LENGTH(TRIM(p_motivo)) = 0) THEN
      RAISE EXCEPTION 'É obrigatório informar o motivo para recusar ou cancelar o pedido.';
    END IF;
  END IF;

  -- Cálculo de comissão ao concluir (subtotal x percentual registrado, arredondado a 2 casas)
  v_valor_comissao := v_pedido.valor_comissao;
  IF p_novo_status = 'concluido' AND v_pedido.status <> 'concluido' THEN
    v_valor_comissao := ROUND((v_pedido.subtotal * v_pedido.percentual_comissao) / 100.0, 2);

    INSERT INTO comissoes (
      estabelecimento_id,
      pedido_id,
      valor,
      situacao
    ) VALUES (
      v_pedido.estabelecimento_id,
      v_pedido.id,
      v_valor_comissao,
      'pendente'
    ) ON CONFLICT (pedido_id) DO NOTHING;
  END IF;

  UPDATE pedidos
  SET status = p_novo_status,
      tempo_preparo_min = COALESCE(p_tempo_preparo_min, tempo_preparo_min),
      motivo_recusa = COALESCE(p_motivo, motivo_recusa),
      valor_comissao = v_valor_comissao,
      atualizado_em = NOW()
  WHERE id = p_pedido_id;

  INSERT INTO historico_pedido (
    pedido_id,
    status_anterior,
    status_novo,
    responsavel_id,
    observacao
  ) VALUES (
    p_pedido_id,
    v_pedido.status,
    p_novo_status,
    auth.uid(),
    p_motivo
  );

  -- Se foi correção excepcional do administrador, grava auditoria
  IF v_eh_admin AND NOT v_eh_lojista THEN
    INSERT INTO registro_administrativo (
      usuario_id,
      acao,
      tabela,
      registro_id,
      detalhes
    ) VALUES (
      auth.uid(),
      'mudar_status_pedido',
      'pedidos',
      p_pedido_id::TEXT,
      jsonb_build_object(
        'status_anterior', v_pedido.status,
        'status_novo', p_novo_status,
        'motivo', p_motivo
      )
    );
  END IF;
END;
$$;

-- 5.3 fechar_quinzena (Roda nos dias 1 e 16 via pg_cron ou acionamento admin)
CREATE OR REPLACE FUNCTION fechar_quinzena(
  p_periodo_inicio DATE DEFAULT NULL,
  p_periodo_fim DATE DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio DATE;
  v_fim DATE;
  v_prazo_dias INT;
  v_loja RECORD;
  v_total_comissoes NUMERIC(10,2);
  v_total_taxas_entrega NUMERIC(10,2);
  v_fechamento_id UUID;
  v_contador INT := 0;
BEGIN
  -- Define período padrão caso não seja informado (dia 1 fecha 16..fim do mês anterior; dia 16 fecha 1..15)
  IF p_periodo_inicio IS NOT NULL AND p_periodo_fim IS NOT NULL THEN
    v_inicio := p_periodo_inicio;
    v_fim := p_periodo_fim;
  ELSIF EXTRACT(DAY FROM CURRENT_DATE) >= 16 THEN
    v_inicio := DATE_TRUNC('month', CURRENT_DATE)::DATE;
    v_fim := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '14 days')::DATE;
  ELSE
    v_inicio := (DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') + INTERVAL '15 days')::DATE;
    v_fim := (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day')::DATE;
  END IF;

  SELECT COALESCE(valor::INT, 5) INTO v_prazo_dias
  FROM configuracoes WHERE chave = 'prazo_pagamento_dias';

  -- Atualiza fechamentos abertos cujo vencimento já passou para 'vencido'
  UPDATE fechamentos
  SET situacao = 'vencido'
  WHERE situacao = 'aberto' AND vencimento < CURRENT_DATE;

  -- Para cada estabelecimento com comissões pendentes ou corridas entregues no período
  FOR v_loja IN SELECT id FROM estabelecimentos LOOP
    SELECT COALESCE(SUM(valor), 0.00) INTO v_total_comissoes
    FROM comissoes
    WHERE estabelecimento_id = v_loja.id
      AND situacao = 'pendente'
      AND fechamento_id IS NULL
      AND gerada_em::DATE BETWEEN v_inicio AND v_fim;

    SELECT COALESCE(SUM(valor_cobrado), 0.00) INTO v_total_taxas_entrega
    FROM corridas
    WHERE estabelecimento_id = v_loja.id
      AND estado = 'entregue'
      AND entregue_em::DATE BETWEEN v_inicio AND v_fim;

    IF v_total_comissoes > 0 OR v_total_taxas_entrega > 0 THEN
      INSERT INTO fechamentos (
        estabelecimento_id,
        periodo_inicio,
        periodo_fim,
        total_comissoes,
        total_taxas_entrega,
        vencimento,
        situacao
      ) VALUES (
        v_loja.id,
        v_inicio,
        v_fim,
        v_total_comissoes,
        v_total_taxas_entrega,
        CURRENT_DATE + v_prazo_dias,
        'aberto'
      )
      ON CONFLICT (estabelecimento_id, periodo_inicio, periodo_fim)
      DO UPDATE SET
        total_comissoes = EXCLUDED.total_comissoes,
        total_taxas_entrega = EXCLUDED.total_taxas_entrega
      RETURNING id INTO v_fechamento_id;

      UPDATE comissoes
      SET fechamento_id = v_fechamento_id
      WHERE estabelecimento_id = v_loja.id
        AND situacao = 'pendente'
        AND fechamento_id IS NULL
        AND gerada_em::DATE BETWEEN v_inicio AND v_fim;

      v_contador := v_contador + 1;
    END IF;
  END LOOP;

  RETURN v_contador;
END;
$$;

-- 5.4 solicitar_entregador e aceitar_corrida (com bloqueio de linha FOR UPDATE)
CREATE OR REPLACE FUNCTION solicitar_entregador(
  p_pedido_id BIGINT,
  p_tipo TEXT DEFAULT 'inicial',
  p_motivo TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido pedidos%ROWTYPE;
  v_valor_cobrado NUMERIC(10,2);
  v_valor_repasse NUMERIC(10,2);
  v_valor_retido NUMERIC(10,2);
  v_corrida_id UUID;
BEGIN
  SELECT * INTO v_pedido FROM pedidos WHERE id = p_pedido_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF NOT (dono_da_loja(v_pedido.estabelecimento_id) OR eh_admin()) THEN
    RAISE EXCEPTION 'Apenas o lojista ou administrador pode solicitar entregador.';
  END IF;

  IF p_tipo = 'nova_viagem' AND (p_motivo IS NULL OR LENGTH(TRIM(p_motivo)) = 0) THEN
    RAISE EXCEPTION 'Informe o motivo para solicitar uma nova viagem.';
  END IF;

  SELECT COALESCE(valor::NUMERIC(10,2), 3.00) INTO v_valor_cobrado FROM configuracoes WHERE chave = 'taxa_entrega_plataforma';
  SELECT COALESCE(valor::NUMERIC(10,2), 2.50) INTO v_valor_repasse FROM configuracoes WHERE chave = 'repasse_entregador';
  SELECT COALESCE(valor::NUMERIC(10,2), 0.50) INTO v_valor_retido FROM configuracoes WHERE chave = 'retencao_plataforma';

  INSERT INTO corridas (
    pedido_id,
    estabelecimento_id,
    estado,
    tipo,
    motivo,
    valor_cobrado,
    valor_repasse,
    valor_retido
  ) VALUES (
    v_pedido.id,
    v_pedido.estabelecimento_id,
    'solicitada',
    p_tipo,
    p_motivo,
    v_valor_cobrado,
    v_valor_repasse,
    v_valor_retido
  ) RETURNING id INTO v_corrida_id;

  UPDATE pedidos SET responsavel_entrega = 'plataforma', atualizado_em = NOW() WHERE id = p_pedido_id;

  RETURN v_corrida_id;
END;
$$;

CREATE OR REPLACE FUNCTION aceitar_corrida(p_corrida_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_corrida corridas%ROWTYPE;
  v_entregador entregadores%ROWTYPE;
  v_valor_repasse NUMERIC(10,2);
  v_valor_retido NUMERIC(10,2);
BEGIN
  SELECT * INTO v_entregador
  FROM entregadores
  WHERE perfil_id = auth.uid() AND situacao = 'aprovado' AND disponivel = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Apenas entregadores aprovados e disponíveis podem aceitar corridas.';
  END IF;

  -- Bloqueio de linha (FOR UPDATE) para que só o primeiro entregador fique com ela (Seção 3)
  SELECT * INTO v_corrida
  FROM corridas
  WHERE id = p_corrida_id
  FOR UPDATE;

  IF NOT FOUND OR v_corrida.estado <> 'solicitada' OR v_corrida.entregador_id IS NOT NULL THEN
    RAISE EXCEPTION 'Esta corrida já foi aceita por outro entregador ou não está mais disponível.';
  END IF;

  SELECT COALESCE(valor::NUMERIC(10,2), 2.50) INTO v_valor_repasse FROM configuracoes WHERE chave = 'repasse_entregador';
  SELECT COALESCE(valor::NUMERIC(10,2), 0.50) INTO v_valor_retido FROM configuracoes WHERE chave = 'retencao_plataforma';

  UPDATE corridas
  SET entregador_id = auth.uid(),
      estado = 'aceita',
      valor_repasse = v_valor_repasse,
      valor_retido = v_valor_retido,
      aceita_em = NOW()
  WHERE id = p_corrida_id;

  RETURN TRUE;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. SEGURANÇA E PERMISSÕES — ROW LEVEL SECURITY (Seção 4 da Etapa 6)
-- Regra geral: RLS ligado em todas as tabelas. Clientes e lojistas nunca alteram
-- pedidos, comissoes ou fechamentos diretamente, só pelas funções.
-- -----------------------------------------------------------------------------

ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE enderecos ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_estabelecimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE estabelecimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE horarios_funcionamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE fechamentos_temporarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_cardapio ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE comissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fechamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE registro_administrativo ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_inscricoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE entregadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE corridas ENABLE ROW LEVEL SECURITY;

-- configuracoes: só o administrador lê e altera
CREATE POLICY "admin_total_configuracoes" ON configuracoes
  FOR ALL USING (eh_admin()) WITH CHECK (eh_admin());

-- perfis: usuário lê e edita o próprio (menos papel e situacao); admin lê todos e altera situação
CREATE POLICY "leitura_perfis" ON perfis
  FOR SELECT USING (id = auth.uid() OR eh_admin());

CREATE POLICY "edicao_proprio_perfil" ON perfis
  FOR UPDATE USING (id = auth.uid() OR eh_admin())
  WITH CHECK (
    eh_admin() OR (
      id = auth.uid()
      AND papel = (SELECT p.papel FROM perfis p WHERE p.id = auth.uid())
      AND situacao = (SELECT p.situacao FROM perfis p WHERE p.id = auth.uid())
    )
  );

-- enderecos: cliente lê e edita os próprios
CREATE POLICY "cliente_enderecos" ON enderecos
  FOR ALL USING (cliente_id = auth.uid() OR eh_admin())
  WITH CHECK (cliente_id = auth.uid() OR eh_admin());

-- categorias_estabelecimento: leitura pública, escrita admin
CREATE POLICY "leitura_categorias_estabelecimento" ON categorias_estabelecimento
  FOR SELECT USING (ativa = TRUE OR eh_admin());

CREATE POLICY "admin_categorias_estabelecimento" ON categorias_estabelecimento
  FOR ALL USING (eh_admin()) WITH CHECK (eh_admin());

-- estabelecimentos: leitura pública das aprovadas; lojista lê e edita a própria (menos situacao e comissao_percentual); admin tudo
CREATE POLICY "leitura_estabelecimentos" ON estabelecimentos
  FOR SELECT USING (situacao = 'aprovado' OR dono_id = auth.uid() OR eh_admin());

CREATE POLICY "lojista_cria_estabelecimento" ON estabelecimentos
  FOR INSERT WITH CHECK (dono_id = auth.uid() AND situacao = 'pendente' AND comissao_percentual IS NULL AND destaque = FALSE);

CREATE POLICY "lojista_edita_estabelecimento" ON estabelecimentos
  FOR UPDATE USING (dono_id = auth.uid() OR eh_admin())
  WITH CHECK (
    eh_admin() OR (
      dono_id = auth.uid()
      AND situacao = (SELECT e.situacao FROM estabelecimentos e WHERE e.id = estabelecimentos.id)
      AND comissao_percentual IS NOT DISTINCT FROM (SELECT e.comissao_percentual FROM estabelecimentos e WHERE e.id = estabelecimentos.id)
      AND destaque = (SELECT e.destaque FROM estabelecimentos e WHERE e.id = estabelecimentos.id)
    )
  );

-- cardápio e horários: leitura pública (lojas aprovadas), lojista edita da própria loja, admin tudo
CREATE POLICY "leitura_categorias_cardapio" ON categorias_cardapio
  FOR SELECT USING ( TRUE );

CREATE POLICY "lojista_categorias_cardapio" ON categorias_cardapio
  FOR ALL USING (dono_da_loja(estabelecimento_id) OR eh_admin())
  WITH CHECK (dono_da_loja(estabelecimento_id) OR eh_admin());

CREATE POLICY "leitura_produtos" ON produtos
  FOR SELECT USING ( TRUE );

CREATE POLICY "lojista_produtos" ON produtos
  FOR ALL USING (dono_da_loja(estabelecimento_id) OR eh_admin())
  WITH CHECK (dono_da_loja(estabelecimento_id) OR eh_admin());

CREATE POLICY "leitura_horarios" ON horarios_funcionamento
  FOR SELECT USING ( TRUE );

CREATE POLICY "lojista_horarios" ON horarios_funcionamento
  FOR ALL USING (dono_da_loja(estabelecimento_id) OR eh_admin())
  WITH CHECK (dono_da_loja(estabelecimento_id) OR eh_admin());

CREATE POLICY "leitura_fechamentos_temp" ON fechamentos_temporarios
  FOR SELECT USING ( TRUE );

CREATE POLICY "lojista_fechamentos_temp" ON fechamentos_temporarios
  FOR ALL USING (dono_da_loja(estabelecimento_id) OR eh_admin())
  WITH CHECK (dono_da_loja(estabelecimento_id) OR eh_admin());

-- pedidos, itens_pedido, historico_pedido: somente leitura (escrita apenas via funções RPC SECURITY DEFINER)
CREATE POLICY "leitura_pedidos" ON pedidos
  FOR SELECT USING (cliente_id = auth.uid() OR dono_da_loja(estabelecimento_id) OR eh_admin());

CREATE POLICY "leitura_itens_pedido" ON itens_pedido
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pedidos p
      WHERE p.id = itens_pedido.pedido_id
        AND (p.cliente_id = auth.uid() OR dono_da_loja(p.estabelecimento_id) OR eh_admin())
    )
  );

CREATE POLICY "leitura_historico_pedido" ON historico_pedido
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pedidos p
      WHERE p.id = historico_pedido.pedido_id
        AND (p.cliente_id = auth.uid() OR dono_da_loja(p.estabelecimento_id) OR eh_admin())
    )
  );

-- comissoes e fechamentos: cliente sem acesso; lojista lê os da própria loja; admin tudo
CREATE POLICY "leitura_comissoes" ON comissoes
  FOR SELECT USING (dono_da_loja(estabelecimento_id) OR eh_admin());

CREATE POLICY "admin_comissoes" ON comissoes
  FOR ALL USING (eh_admin()) WITH CHECK (eh_admin());

CREATE POLICY "leitura_fechamentos" ON fechamentos
  FOR SELECT USING (dono_da_loja(estabelecimento_id) OR eh_admin());

CREATE POLICY "admin_fechamentos" ON fechamentos
  FOR ALL USING (eh_admin()) WITH CHECK (eh_admin());

-- registro_administrativo: só leitura pelo administrador (gravação feita pelas funções)
CREATE POLICY "leitura_registro_administrativo" ON registro_administrativo
  FOR SELECT USING (eh_admin());

-- push_inscricoes: cliente e lojista criam e apagam as próprias; admin sem acesso
CREATE POLICY "usuario_push_inscricoes" ON push_inscricoes
  FOR ALL USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- entregadores e corridas
CREATE POLICY "leitura_entregadores" ON entregadores
  FOR SELECT USING (perfil_id = auth.uid() OR eh_admin());

CREATE POLICY "edicao_entregador_proprio" ON entregadores
  FOR UPDATE USING (perfil_id = auth.uid() OR eh_admin())
  WITH CHECK (eh_admin() OR perfil_id = auth.uid());

CREATE POLICY "leitura_corridas" ON corridas
  FOR SELECT USING (
    entregador_id = auth.uid()
    OR (estado = 'solicitada' AND EXISTS (SELECT 1 FROM entregadores e WHERE e.perfil_id = auth.uid() AND e.situacao = 'aprovado'))
    OR dono_da_loja(estabelecimento_id)
    OR eh_admin()
  );

-- -----------------------------------------------------------------------------
-- 7. ROTINA QUINZENAL AUTOMÁTICA (pg_cron nos dias 1 e 16 — Seção 1 e 3)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.schedule(
      'pedeumtrem_fechar_quinzena',
      '5 0 1,16 * *',
      'SELECT public.fechar_quinzena();'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Caso pg_cron não esteja habilitado no plano atual do Supabase, ignora sem falhar a migração
  NULL;
END $$;
