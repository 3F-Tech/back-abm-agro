const fs = require('fs');
const csv = require('csv-parser');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    // 1. Pergunta pro banco quantos tem
    const totalBanco = await prisma.clientes.count();
    console.log(`🏦 Total no Banco de Dados: ${totalBanco}`);

    // 2. Conta quantas linhas tem no CSV (sem filtrar nada)
    let totalCSV = 0;
    let cnpjsUnicos = new Set();
    const LINHAS_PARA_PULAR = 4; // Mesmo numero que usamos antes

    console.log("📂 Lendo CSV para contar duplicadas...");
    
    fs.createReadStream('dados.csv')
      .pipe(csv({ separator: ';', skipLines: LINHAS_PARA_PULAR }))
      .on('data', (row) => {
          if (row['A1_NOME']) {
            totalCSV++;
            if (row['A1_CGC']) {
                // Adiciona no conjunto (Set só guarda valores únicos)
                cnpjsUnicos.add(row['A1_CGC']);
            }
          }
      })
      .on('end', () => {
          console.log(`\n--- RESULTADO ---`);
          console.log(`📄 Linhas Totais no CSV: ${totalCSV}`);
          console.log(`🆔 CNPJs Únicos (Reais): ${cnpjsUnicos.size}`);
          console.log(`🏦 Salvos no Banco:      ${totalBanco}`);
          
          if (totalBanco === cnpjsUnicos.size) {
              console.log("\n✅ CONCLUSÃO: O sistema importou tudo certo!");
              console.log("   Seu CSV tem 100k linhas, mas apenas 18k clientes ÚNICOS.");
              console.log("   As outras linhas eram repetições do mesmo cliente.");
          } else {
              console.log("\n❌ CONCLUSÃO: Faltou importar gente. Verifique erros de formatação.");
          }
      });
}

check();