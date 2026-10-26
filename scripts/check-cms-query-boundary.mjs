import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cmsRoot = path.join(repoRoot, 'backend', 'api', 'lib', 'groupher_server', 'cms')

const forbiddenLookups = new Map([
  ['articles/query.ex', ['article', 'community', 'branch_community', 'binding', 'pinned_binding']],
  ['communities/query.ex', ['get']],
  ['comments/query.ex', ['comment']],
])

const lookupOwners = new Set([
  'CMS.Articles.Query',
  'GroupherServer.CMS.Articles.Query',
  'CMS.Communities.Query',
  'GroupherServer.CMS.Communities.Query',
  'CMS.Comments.Query',
  'GroupherServer.CMS.Comments.Query',
])

/**
 * Find forbidden top-level resource lookups declared by the CMS query boundary.
 *
 * @param {string} relative Repository-relative source path.
 * @param {string} source Source text to inspect.
 * @returns {string[]} Human-readable boundary violations for the source.
 */
export const resourceLookupFindings = (relative, source) => {
  const findings = []
  const code = source.replace(/#.*/g, '')
  const base = relative.split(path.sep).slice(-2).join('/').toLowerCase()
  const declared = forbiddenLookups.get(base)

  if (declared) {
    for (const method of declared) {
      const definition = new RegExp(`^\\s*def\\s+${method}\\s*\\(`, 'm')
      if (definition.test(code)) {
        findings.push(`${relative}: forbidden resource lookup definition ${method}/…`)
      }
    }
  }

  const aliases = new Map()
  for (const [, target, explicit] of code.matchAll(/\balias\s+([A-Za-z0-9_.]+)(?:,\s*as:\s*([A-Z][A-Za-z0-9_]*))?/g)) {
    const normalized = target.replace(/^GroupherServer\./, '')
    if (lookupOwners.has(target) || lookupOwners.has(`GroupherServer.${normalized}`)) {
      aliases.set(explicit ?? target.split('.').at(-1), normalized)
    }
  }

  const methods = new Set([...forbiddenLookups.values()].flat())
  const checks = [
    ...[...lookupOwners].map((owner) => [owner, methods]),
    ...[...aliases].map(([alias, target]) => [alias, methods]),
  ]

  for (const [owner, ownerMethods] of checks) {
    for (const method of ownerMethods) {
      const call = new RegExp(`\\b${owner.replaceAll('.', '\\.')}\\s*\\.\\s*${method}\\s*\\(`)
      if (call.test(code)) {
        findings.push(`${relative}: forbidden ${owner}.${method}/… resource lookup`)
      }
    }
  }

  return findings
}

const collectElixirFiles = (directory) => {
  const files = []

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...collectElixirFiles(absolute))
    else if (entry.name.endsWith('.ex')) files.push(absolute)
  }

  return files
}

const check = () => collectElixirFiles(cmsRoot).flatMap((absolute) => {
  const relative = path.relative(repoRoot, absolute)
  const source = readFileSync(absolute, 'utf8')
  const findings = []

  if (path.basename(absolute) === 'reader.ex') {
    findings.push(`${relative}: reader.ex is not allowed in CMS production code`)
  }

  source.split('\n').forEach((line, index) => {
    const code = line.replace(/#.*/, '')
    if (
      /^\s*defmodule\s+.*\.Reader\b/.test(code) ||
      /^\s*alias\s+.*\.Reader\b/.test(code) ||
      /\b(?:CMS\.)?[A-Z][A-Za-z0-9_.]*\.Reader\.[a-z_]/.test(code) ||
      /\bReader\.[a-z_]/.test(code)
    ) {
      findings.push(`${relative}:${index + 1}: ${line.trim()}`)
    }
  })

  findings.push(...resourceLookupFindings(relative, source))

  return findings
})

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const violations = check()

  if (violations.length > 0) {
    console.error(`CMS Query boundary violations found:\n${violations.map((item) => `- ${item}`).join('\n')}`)
    process.exit(1)
  }

  console.log('CMS Query boundary is clean: no CMS Reader modules or forbidden top-level resource lookup.')
}
