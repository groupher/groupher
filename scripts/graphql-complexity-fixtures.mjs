/** Collect repository operations and GraphiQL's actual introspection document for Absinthe. */
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { parse as parseTypeScript } from '@babel/parser'
import {
  buildSchema,
  getNamedType,
  isEnumType,
  isInputObjectType,
  isListType,
  isNonNullType,
  parse,
  print,
  typeFromAST,
} from 'graphql'

const schema = buildSchema(readFileSync('backend/api/schema.graphql', 'utf8'))
const generated = parseTypeScript(
  readFileSync('frontend/core/lib/graphql/generated/gql.ts', 'utf8'),
  {
    sourceType: 'module',
    plugins: ['typescript'],
  },
)
const documents = generated.program.body.find(
  (node) => node.type === 'TSTypeAliasDeclaration' && node.id.name === 'Documents',
)
const generatedDocs = documents.typeAnnotation.members
  .filter((node) => node.key?.type === 'StringLiteral')
  .map((node) => node.key.value)
const fragments = new Map()
for (const text of generatedDocs)
  for (const def of parse(text).definitions) {
    if (def.kind === 'FragmentDefinition') fragments.set(def.name.value, def)
  }
const operations = []
function visit(node, fn) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) return node.forEach((child) => visit(child, fn))
  fn(node)
  for (const [key, value] of Object.entries(node)) if (key !== 'loc') visit(value, fn)
}
function requiredValue(type, stack = new Set()) {
  if (isNonNullType(type)) return requiredValue(type.ofType, stack)
  if (isListType(type)) return []
  if (isEnumType(type)) return type.getValues()[0].name
  if (isInputObjectType(type)) {
    if (stack.has(type.name)) throw new Error(`Recursive required input ${type.name}`)
    const next = new Set([...stack, type.name])
    return Object.fromEntries(
      Object.values(type.getFields())
        .filter((field) => isNonNullType(field.type) && field.defaultValue === undefined)
        .map((field) => [field.name, requiredValue(field.type, next)]),
    )
  }
  switch (getNamedType(type).name) {
    case 'Int':
    case 'Float':
    case 'BigInt':
      return 1
    case 'Boolean':
      return true
    case 'DateTime':
      return '2026-01-01T00:00:00Z'
    case 'Date':
      return '2026-01-01'
    case 'UUID':
    case 'ID':
      return '00000000-0000-4000-8000-000000000000'
    case 'JSON':
    case 'Json':
      return '{}'
    default:
      return 'test'
  }
}
function add(text, source, globalFragments = false) {
  let document
  try {
    document = parse(text)
  } catch (error) {
    throw new Error(`${source}: ${error.message}`)
  }
  const local = new Map(
    document.definitions
      .filter((d) => d.kind === 'FragmentDefinition')
      .map((d) => [d.name.value, d]),
  )
  if (globalFragments)
    for (const [name, def] of fragments) if (!local.has(name)) local.set(name, def)
  for (const operation of document.definitions.filter((d) => d.kind === 'OperationDefinition')) {
    const found = new Set()
    function collect(node) {
      visit(node, (child) => {
        if (child.kind === 'FragmentSpread' && !found.has(child.name.value)) {
          const fragment = local.get(child.name.value)
          if (!fragment) throw new Error(`${source}: missing fragment ${child.name.value}`)
          found.add(child.name.value)
          collect(fragment)
        }
      })
    }
    collect(operation)
    const variables = Object.fromEntries(
      (operation.variableDefinitions || [])
        .filter((v) => v.type.kind === 'NonNullType' && !v.defaultValue)
        .map((v) => {
          const type = typeFromAST(schema, v.type)
          if (!type) throw new Error(`${source}: unknown variable type ${print(v.type)}`)
          return [v.variable.name.value, requiredValue(type)]
        }),
    )
    const directiveVariables = new Set()
    for (const node of [operation, ...[...found].map((name) => local.get(name))])
      visit(node, (child) => {
        if (child.kind === 'Directive' && ['skip', 'include'].includes(child.name.value)) {
          const condition = child.arguments?.find((arg) => arg.name.value === 'if')?.value
          if (condition?.kind === 'Variable') directiveVariables.add(condition.name.value)
        }
      })
    const flags = [...directiveVariables]
    if (flags.length > 8)
      throw new Error(`${source}: too many directive combinations in ${operation.name?.value}`)
    for (let mask = 0; mask < 2 ** flags.length; mask++) {
      const variants = Object.fromEntries(
        flags.map((flag, index) => [flag, Boolean(mask & (1 << index))]),
      )
      operations.push({
        name: operation.name?.value || '(anonymous)',
        source,
        query: [print(operation), ...[...found].map((name) => print(local.get(name)))].join('\n'),
        variables: { ...variables, ...variants },
      })
    }
  }
}
for (const doc of generatedDocs) add(doc, 'generated', true)

const roots = [
  'backend/auth/src',
  'backend/import/src',
  'backend/press/src',
  'backend/assets-hub/src',
  'frontend/core',
  'frontend/community/src',
  'frontend/dash/src',
  'frontend/apply/src',
  'frontend/landing',
]
function files(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const file = join(path, entry.name)
    if (entry.isDirectory())
      return ['generated', 'node_modules', '.next', '.tanstack', 'dist'].includes(entry.name)
        ? []
        : files(file)
    return /\.[cm]?[jt]sx?$/.test(file) && !/\.(test|spec)\./.test(file) ? [file] : []
  })
}
for (const file of roots.flatMap(files)) {
  const text = readFileSync(file, 'utf8')
  if (!/\b(query|mutation|subscription)\s+[A-Za-z_]\w*\s*(?:\(|\{)/.test(text)) continue
  const ast = parseTypeScript(text, {
    sourceType: 'unambiguous',
    plugins: file.endsWith('x') ? ['typescript', 'jsx'] : ['typescript'],
  })
  const constants = new Map()
  visit(ast.program, (node) => {
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.init)
      constants.set(node.id.name, node.init)
  })
  function resolve(node, stack = new Set()) {
    if (node.type === 'StringLiteral') return node.value
    if (node.type === 'Identifier' && constants.has(node.name) && !stack.has(node.name))
      return resolve(constants.get(node.name), new Set([...stack, node.name]))
    if (node.type === 'TemplateLiteral')
      return node.quasis
        .map(
          (part, i) =>
            part.value.cooked + (node.expressions[i] ? resolve(node.expressions[i], stack) : ''),
        )
        .join('')
    throw new Error(`${file}: cannot resolve GraphQL interpolation ${node.type}`)
  }
  visit(ast.program, (node) => {
    if (
      node.type === 'StringLiteral' &&
      /^(query|mutation|subscription)\s+[A-Za-z_]\w*\s*(?:\(|\{)/.test(node.value.trimStart())
    ) {
      add(node.value, file, true)
      return
    }
    if (node.type !== 'TemplateLiteral') return
    const head = node.quasis[0].value.cooked.trimStart()
    if (/^(query|mutation|subscription)\s+[A-Za-z_]\w*\s*(?:\(|\{)/.test(head))
      add(resolve(node), file, true)
  })
}
const requireGraphiql = createRequire(
  new URL('../backend/api/graphiql/package.json', import.meta.url),
)
const { getIntrospectionQuery } = requireGraphiql('graphql')
const introspection = getIntrospectionQuery({
  inputValueDeprecation: false,
  schemaDescription: false,
})
if (
  print(parse(readFileSync('backend/api/test/fixtures/graphiql_introspection.graphql', 'utf8'))) !==
  print(parse(introspection))
) {
  throw new Error('GraphiQL introspection fixture is stale for its installed graphql package')
}
add(introspection, 'graphiql-6')
process.stdout.write(JSON.stringify(operations))
