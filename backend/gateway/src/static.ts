import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const cwd = process.cwd()
const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC_ROOT =
  path.basename(cwd) === 'gateway'
    ? path.join(cwd, 'public')
    : path.join(cwd, 'backend/gateway/public')
const DIST_PUBLIC_ROOT = path.join(sourceRoot, 'public')

const PUBLIC_FILE_TYPES = {
  '/robots.txt': { fileName: 'robots.txt', contentType: 'text/plain; charset=utf-8' },
  '/sitemap.xml': { fileName: 'sitemap.xml', contentType: 'application/xml; charset=utf-8' },
  '/manifest.json': { fileName: 'manifest.json', contentType: 'application/manifest+json' },
  '/favicon.ico': { fileName: 'favicon.ico', contentType: 'image/x-icon' },
} as const

export const getPublicFile = (pathname: string) =>
  PUBLIC_FILE_TYPES[pathname as keyof typeof PUBLIC_FILE_TYPES]

export const readPublicFile = async (fileName: string): Promise<ArrayBuffer> => {
  const content = await readFile(path.join(PUBLIC_ROOT, fileName)).catch(() =>
    readFile(path.join(DIST_PUBLIC_ROOT, fileName)),
  )

  return content.buffer.slice(
    content.byteOffset,
    content.byteOffset + content.byteLength,
  ) as ArrayBuffer
}
