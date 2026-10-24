import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  backendContextV2LayoutFindings,
  backendContextV2SemanticFindings,
} from './check-backend-context-v2.mjs'

const withFixture = (callback) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'groupher-context-v2-'))
  try {
    return callback(root)
  } finally {
    rmSync(root, { force: true, recursive: true })
  }
}

const touch = (root, relativePath, module) => {
  const file = path.join(root, relativePath)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, module ? `defmodule ${module} do\nend\n` : '')
}

const registry = (mode = 'strict') => ({ version: 2, contexts: { accounts: { mode } } })

test('accepts a Context facade, internal capability, Owners, and organizational namespaces', () => {
  withFixture((root) => {
    touch(root, 'accounts.ex', 'GroupherServer.Accounts')
    touch(root, 'accounts/profiles.ex', 'GroupherServer.Accounts.Profiles')
    touch(root, 'accounts/profiles/query.ex', 'GroupherServer.Accounts.Profiles.Query')
    touch(
      root,
      'accounts/profiles/query/by_login.ex',
      'GroupherServer.Accounts.Profiles.Query.ByLogin',
    )
    touch(root, 'accounts/model/user.ex', 'GroupherServer.Accounts.Model.User')
    touch(root, 'accounts/model/embeds/meta.ex', 'GroupherServer.Accounts.Model.Embeds.Meta')
    touch(
      root,
      'accounts/profiles/commands/update.ex',
      'GroupherServer.Accounts.Profiles.Commands.Update',
    )
    touch(root, 'accounts/categories/query.ex', 'GroupherServer.Accounts.Categories.Query')
    touch(
      root,
      'accounts/categories/commands/create.ex',
      'GroupherServer.Accounts.Categories.Commands.Create',
    )
    touch(root, 'accounts/outbox.ex', 'GroupherServer.Accounts.Outbox')
    touch(root, 'accounts/outbox/event.ex', 'GroupherServer.Accounts.Outbox.Event')

    assert.deepEqual(backendContextV2LayoutFindings({ root, registry: registry() }), [])
  })
})

test('preserves AI acronym casing for the shared capability Context', () => {
  withFixture((root) => {
    touch(root, 'ai.ex', 'GroupherServer.AI')
    touch(root, 'ai/adapters.ex', 'GroupherServer.AI.Adapters')

    const configured = { version: 2, contexts: { ai: { mode: 'strict' } } }
    assert.deepEqual(backendContextV2LayoutFindings({ root, registry: configured }), [])
  })
})

test('rejects missing Context and singular Owner facades plus unknown directories', () => {
  withFixture((root) => {
    touch(root, 'accounts/query/by_id.ex', 'GroupherServer.Accounts.Query.ById')
    touch(root, 'accounts/outbox/event.ex', 'GroupherServer.Accounts.Outbox.Event')
    touch(root, 'accounts/random/value.ex', 'GroupherServer.Accounts.Random.Value')

    const findings = backendContextV2LayoutFindings({ root, registry: registry() })
    const categories = findings.map(({ category }) => category)
    assert.equal(categories.includes('missing_context_facade'), true)
    assert.equal(categories.includes('missing_owner_facade'), true)
    assert.equal(categories.includes('unknown_internal_directory'), true)
    assert.equal(
      findings.some(
        ({ category, file }) => category === 'missing_owner_facade' && file.endsWith('/outbox'),
      ),
      true,
    )
  })
})

test('rejects generic and compound legacy architecture names without substring false positives', () => {
  withFixture((root) => {
    touch(root, 'accounts.ex', 'GroupherServer.Accounts')
    touch(root, 'accounts/profiles.ex', 'GroupherServer.Accounts.Profiles')
    touch(root, 'accounts/profiles/read.ex', 'GroupherServer.Accounts.Profiles.Read')
    touch(
      root,
      'accounts/collect_folders/write_confirmation.ex',
      'GroupherServer.Accounts.CollectFolders.WriteConfirmation',
    )
    touch(
      root,
      'accounts/profiles/write_confirmation.ex',
      'GroupherServer.Accounts.Profiles.MembershipResult',
    )
    touch(
      root,
      'accounts/profiles/commands/reader/item.ex',
      'GroupherServer.Accounts.Profiles.Commands.Reader.Item',
    )
    touch(
      root,
      'accounts/profiles/commands/mark_read.ex',
      'GroupherServer.Accounts.Profiles.Commands.MarkRead',
    )
    touch(
      root,
      'accounts/profiles/read_stateful.ex',
      'GroupherServer.Accounts.Profiles.ReadStateful',
    )
    touch(root, 'cms.ex', 'GroupherServer.CMS')
    touch(root, 'cms/interactions.ex', 'GroupherServer.CMS.Interactions')
    touch(
      root,
      'cms/interactions/read_state.ex',
      'GroupherServer.CMS.Interactions.LegacyProjection',
    )
    touch(
      root,
      'cms/interactions/read_state/query.ex',
      'GroupherServer.CMS.Interactions.ReadState.Query',
    )
    const mixed = path.join(root, 'accounts/profiles/mixed.ex')
    writeFileSync(
      mixed,
      `defmodule GroupherServer.Accounts.Profiles.Mixed do
end

defmodule GroupherServer.Accounts.Profiles.Writer do
end
`,
    )

    const findings = backendContextV2LayoutFindings({
      root,
      registry: {
        version: 2,
        contexts: { accounts: { mode: 'strict' }, cms: { mode: 'strict' } },
      },
    })
    const forbidden = findings.filter(({ category }) => category === 'forbidden_architecture_name')

    assert.equal(
      forbidden.some(({ file }) => file.endsWith('/profiles/read.ex')),
      true,
    )
    assert.equal(
      forbidden.some(({ file }) => file.endsWith('/write_confirmation.ex')),
      true,
    )
    assert.equal(
      forbidden.some(({ file }) => file.endsWith('/profiles/write_confirmation.ex')),
      true,
    )
    assert.equal(
      forbidden.some(({ file }) => file.endsWith('/commands/reader')),
      true,
    )
    assert.equal(
      forbidden.some(({ file }) => file.endsWith('/interactions/read_state')),
      true,
    )
    assert.equal(
      forbidden.some(({ file }) => file.endsWith('/interactions/read_state.ex')),
      true,
    )
    assert.equal(
      forbidden.some(({ file }) => file.endsWith('/interactions/read_state/query.ex')),
      true,
    )
    assert.equal(
      forbidden.some(({ file }) => file.endsWith('/profiles/mixed.ex')),
      true,
    )
    assert.equal(
      forbidden.some(({ file }) => file.endsWith('/mark_read.ex')),
      false,
    )
    assert.equal(
      forbidden.some(({ file }) => file.endsWith('/read_stateful.ex')),
      false,
    )
  })
})

test('rejects forbidden module names after sigils containing quotes', () => {
  withFixture((root) => {
    touch(root, 'accounts.ex', 'GroupherServer.Accounts')
    touch(root, 'accounts/profiles.ex', 'GroupherServer.Accounts.Profiles')
    const file = path.join(root, 'accounts/profiles/query.ex')
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(
      file,
      `@matcher ~r/"/
defmodule GroupherServer.Accounts.Profiles.Read do
end
`,
    )

    const findings = backendContextV2LayoutFindings({ root, registry: registry() })

    assert.equal(
      findings.some(({ category }) => category === 'forbidden_architecture_name'),
      true,
    )
  })
})

test('restricts Outbox writes to Effects and delivery state to Outbox Workflow', () => {
  withFixture((root) => {
    touch(root, 'cms.ex', 'GroupherServer.CMS')
    touch(root, 'cms/outbox.ex', 'GroupherServer.CMS.Outbox')
    touch(root, 'cms/outbox/workflow.ex', 'GroupherServer.CMS.Outbox.Workflow')
    touch(root, 'cms/outbox/workflow/article.ex', 'GroupherServer.CMS.Outbox.Workflow.Article')
    touch(root, 'cms/articles.ex', 'GroupherServer.CMS.Articles')
    touch(root, 'cms/articles/effects.ex', 'GroupherServer.CMS.Articles.Effects')
    touch(root, 'cms/articles/commands/publish.ex', 'GroupherServer.CMS.Articles.Commands.Publish')

    writeFileSync(
      path.join(root, 'cms/articles/effects.ex'),
      `defmodule GroupherServer.CMS.Articles.Effects do
  def enqueue(attrs), do: CMS.Outbox.send(attrs)
  def deliver(id, action), do: CMS.Outbox.execute(id, action)
end
`,
    )
    writeFileSync(
      path.join(root, 'cms/articles/commands/publish.ex'),
      `defmodule GroupherServer.CMS.Articles.Commands.Publish do
  alias GroupherServer.CMS, as: C
  def run(attrs), do: C.Outbox.send(attrs)
end
`,
    )
    writeFileSync(
      path.join(root, 'cms/outbox/workflow.ex'),
      `defmodule GroupherServer.CMS.Outbox.Workflow do
  def run(id, action), do: GroupherServer.CMS.Outbox.execute(id, action)
end
`,
    )
    writeFileSync(
      path.join(root, 'cms/outbox/workflow/article.ex'),
      `defmodule GroupherServer.CMS.Outbox.Workflow.Article do
  alias GroupherServer.CMS.Outbox
  def run(id, action), do: Outbox.execute(id, action)
end
`,
    )

    const findings = backendContextV2SemanticFindings({
      root,
      registry: { version: 2, contexts: { cms: { mode: 'strict' } } },
    })
    assert.equal(
      findings.filter(({ category }) => category === 'outbox_write_outside_effects').length,
      1,
    )
    assert.equal(
      findings.filter(({ category }) => category === 'outbox_delivery_outside_workflow').length,
      1,
    )
  })
})

test('keeps report-only findings non-blocking and rejects them in fully-strict mode', () => {
  withFixture((root) => {
    touch(root, 'accounts.ex', 'GroupherServer.Accounts')
    touch(root, 'accounts/random/value.ex', 'GroupherServer.Accounts.Random.Value')

    const report = backendContextV2LayoutFindings({ root, registry: registry('report_only') })
    assert.equal(
      report.every(({ mode }) => mode === 'report_only'),
      true,
    )

    const strict = backendContextV2LayoutFindings({
      root,
      registry: registry('report_only'),
      requireFullyStrict: true,
    })
    assert.equal(
      strict.some(({ category }) => category === 'report_only_registration'),
      true,
    )
  })
})

test('rejects dynamic callbacks and unstable persisted Worker payload fields', () => {
  withFixture((root) => {
    touch(root, 'jobs.ex', 'GroupherServer.Jobs')
    touch(root, 'jobs/unsafe.ex', 'GroupherServer.Jobs.Unsafe')
    writeFileSync(
      path.join(root, 'jobs/unsafe.ex'),
      `defmodule GroupherServer.Jobs.Unsafe do
  use Oban.Worker
  def enqueue(job), do: Jobs.later(job)
  def perform(%Oban.Job{args: %{"kind" => type, "module" => module}}), do: {type, module}
end
`,
    )

    const findings = backendContextV2SemanticFindings({
      root,
      registry: { version: 2, contexts: { jobs: { mode: 'strict' } } },
    })
    const categories = findings.map(({ category }) => category)
    assert.equal(categories.includes('dynamic_job_callback'), true)
    assert.equal(categories.includes('unstable_job_payload'), true)
  })
})

test('rejects apply/3 in Workers but ignores payload words in comments and strings', () => {
  withFixture((root) => {
    touch(root, 'jobs.ex', 'GroupherServer.Jobs')
    touch(root, 'jobs/unsafe.ex', 'GroupherServer.Jobs.Unsafe')
    writeFileSync(
      path.join(root, 'jobs/unsafe.ex'),
      `defmodule GroupherServer.Jobs.Unsafe do
  use Oban.Worker
  # prior JSON used "kind": "callback"
  def explain, do: "module: function: args: kind:"
  def perform(%Oban.Job{args: args}), do: apply(Target, :run, [args])
end
`,
    )

    const findings = backendContextV2SemanticFindings({
      root,
      registry: { version: 2, contexts: { jobs: { mode: 'strict' } } },
    })
    const categories = findings.map(({ category }) => category)
    assert.equal(categories.includes('dynamic_job_callback'), true)
    assert.equal(categories.includes('unstable_job_payload'), false)
  })
})

test('rejects a tagged error returned directly from Repo.transaction', () => {
  withFixture((root) => {
    touch(root, 'accounts.ex', 'GroupherServer.Accounts')
    writeFileSync(
      path.join(root, 'accounts.ex'),
      `defmodule GroupherServer.Accounts do
  def unsafe, do: Repo.transaction(fn -> {:error, :must_rollback} end)
end
`,
    )

    const findings = backendContextV2SemanticFindings({ root, registry: registry() })
    assert.equal(
      findings.some(({ category }) => category === 'transaction_error_without_rollback'),
      true,
    )
  })
})

test('does not treat nested callback error values as the transaction result', () => {
  withFixture((root) => {
    touch(root, 'accounts.ex', 'GroupherServer.Accounts')
    writeFileSync(
      path.join(root, 'accounts.ex'),
      `defmodule GroupherServer.Accounts do
  def safe do
    Repo.transaction(fn ->
      Enum.map([:ok], fn _value -> {:error, :data} end)
    end)
  end
end
`,
    )

    const findings = backendContextV2SemanticFindings({ root, registry: registry() })
    assert.equal(
      findings.some(({ category }) => category === 'transaction_error_without_rollback'),
      false,
    )
  })
})

test('rejects nested registry keys and root drift globally', () => {
  withFixture((root) => {
    touch(root, 'helper.ex', 'GroupherServer.Helper')
    mkdirSync(path.join(root, 'helper'), { recursive: true })

    const findings = backendContextV2LayoutFindings({
      root,
      registry: { version: 2, contexts: { 'accounts/profiles': { mode: 'strict' } } },
    })
    assert.equal(
      findings.some(({ category }) => category === 'nested_context_registration'),
      true,
    )
    assert.equal(
      findings.some(({ category }) => category === 'unknown_root_directory'),
      true,
    )
    assert.equal(
      findings.some(({ category }) => category === 'unknown_root_file'),
      true,
    )
  })
})

test('rejects Facade infrastructure, misplaced Workers, and cross-Context internals', () => {
  withFixture((root) => {
    touch(root, 'accounts.ex', 'GroupherServer.Accounts')
    touch(root, 'accounts/feature.ex', 'GroupherServer.Accounts.Feature')
    touch(root, 'accounts/worker.ex', 'GroupherServer.Accounts.Worker')
    touch(root, 'cms.ex', 'GroupherServer.CMS')
    touch(root, 'cms/query.ex', 'GroupherServer.CMS.Query')
    touch(root, 'jobs.ex', 'GroupherServer.Jobs')
    touch(root, 'jobs/worker.ex', 'GroupherServer.Jobs.Worker')

    writeFileSync(
      path.join(root, 'accounts.ex'),
      `defmodule GroupherServer.Accounts do\n  def get(id), do: Ecto.Multi.run(id, :read, &read/2)\nend\n`,
    )
    writeFileSync(
      path.join(root, 'accounts/feature.ex'),
      `defmodule GroupherServer.Accounts.Feature do\n  alias GroupherServer.CMS.Query\n  def run, do: Query.get :current\nend\n`,
    )
    writeFileSync(
      path.join(root, 'accounts/worker.ex'),
      `defmodule GroupherServer.Accounts.Worker do\n  use Oban.Worker\nend\n`,
    )
    writeFileSync(
      path.join(root, 'jobs/worker.ex'),
      `defmodule GroupherServer.Jobs.Worker do\n  use Oban.Worker\n  def perform(job), do: Cachex.get(:jobs, job.id)\nend\n`,
    )

    const findings = backendContextV2SemanticFindings({
      root,
      registry: {
        version: 2,
        contexts: {
          accounts: { mode: 'strict' },
          cms: { mode: 'strict' },
          jobs: { mode: 'strict' },
        },
      },
    })
    const categories = findings.map(({ category }) => category)
    assert.equal(categories.includes('facade_infrastructure_access'), true)
    assert.equal(categories.includes('worker_outside_jobs'), true)
    assert.equal(categories.includes('worker_infrastructure_access'), true)
    assert.equal(categories.includes('context_boundary'), true)
  })
})

test('rejects alternate syntax for internal behavior and Facade module escapes', () => {
  withFixture((root) => {
    touch(root, 'accounts.ex', 'GroupherServer.Accounts')
    touch(root, 'accounts/feature.ex', 'GroupherServer.Accounts.Feature')
    touch(root, 'accounts/importer.ex', 'GroupherServer.Accounts.Importer')
    touch(root, 'accounts/delegate.ex', 'GroupherServer.Accounts.Delegate')
    touch(root, 'cms.ex', 'GroupherServer.CMS')
    touch(root, 'cms/query.ex', 'GroupherServer.CMS.Query')
    touch(root, 'front_desk.ex', 'GroupherServer.FrontDesk')

    writeFileSync(
      path.join(root, 'accounts/feature.ex'),
      `defmodule GroupherServer.Accounts.Feature do\n  alias GroupherServer.CMS.Query, as: ForeignQuery\n  def capture, do: &ForeignQuery.get/1\nend\n`,
    )
    writeFileSync(
      path.join(root, 'accounts/importer.ex'),
      `defmodule GroupherServer.Accounts.Importer do\n  import GroupherServer.CMS.Query\nend\n`,
    )
    writeFileSync(
      path.join(root, 'accounts/feature.ex'),
      `defmodule GroupherServer.Accounts.Feature do\n  import GroupherServer.CMS\n  def capture, do: &GroupherServer.CMS.Query.get/1\nend\n`,
    )
    writeFileSync(
      path.join(root, 'accounts/delegate.ex'),
      `defmodule GroupherServer.Accounts.Delegate do\n  defdelegate get(id), to: GroupherServer.CMS.Query\nend\n`,
    )
    writeFileSync(
      path.join(root, 'front_desk.ex'),
      `defmodule GroupherServer.FrontDesk do\n  def revalidate, do: GroupherServer.Accounts.FrontDesk.Revalidate\nend\n`,
    )

    const findings = backendContextV2SemanticFindings({
      root,
      registry: {
        version: 2,
        contexts: {
          accounts: { mode: 'strict' },
          cms: { mode: 'strict' },
        },
      },
    })
    const categories = findings.map(({ category }) => category)
    assert.equal(categories.filter((category) => category === 'context_boundary').length >= 3, true)
    assert.equal(categories.includes('facade_internal_module_escape'), true)
    assert.equal(categories.includes('root_context_import'), true)
  })
})
