export type FileFormat = 'jar' | 'zip' | 'json' | 'lang' | 'snbt' | 'toml' | 'cfg' | 'xml' | 'txt' | 'properties' | 'yaml';
export type FileStatus = 'pending' | 'extracting' | 'translating' | 'packing' | 'done' | 'error';

export interface LangEntry {
  key: string;
  value: string;
}

export interface ExtractedLangFile {
  path: string;
  format: 'json' | 'lang';
  entries: LangEntry[];
  rawContent: string;
}

export interface TranslationFile {
  id: string;
  name: string;
  size: number;
  format: FileFormat;
  status: FileStatus;
  errorMessage?: string;
  langFilesCount?: number;
  stringsCount: number;
  originalBase64: string;
  tempPath?: string;  // For streaming uploads (files >800MB)
  tempId?: string;    // Temp file identifier
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning' | 'system';
}

// API Response types
export interface AnalyzeResponse {
  stringsCount: number;
  langFilesCount?: number;
  mode?: string;
}

export interface TranslateResponse {
  resultBase64: string;
  translatedCount: number;
  langFilesCount: number;
  outputFileName: string;
}

export interface ExportRequest {
  files: Array<{ outputFileName: string; resultBase64: string }>;
}

export interface ApiErrorResponse {
  error: string;
}
