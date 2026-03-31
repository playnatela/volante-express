require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE URL or KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function compressPhotos() {
  console.log("Iniciando varredura das fotos no bucket 'service-photos'...");

  // Listando arquivos da pasta comprovantes/
  // Pode usar limit maior ou paginação se houver muitos arquivos
  const { data: files, error: listError } = await supabase
    .storage
    .from('service-photos')
    .list('comprovantes', {
      limit: 10000,
      offset: 0,
      sortBy: { column: 'created_at', order: 'desc' },
    });

  if (listError) {
    console.error("Erro ao listar arquivos:", listError);
    return;
  }

  console.log(`Encontrados ${files.length} arquivos.`);

  let processedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let savedBytesTotal = 0;

  for (const file of files) {
    // Ignorar a pasta default ".emptyFolderPlaceholder" ou algo similar
    if (file.name === '.emptyFolderPlaceholder' || !file.id) continue;

    // Apenas comprimir se for maior que 600KB (614400 bytes)
    // Deixamos uma margem acima dos 500KB pra não gastar processamento à toa
    if (file.metadata && file.metadata.size < 600 * 1024) {
      skippedCount++;
      continue;
    }

    try {
      console.log(`[Processando] ${file.name} (Tamanho atual: ${(file.metadata.size / 1024 / 1024).toFixed(2)} MB)...`);
      
      const filePath = `comprovantes/${file.name}`;

      // 1. Download
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('service-photos')
        .download(filePath);

      if (downloadError) throw downloadError;

      const buffer = Buffer.from(await fileData.arrayBuffer());

      // 2. Compressão com sharp
      const ext = file.name.split('.').pop().toLowerCase();
      let transformer = sharp(buffer)
        .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
        .withMetadata(); // removemos metadata pra salvar espaço, mas withMetadata(false) tbm funciona. O default já remove se não chamar, então removeremos.

      // Removemos a chamada de `withMetadata()` para garantir que removes as infos EXIF para salvar espaço
      transformer = sharp(buffer).resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true });

      if (ext === 'jpg' || ext === 'jpeg') {
        transformer = transformer.jpeg({ quality: 80 });
      } else if (ext === 'png') {
        transformer = transformer.png({ quality: 80 });
      } else if (ext === 'webp') {
        transformer = transformer.webp({ quality: 80 });
      }

      const compressedBuffer = await transformer.toBuffer();
      const savedBytes = buffer.length - compressedBuffer.length;

      // Se a compressão ficou maior (raro, mas acontece), a gente não sobrescreve
      if (savedBytes <= 0) {
        console.log(`  -> Ignorado: O arquivo já está bem otimizado.`);
        skippedCount++;
        continue;
      }

      // 3. Upload sobrescrevendo
      const { error: uploadError } = await supabase.storage
        .from('service-photos')
        .upload(filePath, compressedBuffer, {
          upsert: true,
          contentType: fileData.type
        });

      if (uploadError) throw uploadError;

      const savedMB = savedBytes / 1024 / 1024;
      savedBytesTotal += savedBytes;
      console.log(`  -> OK! Economizou ${savedMB.toFixed(2)} MB.`);
      processedCount++;

    } catch (err) {
      console.error(`  -> Erro ao processar ${file.name}:`, err.message);
      errorCount++;
    }
  }

  console.log(`\n=== RESUMO DA OPERAÇÃO ===`);
  console.log(`Total de arquivos avaliados: ${files.length}`);
  console.log(`Arquivos comprimidos: ${processedCount}`);
  console.log(`Arquivos pulados (já eram pequenos): ${skippedCount}`);
  console.log(`Erros: ${errorCount}`);
  console.log(`Espaço total economizado: ${(savedBytesTotal / 1024 / 1024).toFixed(2)} MB`);
}

compressPhotos();
