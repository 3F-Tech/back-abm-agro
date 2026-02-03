-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'COMUM');

-- CreateTable
CREATE TABLE "user" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'COMUM',
    "created-at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated-at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" BIGSERIAL NOT NULL,
    "a1-nome" TEXT,
    "a1-cgc" TEXT,
    "email" TEXT,
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
    "tipo" TEXT,
    "grupo-vendas" TEXT,
    "segmento1" TEXT,
    "segmento2" TEXT,
    "cria" TEXT,
    "nr-compras" INTEGER,
    "a1-mcompra" TIMESTAMP(3),
    "cod-meso" TEXT,
    "meso" TEXT,
    "cod-micro" TEXT,
    "micro" TEXT,
    "data-nascimento" TIMESTAMP(3),
    "end-mapa" TEXT,
    "created-at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "a1-estc" CHAR(2),
    "estado-entrega" CHAR(2),
    "estado-cadastro" CHAR(2),
    "a1-fatacum" DECIMAL(14,2),
    "ticket-medio" DECIMAL(14,2),

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");
