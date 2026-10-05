import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cmsRoot = path.join(repoRoot, 'backend', 'api', 'lib', 'groupher_server', 'cms')

const collectElixirFiles = (directory) => {
  const files = []

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...collectElixirFiles(absolute))
    else if (entry.name.endsWith('.ex')) files.push(absolute)
  }

  return files
}

const violations = collectElixirFiles(cmsRoot).flatMap((absolute) => {
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

  return findings
})

if (violations.length > 0) {
  console.error(`CMS Query boundary violations found:\n${violations.map((item) => `- ${item}`).join('\n')}`)
  process.exit(1)
}

console.log('CMS Query boundary is clean: no CMS Reader modules or references.')
