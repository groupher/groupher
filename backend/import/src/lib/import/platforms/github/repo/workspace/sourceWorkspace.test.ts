import { describe, expect, it } from 'vitest'

import { createSourceWorkspace, normalizeSourcePath } from './sourceWorkspace'

describe('SourceWorkspace', () => {
  it('exposes normalized, sorted metadata and bounded text access', async () => {
    const workspace = createSourceWorkspace(
      'a'.repeat(40),
      new Map([
        ['docs\\start.md', '# Start'],
        ['docs/api.md', '# API'],
      ]),
    )

    expect(workspace.files).toEqual([
      { path: 'docs/api.md', sizeBytes: 5 },
      { path: 'docs/start.md', sizeBytes: 7 },
    ])
    await expect(workspace.readText('docs/start.md')).resolves.toBe('# Start')
  })

  it.each(['/absolute.md', '../escape.md', 'docs/../../escape.md'])(
    'rejects a path outside the workspace: %s',
    (sourcePath) => expect(() => normalizeSourcePath(sourcePath)).toThrow('relative path'),
  )

  it('rejects paths that collide after normalization', () => {
    expect(() =>
      createSourceWorkspace(
        'revision',
        new Map([
          ['docs/guide/../start.md', 'one'],
          ['docs/start.md', 'two'],
        ]),
      ),
    ).toThrow('duplicate normalized path')
  })
})
