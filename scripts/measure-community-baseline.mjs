import { gzipSync } from 'node:zlib'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const communityRoot = path.join(repoRoot, 'frontend/community')

const filesUnder = (root) => {
  if (!existsSync(root)) return []
  if (statSync(root).isFile()) return [root]
  const files = []
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(fullPath)
      else files.push(fullPath)
    }
  }
  visit(root)
  return files
}

const summarize = (root) => {
  const files = filesUnder(root).map((file) => {
    const buffer = readFileSync(file)
    return {
      file: path.relative(repoRoot, file),
      bytes: buffer.byteLength,
      gzipBytes: gzipSync(buffer).byteLength,
    }
  })
  return {
    files: files.length,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    gzipBytes: files.reduce((sum, file) => sum + file.gzipBytes, 0),
    largest: files.toSorted((left, right) => right.bytes - left.bytes).slice(0, 10),
  }
}

const probe = async (baseUrl) => {
  const routes = ['/health', '/', '/.well-known/jwks.json']
  const results = []
  for (const route of routes) {
    const started = performance.now()
    const response = await fetch(new URL(route, baseUrl))
    results.push({
      route,
      status: response.status,
      contentType: response.headers.get('content-type'),
      cacheControl: response.headers.get('cache-control'),
      durationMs: Math.round((performance.now() - started) * 100) / 100,
    })
  }
  return results
}

const result = {
  generatedAt: new Date().toISOString(),
  community: {
    client: summarize(path.join(communityRoot, 'dist/client/assets')),
    worker: summarize(path.join(communityRoot, 'dist/client', 'worker-revision-diff.js')),
      server: summarize(path.join(communityRoot, 'dist/server')),
  },
  main: {
    client: summarize(path.join(repoRoot, 'frontend/main/.next/static/chunks')),
    server: summarize(path.join(repoRoot, 'frontend/main/.next/server/app')),
  },
}

if (process.env.COMMUNITY_BASE_URL) {
  result.http = await probe(process.env.COMMUNITY_BASE_URL)
}

console.log(JSON.stringify(result, null, 2))
