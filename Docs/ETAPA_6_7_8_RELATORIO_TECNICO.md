# PedeUmTrem — Projeto Técnico (Etapa 6), Planejamento (Etapa 7) e Relatório de Implementação (Etapas 8 e 9)

## 1. Visão Geral e Estilo Visual (`Modelo_App.png`)

O **PedeUmTrem** é uma Progressive Web App (PWA) de delivery local desenvolvida em **React + TypeScript + Vite + Tailwind CSS + Supabase**, seguindo fielmente:
- **Identidade visual de `Modelo_App.png`**:
  - Header com ícone de sacola verde (`#166534`), tipografia ***PedeUmTrem*** em negrito itálico e sino de notificações;
  - Seletor de endereço (`Entregar em` / `Minha localização` com integração ViaCEP);
  - Barra de pesquisa em pílula (`Buscar lojas, produtos ou pratos`);
  - Cards de categorias em verde menta suave (`Restaurantes`, `Mercados`, `Bebidas`, `Farmácias`, `Mais`);
  - Banner promocional com gradiente verde (`"Tudo o que você precisa em um só lugar."` + botão `"Pede um trem agora! →"` + sacola 3D com linhas de velocidade e indicadores do carrossel);
  - Seção **Lojas em destaque** com card fotográfico imersivo (`Vai Brasa — Churrascaria ★ 4,8 • 25–40 min`) e botão de favoritar;
  - Navegação inferior (`Início`, `Pedidos`, `Favoritos`, `Perfil`) + barra flutuante do carrinho.

---

## 2. Etapa 6 — Projeto Técnico (Arquitetura, Banco de Dados e Segurança)

### 2.1 Stack Tecnológica (Custo Zero Inicial)
- **Frontend & PWA**: React 19, TypeScript, Vite 6, Tailwind CSS v4, `vite-plugin-pwa` (Manifest + Service Worker para instalação na tela inicial no Android, iOS e Desktop).
- **Backend & Persistência**:
  - **Supabase (`supabase/migrations/001_pedeumtrem_schema.sql`)**: PostgreSQL com tipos enumerados, precisão monetária `NUMERIC(10,2)`, triggers de validação de estado e limite de destaques, cálculo automático de comissão no banco, Auth e Storage.
  - **Camada Híbrida Local (`src/context/AppContext.tsx`)**: Funciona imediatamente em ambiente local com persistência em `localStorage` e dados de demonstração completos, conectando-se ao Supabase assim que `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` são configurados.
- **Hospedagem**: Compatível com publicação contínua no **Cloudflare Pages** integrado ao GitHub.

### 2.2 Regras Críticas no Banco de Dados e Serviços
1. **Precisão Monetária (`src/utils/currency.ts` / `RNF08` / `RF26`)**:
   - Todos os cálculos utilizam aritmética inteira em centavos (`toCents` / `fromCents`) no frontend e `NUMERIC(10,2)` no PostgreSQL, eliminando imprecisões de ponto flutuante.
   - Campos de preço aceitam digitação com vírgula (`R$ 12,50`) e convertem com exatidão para decimal (`12.50`).
2. **Compressão e Conversão Automática de Imagens no Navegador (`src/utils/imageCompressor.ts` / Seção 9 / `RNF16`)**:
   - Converte qualquer imagem enviada no navegador para **WebP** com **80% de qualidade** inicial, ajustando automaticamente a qualidade caso necessário para respeitar os limites de peso:
     - **Fotos de Produtos (1:1)**: valida mínimo de `600 x 600 px`, redimensiona para até `800 x 800 px`, e garante peso final **$\le$ 200 KB**.
     - **Banners e Capas (16:9)**: redimensiona para até `1200 x 675 px`, garantindo peso final **$\le$ 300 KB**.
3. **Máquina de Estados e Cancelamento (`src/utils/validation.ts` / `RN03` a `RN06`)**:
   - Estados controlados: `aguardando_confirmacao` $\rightarrow$ `aceito` $\rightarrow$ `em_preparacao` $\rightarrow$ `pronto_para_entrega` $\rightarrow$ `saiu_para_entrega` $\rightarrow$ `concluido` (e saídas `recusado` / `cancelado`).
   - Impede concluir pedido que nunca foi aceito.
   - **Cancelamento pelo Cliente (`RN06`)**: permitido diretamente em `Aguardando confirmação` ou `Aceito`; bloqueado automaticamente a partir de `Em preparação` (exigindo contato com o estabelecimento, que registra o cancelamento com motivo obrigatório no painel).
4. **Segurança no Pagamento via Pix (`RN07` / `RF18`)**:
   - A chave Pix do estabelecimento e o valor para pagamento só são exibidos ao cliente **depois que o restaurante aceita o pedido**, evitando pagamento de pedidos recusados.

---

## 3. Etapa 7 — Planejamento do Desenvolvimento por Módulos

| Módulo | Escopo Implementado | Requisitos Atendidos |
| :--- | :--- | :--- |
| **Módulo 1 — Autenticação, Sessão e RBAC** | Cadastro e login por e-mail/senha (mín. 8 caracteres com ao menos 1 letra e 1 número), OAuth Google sem conflito, rascunho automático de formulários e modal de reautenticação sem perda de progresso. | `RF01`, `RNF04`, `RNF05`, `RNF07`, `RNF11`, `RNF13` |
| **Módulo 2 — Catálogo e Vitrine do Cliente** | Home fiel ao `Modelo_App.png`, filtro por categorias, busca por lojas e pratos, página do estabelecimento com grade 3x2 de destaques no topo e cardápio na ordem manual do lojista. | `RF02` a `RF06`, `RNF01`, `RNF02` |
| **Módulo 3 — Carrinho, Endereço ViaCEP e Checkout** | Carrinho com cálculo decimal exato, formulário de endereço estruturado com autopreenchimento por CEP (ViaCEP) e compatibilidade com endereços antigos, seleção de Pix, Cartão ou Dinheiro (com cálculo de troco) e chave de idempotência. | `RF07` a `RF13`, `RNF08`, `RNF09` |
| **Módulo 4 — Acompanhamento e Resumo WhatsApp** | Linha do tempo de 6 etapas, liberação da chave Pix pós-aceite, cancelamento direto até `Aceito` e botão **"Acompanhar pedido no WhatsApp"** com resumo completo. | `RF14` a `RF19`, `RN06`, `RN07` |
| **Módulo 5 — Painel do Lojista** | Fila de pedidos em ordem estrita de chegada (FIFO), botão **"Iniciar expediente"** (libera som Web Audio API e Push), aceite com tempos de preparo até $>180$ min ou personalizado, categorias sem duplicidade, ordenação manual, grade 3x2 de até 6 destaques e compressor WebP. | `RF20` a `RF37`, `RF49`, `RN13`, `RN14`, `RNF16` |
| **Módulo 6 — Administração, Comissões e Quinzenas** | Aprovação e suspensão de lojas, busca/filtro de usuários, cálculo automático de comissão de 10% sobre produtos (excluindo entrega), fechamento quinzenal, baixa de pagamentos, exceções por loja e log de auditoria. | `RF38` a `RF48`, `RN01`, `RN05`, `RN11` |
| **Módulo 7 — Fase 2: Entregadores (Modelo Híbrido)** | Cadastro e aprovação de entregadores, status disponível/indisponível, fila com privacidade de endereço antes do aceite (`RN18`), taxa R$ 3,00 (repasse R$ 2,50 e retenção R$ 0,50), repetição de viagem e extrato quinzenal. | `RF53` a `RF62`, `RN15` a `RN19` |

---

## 4. Relatório Final de Entrega (Protocolo Obrigatório)

1. **Prevenção de Falhas de Autenticação e Reloads Involuntários**:
   - O fluxo de autenticação por e-mail e senha valida sintaxe de e-mail, unicidade e regra de senha ($\ge 8$ caracteres, $\ge 1$ letra e $\ge 1$ número) com mensagens específicas por campo.
   - O estado de sessão e rascunhos de formulários são persistidos sem recarregamentos involuntários; caso a sessão expire, o componente `SessionReauthModal` permite renovar a autenticação sem desmontar a tela nem perder dados digitados (`RNF11`).
2. **Arquivos Criados**:
   - `supabase/migrations/001_pedeumtrem_schema.sql`: Schema PostgreSQL completo com triggers, funções e regras de negócio.
   - `src/types/index.ts`: Contratos TypeScript de todas as entidades (MVP + Fase 2).
   - `src/utils/currency.ts`: Aritmética monetária em centavos e formatação `R$ 0,00` com vírgula decimal.
   - `src/utils/validation.ts`: Validações harmonizadas de e-mail, senha, CEP (ViaCEP) e transições de estado do pedido.
   - `src/utils/imageCompressor.ts`: Conversor e compressor WebP client-side ($800 \times 800$ $\le 200\text{ KB}$ para pratos e $1200 \times 675$ $\le 300\text{ KB}$ para capas) + gerador de PNG de 5 MB para teste.
   - `src/utils/whatsapp.ts`: Gerador do resumo estruturado para o botão *"Acompanhar pedido no WhatsApp"*.
   - `src/utils/sound.ts`: Sintetizador de alerta sonoro Web Audio API e notificações Push.
   - `src/context/AppContext.tsx`: Motor de estado e regras de negócio para os 4 perfis.
   - `src/components/CustomerView.tsx`: Interface do Cliente seguindo `Modelo_App.png`.
   - `src/components/MerchantView.tsx`: Painel do Estabelecimento / Lojista.
   - `src/components/AdminView.tsx`: Painel Administrativo e Financeiro Quinzenal.
   - `src/components/DriverView.tsx`: Painel do Entregador (Fase 2 — Modelo Híbrido).
   - `src/components/TestProtocolModal.tsx` e `src/__tests__/specifications.test.ts`: Suíte de testes automatizados.
