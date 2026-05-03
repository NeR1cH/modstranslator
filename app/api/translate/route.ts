import { NextRequest, NextResponse } from 'next/server';
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
// BLOCK: Route handler — dispatches by file format
// ============================================================
export async function POST(req: NextRequest) {
  console.log('\n=== API /api/translate START ===');
  console.log('Timestamp:', new Date().toISOString());

  try {
    const body = await req.json() as { base64: string; fileName: string };
    console.log('Request body keys:', Object.keys(body));
    console.log('fileName:', body.fileName);
    console.log('base64 length:', body.base64?.length || 0);

    const { base64, fileName } = body;
    const buffer = Buffer.from(base64, 'base64');
    console.log('Buffer size:', buffer.length, 'bytes');

    const ext = fileName.split('.').pop()?.toLowerCase();
    console.log('Detected extension:', ext);

    // ── ZIP modpack (full automatic translation) ───────────────
    if (ext === 'zip') {
      console.log('Processing as ZIP modpack...');
      const resultBuffer = await translateModpack(buffer);
      console.log('Modpack translation complete, result size:', resultBuffer.length, 'bytes');
      const response = {
        resultBase64: resultBuffer.toString('base64'),
        translatedCount: -1, // counted inside
        langFilesCount: -1,
        outputFileName: fileName.replace('.zip', '_RU.zip'),
      };
      console.log('Response outputFileName:', response.outputFileName);
      console.log('Response resultBase64 length:', response.resultBase64.length);
      console.log('=== API /api/translate END (ZIP) ===\n');
      return NextResponse.json(response);
    }

    // ── JAR mod ────────────────────────────────────────────────
    if (ext === 'jar') {
      console.log('Processing as JAR mod...');
      console.log('Extracting lang files...');
      const langFiles = await extractLangFiles(buffer);
      console.log('Lang files extracted:', langFiles.length);

      if (!langFiles.length) {
        console.error('No English lang files found in JAR');
        throw new Error('Нет английских lang файлов в JAR');
      }

      // Создаем отчет о переводе
      const reportBuilder = new TranslationReportBuilder('jar');

      console.log('Translating lang files...');
      const translations = await translateLangFiles(langFiles);
      console.log('Translations complete');

      // Собираем данные для отчета
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

      console.log('Repacking JAR...');
      const resultBuffer = await repackJar(buffer, translations);
      console.log('JAR repacked, result size:', resultBuffer.length, 'bytes');

      const totalStrings = langFiles.reduce((s, f) => s + f.entries.length, 0);
      console.log('Total strings translated:', totalStrings);

      // Генерируем текстовый отчет
      const textReport = reportBuilder.generateTextReport();
      console.log('\n' + textReport);

      // Генерируем HTML отчет
      const htmlReport = reportBuilder.generateHtmlReport();

      const response = {
        resultBase64: resultBuffer.toString('base64'),
        translatedCount: totalStrings,
        langFilesCount: langFiles.length,
        outputFileName: fileName,
        report: reportBuilder.getReport(),
        textReport,
        htmlReportBase64: Buffer.from(htmlReport, 'utf-8').toString('base64'),
      };
      console.log('Response:', response);
      console.log('=== API /api/translate END (JAR) ===\n');
      return NextResponse.json(response);
    }

    // ── Standalone file handlers ───────────────────────────────
    console.log('Processing as standalone file...');
    const content = buffer.toString('utf-8');
    console.log('Content length:', content.length, 'chars');

    const { entries, rebuild, outName } = await getStandaloneHandler(ext!, content, fileName);
    console.log('Standalone handler result:');
    console.log('  entries count:', entries.length);
    console.log('  output name:', outName);

    if (!entries.length) {
      console.error('No strings to translate');
      throw new Error('Нет строк для перевода');
    }

    // Создаем отчет о переводе
    const reportBuilder = new TranslationReportBuilder('file');

    console.log('Extracting values for translation...');
    const values = entries.map(e => e.value);
    console.log('Values to translate:', values.length);

    console.log('Calling DeepL API...');
    const translated = await translateTexts(values);
    console.log('Translation complete, received:', translated.length, 'translations');

    // Собираем данные для отчета
    const reportEntries = entries.map((entry, i) => ({
      key: entry.key,
      original: entry.value,
      translated: translated[i] ?? entry.value,
    }));
    reportBuilder.addFile(fileName, ext!, reportEntries);

    console.log('Building translation map...');
    const transMap = new Map(entries.map((e, i) => [e.key, translated[i] ?? e.value]));
    console.log('Translation map size:', transMap.size);

    console.log('Rebuilding file...');
    const result = rebuild(content, transMap);
    console.log('Rebuilt file length:', result.length, 'chars');

    // Генерируем текстовый отчет
    const textReport = reportBuilder.generateTextReport();
    console.log('\n' + textReport);

    // Генерируем HTML отчет
    const htmlReport = reportBuilder.generateHtmlReport();

    const response = {
      resultBase64: Buffer.from(result, 'utf-8').toString('base64'),
      translatedCount: entries.length,
      langFilesCount: 1,
      outputFileName: outName,
      report: reportBuilder.getReport(),
      textReport,
      htmlReportBase64: Buffer.from(htmlReport, 'utf-8').toString('base64'),
    };
    console.log('Response:', response);
    console.log('=== API /api/translate END (standalone) ===\n');
    return NextResponse.json(response);

  } catch (err) {
    console.error('=== API /api/translate ERROR ===');
    console.error('Error:', err);
    console.error('Error stack:', err instanceof Error ? err.stack : 'no stack');
    console.log('=== API /api/translate END (error) ===\n');
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ============================================================
// BLOCK: Standalone file format router
// ============================================================
async function getStandaloneHandler(ext: string, content: string, fileName: string) {
  console.log('getStandaloneHandler called for ext:', ext);

  const ruName = fileName
    .replace(/en[_-]?(us|US)?\.json$/i, 'ru_ru.json')
    .replace(/en[_-]?(us|US)?\.lang$/i, 'ru_ru.lang')
    .replace(/en\.json$/i, 'ru_ru.json');

  console.log('Output filename will be:', ruName);

  switch (ext) {
    case 'json': {
      console.log('Trying JSON lang format...');
      // Try flat lang first, fall back to nested
      let entries: LangEntry[];
      try {
        entries = parseJsonLang(content);
        console.log('Flat JSON parsed, entries:', entries.length);
      } catch (err) {
        console.log('Flat JSON failed, trying nested JSON...');
        entries = [];
      }
      if (!entries.length) {
        entries = parseNestedJson(content);
        console.log('Nested JSON parsed, entries:', entries.length);
      }
      return {
        entries,
        rebuild: entries.length ? rebuildJsonLang : rebuildNestedJson,
        outName: ruName,
      };
    }
    case 'lang':
      console.log('Parsing .lang format...');
      return { entries: parseDotLang(content), rebuild: rebuildDotLang, outName: ruName };
    case 'snbt':
      console.log('Parsing SNBT format...');
      return { entries: parseSnbt(content), rebuild: rebuildSnbt, outName: fileName };
    case 'toml':
      console.log('Parsing TOML format...');
      return { entries: parseToml(content), rebuild: rebuildToml, outName: fileName };
    case 'cfg':
      console.log('Parsing CFG format...');
      return { entries: parseCfg(content), rebuild: rebuildCfg, outName: fileName };
    case 'xml':
      console.log('Parsing XML format...');
      return { entries: parseXml(content), rebuild: rebuildXml, outName: fileName };
    case 'txt':
      console.log('Parsing plain text format...');
      return { entries: parsePlainText(content), rebuild: rebuildPlainText, outName: fileName };
    case 'properties':
      console.log('Parsing .properties format...');
      return { entries: parseProperties(content), rebuild: rebuildProperties, outName: fileName };
    case 'yaml':
      console.log('Parsing .yaml format...');
      return { entries: parseYaml(content), rebuild: rebuildYaml, outName: fileName };
    default:
      console.warn('Unknown format, returning empty');
      return { entries: [], rebuild: () => content, outName: fileName };
  }
}
