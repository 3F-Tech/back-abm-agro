# Skill: Guardrails de Alteração (NÃO QUEBRAR O CÓDIGO)

Este documento define **regras inegociáveis** do que **NÃO pode ser alterado** de forma alguma ao mexer no backend (especialmente `/search`) para evitar regressões, quebra de contrato com o front, ou degradação brutal de performance.

---

## 1) Contratos de API (NÃO MEXER)

### 1.1 Endpoint `/search`
- **Não mudar o método** (`POST /search`).
- **Não mudar o formato do body** esperado:
  - `{ filters, page, pageSize }`
- **Não mudar o formato do response existente**:
  - `items` **deve existir** e continuar sendo array
  - `total` **deve existir** (pode ser `null` se já era assim)
- **Proibido** renomear campos (`items`, `total`, `filters`, `page`, `pageSize`).
- **Proibido** trocar `req.body` por querystring, ou “padronizar” payload.

**Se novos campos forem adicionados (ex.: `totalPages`)**:
- devem ser **aditivos** (não removem nada).
- não podem alterar a estrutura dos já existentes.

---

## 2) Controller (NÃO REFATORAR)

Arquivo típico: `src/controllers/CompanyController.js`

- **Não renomear**:
  - `CompanyController.search`
  - `CompanyController._serializeItem`
  - `CompanyController.getItemsByIds`
  - `CompanyController.getAllIdsFilter`
  - `CompanyController.exportCsv`
- **Não mover** funções de arquivo.
- **Não mudar** o pipeline:
  - `FilterService.searchEstablishments(...)` → `items` → `map(_serializeItem)` → `res.json(...)`

### 2.1 Serialização (`_serializeItem`)
- **Não remover** campos já retornados.
- **Não trocar a origem** dos campos sem necessidade (ex.: `empresa?.razao_social` vs `razao_social`).
- **Não alterar regras de formatação**:
  - montagem do `cnpjCompleto` e `cnpjFormatado`
  - mapeamento de `porteMapping` e `situacaoMapping`
  - regras de `telefone1` e `telefone2`

---

## 3) Service de Busca (NÃO MUDAR A LÓGICA DE FILTRO)

Arquivo típico: `src/services/FilterService.js`

### 3.1 Entradas e comportamento
- `searchEstablishments(filters, page, pageSize)`:
  - **não mudar assinatura**
  - **não mudar defaults** sem extrema necessidade
  - **não mudar** o comportamento de filtros existentes (UF/cidade/CNAE/CNPJ/nome/razão social/porte)

### 3.2 Regras de filtros (NÃO ALTERAR)
- UF: deve continuar filtrando por `e."uf"`.
- Cidade: deve continuar resolvendo códigos via `_resolveCityCodes(...)` (não substituir por texto direto).
- CNAE:
  - principal: `e."cnae_fiscal_principal"`
  - secundário: `e."cnae_fiscal_secundaria"`
  - **não mudar o tipo de matching** (LIKE/ILIKE/regex) sem benchmark.
- CNPJ:
  - se filtrar por 14 dígitos, tem que bater exatamente
  - se filtrar por básico, tem que bater por `cnpj_basico`
- Nome fantasia: não quebrar busca parcial.
- Razão social / porte: não quebrar join com empresas quando necessário.

---

## 4) Query Raw / Prisma.sql (NÃO ARRISCAR)

### 4.1 Parametrização (obrigatório)
- **Proibido** concatenar strings com valores do usuário dentro de SQL.
- **Obrigatório** usar `Prisma.sql` e parâmetros:
  - `Prisma.sql\` ... ${value} ... \``
  - `Prisma.join([...], Prisma.sql\` AND \`)`
- **Nunca** usar `" OR "` ou `" AND "` como string pura dentro de `Prisma.join`:
  - ✅ `Prisma.join(parts, Prisma.sql\` OR \`)`
  - ❌ `Prisma.join(parts, ' OR ')`

### 4.2 Performance (não degradar)
- **Proibido** introduzir JOIN que cause:
  - `Seq Scan` gigante na tabela `empresas` (66M rows)
  - leitura massiva de disco para paginação simples
- **Proibido** remover LIMIT/OFFSET do fluxo de paginação.
- **Proibido** adicionar ORDER BY caro sem índice.
- **Proibido** substituir consultas otimizadas por `findMany` com includes que causem N+1.

---

## 5) Índices / Banco (NÃO MEXER AUTOMATICAMENTE)

- **Não criar migrations automaticamente** sem instrução explícita.
- **Não rodar** `VACUUM FULL`, `REINDEX`, `CLUSTER`, `ALTER SYSTEM` sem autorização explícita.
- **Não mudar config de Postgres** (shared_buffers, work_mem, etc.) sem pedido explícito.
- **Não remover índices existentes**.

---

## 6) Logs e Debug (NÃO REMOVER)

- **Não remover** logs existentes (principalmente os que medem tempo).
- Se adicionar logs, devem ser:
  - curtos
  - sem imprimir payload inteiro sensível
  - fáceis de desligar depois (mas sem criar infra nova)

---

## 7) Export CSV (NÃO QUEBRAR)

- `exportCsv`:
  - **não mudar** o header atual sem instrução.
  - **não mudar** o separador `;`.
  - **não mudar** a ordem dos campos já exportados.

---

## 8) Compatibilidade com Front (NÃO ALTERAR FORMATO)

- **Não renomear colunas retornadas**.
- **Não trocar idioma/labels** no back (ex.: “porte” → “porte_empresa”).
- **Não remover** campos “nulos” — o front pode depender do campo existir mesmo vazio.

---

## 9) Mudanças Permitidas (somente estas)

✅ Permitido:
- adicionar campos no response de forma **aditiva** (`totalPages`, `page`, `pageSize`)
- adicionar uma query `COUNT(*)` separada **parametrizada** para calcular `total` se hoje estiver `null`
- corrigir bug claro de SQL (ex.: `[object Object]` no meio da query)
- otimizar join com estratégia comprovada (ex.: LATERAL ou subquery) **desde que**:
  - não altere resultado
  - venha com EXPLAIN/ANALYZE mostrando ganho

❌ Não permitido:
- refatorar estrutura inteira do service
- trocar Prisma raw por ORM “por padrão”
- mudar schema Prisma, nomes de models, ou relações
- mudar como CNPJ é montado/formatado

---

## 10) Critério de Aceitação (CHECKLIST FINAL)

Antes de considerar “feito”, validar:

- ✅ `/search` retorna `items` e `total` como antes
- ✅ nenhum campo antigo sumiu
- ✅ filtros continuam retornando os mesmos resultados
- ✅ sem erro de SQL (42601, P2010)
- ✅ query não contém `[object Object]`
- ✅ tempo com paginação básica (ex.: UF) não degrada
- ✅ não surgiu `Seq Scan` completo em `empresas` quando não precisa

---

## Regra de Ouro

Se houver dúvida entre **“refatorar para ficar bonito”** e **“não quebrar”**:
> **Escolha NÃO QUEBRAR.**