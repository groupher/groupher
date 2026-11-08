import assert from 'node:assert/strict'
import test from 'node:test'

import { boundaryFindings, maskElixir } from './check-cms-context-module-boundary.mjs'

test('reports forbidden P0 boundaries by owner', () => {
  const findings = boundaryFindings(
    `
      def save(attrs) do
        Repo.transaction(fn -> persist(attrs) end)
        CMS.Outbox.send(%{event: "changed"})
        Writer.persist(attrs)
      end
    `,
    'backend/api/lib/groupher_server/cms/example/commands/save.ex',
  )

  assert.deepEqual(
    findings.map(({ category }) => category),
    ['transaction_owner', 'direct_outbox', 'command_writer'],
  )
})

test('reports Persist transaction ownership and Job command re-entry', () => {
  const persistFindings = boundaryFindings(
    `
      def save(attrs) do
        Repo.transaction(fn -> persist(attrs) end)
      end
    `,
    'backend/api/lib/groupher_server/cms/example/persist.ex',
  )
  const jobFindings = boundaryFindings(
    `
      def perform(job) do
        CMS.Example.Commands.Publish.execute(job.ref)
      end
    `,
    'backend/api/lib/groupher_server/cms/example/jobs/publish.ex',
  )

  assert.equal(persistFindings[0].category, 'persist_transaction')
  assert.equal(jobFindings[0].category, 'job_user_command')
})

test('allows one reviewed maintenance Command transaction but reports a second', () => {
  const path =
    'backend/api/lib/groupher_server/cms/artiment_mentions/commands/hide_source.ex'
  assert.deepEqual(boundaryFindings('Repo.transaction(fn -> :ok end)', path), [])
  assert.deepEqual(
    boundaryFindings('Repo.transaction(fn -> :ok end)\nRepo.transaction(fn -> :ok end)', path).map(
      ({ category }) => category,
    ),
    ['transaction_owner', 'transaction_owner'],
  )
})

test('reports empty Persist, Workflow user actions, and direct reaction writes', () => {
  const emptyPersist = boundaryFindings(
    'defmodule Example.Persist do\nend\n',
    'backend/api/lib/groupher_server/cms/example/persist.ex',
  )
  const workflow = boundaryFindings(
    'def submit(attrs), do: attrs\ndef cancel(ref), do: ref\n',
    'backend/api/lib/groupher_server/cms/community_applications/workflow.ex',
  )
  const wallpaperWorkflow = boundaryFindings(
    'def publish(community, input, actor), do: {:ok, input}\n',
    'backend/api/lib/groupher_server/cms/wallpaper/workflow.ex',
  )
  const reactions = boundaryFindings(
    'Repo.insert_all(Reaction, rows)\nRepo.delete_all(query)\n',
    'backend/api/lib/groupher_server/cms/interactions/reactions/upvote.ex',
  )

  assert.deepEqual(
    emptyPersist.map(({ category }) => category),
    ['empty_persist'],
  )
  assert.deepEqual(
    workflow.map(({ category }) => category),
    ['workflow_user_command', 'workflow_user_command'],
  )
  assert.equal(wallpaperWorkflow[0].category, 'workflow_user_command')
  assert.deepEqual(
    reactions.map(({ category }) => category),
    ['reaction_repo_write', 'reaction_repo_write'],
  )
})

test('reports writer naming and Persist delegates to Workflow', () => {
  const writer = boundaryFindings(
    'Repo.transaction(fn -> :ok end)\n',
    'backend/api/lib/groupher_server/cms/press/config_writer.ex',
  )
  const delegate = boundaryFindings(
    'defdelegate update(attrs), to: Example.Workflow\n',
    'backend/api/lib/groupher_server/cms/example/persist.ex',
  )

  assert.equal(writer[0].category, 'transaction_owner')
  assert.equal(delegate[0].category, 'persist_workflow_delegate')
})

test('reports Comment row writes kept inside Commands', () => {
  const findings = boundaryFindings(
    'ORM.create(Comment, attrs)\nRepo.update(comment, attrs)\n',
    'backend/api/lib/groupher_server/cms/comments/commands/create.ex',
  )

  assert.deepEqual(
    findings.map(({ category }) => category),
    ['comment_command_row_write', 'comment_command_row_write'],
  )
})

test('ignores comments and strings', () => {
  const source = `
    # Repo.transaction(fn -> :ok end)
    def explain, do: "CMS.Outbox.send(%{})"
  `

  assert.deepEqual(
    boundaryFindings(source, 'backend/api/lib/groupher_server/cms/example/commands/explain.ex'),
    [],
  )
  assert.equal(maskElixir(source).split('\n').length, source.split('\n').length)
})

test('masks sigils without hiding declarations that follow them', () => {
  const source = `@matcher ~r/"/
@interpolated ~s/#{inspect("/")}/
@literal ~S/#{/
@paired ~S(foo("bar"))
@heredoc ~S"""
quoted " content
"""
defmodule GroupherServer.Accounts.Profiles.Read do
end
`
  const masked = maskElixir(source)

  assert.equal(masked.includes('quoted'), false)
  assert.equal(masked.includes('defmodule GroupherServer.Accounts.Profiles.Read do'), true)
  assert.equal(masked.split('\n').length, source.split('\n').length)
})
