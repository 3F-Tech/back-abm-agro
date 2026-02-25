name: prisma-model-refactor-safe
description: >
  Refatora serviços que utilizam Prisma.sql ou $queryRaw para utilizar exclusivamente Prisma Models (findMany, count, include, where, AND/OR), eliminando SQL manual sem quebrar o comportamento original.

triggers:
  - detect: Prisma.sql
  - detect: $queryRaw
  - detect: QueryStream
  - detect: montagem manual de SQL
  - detect: concatenação de WHERE

rules:
  - NEVER use Prisma.sql
  - NEVER use Prisma.join
  - NEVER use $queryRaw
  - NEVER use raw SQL strings
  - NEVER concatenate SQL
  - ALWAYS use Prisma Models
  - ALWAYS preserve return format
  - ALWAYS preserve pagination logic
  - ALWAYS sanitize user input
  - ALWAYS maintain production safety

process:

  step_1_analyze_schema:
    action: |
      Ler schema.prisma.
      Identificar:
        - Models envolvidos
        - Relations existentes
        - Campos mapeados via @@map e @@schema
      Se relation necessária não existir:
        - Criar relation no schema
        - NÃO remover campos existentes
        - Garantir compatibilidade

  step_2_extract_filters:
    action: |
      Identificar todos os filtros existentes:
        - state
        - city
        - cnae
        - cnpj
        - razaoSocial
        - porteEmpresa
        - capitalSocialMin/Max
        - selection (manualIds/excludedIds)
      Criar função _buildPrismaWhere(filters)
      Nunca usar SQL manual

  step_3_build_where:
    action: |
      Construir objeto where usando:
        - AND: []
        - OR: []
        - in
        - contains
        - mode: 'insensitive'
        - gte/lte
        - relation filtering (empresa: {...})
      Sanitizar arrays:
        - aceitar string
        - aceitar array
        - aceitar objeto {label,value}
      Remover tudo que não seja string/number válida

  step_4_cnpj_logic:
    rules:
      - If input has 14 digits → exact match only
      - If input has 8 digits → filter by cnpj_basico
      - Do NOT auto-expand 14 to 8
      - Do NOT use SQL concat
    action: |
      Se necessário:
        - Criar campo virtual cnpj (no pós-processamento)
        - OU exigir coluna cnpj14 no banco

  step_5_pagination:
    action: |
      Usar prisma.$transaction:
        [
          findMany({ where, skip, take }),
          count({ where })
        ]

  step_6_city_enrichment:
    action: |
      Se relation municipios existir:
        usar include
      Senão:
        fazer lookup separado via Prisma model
      Nunca usar join SQL manual

  step_7_export_stream:
    action: |
      Se houver export CSV:
        - NÃO usar QueryStream com SQL
        - Implementar paginação em batches (ex: 10k)
        - Stream manual Node.js
        - Nunca carregar tudo em memória

output_requirements:
  - Código completo refatorado
  - Função _buildPrismaWhere
  - Ajustes necessários no schema.prisma
  - Garantia de não uso de SQL raw
  - Lista de testes manuais

safety_checks:
  - Combinação múltipla de filtros não pode quebrar
  - Arrays vazios devem ser ignorados
  - Nenhuma condição pode gerar objeto inválido
  - Nenhuma string pode virar "[object Object]"
  - Código deve compilar sem erro TypeScript

performance_notes:
  - Se campo concatenado for necessário:
      recomendar coluna gerada cnpj14 no banco
  - Se capital_social for string:
      recomendar coluna numérica capital_social_num indexada
  - NÃO aplicar CAST no runtime
