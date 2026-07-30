/**
 * Static JS/TS config decoding that never executes repository code.
 *
 * @see docs/bulk-import/bulk-import.md
 */
import { parse } from '@babel/parser'

import { DocsImportError } from '../../../core/errors'

type TNode = Record<string, unknown> & { type: string }
type TEnvironment = Map<string, unknown>

export const UNSUPPORTED_STATIC_VALUE = Symbol('unsupported-static-value')

const node = (value: unknown): TNode | null =>
  value && typeof value === 'object' && 'type' in value ? (value as TNode) : null

const propertyName = (value: unknown, environment: TEnvironment): string | null => {
  const key = node(value)
  if (!key) return null
  if (key.type === 'Identifier') return String(key.name)
  const evaluated = evaluate(key, environment)
  return typeof evaluated === 'string' ? evaluated : null
}

const functionBody = (value: unknown): TNode | null => {
  const functionNode = node(value)
  if (!functionNode) return null
  const body = node(functionNode.body)
  if (!body) return null
  if (body.type !== 'BlockStatement') return body
  const statements = Array.isArray(body.body) ? body.body : []
  const returnStatement = statements.map(node).find((item) => item?.type === 'ReturnStatement')
  return node(returnStatement?.argument)
}

const evaluate = (value: unknown, environment: TEnvironment): unknown => {
  const current = node(value)
  if (!current) return UNSUPPORTED_STATIC_VALUE

  switch (current.type) {
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
      return current.value
    case 'NullLiteral':
      return null
    case 'TemplateLiteral': {
      const expressions = Array.isArray(current.expressions) ? current.expressions : []
      const quasis = Array.isArray(current.quasis) ? current.quasis : []
      if (expressions.length > 0 || quasis.length !== 1) return UNSUPPORTED_STATIC_VALUE
      const quasi = node(quasis[0])
      const quasiValue =
        quasi?.value && typeof quasi.value === 'object'
          ? (quasi.value as Record<string, unknown>)
          : null
      const cooked = quasiValue?.cooked
      return typeof cooked === 'string' ? cooked : UNSUPPORTED_STATIC_VALUE
    }
    case 'Identifier':
      return environment.get(String(current.name)) ?? UNSUPPORTED_STATIC_VALUE
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
      return evaluate(current.expression, environment)
    case 'UnaryExpression': {
      const argument = evaluate(current.argument, environment)
      if (current.operator === '-' && typeof argument === 'number') return -argument
      if (current.operator === '!' && typeof argument === 'boolean') return !argument
      return UNSUPPORTED_STATIC_VALUE
    }
    case 'ArrayExpression':
      return (Array.isArray(current.elements) ? current.elements : []).map((item) =>
        evaluate(item, environment),
      )
    case 'ObjectExpression': {
      const result: Record<string, unknown> = {}
      for (const value of Array.isArray(current.properties) ? current.properties : []) {
        const property = node(value)
        if (!property || property.type !== 'ObjectProperty') continue
        const name = propertyName(property.key, environment)
        if (name) result[name] = evaluate(property.value, environment)
      }
      return result
    }
    case 'CallExpression': {
      const callee = node(current.callee)
      const argumentsList = Array.isArray(current.arguments) ? current.arguments : []
      if (callee?.type === 'Identifier') {
        const target = environment.get(String(callee.name))
        const returned = functionBody(target)
        if (returned) return evaluate(returned, environment)
      }
      return argumentsList.length > 0
        ? evaluate(argumentsList[0], environment)
        : UNSUPPORTED_STATIC_VALUE
    }
    case 'JSXElement': {
      const children = Array.isArray(current.children) ? current.children : []
      const text = children
        .map(node)
        .filter((child) => child?.type === 'JSXText')
        .map((child) => String(child?.value ?? '').trim())
        .filter(Boolean)
        .join(' ')
      return text || UNSUPPORTED_STATIC_VALUE
    }
    default:
      return UNSUPPORTED_STATIC_VALUE
  }
}

/** Extracts supported literal config shapes or reports an unsupported static value. */
export const parseStaticConfig = (source: string, sourcePath: string): unknown => {
  let program: TNode
  try {
    program = parse(source, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    }).program as unknown as TNode
  } catch {
    throw new DocsImportError(
      'unsupported_dynamic_config',
      'analyzing',
      `Unable to statically parse ${sourcePath}.`,
      false,
      { sourcePath },
    )
  }

  const environment: TEnvironment = new Map()
  const namedExports: string[] = []
  let exported: unknown = UNSUPPORTED_STATIC_VALUE
  for (const value of Array.isArray(program.body) ? program.body : []) {
    const statement = node(value)
    if (statement?.type === 'FunctionDeclaration') {
      const id = node(statement.id)
      if (id?.type === 'Identifier') environment.set(String(id.name), statement)
    }
  }
  for (const value of Array.isArray(program.body) ? program.body : []) {
    const statement = node(value)
    if (!statement) continue
    const declaration =
      statement.type === 'ExportNamedDeclaration' ? node(statement.declaration) : statement
    if (declaration?.type === 'VariableDeclaration') {
      for (const value of Array.isArray(declaration.declarations) ? declaration.declarations : []) {
        const declaration = node(value)
        const id = node(declaration?.id)
        if (id?.type === 'Identifier') {
          const name = String(id.name)
          environment.set(name, evaluate(declaration?.init, environment))
          if (statement.type === 'ExportNamedDeclaration') namedExports.push(name)
        }
      }
    }
    if (statement.type === 'ExportDefaultDeclaration') {
      exported = evaluate(statement.declaration, environment)
    }
  }

  if (exported === UNSUPPORTED_STATIC_VALUE && namedExports.length > 0) {
    exported =
      namedExports.length === 1
        ? environment.get(namedExports[0])
        : Object.fromEntries(namedExports.map((name) => [name, environment.get(name)]))
  }

  if (exported === UNSUPPORTED_STATIC_VALUE) {
    throw new DocsImportError(
      'unsupported_dynamic_config',
      'analyzing',
      `${sourcePath} does not contain a statically readable default export.`,
      false,
      { sourcePath },
    )
  }
  return exported
}
