import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const backendLibRoot = path.join(repoRoot, 'backend', 'api', 'lib')

/**
 * Permanent protocol exceptions are limited to framework callbacks whose
 * public return contract is not owned by Groupher. Entries are matched by
 * function and occurrence kind, not by line number, so edits cannot silently
 * broaden an exception.
 */
export const businessReturnShapeExceptions = [
  {
    path: 'backend/api/lib/groupher_server/application.ex',
    function: 'config_change/3',
    kind: 'bare_return',
    occurrences: 1,
    protocol: 'Application.config_change/3',
    owner: 'GroupherServer.Application',
    reason: 'The OTP Application callback requires the bare :ok return contract',
  },
  {
    path: 'backend/api/lib/support/data_case.ex',
    function: 'setup/1',
    kind: 'bare_return',
    occurrences: 1,
    protocol: 'ExUnit.CaseTemplate setup/1',
    owner: 'GroupherServer.DataCase',
    reason: 'ExUnit setup callback uses the framework :ok context contract',
  },
  {
    path: 'backend/api/lib/support/channel_case.ex',
    function: 'setup/1',
    kind: 'bare_return',
    occurrences: 1,
    protocol: 'ExUnit.CaseTemplate setup/1',
    owner: 'GroupherServerWeb.ChannelCase',
    reason: 'ExUnit setup callback uses the framework :ok context contract',
  },
]

const sourceFiles = (root) => {
  const entries = readdirSync(root, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const absolute = path.join(root, entry.name)
    if (entry.isDirectory()) return sourceFiles(absolute)
    return entry.isFile() && entry.name.endsWith('.ex') ? [absolute] : []
  })
}

const maskNonCode = (source) => {
  const chars = [...source]
  let state = 'code'
  let quote = ''
  let triple = false

  const blank = (index) => {
    if (chars[index] !== '\n') chars[index] = ' '
  }

  for (let index = 0; index < chars.length; index += 1) {
    const current = chars[index]
    const next = chars[index + 1]
    const third = chars[index + 2]

    if (state === 'comment') {
      blank(index)
      if (current === '\n') state = 'code'
      continue
    }

    if (state === 'string') {
      blank(index)
      if (current === '\\') {
        blank(index + 1)
        index += 1
      } else if (triple ? current === quote && next === quote && third === quote : current === quote) {
        if (triple) {
          blank(index + 1)
          blank(index + 2)
          index += 2
        }
        state = 'code'
      }
      continue
    }

    if (current === '#') {
      blank(index)
      state = 'comment'
      continue
    }

    if ((current === '"' || current === "'") && next === current && third === current) {
      blank(index)
      blank(index + 1)
      blank(index + 2)
      index += 2
      quote = current
      triple = true
      state = 'string'
      continue
    }

    if (current === '"' || current === "'") {
      blank(index)
      quote = current
      triple = false
      state = 'string'
    }
  }

  return chars.join('')
}

const functionHeaders = (maskedSource) => {
  const headers = []
  const lines = maskedSource.split('\n')
  lines.forEach((line, index) => {
    const definition = line.match(/^\s*defp?\s+([a-zA-Z_][a-zA-Z0-9_!?]*)\s*(?:\((.*)\))?/)
    const setup = line.match(/^\s*(setup|setup_all)\s+(.+)$/)
    if (!definition && !setup) return
    const name = definition ? definition[1] : setup[1]
    const args = definition ? (definition[2] ?? '') : (setup[2].trim().startsWith('do') ? '' : setup[2])
    const arity = args.trim() === '' ? 0 : args.split(',').length
    headers.push({ line: index + 1, function: `${name}/${arity}` })
  })
  return headers
}

const nearestFunction = (headers, line) => {
  let current = null
  for (const header of headers) {
    if (header.line > line) break
    current = header
  }
  return current?.function ?? 'unknown/0'
}

const isNestedKeywordValue = (line, keyword) => {
  const match = line.match(new RegExp(`\\b${keyword}\\s*:\\s*:ok\\b`))
  if (!match) return false

  const prefix = line.slice(0, match.index)
  return /(?:^|[,{])\s*[a-zA-Z_][a-zA-Z0-9_!?]*\s*:\s*(?:if|unless|case|cond|then)\s*\(/.test(prefix)
}

/** Extracts business return-shape findings from one source file. */
export const findingsForSource = (source, relativePath) => {
  const masked = maskNonCode(source)
  const lines = masked.split('\n')
  const headers = functionHeaders(masked)
  const findings = []

  lines.forEach((line, index) => {
    const lineNumber = index + 1
    const functionName = nearestFunction(headers, lineNumber)
    const add = (kind, sourceText) => findings.push({
      path: relativePath,
      line: lineNumber,
      function: functionName,
      kind,
      source: sourceText.trim(),
    })

    if (/:ok\s*<-/.test(line)) add('with_match', line)
    if (/^\s*:ok\s*$/.test(line)) add('bare_return', line)
    if (/\bdo:\s*:ok\b/.test(line)) add('inline_bare_return', line)
    if (/->\s*:ok\b/.test(line)) add('branch_bare_return', line)
    if (/\belse\s*:\s*:ok\b/.test(line) && !isNestedKeywordValue(line, 'else')) {
      add('else_bare_return', line)
    }
    if (/\bthen\s*:\s*:ok\b/.test(line) && !isNestedKeywordValue(line, 'then')) {
      add('then_bare_return', line)
    }
  })

  return findings
}

/** Scans the configured backend library root for return-shape findings. */
export const businessReturnShapeFindings = (root = backendLibRoot) => {
  return sourceFiles(root).flatMap((absolute) => {
    const relative = path.relative(repoRoot, absolute)
    return findingsForSource(readFileSync(absolute, 'utf8'), relative)
  })
}

const exceptionKey = ({ path: filePath, function: functionName, kind }) => `${filePath}|${functionName}|${kind}`

/** Applies the exception manifest and reports unmatched or stale findings. */
export const unmatchedBusinessReturnShapeFindings = (findings, exceptions = businessReturnShapeExceptions) => {
  const allowed = new Map()
  for (const exception of exceptions) {
    const key = exceptionKey(exception)
    allowed.set(key, (allowed.get(key) ?? 0) + exception.occurrences)
  }

  const matched = new Map()
  const unmatched = findings.filter((finding) => {
    const key = exceptionKey(finding)
    const used = matched.get(key) ?? 0
    const limit = allowed.get(key) ?? 0
    if (used >= limit) return true
    matched.set(key, used + 1)
    return false
  })

  const staleExceptions = exceptions.filter((exception) => {
    const key = exceptionKey(exception)
    return !findings.some((finding) => exceptionKey(finding) === key)
  })

  return { unmatched, staleExceptions }
}

/** Validates required fields and uniqueness in the exception manifest. */
export const validateBusinessReturnShapeExceptions = (exceptions) => {
  const required = ['path', 'function', 'kind', 'occurrences', 'protocol', 'owner', 'reason']
  const errors = []
  const seen = new Set()

  exceptions.forEach((exception, index) => {
    required.forEach((field) => {
      if (!(field in exception)) errors.push(`exception ${index} is missing ${field}`)
    })
    const key = exceptionKey(exception)
    if (seen.has(key)) errors.push(`duplicate exception ${key}`)
    seen.add(key)
    if (!Number.isInteger(exception.occurrences) || exception.occurrences < 1) {
      errors.push(`exception ${key} must have a positive integer occurrence count`)
    }
  })

  return errors
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const reportOnly = process.argv.includes('--report')
  const exceptionErrors = validateBusinessReturnShapeExceptions(businessReturnShapeExceptions)
  const findings = businessReturnShapeFindings()
  const { unmatched, staleExceptions } = unmatchedBusinessReturnShapeFindings(
    findings,
    businessReturnShapeExceptions,
  )

  if (exceptionErrors.length > 0 || staleExceptions.length > 0 || unmatched.length > 0) {
    const messages = [
      ...exceptionErrors.map((message) => `- ${message}`),
      ...staleExceptions.map((exception) => `- stale exception ${exceptionKey(exception)}`),
      ...unmatched.map((finding) =>
        `- ${finding.path}:${finding.line}: ${finding.kind} in ${finding.function}: ${finding.source}`,
      ),
    ]
    console.error(`Business return-shape findings (${findings.length} total):\n${messages.join('\n')}`)
    if (!reportOnly) process.exit(1)
  } else {
    console.log(`Business return-shape clean across ${findings.length} checked expressions.`)
  }
}
