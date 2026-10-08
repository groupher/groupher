import assert from 'node:assert/strict'
import test from 'node:test'

import {
  findingsForSource,
  validateBusinessReturnShapeExceptions,
  unmatchedBusinessReturnShapeFindings,
} from './check-business-return-shape.mjs'

test('reports business bare success and with matches', () => {
  const findings = findingsForSource(`
    def update(value) do
      with :ok <- validate(value) do
        :ok
      end
    end
  `, 'backend/api/lib/example.ex')

  assert.deepEqual(
    findings.map(({ kind }) => kind),
    ['with_match', 'bare_return'],
  )
})

test('reports callback branches and keyword branches that return bare success', () => {
  const findings = findingsForSource(`
    def update(value) do
      Enum.map(value, fn _item -> :ok end)

      case value do
        {:ok, _value} -> :ok end
      end

      if value, do: value, else: :ok
      if value, do: value, then: :ok
    end
  `, 'backend/api/lib/example.ex')

  assert.deepEqual(
    findings.map(({ kind }) => kind),
    ['branch_bare_return', 'branch_bare_return', 'else_bare_return', 'then_bare_return'],
  )
})

test('does not report tagged tuple branches or near-miss atoms', () => {
  const findings = findingsForSource(`
    def update(value) do
      Enum.map(value, fn _item -> {:ok, :pass} end)

      case value do
        {:ok, _value} -> {:ok, :pass} end
      end

      if value, do: value, else: {:ok, :pass}
      if value, do: value, then: {:ok, :pass}
      if value, do: value, else: :okay
    end
  `, 'backend/api/lib/example.ex')

  assert.deepEqual(findings, [])
})

test('does not treat a bare atom nested in a map value as a function result', () => {
  const findings = findingsForSource(`
    def health(degraded?) do
      %{status: if(degraded?, do: :degraded, else: :ok)}
    end
  `, 'backend/api/lib/example.ex')

  assert.deepEqual(findings, [])
})

test('ignores comments and string examples', () => {
  const findings = findingsForSource(`
    # :ok <- historical_example()
    def update(value), do: "with :ok <- #{value}"
  `, 'backend/api/lib/example.ex')

  assert.deepEqual(findings, [])
})

test('matches only the registered occurrence count', () => {
  const findings = findingsForTestSource(`
    def perform(value) do
      :ok
      :ok
    end
  `)
  const result = unmatchedBusinessReturnShapeFindings(findings, [{
    path: 'backend/api/lib/example.ex',
    function: 'update/1',
    kind: 'bare_return',
    occurrences: 1,
    protocol: 'Oban.Worker',
    owner: 'Example',
    reason: 'framework boundary',
  }])

  assert.equal(result.unmatched.length, 1)
})

test('allows a registered callback branch while keeping business branches unmatched', () => {
  const findings = findingsForSource(`
    def callback(value) do
      Enum.map(value, fn _item -> :ok end)
    end

    def update(value) do
      if value, do: value, else: :ok
    end
  `, 'backend/api/lib/example.ex')
  const result = unmatchedBusinessReturnShapeFindings(findings, [{
    path: 'backend/api/lib/example.ex',
    function: 'callback/1',
    kind: 'branch_bare_return',
    occurrences: 1,
    protocol: 'Example.Callback',
    owner: 'Example.Callback',
    reason: 'framework callback requires the bare :ok contract',
  }])

  assert.deepEqual(
    result.unmatched.map(({ kind, function: functionName }) => ({ kind, functionName })),
    [{ kind: 'else_bare_return', functionName: 'update/1' }],
  )
})

test('validates exception metadata and detects stale registrations', () => {
  const valid = {
    path: 'backend/api/lib/example.ex',
    function: 'perform/1',
    kind: 'bare_return',
    occurrences: 1,
    protocol: 'Oban.Worker',
    owner: 'Example',
    reason: 'framework callback',
  }

  assert.deepEqual(validateBusinessReturnShapeExceptions([valid]), [])
  const missingReason = { ...valid }
  delete missingReason.reason
  assert.match(
    validateBusinessReturnShapeExceptions([missingReason])[0],
    /missing reason/,
  )

  const stale = unmatchedBusinessReturnShapeFindings([], [valid])
  assert.equal(stale.unmatched.length, 0)
  assert.equal(stale.staleExceptions.length, 1)
})

const findingsForTestSource = (source) => {
  const lines = source.split('\n')
  const functionName = 'update/1'
  return lines.flatMap((line, index) => {
    const result = []
    if (/:ok\s*<-/.test(line) && !line.trim().startsWith('#')) {
      result.push({ path: 'backend/api/lib/example.ex', line: index + 1, function: functionName, kind: 'with_match', source: line.trim() })
    }
    if (/^\s*:ok\s*$/.test(line)) {
      result.push({ path: 'backend/api/lib/example.ex', line: index + 1, function: functionName, kind: 'bare_return', source: line.trim() })
    }
    return result
  })
}
