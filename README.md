# PedeUmTrem — Plataforma PWA de Delivery Local (Beta)

# 🚂 PedeUmTrem

**Marketplace de delivery local em formato PWA, conectando clientes a restaurantes, lanchonetes, pizzarias e açaiterias da sua cidade.**

## 📌 Sobre o projeto

O **PedeUmTrem** nasceu de uma necessidade real: cidades pequenas e médias têm muitos comércios de comida com ótimo produto, mas sem presença digital organizada nem estrutura própria de pedidos online. As grandes plataformas costumam cobrar taxas altas ou nem chegam a esses lugares.

A proposta é uma plataforma **simples, barata e local**, em que:

- o **cliente** encontra estabelecimentos, monta o pedido e acompanha tudo pelo celular, sem instalar nada da loja de apps;
- o **estabelecimento** recebe e gerencia pedidos em um painel com alerta sonoro, define seu cardápio, taxa e área de entrega;
- o **administrador** aprova estabelecimentos, configura comissões e acompanha o fechamento financeiro.

> 💡 Este projeto foi conduzido de ponta a ponta, do levantamento de requisitos à implantação, seguindo um processo de engenharia de software em etapas


## ✨ Funcionalidades

### 👤 Cliente
- Cadastro com nome, sobrenome, e-mail e telefone
- Busca e navegação por estabelecimentos e categorias
- Carrinho e checkout com escolha de pagamento (Pix ou na entrega)
- Pagamento na entrega com seleção de cartão ou dinheiro, com campo de troco quando for dinheiro
- Resumo do pedido gerado automaticamente ao acompanhar via WhatsApp
- Notificações push sobre o andamento do pedido

### 🏪 Estabelecimento
- Cadastro sujeito à **aprovação do administrador** antes de aparecer publicamente
- Gestão de cardápio, preços, taxa de entrega e área de atendimento próprios
- Painel de pedidos em ordem de chegada, com **alerta sonoro** e notificação push
- Extrato de comissões com fechamento quinzenal

### 🛠️ Administrador
- Aprovação e moderação de estabelecimentos
- Comissão configurável: valor padrão com exceções por estabelecimento
- Acompanhamento de pedidos e fechamentos quinzenais

## 💼 Modelo de negócio

| Aspecto | Decisão |
|---|---|
| Receita | Comissão por pedido concluído, calculada sobre o valor dos produtos (sem incidir na taxa de entrega) |
| Pagamentos | Direto ao estabelecimento (Pix ou na entrega). A plataforma **não processa pagamentos nem mantém saldo** |
| Entrega | Taxa e área definidas por cada estabelecimento |
| Fechamento | Quinzenal |

Manter a plataforma fora do fluxo financeiro reduz custo, risco regulatório e complexidade técnica na primeira versão, o que permite validar o produto com baixo investimento.

> 📝 **Observação:** este modelo de negócio **não é definitivo** e pode ser alterado conforme a validação com estabelecimentos reais. Uma direção em avaliação é fazer a plataforma operar mais como uma **vitrine** dos comércios locais do que como um marketplace nos moldes do iFood, aceitando uma margem menor por pedido em troca de uma barreira de entrada mais baixa para os estabelecimentos. Nesse cenário, a receita viria de outras frentes:
>
> | Fonte de receita | Descrição |
> |---|---|
> | Assinatura | Aluguel da ferramenta (cardápio, painel de pedidos, notificações) para o estabelecimento |
> | Anúncios | Espaços de divulgação dentro do app |
> | Posições de destaque | Estabelecimentos pagam para aparecer em evidência na busca e na home |


## 🧱 Stack

| Camada | Tecnologia |
|---|---|
| Front-end | React + Vite + TypeScript |
| Formato | PWA (instalável, funciona bem em rede móvel) |
| Back-end / BaaS | Supabase (PostgreSQL, Auth, Storage) |
| Hospedagem | Cloudflare Pages |
| CI/CD | GitHub + deploy automático a cada push |

**Por que essas escolhas?**
- **Custo zero na fase inicial:** Cloudflare Pages e Supabase atendem bem o início do projeto.
- **PWA em vez de app nativo:** um único código, sem passar por lojas de aplicativos, instalação direta pelo navegador.
- **Supabase:** PostgreSQL de verdade (modelagem relacional, constraints, RLS) com autenticação e storage prontos.
- **TypeScript:** segurança de tipos em um domínio com várias regras de negócio (pedidos, comissões, perfis).

## 🏗️ Arquitetura

```
┌──────────────┐      HTTPS       ┌────────────────────┐
│  PWA (React) │ ───────────────► │  Cloudflare Pages  │
│  Cliente /   │                  └────────────────────┘
│  Lojista /   │
│  Admin       │      API/Auth    ┌────────────────────┐
│              │ ───────────────► │      Supabase      │
└──────────────┘                  │ PostgreSQL · Auth  │
                                  │ Storage · RLS      │
                                  └────────────────────┘
```


Controle de acesso por perfil (Cliente, Estabelecimento, Administrador) aplicado no banco com **Row Level Security**, de modo que as regras de permissão não dependem só do front-end.

## 🚀 Como rodar localmente

**Pré-requisitos:** Node.js 18+ e uma conta no [Supabase](https://supabase.com).

```bash
# 1. Clone o repositório
git clone https://github.com/<seu-usuario>/pedeumtrem.git
cd pedeumtrem

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# edite o .env com as credenciais do seu projeto Supabase

# 4. Rode em modo desenvolvimento
npm run dev
```

**Variáveis de ambiente**

```env
VITE_SUPABASE_URL=https://<seu-projeto>.supabase.co
VITE_SUPABASE_ANON_KEY=<sua-chave-anon>
```

**Outros comandos**

```bash
npm run build     # build de produção
npm run preview   # pré-visualiza o build localmente
```

## 📂 Estrutura do projeto

```
pedeumtrem/
├── docs/            # DRS, casos de uso, fluxogramas, mapa de telas
├── public/          # ícones, manifest e assets do PWA
├── src/
│   ├── components/  # componentes reutilizáveis
│   ├── lib/         # cliente Supabase, utilitários
│   └── types/       # tipos TypeScript
└── ...
```

## 📚 Documentação

O projeto foi documentado antes de ser codificado:

- 📄 **DRS** (Documento de Requisitos de Software), versão 1.1
- 🔀 Casos de uso e fluxogramas
- 🗺️ Mapa de telas e navegação
- 🎨 Protótipo no Figma (31 telas)

## 🗺️ Roadmap

Processo de desenvolvimento em etapas:

- [x] 1. Definição do projeto
- [x] 2. Entrevista e levantamento de requisitos
- [x] 3. Documento de Requisitos (DRS)
- [x] 4. Validação dos requisitos
- [x] 5. Modelagem e prototipação 
- [x] 6. Projeto técnico (arquitetura, banco de dados, segurança, integrações)
- [x] 7. Planejamento do desenvolvimento
- [x] 8. Desenvolvimento incremental por módulos
- [ ] 9. Testes e validação *(em andamento)*
- [ ] 10. Implantação
- [ ] 11. Monitoramento e manutenção

**Ideias para versões futuras**
- [x] Entregadores autônomos como novo perfil (cadastro, aceite de corridas e acerto quinzenal), em modelo híbrido com a entrega própria do estabelecimento
- [ ] Validação de telefone por código
- [ ] Avaliações de estabelecimentos
- [ ] Modelo de vitrine com monetização por assinatura, anúncios e posições de destaque

## 🧠 Aprendizados e desafios

- Definir o escopo da v1 para manter custo zero
- A decisão de não processar pagamentos e o que isso simplificou
- Entender os custos, MVP, pesquisa e validação
- Uso de RLS para controle de acesso por perfil

## 👨‍💻 Autor

**Rodrigo**

[![LinkedIn](https://shields.io)](https://www.linkedin.com/in/rodrigo-valentino/)
[![GitHub](https://shields.io)](https://github.com/rodrigo-valentino)
[![E-mail](https://shields.io)](mailto:rodrigovalentino.rv@gmail.com)

## 🏗️ Arquitetura 

- **Frontend (PWA):** React, TypeScript, Vite, Tailwind CSS e `vite-plugin-pwa` (`manifest.webmanifest` + Service Worker). Quatro módulos com permissões separadas: **Cliente**, **Lojista**, **Entregador** e **Administrador**.
- **Hospedagem (Cloudflare Pages):** Conectado ao GitHub (sem Cloudflare Workers). Cada `push` na branch principal (`main`) publica em produção, e cada branch secundária gera um ambiente de prévia (*Preview Deployment*).
  - `public/_redirects`: Roteamento SPA (`/* /index.html 200`).
  - `public/_headers`: Cabeçalhos de segurança e controle de cache para atualização imediata do Service Worker (`/sw.js`) e `manifest.webmanifest`.
- **Supabase (Backend & Banco de Dados):**
  - **PostgreSQL em português (`snake_case`)** com `numeric(10,2)` para valores monetários e `id` sequencial em `pedidos` (fácil citação no WhatsApp).
  - **Regras de negócio no banco (`SECURITY DEFINER` + `search_path = public`):** Funções RPC `criar_pedido`, `mudar_status_pedido`, `fechar_quinzena` (`pg_cron` nos dias 1 e 16), `solicitar_entregador` e `aceitar_corrida` (com bloqueio de linha `FOR UPDATE`).
  - **Row Level Security (RLS):** Ativo em todas as tabelas com funções auxiliares `eh_admin()` e `dono_da_loja(id)` para evitar recursão em `perfis`.
  - **Edge Function (`supabase/functions/enviar-push`):** Acionada por webhook do banco para disparo de notificações Web Push (VAPID).

---

