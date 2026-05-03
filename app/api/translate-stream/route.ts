import { NextRequest } from 'next/server';
import { extractLangFiles, translateLangFiles, repackJar } from '@/lib/jarProcessor';
import { translateModpack } from '@/lib/modpackProcessor';
import {
  parseJsonLang, parseDotLang, parseSnbt, parseToml, parseCfg,
  parseNestedJson, parseXml, parsePlainText, parseProperties, parseYaml,
  rebuildJsonLang, rebuildDotLang, rebuildSnbt, rebuildToml, rebuildCfg,
  rebuildNestedJson, rebuildXml, rebuildPlainText, rebuildProperties, rebuildYaml,
} from '@/lib/langParsers';
import { translateTexts } from '@/lib/deepl';
import { LangEntry } from '@/types';
import { TranslationReportBuilder } from '@/lib/translationReport';

// ============================================================
// BLOCK: Streaming translation endpoint with SSE
// ============================================================
export async function POST(req: NextRequest) {
  console.log('\n=== API /api/translate-stream START ===');
  console.log('Timestamp:', new Date().toISOString());

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Helper to send SSE message
  const sendEvent = async (data: any) => {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    await writer.write(encoder.encode(message));
    console.log('[SSE] Sent:', data.type, data);
  };

  // Start processing in background
  (async () => {
    try {
      const body = await req.json() as { files: Array<{ base64: string; fileName: string; id: string }> };
      console.log('Request body:', { filesCount: body.files.length });

      const files = body.files;
      const totalFiles = files.length;

      // Create report builder
      const reportBuilder = new TranslationReportBuilder(
        totalFiles === 1 ? 'file' : (files[0]?.fileName.endsWith('.zip') ? 'modpack' : 'jar')
      );

      await sendEvent({
        type: 'start',
        totalFiles,
        message: `Начинаем обработку ${totalFiles} файл(ов)...`
      });

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileNumber = i + 1;

        console.log(`\n--- Processing file ${fileNumber}/${totalFiles}: ${file.fileName} ---`);

        await sendEvent({
          type: 'file_start',
          fileId: file.id,
          fileName: file.fileName,
          current: fileNumber,
          total: totalFiles,
          message: `[${fileNumber}/${totalFiles}] Обработка: ${file.fileName}`
        });

        try {
          const buffer = Buffer.from(file.base64, 'base64');
          const ext = file.fileName.split('.').pop()?.toLowerCase();

          let resultBase64: string;
          let translatedCount: number;
          let langFilesCount: number;
          let outputFileName: string;

          // ── ZIP modpack ───────────────────────────────────────
          if (ext === 'zip') {
            await sendEvent({
              type: 'progress',
              fileId: file.id,
              stage: 'extracting',
              message: `[${fileNumber}/${totalFiles}] Извлечение файлов из модпака...`
            });

            resultBase64 = (await translateModpack(buffer)).toString('base64');
            translatedCount = -1;
            langFilesCount = -1;
            outputFileName = file.fileName.replace('.zip', '_RU.zip');

            await sendEvent({
              type: 'progress',
              fileId: file.id,
              stage: 'packing',
              message: `[${fileNumber}/${totalFiles}] Упаковка переведенного модпака...`
            });
          }
          // ── JAR mod ───────────────────────────────────────────
          else if (ext === 'jar') {
            await sendEvent({
              type: 'progress',
              fileId: file.id,
              stage: 'extracting',
              message: `[${fileNumber}/${totalFiles}] Извлечение lang файлов...`
            });

            const langFiles = await extractLangFiles(buffer);
            if (!langFiles.length) {
              throw new Error('Нет английских lang файлов в JAR');
            }

            await sendEvent({
              type: 'progress',
              fileId: file.id,
              stage: 'translating',
              message: `[${fileNumber}/${totalFiles}] Перевод ${langFiles.length} lang файл(ов)...`
            });

            const translations = await translateLangFiles(langFiles);

            // Collect report data for JAR
            for (const langFile of langFiles) {
              const values = langFile.entries.map(e => e.value);
              const translated = await translateTexts(values);

              const entries = langFile.entries.map((entry, i) => ({
                key: entry.key,
                original: entry.value,
                translated: translated[i] ?? entry.value,
              }));

              reportBuilder.addFile(langFile.path, langFile.format, entries);
            }

            await sendEvent({
              type: 'progress',
              fileId: file.id,
              stage: 'packing',
              message: `[${fileNumber}/${totalFiles}] Упаковка JAR...`
            });

            const resultBuffer = await repackJar(buffer, translations);
            resultBase64 = resultBuffer.toString('base64');
            translatedCount = langFiles.reduce((s, f) => s + f.entries.length, 0);
            langFilesCount = langFiles.length;
            outputFileName = file.fileName;
          }
          // ── Standalone file ───────────────────────────────────
          else {
            await sendEvent({
              type: 'progress',
              fileId: file.id,
              stage: 'translating',
              message: `[${fileNumber}/${totalFiles}] Парсинг файла...`
            });

            const content = buffer.toString('utf-8');
            const { entries, rebuild, outName } = await getStandaloneHandler(ext!, content, file.fileName);

            if (!entries.length) {
              throw new Error('Нет строк для перевода');
            }

            await sendEvent({
              type: 'progress',
              fileId: file.id,
              stage: 'translating',
              message: `[${fileNumber}/${totalFiles}] Перевод ${entries.length} строк(и)...`
            });

            const values = entries.map(e => e.value);
            const translated = await translateTexts(values);
            const transMap = new Map(entries.map((e, i) => [e.key, translated[i] ?? e.value]));
            const result = rebuild(content, transMap);

            // Collect report data for standalone file
            const reportEntries = entries.map((entry, i) => ({
              key: entry.key,
              original: entry.value,
              translated: translated[i] ?? entry.value,
            }));
            reportBuilder.addFile(file.fileName, ext!, reportEntries);

            resultBase64 = Buffer.from(result, 'utf-8').toString('base64');
            translatedCount = entries.length;
            langFilesCount = 1;
            outputFileName = outName;
          }

          // Generate reports
          const report = reportBuilder.getReport();
          const textReport = reportBuilder.generateTextReport();
          const htmlReport = reportBuilder.generateHtmlReport();
          const htmlReportBase64 = Buffer.from(htmlReport, 'utf-8').toString('base64');

          // Send success event with report data
          await sendEvent({
            type: 'file_complete',
            fileId: file.id,
            fileName: file.fileName,
            outputFileName,
            resultBase64,
            translatedCount,
            langFilesCount,
            current: fileNumber,
            total: totalFiles,
            report,
            textReport,
            htmlReportBase64,
            message: `[${fileNumber}/${totalFiles}] ✓ Завершено: ${file.fileName}`
          });

          console.log(`File ${fileNumber}/${totalFiles} completed successfully`);

        } catch (fileError) {
          console.error(`Error processing file ${fileNumber}:`, fileError);

          await sendEvent({
            type: 'file_error',
            fileId: file.id,
            fileName: file.fileName,
            error: String(fileError),
            current: fileNumber,
            total: totalFiles,
            message: `[${fileNumber}/${totalFiles}] ✗ Ошибка: ${file.fileName}`
          });
        }
      }

      // All files processed
      await sendEvent({
        type: 'complete',
        totalFiles,
        message: `Все файлы обработаны (${totalFiles}/${totalFiles})`
      });

      console.log('=== API /api/translate-stream END (success) ===\n');

    } catch (error) {
      console.error('=== API /api/translate-stream ERROR ===');
      console.error('Error:', error);

      await sendEvent({
        type: 'error',
        error: String(error),
        message: 'Критическая ошибка при обработке'
      });

      console.log('=== API /api/translate-stream END (error) ===\n');
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// ============================================================
// BLOCK: Standalone file format router (same as non-streaming)
// ============================================================
async function getStandaloneHandler(ext: string, content: string, fileName: string) {
  const ruName = fileName
    .replace(/en[_-]?(us|US)?\.json$/i, 'ru_ru.json')
    .replace(/en[_-]?(us|US)?\.lang$/i, 'ru_ru.lang')
    .replace(/en\.json$/i, 'ru_ru.json');

  switch (ext) {
    case 'json': {
      let entries: LangEntry[];
      try {
        entries = parseJsonLang(content);
      } catch {
        entries = [];
      }
      if (!entries.length) {
        entries = parseNestedJson(content);
      }
      return {
        entries,
        rebuild: entries.length ? rebuildJsonLang : rebuildNestedJson,
        outName: ruName,
      };
    }
    case 'lang':
      return { entries: parseDotLang(content), rebuild: rebuildDotLang, outName: ruName };
    case 'snbt':
      return { entries: parseSnbt(content), rebuild: rebuildSnbt, outName: fileName };
    case 'toml':
      return { entries: parseToml(content), rebuild: rebuildToml, outName: fileName };
    case 'cfg':
      return { entries: parseCfg(content), rebuild: rebuildCfg, outName: fileName };
    case 'xml':
      return { entries: parseXml(content), rebuild: rebuildXml, outName: fileName };
    case 'txt':
      return { entries: parsePlainText(content), rebuild: rebuildPlainText, outName: fileName };
    case 'properties':
      return { entries: parseProperties(content), rebuild: rebuildProperties, outName: fileName };
    case 'yaml':
    case 'yml':
      return { entries: parseYaml(content), rebuild: rebuildYaml, outName: fileName };
    default:
      return { entries: [], rebuild: () => content, outName: fileName };
  }
}
