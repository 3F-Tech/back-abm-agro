const fs = require('fs');
const csv = require('csv-parser');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const clientesParaImportar = [];

// --- CONFIGURAÇÃO ---
const LINHAS_PARA_PULAR = 4; 

// --- FUNÇÕES DE LIMPEZA E TRATAMENTO ---

// 🚿 NOVA FUNÇÃO: Remove caracteres proibidos (Null Byte 0x00)
function tratarString(valor) {
    if (!valor || typeof valor !== 'string') return null;
    // Remove o \0 (null byte) que quebra o Postgres e remove espaços nas pontas
    const limpo = valor.replace(/\0/g, '').trim();
    return limpo === '' ? null : limpo;
}

function tratarMoeda(valor) {
    if (!valor) return null;
    let limpo = valor.replace(/[^\d,-]/g, '').replace(',', '.');
    const numero = parseFloat(limpo);
    return isNaN(numero) ? null : numero;
}

function tratarInt(valor) {
    if (!valor) return null;
    const numero = parseInt(valor.replace(/\D/g, ''));
    return isNaN(numero) ? null : numero;
}

function tratarData(valor) {
    if (!valor || typeof valor !== 'string') return null;
    const str = valor.trim();
    if (str === '') return null;

    let dataFinal = null;

    if (str.includes('/')) {
        const partes = str.split('/');
        if (partes.length === 3) {
            const dia = partes[0];
            const mes = partes[1];
            const ano = partes[2];
            if (ano.length === 4) {
                dataFinal = new Date(`${ano}-${mes}-${dia}T00:00:00.000Z`);
            }
        }
    } 
    
    if (!dataFinal || isNaN(dataFinal.getTime())) {
        dataFinal = new Date(str);
    }

    if (isNaN(dataFinal.getTime())) return null; 

    return dataFinal;
}

async function main() {
    console.log("🧹 Limpando tabela antiga...");
    await prisma.clientes.deleteMany(); 
    console.log("✅ Tabela limpa.");

    console.log(`🚀 Lendo CSV (Pulando ${LINHAS_PARA_PULAR} linhas)...`);

    fs.createReadStream('dados.csv')
      .pipe(csv({ 
          separator: ';', 
          skipLines: LINHAS_PARA_PULAR,
          mapHeaders: ({ header }) => header.trim().replace(/^\ufeff/, '') 
      }))
      .on('data', (row) => {
        if (!row['A1_NOME']) return;

        const faturamento = tratarMoeda(row['A1_FATACUM']) || 0;
        const compras = tratarInt(row['NR_COMPRAS']) || 0;
        let ticketCalculado = 0;
        if (compras > 0) ticketCalculado = faturamento / compras;

        const cliente = {
          // -- Identificação (TODOS usam tratarString agora) --
          a1Nome: tratarString(row['A1_NOME']),
          a1Cgc: tratarString(row['A1_CGC']),
          email: tratarString(row['EMAIL']),
          a1Ddd: tratarString(row['A1_DDD']),
          a1Tel: tratarString(row['A1_TEL']),
          a1Celular: tratarString(row['A1_CELULAR']),
          
          // -- Telefones Extras --
          a1Tel3: tratarString(row['A1_TEL3']),
          a1Tel4: tratarString(row['A1_TEL4']),
          a1Tel5: tratarString(row['A1_TEL5']),
          a1Tel6: tratarString(row['A1_TEL6']),
          a1Tel7: tratarString(row['A1_TEL7']),

          // -- Endereço Cobrança --
          a1Endcob: tratarString(row['A1_ENDCOB']),
          a1Bairroc: tratarString(row['A1_BAIRROC']),
          a1Munc: tratarString(row['A1_MUNC']),
          a1Estc: tratarString(row['A1_ESTC']),
          a1Cepc: tratarString(row['A1_CEPC']),

          // -- Endereço Entrega --
          enderecoEntrega: tratarString(row['ENDERECO_ENTREGA']),
          bairroEntrega: tratarString(row['BAIRRO_ENTREGA']),
          municipioEntrega: tratarString(row['MUNICIPIO_ENTREGA']),
          estadoEntrega: tratarString(row['ESTADO_ENTREGA']),
          cepEntrega: tratarString(row['CEP_ENTREGA']),

          // -- Endereço Cadastro --
          enderecoCadastro: tratarString(row['ENDERECO_CADASTRO']),
          bairroCadastro: tratarString(row['BAIRRO_CADASTRO']),
          municipioCadastro: tratarString(row['MUNICIPIO_CADASTRO']),
          estadoCadastro: tratarString(row['ESTADO_CADASTRO']),

          // -- Classificação --
          tipo: tratarString(row['TIPO']),
          grupoVendas: tratarString(row['GRUPO_VENDAS']),
          segmento1: tratarString(row['SEGMENTO1']),
          segmento2: tratarString(row['SEGMENTO2']),
          cria: tratarString(row['CRIA']),

          // -- Métricas --
          nrCompras: compras,
          a1Mcompra: tratarData(row['A1_MCOMPRA']),
          a1Fatacum: faturamento,
          ticketMedio: ticketCalculado, 

          // -- Regionalização --
          codMeso: tratarString(row['COD_MESO']),
          meso: tratarString(row['MESO']),
          codMicro: tratarString(row['COD_MICRO']),
          micro: tratarString(row['MICRO']),

          // -- Pessoais --
          dataNascimento: tratarData(row['DATA_NASCIMENTO']),
          endMapa: tratarString(row['END_MAPA']) // O CULPADO ESTAVA AQUI
        };

        clientesParaImportar.push(cliente);
      })
      .on('end', async () => {
        console.log(`📦 CSV Lido. Total válido: ${clientesParaImportar.length}`);
        
        if (clientesParaImportar.length > 0) {
            console.log("💾 Inserindo no banco de dados (Lotes de 2000)...");

            const batchSize = 2000;
            for (let i = 0; i < clientesParaImportar.length; i += batchSize) {
                const lote = clientesParaImportar.slice(i, i + batchSize);
                try {
                    await prisma.clientes.createMany({
                        data: lote,
                        skipDuplicates: true, 
                    });
                    process.stdout.write(`✅ `); 
                } catch (error) {
                    console.error(`\n❌ Erro no lote ${i}:`, error.message);
                }
            }
            console.log("\n🏆 Importação Concluída!");
        } else {
            console.error("❌ Nenhuma linha encontrada.");
        }

        await prisma.$disconnect();
      });
}

main().catch(e => {
    console.error(e);
    prisma.$disconnect();
});