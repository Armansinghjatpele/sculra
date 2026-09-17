// ==============================================================================
// Sculra Path Normalization & File Classification Helpers
// (worker/src/change-intelligence/normalizer.ts)
// ==============================================================================

import { PathTraversalError } from './errors';

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'svgz',
  'pdf', 'woff', 'woff2', 'ttf', 'eot', 'otf',
  'zip', 'tar', 'gz', 'tgz', '7z', 'rar',
  'exe', 'dll', 'so', 'dylib', 'bin',
  'mp4', 'webm', 'mov', 'mp3', 'wav', 'ogg',
  'wasm', 'db', 'sqlite', 'sqlite3',
]);

const LOCKFILES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
  'cargo.lock',
  'poetry.lock',
  'gemfile.lock',
  'composer.lock',
  'flake.lock',
]);

/**
 * Safely normalizes repository file paths and defends against path traversal.
 */
export function normalizeRepoPath(rawPath: string | undefined | null): string {
  if (!rawPath) return '';

  let p = rawPath.replace(/\\/g, '/').trim();

  // Strip leading ./
  while (p.startsWith('./')) {
    p = p.slice(2);
  }

  // Remove duplicate slashes
  p = p.replace(/\/+/g, '/');

  // Strip leading slash if any
  if (p.startsWith('/')) {
    p = p.slice(1);
  }

  // Defend against path traversal or drive root
  if (p.includes('..') || /^[a-zA-Z]:/.test(p)) {
    throw new PathTraversalError(rawPath);
  }

  return p;
}

/**
 * Checks if the file is a binary file based on its extension.
 */
export function isBinaryFile(path: string): boolean {
  const ext = getFileExtension(path);
  return BINARY_EXTENSIONS.has(ext);
}

/**
 * Checks if the file is generated, bundled, or minified.
 */
export function isGeneratedOrMinified(path: string): boolean {
  const lower = path.toLowerCase();
  if (
    lower.endsWith('.min.js') ||
    lower.endsWith('.min.css') ||
    lower.endsWith('.bundle.js') ||
    lower.endsWith('.chunk.js') ||
    lower.endsWith('.map')
  ) {
    return true;
  }

  const parts = lower.split('/');
  return (
    parts.includes('dist') ||
    parts.includes('build') ||
    parts.includes('.next') ||
    parts.includes('out') ||
    parts.includes('coverage') ||
    parts.includes('node_modules')
  );
}

/**
 * Checks if the file is a package manager lockfile.
 */
export function isLockfile(path: string): boolean {
  const filename = path.split('/').pop()?.toLowerCase() || '';
  return LOCKFILES.has(filename);
}

/**
 * Checks if the file is documentation.
 */
export function isDocumentation(path: string): boolean {
  const lower = path.toLowerCase();
  const ext = getFileExtension(lower);
  if (ext === 'md' || ext === 'mdx' || ext === 'txt' || ext === 'rst') {
    return true;
  }
  const filename = lower.split('/').pop() || '';
  if (filename === 'license' || filename === 'notice' || filename === 'changelog') {
    return true;
  }
  return lower.startsWith('docs/') || lower.includes('/docs/');
}

/**
 * Checks if the file is a test file.
 */
export function isTestFile(path: string): boolean {
  const lower = path.toLowerCase();
  if (
    lower.includes('.test.') ||
    lower.includes('.spec.') ||
    lower.endsWith('_test.go') ||
    lower.endsWith('test.py')
  ) {
    return true;
  }
  const parts = lower.split('/');
  return (
    parts.includes('tests') ||
    parts.includes('__tests__') ||
    parts.includes('test') ||
    parts.includes('fixtures')
  );
}

/**
 * Helper to extract clean lowercase file extension without leading dot.
 */
export function getFileExtension(path: string): string {
  const parts = path.split('.');
  if (parts.length <= 1) return '';
  return parts[parts.length - 1].toLowerCase().trim();
}
