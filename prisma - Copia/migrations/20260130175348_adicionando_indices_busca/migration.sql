-- CreateIndex
CREATE INDEX "clientes_a1-cgc_idx" ON "clientes"("a1-cgc");

-- CreateIndex
CREATE INDEX "clientes_a1-estc_a1-munc_idx" ON "clientes"("a1-estc", "a1-munc");

-- CreateIndex
CREATE INDEX "clientes_segmento1_idx" ON "clientes"("segmento1");

-- CreateIndex
CREATE INDEX "clientes_a1-nome_idx" ON "clientes"("a1-nome");
