import JSZip from 'jszip';
import { extractLangFiles, translateLangFiles, repackJar } from './jarProcessor';
import { LangEntry } from '@/types';
import { sanitizePath } from './security';
import { FileStrategy } from './types';
import { getStrategyResolver } from './FileStrategyResolver';
import { extractEntries, translateFile } from './FileTranslator';
import { createLogger } from './logger';

const logger = createLogger('modpackProcessor');

// ============================================================
// BLOCK: Russian path generator
// en_us.json → ru_ru.json, keeps all other files at same path
// ============================================================
function getRuPath(originalPath: string): string {
  return originalPath
    .replace(/en[_-]?(us|US)?\.json$/i, 'ru_ru.json')
    .replace(/en[_-]?(us|US)?\.lang$/i, 'ru_ru.lang')
    .replace(/en[_-]?(us|US)?\.snbt$/i, 'ru_ru.snbt')
    .replace(/en\.json$/i, 'ru_ru.json')
    .replace(/en\.lang$/i, 'ru_ru.lang')
    .replace(/en\.snbt$/i, 'ru_ru.snbt');
}

// ============================================================
// BLOCK: ZIP/folder modpack processor
// Scans every file, translates what it can, repacks as ZIP
// ============================================================
export interface ModpackStats {
  totalFiles: number;
  translatableFiles: number;
  totalStrings: number;
}

export async function analyzeModpack(zipBuffer: Buffer): Promise<ModpackStats> {
  logger.info('analyzeModpack called, ZIP buffer size:', zipBuffer.length, 'bytes');

  const zip = await JSZip.loadAsync(zipBuffer);
  logger.debug('ZIP loaded');

  let translatableFiles = 0;
  let totalStrings = 0;
  let totalFiles = 0;

  const allFiles = Object.entries(zip.files);
  logger.debug('Total entries in ZIP:', allFiles.length);

  const resolver = getStrategyResolver();

  for (const [path, file] of allFiles) {
    if (file.dir) continue;
    totalFiles++;

    const result = resolver.resolve(path);
    if (!result.strategy) continue;

    logger.debug('Analyzing:', path, '| strategy:', result.strategy);

    try {
      // Special handling for JAR files
      if (result.strategy === FileStrategy.JAR) {
        const jarBuffer = await file.async('nodebuffer');
        const langFiles = await extractLangFiles(jarBuffer);

        if (langFiles.length > 0) {
          translatableFiles++;
          const jarStrings = langFiles.reduce((sum, lf) => sum + lf.entries.length, 0);
          totalStrings += jarStrings;
          logger.debug('→ Found', langFiles.length, 'lang files,', jarStrings, 'strings');
        }
      } else {
        // Regular file processing
        const content = await file.async('string');
        const entries = extractEntries(path, content, result.strategy);

        if (entries.length > 0) {
          translatableFiles++;
          totalStrings += entries.length;
          logger.debug('→ Found', entries.length, 'translatable strings');
        }
      }
    } catch (err) {
      logger.error('→ Error analyzing:', err);
      /* skip malformed files */
    }
  }

  const stats = { totalFiles, translatableFiles, totalStrings };
  logger.info('Analysis complete:', stats);
  return stats;
}

export async function translateModpack(
  zipBuffer: Buffer,
  onProgress?: (done: number, total: number, currentFile: string) => void
): Promise<Buffer> {
  logger.info('translateModpack called, ZIP buffer size:', zipBuffer.length, 'bytes');

  const zip = await JSZip.loadAsync(zipBuffer);
  const result = await JSZip.loadAsync(zipBuffer); // start with copy of original
  logger.debug('ZIP loaded, creating result copy');

  const entries = Object.entries(zip.files).filter(([, f]) => !f.dir);
  logger.info('Total files to process:', entries.length);

  const resolver = getStrategyResolver();
  let done = 0;

  for (const [path, file] of entries) {
    const strategyResult = resolver.resolve(path);
    if (!strategyResult.strategy) {
      done++;
      continue;
    }

    logger.info(`[${done + 1}/${entries.length}] Processing:`, path);
    logger.debug('Strategy:', strategyResult.strategy);

    onProgress?.(done, entries.length, path);

    try {
      // Special handling for JAR files
      if (strategyResult.strategy === FileStrategy.JAR) {
        logger.debug('Processing nested JAR file...');
        const jarBuffer = await file.async('nodebuffer');
        logger.debug('JAR buffer size:', jarBuffer.length, 'bytes');

        // Extract lang files from JAR
        const langFiles = await extractLangFiles(jarBuffer);
        logger.debug('Lang files found:', langFiles.length);

        if (langFiles.length > 0) {
          // Translate all lang files
          const translations = await translateLangFiles(langFiles);
          logger.debug('Translations:', translations.size);

          // Repack JAR with translated files
          const repackedJar = await repackJar(jarBuffer, translations);
          logger.debug('Repacked JAR size:', repackedJar.length, 'bytes');

          // Replace JAR in result ZIP
          result.file(path, repackedJar);
          logger.debug('JAR updated in modpack');
        } else {
          logger.debug('No lang files in JAR, skipping');
        }
      } else {
        // Regular file processing (non-JAR)
        const content = await file.async('string');
        logger.debug('Content length:', content.length, 'chars');

        const translationResult = await translateFile(path, content, strategyResult.strategy);

        if (translationResult.success && translationResult.translatedContent) {
          logger.debug('Translated:', translationResult.stringsCount, 'strings');
          const ruPath = getRuPath(path);
          logger.debug('Output path:', ruPath);

          // Sanitize paths to prevent path traversal attacks
          try {
            const safePath = sanitizePath(ruPath !== path ? ruPath : path);

            if (ruPath !== path) {
              // For lang files: add ru_ru version, keep original
              result.file(safePath, translationResult.translatedContent);
              logger.debug('Added as new file (lang)');
            } else {
              // For quests/configs: overwrite in place
              result.file(safePath, translationResult.translatedContent);
              logger.debug('Overwritten in place');
            }
          } catch (error) {
            logger.error('Invalid path detected:', ruPath, error);
            // Skip this file if path is invalid
          }
        } else {
          logger.debug('No translation needed');
        }
      }
    } catch (err) {
      logger.error('Error:', err);
      /* skip on error */
    }

    done++;
    onProgress?.(done, entries.length, path);
  }

  logger.info('Generating result ZIP...');
  const resultBuffer = await result.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  logger.info('Result ZIP size:', resultBuffer.length, 'bytes');
  return resultBuffer;
}

export async function translateModpackFromBuffer(
  zipBuffer: Buffer,
  originalFileName: string
): Promise<{ buffer: Buffer; fileName: string }> {
  logger.info('translateModpackFromBuffer called');
  logger.debug('Original file:', originalFileName);

  const resultBuffer = await translateModpack(zipBuffer);

  // Generate output filename
  const outputFileName = originalFileName.replace(/\.(zip|jar)$/i, '_translated.$1');

  return {
    buffer: resultBuffer,
    fileName: outputFileName,
  };
}