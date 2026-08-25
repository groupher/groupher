import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildSchema, parse, validate } from 'graphql'
import type { DocumentNode, SelectionSetNode } from 'graphql'
import { describe, expect, it } from 'vitest'

import { DOC_TREE_MAX_VISIBLE_LEVELS } from '../../constant/dsb/docs'
import { pageDocuments } from './contract-inventory'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = path.join(__dirname, '../../../..', 'backend/api/schema.graphql')
const schema = buildSchema(fs.readFileSync(schemaPath, 'utf8'))

const maxPagesDepth = (
  selectionSet: SelectionSetNode,
  fragments: ReadonlyMap<string, SelectionSetNode>,
  depth = 0,
  visiting = new Set<string>(),
): number => {
  return selectionSet.selections.reduce((maxDepth, selection) => {
    if (selection.kind === 'FragmentSpread') {
      const fragmentName = selection.name.value
      const fragment = fragments.get(fragmentName)
      if (!fragment || visiting.has(fragmentName)) return maxDepth

      return Math.max(
        maxDepth,
        maxPagesDepth(fragment, fragments, depth, new Set([...visiting, fragmentName])),
      )
    }

    if (selection.kind === 'InlineFragment') {
      return Math.max(maxDepth, maxPagesDepth(selection.selectionSet, fragments, depth, visiting))
    }

    if (!selection.selectionSet) return maxDepth

    const nextDepth = selection.name.value === 'pages' ? depth + 1 : depth
    return Math.max(maxDepth, maxPagesDepth(selection.selectionSet, fragments, nextDepth, visiting))
  }, depth)
}

const documentPagesDepth = (document: DocumentNode): number => {
  const operation = document.definitions.find(
    (definition) => definition.kind === 'OperationDefinition',
  )
  if (!operation || operation.kind !== 'OperationDefinition') return 0

  const fragments = new Map(
    document.definitions
      .filter((definition) => definition.kind === 'FragmentDefinition')
      .map((definition) => [definition.name.value, definition.selectionSet]),
  )

  return maxPagesDepth(operation.selectionSet, fragments)
}

describe('page GraphQL documents', () => {
  it.each(Object.entries(pageDocuments))(
    '%s matches the current GraphQL schema',
    (name, source) => {
      const document = typeof source === 'string' ? parse(source) : (source as DocumentNode)
      const errors = validate(schema, document)

      expect(errors, `${name}: ${errors.map((error) => error.message).join('\n')}`).toEqual([])
    },
  )

  it('rejects the unknown-field failure fixture', () => {
    const errors = validate(
      schema,
      parse(`
        query UnknownFieldFixture {
          me {
            definitelyNotAField
          }
        }
      `),
    )

    expect(errors.map((error) => error.message).join('\n')).toContain(
      'Cannot query field "definitelyNotAField" on type "User"',
    )
  })

  it('keeps the public document tree at three visible levels', () => {
    const document =
      typeof pageDocuments.docPublicTree === 'string'
        ? parse(pageDocuments.docPublicTree)
        : pageDocuments.docPublicTree

    expect(documentPagesDepth(document) + 1).toBe(DOC_TREE_MAX_VISIBLE_LEVELS)
  })
})
