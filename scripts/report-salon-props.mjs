import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { parse } from '@babel/parser'

/** Report direct useSalon bindings passed intact through JSX attributes. */
export function salonPropFindings(fileName, source) {
  let ast
  try {
    ast = parse(source, { sourceType: 'unambiguous', plugins: ['typescript', 'jsx'] })
  } catch (error) {
    throw new Error(`${fileName}: parse failed: ${error.message}`)
  }

  const scopes = new WeakMap()
  const findings = []
  const isFunction = (node) =>
    [
      'FunctionDeclaration',
      'FunctionExpression',
      'ArrowFunctionExpression',
      'ObjectMethod',
      'ClassMethod',
    ].includes(node.type)
  const children = (node, visit) => {
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'start', 'end', 'comments', 'tokens', 'extra'].includes(key)) continue
      if (Array.isArray(value)) value.forEach((child) => child?.type && visit(child))
      else if (value?.type) visit(value)
    }
  }
  const names = (pattern) => {
    if (!pattern) return []
    if (pattern.type === 'Identifier') return [pattern.name]
    if (pattern.type === 'RestElement') return names(pattern.argument)
    if (pattern.type === 'AssignmentPattern') return names(pattern.left)
    if (pattern.type === 'ObjectPattern')
      return pattern.properties.flatMap((p) =>
        names(p.type === 'RestElement' ? p.argument : p.value),
      )
    if (pattern.type === 'ArrayPattern') return pattern.elements.flatMap(names)
    return []
  }
  function collect(node, parent) {
    if (
      (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') &&
      node.id &&
      parent
    )
      parent.bindings.set(node.id.name, false)
    let scope = parent
    if (
      node.type === 'Program' ||
      isFunction(node) ||
      [
        'BlockStatement',
        'CatchClause',
        'ForStatement',
        'ForInStatement',
        'ForOfStatement',
        'SwitchStatement',
      ].includes(node.type)
    ) {
      scope = {
        parent,
        bindings: new Map(),
        isFunction: isFunction(node) || node.type === 'Program',
      }
      scopes.set(node, scope)
      if (isFunction(node))
        for (const param of node.params)
          for (const name of names(param)) scope.bindings.set(name, false)
      if (node.type === 'FunctionExpression' && node.id) scope.bindings.set(node.id.name, false)
      if (node.type === 'CatchClause')
        for (const name of names(node.param)) scope.bindings.set(name, false)
    }
    if (node.type === 'ImportDeclaration')
      for (const specifier of node.specifiers) scope.bindings.set(specifier.local.name, false)
    if (node.type === 'VariableDeclaration') {
      let target = scope
      if (node.kind === 'var') while (target.parent && !target.isFunction) target = target.parent
      for (const declaration of node.declarations) {
        const direct =
          declaration.id.type === 'Identifier' &&
          declaration.init?.type === 'CallExpression' &&
          declaration.init.callee.type === 'Identifier' &&
          declaration.init.callee.name === 'useSalon'
        for (const name of names(declaration.id)) target.bindings.set(name, direct)
      }
    }
    children(node, (child) => collect(child, scope))
  }
  collect(ast.program, null)

  function visit(node, parentScope, component) {
    const scope = scopes.get(node) ?? parentScope
    if (isFunction(node))
      component =
        node.id?.name ??
        (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression'
          ? node._componentName
          : undefined) ??
        component
    if (
      node.type === 'VariableDeclarator' &&
      node.id.type === 'Identifier' &&
      node.init &&
      isFunction(node.init)
    )
      node.init._componentName = node.id.name
    if (
      node.type === 'JSXAttribute' &&
      node.value?.type === 'JSXExpressionContainer' &&
      node.value.expression.type === 'Identifier'
    ) {
      const binding = node.value.expression.name
      let current = scope
      while (current && !current.bindings.has(binding)) current = current.parent
      if (current?.bindings.get(binding))
        findings.push({
          file: fileName,
          line: node.loc.start.line,
          component: component ?? '<unknown>',
          prop: node.name.name,
          binding,
        })
    }
    children(node, (child) => visit(child, scope, component))
  }
  visit(ast.program, null, undefined)
  return findings
}

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const name = path.join(dir, entry.name)
    if (entry.isDirectory())
      return ['node_modules', 'dist', 'build', 'out', '.next', 'coverage'].includes(entry.name)
        ? []
        : sourceFiles(name)
    return entry.isFile() && /\.[jt]sx$/.test(entry.name) ? [name] : []
  })
}

function main() {
  let count = 0
  let errors = 0
  const files = sourceFiles('frontend').sort()
  for (const file of files) {
    try {
      for (const finding of salonPropFindings(file, readFileSync(file, 'utf8'))) {
        console.log(
          `${finding.file}:${finding.line} ${finding.component}: ${finding.prop}={${finding.binding}}`,
        )
        count += 1
      }
    } catch (error) {
      console.error(String(error))
      errors += 1
    }
  }
  console.log(
    `Salon props report: ${count} candidates in ${files.length} files; ${errors} scan errors`,
  )
  if (errors) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main()
