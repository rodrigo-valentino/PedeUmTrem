-- =============================================================================
-- PedeUmTrem — Seed Inicial do Banco (Etapa 6)
-- Categorias oficiais de estabelecimento e parâmetros globais em configuracoes
-- =============================================================================

INSERT INTO configuracoes (chave, valor) VALUES
  ('comissao_padrao', '10.00'),
  ('prazo_pagamento_dias', '5'),
  ('taxa_entrega_plataforma', '3.00'),
  ('repasse_entregador', '2.50'),
  ('retencao_plataforma', '0.50')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = NOW();

INSERT INTO categorias_estabelecimento (nome, descricao, ativa) VALUES
  ('Restaurantes', 'Pratos feitos, marmitex, comida mineira e executiva', TRUE),
  ('Lanches', 'Hambúrgueres artesanais, sanduíches e porções', TRUE),
  ('Pizzarias', 'Pizzas tradicionais, brotinhos, calzones e massas', TRUE),
  ('Bebidas', 'Depósitos de bebidas, refrigerantes, sucos e conveniência', TRUE),
  ('Açaí e Sorvetes', 'Açaí na tigela, sorvetes artesanais e picolés', TRUE),
  ('Padarias e Confeitarias', 'Pães, bolos caseiros, salgados, doces e cafés', TRUE),
  ('Mercados e Mercearias', 'Hortifruti, mercearia local e itens de despensa', TRUE),
  ('Farmácias', 'Medicamentos isentos, higiene pessoal e conveniência', TRUE)
ON CONFLICT (nome) DO NOTHING;
