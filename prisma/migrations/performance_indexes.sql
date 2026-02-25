-- =============================================================
-- ÍNDICES DE PERFORMANCE – schema cnpj
-- Executar manualmente no banco (não é migration automática).
-- Após criar, rodar: ANALYZE cnpj.estabelecimentos; ANALYZE cnpj.empresas;
-- =============================================================

-- Requer extensão pg_trgm (trigram) para buscas LIKE/contains eficientes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── estabelecimentos ────────────────────────────────────────

-- PK composta já indexada: (cnpj_basico, cnpj_ordem, cnpj_dv)
-- Garante que cursor keyset seja O(1) no export.

-- Filtro UF + municipio (usado em 99% das buscas geográficas)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_estab_uf_municipio
  ON cnpj.estabelecimentos (uf, municipio);

-- Filtro CNAE principal (IN exato – B-tree)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_estab_cnae_principal
  ON cnpj.estabelecimentos (cnae_fiscal_principal);

-- Busca por nome fantasia (LIKE '%x%' → precisa trigram)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_estab_nome_fantasia_trgm
  ON cnpj.estabelecimentos USING gin (nome_fantasia gin_trgm_ops);

-- CNAE secundário (campo texto, busca contains → trigram)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_estab_cnae_secundaria_trgm
  ON cnpj.estabelecimentos USING gin (cnae_fiscal_secundaria gin_trgm_ops);

-- Filtro direto por cnpj_basico (join com empresas)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_estab_cnpj_basico
  ON cnpj.estabelecimentos (cnpj_basico);

-- ─── empresas ────────────────────────────────────────────────

-- Razão social (busca insensitive contains → trigram)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_empresas_razao_social_trgm
  ON cnpj.empresas USING gin (razao_social gin_trgm_ops);

-- Porte empresa (filtro IN exato)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_empresas_porte
  ON cnpj.empresas (porte_empresa);

-- Capital social zero (filtro de string exato)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_empresas_capital_social
  ON cnpj.empresas (capital_social);

-- ─── municipios ──────────────────────────────────────────────

-- Já tem PK em codigo_municipio.
-- Para busca por nome (equals, uppercase):
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_municipios_nome
  ON cnpj.municipios (nome_municipio);

-- ─── ANALYZE após criar índices ──────────────────────────────
ANALYZE cnpj.estabelecimentos;
ANALYZE cnpj.empresas;
ANALYZE cnpj.municipios;
