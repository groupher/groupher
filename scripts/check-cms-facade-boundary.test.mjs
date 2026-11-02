import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { commandFiles, commandManifestFindings, facadeBoundaryFindings } from './check-cms-facade-boundary.mjs'

test('rejects persistence, effects, and shared command construction in facades', () => {
  const source = `
    alias GroupherServer.Repo
    Repo.transaction(fn)
    Req.get(url)
    %CMS.Command{action: :update}
  `

  assert.equal(facadeBoundaryFindings(source).length, 5)
})

test('ignores historical boundary wording in moduledoc comments', () => {
  const source = `
    # Repo / external boundary
    def update(attrs), do: CMS.Articles.Commands.Update.execute(attrs)
  `

  assert.deepEqual(facadeBoundaryFindings(source), [])
})

test('requires the current Docs, Review and Ticket concrete command manifest', () => {
  assert.deepEqual(commandManifestFindings(), [])
})

test('rejects a Ticket command replaced by a pipeline import without execute', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'cms-command-manifest-'))
  try {
    for (const file of commandFiles) {
      const target = path.join(root, file)
      mkdirSync(path.dirname(target), { recursive: true })
      writeFileSync(target, 'def execute(community, args) do\nend\n')
    }
    const file = commandFiles.find((entry) => entry.startsWith('tickets/'))
    writeFileSync(path.join(root, file), 'use GroupherServer.CommandPipeline\n')
    assert.deepEqual(commandManifestFindings(root), [
      { file, message: 'concrete command must expose execute/...' },
    ])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
