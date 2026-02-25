const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function main() {
    console.log("--- INICIANDO CRIAÇÃO DE TABELAS (PASSO A PASSO) ---");

    const queries = [
        `CREATE TABLE IF NOT EXISTS public."user" (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'COMUM',
        "created-at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updated-at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
        `CREATE TABLE IF NOT EXISTS public."clientes" (
        id BIGSERIAL PRIMARY KEY,
        "a1-nome" TEXT,
        "a1-cgc" TEXT,
        email TEXT,
        "a1-ddd" TEXT,
        "a1-tel" TEXT,
        "a1-celular" TEXT,
        "a1-tel3" TEXT,
        "a1-tel4" TEXT,
        "a1-tel5" TEXT,
        "a1-tel6" TEXT,
        "a1-tel7" TEXT,
        "a1-endcob" TEXT,
        "a1-bairroc" TEXT,
        "a1-munc" TEXT,
        "a1-cepc" TEXT,
        "endereco-entrega" TEXT,
        "bairro-entrega" TEXT,
        "municipio-entrega" TEXT,
        "cep-entrega" TEXT,
        "endereco-cadastro" TEXT,
        "bairro-cadastro" TEXT,
        "municipio-cadastro" TEXT,
        tipo TEXT,
        "grupo-vendas" TEXT,
        segmento1 TEXT,
        segmento2 TEXT,
        cria TEXT,
        "nr-compras" INTEGER,
        "a1-mcompra" TIMESTAMP,
        "cod-meso" TEXT,
        meso TEXT,
        "cod-micro" TEXT,
        micro TEXT,
        "data-nascimento" TIMESTAMP,
        "end-mapa" TEXT,
        "created-at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "a1-estc" TEXT,
        "estado-entrega" TEXT,
        "estado-cadastro" TEXT,
        "a1-fatacum" DECIMAL,
        "ticket-medio" DECIMAL
    )`,
        `CREATE TABLE IF NOT EXISTS public."audience_segment" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        created_by TEXT,
        cidade TEXT,
        estado TEXT,
        cnae TEXT,
        locations TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`
    ];

    for (const q of queries) {
        try {
            await prisma.$executeRawUnsafe(q);
            console.log("✅ Comando executado.");
        } catch (err) {
            console.log("❌ Erro no comando:", err.message);
        }
    }

    // Criar ADMIN
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('admin123', salt);
    try {
        await prisma.$executeRawUnsafe(`
      INSERT INTO public."user" (name, email, password, role)
      VALUES ('Administrador', 'admin@admin.com', '${passwordHash}', 'ADMIN')
      ON CONFLICT (email) DO NOTHING
    `);
        console.log("🚀 Admin criado: admin@admin.com / admin123");
    } catch (err) {
        console.log("❌ Erro ao criar admin:", err.message);
    }

    await prisma.$disconnect();
}

main();
