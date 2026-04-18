-- 0011: categorias globais de servicos do prestador

ALTER TABLE users ADD COLUMN provider_categories TEXT DEFAULT '[]';

-- Compatibilidade: prestadores existentes passam a receber oportunidades gerais
UPDATE users
SET provider_categories = '["general"]'
WHERE role = 'provider'
  AND (provider_categories IS NULL OR provider_categories = '[]');
