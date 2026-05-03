// ============================================================
// Translation Report Generator
// Создает детальный отчет о том, что было переведено
// ============================================================

export interface TranslationEntry {
  original: string;
  translated: string;
  key?: string;
}

export interface FileReport {
  fileName: string;
  format: string;
  totalStrings: number;
  entries: TranslationEntry[];
}

export interface TranslationReport {
  mode: 'file' | 'jar' | 'modpack';
  totalFiles: number;
  totalStrings: number;
  files: FileReport[];
  timestamp: number;
}

export class TranslationReportBuilder {
  private report: TranslationReport;

  constructor(mode: 'file' | 'jar' | 'modpack') {
    this.report = {
      mode,
      totalFiles: 0,
      totalStrings: 0,
      files: [],
      timestamp: Date.now(),
    };
  }

  addFile(fileName: string, format: string, entries: TranslationEntry[]): void {
    this.report.files.push({
      fileName,
      format,
      totalStrings: entries.length,
      entries,
    });
    this.report.totalFiles++;
    this.report.totalStrings += entries.length;
  }

  getReport(): TranslationReport {
    return this.report;
  }

  // Генерация текстового отчета для отображения пользователю
  generateTextReport(): string {
    const lines: string[] = [];

    lines.push('═══════════════════════════════════════════════════════');
    lines.push('📊 ОТЧЕТ О ПЕРЕВОДЕ');
    lines.push('═══════════════════════════════════════════════════════');
    lines.push('');
    lines.push(`Режим: ${this.getModeLabel()}`);
    lines.push(`Файлов обработано: ${this.report.totalFiles}`);
    lines.push(`Строк переведено: ${this.report.totalStrings}`);
    lines.push(`Дата: ${new Date(this.report.timestamp).toLocaleString('ru-RU')}`);
    lines.push('');

    for (const file of this.report.files) {
      lines.push('───────────────────────────────────────────────────────');
      lines.push(`📄 ${file.fileName} [${file.format.toUpperCase()}]`);
      lines.push(`   Переведено строк: ${file.totalStrings}`);
      lines.push('');

      // Показываем первые 10 примеров перевода
      const samplesToShow = Math.min(10, file.entries.length);
      lines.push(`   Примеры перевода (${samplesToShow} из ${file.entries.length}):`);
      lines.push('');

      for (let i = 0; i < samplesToShow; i++) {
        const entry = file.entries[i];
        const originalPreview = this.truncate(entry.original, 50);
        const translatedPreview = this.truncate(entry.translated, 50);

        if (entry.key) {
          lines.push(`   [${entry.key}]`);
        }
        lines.push(`   EN: ${originalPreview}`);
        lines.push(`   RU: ${translatedPreview}`);
        lines.push('');
      }

      if (file.entries.length > samplesToShow) {
        lines.push(`   ... и еще ${file.entries.length - samplesToShow} строк(и)`);
        lines.push('');
      }
    }

    lines.push('═══════════════════════════════════════════════════════');

    return lines.join('\n');
  }

  // Генерация HTML отчета для скачивания
  generateHtmlReport(): string {
    const html: string[] = [];

    html.push('<!DOCTYPE html>');
    html.push('<html lang="ru">');
    html.push('<head>');
    html.push('  <meta charset="UTF-8">');
    html.push('  <meta name="viewport" content="width=device-width, initial-scale=1.0">');
    html.push('  <title>Отчет о переводе</title>');
    html.push('  <style>');
    html.push('    body { font-family: "Courier New", monospace; background: #000; color: #0f0; padding: 20px; }');
    html.push('    .header { border: 2px solid #0f0; padding: 15px; margin-bottom: 20px; }');
    html.push('    .file { border: 1px solid #0f0; padding: 15px; margin-bottom: 15px; }');
    html.push('    .entry { margin: 10px 0; padding: 10px; background: #001100; }');
    html.push('    .key { color: #0ff; font-weight: bold; }');
    html.push('    .original { color: #ff0; }');
    html.push('    .translated { color: #0f0; }');
    html.push('    h1, h2, h3 { color: #0f0; text-shadow: 0 0 5px #0f0; }');
    html.push('  </style>');
    html.push('</head>');
    html.push('<body>');

    html.push('  <div class="header">');
    html.push('    <h1>📊 ОТЧЕТ О ПЕРЕВОДЕ</h1>');
    html.push(`    <p><strong>Режим:</strong> ${this.getModeLabel()}</p>`);
    html.push(`    <p><strong>Файлов обработано:</strong> ${this.report.totalFiles}</p>`);
    html.push(`    <p><strong>Строк переведено:</strong> ${this.report.totalStrings}</p>`);
    html.push(`    <p><strong>Дата:</strong> ${new Date(this.report.timestamp).toLocaleString('ru-RU')}</p>`);
    html.push('  </div>');

    for (const file of this.report.files) {
      html.push('  <div class="file">');
      html.push(`    <h2>📄 ${this.escapeHtml(file.fileName)} [${file.format.toUpperCase()}]</h2>`);
      html.push(`    <p><strong>Переведено строк:</strong> ${file.totalStrings}</p>`);

      for (const entry of file.entries) {
        html.push('    <div class="entry">');
        if (entry.key) {
          html.push(`      <div class="key">[${this.escapeHtml(entry.key)}]</div>`);
        }
        html.push(`      <div class="original"><strong>EN:</strong> ${this.escapeHtml(entry.original)}</div>`);
        html.push(`      <div class="translated"><strong>RU:</strong> ${this.escapeHtml(entry.translated)}</div>`);
        html.push('    </div>');
      }

      html.push('  </div>');
    }

    html.push('</body>');
    html.push('</html>');

    return html.join('\n');
  }

  private getModeLabel(): string {
    switch (this.report.mode) {
      case 'file': return 'Одиночный файл';
      case 'jar': return 'JAR мод';
      case 'modpack': return 'Модпак (ZIP)';
      default: return 'Неизвестно';
    }
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
