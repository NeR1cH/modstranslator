export type FileFormat = 'jar' | 'json' | 'lang' | 'xml';
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
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning' | 'system';
}