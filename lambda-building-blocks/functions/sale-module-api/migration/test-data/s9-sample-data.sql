-- S9 Sample Data for Migration Testing
-- PostgreSQL dump of sample records

-- Buyers table (compradores)
INSERT INTO compradores (id_comprador, nome, nome_fantasia, cnpj, email, telefone, celular, endereco, bairro, cidade, estado, cep, pais, status, limite_credito, prazo_pagamento, contato_nome, contato_email, contato_telefone, inscricao_estadual, observacoes, data_cadastro, usuario_cadastro, data_atualizacao, usuario_atualizacao) VALUES
(1, 'ACME Corporation', 'ACME', '12.345.678/0001-90', 'purchasing@acme.com', '+55 11 1234-5678', '+55 11 98765-4321', 'Av. Paulista, 1000, 10º andar', 'Bela Vista', 'São Paulo', 'SP', '01310-100', 'BR', 'A', 100000.00, 30, 'John Doe', 'john.doe@acme.com', '+55 11 98765-4321', '123.456.789.012', 'Preferred customer - priority delivery', '2026-01-15 10:00:00', 'admin@i2speedex.com', '2026-01-25 14:00:00', 'admin@i2speedex.com'),
(2, 'Tech Solutions Ltd', 'Tech Solutions', '98.765.432/0001-11', 'purchasing@techsolutions.com', '+55 11 2345-6789', '+55 11 99876-5432', 'Rua Augusta, 500', 'Consolação', 'São Paulo', 'SP', '01305-000', 'BR', 'A', 75000.00, 45, 'Jane Smith', 'jane.smith@techsolutions.com', '+55 11 99876-5432', '987.654.321.098', 'Regular customer', '2026-01-10 09:00:00', 'admin@i2speedex.com', '2026-01-20 11:00:00', 'admin@i2speedex.com'),
(3, 'Global Imports Inc', 'Global Imports', '11.222.333/0001-44', 'orders@globalimports.com', '+55 11 3456-7890', '+55 11 98888-7777', 'Av. Faria Lima, 2000', 'Itaim Bibi', 'São Paulo', 'SP', '01451-000', 'BR', 'I', 50000.00, 15, 'Bob Johnson', 'bob@globalimports.com', '+55 11 98888-7777', '111.222.333.444', 'Inactive - seasonal business', '2025-12-01 08:00:00', 'admin@i2speedex.com', '2026-01-05 10:00:00', 'admin@i2speedex.com');

-- Producers table (produtores)
INSERT INTO produtores (id_produtor, nome, nome_fantasia, cnpj, email, telefone, celular, endereco, bairro, cidade, estado, cep, pais, status, categorias_produtos, contato_nome, contato_email, contato_telefone, inscricao_estadual, banco, banco_nome, agencia, conta, tipo_conta, observacoes, data_cadastro, usuario_cadastro, data_atualizacao, usuario_atualizacao) VALUES
(1, 'Farm Industries Ltd', 'Farm Industries', '98.765.432/0001-10', 'sales@farmindustries.com', '+55 19 3456-7890', '+55 19 98765-4321', 'Rodovia SP-330, Km 125, Fazenda Santa Rita', 'Rural', 'Campinas', 'SP', '13100-000', 'BR', 'A', 'GRAINS,CORN,SOYBEANS', 'Maria Silva', 'maria.silva@farmindustries.com', '+55 19 98765-4321', '987.654.321.098', '001', 'Banco do Brasil', '1234-5', '12345-6', 'CC', 'Premium supplier - organic certification', '2026-01-10 09:00:00', 'admin@i2speedex.com', '2026-01-20 11:00:00', 'admin@i2speedex.com'),
(2, 'Green Valley Farms', 'Green Valley', '22.333.444/0001-55', 'contact@greenvalley.com', '+55 19 4567-8901', '+55 19 97777-6666', 'Estrada Municipal, Km 10', 'Rural', 'Piracicaba', 'SP', '13400-000', 'BR', 'A', 'VEGETABLES,FRUITS', 'Carlos Santos', 'carlos@greenvalley.com', '+55 19 97777-6666', '222.333.444.555', '237', 'Bradesco', '5678-9', '54321-0', 'CP', 'Certified organic producer', '2025-12-15 10:00:00', 'admin@i2speedex.com', '2026-01-15 14:00:00', 'admin@i2speedex.com');

-- Sales table (vendas)
INSERT INTO vendas (id_venda, id_comprador, id_produtor, data_venda, data_entrega, data_nota, status, prazo_pagamento, quantidade_total, preco_unitario, subtotal, desconto, imposto, valor_total, moeda, numero_nota, chave_nota, observacoes, data_cadastro, usuario_cadastro, data_atualizacao, usuario_atualizacao) VALUES
(1, 1, 1, '2026-01-30 14:30:00', '2026-02-15 00:00:00', '2026-01-30 14:30:00', 'CONFIRMADO', 30, 1000, 25.50, 25500.00, 500.00, 2550.00, 27550.00, 'BRL', 'NF-2026-001', '35260112345678000190550010000000011234567890', 'Urgent delivery requested', '2026-01-30 14:30:00', 'user@i2speedex.com', '2026-01-30 15:00:00', 'user@i2speedex.com'),
(2, 1, 1, '2026-01-25 10:00:00', '2026-02-10 00:00:00', '2026-01-25 11:00:00', 'FATURADO', 30, 2000, 24.00, 48000.00, 1000.00, 4700.00, 51700.00, 'BRL', 'NF-2026-002', '35260112345678000190550010000000021234567891', 'Regular order', '2026-01-25 10:00:00', 'user@i2speedex.com', '2026-01-26 09:00:00', 'user@i2speedex.com'),
(3, 2, 1, '2026-01-28 16:00:00', '2026-02-20 00:00:00', NULL, 'CONFIRMADO', 45, 1500, 26.00, 39000.00, 0.00, 3900.00, 42900.00, 'BRL', NULL, NULL, 'Awaiting invoice generation', '2026-01-28 16:00:00', 'user@i2speedex.com', '2026-01-29 10:00:00', 'user@i2speedex.com'),
(4, 1, 2, '2026-01-20 14:00:00', '2026-02-05 00:00:00', '2026-01-20 15:00:00', 'ENTREGUE', 30, 500, 45.00, 22500.00, 500.00, 2200.00, 24200.00, 'BRL', 'NF-2026-003', '35260122333444000155550010000000031234567892', 'Delivered on time', '2026-01-20 14:00:00', 'user@i2speedex.com', '2026-02-05 16:00:00', 'user@i2speedex.com'),
(5, 2, 2, '2026-01-15 11:00:00', '2026-01-30 00:00:00', '2026-01-15 12:00:00', 'ENVIADO', 45, 300, 50.00, 15000.00, 0.00, 1500.00, 16500.00, 'BRL', 'NF-2026-004', '35260122333444000155550010000000041234567893', 'In transit', '2026-01-15 11:00:00', 'user@i2speedex.com', '2026-01-25 14:00:00', 'user@i2speedex.com'),
(6, 3, 1, '2026-01-10 09:00:00', '2026-01-25 00:00:00', NULL, 'RASCUNHO', 15, 750, 25.00, 18750.00, 0.00, 1875.00, 20625.00, 'BRL', NULL, NULL, 'Draft - awaiting approval', '2026-01-10 09:00:00', 'user@i2speedex.com', '2026-01-10 09:30:00', 'user@i2speedex.com');

-- Sale lines table (linhas_venda)
INSERT INTO linhas_venda (id_linha, id_venda, numero_linha, codigo_produto, nome_produto, descricao_produto, quantidade, unidade, preco_unitario, subtotal, desconto, imposto, total, percentual_desconto, percentual_imposto, observacoes, data_cadastro, data_atualizacao) VALUES
-- Lines for sale 1
(1, 1, 1, 'PROD-CORN-001', 'Premium Yellow Corn', 'Grade A yellow corn, 25kg bags', 1000, 'KG', 25.50, 25500.00, 500.00, 2550.00, 27550.00, 2.0, 10.0, 'Organic certification required', '2026-01-30 14:30:00', '2026-01-30 14:35:00'),

-- Lines for sale 2
(2, 2, 1, 'PROD-CORN-001', 'Premium Yellow Corn', 'Grade A yellow corn, 25kg bags', 1500, 'KG', 24.00, 36000.00, 750.00, 3525.00, 38775.00, 2.0, 10.0, NULL, '2026-01-25 10:00:00', '2026-01-25 10:05:00'),
(3, 2, 2, 'PROD-CORN-002', 'Standard Yellow Corn', 'Grade B yellow corn, 25kg bags', 500, 'KG', 24.00, 12000.00, 250.00, 1175.00, 12925.00, 2.0, 10.0, NULL, '2026-01-25 10:00:00', '2026-01-25 10:05:00'),

-- Lines for sale 3
(4, 3, 1, 'PROD-CORN-001', 'Premium Yellow Corn', 'Grade A yellow corn, 25kg bags', 1500, 'KG', 26.00, 39000.00, 0.00, 3900.00, 42900.00, 0.0, 10.0, NULL, '2026-01-28 16:00:00', '2026-01-28 16:05:00'),

-- Lines for sale 4
(5, 4, 1, 'PROD-VEG-001', 'Fresh Tomatoes', 'Organic tomatoes, 10kg boxes', 500, 'KG', 45.00, 22500.00, 500.00, 2200.00, 24200.00, 2.2, 10.0, 'Refrigerated transport required', '2026-01-20 14:00:00', '2026-01-20 14:05:00'),

-- Lines for sale 5
(6, 5, 1, 'PROD-VEG-002', 'Fresh Lettuce', 'Hydroponic lettuce, premium quality', 300, 'KG', 50.00, 15000.00, 0.00, 1500.00, 16500.00, 0.0, 10.0, NULL, '2026-01-15 11:00:00', '2026-01-15 11:05:00'),

-- Lines for sale 6 (draft)
(7, 6, 1, 'PROD-CORN-001', 'Premium Yellow Corn', 'Grade A yellow corn, 25kg bags', 750, 'KG', 25.00, 18750.00, 0.00, 1875.00, 20625.00, 0.0, 10.0, NULL, '2026-01-10 09:00:00', '2026-01-10 09:05:00');

-- Certifications table (certificacoes)
INSERT INTO certificacoes (id_certificacao, id_produtor, tipo, numero, emissor, validade) VALUES
(1, 1, 'ORGANIC', 'ORG-2025-001', 'IBD', '2027-12-31'),
(2, 2, 'ORGANIC', 'ORG-2025-002', 'IBD', '2027-06-30'),
(3, 2, 'FAIR_TRADE', 'FT-2025-001', 'FLO', '2027-03-31');

-- Status mapping reference:
-- S9 Status -> DynamoDB Status
-- RASCUNHO -> DRAFT
-- CONFIRMADO -> CONFIRMED
-- FATURADO -> INVOICED
-- ENVIADO -> SHIPPED
-- ENTREGUE -> DELIVERED
-- CANCELADO -> CANCELLED
--
-- A (Ativo) -> ACTIVE
-- I (Inativo) -> INACTIVE
-- B (Bloqueado) -> BLOCKED
-- S (Suspenso) -> SUSPENDED
