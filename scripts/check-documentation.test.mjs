import assert from 'node:assert/strict'
import test from 'node:test'

import {
  elixirDefinitionArity,
  findDocumentationReadmeStatusIssue,
  findElixirModuleDocumentationIssues,
  findExportedCallableDocumentationIssues,
  findMarkdownLocalLinkIssues,
  hasAsciiFlow,
  javaScriptParserOptionsForFile,
  parseJavaScriptForDocumentation,
} from './check-documentation.mjs'

test('requires an ASCII transition instead of prose alone', () => {
  assert.equal(hasAsciiFlow('request -> policy -> counter'), true)
  assert.equal(hasAsciiFlow('Explains the request policy and counter.'), false)
})

test('audits outer and nested Elixir module docs independently', () => {
  const documented = `
defmodule Outer do
  @moduledoc """
  Owns the outer boundary.

      input -> Outer -> output
  """

  defmodule Inner do
    @moduledoc """
    Owns the inner adapter.

        Outer -> Inner -> dependency
    """
  end
end
`
  assert.deepEqual(findElixirModuleDocumentationIssues(documented), [])

  const missingNested = documented.replace(/    @moduledoc """[\s\S]*?    """\n  end/, '  end')
  assert.deepEqual(findElixirModuleDocumentationIssues(missingNested), [
    'Inner is missing @moduledoc',
  ])
})

test('does not treat defmodule examples, strings, or comments as nested source modules', () => {
  const source = `
defmodule Example do
  @moduledoc """
  A module example is documentation, not a nested source module.

      defmodule DocumentedExample do
        Example -> DocumentedExample -> result
      end
  """

  # defmodule CommentedOut do
  # end
end
`

  assert.deepEqual(findElixirModuleDocumentationIssues(source), [])
})

test('counts multiline Elixir arguments without counting nested commas', () => {
  const lines = [
    '  def resolve(',
    '        %{actor: actor, evidence: evidence},',
    '        classification,',
    '        opts \\\\ []',
    '      )',
    '      when is_map(classification) and is_list(opts) do',
  ]

  assert.equal(elixirDefinitionArity(lines, 0, 'resolve'), 3)
})

test('requires adjacent JSDoc for exported callables and local re-exports', () => {
  const source = `
/** Explains the exported operation and its side effects. */
export const documented = () => true

const missing = () => false
export { missing }

/** This comment is intentionally detached. */

export function detached() {
  return false
}
`

  assert.deepEqual(findExportedCallableDocumentationIssues(source), ['missing', 'detached'])
})

test('rejects recoverable parser errors instead of auditing a partial AST', () => {
  assert.throws(
    () => parseJavaScriptForDocumentation('export const duplicate = 1; export const duplicate = 2'),
    /has already been declared/,
  )
})

test('parses generic TypeScript arrows without treating plain TS as TSX', () => {
  const source = `
/** Preserves the input value without changing its type. */
export const identity = <T>(value: T): T => value
`

  assert.deepEqual(findExportedCallableDocumentationIssues(source, { jsx: false }), [])
})

test('selects JSX parsing from the actual file extension', () => {
  assert.deepEqual(javaScriptParserOptionsForFile('module.ts'), { jsx: false })
  assert.deepEqual(javaScriptParserOptionsForFile('module.mts'), { jsx: false })
  assert.deepEqual(javaScriptParserOptionsForFile('component.tsx'), { jsx: true })
  assert.deepEqual(javaScriptParserOptionsForFile('component.jsx'), { jsx: true })
})

test('checks repository-local Markdown links while ignoring code and external URLs', () => {
  const source = `
[Existing](./exists.md)
[Missing](./missing.md#section)
[External](https://example.com/docs)
[Route](/examples)
\`[Code](./not-a-link.md)\`

\`\`\`text
[Fenced](./also-not-a-link.md)
\`\`\`

~~~text
[Tilde fenced](./also-not-a-link.md)
~~~

[With title](./exists.md "read this")
[Balanced](./guide_(v2).md)
`

  const issues = findMarkdownLocalLinkIssues(
    source,
    '/repo/docs/topic/current.md',
    (file) =>
      file === '/repo/docs/topic/exists.md' || file === '/repo/docs/topic/guide_(v2).md',
  )

  assert.deepEqual(issues, ['line 3 links to missing path ./missing.md#section'])
})

test('checks links after an indented closing fence', () => {
  const source = `~~~text
[Ignored](./ignored.md)
   ~~~
[Missing](./missing.md)
`

  assert.deepEqual(
    findMarkdownLocalLinkIssues(source, '/repo/docs/topic/current.md', () => false),
    ['line 4 links to missing path ./missing.md'],
  )
})

test('requires the fixed documentation README status vocabulary', () => {
  assert.equal(findDocumentationReadmeStatusIssue('> 状态：current\n'), null)
  assert.equal(findDocumentationReadmeStatusIssue('> 状态：in-progress\n'), null)
  assert.equal(
    findDocumentationReadmeStatusIssue('> 状态：mixed\n'),
    'uses non-standard status mixed',
  )
  assert.equal(findDocumentationReadmeStatusIssue('# Missing\n'), 'is missing a standard status')
})
