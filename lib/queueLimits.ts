// ============================================================
// BLOCK: Queue limits and constraints
// ============================================================

export const QUEUE_LIMITS = {
  // Maximum number of files in queue
  MAX_FILES: 20,

  // Maximum total size of all files in queue (in bytes)
  // 5 GB total
  MAX_TOTAL_SIZE: 5 * 1024 * 1024 * 1024,

  // Maximum size per single file (in bytes)
  // 800 MB per file (browser memory limit for base64 conversion)
  MAX_FILE_SIZE: 800 * 1024 * 1024,

  // Maximum concurrent translations
  MAX_CONCURRENT: 3,
} as const;

export const ERROR_MESSAGES = {
  QUEUE_FULL: 'Очередь заполнена. Максимум файлов: ',
  QUEUE_SIZE_EXCEEDED: 'Превышен общий размер очереди. Максимум: ',
  FILE_TOO_LARGE: 'Файл слишком большой. Максимум: ',
  UNSUPPORTED_FORMAT: 'Неподдерживаемый формат файла',
} as const;

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
