/**
 * Security utilities for the application
 * Provides functions to prevent common security vulnerabilities
 */

// Maximum base64 size: 800MB file * 1.33 (base64 overhead) = ~1.1GB
// Browser memory limit - files larger than 800MB will crash the browser
export const MAX_BASE64_SIZE = 1.1 * 1024 * 1024 * 1024;

/**
 * Sanitize file paths to prevent path traversal attacks
 * Ensures paths stay within the assets/ directory
 */
export function sanitizePath(filePath: string): string {
  // Remove .. and leading slashes
  const normalized = filePath
    .replace(/\.\./g, '')
    .replace(/^\/+/, '')
    .replace(/\\+/g, '/');

  // Ensure path is inside assets/
  if (!normalized.startsWith('assets/')) {
    throw new Error('Invalid file path: must be inside assets/');
  }

  return normalized;
}

/**
 * Sanitize file names to prevent XSS attacks
 * Removes potentially dangerous characters
 */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .substring(0, 255);
}

/**
 * Safe JSON parse with prototype pollution protection
 * Removes dangerous keys that could be used for attacks
 */
export function safeJsonParse(text: string): any {
  const obj = JSON.parse(text);

  // Remove dangerous keys
  if (obj && typeof obj === 'object') {
    delete obj.__proto__;
    delete obj.constructor;
    delete obj.prototype;
  }

  return obj;
}

/**
 * Validate file type by checking magic bytes
 * More secure than checking file extensions
 */
export function validateFileType(buffer: Buffer, expectedType: 'zip' | 'json'): boolean {
  if (expectedType === 'zip') {
    // ZIP magic bytes: 50 4B 03 04
    return buffer.length >= 4 &&
           buffer[0] === 0x50 &&
           buffer[1] === 0x4B &&
           buffer[2] === 0x03 &&
           buffer[3] === 0x04;
  }

  if (expectedType === 'json') {
    // JSON starts with { or [
    const first = buffer[0];
    return first === 0x7B || first === 0x5B;
  }

  return false;
}

/**
 * Validate base64 string size to prevent DoS attacks
 * Throws error if size exceeds maximum
 */
export function validateBase64Size(base64: string): void {
  if (base64.length > MAX_BASE64_SIZE) {
    throw new Error('File too large (max 800MB)');
  }
}

/**
 * Create a safe timeout wrapper for fetch requests
 * Prevents hanging requests
 */
export function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
}
