/** Report static operation shape from generated documents; no server execution. */
import { readFileSync } from 'node:fs'

import { parse as parseTypeScript } from '@babel/parser'
import { Lexer, parse, print, Source, TokenKind } from 'graphql'

const path = 'frontend/core/lib/graphql/generated/gql.ts'
let source
try {
  source = readFileSync(path, 'utf8')
} catch {
  throw new Error(`Missing ${path}; run pnpm graphql:codegen first`)
}
const file = parseTypeScript(source, { sourceType: 'module', plugins: ['typescript'] })
const documents = file.program.body.find(
  (n) => n.type === 'TSTypeAliasDeclaration' && n.id.name === 'Documents',
)
if (!documents || documents.typeAnnotation.type !== 'TSTypeLiteral') {
  throw new Error('Generated GraphQL document map not found')
}

const definitions = documents.typeAnnotation.members
  .filter((n) => n.key?.type === 'StringLiteral')
  .map((n) => ({ text: n.key.value, ast: parse(n.key.value) }))
const fragments = new Map()
for (const { ast } of definitions) {
  for (const def of ast.definitions) {
    if (def.kind === 'FragmentDefinition') fragments.set(def.name.value, def)
  }
}

const measure = (set, depth = 0, stack = new Set()) => {
  let fields = 0
  let maxDepth = depth
  for (const selection of set.selections) {
    if (selection.kind === 'Field') {
      fields++
      maxDepth = Math.max(maxDepth, depth + 1)
      if (selection.selectionSet) {
        const child = measure(selection.selectionSet, depth + 1, stack)
        fields += child.fields
        maxDepth = Math.max(maxDepth, child.maxDepth)
      }
    } else if (selection.kind === 'InlineFragment') {
      const child = measure(selection.selectionSet, depth, stack)
      fields += child.fields
      maxDepth = Math.max(maxDepth, child.maxDepth)
    } else {
      const name = selection.name.value
      if (stack.has(name)) throw new Error(`Fragment cycle: ${name}`)
      const fragment = fragments.get(name)
      if (!fragment) throw new Error(`Missing fragment: ${name}`)
      const child = measure(fragment.selectionSet, depth, new Set([...stack, name]))
      fields += child.fields
      maxDepth = Math.max(maxDepth, child.maxDepth)
    }
  }
  return { fields, maxDepth }
}

const reachableFragments = (set, seen = new Set()) => {
  for (const selection of set.selections) {
    if (selection.kind === 'FragmentSpread') {
      const name = selection.name.value
      if (!seen.has(name)) {
        const fragment = fragments.get(name)
        if (!fragment) throw new Error(`Missing fragment: ${name}`)
        seen.add(name)
        reachableFragments(fragment.selectionSet, seen)
      }
    } else if (selection.selectionSet) {
      reachableFragments(selection.selectionSet, seen)
    }
  }
  return seen
}

const countTokens = (text) => {
  const lexer = new Lexer(new Source(text))
  let count = 0
  while (lexer.advance().kind !== TokenKind.EOF) count++
  return count
}

const operations = []
for (const { ast } of definitions) {
  for (const def of ast.definitions) {
    if (def.kind === 'OperationDefinition') {
      const fragmentsText = [...reachableFragments(def.selectionSet)]
        .map((name) => print(fragments.get(name)))
        .join('\n')
      const tokens = countTokens(`${print(def)}\n${fragmentsText}`)
      operations.push({
        name: def.name?.value || '(anonymous)',
        tokens,
        ...measure(def.selectionSet),
      })
    }
  }
}
operations.sort((a, b) => b.fields - a.fields)
console.log(
  JSON.stringify(
    {
      note: 'Static authored document shape; list multipliers, variables, SQL and runtime latency are not measured.',
      operations: operations.length,
      maxTokens: Math.max(0, ...operations.map((o) => o.tokens)),
      topByFieldCount: operations.slice(0, 20),
    },
    null,
    2,
  ),
)
