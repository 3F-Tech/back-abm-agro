-- Migração para Otimização de Performance da Base CNPJ
-- ⚠️ RECOMENDAÇÃO: Executar um por um e monitorar o uso de disco e CPU.
-- O uso de CONCURRENTLY evita travar as tabelas para escrita, mas consome mais recursos temporários.

-- 1. EXTENSÕES NECESSÁRIAS
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. ÍNDICES B-TREE (Busca Exata e Prefixo)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_estab_uf ON cnpj.estabelecimentos(uf);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_estab_municipio ON cnpj.estabelecimentos(municipio);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_estab_cnae ON cnpj.estabelecimentos(cnae_fiscal_principal);

-- 3. ÍNDICES TRIGRAM (Busca Textual LIKE '%term%')
-- Otimiza buscas por Razão Social e Nome Fantasia
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_empresa_razao_social_trgm ON cnpj.empresas USING gin (upper(razao_social) gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_estab_nome_fantasia_trgm ON cnpj.estabelecimentos USING gin (upper(nome_fantasia) gin_trgm_ops);

-- 4. ÍNDICES FUNCIONAIS (Para evitar translate/unaccent em runtime se possível)
-- Se o app usa muito a busca de CNAE com translate, este índice ajuda:
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_estab_cnae_trans ON cnpj.estabelecimentos (
  translate(upper(coalesce(cnae_fiscal_principal,'')), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ', 'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')
);

-- 5. ATUALIZAR ESTATÍSTICAS
-- ANALYZE cnpj.estabelecimentos;
-- ANALYZE cnpj.empresas;

/* 
ROLLBACK:
DROP INDEX CONCURRENTLY IF EXISTS cnpj.idx_estab_uf;
DROP INDEX CONCURRENTLY IF EXISTS cnpj.idx_estab_municipio;
DROP INDEX CONCURRENTLY IF EXISTS cnpj.idx_estab_cnae;
DROP INDEX CONCURRENTLY IF EXISTS cnpj.idx_empresa_razao_social_trgm;
DROP INDEX CONCURRENTLY IF EXISTS cnpj.idx_estab_nome_fantasia_trgm;
DROP INDEX CONCURRENTLY IF EXISTS cnpj.idx_estab_cnae_trans;
*/
