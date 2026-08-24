#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import path from 'node:path'

const args = process.argv.slice(2)
const relative = args.includes('--relative')
const absolute = args.includes('--absolute')
const [scope = '.', ...extensions] = args.filter((arg) => !['--relative', '--absolute'].includes(arg))
const normalizedScope = scope === '.' ? '' : scope.replace(/\/$/, '')
const normalizedExtensions = new Set(extensions.map((extension) => extension.replace(/^\./, '')))

const stagedFiles = execFileSync(
  'git',
  ['diff', '--cached', '--name-only', '--diff-filter=ACM', '-z'],
  { encoding: 'utf8' },
)

const files = stagedFiles
  .split('\0')
  .filter(Boolean)
  .filter((file) => !normalizedScope || file === normalizedScope || file.startsWith(`${normalizedScope}/`))
  .filter((file) => normalizedExtensions.size === 0 || normalizedExtensions.has(path.extname(file).slice(1)))

process.stdout.write(
  files
    .map((file) => (absolute ? path.resolve(file) : relative ? path.relative(normalizedScope || '.', file) : file))
    .join('\n'),
)
