require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE URL or KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStorageSize() {
  console.log("Calculando o tamanho do bucket 'service-photos'...");

  let totalSizeBytes = 0;
  let fileCount = 0;
  let offset = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: files, error } = await supabase
      .storage
      .from('service-photos')
      .list('comprovantes', {
        limit: limit,
        offset: offset,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      console.error("Erro ao listar arquivos:", error);
      return;
    }

    if (!files || files.length === 0) {
      hasMore = false;
      break;
    }

    for (const file of files) {
      if (file.name === '.emptyFolderPlaceholder' || !file.id) continue;
      if (file.metadata && file.metadata.size) {
        totalSizeBytes += file.metadata.size;
        fileCount++;
      }
    }

    if (files.length < limit) {
      hasMore = false;
    } else {
      offset += limit;
    }
  }

  const totalSizeMB = (totalSizeBytes / 1024 / 1024).toFixed(2);
  const totalSizeGB = (totalSizeBytes / 1024 / 1024 / 1024).toFixed(3);

  console.log(`\n=== RELATÓRIO DE ARMAZENAMENTO ===`);
  console.log(`Arquivos encontrados: ${fileCount}`);
  console.log(`Tamanho Total (MB): ${totalSizeMB} MB`);
  console.log(`Tamanho Total (GB): ${totalSizeGB} GB`);
  console.log(`\nVocê tem 1 GB (1024 MB) gratuitos no Supabase.`);
  console.log(`Você está usando ${((totalSizeBytes / (1024 * 1024 * 1024)) * 100).toFixed(2)}% do seu limite gratuito.`);
}

checkStorageSize();
