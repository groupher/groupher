/** Candidate-file admission rules for bounded repository extraction.
 *
 *   GitHub tree -> candidate filter -> bounded text/config files -> SourceWorkspace
 *
 * @see docs/bulk-import/bulk-import.md
 */
import path from 'node:path'

import { normalizeSourcePath } from './sourceWorkspace'

const EXCLUDED_SEGMENTS = new Set([
  '.git',
  '.next',
  '.turbo',
  '.vercel',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'public',
  'static',
  'vendor',
])

const RETAINED_FILENAMES = new Set([
  'astro.config.js',
  'astro.config.mjs',
  'astro.config.ts',
  'mkdocs.yml',
  'mkdocs.yaml',
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
  'package.json',
  'rspress.config.js',
  'rspress.config.mjs',
  'rspress.config.ts',
])

const RETAINED_EXTENSIONS = new Set([
  '.cjs',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mdx',
  '.mjs',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
])

/** Keeps bounded text/config candidates while excluding dependencies, builds, and binaries. */
export const isCandidateSourceFile = (rawPath: string): boolean => {
  const sourcePath = normalizeSourcePath(rawPath)
  const segments = sourcePath.split('/')
  if (segments.some((segment) => EXCLUDED_SEGMENTS.has(segment))) return false

  const basename = path.posix.basename(sourcePath).toLowerCase()
  return RETAINED_FILENAMES.has(basename) || RETAINED_EXTENSIONS.has(path.posix.extname(basename))
}
