import { describe, expect, it } from 'vitest'

import { analyzeSourceWorkspace } from '../../../threads/docs/analyzer'
import {
  extractArchiveToWorkspace,
  openGitHubArchive,
  resolveGitHubRepo,
  withTemporaryWorkspace,
} from './workspace'

const repoUrl = process.env.DOCS_IMPORT_SMOKE_REPO_URL
const expectedFramework = process.env.DOCS_IMPORT_SMOKE_FRAMEWORK

describe.skipIf(!repoUrl)('real public repository smoke test', () => {
  it('streams a fixed commit into a non-empty SourceAnalysis', async () => {
    const repo = await resolveGitHubRepo(repoUrl!)
    const analysis = await withTemporaryWorkspace(async (directory) => {
      const archive = await openGitHubArchive(repo)
      const extracted = await extractArchiveToWorkspace(archive, directory, repo.commit)
      return analyzeSourceWorkspace(extracted.workspace)
    })

    expect(analysis.tree.source.framework).toBe(expectedFramework)
    expect(analysis.tree.navigation.length).toBeGreaterThan(0)
    expect(analysis.documents.length).toBeGreaterThan(0)
  }, 120_000)
})
